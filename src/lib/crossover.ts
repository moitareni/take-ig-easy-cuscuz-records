import { getDecoration, getLogo } from '../assets';
import { BORDER_PAD, getPostDimensions, type PostFormat } from '../brand/brand';
import type { Doc, El, FinishState, SlideData } from '../types';

/** Largura (px no espaço do post) da Zona de Sangria lateral. */
export const CROSSOVER_ZONE = 80;

/** Tolerância (px) para reconhecer um par dono/cópia deslocado em ±postW. */
const PAIR_TOLERANCE = 1.5;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Posse das cópias de crossover.
 *
 * Quem vaza de uma página é **dono** da arte e continua morando no próprio
 * slide (`crossover: true`, sem `crossFrom`). O que aparece na página vizinha
 * é uma **cópia**, marcada com `crossFrom: <id do slide dono>`.
 *
 * Sem posse explícita, cópia e dono eram indistinguíveis (mesmo `id`, mesma
 * flag). Depois de reordenar páginas, a cópia órfã passava a se comportar como
 * dona: colonizava o vizinho novo e apagava o elemento real da antiga vizinha
 * (relatório do drag & drop de slides, 12/11/2026). Agora cópia nunca é fonte
 * de sangria: só a página dona cria, atualiza e remove a própria cópia.
 */
export function isCrossoverCopy(el: El): boolean {
  return typeof el.crossFrom === 'string' && el.crossFrom.length > 0;
}

/**
 * Forma de uma cópia anterior a `crossFrom`: marcada e com o centro fora da
 * folha. Sozinho, isto **não** identifica uma cópia — o próprio DONO fica
 * assim quando é empurrado para fora da própria página, que é justamente o
 * caso "elemento entre duas páginas". Quem classifica ao vivo é `isLegacyCopy`.
 */
function isMarkedOutsideSheet(el: El, postW: number): boolean {
  return !isCrossoverCopy(el) && el.crossover === true && (el.x < -0.5 || el.x > postW + 0.5);
}

/**
 * Cópia de rascunho anterior a `crossFrom` **de verdade**: marcada, com o
 * centro fora da folha **e** com um dono na vizinhança (mesmo `id` deslocado
 * em ±postW). É cicatrizada ao carregar (`normalizeCrossoverOwnership`) e, até
 * lá, também não pode agir como dona.
 *
 * O teste de posição sozinho tratava o DONO como cópia inerte assim que o
 * centro dele passava da borda da página: a vizinha nunca recebia a cópia
 * (ficava só o espelho, que não recebe clique) e uma cópia já materializada
 * congelava na posição antiga. Era o "só consigo mexer pela página onde o
 * elemento nasceu", com o limite de ±0,5 px em volta da borda.
 */
function isLegacyCopy(
  el: El,
  postW: number,
  prev?: SlideData,
  nextSlide?: SlideData,
): boolean {
  if (!isMarkedOutsideSheet(el, postW)) return false;
  return findLegacyOwner(el, prev, nextSlide, postW) !== null;
}

/** Só o dono materializa cópias; cópias (com posse ou legadas) são inertes. */
function canSourceBleed(
  el: El,
  postW: number,
  prev?: SlideData,
  nextSlide?: SlideData,
): boolean {
  return !isCrossoverCopy(el) && !isLegacyCopy(el, postW, prev, nextSlide);
}

/**
 * Calcula a extensão horizontal aproximada `[minX, maxX]` de um elemento
 * no espaço de coordenadas do slide (`0..postW`), levando em conta escala e rotação.
 */
