import type { PostFormat } from '../../brand/brand';
import {
  defaultSlide,
  loadSlideIntoEditor,
  sanitizeFormat,
  useCarousel,
} from '../../store/carouselStore';
import { defaultFinish, emptyDoc, useEditor } from '../../store/editorStore';
import { useDraftsStore } from '../../store/draftsStore';
import { extractSingleSlideData } from '../crossover';
import { collectDocImageIds, reconcileAllSlides } from '../carouselGC';
import { collectGarbageImages, getStoredImageIds, loadUserImages } from '../userImages';
import { captureAndSaveCover, ensureCover } from './cover';
import { describeStorageError } from './db';
import { buildAutoTitle, defaultDraftTitle, isBodyMeaningful } from './content';
import { migrateLegacyDrafts } from './migration';
import {
  deleteDraftRecord,
  duplicateDraftRecord,
  getAllDraftRecords,
  getDraftCover,
  listDraftMetas,
  putDraftCover,
  readDraftRecord,
  saveDraftRecord,
  updateDraftMeta,
} from './repository';
import {
  DRAFT_SCHEMA_VERSION,
  newDraftId,
  newSlideId,
  type DraftBody,
  type DraftKind,
  type DraftMeta,
} from './types';

const SAVE_DEBOUNCE_MS = 450;
const CHANNEL_NAME = 'cuscuz-insta-kit:drafts';

let activeId: string | null = null;
let activeMeta: DraftMeta | null = null;
let isNewDraft = false;
let dirty = false;
let applyingState = false;
let installed = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveChain: Promise<void> = Promise.resolve();
let channel: BroadcastChannel | null = null;
let releaseLockFn: (() => void) | null = null;
let lockedDraftId: string | null = null;

// ------------------------------------------------------------------ helpers

function currentKind(): DraftKind {
  return useCarousel.getState().mode === 'carousel' ? 'carousel' : 'single';
}

function normalizeFormat(format: PostFormat | undefined): PostFormat {
  return sanitizeFormat(format ?? '3:4');
}

function buildBody(id: string): DraftBody {
  const carousel = useCarousel.getState();
  if (carousel.mode === 'carousel') {
    return {
      id,
      kind: 'carousel',
      slides: carousel.slides,
      activeSlideIndex: carousel.activeSlideIndex,
      format: carousel.format,
      schemaVersion: DRAFT_SCHEMA_VERSION,
    };
  }
  const editor = useEditor.getState();
  return {
    id,
    kind: 'single',
    doc: editor.doc,
    finish: editor.finish,
    schemaVersion: DRAFT_SCHEMA_VERSION,
  };
}

function bodyImageIds(body: DraftBody): Set<string> {
  const ids = new Set<string>();
  if (body.kind === 'single') {
    collectDocImageIds(body.doc, ids);
  } else {
    for (const slide of body.slides) collectDocImageIds(slide.doc, ids);
  }
  return ids;
}

function countImageElements(body: DraftBody): number {
  if (body.kind === 'single') {
    return body.doc.elements.filter((el) => el.kind === 'image').length;
  }
  return body.slides.reduce(
    (total, slide) => total + slide.doc.elements.filter((el) => el.kind === 'image').length,
    0,
  );
}

function reconcileBodyImages(
  body: DraftBody,
  available: Set<string>,
): { body: DraftBody; removed: number } {
  const before = countImageElements(body);
  if (body.kind === 'single') {
    const elements = body.doc.elements.filter(
      (el) => el.kind !== 'image' || available.has(el.imageId),
    );
    const next: DraftBody = {
      ...body,
      doc: { ...body.doc, elements },
    };
    return { body: next, removed: before - elements.filter((el) => el.kind === 'image').length };
  }

  const slides = reconcileAllSlides(body.slides, available);
  const after = slides.reduce(
    (total, slide) => total + slide.doc.elements.filter((el) => el.kind === 'image').length,
    0,
  );
  return { body: { ...body, slides }, removed: before - after };
}

