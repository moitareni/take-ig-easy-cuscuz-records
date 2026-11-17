import { beforeEach, describe, expect, it } from 'vitest';
import { loadSlideIntoEditor, useCarousel } from './carouselStore';
import { defaultFinish, emptyDoc, useEditor } from './editorStore';
import { installEditorCarouselSync } from './syncEngine';
import type { El, SlideData } from '../types';

/**
 * Regressão do relatório "só consigo mexer no elemento pela página onde ele
 * nasceu" (13/11/2026).
 *
 * O elemento que fica entre duas páginas aparecia na vizinha (espelho), mas não
 * aceitava clique nem arraste até alguma ação materializar a cópia. Causa: o
 * dono era classificado como "cópia legada" assim que o centro dele passava da
 * borda da folha (`x < -0.5 || x > postW + 0.5`), então a vizinha nunca recebia
 * a cópia e uma cópia já existente congelava na posição antiga. O limite de
 * ±0,5 px em volta da borda é o que fazia o comportamento parecer aleatório.
 *
 * Cobre também a troca de página materializando a cópia que faltava (o espelho
 * não é clicável) e o lado do dono resolvido pela posse declarada (`crossFrom`),
 * não pelo `x` da cópia.
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

const image = (id: string, x: number, width: number, crossover?: boolean): El => ({
  id,
  kind: 'image',
  imageId: 'blob-1',
  name: 'foto',
  width,
  height: 400,
  flipX: false,
  flipY: false,
  x,
  y: 700,
  rotation: 0,
  scale: 1,
  ...(crossover === undefined ? {} : { crossover }),
});

const slide = (id: string, elements: El[]): SlideData => ({
  id,
  doc: { ...emptyDoc(), elements },
  finish: defaultFinish(),
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

const els = (id: string): El[] => slideById(id).doc.elements;
const copyIn = (slideId: string, elId: string): El | undefined =>
  els(slideId).find((el) => el.id === elId);

describe('crossover entre duas páginas (interação nas duas páginas)', () => {
  beforeEach(() => {
    useCarousel.setState({ mode: null, slides: [], activeSlideIndex: 0, format: '3:4' });
    useEditor.setState({
      doc: emptyDoc(),
      finish: defaultFinish(),
      step: 0,
      selectedIds: [],
      selectedId: null,
      editingId: null,
    });
  });

  it('dono com o centro fora da folha continua materializando a cópia na vizinha', () => {
    install([slide('A', [text('e1', 540)]), slide('B', [])], 0);

    useEditor.getState().updateElement('e1', { x: 1090, crossover: true });

    const copy = copyIn('B', 'e1');
    expect(copy).toBeDefined();
    expect(copy!.x).toBe(10);
    expect(copy!.crossFrom).toBe('A');
  });

  it('a cópia acompanha o dono mesmo depois de o centro passar da borda', () => {
    install([slide('A', [text('e1', 540)]), slide('B', [])], 0);

    useEditor.getState().updateElement('e1', { x: 1000, crossover: true });
    expect(copyIn('B', 'e1')!.x).toBe(-80);

    useEditor.getState().updateElement('e1', { x: 1100 });
    expect(copyIn('B', 'e1')!.x).toBe(20);

    useEditor.getState().updateElement('e1', { x: 1150 });
    expect(copyIn('B', 'e1')!.x).toBe(70);
    expect(copyIn('B', 'e1')!.crossFrom).toBe('A');
    expect(els('A')[0].crossover).toBe(true);
  });

  it('sangria à esquerda: centro fora pela esquerda ainda materializa na página anterior', () => {
    install([slide('A', []), slide('B', [text('e1', 540)]), slide('C', [])], 1);

    useEditor.getState().updateElement('e1', { x: -10, crossover: true });

    const copy = copyIn('A', 'e1');
    expect(copy).toBeDefined();
    expect(copy!.x).toBe(1070);
    expect(copy!.crossFrom).toBe('B');
  });

  it('cópia legada de verdade (com par dono/cópia na vizinhança) continua inerte', () => {
    const a = slide('A', [text('e1', 1030, true)]);
    const b = slide('B', [{ ...text('e1', -50, true) }]);
    install([a, b], 1);

    useEditor.getState().updateElement('e1', { y: 600 });

    // Não colonizou o dono nem criou uma segunda cópia.
    expect(els('A')).toHaveLength(1);
    expect(els('A')[0].x).toBe(1030);
    expect(els('A')[0].crossFrom).toBeUndefined();
    expect(els('B')).toHaveLength(1);
    expect(els('B')[0].crossFrom).toBeUndefined();
  });

  it('trocar de página materializa a cópia que faltava (fim do fantasma não clicável)', () => {
    // Estado "fantasma": o dono está fora da folha e a vizinha só tem o espelho.
    const a = slide('A', [text('e1', 1090, true)]);
    const b = slide('B', []);
    useCarousel.setState({ mode: 'carousel', slides: [a, b], activeSlideIndex: 0, format: '3:4' });
    loadSlideIntoEditor(a);
    expect(els('B')).toHaveLength(0);

    useCarousel.getState().setActiveSlide(1);

    expect(els('B').map((el) => el.id)).toEqual(['e1']);
    expect(copyIn('B', 'e1')!.crossFrom).toBe('A');
    expect(copyIn('B', 'e1')!.x).toBe(10);
    // O palco tem o MESMO doc da página: a cópia é clicável e arrastável.
    expect(useEditor.getState().doc).toBe(slideById('B').doc);
  });

  it('cópia larga arrastada com o centro além de postW/2 ainda espelha para o dono declarado', () => {
    // Imagem de 3000 px: continua cruzando a borda mesmo com o centro à direita.
    const owner = image('e1', 1000, 3000, true);
    const a = slide('A', [owner]);
    const b = slide('B', [{ ...owner, x: -80, crossFrom: 'A' } as El]);
    install([a, b], 1);

    useEditor.getState().updateElement('e1', { x: 700 });
    expect(els('A')[0].x).toBe(1780);
    expect(copyIn('B', 'e1')).toBeDefined();

    // Segunda edição: o centro agora passa de postW/2 — antes a cópia era
    // descartada em silêncio porque o lado vinha do `x`.
    useEditor.getState().updateElement('e1', { x: 1200 });
    expect(copyIn('B', 'e1')).toBeDefined();
    expect(copyIn('B', 'e1')!.crossFrom).toBe('A');
    expect(els('A')[0].x).toBe(2280);
  });

  it('arrastar a arte INTEIRA para fora entrega a posse à vizinha (sem sumir das duas páginas)', () => {
    install([slide('A', []), slide('B', [text('e1', 540)]), slide('C', [])], 1);

    // 1. sangra parcialmente para a esquerda: cópia em A
    useEditor.getState().updateElement('e1', { x: 80, crossover: true });
    expect(copyIn('A', 'e1')!.x).toBe(1160);

    // 2. arrasta 100% para fora (além da Zona de Sangria)
    useEditor.getState().updateElement('e1', { x: -200 });

    expect(els('B')).toHaveLength(0); // saiu da origem
    expect(els('A').map((el) => el.id)).toEqual(['e1']); // entrou no destino…
    expect(els('A')[0].x).toBe(880); // …com coordenada local do novo slide
    expect(els('A')[0].crossFrom).toBeUndefined();
    expect(els('A')[0].crossover).toBeUndefined();
    expect(els('C')).toHaveLength(0);
    // O palco não guarda fantasma: o doc ativo é o do slide sem o elemento.
    expect(useEditor.getState().doc.elements).toHaveLength(0);
    expect(useEditor.getState().doc).toBe(slideById('B').doc);
  });

  it('handoff para a direita numa página do meio', () => {
    install([slide('A', []), slide('B', [text('e1', 540)]), slide('C', [])], 1);

    useEditor.getState().updateElement('e1', { x: 1000, crossover: true });
    expect(copyIn('C', 'e1')!.x).toBe(-80);

    useEditor.getState().updateElement('e1', { x: 1300 });

    expect(els('B')).toHaveLength(0);
    expect(els('C').map((el) => el.id)).toEqual(['e1']);
    expect(els('C')[0].x).toBe(220);
    expect(els('C')[0].crossFrom).toBeUndefined();
  });

  it('cópia arrastada para fora pelo lado oposto entrega a arte àquela vizinha', () => {
    const owner = text('e1', 1060, true);
    const a = slide('A', [owner]);
    const b = slide('B', [{ ...owner, x: -20, crossFrom: 'A' } as El]);
    const c = slide('C', []);
    install([a, b, c], 1);

    useEditor.getState().updateElement('e1', { x: 1300 });

    expect(els('B')).toHaveLength(0); // a cópia saiu
    expect(els('A')).toHaveLength(0); // a arte saiu do dono antigo
    expect(els('C').map((el) => el.id)).toEqual(['e1']); // agora é de C
    expect(els('C')[0].x).toBe(220);
    expect(els('C')[0].crossFrom).toBeUndefined();
  });

  it('sem vizinha daquele lado não há handoff (a arte continua na página)', () => {
    install([slide('A', [text('e1', 540)]), slide('B', [])], 0);

    useEditor.getState().updateElement('e1', { x: -200 });

    expect(els('A').map((el) => el.id)).toEqual(['e1']);
    expect(els('A')[0].x).toBe(-200);
  });
});