export function getElementHorizSpan(
  el: El,
  postW: number,
): { minX: number; maxX: number } | null {
  if (el.kind === 'decoration') {
    const asset = getDecoration(el.assetId);
    if (!asset) return null;
    if (
      asset.fullSheet &&
      Math.abs(el.x - postW / 2) < 2 &&
      el.scale <= 1 &&
      Math.abs(el.rotation % 180) < 1
    ) {
      return null;
    }
    const w = asset.width * el.scale;
    const h = asset.height * el.scale;
    const rad = (el.rotation * Math.PI) / 180;
    const halfW = (w * Math.abs(Math.cos(rad)) + h * Math.abs(Math.sin(rad))) / 2;
    return { minX: el.x - halfW, maxX: el.x + halfW };
  }
  if (el.kind === 'logo') {
    const asset = getLogo(el.variant);
    if (!asset) return null;
    const w = asset.width * el.scale;
    const h = asset.height * el.scale;
    const rad = (el.rotation * Math.PI) / 180;
    const halfW = (w * Math.abs(Math.cos(rad)) + h * Math.abs(Math.sin(rad))) / 2;
    return { minX: el.x - halfW, maxX: el.x + halfW };
  }
  if (el.kind === 'image') {
    const w = el.width * el.scale;
    const h = el.height * el.scale;
    const rad = (el.rotation * Math.PI) / 180;
    const halfW = (w * Math.abs(Math.cos(rad)) + h * Math.abs(Math.sin(rad))) / 2;
    return { minX: el.x - halfW, maxX: el.x + halfW };
  }
  if (el.kind === 'text') {
    const displayText = el.uppercase ? el.text.toUpperCase() : el.text;
    const lines = (displayText || ' ').split('\n');
    const maxChars = Math.max(1, ...lines.map((l) => l.length));
    const padX = el.border !== 'none' ? el.fontSize * BORDER_PAD.x : 0;
    const padY = el.border !== 'none' ? el.fontSize * BORDER_PAD.y : 0;
    // Com largura definida, o texto quebra nela; a altura é sempre automática.
    const perChar = el.fontSize * 0.62 + el.letterSpacing;
    const naturalW = Math.max(el.fontSize * 1.5, maxChars * perChar);
    const w = (el.boxWidth ?? naturalW) + padX * 2;
    let visualLines = Math.max(1, lines.length);
    if (el.boxWidth) {
      const charsPerLine = Math.max(1, Math.floor(el.boxWidth / Math.max(1, perChar)));
      visualLines = lines.reduce((n, line) => n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
    }
    const h = visualLines * el.fontSize * el.lineHeight + padY * 2;
    const rad = (el.rotation * Math.PI) / 180;
    const halfW = (w * Math.abs(Math.cos(rad)) + h * Math.abs(Math.sin(rad))) / 2;
    return { minX: el.x - halfW, maxX: el.x + halfW };
  }
  return null;
}

/**
 * Verifica se um elemento atravessa ou está na Zona de Sangria da borda lateral informada
 * (`side === 'right'` → sangra para o slide `i + 1` com `x - postW`;
 *  `side === 'left'`  → sangra para o slide `i - 1` com `x + postW`).
 *
 * A condição para `'right'` sob a translação `x' = x - postW` é matematicamente simétrica
 * à condição para `'left'`, garantindo consistência bidirecional entre slides vizinhos.
 */
export function canElementBleedToSide(
  el: El,
  side: 'left' | 'right',
  postW: number,
): boolean {
  const span = getElementHorizSpan(el, postW);
  if (!span) return false;

  if (side === 'right') {
    if (el.crossover) {
      return (
        (span.minX < postW && span.maxX > postW) ||
        (span.maxX > postW - CROSSOVER_ZONE &&
          span.minX < postW + CROSSOVER_ZONE &&
          el.x > postW / 2 &&
          el.x < postW * 1.5)
      );
    }
    return span.minX < postW && span.maxX > postW && el.x > postW * 0.65;
  } else {
    if (el.crossover) {
      return (
        (span.minX < 0 && span.maxX > 0) ||
        (span.maxX > -CROSSOVER_ZONE &&
          span.minX < CROSSOVER_ZONE &&
          el.x > -postW / 2 &&
          el.x < postW / 2)
      );
    }
    return span.minX < 0 && span.maxX > 0 && el.x < postW * 0.35;
  }
}

/**
 * `true` quando o elemento está **inteiro** fora da folha daquele lado — não
 * toca mais a página. `'left'`: tudo à esquerda de `x = 0`; `'right'`: tudo à
 * direita de `x = postW`.
 */
export function isFullyOutside(el: El, side: 'left' | 'right', postW: number): boolean {
  const span = getElementHorizSpan(el, postW);
  if (!span) return false;
  return side === 'left' ? span.maxX <= 0 : span.minX >= postW;
}

/** Remove a flag `crossover` de uma lista de elementos (preservando referências se inalterado). */
export function stripCrossoverFromElements(elements: El[]): El[] {
  if (!elements.some((e) => e.crossover !== undefined || e.crossFrom !== undefined)) {
    return elements;
  }
  return elements.map((e) => {
    if (e.crossover === undefined && e.crossFrom === undefined) return e;
    const copy: El = { ...e };
    delete copy.crossover;
    delete copy.crossFrom;
    return copy;
  });
}

/** Remove `crossover` de todos os elementos de um slide. */
export function stripCrossoverFromSlide(slide: SlideData): SlideData {
  const cleaned = stripCrossoverFromElements(slide.doc.elements);
  if (cleaned === slide.doc.elements) return slide;
  return {
    ...slide,
    doc: {
      ...slide.doc,
      elements: cleaned,
    },
  };
}

function elementsEqual(a: El, b: El): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Lado do dono de uma cópia, pela posição dela: a cópia mora na borda oposta
 * à do dono, então `x` pequeno = dono é a página ANTERIOR; `x` grande = dono é
 * a página SEGUINTE. Isso é o que detecta a cópia "vizinha, mas do lado
 * errado" depois de reordenar páginas.
 */
function copyOwnerSide(el: El, postW: number): 'prev' | 'next' {
  return el.x <= postW / 2 ? 'prev' : 'next';
}

/** Devolve o elemento como DONO da arte (sem posse de cópia). */
function asOwner(el: El): El {
  const copy: El = { ...el };
  delete copy.crossFrom;
  return copy;
}

/**
 * Cópia de `ownerSlideId` dentro de `slide`.
 *
 * Uma cópia pertence a UM dono: com `crossFrom` explícito, só casa quando
 * aponta para o slide certo — era o que faltava para uma cópia órfã apagar o
 * elemento real da vizinha. Elemento legado (marcado, sem `crossFrom`) vale
 * como cópia do dono atual.
 */
function copyOf(slide: SlideData, id: string, ownerSlideId: string): El | undefined {
  const el = slide.doc.elements.find((e) => e.id === id);
  if (!el) return undefined;
  if (isCrossoverCopy(el)) return el.crossFrom === ownerSlideId ? el : undefined;
  return el.crossover === true ? el : undefined;
}

function upsertElementInSlide(slide: SlideData, incoming: El): SlideData {
  const list = slide.doc.elements;
  const idx = list.findIndex((e) => e.id === incoming.id);
  if (idx >= 0) {
    const current = list[idx];
    // Elemento real nunca é sobrescrito por uma cópia de mesmo id (dados
    // legados) e a cópia de OUTRO dono também não.
    if (!isCrossoverCopy(current) && current.crossover !== true) return slide;
    if (isCrossoverCopy(current) && current.crossFrom !== incoming.crossFrom) return slide;
    if (elementsEqual(current, incoming)) return slide;
    const nextElements = [...list];
    nextElements[idx] = incoming;
    return {
      ...slide,
      doc: { ...slide.doc, elements: nextElements },
    };
  }
  // Se for logo e o slide já tiver outra logo diferente, substitui para manter no máx. 1 logo
  if (incoming.kind === 'logo') {
    const existingLogoIdx = list.findIndex((e) => e.kind === 'logo');
    if (existingLogoIdx >= 0) {
      // A regra de uma logo por post vale para a ARTE do slide: a cópia de
      // sangria da logo do vizinho nunca substitui a logo própria da página
      // (era assim que ela era apagada e a página ficava sem logo nenhuma).
      if (isCrossoverCopy(incoming) && !isCrossoverCopy(list[existingLogoIdx])) return slide;
      const nextElements = [...list];
      nextElements[existingLogoIdx] = incoming;
      return {
        ...slide,
        doc: { ...slide.doc, elements: nextElements },
      };
    }
  }
  return {
    ...slide,
    doc: {
      ...slide.doc,
      elements: [...list, incoming],
    },
  };
}

/**
 * Entrega a arte a uma página (handoff): troca a cópia homónima, se houver,
 * pelo elemento com posse própria. Elementos de outro `id` no destino não são
 * tocados — um handoff nunca apaga arte de ninguém.
 */
function adoptElementInSlide(slide: SlideData, incoming: El): SlideData {
  const list = slide.doc.elements;
  const idx = list.findIndex((e) => e.id === incoming.id);
  if (idx < 0) {
    return { ...slide, doc: { ...slide.doc, elements: [...list, incoming] } };
  }
  const nextElements = [...list];
  nextElements[idx] = incoming;
  return { ...slide, doc: { ...slide.doc, elements: nextElements } };
}

function removeElementFromSlide(slide: SlideData, id: string): SlideData {
  if (!slide.doc.elements.some((e) => e.id === id)) return slide;
  return {
    ...slide,
    doc: {
      ...slide.doc,
      elements: slide.doc.elements.filter((e) => e.id !== id),
    },
  };
}

/** Remove da vizinha apenas a cópia do dono informado; elemento real fica intacto. */
function removeCopyOf(slide: SlideData, id: string, ownerSlideId: string): SlideData {
  if (!copyOf(slide, id, ownerSlideId)) return slide;
  return removeElementFromSlide(slide, id);
}

/**
 * Sincroniza os crossovers a partir de uma edição no slide ativo `activeIndex`.
 * - Exclusão apaga a **arte inteira** (dono + cópias), casada pela posse —
 *   nunca o homônimo real de outra página.
 * - Só elementos **donos** materializam/atualizam cópias nas vizinhas, sempre
 *   com `crossFrom: <id deste slide>`; cópias são inertes.
 * - Elemento que deixou de sangrar perde a marca e a vizinha perde a cópia.
 */
export function syncCrossoverFromActiveSlide(
  slides: SlideData[],
  activeIndex: number,
  prevActiveDoc: Doc,
  newActiveDoc: Doc,
  newActiveFinish: FinishState,
  format: PostFormat,
): SlideData[] {
  const activeSlide = slides[activeIndex];
  if (!activeSlide) return slides;

  if (slides.length <= 1) {
    const cleanedElements = stripCrossoverFromElements(newActiveDoc.elements);
    const finalDoc =
      cleanedElements === newActiveDoc.elements
        ? newActiveDoc
        : { ...newActiveDoc, elements: cleanedElements };
    if (activeSlide.doc === finalDoc && activeSlide.finish === newActiveFinish) {
      return slides;
    }
    return [{ ...activeSlide, doc: finalDoc, finish: newActiveFinish }];
  }

  const { width: postW } = getPostDimensions(format);
  const ownerId = activeSlide.id;
  const nextSlides = [...slides];

  // 1. Exclusões: a arte é uma só, então some do dono e de todas as cópias.
  const currentIds = new Set(newActiveDoc.elements.map((e) => e.id));
  const deleted = prevActiveDoc.elements.filter((e) => !currentIds.has(e.id));

  for (const removed of deleted) {
    // Excluir a cópia visível é excluir a arte: o dono é quem a possui.
    const artOwnerId = removed.crossFrom ?? ownerId;
    for (let j = 0; j < nextSlides.length; j++) {
      if (j === activeIndex) continue; // o doc ativo já perdeu o elemento
      const slide = nextSlides[j];
      const isArtOwnerSlide = slide.id === artOwnerId;
      const hasCopy = slide.doc.elements.some(
        (e) => e.id === removed.id && e.crossFrom === artOwnerId,
      );
      if (!isArtOwnerSlide && !hasCopy) continue;
      nextSlides[j] = removeElementFromSlide(slide, removed.id);
    }
  }

  // 2. Sincronizar cada DONO do slide ativo com as vizinhas imediatas.
  let updatedActiveElements: El[] | null = null;
  const droppedCopies = new Set<string>();
  /** Elementos que passaram a ser de outra página nesta edição. */
  const handedOff = new Set<string>();

  newActiveDoc.elements.forEach((el, idx) => {
    // ── HANDOFF: arte arrastada INTEIRA para fora desta página ────────────
    // Sai da folha de vez (não toca mais a página e já passou da Zona de
    // Sangria) e existe vizinha daquele lado: a posse vai para ela, com as
    // coordenadas convertidas. Sem isso o elemento deixava de sangrar, a
    // cópia era removida e o dono ficava fora da folha (recortado) — sumia
    // das duas páginas, em "limbo", mesmo continuando no doc.
    //
    // Vem antes do ramo de cópia: a cópia arrastada para fora pelo lado
    // oposto também entrega a arte àquela vizinha, em vez de virar arte desta
    // página fora da folha (invisível).
    const outLeft =
      activeIndex > 0 &&
      isFullyOutside(el, 'left', postW) &&
      !canElementBleedToSide(el, 'left', postW);
    const outRight =
      activeIndex < nextSlides.length - 1 &&
      isFullyOutside(el, 'right', postW) &&
      !canElementBleedToSide(el, 'right', postW);
    if (outLeft || outRight) {
      const targetIndex = outLeft ? activeIndex - 1 : activeIndex + 1;
      const target = nextSlides[targetIndex];
      const moved: El = {
        ...el,
        x: round2(outLeft ? el.x + postW : el.x - postW),
      };
      delete moved.crossover;
      delete moved.crossFrom;
      const artOwnerId = el.crossFrom ?? ownerId;
      const existing = target.doc.elements.find((e) => e.id === el.id);
      // Só entrega sobre a MESMA arte (cópia homónima ou o próprio dono).
      // Elemento real de outro id nunca é sobrescrito por um handoff.
      if (!existing || isCrossoverCopy(existing) || target.id === artOwnerId) {
        // A arte é uma só: sai daqui e de qualquer outra cópia.
        for (let j = 0; j < nextSlides.length; j++) {
          if (j === activeIndex || j === targetIndex) continue;
          const slide = nextSlides[j];
          const isArtOwnerSlide = slide.id === artOwnerId;
          const hasCopy = slide.doc.elements.some(
            (e) => e.id === el.id && e.crossFrom === artOwnerId,
          );
          if (!isArtOwnerSlide && !hasCopy) continue;
          nextSlides[j] = removeElementFromSlide(slide, el.id);
        }
        nextSlides[targetIndex] = adoptElementInSlide(target, moved);
        handedOff.add(el.id);
        return;
      }
    }

    // ── CÓPIA na página ativa ─────────────────────────────────────────────
    // Uma cópia pertence ao slide `crossFrom` e só espelha de volta para ELE
    // (nunca para o outro lado, nunca para uma página não vizinha).
    if (isCrossoverCopy(el)) {
      // A cópia precisa JÁ existir neste doc: uma cópia que aparece do nada
      // (palco dessincronizado, doc herdado) nunca reivindica arte de outra
      // página — senão arrastá-la "para dentro" apagava o elemento do dono.
      const previous = prevActiveDoc.elements.find(
        (p) => p.id === el.id && p.crossFrom === el.crossFrom,
      );
      if (!previous) {
        droppedCopies.add(el.id);
        return;
      }

      // O DONO declarado (`crossFrom`) decide o lado — nunca o `x` da cópia.
      // Antes o lado vinha de onde a cópia estava: arrastar uma cópia larga
      // para dentro da página (centro além de postW/2) fazia o motor procurar
      // o dono na página SEGUINTE e descartar a cópia em silêncio.
      const ownerOnPrev =
        activeIndex > 0 && nextSlides[activeIndex - 1].id === el.crossFrom;
      const ownerOnNext =
        activeIndex < nextSlides.length - 1 && nextSlides[activeIndex + 1].id === el.crossFrom;
      // Órfã (o dono declarado não é mais vizinho): sai do doc ativo — a arte
      // continua no dono.
      if (!ownerOnPrev && !ownerOnNext) {
        droppedCopies.add(el.id);
        return;
      }
      const ownerIndex = ownerOnPrev ? activeIndex - 1 : activeIndex + 1;

      const bleedSide = ownerOnPrev ? 'left' : 'right';
      if (!canElementBleedToSide(el, bleedSide, postW)) {
        // Arrastou a cópia para dentro desta página: a arte passa a ser dela
        // (sai do dono e de qualquer outra cópia).
        for (let j = 0; j < nextSlides.length; j++) {
          if (j === activeIndex) continue;
          const target = nextSlides[j];
          const isOwnerSlide = target.id === el.crossFrom;
          const hasCopy = target.doc.elements.some(
            (e) => e.id === el.id && e.crossFrom === el.crossFrom,
          );
          if (!isOwnerSlide && !hasCopy) continue;
          nextSlides[j] = removeElementFromSlide(target, el.id);
        }
        if (!updatedActiveElements) updatedActiveElements = [...newActiveDoc.elements];
        const owned: El = { ...el };
        delete owned.crossover;
        delete owned.crossFrom;
        updatedActiveElements[idx] = owned;
        return;
      }

      // Ainda sangra para o dono: a edição feita na cópia volta para ele.
      const mirrored = asOwner({
        ...el,
        x: round2(ownerOnPrev ? el.x + postW : el.x - postW),
        crossover: true,
      });
      nextSlides[ownerIndex] = upsertElementInSlide(nextSlides[ownerIndex], mirrored);
      return;
    }

    // Cópia legada (sem dono declarado) não é fonte até ser cicatrizada.
    if (!canSourceBleed(el, postW, nextSlides[activeIndex - 1], nextSlides[activeIndex + 1])) {
      return;
    }

    const hasPrev = activeIndex > 0;
    const hasNext = activeIndex < nextSlides.length - 1;

    const bleedsLeft = hasPrev && canElementBleedToSide(el, 'left', postW);
    const bleedsRight = hasNext && canElementBleedToSide(el, 'right', postW);

    // Só considera "estava na vizinha" a cópia DESTE dono.
    const wasInPrev = hasPrev && !!copyOf(nextSlides[activeIndex - 1], el.id, ownerId);
    const wasInNext = hasNext && !!copyOf(nextSlides[activeIndex + 1], el.id, ownerId);

    // Atualiza slide anterior (activeIndex - 1)
    if (hasPrev) {
      if (bleedsLeft) {
        const leftCopy: El = {
          ...el,
          x: round2(el.x + postW),
          crossover: true,
          crossFrom: ownerId,
        };
        nextSlides[activeIndex - 1] = upsertElementInSlide(
          nextSlides[activeIndex - 1],
          leftCopy,
        );
      } else if (wasInPrev) {
        nextSlides[activeIndex - 1] = removeCopyOf(
          nextSlides[activeIndex - 1],
          el.id,
          ownerId,
        );
      }
    }

    // Atualiza slide seguinte (activeIndex + 1)
    if (hasNext) {
      if (bleedsRight) {
        const rightCopy: El = {
          ...el,
          x: round2(el.x - postW),
          crossover: true,
          crossFrom: ownerId,
        };
        nextSlides[activeIndex + 1] = upsertElementInSlide(
          nextSlides[activeIndex + 1],
          rightCopy,
        );
      } else if (wasInNext) {
        nextSlides[activeIndex + 1] = removeCopyOf(
          nextSlides[activeIndex + 1],
          el.id,
          ownerId,
        );
      }
    }

    // Normaliza a marca no próprio dono (e limpa posse de quem nunca é dono).
    if (bleedsLeft || bleedsRight) {
      if (el.crossover !== true || el.crossFrom !== undefined) {
        if (!updatedActiveElements) updatedActiveElements = [...newActiveDoc.elements];
        updatedActiveElements[idx] = asOwner({ ...el, crossover: true });
      }
    } else if (wasInPrev || wasInNext || el.crossover !== undefined || el.crossFrom !== undefined) {
      if (el.crossover !== undefined || el.crossFrom !== undefined) {
        if (!updatedActiveElements) updatedActiveElements = [...newActiveDoc.elements];
        const cleaned: El = { ...el };
        delete cleaned.crossover;
        delete cleaned.crossFrom;
        updatedActiveElements[idx] = cleaned;
      }
    }
  });

  let activeElements = updatedActiveElements ?? newActiveDoc.elements;
  if (droppedCopies.size > 0) {
    activeElements = activeElements.filter(
      (el) => !(droppedCopies.has(el.id) && isCrossoverCopy(el)),
    );
  }
  if (handedOff.size > 0) {
    activeElements = activeElements.filter((el) => !handedOff.has(el.id));
  }
  const finalActiveDoc =
    activeElements === newActiveDoc.elements
      ? newActiveDoc
      : { ...newActiveDoc, elements: activeElements };

  if (
    activeSlide.doc !== finalActiveDoc ||
    activeSlide.finish !== newActiveFinish
  ) {
    nextSlides[activeIndex] = {
      ...activeSlide,
      doc: finalActiveDoc,
      finish: newActiveFinish,
    };
  }

  // Se nenhum slide mudou por referência, devolve o array original
  const changed = nextSlides.some((sl, i) => sl !== slides[i]);
  return changed ? nextSlides : slides;
}

/** Dono legado do par com `el` (cópia): vizinha com o mesmo id deslocado em ±postW. */
function findLegacyOwner(
  el: El,
  prev: SlideData | undefined,
  nextSlide: SlideData | undefined,
  postW: number,
): string | null {
  const match = (slide: SlideData | undefined, expectedX: number): string | null => {
    if (!slide) return null;
    const owner = slide.doc.elements.find(
      (candidate) =>
        candidate.id === el.id &&
        !isCrossoverCopy(candidate) &&
        Math.abs(candidate.x - expectedX) <= PAIR_TOLERANCE,
    );
    return owner ? slide.id : null;
  };
  // Cópia à esquerda do dono: x_dono = x_cópia + postW.
  // Cópia à direita do dono: x_dono = x_cópia - postW.
  return match(prev, el.x + postW) ?? match(nextSlide, el.x - postW);
}

/**
 * Cicatriza a posse das cópias (rascunhos antigos e estado herdado):
 * - par válido entre vizinhas ganha `crossFrom` no elemento deslocado;
 * - cópia cujo dono não é mais vizinho é descartada (a arte continua no dono);
 * - elemento marcado e fora da folha, sem dono na vizinhança, perde a marca.
 */
export function normalizeCrossoverOwnership(
  slides: SlideData[],
  format: PostFormat,
): SlideData[] {
  if (slides.length < 2) return slides;
  const { width: postW } = getPostDimensions(format);
  let changed = false;

  const next = slides.map((slide, i) => {
    const prev = slides[i - 1];
    const nextSlide = slides[i + 1];
    let elementsChanged = false;
    const elements: El[] = [];

    for (const el of slide.doc.elements) {
      if (isCrossoverCopy(el)) {
        const owner = copyOwnerSide(el, postW) === 'prev' ? prev : nextSlide;
        if (owner && owner.id === el.crossFrom) {
          elements.push(el);
          continue;
        }
        // Órfã (dono fora do lado certo): descartar não perde arte.
        elementsChanged = true;
        continue;
      }

      if (isMarkedOutsideSheet(el, postW)) {
        const ownerSlideId = findLegacyOwner(el, prev, nextSlide, postW);
        if (ownerSlideId) {
          elements.push({ ...el, crossFrom: ownerSlideId });
        } else {
          const cleaned: El = { ...el };
          delete cleaned.crossover;
          elements.push(cleaned);
        }
        elementsChanged = true;
        continue;
      }

      elements.push(el);
    }

    if (!elementsChanged) return slide;
    changed = true;
    return {
      ...slide,
      doc: { ...slide.doc, elements },
    };
  });

  return changed ? next : slides;
}

/**
 * Reordenar é posicional: só a ordem muda. A cópia de crossover, porém, só
 * existe enquanto o dono é vizinho — depois da reordenação as cópias que
 * perderam a vizinhança saem, para não vazarem na página errada nem voltarem
 * a apagar elementos do dono.
 */
export function pruneOrphanCrossoverCopies(
  slides: SlideData[],
  format: PostFormat,
): SlideData[] {
  const { width: postW } = getPostDimensions(format);
  let changed = false;
  const next = slides.map((slide, i) => {
    const prev = slides[i - 1];
    const nextSlide = slides[i + 1];
    const elements = slide.doc.elements.filter((el) => {
      if (!isCrossoverCopy(el)) return true;
      const owner = copyOwnerSide(el, postW) === 'prev' ? prev : nextSlide;
      return owner?.id === el.crossFrom;
    });
    if (elements.length === slide.doc.elements.length) return slide;
    changed = true;
    return {
      ...slide,
      doc: { ...slide.doc, elements },
    };
  });
  return changed ? next : slides;
}

/**
 * Reconcilia todos os slides do carrossel garantindo que elementos crossover de
 * qualquer slide `i` estejam materializados e sincronizados nas vizinhas
 * `i - 1` e `i + 1` — sempre a partir do DONO, com a posse (`crossFrom`) em dia.
 */
export function reconcileAllCrossovers(
  slides: SlideData[],
  format: PostFormat,
): SlideData[] {
  if (slides.length === 0) return slides;
  if (slides.length === 1) {
    const cleaned = stripCrossoverFromSlide(slides[0]);
    return cleaned === slides[0] ? slides : [cleaned];
  }

  const { width: postW } = getPostDimensions(format);
  // 1. Posse em ordem: adota pares legados e descarta cópias órfãs.
  const normalized = normalizeCrossoverOwnership(slides, format);
  const nextSlides = [...normalized];

  // 2. Só DONOS materializam cópias nas vizinhas atuais.
  for (let i = 0; i < nextSlides.length; i++) {
    const slide = nextSlides[i];
    for (const el of slide.doc.elements) {
      if (!canSourceBleed(el, postW, nextSlides[i - 1], nextSlides[i + 1])) continue;
      if (i > 0 && canElementBleedToSide(el, 'left', postW)) {
        const leftCopy: El = {
          ...el,
          x: round2(el.x + postW),
          crossover: true,
          crossFrom: slide.id,
        };
        nextSlides[i - 1] = upsertElementInSlide(nextSlides[i - 1], leftCopy);
      }
      if (i < nextSlides.length - 1 && canElementBleedToSide(el, 'right', postW)) {
        const rightCopy: El = {
          ...el,
          x: round2(el.x - postW),
          crossover: true,
          crossFrom: slide.id,
        };
        nextSlides[i + 1] = upsertElementInSlide(nextSlides[i + 1], rightCopy);
      }
    }
  }

  const changed = nextSlides.some((sl, i) => sl !== slides[i]);
  return changed ? nextSlides : slides;
}

/**
 * Prepara o `SlideData` escolhido ao converter do Modo Carrossel para o Modo Post Único:
 * garante que quaisquer elementos crossover que atravessem a partir dos slides adjacentes
 * (`index - 1` ou `index + 1`) estejam materializados no `doc.elements` do slide escolhido
 * (em suas coordenadas locais `x ± postW`) e remove a propriedade `crossover`.
 */
export function extractSingleSlideData(
  slides: SlideData[],
  index: number,
  format: PostFormat,
): SlideData | null {
  if (slides.length === 0) return null;
  const reconciled = reconcileAllCrossovers(slides, format);
  const chosen = reconciled[index] ?? reconciled[0];
  if (!chosen) return null;
  // A cópia continua no doc (é o fragmento visível desta página, mesmo fora da
  // folha) — a conversão preserva o que a usuária vê, só sem a marca de sangria.
  return stripCrossoverFromSlide(chosen);
}