function applyBodyToStores(body: DraftBody): void {
  if (body.kind === 'single') {
    const format = normalizeFormat(body.doc.format);
    const slide = {
      id: newSlideId(),
      doc: { ...body.doc, format },
      finish: body.finish,
    };
    useCarousel.setState({
      mode: 'single',
      slides: [slide],
      activeSlideIndex: 0,
      format,
    });
    useEditor.setState({
      doc: slide.doc,
      finish: slide.finish,
      step: 0,
      selectedIds: [],
      selectedId: null,
      editingId: null,
    });
    useEditor.temporal.getState().clear();
    return;
  }

  const format = normalizeFormat(body.format);
  useCarousel.setState({
    mode: 'carousel',
    slides: body.slides,
    activeSlideIndex: body.activeSlideIndex,
    format,
  });
  const active = body.slides[body.activeSlideIndex] ?? body.slides[0];
  if (active) loadSlideIntoEditor(active);
  useEditor.temporal.getState().clear();
}

/**
 * Hidrata imagens e carrega o corpo de um rascunho nos stores em memória sem
 * sair da home nem ativar o autosave, permitindo exportar direto do card.
 */
export async function prepareDraftForHomeExport(body: DraftBody): Promise<DraftBody> {
  const available = await getStoredImageIds();
  await loadUserImages(bodyImageIds(body));
  const reconciled = reconcileBodyImages(body, available);
  applyingState = true;
  try {
    applyBodyToStores(reconciled.body);
  } finally {
    applyingState = false;
  }
  return reconciled.body;
}

function nextMetaForBody(meta: DraftMeta, body: DraftBody): DraftMeta {
  const kind: DraftKind = body.kind;
  return {
    ...meta,
    kind,
    format: body.kind === 'carousel' ? normalizeFormat(body.format) : normalizeFormat(body.doc.format),
    slideCount: body.kind === 'carousel' ? body.slides.length : 1,
    title:
      meta.titleSource === 'auto'
        ? buildAutoTitle(body, kind, meta.createdAt)
        : meta.title,
    updatedAt: Date.now(),
    schemaVersion: DRAFT_SCHEMA_VERSION,
  };
}

// --------------------------------------------------------------- broadcast

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

function broadcastDraftsChanged(): void {
  getChannel()?.postMessage({ type: 'drafts-changed', at: Date.now() });
}

/** A home escuta outras abas (e o próprio editor) para atualizar a lista. */
export function onDraftsChanged(callback: () => void): () => void {
  const bus = getChannel();
  if (!bus) return () => {};
  const handler = (event: MessageEvent) => {
    const data = event.data as { type?: unknown } | null;
    if (data?.type === 'drafts-changed') callback();
  };
  bus.addEventListener('message', handler);
  return () => bus.removeEventListener('message', handler);
}

// ------------------------------------------------------------------ locks

function releaseDraftLock(): void {
  if (releaseLockFn) {
    const release = releaseLockFn;
    releaseLockFn = null;
    release();
  }
  lockedDraftId = null;
}

async function acquireDraftLock(id: string): Promise<boolean> {
  if (lockedDraftId === id) return true;
  releaseDraftLock();

  if (typeof navigator === 'undefined' || !navigator.locks) return true;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    void navigator.locks
      .request(`cuscuz-insta-kit:draft:${id}`, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          settle(false);
          return;
        }
        lockedDraftId = id;
        settle(true);
        await new Promise<void>((release) => {
          releaseLockFn = release;
        });
      })
      .catch(() => settle(false));
  });
}

// ------------------------------------------------------------------- saving

function scheduleSave(delay = SAVE_DEBOUNCE_MS): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void flushDraft();
  }, delay);
}

export function markDraftDirty(): void {
  if (applyingState || !activeId) return;
  dirty = true;
  const store = useDraftsStore.getState();
  if (store.saveStatus !== 'saving') {
    store.setSaveState('dirty', null);
  }
  scheduleSave();
}

