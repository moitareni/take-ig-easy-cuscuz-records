import { useEffect, useState } from 'react';

/**
 * `true` quando as fontes da marca terminaram de carregar.
 *
 * A medição do texto usa a engine do canvas: antes das fontes carregarem, as
 * métricas são as do fallback. Este hook força um novo render (e uma nova
 * medição) quando `document.fonts.ready` resolve, para a caixa de destaque não
 * ficar com dimensões de outra fonte.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(
    () => typeof document === 'undefined' || !('fonts' in document),
  );

  useEffect(() => {
    if (ready) return;
    let alive = true;
    void document.fonts.ready.then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [ready]);

  return ready;
}
