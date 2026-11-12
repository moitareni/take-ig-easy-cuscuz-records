import { beforeEach, describe, expect, it } from 'vitest';
import { loadSlideIntoEditor, useCarousel } from './carouselStore';
import { defaultFinish, emptyDoc, useEditor } from './editorStore';
import type { El, SlideData } from '../types';

/**
 * Regressão do relatório de reordenação/duplicação de páginas: elementos de
 * páginas diferentes nunca podem ser confundidos por terem o mesmo `id`.
 * O crossover usa id entre vizinhas — todo o resto precisa ser isolado.
 */

const text = (id: string, x = 300, crossover?: boolean): El => ({
  id,
  kind: 'text',
  style: 'title',
  text: 'TEXTO ' + id,
  x,
  y: 700,
  rotation: 0,
  scale: 1,
  crossover,
  fontSize: 120,
  lineHeight: 1,
  letterSpacing: 0,
  align: 'center',
  uppercase: true,
  color: 'preto',
  brandEffect: false,
  border: 'none',
});

const slide = (id: string, elements: El[]): SlideData => ({
  id,
  doc: { ...emptyDoc(), backgroundId: 'pronto-1', elements },
  finish: defaultFinish(),
});

function reset(slides: SlideData[], active = 0): void {
  useCarousel.setState({
    mode: 'carousel',
    slides,
    activeSlideIndex: active,
    format: '3:4',
    isExporting: false,
    exportProgress: null,
  });
  useEditor.setState({
    doc: slides[active].doc,
    finish: slides[active].finish,
    step: 0,
    selectedIds: [],
    selectedId: null,
    editingId: null,
  });
}

/** Reproduz o que o subscriber de main.tsx faz após carregar/editar um slide. */
function syncActive(): void {
  const c = useCarousel.getState();
  const slide = c.slides[c.activeSlideIndex];
  loadSlideIntoEditor(slide);
  c.updateActiveSlide(slide.doc, slide.finish);
}

describe('integridade de elementos entre slides', () => {
  beforeEach(() => {
    reset([slide('A', [])]);
  });

  it('duplicateSlide gera ids novos e ativar o original não apaga a cópia', () => {
    reset([slide('A', [text('e1')])]);
    useCarousel.getState().duplicateSlide(0);

    const [original, duplicated] = useCarousel.getState().slides;
    expect(duplicated.doc.elements[0].id).not.toBe(original.doc.elements[0].id);

    useCarousel.getState().setActiveSlide(0);
    syncActive();

    expect(useCarousel.getState().slides[1].doc.elements).toHaveLength(1);
  });

  it('legado: id repetido sem crossover não é removido da página vizinha ao ativar', () => {
    reset([slide('A', [text('e1')]), slide('B', [text('e1')])]);

    syncActive();

    const [, b] = useCarousel.getState().slides;
    expect(b.doc.elements.map((e) => e.id)).toEqual(['e1']);
  });

  it('legado: apagar um elemento não apaga o homônimo real da vizinha', () => {
    const a = slide('A', [text('e1'), text('e2')]);
    reset([a, slide('B', [text('e1')])]);

    const withoutE1 = { ...a.doc, elements: a.doc.elements.filter((e) => e.id !== 'e1') };
    useCarousel.getState().updateActiveSlide(withoutE1, a.finish);

    const [, b] = useCarousel.getState().slides;
    expect(b.doc.elements.map((e) => e.id)).toEqual(['e1']);
  });

  it('não sobrescreve elemento real da vizinha com uma cópia crossover de mesmo id', () => {
    const nearRight = text('e1', 1030, true);
    reset([slide('A', [nearRight]), slide('B', [text('e1', 300)])]);

    // A edição faz A sangrar para a direita; a vizinha tem outro elemento real
    // com o mesmo id (estado legado) e precisa ser preservada.
    syncActive();

    const [, b] = useCarousel.getState().slides;
    expect(b.doc.elements).toHaveLength(1);
    expect(b.doc.elements[0].x).toBe(300);
    expect(b.doc.elements[0].crossover).toBeUndefined();
  });

  it('crossover marcado continua sendo sincronizado e limpo ao afastar da borda', () => {
    const origin = text('x', 1030, true);
    reset([
      slide('A', [origin]),
      slide('B', [{ ...origin, x: -50, crossover: true }]),
    ]);

    const moved = { ...useCarousel.getState().slides[0].doc, elements: [{ ...origin, x: 540 }] };
    useCarousel.getState().updateActiveSlide(moved, defaultFinish());

    const [a, b] = useCarousel.getState().slides;
    expect(b.doc.elements).toHaveLength(0); // cópia removida
    expect(a.doc.elements[0].crossover).toBeUndefined(); // flag limpa no dono
  });
});
