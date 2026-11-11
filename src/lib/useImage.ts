import { useEffect, useState } from 'react';
import { createExternalStore } from './createExternalStore';

const cache = new Map<string, HTMLImageElement>();
const failed = new Set<string>();
const inFlight = new Map<string, Promise<HTMLImageElement | null>>();

/** Conjunto reativo de URLs de imagem atualmente sendo carregadas para o canvas. */
const loadingUrlsStore = createExternalStore<ReadonlySet<string>>(new Set());

/** Quantidade de fotos do usuário em processamento/importação (decode + WebP + IndexedDB). */
const importBusyStore = createExternalStore<number>(0);

export type CanvasActivityKind = 'background' | 'decoration' | 'image' | 'logo' | 'texture';

export interface CanvasActivity {
  id: number;
  kind: CanvasActivityKind;
  label: string;
  /** Asset que a folha está esperando; a atividade termina assim que ele estiver pronto. */
  targetSrc?: string | null;
}

const activityStore = createExternalStore<CanvasActivity | null>(null);
/** Trava de segurança: nenhuma atividade fica "presa" para sempre. */
const MAX_ACTIVITY_MS = 8000;
let activitySeq = 0;
let maxTimer: ReturnType<typeof setTimeout> | null = null;

function setUrlLoading(src: string, isLoading: boolean) {
  const cur = loadingUrlsStore.get();
  if (isLoading && cur.has(src)) return;
  if (!isLoading && !cur.has(src)) return;
  const next = new Set(cur);
  if (isLoading) next.add(src);
  else next.delete(src);
  loadingUrlsStore.set(next);
}

/** Encerra a atividade anunciada assim que o que ela esperava já está pronto. */
function checkClearActivity() {
  const cur = activityStore.get();
  if (!cur) return;
  if (cur.targetSrc) {
    const settled = cache.has(cur.targetSrc) || failed.has(cur.targetSrc);
    if (!settled) return;
  }
  if (cur.kind === 'image' && importBusyStore.get() > 0) return;
  clearActivity();
}

function clearActivity() {
  if (maxTimer) {
    clearTimeout(maxTimer);
    maxTimer = null;
  }
  activityStore.set(null);
}

/**
 * Anuncia que a folha está esperando algo (ex.: "Trocando o fundo... 🌽").
 * Isto **não** mostra nada sozinho: o selo só aparece se a espera passar de
 * `CANVAS_FEEDBACK_DELAY_MS` (ver `useDelayedFlag`) e some no instante em que
 * `targetSrc` (ou a importação da foto) termina. Se o asset já está em cache,
 * nem é anunciado.
 */
export function announceCanvasActivity(
  kind: CanvasActivityKind,
  label: string,
  targetSrc?: string | null,
): void {
  if (maxTimer) {
    clearTimeout(maxTimer);
    maxTimer = null;
  }
  if (targetSrc && cache.has(targetSrc)) {
    activityStore.set(null);
    return;
  }
  activityStore.set({ id: ++activitySeq, kind, label, targetSrc: targetSrc ?? null });
  maxTimer = setTimeout(() => {
    maxTimer = null;
    activityStore.set(null);
  }, MAX_ACTIVITY_MS);
}

export function beginImageImport(count = 1): void {
  importBusyStore.set((n) => n + Math.max(1, count));
}

export function endImageImport(count = 1): void {
  importBusyStore.set((n) => Math.max(0, n - Math.max(1, count)));
  checkClearActivity();
}
export function useLoadingImages(): ReadonlySet<string> {
  return loadingUrlsStore.use();
}

export function useImageImportBusy(): number {
  return importBusyStore.use();
}

export function useCanvasActivity(): CanvasActivity | null {
  return activityStore.use();
}

function fetchImage(src: string, trackCanvasLoading: boolean): Promise<HTMLImageElement | null> {
  const cached = cache.get(src);
  if (cached) return Promise.resolve(cached);

  if (trackCanvasLoading) {
    setUrlLoading(src, true);
  }

  const existing = inFlight.get(src);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cache.set(src, img);
      failed.delete(src);
      inFlight.delete(src);
      setUrlLoading(src, false);
      checkClearActivity();
      resolve(img);
    };
    img.onerror = () => {
      failed.add(src);
      inFlight.delete(src);
      setUrlLoading(src, false);
      checkClearActivity();
      resolve(null);
    };
    img.src = src;
  });

  inFlight.set(src, promise);
  return promise;
}

/**
 * Pré-carrega silenciosamente uma imagem para o cache do canvas (ex.: ao passar
 * o mouse sobre uma miniatura no painel), sem acionar o indicador de carregamento.
 */
export function preloadImage(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return fetchImage(src, false);
}

/**
 * Hook para carregar HTMLImageElement com cache em memória.
 * Seguro para uso em Konva Image e pré-carregamentos.
 */
export function useImage(
  src: string | null | undefined,
): [HTMLImageElement | null, 'loading' | 'loaded' | 'error'] {
  const [image, setImage] = useState<HTMLImageElement | null>(() =>
    src ? cache.get(src) ?? null : null,
  );
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(() => {
    if (!src) return 'loaded';
    if (cache.has(src)) return 'loaded';
    if (failed.has(src)) return 'error';
    return 'loading';
  });

  useEffect(() => {
    if (!src) {
      setImage(null);
      setStatus('loaded');
      return;
    }

    const cached = cache.get(src);
    if (cached) {
      setImage(cached);
      setStatus('loaded');
      return;
    }

    let active = true;
    setStatus('loading');

    void fetchImage(src, true).then((loaded) => {
      if (!active) return;
      if (loaded) {
        setImage(loaded);
        setStatus('loaded');
      } else {
        setImage(null);
        setStatus('error');
      }
    });

    return () => {
      active = false;
    };
  }, [src]);

  const effectiveStatus: 'loading' | 'loaded' | 'error' = !src
    ? 'loaded'
    : cache.has(src)
      ? 'loaded'
      : status;

  return [src ? cache.get(src) ?? image : null, effectiveStatus];
}
