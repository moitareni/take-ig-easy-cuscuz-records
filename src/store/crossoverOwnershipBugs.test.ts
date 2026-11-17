import { beforeEach, describe, expect, it } from 'vitest';
import {
  normalizeCrossoverOwnership,
  pruneOrphanCrossoverCopies,
  syncCrossoverFromActiveSlide,
} from '../lib/crossover';
import { loadSlideIntoEditor, useCarousel } from './carouselStore';
import { defaultFinish, emptyDoc, useEditor } from './editorStore';
import { installEditorCarouselSync } from './syncEngine';
import type { El, FinishState, SlideData } from '../types';

/**
 * Regressão dos dois bugs residuais apontados na auditoria do relatório de
 * arquitetura (12/11/2026):
 *
 *  BUG-01 — depois de reordenar, o store podava a cópia órfã do slide do palco
 *           sem avisar o `useEditor`: o canvas mostrava (e deixava selecionar)
 *           um elemento que a página não tinha mais.
 *  BUG-01b — arrastar essa cópia fantasma para dentro da página fazia o motor
 *           "transferir a arte", apagando o elemento real de uma página que nem
 *           era vizinha.
 *  BUG-02 — a cópia de uma logo em sangria substituía a logo PRÓPRIA do slide
 *           vizinho (regra de "uma logo por post" aplicada à arte errada), e ao
 *           afastar a página ela ficava sem logo nenhuma.
 */

