import { useEffect, useState } from 'react';

/** Só mostra o selo de carregamento se a espera passar disso (ms). */
export const CANVAS_FEEDBACK_DELAY_MS = 200;

/**
 * Retorna `true` somente depois que `active` ficou `true` de forma contínua por
 * `delay` ms. Volta a `false` imediatamente quando `active` cai — esperas
 * curtas nunca piscam um loading.
 */
export function useDelayedFlag(active: boolean, delay = CANVAS_FEEDBACK_DELAY_MS): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [active, delay]);
  return active && shown;
}
