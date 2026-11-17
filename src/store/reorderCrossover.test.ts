import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeCrossoverOwnership } from '../lib/crossover';
import { loadSlideIntoEditor, useCarousel } from './carouselStore';
import { defaultFinish, emptyDoc, useEditor } from './editorStore';
import { installEditorCarouselSync } from './syncEngine';
import type { El, FinishState, SlideData } from '../types';

/**
 * Regressão do relatório do vídeo (drag & drop de slides, 12/11/2026).
 *
 * Instala o MESMO subscriber do `main.tsx` (grava o doc do editor no slide
 * ativo a cada mudança) e reproduz as duas sequências do relatório com pares
 * de crossover **reais** — cópia com o mesmo `id` e posse explícita
 * (`crossFrom`), como o motor materializa.
 *
 * Invariantes verificadas depois de cada sequência:
 *  1. cada página mantém a própria arte (nenhum elemento dono entra ou sai);
 *  2. fundo e acabamento de cada página não trocam de lugar;
 *  3. toda cópia de crossover pertence a um slide VIZINHO (sem órfãs).
 */

const text = (id: string, x: number, label = id, crossover?: boolean): El => ({
  id,
  kind: 'text',
  style: 'title',
  text: label,
  x,
  y: 700,
  rotation: 0,
  scale: 1,
  ...(crossover === undefined ? {} : { crossover }),
  fontSize: 120,
  lineHeight: 1,
  letterSpacing: 0,
  align: 'center',
  uppercase: true,
  color: 'preto',
  brandEffect: false,
  border: 'none',
});

const image = (id: string, imageId: string, x: number, crossover?: boolean): El => ({
  id,
  kind: 'image',
  imageId,
  name: imageId,
  x,
  y: 1000,
  rotation: 0,
  scale: 1,
  ...(crossover === undefined ? {} : { crossover }),
  width: 600,
  height: 400,
  flipX: false,
  flipY: false,
});

/** Cópia materializada da arte do slide `ownerSlideId`, deslocada em `dx`. */
const copyOf = (el: El, ownerSlideId: string, dx: number): El => ({
  ...el,
  x: el.x + dx,
  crossover: true,
  crossFrom: ownerSlideId,
});

const slide = (
  id: string,
  backgroundId: string | null,
  elements: El[],
  finish?: FinishState,
): SlideData => ({
  id,
  doc: { ...emptyDoc(), backgroundId, elements },
  finish: finish ?? defaultFinish(),
});

const paintedPaper = (): FinishState => {
  const base = defaultFinish();
  return {
    ...base,
    borderTexture: { enabled: true, opacity: 70 },
  };
};

// Igual ao main.tsx: o doc do editor volta para o slide dono a cada mudança.
installEditorCarouselSync();

/** Arte própria da página (dono = elemento sem `crossFrom`). */
const owns = (s: SlideData): string[] =>
  s.doc.elements.filter((el) => !el.crossFrom).map((el) => el.id).sort();

const copies = (s: SlideData): El[] => s.doc.elements.filter((el) => !!el.crossFrom);

const currentSlides = (): SlideData[] => useCarousel.getState().slides;

const slideById = (id: string): SlideData => {
  const found = currentSlides().find((s) => s.id === id);
  if (!found) throw new Error(`slide ${id} não existe mais`);
  return found;
};

function install(slides: SlideData[], active = 0): void {
  useCarousel.setState({
    mode: 'carousel',
    slides,
    activeSlideIndex: active,
    format: '3:4',
  });
  loadSlideIntoEditor(slides[active]);
}

/** Invariantes 1 a 3 (ver o cabeçalho do arquivo). */
function expectPagesIntact(original: SlideData[]): void {
  const slides = currentSlides();
  slides.forEach((page, index) => {
    const before = original.find((s) => s.id === page.id);
    expect(before, `página ${page.id} sumiu`).toBeTruthy();
    if (!before) return;

    expect(owns(page)).toEqual(owns(before));
    expect(page.doc.backgroundId).toBe(before.doc.backgroundId);
    expect(page.finish).toBe(before.finish);

    // Cópia de verdade mora na borda oposta à do dono: x pequeno = dono é a
    // página anterior; x grande = dono é a seguinte (post 3:4 → 1080).
    for (const copy of copies(page)) {
      const expectedOwner = copy.x <= 540 ? slides[index - 1]?.id : slides[index + 1]?.id;
      expect(copy.crossFrom).toBe(expectedOwner);
    }
  });
}

