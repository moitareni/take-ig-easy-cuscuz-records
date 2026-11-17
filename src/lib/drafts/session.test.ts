import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultFinish, emptyDoc } from '../sanitize';

interface FakeStores {
  images: Map<string, unknown>;
  drafts: Map<string, unknown>;
  documents: Map<string, unknown>;
  covers: Map<string, unknown>;
  meta: Map<string, unknown>;
  syncPutCount: number;
  gateNextTxDone: (() => Promise<void>) | null;
  discardWrites: boolean;
}

const fakeDbState = vi.hoisted((): FakeStores => ({
  images: new Map(),
  drafts: new Map(),
  documents: new Map(),
  covers: new Map(),
  meta: new Map(),
  syncPutCount: 0,
  gateNextTxDone: null,
  discardWrites: false,
}));

function getStoreMap(name: string): Map<string, unknown> {
  const map = fakeDbState[name as 'images' | 'drafts' | 'documents' | 'covers' | 'meta'];
  if (!map) throw new Error(`Store desconhecido: ${name}`);
  return map;
}

const fakeIdb = vi.hoisted(() => {
  const createTx = (_storeNames?: unknown, mode: IDBTransactionMode = 'readonly') => ({
    _mode: mode,
    objectStore: (storeName: string) => {
      const store = getStoreMap(storeName);
      return {
        put: (value: { id?: string; key?: string }) => {
          const id = value.id ?? value.key ?? '';
          if (!fakeDbState.discardWrites) {
            store.set(id, value);
          }
          fakeDbState.syncPutCount += 1;
        },
        delete: (key: IDBValidKey) => {
          if (!fakeDbState.discardWrites) {
            store.delete(String(key));
          }
        },
        get: (key: IDBValidKey) => ({ result: store.get(String(key)) }),
        getAll: () => ({ result: Array.from(store.values()) }),
        getAllKeys: () => ({ result: Array.from(store.keys()) }),
      };
    },
  });
  return { createTx };
});

vi.mock('./db', async () => {
  const actual = await vi.importActual<typeof import('./db')>('./db');
  return {
    ...actual,
    getOpenEditorDbSync: () => ({ transaction: fakeIdb.createTx } as unknown as IDBDatabase),
    openEditorDb: async () => ({ transaction: fakeIdb.createTx } as unknown as IDBDatabase),
    getAllFromStore: async <T,>(storeName: string): Promise<T[]> => {
      return Array.from(getStoreMap(storeName).values()) as T[];
    },
    getFromStore: async <T,>(storeName: string, key: IDBValidKey): Promise<T | undefined> => {
      return getStoreMap(storeName).get(String(key)) as T | undefined;
    },
    putInStore: async <T,>(storeName: string, value: T): Promise<void> => {
      const rec = value as { id?: string; key?: string };
      const id = rec.id ?? rec.key ?? '';
      getStoreMap(storeName).set(id, value);
    },
    deleteFromStore: async (storeName: string, key: IDBValidKey): Promise<void> => {
      getStoreMap(storeName).delete(String(key));
    },
    requestAsPromise: async <T,>(req: { result: T }): Promise<T> => req.result,
    transactionDone: async (tx?: { _mode?: IDBTransactionMode }) => {
      if (tx?._mode === 'readwrite') {
        if (fakeDbState.gateNextTxDone) {
          const gate = fakeDbState.gateNextTxDone;
          fakeDbState.gateNextTxDone = null;
          await gate();
        }
        if (fakeDbState.discardWrites) {
          throw new Error('TransactionInactiveError');
        }
      }
    },
  };
});

import { useCarousel } from '../../store/carouselStore';
import { useDraftsStore } from '../../store/draftsStore';
import { useEditor } from '../../store/editorStore';
import { installEditorCarouselSync } from '../../store/syncEngine';
import { setCoverCaptureProvider } from './cover';
import {
  duplicateDraftRecord,
  getDraftCover,
  putDraftCover,
  readDraftRecord,
  saveDraftRecord,
} from './repository';
import {
  bootDrafts,
  closeDraftToHome,
  flushDraft,
  installDraftSession,
  openDraft,
  resetDraftSessionForTests,
} from './session';
import { DRAFT_SCHEMA_VERSION, type DraftRecord } from './types';