async function persistIfDirty(): Promise<void> {
  if (!activeId || !activeMeta || !dirty) return;

  const id = activeId;
  const meta = activeMeta;
  const body = buildBody(id);

  if (isNewDraft && !isBodyMeaningful(body)) {
    dirty = false;
    return;
  }

  dirty = false;
  useDraftsStore.getState().setSaveState('saving', null);

  try {
    const nextMeta = nextMetaForBody(meta, body);
    await saveDraftRecord(nextMeta, body);
    if (activeId !== id) return;

    activeMeta = nextMeta;
    isNewDraft = false;
    useDraftsStore.getState().updateActiveMeta(nextMeta);
    useDraftsStore.getState().setSaveState('saved', null);
    broadcastDraftsChanged();
    // Capa é cosmética: fora da cadeia de erro do save e sem await, para não
    // atrasar o "Salvo". Garante que um reload antes de voltar pra home já
    // encontre uma capa gravada.
    void ensureCover(id);
  } catch (error) {
    dirty = true;
    const message = describeStorageError(error);
    useDraftsStore.getState().setSaveState('error', message);
    useDraftsStore.getState().setStorageWarning(message);
  }
}

/** Serializa os saves: um por vez, sempre com o snapshot mais recente. */
export function flushDraft(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveChain = saveChain.then(persistIfDirty, persistIfDirty);
  return saveChain;
}

/**
 * Saída da página: grava o doc e tenta garantir a capa enquanto o canvas ainda
 * está montado. Em `beforeunload` o trabalho assíncrono é best-effort (o timer
 * da captura pode não disparar) — por isso a home também é segura SEM capa.
 */
async function flushSession(): Promise<void> {
  await flushDraft();
  if (activeId) await ensureCover(activeId);
}

export function retrySave(): void {
  if (!activeId) return;
  dirty = true;
  useDraftsStore.getState().setSaveState('dirty', null);
  void flushDraft();
}

// ------------------------------------------------------------------- boot

async function refreshStorageEstimate(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (typeof usage === 'number' && typeof quota === 'number' && quota > 0 && usage / quota >= 0.8) {
      useDraftsStore
        .getState()
        .setStorageWarning(
          'O armazenamento deste navegador está quase cheio. Exclua posts antigos ou baixe uma cópia de segurança.',
        );
    }
  } catch {
    // Sem estimativa: não vale interromper a home.
  }
}

function requestPersistentStorage(): void {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  try {
    void navigator.storage.persist().catch(() => undefined);
  } catch {
    // Alguns navegadores só permitem pedir com gesto; a falha é silenciosa.
  }
}

export async function refreshDrafts(options: { silent?: boolean } = {}): Promise<void> {
  const current = useDraftsStore.getState();
  if (!options.silent && current.drafts.length === 0) {
    current.setListState('loading', null);
  }
  try {
    const metas = await listDraftMetas();
    useDraftsStore.getState().setDrafts(metas);
  } catch (error) {
    useDraftsStore.getState().setListState('error', describeStorageError(error));
  }
}

export async function bootDrafts(): Promise<void> {
  try {
    await migrateLegacyDrafts();

    const records = await getAllDraftRecords();

    // GC só depois da migração e com a UNIÃO de todos os rascunhos.
    const keep = new Set<string>();
    for (const record of records) {
      if (record.body.kind === 'single') collectDocImageIds(record.body.doc, keep);
      else for (const slide of record.body.slides) collectDocImageIds(slide.doc, keep);
    }
    await collectGarbageImages(keep);

    useDraftsStore.getState().setDrafts(records.map((record) => record.meta));
    useDraftsStore.getState().setScreen('home');
    void refreshStorageEstimate();
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith('migracao-')
        ? 'Não conseguimos ler os rascunhos antigos. Seus dados continuam guardados; tente recarregar a página.'
        : describeStorageError(error);
    useDraftsStore.getState().setListState('error', message);
    useDraftsStore.getState().setScreen('home');
  }
}

