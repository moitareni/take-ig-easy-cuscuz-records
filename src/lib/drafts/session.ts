import type { PostFormat } from '../../brand/brand';
import { getEditorLoadedSlideId, loadSlideIntoEditor, useCarousel } from '../../store/carouselStore';
import { flushTextEditing, resetEditorFor, useEditor } from '../../store/editorStore';
import { useDraftsStore } from '../../store/draftsStore';
import { isApplyingState, withApplyingState } from '../../store/syncEngine';
import { extractSingleSlideData, reconcileAllCrossovers } from '../crossover';
import { collectDocImageIds, reconcileAllSlides } from '../carouselGC';
import { defaultFinish, defaultSlide, emptyDoc, sanitizeFormat } from '../sanitize';
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
  sanitizeDraftBody,
  sanitizeDraftMeta,
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

const SAVE_DEBOUNCE_MS = 200;
const COVER_REFRESH_DEBOUNCE_MS = 1200;
const CHANNEL_NAME = 'cuscuz-insta-kit:drafts';
const SESSION_GLOBAL_KEY = '__cuscuzDraftSession';
const PENDING_CHECKPOINT_KEY = 'cuscuz-insta-kit:pending-checkpoint';

interface DraftSessionState {
  activeId: string | null;
  activeMeta: DraftMeta | null;
  isNewDraft: boolean;
  dirty: boolean;
  coverDirty: boolean;
  changeRevision: number;
  latestSavedRevision: number;
  activeSaves: number;
  installed: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;
  coverTimer: ReturnType<typeof setTimeout> | null;
  saveChain: Promise<void>;
  savingInFlight: boolean;
  channel: BroadcastChannel | null;
  releaseLockFn: (() => void) | null;
  lockedDraftId: string | null;
  disposeSubscribers: (() => void) | null;
}

function getSession(): DraftSessionState {
  const g = globalThis as unknown as Record<string, DraftSessionState | undefined>;
  if (!g[SESSION_GLOBAL_KEY]) {
    g[SESSION_GLOBAL_KEY] = {
      activeId: null,
      activeMeta: null,
      isNewDraft: false,
      dirty: false,
      coverDirty: false,
      changeRevision: 0,
      latestSavedRevision: 0,
      activeSaves: 0,
      installed: false,
      saveTimer: null,
      coverTimer: null,
      saveChain: Promise.resolve(),
      savingInFlight: false,
      channel: null,
      releaseLockFn: null,
      lockedDraftId: null,
      disposeSubscribers: null,
    };
  }
  return g[SESSION_GLOBAL_KEY];
}

const session = getSession();

// ------------------------------------------------------------------ helpers

function ensureActiveSessionRecovered(): void {
  if (session.activeId && session.activeMeta) return;
  const draftsState = useDraftsStore.getState();
  if (draftsState.screen !== 'editor' || !draftsState.activeDraftId) return;

  const id = draftsState.activeDraftId;
  const existingMeta = draftsState.drafts.find((d) => d.id === id) ?? null;
  const carousel = useCarousel.getState();
  const kind: DraftKind =
    draftsState.activeKind ?? (carousel.mode === 'carousel' ? 'carousel' : 'single');
  const format =
    kind === 'carousel'
      ? normalizeFormat(carousel.format)
      : normalizeFormat(useEditor.getState().doc.format);
  const now = Date.now();

  session.activeId = id;
  session.activeMeta = existingMeta ?? {
    id,
    title: draftsState.activeTitle || defaultDraftTitle(kind, new Date(now)),
    titleSource: 'user',
    kind,
    format,
    slideCount: kind === 'carousel' ? carousel.slides.length : 1,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    schemaVersion: DRAFT_SCHEMA_VERSION,
  };
  session.isNewDraft = false;
}

