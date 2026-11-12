/**
 * Semântica de inserção do drag & drop da tira de slides.
 *
 * Reordenar é uma operação **estritamente posicional**: apenas a ordem dos
 * slides muda (AGENTS.md §2.13). O alvo e o lado do ponteiro definem onde a
 * página arrastada entra — não o oposto.
 */

export type DropPosition = 'before' | 'after';

/**
 * Índice final (0-based) do slide arrastado depois da remoção + inserção.
 * `null` quando a operação não mudaria nada (ou os índices são inválidos).
 */
export function resolveReorderIndex(
  from: number,
  target: number,
  position: DropPosition,
  count: number,
): number | null {
  if (!Number.isInteger(from) || !Number.isInteger(target)) return null;
  if (from < 0 || from >= count || target < 0 || target >= count) return null;

  // Posição de inserção no array ANTES de tirar o próprio slide.
  let insert = position === 'after' ? target + 1 : target;
  // Tirar o slide de `from` desloca um índice para trás quando ele vinha antes.
  if (from < insert) insert -= 1;
  if (insert === from) return null;
  return Math.max(0, Math.min(count - 1, insert));
}

/** Lado do alvo conforme o ponteiro: metade esquerda = antes, direita = depois. */
export function dropPositionFromPointer(
  pointerX: number,
  rect: { left: number; width: number },
): DropPosition {
  return pointerX > rect.left + rect.width / 2 ? 'after' : 'before';
}