/**
 * Projeto do relatório: 6 páginas, com sangrias reais entre vizinhas
 * (S1 → S2, S2 → S1, S2 ← S3, S3 → S4).
 */
function videoProject(): SlideData[] {
  const arame = text('t-arame', 1030, 'ARAME', true); // S1 sangra p/ direita
  const banda = image('img-banda', 'banda', 540);
  const vocalista = image('img-vocalista', 'vocalista', 70, true); // S2 sangra p/ esquerda
  const persp = text('t-persp', 540, 'Da perspectiva');
  const edu = text('t-edu', 1000, 'Edu Lima', true); // S3 sangra p/ direita
  const wes = text('t-wes', 60, 'Wes', true); // S3 sangra p/ esquerda
  const banda3 = image('img-banda3', 'banda3', 540);

  return [
    slide('S1', 'pronto-1', [
      text('t-prato', 540, 'PRATO DO DIA'),
      arame,
      banda,
      copyOf(vocalista, 'S2', 1080), // 70 + 1080 = 1150
    ]),
    slide('S2', 'pronto-1', [
      text('t-conheca', 540, 'CONHECA A BANDA'),
      vocalista,
      copyOf(arame, 'S1', -1080), // 1030 - 1080 = -50
    ]),
    slide(
      'S3',
      'pronto-2',
      [persp, edu, wes, banda3, copyOf(arame, 'S1', -1080)],
      paintedPaper(),
    ),
    slide('S4', 'pronto-1', [
      text('t-sono', 540, 'SONORIDADE'),
      text('t-liberdade', 540, 'LIBERDADE'),
      copyOf(edu, 'S3', -1080), // -80
    ]),
    slide('S5', 'pronto-1', [text('t-ep', 540, 'TERAPIA EM GRUPO')]),
    slide('S6', 'pronto-1', [
      text('t-shows', 540, 'PROXIMOS SHOWS'),
      image('img-banda6', 'banda6', 540),
    ]),
  ];
}