function readBlobText(blob: Blob | null): Promise<string> {
  if (!blob) return Promise.resolve('');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('erro-leitura-blob'));
    reader.readAsText(blob);
  });
}

function makeOriginalCarousel(id: string): DraftRecord {
  const now = 1_700_000_000_000;
  return {
    meta: {
      id,
      title: 'Carrossel Original',
      titleSource: 'user',
      kind: 'carousel',
      format: '3:4',
      slideCount: 1,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: null,
      schemaVersion: DRAFT_SCHEMA_VERSION,
    },
    body: {
      id,
      kind: 'carousel',
      format: '3:4',
      activeSlideIndex: 0,
      schemaVersion: DRAFT_SCHEMA_VERSION,
      slides: [
        {
          id: `slide-${id}-0`,
          doc: { ...emptyDoc(), backgroundId: 'pronto-1' },
          finish: defaultFinish(),
        },
      ],
    },
  };
}

describe('draft session reliability', () => {
  let disposeSync: (() => void) | null = null;
  let disposeSession: (() => void) | null = null;

  beforeEach(() => {
    fakeDbState.images.clear();
    fakeDbState.drafts.clear();
    fakeDbState.documents.clear();
    fakeDbState.covers.clear();
    fakeDbState.meta.set('cuscuz-drafts:legacy-migrated-v1', {
      key: 'cuscuz-drafts:legacy-migrated-v1',
      value: true,
      updatedAt: 1,
    });
    fakeDbState.syncPutCount = 0;
    fakeDbState.gateNextTxDone = null;
    fakeDbState.discardWrites = false;
    window.localStorage.clear();

    setCoverCaptureProvider(null);
    resetDraftSessionForTests();
    useCarousel.getState().resetCarousel();
    useDraftsStore.getState().clearActiveDraft();
    useDraftsStore.getState().setScreen('home');

    disposeSync = installEditorCarouselSync();
    disposeSession = installDraftSession();
  });

  afterEach(() => {
    setCoverCaptureProvider(null);
    resetDraftSessionForTests();
    disposeSession?.();
    disposeSync?.();
  });

  it('persiste no mesmo tick ao disparar beforeunload após editar um carrossel duplicado e restaura no reload', async () => {
    const orig = makeOriginalCarousel('orig-1');
    await saveDraftRecord(orig.meta, orig.body);
    await putDraftCover('orig-1', new Blob(['orig-cover'], { type: 'image/webp' }));

    const dup = await duplicateDraftRecord(orig, 'copy-1');
    expect(await openDraft(dup.meta.id)).toBe(true);
    await flushDraft();

    // Modifica slide 1 e adiciona slide 2 editando título e fundo
    useEditor.getState().setBackground('pronto-2');
    useEditor.getState().addText('title');
    const addedId = useEditor.getState().selectedId;
    expect(addedId).toBeTruthy();
    if (addedId) useEditor.getState().updateElement(addedId, { text: 'NOVO TÍTULO' });
    useCarousel.getState().addSlide();
    useEditor.getState().setBackground('pronto-3');

    // Captura sincronicidade: sem esperar o debounce, zera contador e dispara beforeunload
    fakeDbState.syncPutCount = 0;
    window.dispatchEvent(new Event('beforeunload'));
    // A transação IndexedDB foi enfileirada no MESMO tick (put síncrono de meta + body >= 2)
    expect(fakeDbState.syncPutCount).toBeGreaterThanOrEqual(2);

    await flushDraft();

    // Simula reload total da aplicação: limpa stores em memória e faz boot + reabertura
    resetDraftSessionForTests();
    useCarousel.getState().resetCarousel();
    useDraftsStore.getState().clearActiveDraft();
    useDraftsStore.getState().setScreen('boot');

    await bootDrafts();
    const metas = useDraftsStore.getState().drafts;
    const copyMeta = metas.find((m) => m.id === 'copy-1');
    expect(copyMeta?.slideCount).toBe(2);
    expect(copyMeta?.lastOpenedAt).not.toBeNull();

    expect(await openDraft('copy-1')).toBe(true);
    const loadedCarousel = useCarousel.getState();
    expect(loadedCarousel.slides).toHaveLength(2);
    expect(loadedCarousel.slides[0].doc.backgroundId).toBe('pronto-2');
    expect(
      loadedCarousel.slides[0].doc.elements.some(
        (e) => e.kind === 'text' && e.text === 'NOVO TÍTULO',
      ),
    ).toBe(true);
    expect(loadedCarousel.slides[1].doc.backgroundId).toBe('pronto-3');

    // Original permanece intacto
    const origCheck = await readDraftRecord('orig-1');
    expect(origCheck?.body.kind).toBe('carousel');
    if (origCheck?.body.kind === 'carousel') {
      expect(origCheck.body.slides).toHaveLength(1);
      expect(origCheck.body.slides[0].doc.backgroundId).toBe('pronto-1');
    }
  });

  it('nunca marca saveStatus como saved se houver nova edição durante saveDraftRecord em andamento', async () => {
    const orig = makeOriginalCarousel('orig-race');
    await saveDraftRecord(orig.meta, orig.body);
    await openDraft('orig-race');
    await flushDraft();

    let releaseFirstSave!: () => void;
    const firstSaveGate = new Promise<void>((resolve) => {
      releaseFirstSave = resolve;
    });
    fakeDbState.gateNextTxDone = () => firstSaveGate;

    useEditor.getState().setBackground('pronto-2');
    const firstFlush = flushDraft();
    expect(useDraftsStore.getState().saveStatus).toBe('saving');

    // Nova edição acontece ENQUANTO o primeiro save está em voo
    useEditor.getState().setBackground('pronto-3');
    expect(fakeDbState.syncPutCount).toBeGreaterThan(0);

    releaseFirstSave();
    await firstFlush;

    // Como houve edição concorrente, não pode exibir 'saved' antes de persistir pronto-3
    expect(useDraftsStore.getState().saveStatus).toBe('dirty');

    await flushDraft();
    expect(useDraftsStore.getState().saveStatus).toBe('saved');

    const stored = await readDraftRecord('orig-race');
    expect(stored?.body.kind).toBe('carousel');
    if (stored?.body.kind === 'carousel') {
      expect(stored.body.slides[0].doc.backgroundId).toBe('pronto-3');
    }
  });

  it('atualiza a capa de um rascunho duplicado após edição sem depender do botão Voltar', async () => {
    const orig = makeOriginalCarousel('orig-cover');
    await saveDraftRecord(orig.meta, orig.body);
    const oldCover = new Blob(['capa-antiga'], { type: 'image/webp' });
    await putDraftCover('orig-cover', oldCover);

    const dup = await duplicateDraftRecord(orig, 'copy-cover');
    const copiedInitial = await getDraftCover('copy-cover');
    expect(await readBlobText(copiedInitial)).toBe('capa-antiga');

    setCoverCaptureProvider(async () => new Blob(['capa-nova-editada'], { type: 'image/webp' }));
    await openDraft(dup.meta.id);
    await flushDraft();

    useEditor.getState().setBackground('puro-1');
    window.dispatchEvent(new Event('beforeunload'));
    // Aguarda a cadeia de flush + captura de capa assíncrona finalizar
    await flushDraft();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const updatedCover = await getDraftCover('copy-cover');
    expect(await readBlobText(updatedCover)).toBe('capa-nova-editada');
    const origCoverAfter = await getDraftCover('orig-cover');
    expect(await readBlobText(origCoverAfter)).toBe('capa-antiga');

    await closeDraftToHome();
  });

  it('recupera sessão ativa se o estado interno do módulo perder activeId enquanto a UI permanece no editor', async () => {
    const orig = makeOriginalCarousel('orig-hmr');
    await saveDraftRecord(orig.meta, orig.body);
    await openDraft('orig-hmr');
    await flushDraft();

    // Simula perda de variável de módulo (sem limpar useDraftsStore / useCarousel)
    const g = globalThis as unknown as {
      __cuscuzDraftSession?: { activeId: string | null; activeMeta: unknown };
    };
    if (g.__cuscuzDraftSession) {
      g.__cuscuzDraftSession.activeId = null;
      g.__cuscuzDraftSession.activeMeta = null;
    }

    useEditor.getState().setBackground('puro-1');
    await flushDraft();

    const stored = await readDraftRecord('orig-hmr');
    expect(stored?.body.kind).toBe('carousel');
    if (stored?.body.kind === 'carousel') {
      expect(stored.body.slides[0].doc.backgroundId).toBe('puro-1');
    }
  });

  it('recupera via checkpoint síncrono quando reload ocorre com save IndexedDB em voo que é abortado', async () => {
    const orig = makeOriginalCarousel('orig-aborted');
    await saveDraftRecord(orig.meta, orig.body);
    const dup = await duplicateDraftRecord(orig, 'copy-aborted');
    expect(await openDraft(dup.meta.id)).toBe(true);
    await flushDraft();

    let rejectAbortedTx!: (reason?: unknown) => void;
    const abortedGate = new Promise<void>((_, reject) => {
      rejectAbortedTx = reject;
    });
    fakeDbState.gateNextTxDone = () => abortedGate;
    fakeDbState.discardWrites = true;

    useEditor.getState().setBackground('pronto-3');
    useEditor.getState().addText('title');
    const addedId = useEditor.getState().selectedId;
    if (addedId) useEditor.getState().updateElement(addedId, { text: 'SALVO VIA CHECKPOINT' });

    // Inicia flush: dirty vira false e savingInFlight vira true, mas a tx IDB trava e será abortada
    const pendingSave = flushDraft();

    // Dispara beforeunload enquanto savingInFlight === true e dirty === false;
    // qualquer tentativa de write no IDB da aba que está morrendo não comita no disco.
    window.dispatchEvent(new Event('beforeunload'));

    const rawCheckpoint = window.localStorage.getItem('cuscuz-insta-kit:pending-checkpoint');
    expect(rawCheckpoint).toBeTruthy();
    expect(rawCheckpoint).toContain('pronto-3');
    expect(rawCheckpoint).toContain('SALVO VIA CHECKPOINT');

    // Simula a transação IndexedDB sendo abortada no teardown antes de comitar
    rejectAbortedTx(new Error('TransactionInactiveError'));
    await pendingSave;
    await flushDraft();

    expect(window.localStorage.getItem('cuscuz-insta-kit:pending-checkpoint')).toBeTruthy();

    const beforeBootRecord = await readDraftRecord('copy-aborted');
    expect(beforeBootRecord?.body.kind).toBe('carousel');
    if (beforeBootRecord?.body.kind === 'carousel') {
      expect(beforeBootRecord.body.slides[0].doc.backgroundId).toBe('pronto-1');
      expect(beforeBootRecord.body.slides[0].doc.elements).toHaveLength(0);
    }

    // Nova aba após reload: IndexedDB volta a aceitar writes e bootDrafts reconcilia o checkpoint
    fakeDbState.discardWrites = false;
    const persistedCheckpoint = window.localStorage.getItem('cuscuz-insta-kit:pending-checkpoint');
    resetDraftSessionForTests();
    if (persistedCheckpoint) {
      window.localStorage.setItem('cuscuz-insta-kit:pending-checkpoint', persistedCheckpoint);
    }
    useCarousel.getState().resetCarousel();
    useDraftsStore.getState().clearActiveDraft();
    useDraftsStore.getState().setScreen('boot');

    await bootDrafts();

    expect(window.localStorage.getItem('cuscuz-insta-kit:pending-checkpoint')).toBeNull();
    expect(await openDraft('copy-aborted')).toBe(true);
    const recovered = useCarousel.getState();
    expect(recovered.slides[0].doc.backgroundId).toBe('pronto-3');
    expect(
      recovered.slides[0].doc.elements.some(
        (e) => e.kind === 'text' && e.text === 'SALVO VIA CHECKPOINT',
      ),
    ).toBe(true);
  });

  it('Bug #01: Novo slide vazio no último slide de rascunho duplicado cria Slide 8 limpo sem duplicar nem perder elementos do Slide 7', async () => {
    const finishWithPaper = () => ({
      ...defaultFinish(),
      paper: { enabled: true, opacity: 50 },
    });

    const slides = Array.from({ length: 7 }, (_, idx) => ({
      id: `orig-slide-${idx + 1}`,
      doc:
        idx === 6
          ? {
              ...emptyDoc(),
              backgroundId: 'pronto-3',
              elements: [
                {
                  id: 's7-decor-right',
                  kind: 'decoration' as const,
                  assetId: 'flores',
                  x: 920,
                  y: 420,
                  rotation: 0,
                  scale: 1,
                  flipX: false,
                  flipY: false,
                },
                {
                  id: 's7-text-right',
                  kind: 'text' as const,
                  style: 'title' as const,
                  text: 'TEXTO PAGINA 7',
                  x: 820,
                  y: 720,
                  rotation: 0,
                  scale: 1,
                  fontSize: 120,
                  lineHeight: 0.95,
                  letterSpacing: 0,
                  align: 'center' as const,
                  uppercase: true,
                  color: 'preto' as const,
                  brandEffect: false,
                  border: 'none' as const,
                },
                {
                  id: 's7-residual-crossover',
                  kind: 'decoration' as const,
                  assetId: 'ondas-1',
                  x: 1020,
                  y: 960,
                  rotation: 0,
                  scale: 1,
                  flipX: false,
                  flipY: false,
                  crossover: true,
                },
              ],
            }
          : emptyDoc(),
      finish: finishWithPaper(),
    }));

    const original: DraftRecord = {
      meta: {
        id: 'carousel-7-orig',
        title: 'Carrossel 7 páginas',
        titleSource: 'user',
        kind: 'carousel',
        format: '3:4',
        slideCount: 7,
        createdAt: 1000,
        updatedAt: 1000,
        lastOpenedAt: 1000,
        schemaVersion: DRAFT_SCHEMA_VERSION,
      },
      body: {
        id: 'carousel-7-orig',
        kind: 'carousel',
        slides,
        activeSlideIndex: 0,
        format: '3:4',
        applyFinishToAll: true,
        schemaVersion: DRAFT_SCHEMA_VERSION,
      },
    };

    await saveDraftRecord(original.meta, original.body);
    const duplicated = await duplicateDraftRecord(original, 'carousel-7-copy');

    const uninstallSync = installEditorCarouselSync();
    const uninstallSession = installDraftSession();
    try {
      expect(await openDraft(duplicated.meta.id)).toBe(true);

      useCarousel.getState().setActiveSlide(6);
      expect(useCarousel.getState().activeSlideIndex).toBe(6);

      useCarousel.getState().addSlide();

      const carousel = useCarousel.getState();
      const editor = useEditor.getState();

      expect(carousel.slides).toHaveLength(8);
      expect(carousel.activeSlideIndex).toBe(7);
      expect(carousel.activeSlideId).toBe(carousel.slides[7].id);

      // Slide 8 deve nascer vazio e carregado no editor, preservando apenas a textura padrão do projeto
      expect(carousel.slides[7].doc.elements).toEqual([]);
      expect(carousel.slides[7].doc.backgroundId).toBeNull();
      expect(carousel.slides[7].finish.paper.enabled).toBe(true);

      expect(editor.doc.elements).toEqual([]);
      expect(editor.doc.backgroundId).toBeNull();
      expect(editor.finish.paper.enabled).toBe(true);

      // Slide 7 deve permanecer 100% íntegro
      expect(carousel.slides[6].doc.backgroundId).toBe('pronto-3');
      expect(carousel.slides[6].doc.elements.map((el) => el.id)).toEqual([
        's7-decor-right',
        's7-text-right',
        's7-residual-crossover',
      ]);
      expect(carousel.slides[6].doc.elements[2].crossover).toBeFalsy();

      await flushDraft();
      const persisted = await readDraftRecord(duplicated.meta.id);
      expect(persisted?.body.kind).toBe('carousel');
      if (persisted?.body.kind === 'carousel') {
        expect(persisted.body.slides).toHaveLength(8);
        expect(persisted.body.activeSlideIndex).toBe(7);
        expect(persisted.body.slides[7].doc.elements).toEqual([]);
        expect(persisted.body.slides[7].doc.backgroundId).toBeNull();
        expect(persisted.body.slides[7].finish.paper.enabled).toBe(true);
        expect(persisted.body.slides[6].doc.backgroundId).toBe('pronto-3');
        expect(persisted.body.slides[6].doc.elements).toHaveLength(3);
      }
    } finally {
      uninstallSession();
      uninstallSync();
    }
  });
});
