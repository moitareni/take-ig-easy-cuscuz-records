import type { El, SlideData } from '../types';

/**
 * Integridade de identidade dos elementos entre slides.
 *
 * Elementos possuem `id` único **por slide**. A exceção é o crossover, que
 * materializa de propósito a mesma `id` na página vizinha com `crossover:
 * true`. Rascunhos antigos criados com "Duplicar slide" clonavam os elementos
 * mantendo os ids, e o motor de crossover passava a confundir os dois slides
 * (removendo/sobrescrevendo elementos ao ativar ou reordenar páginas).
 *
 * Esta função cicatriza esse estado: ids repetidos são renomeados, exceto
 * quando o par é realmente um crossover (alguma cópia marcada com
 * `crossover: true`).
 */

let seq = 0;

function newElementId(): string {
  const cryptoApi = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `el-${cryptoApi.randomUUID()}`;
  }
  seq += 1;
  return `el-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}${seq}`;
}

export function dedupeSlideElementIds(slides: SlideData[]): SlideData[] {
  if (slides.length < 2) return slides;

  const seen = new Map<string, boolean>(); // id -> é crossover?
  let changed = false;

  const next = slides.map((slide) => {
    let elementsChanged = false;
    const elements = slide.doc.elements.map((el: El): El => {
      const previousCrossover = seen.get(el.id);

      if (previousCrossover === undefined) {
        seen.set(el.id, el.crossover === true);
        return el;
      }

      // Id repetido: só é o mesmo elemento se for um crossover legítimo.
      if (el.crossover === true || previousCrossover) {
        seen.set(el.id, true);
        return el;
      }

      elementsChanged = true;
      return { ...el, id: newElementId() };
    });

    if (!elementsChanged) return slide;
    changed = true;
    return {
      ...slide,
      doc: { ...slide.doc, elements },
    };
  });

  return changed ? next : slides;
}