describe('reordenar slides não corrompe a arte (relatório do vídeo)', () => {
  beforeEach(() => {
    useCarousel.setState({ mode: 'single' });
    useEditor.setState({
      doc: emptyDoc(),
      finish: defaultFinish(),
      step: 0,
      selectedIds: [],
      selectedId: null,
      editingId: null,
    });
    useCarousel.getState().resetCarousel();
  });

  it('TESTE 1: slide 6 para a posição 2 — visitar as páginas não move arte', () => {
    const project = videoProject();
    install(project, 0);

    useCarousel.getState().setActiveSlide(5); // sai do S1 e abre o S6
    useCarousel.getState().reorderSlides(5, 1); // arrasta o S6 para a posição 2
    expect(currentSlides().map((s) => s.id)).toEqual(['S1', 'S6', 'S2', 'S3', 'S4', 'S5']);

    // A cópia do arame de S1 em S2 perdeu a vizinhança → sai de S2.
    expect(slideById('S2').doc.elements.some((el) => el.id === 't-arame')).toBe(false);

    // Navegar por todas as páginas (é o que disparava a contaminação).
    useCarousel.getState().setActiveSlide(0);
    useCarousel.getState().setActiveSlide(1);
    useCarousel.getState().setActiveSlide(2);
    useCarousel.getState().setActiveSlide(1);
    useCarousel.getState().setActiveSlide(3);
    useCarousel.getState().setActiveSlide(4);
    useCarousel.getState().setActiveSlide(5);

    expectPagesIntact(project);

    // O S2 continua dono da vocalista (antes ela era "sequestrada" pelo vizinho).
    expect(owns(slideById('S2'))).toEqual(['img-vocalista', 't-conheca']);
    // Cada elemento aparece onde é dono, e só como cópia nos vizinhos.
    expect(slideById('S1').doc.elements.filter((el) => el.id === 't-arame')).toHaveLength(1);
    expect(owns(slideById('S6'))).toEqual(['img-banda6', 't-shows']);
  });

  it('TESTE 2: slide 4 para a posição 3 com cliques oscilantes — sem fundo/textura trocados', () => {
    const project = videoProject();
    install(project, 1);

    // Cliques do vídeo: 4 → 3 → 4 antes de arrastar.
    useCarousel.getState().setActiveSlide(3);
    useCarousel.getState().setActiveSlide(2);
    useCarousel.getState().setActiveSlide(3);

    useCarousel.getState().reorderSlides(3, 2);
    expect(currentSlides().map((s) => s.id)).toEqual(['S1', 'S2', 'S4', 'S3', 'S5', 'S6']);

    useCarousel.getState().setActiveSlide(1);
    useCarousel.getState().setActiveSlide(2);
    useCarousel.getState().setActiveSlide(3);
    useCarousel.getState().setActiveSlide(0);

    expectPagesIntact(project);

    // Fundo e textura continuam na página dona.
    expect(slideById('S3').doc.backgroundId).toBe('pronto-2');
    expect(slideById('S3').finish.borderTexture.enabled).toBe(true);
    expect(slideById('S4').doc.backgroundId).toBe('pronto-1');
    expect(slideById('S4').finish.borderTexture.enabled).toBe(false);
    expect(slideById('S3').doc.elements.map((el) => el.id).sort()).toEqual(
      ['img-banda3', 't-edu', 't-persp', 't-wes'].sort(),
    );
    // A cópia do "Edu" em S4 ficou com o dono do lado errado depois da
    // reordenação: sai de S4, e a arte continua inteira em S3.
    expect(slideById('S4').doc.elements.some((el) => el.id === 't-edu')).toBe(false);
    expect(slideById('S3').doc.elements.filter((el) => el.id === 't-edu')).toHaveLength(1);
  });

  it('apagar a cópia apaga a arte inteira, mas nunca o homônimo real de outra página', () => {
    const art = text('t-art', 1030, 'ARTE', true);
    const a = slide('A', 'pronto-1', [art]);
    const b = slide('B', 'pronto-1', [copyOf(art, 'A', -1080), text('t-b', 540)]);
    // Página de fora com um elemento REAL que só compartilha o id (legado).
    const c = slide('C', 'pronto-2', [text('t-art', 540, 'OUTRA ARTE')]);
    install([a, b, c], 1);

    const activeDoc = slideById('B').doc;
    useCarousel.getState().updateActiveSlide(
      { ...activeDoc, elements: activeDoc.elements.filter((el) => el.id !== 't-art') },
      slideById('B').finish,
    );

    expect(slideById('A').doc.elements.some((el) => el.id === 't-art')).toBe(false);
    expect(slideById('B').doc.elements.some((el) => el.id === 't-art')).toBe(false);
    expect(slideById('C').doc.elements.some((el) => el.id === 't-art')).toBe(true);
    expect(slideById('B').doc.elements.map((el) => el.id)).toEqual(['t-b']);
  });

  it('grava pelo id do slide mesmo com activeSlideIndex defasado', () => {
    const a = slide('A', 'pronto-1', [text('t-a', 540)]);
    const b = slide('B', 'pronto-1', [text('t-b', 540)]);
    install([a, b], 1); // editor no B
    useCarousel.setState({ activeSlideIndex: 0 }); // índice defasado por um frame

    useCarousel.getState().updateActiveSlide(
      { ...slideById('B').doc, backgroundId: 'puro-9' },
      slideById('B').finish,
    );

    expect(slideById('B').doc.backgroundId).toBe('puro-9');
    expect(slideById('A').doc.backgroundId).toBe('pronto-1');
    expect(useCarousel.getState().activeSlideIndex).toBe(1);
  });

  it('duplicar slide não clona cópias de crossover', () => {
    const project = videoProject();
    install(project, 0);
    useCarousel.getState().duplicateSlide(0);

    const clone = currentSlides()[1];
    expect(clone.id).not.toBe('S1');
    expect(owns(clone)).toHaveLength(owns(project[0]).length);
    // Todo elemento do clone é novo (nada de id repetido com a origem).
    const originIds = new Set(project[0].doc.elements.map((el) => el.id));
    for (const el of clone.doc.elements.filter((e) => !e.crossFrom)) {
      expect(originIds.has(el.id)).toBe(false);
    }
  });

  it('rascunho antigo: adota o par sem crossFrom e ignora cópia órfã fora da folha', () => {
    const legacyOwner = text('L', 1030, 'ARAME', true);
    const legacyCopy = text('L', -50, 'ARAME', true); // sem crossFrom (formato antigo)
    const orphanCopy = text('O', -100, 'ORFA', true); // marcada, fora da folha, sem dono
    const slides = normalizeCrossoverOwnership(
      [slide('A', null, [legacyOwner]), slide('B', null, [legacyCopy, orphanCopy])],
      '3:4',
    );

    expect(slides[1].doc.elements.find((el) => el.id === 'L')?.crossFrom).toBe('A');
    expect(slides[1].doc.elements.find((el) => el.id === 'O')?.crossover).toBeUndefined();
    expect(slides[1].doc.elements.find((el) => el.id === 'O')?.crossFrom).toBeUndefined();
  });

  it('BUG-01: reorderSlides resincroniza useEditor.doc quando o slide ativo perde cópia órfã', () => {
    const xOwner = text('X', 1030, 'ARAME', true);
    const slides = [
      slide('A', 'pronto-1', []),
      slide('B', 'pronto-1', []),
      slide('E', 'pronto-1', [xOwner]),
      slide('F', 'pronto-1', [text('own-F', 540, 'F'), copyOf(xOwner, 'E', -1080)]),
    ];
    install(slides, 3); // F ativo no editor com a cópia X

    useCarousel.getState().reorderSlides(3, 1); // F vai para o índice 1 (entre A e B)

    expect(slideById('F').doc.elements.some((el) => el.id === 'X')).toBe(false);
    expect(useEditor.getState().doc.elements.some((el) => el.id === 'X')).toBe(false);

    // Editar outro elemento em F não ressuscita X nem toca em E
    useEditor.getState().updateElement('own-F', { y: 500 });
    expect(slideById('F').doc.elements.some((el) => el.id === 'X')).toBe(false);
    expect(slideById('E').doc.elements.some((el) => el.id === 'X')).toBe(true);
  });

  it('BUG-02: logo em crossover não sobrescreve a logo própria do slide vizinho', () => {
    const logoS1: El = {
      id: 'logo-1',
      kind: 'logo',
      variant: 'paper',
      x: 1030,
      y: 1300,
      rotation: 0,
      scale: 1,
      crossover: true,
    };
    const logoS6: El = {
      id: 'logo-6',
      kind: 'logo',
      variant: 'clean',
      x: 120,
      y: 1300,
      rotation: 0,
      scale: 1,
    };
    install([slide('S1', 'pronto-1', [logoS1]), slide('S6', 'pronto-1', [logoS6])], 0);

    // Move a logo em S1 (dispara syncCrossoverFromActiveSlide para S6)
    useEditor.getState().updateElement('logo-1', { y: 1290 });

    const s6 = slideById('S6');
    expect(s6.doc.elements.some((el) => el.id === 'logo-6')).toBe(true);
    expect(s6.doc.elements.some((el) => el.id === 'logo-1')).toBe(false);
  });

  it('continuidade após reorder: clicar materializa a cópia que já aparecia, editar sincroniza com a vizinhança atual', () => {
    const arame = text('t-arame', 1030, 'ARAME', true);
    const centro = text('t-centro', 540, 'CENTRO');
    const slides = [
      slide('S1', 'pronto-1', [arame, centro]),
      slide('S2', 'pronto-1', [copyOf(arame, 'S1', -1080)]),
      slide('S3', 'pronto-1', [text('t-s3', 540, 'S3')]),
    ];
    install(slides, 0);

    // Move S3 para o meio (entre S1 e S2): [S1, S3, S2]
    useCarousel.getState().reorderSlides(2, 1);
    expect(currentSlides().map((s) => s.id)).toEqual(['S1', 'S3', 'S2']);
    expect(slideById('S2').doc.elements.some((el) => el.id === 't-arame')).toBe(false);

    // Clicar não move arte de página: a única mudança é a cópia de sangria que
    // já aparecia desenhada (o espelho não recebe clique) passar a existir no
    // doc da vizinha, com a posse do dono. Sem isso a página vizinha abria com
    // um elemento visível e não interativo.
    useCarousel.getState().setActiveSlide(0);
    useCarousel.getState().setActiveSlide(1);
    expect(slideById('S3').doc.elements.map((el) => el.id).sort()).toEqual(['t-arame', 't-s3']);
    expect(
      slideById('S3').doc.elements.find((el) => el.id === 't-arame')?.crossFrom,
    ).toBe('S1');
    // O dono continua intacto (clicar nunca apaga nem duplica arte).
    expect(slideById('S1').doc.elements.map((el) => el.id).sort()).toEqual([
      't-arame',
      't-centro',
    ]);

    // Ao editar em S1, a sangria sincroniza com o novo vizinho S3
    useCarousel.getState().setActiveSlide(0);
    useEditor.getState().updateElement('t-centro', { text: 'EDITADO' });
    expect(slideById('S3').doc.elements.some((el) => el.id === 't-arame' && el.crossFrom === 'S1')).toBe(
      true,
    );
  });
});
