import { describe, expect, it } from 'vitest';
import { dedupeSlideElementIds } from './slideIds';
import { defaultFinish, emptyDoc } from '../store/editorStore';
import type { El, SlideData } from '../types';

const el = (id: string, crossover?: boolean): El => ({
  id,
  kind: 'text',
  style: 'title',
  text: 'TEXTO ' + id,
  x: 300,
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
  doc: { ...emptyDoc(), elements },
  finish: defaultFinish(),
});

describe('dedupeSlideElementIds', () => {
  it('renomeia ids repetidos sem flag de crossover (slides duplicados antigos)', () => {
    const a = slide('A', [el('e1'), el('e2')]);
    const b = slide('B', [el('e1'), el('e2')]);
    const [ra, rb] = dedupeSlideElementIds([a, b]);

    expect(ra).toBe(a); // primeiro slide não muda
    expect(rb).not.toBe(b);
    const ids = rb.doc.elements.map((e) => e.id);
    expect(ids).not.toContain('e1');
    expect(ids).not.toContain('e2');
    expect(new Set([...ra.doc.elements, ...rb.doc.elements].map((e) => e.id)).size).toBe(4);
  });

  it('preserva o par de crossover (mesmo id marcado)', () => {
    const a = slide('A', [el('x', true)]);
    const b = slide('B', [el('x', true)]);
    const out = dedupeSlideElementIds([a, b]);
    expect(out[0]).toBe(a);
    expect(out[1]).toBe(b);
    expect(out[0].doc.elements[0].id).toBe('x');
    expect(out[1].doc.elements[0].id).toBe('x');
  });

  it('preserva cópia marcada mesmo que a origem não esteja marcada', () => {
    const a = slide('A', [el('x')]);
    const b = slide('B', [el('x', true)]);
    const out = dedupeSlideElementIds([a, b]);
    expect(out[1].doc.elements[0].id).toBe('x');
  });

  it('não mexe em slides sem ids repetidos (mesmas referências)', () => {
    const a = slide('A', [el('a1')]);
    const b = slide('B', [el('b1')]);
    const out = dedupeSlideElementIds([a, b]);
    expect(out[0]).toBe(a);
    expect(out[1]).toBe(b);
  });
});
