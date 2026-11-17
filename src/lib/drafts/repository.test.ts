import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultFinish, emptyDoc } from '../sanitize';
import type { El } from '../../types';

const fakeStores = vi.hoisted(() => ({
  drafts: new Map<string, unknown>(),
  documents: new Map<string, unknown>(),
  covers: new Map<string, unknown>(),
  meta: new Map<string, unknown>(),
}));

vi.mock('./db', () => ({
  COVERS_STORE: 'covers',
  DOCUMENTS_STORE: 'documents',
  DRAFTS_STORE: 'drafts',
  META_STORE: 'meta',
  getAllFromStore: async <T,>(storeName: string): Promise<T[]> => {
    const store = fakeStores[storeName as keyof typeof fakeStores];
    return store ? (Array.from(store.values()) as T[]) : [];
  },
  getFromStore: async <T,>(storeName: string, key: IDBValidKey): Promise<T | undefined> => {
    const store = fakeStores[storeName as keyof typeof fakeStores];
    return store?.get(String(key)) as T | undefined;
  },
  putInStore: async <T,>(storeName: string, value: T): Promise<void> => {
    const store = fakeStores[storeName as keyof typeof fakeStores];
    const rec = value as { id?: string; key?: string };
    const id = rec.id ?? rec.key ?? '';
    store?.set(id, value);
  },
  requestAsPromise: async <T,>(req: { result: T }): Promise<T> => req.result,
  getOpenEditorDbSync: () => null,
  openEditorDb: async () => ({
    transaction: () => ({
      objectStore: (storeName: string) => {
        const store = fakeStores[storeName as keyof typeof fakeStores];
        return {
          put: (value: { id?: string; key?: string }) => {
            const id = value.id ?? value.key ?? '';
            store?.set(id, value);
          },
          delete: (key: IDBValidKey) => {
            store?.delete(String(key));
          },
          get: (key: IDBValidKey) => ({ result: store?.get(String(key)) }),
        };
      },
    }),
  }),
  transactionDone: async () => undefined,
}));

import { duplicateDraftRecord, getAllDraftRecords } from './repository';
import { DRAFT_SCHEMA_VERSION, type DraftMeta, type DraftRecord } from './types';

function makeMeta(id: string, kind: 'single' | 'carousel', slideCount: number): DraftMeta {
  const now = 1_700_000_000_000;
  return {
    id,
    title: `Rascunho ${id}`,
    titleSource: 'user',
    kind,
    format: '3:4',
    slideCount,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
    schemaVersion: DRAFT_SCHEMA_VERSION,
  };
}

describe('repository (drafts)', () => {
  beforeEach(() => {
    fakeStores.drafts.clear();
    fakeStores.documents.clear();
    fakeStores.covers.clear();
    fakeStores.meta.clear();
  });

  it('duplicateDraftRecord remapeia crossFrom para os novos slideIds e preserva cópia de crossover', async () => {
    const bleedingImg: El = {
      id: 'img-cross',
      kind: 'image',
      imageId: 'asset-img-1',
      name: 'foto-crossover',
      x: 1060,
      y: 700,
      width: 400,
      height: 400,
      rotation: 0,
      scale: 1,
      flipX: false,
      flipY: false,
      crossover: true,
    };
    const copyImg: El = {
      ...bleedingImg,
      x: 1060 - 1080,
      crossover: true,
      crossFrom: 'orig-slide-1',
    };

    const original: DraftRecord = {
      meta: makeMeta('draft-orig', 'carousel', 2),
      body: {
        id: 'draft-orig',
        kind: 'carousel',
        format: '3:4',
        activeSlideIndex: 0,
        schemaVersion: DRAFT_SCHEMA_VERSION,
        slides: [
          {
            id: 'orig-slide-1',
            doc: { ...emptyDoc(), elements: [bleedingImg] },
            finish: defaultFinish(),
          },
          {
            id: 'orig-slide-2',
            doc: { ...emptyDoc(), elements: [copyImg] },
            finish: defaultFinish(),
          },
        ],
      },
    };

    const duplicated = await duplicateDraftRecord(original, 'draft-copy');

    expect(duplicated.meta.id).toBe('draft-copy');
    expect(duplicated.body.kind).toBe('carousel');
    if (duplicated.body.kind !== 'carousel') return;

    const [newSlide1, newSlide2] = duplicated.body.slides;
    expect(newSlide1.id).not.toBe('orig-slide-1');
    expect(newSlide2.id).not.toBe('orig-slide-2');
    expect(newSlide2.doc.elements).toHaveLength(1);
    expect(newSlide2.doc.elements[0].id).toBe('img-cross');
    expect(newSlide2.doc.elements[0].crossFrom).toBe(newSlide1.id);
    expect(fakeStores.drafts.has('draft-copy')).toBe(true);
    expect(fakeStores.documents.has('draft-copy')).toBe(true);
  });

  it('getAllDraftRecords limpa órfãos unilaterais de meta e body sem falhar', async () => {
    const validMeta = makeMeta('valid-1', 'single', 1);
    fakeStores.drafts.set('valid-1', validMeta);
    fakeStores.documents.set('valid-1', {
      id: 'valid-1',
      kind: 'single',
      doc: emptyDoc(),
      finish: defaultFinish(),
      schemaVersion: DRAFT_SCHEMA_VERSION,
    });

    fakeStores.drafts.set('orphan-meta', makeMeta('orphan-meta', 'single', 1));
    fakeStores.covers.set('orphan-meta', { id: 'orphan-meta', blob: new Blob(), updatedAt: 1 });

    fakeStores.documents.set('orphan-body', {
      id: 'orphan-body',
      kind: 'single',
      doc: emptyDoc(),
      finish: defaultFinish(),
      schemaVersion: DRAFT_SCHEMA_VERSION,
    });

    const records = await getAllDraftRecords();

    expect(records.map((r) => r.meta.id)).toEqual(['valid-1']);
    expect(fakeStores.drafts.has('orphan-meta')).toBe(false);
    expect(fakeStores.covers.has('orphan-meta')).toBe(false);
    expect(fakeStores.documents.has('orphan-body')).toBe(false);
    expect(fakeStores.drafts.has('valid-1')).toBe(true);
    expect(fakeStores.documents.has('valid-1')).toBe(true);
  });
});