// --------------------------------------------------------------- open/create

export async function openDraft(id: string): Promise<boolean> {
  if (activeId === id && useDraftsStore.getState().screen === 'editor') return true;

  const locked = await acquireDraftLock(id);
  if (!locked) {
    useEditor
      .getState()
      .showToast('error', 'Esse post já está aberto em outra aba. Feche a outra aba e tente de novo 😉');
    return false;
  }

  try {
    const record = await readDraftRecord(id);
    if (!record) {
      releaseDraftLock();
      useEditor.getState().showToast('error', 'Não encontramos esse rascunho. Ele pode ter sido excluído.');
      return false;
    }

    const available = await getStoredImageIds();
    await loadUserImages(bodyImageIds(record.body));
    const reconciled = reconcileBodyImages(record.body, available);

    applyingState = true;
    try {
      applyBodyToStores(reconciled.body);
    } finally {
      applyingState = false;
    }

    activeId = id;
    activeMeta = record.meta;
    isNewDraft = false;
    dirty = false;

    useDraftsStore.getState().beginActiveDraft(record.meta);
    useDraftsStore.getState().setSaveState('saved', null);
    useDraftsStore.getState().setScreen('editor');

    if (reconciled.removed > 0) {
      const plural = reconciled.removed === 1 ? 'foto saiu' : 'fotos saíram';
      useEditor
        .getState()
        .showToast('error', `${reconciled.removed} ${plural} do post porque o arquivo não estava mais disponível.`);
    }

    return true;
  } catch (error) {
    releaseDraftLock();
    useEditor.getState().showToast('error', describeStorageError(error));
    return false;
  }
}

export function createDraft(kind: DraftKind, format: PostFormat = '3:4'): void {
  releaseDraftLock();

  const id = newDraftId();
  const now = Date.now();
  const safeFormat = normalizeFormat(format);
  const meta: DraftMeta = {
    id,
    title: defaultDraftTitle(kind, new Date(now)),
    titleSource: 'auto',
    kind,
    format: safeFormat,
    slideCount: 1,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
    schemaVersion: DRAFT_SCHEMA_VERSION,
  };

  applyingState = true;
  try {
    if (kind === 'carousel') {
      const slide = defaultSlide(safeFormat);
      useCarousel.setState({
        mode: 'carousel',
        slides: [slide],
        activeSlideIndex: 0,
        format: safeFormat,
      });
      loadSlideIntoEditor(slide);
    } else {
      const doc = { ...emptyDoc(), format: safeFormat };
      const finish = defaultFinish();
      useCarousel.setState({
        mode: 'single',
        slides: [{ id: newSlideId(), doc, finish }],
        activeSlideIndex: 0,
        format: safeFormat,
      });
      useEditor.setState({
        doc,
        finish,
        step: 0,
        selectedIds: [],
        selectedId: null,
        editingId: null,
      });
      useEditor.temporal.getState().clear();
    }
  } finally {
    applyingState = false;
  }

  activeId = id;
  activeMeta = meta;
  isNewDraft = true;
  dirty = false;

  useDraftsStore.getState().beginActiveDraft(meta);
  useDraftsStore.getState().setScreen('editor');
  requestPersistentStorage();
}