function syncEditorToCarouselIfNeeded(): void {
  if (isApplyingState()) return;
  const carousel = useCarousel.getState();
  if (carousel.mode !== 'carousel' || carousel.isExporting) return;
  const editor = useEditor.getState();
  const byId = carousel.activeSlideId
    ? carousel.slides.findIndex((slide) => slide.id === carousel.activeSlideId)
    : -1;
  const index = byId >= 0 ? byId : carousel.activeSlideIndex;
  const activeSlide = carousel.slides[index];
  if (!activeSlide) return;
  const loadedId = getEditorLoadedSlideId();
  if (loadedId && activeSlide.id !== loadedId) return;
  if (activeSlide.doc !== editor.doc || activeSlide.finish !== editor.finish) {
    carousel.updateActiveSlide(editor.doc, editor.finish);
  }
}

function currentKind(): DraftKind {
  return useCarousel.getState().mode === 'carousel' ? 'carousel' : 'single';
}

function normalizeFormat(format: PostFormat | undefined): PostFormat {
  return sanitizeFormat(format ?? '3:4');
}

function buildBody(id: string): DraftBody {
  syncEditorToCarouselIfNeeded();
  const carousel = useCarousel.getState();
  if (carousel.mode === 'carousel') {
    return {
      id,
      kind: 'carousel',
      slides: carousel.slides,
      activeSlideIndex: carousel.activeSlideIndex,
      format: carousel.format,
      ...(carousel.applyFinishToAll === false ? { applyFinishToAll: false } : { applyFinishToAll: true }),
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
      activeSlideId: slide.id,
      format,
      applyFinishToAll: true,
    });
    resetEditorFor(slide.doc, slide.finish);
    return;
  }

  const format = normalizeFormat(body.format);
  // Mesmo motivo do `setActiveSlide`: a cópia precisa existir no DOC, não só
  // como espelho (que não é clicável). Assim a página vizinha já abre
  // interativa, mesmo se o rascunho salvo ficou sem alguma cópia.
  const slides = reconcileAllCrossovers(body.slides, format);
  const safeIndex = Math.max(0, Math.min(body.activeSlideIndex, Math.max(0, slides.length - 1)));
  const active = slides[safeIndex] ?? slides[0];
  const applyFinishToAll = body.applyFinishToAll !== false;
  const syncedSlides =
    applyFinishToAll && active
      ? slides.map((sl) => ({
          ...sl,
          finish: {
            paper: { ...active.finish.paper },
            grain: { ...active.finish.grain },
            borderTexture: { ...active.finish.borderTexture },
          },
        }))
      : slides;
  const syncedActive = syncedSlides[safeIndex] ?? syncedSlides[0];
  useCarousel.setState({
    mode: 'carousel',
    slides: syncedSlides,
    activeSlideIndex: safeIndex,
    activeSlideId: syncedActive?.id ?? null,
    format,
    applyFinishToAll,
  });
  if (syncedActive) loadSlideIntoEditor(syncedActive);
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
  withApplyingState(() => {
    applyBodyToStores(reconciled.body);
  });
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
  if (!session.channel) session.channel = new BroadcastChannel(CHANNEL_NAME);
  return session.channel;
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
  if (session.releaseLockFn) {
    const release = session.releaseLockFn;
    session.releaseLockFn = null;
    release();
  }
  session.lockedDraftId = null;
}

async function acquireDraftLock(id: string): Promise<boolean> {
  if (session.lockedDraftId === id) return true;
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
        session.lockedDraftId = id;
        settle(true);
        await new Promise<void>((release) => {
          session.releaseLockFn = release;
        });
      })
      .catch(() => settle(false));
  });
}

// ------------------------------------------------------------------- saving

function cancelSaveTimer(): void {
  if (session.saveTimer) {
    clearTimeout(session.saveTimer);
    session.saveTimer = null;
  }
}

function cancelCoverRefresh(): void {
  if (session.coverTimer) {
    clearTimeout(session.coverTimer);
    session.coverTimer = null;
  }
}

function scheduleCoverRefresh(id: string): void {
  cancelCoverRefresh();
  session.coverTimer = setTimeout(() => {
    session.coverTimer = null;
    if (session.activeId !== id || session.isNewDraft || !session.coverDirty) return;
    if (useCarousel.getState().isExporting) return;
    if (useEditor.getState().editingId !== null) {
      scheduleCoverRefresh(id);
      return;
    }
    void captureAndSaveCover(id, true).then((saved) => {
      if (saved && session.activeId === id) {
        session.coverDirty = false;
        broadcastDraftsChanged();
      }
    });
  }, COVER_REFRESH_DEBOUNCE_MS);
}

