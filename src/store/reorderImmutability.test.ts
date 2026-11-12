import { beforeEach, describe, expect, it } from 'vitest';
import { useCarousel } from './carouselStore';
import { defaultFinish, emptyDoc, useEditor } from './editorStore';
import type { El, SlideData } from '../types';

/**
 * Regressão do relato "drag & drop de páginas corrompe o conteúdo":
 * reordenar é SÓ posicional. Docs, finishes, elementos e o próprio background
 * de cada página mantêm a identidade (mesmas referências).
 */

const decorationNearRightEdge = (id: string): El => ({
  id,
  kind: 'decoration',
  assetId: 'flores',
  x: 1030,
  y: 700,
  rotation: 0,
  scale: 1,
  flipX: false,
  flipY: false,
  crossover: true,
});

function slide(id: string, backgroundId: string | null, elements: El[]): SlideData {
  return {
    id,
    doc: { ...emptyDoc(), backgroundId, elements },
    finish: defaultFinish(),
  };
}

describe('reorderSlides — imutabilidade do conteúdo', () => {
  beforeEach(() => {
    const art = slide('A', 'pronto-1', [decorationNearRightEdge('el-1')]);
    const blank = slide('B', null, []);
    const other = slide('C', 'puro-2', []);
    useCarousel.setState({
      mode: 'carousel',
      slides: [art, blank, other],
      activeSlideIndex: 0,
      format: '3:4',
    });
    useEditor.setState({
      doc: art.doc,
      finish: art.finish,
      step: 0,
      selectedIds: [],
      selectedId: null,
      editingId: null,
    });
  });

  it('não materializa crossover nem move elementos entre páginas', () => {
    const before = useCarousel.getState().slides;

    // B (vazio) vai para antes de A, ficando ao lado da arte.
    useCarousel.getState().reorderSlides(1, 0);

    const after = useCarousel.getState().slides;
    expect(after.map((s) => s.id)).toEqual(['B', 'A', 'C']);

    // Cada slide é o MESMO objeto (mesmo doc, mesmo finish, mesmos elementos).
    for (const id of ['A', 'B', 'C']) {
      const prev = before.find((s) => s.id === id)!;
      const next = after.find((s) => s.id === id)!;
      expect(next).toBe(prev);
      expect(next.doc).toBe(prev.doc);
      expect(next.finish).toBe(prev.finish);
      expect(next.doc.elements).toBe(prev.doc.elements);
    }

    // O slide vazio que ficou ao lado da arte continua vazio.
    expect(after.find((s) => s.id === 'B')!.doc.elements).toHaveLength(0);
    expect(after.find((s) => s.id === 'A')!.doc.elements).toHaveLength(1);
  });

  it('não toca em background nem em elementos ao mover a página ativa', () => {
    const before = useCarousel.getState().slides;
    useCarousel.getState().reorderSlides(2, 0);

    const after = useCarousel.getState().slides;
    expect(after.map((s) => s.id)).toEqual(['C', 'A', 'B']);
    expect(useCarousel.getState().activeSlideIndex).toBe(1); // A continua ativa
    expect(after[1]).toBe(before[0]);
    expect(after[1].doc.backgroundId).toBe('pronto-1');
    expect(after[0].doc.backgroundId).toBe('puro-2');
  });

  it('reordenar para a mesma posição é no-op', () => {
    const before = useCarousel.getState().slides;
    useCarousel.getState().reorderSlides(1, 1);
    expect(useCarousel.getState().slides).toBe(before);
  });
});