const text = (id: string, x: number, crossover?: boolean): El => ({
  id,
  kind: 'text',
  style: 'title',
  text: id,
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

const logo = (id: string, variant: 'paper' | 'clean', x: number, crossover?: boolean): El =>
  ({
    id,
    kind: 'logo',
    variant,
    x,
    y: 700,
    rotation: 0,
    scale: 1,
    ...(crossover === undefined ? {} : { crossover }),
  }) as El;

const slide = (id: string, elements: El[], finish?: FinishState): SlideData => ({
  id,
  doc: { ...emptyDoc(), elements },
  finish: finish ?? defaultFinish(),
});

const withElements = (base: SlideData, elements: El[]): SlideData => ({
  ...base,
  doc: { ...base.doc, elements },
});

// Igual ao main.tsx: o doc do editor volta para o slide dono a cada mudança.
installEditorCarouselSync();

const install = (slides: SlideData[], active = 0): void => {
  useCarousel.setState({ mode: 'carousel', slides, activeSlideIndex: active, format: '3:4' });
  loadSlideIntoEditor(slides[active]);
};

const slideById = (id: string): SlideData => {
  const found = useCarousel.getState().slides.find((s) => s.id === id);
  if (!found) throw new Error(`slide ${id} não existe mais`);
  return found;
};

describe('auditoria: BUG-01 / BUG-01b / BUG-02', () => {
  beforeEach(() => {
    useCarousel.setState({ mode: null, slides: [], activeSlideIndex: 0, format: '3:4' });
  });

  it('BUG-01: reordenar tira a cópia órfã do palco também (sem fantasma selecionável)', () => {
    const a = slide('A', [text('e-a', 540)]);
    // B mostra a cópia da arte de C (dono à direita) e é a página do palco.
    const b = slide('B', [{ ...text('e1', 1120, true), crossFrom: 'C' } as El]);
    const c = slide('C', [text('e1', 40, true)]);

    install([a, b, c], 1);
    useEditor.setState({ step: 3 });

    useCarousel.getState().reorderSlides(2, 1); // [A, C, B] — a cópia de B perde o dono

    expect(slideById('B').doc.elements.some((el) => el.id === 'e1')).toBe(false);
    // O palco tem exatamente o doc do slide ativo (mesma referência).
    expect(useEditor.getState().doc).toBe(slideById('B').doc);
    // Reordenar não é troca de slide: a etapa continua onde estava.
    expect(useEditor.getState().step).toBe(3);
  });

  it('reordenar continua posicional: não materializa sangria na vizinha nova', () => {
    const a = slide('A', []);
    const b = slide('B', [text('e-b', 1030, true)]); // sangra para a direita
    const c = slide('C', []);

    install([a, b, c], 1); // palco em B, que passa a ter A à direita
    useCarousel.getState().reorderSlides(1, 0); // [B, A, C]

    expect(slideById('A').doc.elements).toHaveLength(0);
    expect(slideById('C').doc.elements).toHaveLength(0);
    expect(slideById('B').doc.elements.map((el) => el.id)).toEqual(['e-b']);
  });

  it('BUG-01b: cópia que não estava no doc anterior não reivindica a arte do dono', () => {
    const owner = slide('P', [text('e1', 1060, true)]);
    const page = slide('T', []);

    // Palco dessincronizado: chega uma cópia "arrastada para dentro" que o doc
    // anterior do slide não tinha. Pela posição nova ela cairia no dono vizinho.
    const staleCopy: El = { ...text('e1', 500, true), crossFrom: 'P' } as El;
    const out = syncCrossoverFromActiveSlide(
      [owner, page],
      1,
      page.doc,
      withElements(page, [staleCopy]).doc,
      page.finish,
      '3:4',
    );

    expect(out[0].doc.elements.map((el) => el.id)).toEqual(['e1']); // arte intacta
    expect(out[0].doc.elements[0].crossover).toBe(true);
    expect(out[1].doc.elements).toHaveLength(0); // cópia inventada descartada
  });

  it('cópia legítima arrastada para dentro ainda transfere a arte (não regride a Propriedade 22)', () => {
    const owner = slide('P', [text('e1', 1060, true)]);
    // Sangria do dono (à direita) aparece na página seguinte à esquerda: x = 1060 - 1080.
    const copy: El = { ...text('e1', -20, true), crossFrom: 'P' } as El;
    const page = slide('T', [copy]);

    const out = syncCrossoverFromActiveSlide(
      [owner, page],
      1,
      page.doc,
      withElements(page, [{ ...copy, x: 500 }]).doc,
      page.finish,
      '3:4',
    );

    expect(out[0].doc.elements).toHaveLength(0); // saiu do dono
    expect(out[1].doc.elements.map((el) => el.id)).toEqual(['e1']);
    expect(out[1].doc.elements[0].crossFrom).toBeUndefined(); // virou arte desta página
    expect(out[1].doc.elements[0].crossover).toBeUndefined();
  });

  it('BUG-02: logo em sangria não substitui a logo própria da vizinha', () => {
    const s1 = slide('S1', [logo('logo-1', 'paper', 1060, true)]);
    const s2 = slide('S2', [logo('logo-6', 'clean', 540)]);

    const out = syncCrossoverFromActiveSlide([s1, s2], 0, s1.doc, s1.doc, s1.finish, '3:4');
    expect(out[1].doc.elements.map((el) => el.id)).toEqual(['logo-6']);

    // Afastando a página, ela continua com a própria logo.
    const moved = pruneOrphanCrossoverCopies([out[1], out[0]], '3:4');
    expect(moved[0].doc.elements.map((el) => el.id)).toEqual(['logo-6']);
    expect(moved[1].doc.elements.map((el) => el.id)).toEqual(['logo-1']);
  });

  it('BUG-02: sem logo própria, a cópia continua sangrando na vizinha', () => {
    const s1 = slide('S1', [logo('logo-1', 'paper', 1060, true)]);
    const s2 = slide('S2', []);

    const out = syncCrossoverFromActiveSlide([s1, s2], 0, s1.doc, s1.doc, s1.finish, '3:4');
    expect(out[1].doc.elements.map((el) => el.id)).toEqual(['logo-1']);
    expect(out[1].doc.elements[0].crossFrom).toBe('S1');

    // E a normalização de carga mantém o par (dono + cópia) coerente.
    const normalized = normalizeCrossoverOwnership(out, '3:4');
    expect(normalized[1].doc.elements[0].crossFrom).toBe('S1');
  });
});