function scheduleSave(delay = SAVE_DEBOUNCE_MS): void {
  cancelSaveTimer();
  session.saveTimer = setTimeout(() => {
    session.saveTimer = null;
    void flushDraft();
  }, delay);
}

export function markDraftDirty(): void {
  ensureActiveSessionRecovered();
  if (isApplyingState() || !session.activeId) return;
  if (useCarousel.getState().isExporting) return;
  session.dirty = true;
  session.coverDirty = true;
  session.changeRevision += 1;
  const store = useDraftsStore.getState();
  if (store.saveStatus !== 'saving') {
    store.setSaveState('dirty', null);
  }
  scheduleSave();
}

interface PendingCheckpoint {
  meta: DraftMeta;
  body: DraftBody;
  savedAt: number;
}

function getStorageSafe(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function writePendingCheckpointSync(meta: DraftMeta, body: DraftBody): void {
  const storage = getStorageSafe();
  if (!storage) return;
  try {
    const payload: PendingCheckpoint = { meta, body, savedAt: Date.now() };
    storage.setItem(PENDING_CHECKPOINT_KEY, JSON.stringify(payload));
  } catch {
    // Falha em localStorage (cota/modo privado) nunca bloqueia o save principal no IndexedDB.
  }
}

function clearPendingCheckpointSync(expectedDraftId?: string): void {
  const storage = getStorageSafe();
  if (!storage) return;
  try {
    if (!expectedDraftId) {
      storage.removeItem(PENDING_CHECKPOINT_KEY);
      return;
    }
    const raw = storage.getItem(PENDING_CHECKPOINT_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { meta?: { id?: unknown } } | null;
    if (parsed?.meta?.id === expectedDraftId) {
      storage.removeItem(PENDING_CHECKPOINT_KEY);
    }
  } catch {
    try {
      storage.removeItem(PENDING_CHECKPOINT_KEY);
    } catch {
      // Ignora erro ao limpar chave corrompida.
    }
  }
}

async function flushPendingCheckpointToDb(): Promise<void> {
  const storage = getStorageSafe();
  if (!storage) return;
  let raw: string | null = null;
  try {
    raw = storage.getItem(PENDING_CHECKPOINT_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearPendingCheckpointSync();
    return;
  }

  const candidate = parsed as { meta?: unknown; body?: unknown } | null;
  const meta = sanitizeDraftMeta(candidate?.meta);
  const body = sanitizeDraftBody(candidate?.body, meta?.format);
  if (!meta || !body || meta.id !== body.id) {
    clearPendingCheckpointSync();
    return;
  }

  try {
    const existing = await readDraftRecord(meta.id);
    if (!existing || meta.updatedAt >= existing.meta.updatedAt) {
      await saveDraftRecord(meta, body);
    }
    clearPendingCheckpointSync(meta.id);
  } catch {
    // Mantém o checkpoint pendente para tentar novamente na próxima abertura/boot.
  }
}

function snapshotOnPageExitSync(): void {
  ensureActiveSessionRecovered();
  if (!session.activeId || !session.activeMeta) return;
  if (useCarousel.getState().isExporting) return;

  flushTextEditing();
  syncEditorToCarouselIfNeeded();

  if (!session.dirty && !session.savingInFlight) return;

  const id = session.activeId;
  const body = buildBody(id);
  if (session.isNewDraft && !isBodyMeaningful(body)) return;

  const nextMeta = nextMetaForBody(session.activeMeta, body);
  writePendingCheckpointSync(nextMeta, body);

  if (session.savingInFlight && !session.dirty) {
    // Se uma transação IndexedDB já estava em voo quando o unload começou,
    // dispara também uma gravação síncrona imediata como defesa extra além do checkpoint.
    void saveDraftRecord(nextMeta, body).catch(() => undefined);
  }
}

async function persistIfDirty(): Promise<void> {
  ensureActiveSessionRecovered();
  if (!session.activeId || !session.activeMeta || !session.dirty) return;
  if (useCarousel.getState().isExporting) return;

  const id = session.activeId;
  const meta = session.activeMeta;
  const savedRevision = session.changeRevision;
  const body = buildBody(id);

  if (session.isNewDraft && !isBodyMeaningful(body)) {
    if (session.changeRevision <= savedRevision) {
      session.dirty = false;
      session.coverDirty = false;
    }
    return;
  }

  session.dirty = false;
  session.activeSaves += 1;
  session.savingInFlight = true;
  useDraftsStore.getState().setSaveState('saving', null);

  try {
    const nextMeta = nextMetaForBody(meta, body);
    writePendingCheckpointSync(nextMeta, body);
    await saveDraftRecord(nextMeta, body);
    if (session.activeId !== id) return;

    if (savedRevision >= session.latestSavedRevision) {
      session.latestSavedRevision = savedRevision;
      session.activeMeta = nextMeta;
      session.isNewDraft = false;
      useDraftsStore.getState().updateActiveMeta(nextMeta);
    }
    broadcastDraftsChanged();

    if (session.dirty || session.changeRevision > session.latestSavedRevision) {
      session.dirty = true;
      useDraftsStore.getState().setSaveState('dirty', null);
      scheduleSave(SAVE_DEBOUNCE_MS);
    } else {
      clearPendingCheckpointSync(id);
      useDraftsStore.getState().setSaveState('saved', null);
      if (session.coverDirty) {
        scheduleCoverRefresh(id);
      } else {
        void ensureCover(id);
      }
    }
  } catch (error) {
    session.dirty = true;
    const message = describeStorageError(error);
    useDraftsStore.getState().setSaveState('error', message);
    useDraftsStore.getState().setStorageWarning(message);
  } finally {
    session.activeSaves = Math.max(0, session.activeSaves - 1);
    session.savingInFlight = session.activeSaves > 0;
  }
}

/** Serializa os saves: um por vez, sempre com o snapshot mais recente. */
export function flushDraft(forceSyncOnExit = false): Promise<void> {
  ensureActiveSessionRecovered();
  if (!useCarousel.getState().isExporting) {
    flushTextEditing();
    syncEditorToCarouselIfNeeded();
  }
  cancelSaveTimer();
  if (!session.savingInFlight || (forceSyncOnExit && session.dirty)) {
    // Dispara persistIfDirty no mesmo tick para que beforeunload/pagehide
    // abram a transação IndexedDB antes de perder o contexto da página.
    const run = persistIfDirty();
    session.saveChain = session.saveChain.then(
      () => run,
      () => run,
    );
    return session.saveChain;
  }
  session.saveChain = session.saveChain.then(persistIfDirty, persistIfDirty);
  return session.saveChain;
}

/**
 * Saída da página: grava o checkpoint síncrono, persiste o doc no IndexedDB e
 * tenta atualizar/garantir a capa enquanto o canvas ainda está montado. Em
 * `beforeunload` o trabalho assíncrono pode ser abortado pelo navegador — por isso
 * o checkpoint síncrono garante recuperação no próximo boot e a home é segura SEM capa.
 */
async function flushSession(options: { fromBlur?: boolean } = {}): Promise<void> {
  try {
    snapshotOnPageExitSync();
    await flushDraft(!options.fromBlur);
    const id = session.activeId;
    if (!id || session.isNewDraft) return;
    const isEditingText = useEditor.getState().editingId !== null;
    if (options.fromBlur && isEditingText) return;
    if (session.coverDirty) {
      const captured = await captureAndSaveCover(id, true);
      if (captured && session.activeId === id) {
        session.coverDirty = false;
      }
    } else {
      await ensureCover(id);
    }
  } catch {
    // Eventos de saída/blur não propagam erro não tratado ao navegador.
  }
}

export function retrySave(): void {
  ensureActiveSessionRecovered();
  if (!session.activeId) return;
  session.dirty = true;
  session.changeRevision += 1;
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
    await flushPendingCheckpointToDb();

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
  if (session.activeId === id && useDraftsStore.getState().screen === 'editor') return true;

  const locked = await acquireDraftLock(id);
  if (!locked) {
    useEditor
      .getState()
      .showToast('error', 'Esse post já está aberto em outra aba. Feche a outra aba e tente de novo 😉');
    return false;
  }

  try {
    await flushPendingCheckpointToDb();
    const record = await readDraftRecord(id);
    if (!record) {
      releaseDraftLock();
      useEditor.getState().showToast('error', 'Não encontramos esse rascunho. Ele pode ter sido excluído.');
      return false;
    }

    const available = await getStoredImageIds();
    await loadUserImages(bodyImageIds(record.body));
    const reconciled = reconcileBodyImages(record.body, available);

    cancelSaveTimer();
    cancelCoverRefresh();

    const openedAt = Date.now();
    const openedMeta: DraftMeta = { ...record.meta, lastOpenedAt: openedAt };

    withApplyingState(() => {
      applyBodyToStores(reconciled.body);
    });

    session.activeId = id;
    session.activeMeta = openedMeta;
    session.isNewDraft = false;
    session.dirty = false;
    session.coverDirty = false;
    session.changeRevision = 0;
    session.latestSavedRevision = 0;
    session.activeSaves = 0;

    useDraftsStore.getState().beginActiveDraft(openedMeta);
    useDraftsStore.getState().setSaveState('saved', null);
    useDraftsStore.getState().setScreen('editor');

    const touchOpened = async (): Promise<void> => {
      if (session.activeId !== id || !session.activeMeta) return;
      if (session.dirty) return;
      try {
        const updated = await updateDraftMeta(id, { lastOpenedAt: openedAt });
        if (updated && session.activeId === id && session.activeMeta) {
          session.activeMeta = { ...session.activeMeta, lastOpenedAt: updated.lastOpenedAt };
          useDraftsStore.getState().updateActiveMeta(session.activeMeta);
        }
        broadcastDraftsChanged();
      } catch {
        // Atualização cosmética do card "Continuar": falha não impede a edição.
      }
    };
    session.saveChain = session.saveChain.then(touchOpened, touchOpened);

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
  cancelSaveTimer();
  cancelCoverRefresh();
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
    lastOpenedAt: now,
    schemaVersion: DRAFT_SCHEMA_VERSION,
  };

  withApplyingState(() => {
    if (kind === 'carousel') {
      const slide = defaultSlide(safeFormat);
      useCarousel.setState({
        mode: 'carousel',
        slides: [slide],
        activeSlideIndex: 0,
        activeSlideId: slide.id,
        format: safeFormat,
        applyFinishToAll: true,
      });
      loadSlideIntoEditor(slide);
    } else {
      const doc = { ...emptyDoc(), format: safeFormat };
      const finish = defaultFinish();
      const singleSlide = { id: newSlideId(), doc, finish };
      useCarousel.setState({
        mode: 'single',
        slides: [singleSlide],
        activeSlideIndex: 0,
        activeSlideId: singleSlide.id,
        format: safeFormat,
        applyFinishToAll: true,
      });
      resetEditorFor(doc, finish);
    }
  });

  session.activeId = id;
  session.activeMeta = meta;
  session.isNewDraft = true;
  session.dirty = false;
  session.coverDirty = false;
  session.changeRevision = 0;
  session.latestSavedRevision = 0;
  session.activeSaves = 0;

  useDraftsStore.getState().beginActiveDraft(meta);
  useDraftsStore.getState().setScreen('editor');
  requestPersistentStorage();
}

export async function closeDraftToHome(): Promise<void> {
  ensureActiveSessionRecovered();
  cancelCoverRefresh();

  if (!session.activeId) {
    useDraftsStore.getState().setScreen('home');
    return;
  }

  const id = session.activeId;

  // Se um save terminou bem, `isNewDraft` vira false. Quando um post recém-
  // criado ainda não tem conteúdo, ele é descartado (não aparece vazio na home).
  await flushDraft();

  if (session.isNewDraft) {
    const body = buildBody(id);
    if (isBodyMeaningful(body)) {
      useEditor
        .getState()
        .showToast('error', 'Não conseguimos salvar este post. Ele continua aberto para você tentar de novo.');
      return;
    }
    clearPendingCheckpointSync(id);
  }

  if (!session.isNewDraft) {
    if (!session.dirty && !session.savingInFlight) {
      clearPendingCheckpointSync(id);
    }
    try {
      const saved = await captureAndSaveCover(id, true);
      if (saved) session.coverDirty = false;
    } catch {
      // A capa é cosmética; o post salvo continua íntegro.
    }
  }

  releaseDraftLock();
  cancelSaveTimer();
  cancelCoverRefresh();
  session.activeId = null;
  session.activeMeta = null;
  session.isNewDraft = false;
  session.dirty = false;
  session.coverDirty = false;
  session.changeRevision = 0;
  session.latestSavedRevision = 0;
  session.activeSaves = 0;

  useDraftsStore.getState().clearActiveDraft();
  useDraftsStore.getState().setScreen('home');
  withApplyingState(() => {
    useCarousel.setState({ mode: null, activeSlideId: null });
  });

  await refreshDrafts({ silent: true });
  broadcastDraftsChanged();
}

// ------------------------------------------------------------------ actions

export async function renameActiveDraft(title: string): Promise<boolean> {
  ensureActiveSessionRecovered();
  if (!session.activeId || !session.activeMeta) return false;
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!clean || clean === session.activeMeta.title) return false;

  const id = session.activeId;
  const optimisticMeta: DraftMeta = {
    ...session.activeMeta,
    title: clean,
    titleSource: 'user',
    updatedAt: Date.now(),
  };

  session.activeMeta = optimisticMeta;
  session.isNewDraft = false;
  cancelSaveTimer();
  useDraftsStore.getState().updateActiveMeta(optimisticMeta);
  useDraftsStore.getState().setSaveState('saving', null);

  const task = async (): Promise<boolean> => {
    if (session.activeId !== id || !session.activeMeta) return false;
    const savedRevision = session.changeRevision;
    const body = buildBody(id);
    const nextMeta: DraftMeta = {
      ...nextMetaForBody(session.activeMeta, body),
      title: clean,
      titleSource: 'user',
    };
    session.dirty = false;
    session.activeSaves += 1;
    session.savingInFlight = true;
    try {
      writePendingCheckpointSync(nextMeta, body);
      await saveDraftRecord(nextMeta, body);
      if (session.activeId !== id) return false;
      if (savedRevision >= session.latestSavedRevision) {
        session.latestSavedRevision = savedRevision;
        session.activeMeta = nextMeta;
        useDraftsStore.getState().updateActiveMeta(nextMeta);
      }
      broadcastDraftsChanged();
      if (session.dirty || session.changeRevision > session.latestSavedRevision) {
        session.dirty = true;
        useDraftsStore.getState().setSaveState('dirty', null);
        scheduleSave(SAVE_DEBOUNCE_MS);
      } else {
        clearPendingCheckpointSync(id);
        useDraftsStore.getState().setSaveState('saved', null);
        if (session.coverDirty) scheduleCoverRefresh(id);
        else void ensureCover(id);
      }
      return true;
    } catch (error) {
      session.dirty = true;
      const message = describeStorageError(error);
      useDraftsStore.getState().setSaveState('error', message);
      useDraftsStore.getState().setStorageWarning(message);
      useEditor.getState().showToast('error', message);
      return false;
    } finally {
      session.activeSaves = Math.max(0, session.activeSaves - 1);
      session.savingInFlight = session.activeSaves > 0;
    }
  };

  const resultPromise = session.saveChain.then(task, task);
  session.saveChain = resultPromise.then(
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
    clearPendingCheckpointSync(meta.id);
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
    clearPendingCheckpointSync(meta.id);
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

  const { slides, format, activeSlideIndex, applyFinishToAll } = useCarousel.getState();
  const chosen = index === null ? null : extractSingleSlideData(slides, index, format);
  if (index !== null && !chosen) return;

  const snapshot = { slides, format, activeSlideIndex, applyFinishToAll };
  const doc = chosen
    ? { ...chosen.doc, format }
    : { ...emptyDoc(), format };
  const finish = chosen ? chosen.finish : defaultFinish();

  withApplyingState(() => {
    const slide = {
      id: newSlideId(),
      doc,
      finish,
    };
    useCarousel.setState({
      mode: 'single',
      slides: [slide],
      activeSlideIndex: 0,
      activeSlideId: slide.id,
      format,
      applyFinishToAll: true,
    });
    resetEditorFor(slide.doc, slide.finish);
  });

  useDraftsStore.getState().setActiveKind('single');
  markDraftDirty();
  void flushDraft();

  useEditor.getState().showToast('info', 'Carrossel convertido em post único. Os outros slides saíram deste rascunho.', {
    duration: 8000,
    actionLabel: 'Desfazer',
    onAction: () => {
      withApplyingState(() => {
        const active = snapshot.slides[snapshot.activeSlideIndex] ?? snapshot.slides[0];
        useCarousel.setState({
          mode: 'carousel',
          slides: snapshot.slides,
          activeSlideIndex: snapshot.activeSlideIndex,
          activeSlideId: active?.id ?? null,
          format: snapshot.format,
          applyFinishToAll: snapshot.applyFinishToAll ?? true,
        });
        if (active) loadSlideIntoEditor(active);
        useEditor.temporal.getState().clear();
      });
      useDraftsStore.getState().setActiveKind('carousel');
      markDraftDirty();
      void flushDraft();
    },
  });
}

// ------------------------------------------------------------- subscriptions

export function resetDraftSessionForTests(): void {
  cancelSaveTimer();
  cancelCoverRefresh();
  releaseDraftLock();
  if (session.disposeSubscribers) {
    session.disposeSubscribers();
    session.disposeSubscribers = null;
  }
  session.activeId = null;
  session.activeMeta = null;
  session.isNewDraft = false;
  session.dirty = false;
  session.coverDirty = false;
  session.changeRevision = 0;
  session.latestSavedRevision = 0;
  session.activeSaves = 0;
  session.savingInFlight = false;
  session.saveChain = Promise.resolve();
  session.installed = false;
  clearPendingCheckpointSync();
}

export function installDraftSession(): () => void {
  if (session.disposeSubscribers) {
    session.disposeSubscribers();
    session.disposeSubscribers = null;
  }
  session.installed = true;

  const unsubEditor = useEditor.subscribe((state, prev) => {
    if (useCarousel.getState().isExporting) return;
    if (state.doc !== prev.doc || state.finish !== prev.finish) markDraftDirty();
  });

  const unsubCarousel = useCarousel.subscribe((state, prev) => {
    if (state.isExporting) return;

    if (!isApplyingState()) {
      const slidesChanged =
        state.slides !== prev.slides ||
        state.format !== prev.format ||
        state.applyFinishToAll !== prev.applyFinishToAll;
      const indexChanged = state.mode === 'carousel' && state.activeSlideIndex !== prev.activeSlideIndex;

      if (slidesChanged || indexChanged) {
        markDraftDirty();

        const slideOrderChanged =
          slidesChanged &&
          state.mode === prev.mode &&
          (state.slides.length !== prev.slides.length ||
            state.slides.some((slide, i) => slide.id !== prev.slides[i]?.id));
        if (slideOrderChanged) {
          void flushDraft();
        }
      }
    }

    if (state.mode !== prev.mode && session.activeId) {
      const kind: DraftKind | null =
        state.mode === 'carousel' ? 'carousel' : state.mode === 'single' ? 'single' : null;
      useDraftsStore.getState().setActiveKind(kind);
    }
  });

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      void flushSession().catch(() => undefined);
    }
  };
  const handleExit = () => {
    void flushSession().catch(() => undefined);
  };
  const handleBlur = () => {
    void flushSession({ fromBlur: true }).catch(() => undefined);
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', handleExit);
    window.addEventListener('beforeunload', handleExit);
    window.addEventListener('blur', handleBlur);
  }

  const dispose = () => {
    unsubEditor();
    unsubCarousel();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', handleExit);
      window.removeEventListener('beforeunload', handleExit);
      window.removeEventListener('blur', handleBlur);
    }
    if (session.disposeSubscribers === dispose) {
      session.disposeSubscribers = null;
      session.installed = false;
    }
  };

  session.disposeSubscribers = dispose;
  return dispose;
}

if (typeof import.meta !== 'undefined' && import.meta.hot && session.installed) {
  installDraftSession();
}

export function activeDraftKind(): DraftKind {
  return currentKind();
}