export async function closeDraftToHome(): Promise<void> {
  if (!activeId) {
    useDraftsStore.getState().setScreen('home');
    return;
  }

  const id = activeId;

  // Se um save terminou bem, `isNewDraft` vira false. Quando um post recém-
  // criado ainda não tem conteúdo, ele é descartado (não aparece vazio na home).
  await flushDraft();

  if (isNewDraft) {
    const body = buildBody(id);
    if (isBodyMeaningful(body)) {
      useEditor
        .getState()
        .showToast('error', 'Não conseguimos salvar este post. Ele continua aberto para você tentar de novo.');
      return;
    }
  }

  if (!isNewDraft) {
    try {
      await captureAndSaveCover(id, true);
    } catch {
      // A capa é cosmética; o post salvo continua íntegro.
    }
  }

  releaseDraftLock();
  activeId = null;
  activeMeta = null;
  isNewDraft = false;
  dirty = false;

  useCarousel.setState({ mode: null });
  useDraftsStore.getState().clearActiveDraft();
  useDraftsStore.getState().setScreen('home');

  await refreshDrafts({ silent: true });
  broadcastDraftsChanged();
}

// ------------------------------------------------------------------ actions

export async function renameActiveDraft(title: string): Promise<boolean> {
  if (!activeId || !activeMeta) return false;
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!clean || clean === activeMeta.title) return false;

  const id = activeId;
  const body = buildBody(id);
  const nextMeta: DraftMeta = {
    ...nextMetaForBody(activeMeta, body),
    title: clean,
    titleSource: 'user',
  };

  activeMeta = nextMeta;
  isNewDraft = false;
  dirty = false;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  useDraftsStore.getState().updateActiveMeta(nextMeta);
  useDraftsStore.getState().setSaveState('saving', null);

  const task = async (): Promise<boolean> => {
    try {
      await saveDraftRecord(nextMeta, body);
      if (activeId !== id) return false;
      useDraftsStore.getState().setSaveState('saved', null);
      broadcastDraftsChanged();
      void ensureCover(id);
      return true;
    } catch (error) {
      dirty = true;
      const message = describeStorageError(error);
      useDraftsStore.getState().setSaveState('error', message);
      useDraftsStore.getState().setStorageWarning(message);
      useEditor.getState().showToast('error', message);
      return false;
    }
  };

  const resultPromise = saveChain.then(task, task);
  saveChain = resultPromise.then(
    () => undefined,
    () => undefined,
  );
  return resultPromise;
}

export async function renameDraftFromHome(meta: DraftMeta, title: string): Promise<boolean> {
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!clean) return false;
  try {
    const updated = await updateDraftMeta(meta.id, { title: clean, titleSource: 'user' });
    if (!updated) return false;
    await refreshDrafts({ silent: true });
    broadcastDraftsChanged();
    return true;
  } catch (error) {
    useEditor.getState().showToast('error', describeStorageError(error));
    return false;
  }
}

export async function duplicateDraftFromHome(meta: DraftMeta): Promise<void> {
  try {
    const record = await readDraftRecord(meta.id);
    if (!record) {
      useEditor.getState().showToast('error', 'Não encontramos esse rascunho para duplicar.');
      return;
    }
    await duplicateDraftRecord(record, newDraftId());
    await refreshDrafts({ silent: true });
    broadcastDraftsChanged();
    useEditor.getState().showToast('success', 'Rascunho duplicado! Prontinho para editar.');
  } catch (error) {
    useEditor.getState().showToast('error', describeStorageError(error));
  }
}

interface DeletedSnapshot {
  meta: DraftMeta;
  body: DraftBody;
  cover: Blob | null;
}

async function restoreDeleted(snapshot: DeletedSnapshot): Promise<void> {
  try {
    await saveDraftRecord(snapshot.meta, snapshot.body);
    if (snapshot.cover) await putDraftCover(snapshot.meta.id, snapshot.cover);
    await refreshDrafts({ silent: true });
    broadcastDraftsChanged();
    useEditor.getState().showToast('success', 'Rascunho restaurado! Ele voltou para a sua lista.');
  } catch (error) {
    useEditor.getState().showToast('error', `Não deu para restaurar o rascunho. ${describeStorageError(error)}`);
  }
}

