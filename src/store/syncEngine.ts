import { useCarousel } from './carouselStore';
import { useEditor } from './editorStore';

interface SyncEngineState {
  applyingStateDepth: number;
  installed: boolean;
  unsubscribeFn: (() => void) | null;
}

const SYNC_GLOBAL_KEY = '__cuscuzSyncEngineState';

function getSyncState(): SyncEngineState {
  const g = globalThis as unknown as Record<string, SyncEngineState | undefined>;
  if (!g[SYNC_GLOBAL_KEY]) {
    g[SYNC_GLOBAL_KEY] = {
      applyingStateDepth: 0,
      installed: false,
      unsubscribeFn: null,
    };
  }
  return g[SYNC_GLOBAL_KEY];
}

/** Indica se os stores estão sendo atualizados por carga/sincronização programática. */
export function isApplyingState(): boolean {
  return getSyncState().applyingStateDepth > 0;
}

/**
 * Executa `fn` com o guarda de reentrância ativo, evitando disparos em cascata
 * dos subscribers de carrossel e autosave durante cargas programáticas.
 */
export function withApplyingState<T>(fn: () => T): T {
  const state = getSyncState();
  state.applyingStateDepth += 1;
  try {
    return fn();
  } finally {
    state.applyingStateDepth = Math.max(0, state.applyingStateDepth - 1);
  }
}

/**
 * Instala (de forma idempotente e segura contra HMR) a ponte reativa entre
 * `useEditor` e `useCarousel` para gravar alterações do slide ativo de volta no carrossel.
 */
export function installEditorCarouselSync(): () => void {
  const state = getSyncState();
  if (state.unsubscribeFn) {
    state.unsubscribeFn();
    state.unsubscribeFn = null;
  }
  state.installed = true;
  state.unsubscribeFn = useEditor.subscribe((s, prev) => {
    if (isApplyingState()) return;
    const carousel = useCarousel.getState();
    if (carousel.mode !== 'carousel') return;
    if (s.doc === prev.doc && s.finish === prev.finish) return;
    carousel.updateActiveSlide(s.doc, s.finish);
  });

  return () => {
    const current = getSyncState();
    if (current.unsubscribeFn) {
      current.unsubscribeFn();
      current.unsubscribeFn = null;
    }
    current.installed = false;
  };
}

if (typeof import.meta !== 'undefined' && import.meta.hot && getSyncState().installed) {
  installEditorCarouselSync();
}

