import { create } from 'zustand';
import type { DraftKind, DraftMeta } from '../lib/drafts/types';

export type AppScreen = 'boot' | 'home' | 'editor';
export type DraftListStatus = 'loading' | 'ready' | 'error';
export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface DraftsState {
  /** A home é sempre a primeira tela; o editor só existe com um rascunho ativo. */
  screen: AppScreen;
  drafts: DraftMeta[];
  listStatus: DraftListStatus;
  listError: string | null;
  storageWarning: string | null;

  activeDraftId: string | null;
  activeKind: DraftKind | null;
  activeTitle: string;
  saveStatus: SaveStatus;
  saveError: string | null;

  setScreen: (screen: AppScreen) => void;
  setDrafts: (drafts: DraftMeta[]) => void;
  setListState: (status: DraftListStatus, error: string | null) => void;
  setStorageWarning: (warning: string | null) => void;
  beginActiveDraft: (meta: DraftMeta) => void;
  updateActiveMeta: (meta: DraftMeta) => void;
  setActiveKind: (kind: DraftKind | null) => void;
  clearActiveDraft: () => void;
  setSaveState: (status: SaveStatus, error: string | null) => void;
}

export const useDraftsStore = create<DraftsState>()((set) => ({
  screen: 'boot',
  drafts: [],
  listStatus: 'loading',
  listError: null,
  storageWarning: null,

  activeDraftId: null,
  activeKind: null,
  activeTitle: '',
  saveStatus: 'idle',
  saveError: null,

  setScreen: (screen) => set({ screen }),
  setDrafts: (drafts) =>
    set({
      drafts: [...drafts].sort((a, b) => b.updatedAt - a.updatedAt),
      listStatus: 'ready',
      listError: null,
    }),
  setListState: (listStatus, listError) => set({ listStatus, listError }),
  setStorageWarning: (storageWarning) => set({ storageWarning }),
  beginActiveDraft: (meta) =>
    set({
      activeDraftId: meta.id,
      activeKind: meta.kind,
      activeTitle: meta.title,
      saveStatus: 'idle',
      saveError: null,
    }),
  updateActiveMeta: (meta) =>
    set({
      activeDraftId: meta.id,
      activeKind: meta.kind,
      activeTitle: meta.title,
    }),
  setActiveKind: (activeKind) => set({ activeKind }),
  clearActiveDraft: () =>
    set({
      activeDraftId: null,
      activeKind: null,
      activeTitle: '',
      saveStatus: 'idle',
      saveError: null,
    }),
  setSaveState: (saveStatus, saveError) => set({ saveStatus, saveError }),
}));

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__useDraftsStore = useDraftsStore;
}