export async function deleteDraftWithUndo(meta: DraftMeta): Promise<void> {
  try {
    const record = await readDraftRecord(meta.id);
    if (!record) {
      useEditor.getState().showToast('error', 'Não encontramos esse rascunho.');
      await refreshDrafts({ silent: true });
      return;
    }
    let cover: Blob | null = null;
    try {
      cover = await getDraftCover(meta.id);
    } catch {
      cover = null;
    }

    await deleteDraftRecord(meta.id);
    await refreshDrafts({ silent: true });
    broadcastDraftsChanged();

    const snapshot: DeletedSnapshot = { meta: record.meta, body: record.body, cover };
    useEditor.getState().showToast('info', `“${meta.title}” foi excluído.`, {
      duration: 8000,
      actionLabel: 'Desfazer',
      onAction: () => {
        void restoreDeleted(snapshot);
      },
    });
  } catch (error) {
    useEditor.getState().showToast('error', describeStorageError(error));
  }
}

// ------------------------------------------------------- modo do rascunho

/**
 * Carrossel → post único NO MESMO rascunho. O corpo anterior fica em memória
 * para o "Desfazer" do toast; o mesmo id, título e capa são preservados.
 * `index = null` mantém o rascunho, mas começa uma folha em branco.
 */
export function convertActiveCarouselToSingle(index: number | null): void {
  if (useCarousel.getState().mode !== 'carousel') return;

  const { slides, format, activeSlideIndex } = useCarousel.getState();
  const chosen = index === null ? null : extractSingleSlideData(slides, index, format);
  if (index !== null && !chosen) return;

  const snapshot = { slides, format, activeSlideIndex };
  const doc = chosen
    ? { ...chosen.doc, format }
    : { ...emptyDoc(), format };
  const finish = chosen ? chosen.finish : defaultFinish();

  applyingState = true;
  try {
    const slide = {
      id: newSlideId(),
      doc,
      finish,
    };
    useCarousel.setState({
      mode: 'single',
      slides: [slide],
      activeSlideIndex: 0,
      format,
    });
    useEditor.setState({
      doc: slide.doc,
      finish: slide.finish,
      step: 0,
      selectedIds: [],
      selectedId: null,
      editingId: null,
    });
    useEditor.temporal.getState().clear();
  } finally {
    applyingState = false;
  }

  useDraftsStore.getState().setActiveKind('single');
  markDraftDirty();
  void flushDraft();

  useEditor.getState().showToast('info', 'Carrossel convertido em post único. Os outros slides saíram deste rascunho.', {
    duration: 8000,
    actionLabel: 'Desfazer',
    onAction: () => {
      applyingState = true;
      try {
        useCarousel.setState({
          mode: 'carousel',
          slides: snapshot.slides,
          activeSlideIndex: snapshot.activeSlideIndex,
          format: snapshot.format,
        });
        const active = snapshot.slides[snapshot.activeSlideIndex] ?? snapshot.slides[0];
        if (active) loadSlideIntoEditor(active);
        useEditor.temporal.getState().clear();
      } finally {
        applyingState = false;
      }
      useDraftsStore.getState().setActiveKind('carousel');
      markDraftDirty();
      void flushDraft();
    },
  });
}

// ------------------------------------------------------------- subscriptions

export function installDraftSession(): void {
  if (installed) return;
  installed = true;

  useEditor.subscribe((state, prev) => {
    if (state.doc !== prev.doc || state.finish !== prev.finish) markDraftDirty();
  });

  useCarousel.subscribe((state, prev) => {
    if (state.slides !== prev.slides || state.format !== prev.format) markDraftDirty();
    if (state.mode !== prev.mode && activeId) {
      const kind: DraftKind | null =
        state.mode === 'carousel' ? 'carousel' : state.mode === 'single' ? 'single' : null;
      useDraftsStore.getState().setActiveKind(kind);
    }
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushSession();
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
      void flushSession();
    });
    window.addEventListener('beforeunload', () => {
      void flushSession();
    });
  }
}

export function activeDraftKind(): DraftKind {
  return currentKind();
}
