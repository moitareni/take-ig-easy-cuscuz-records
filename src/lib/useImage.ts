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
  targetSrc?: string | null;
  minUntil: number;
}

const activityStore = createExternalStore<CanvasActivity | null>(null);
const MIN_ACTIVITY_MS = 280;
const MAX_ACTIVITY_MS = 8000;
let activitySeq = 0;
let minTimer: ReturnType<typeof setTimeout> | null = null;
let maxTimer: ReturnType<typeof setTimeout> | null = null;

function setUrlLoading(src: string, isLoading: boolean) {
  const cur = loadingUrlsStore.get();
  if (isLoading && cur.has(src)) return;
  if (!isLoading && !cur.has(src)) return;
  const next = new Set(cur);
  if (isLoading) next.add(src);
  else next.delete(src);
  loadingUrlsStore.set(next);
  checkClearActivity();
}

function checkClearActivity() {
  const cur = activityStore.get();
  if (!cur) return;
  if (Date.now() < cur.minUntil) return;
  if (cur.targetSrc && loadingUrlsStore.get().has(cur.targetSrc)) return;
  if (cur.kind === 'image' && importBusyStore.get() > 0) return;
  clearActivityTimers();
  activityStore.set(null);
}

function clearActivityTimers() {
  if (minTimer) {
    clearTimeout(minTimer);
    minTimer = null;
  }
  if (maxTimer) {
    clearTimeout(maxTimer);
    maxTimer = null;
  }
}

/**
 * Dispara o selo de feedback visual na folha (ex.: "Trocando o fundo... 🌽",
 * "Colando Esqueleto solar... ✨"). Permanece visível pelo menos por
 * `MIN_ACTIVITY_MS` e enquanto `targetSrc` (ou importação de foto) estiver em andamento.
 */
export function announceCanvasActivity(
  kind: CanvasActivityKind,
  label: string,
  targetSrc?: string | null,
): void {
  clearActivityTimers();
  const now = Date.now();
  const next: CanvasActivity = {
    id: ++activitySeq,
    kind,
    label,
    targetSrc: targetSrc ?? null,
    minUntil: now + MIN_ACTIVITY_MS,
  };
  activityStore.set(next);
  minTimer = setTimeout(() => {
    minTimer = null;
    checkClearActivity();
  }, MIN_ACTIVITY_MS + 10);
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
      resolve(img);
    };
    img.onerror = () => {
      failed.add(src);
      inFlight.delete(src);
      setUrlLoading(src, false);
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
