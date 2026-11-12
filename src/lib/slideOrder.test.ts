import { describe, expect, it } from 'vitest';
import { dropPositionFromPointer, resolveReorderIndex } from './slideOrder';

describe('resolveReorderIndex', () => {
  it('soltar na metade direita da página 1 coloca a página arrastada como 2', () => {
    // 7 páginas, arrastando a última (6) para depois da primeira (0)
    expect(resolveReorderIndex(6, 0, 'after', 7)).toBe(1);
  });

  it('soltar na metade esquerda da página 1 coloca a página arrastada como 1', () => {
    expect(resolveReorderIndex(6, 0, 'before', 7)).toBe(0);
  });

  it('arrastar para frente desconta a remoção do próprio slide', () => {
    // [A,B,C,D]: A para depois de C -> [B,C,A,D]
    expect(resolveReorderIndex(0, 2, 'after', 4)).toBe(2);
    // A para antes de C -> [B,A,C,D]
    expect(resolveReorderIndex(0, 2, 'before', 4)).toBe(1);
  });

  it('arrastar para trás não desconta', () => {
    // [A,B,C,D]: D para antes de B -> [A,D,B,C]
    expect(resolveReorderIndex(3, 1, 'before', 4)).toBe(1);
  });

  it('soltar sobre o próprio slide nos dois lados não muda nada', () => {
    expect(resolveReorderIndex(2, 2, 'before', 4)).toBeNull();
    expect(resolveReorderIndex(2, 2, 'after', 4)).toBeNull();
  });

  it('ignora índices inválidos', () => {
    expect(resolveReorderIndex(-1, 0, 'before', 4)).toBeNull();
    expect(resolveReorderIndex(4, 0, 'before', 4)).toBeNull();
    expect(resolveReorderIndex(0, 4, 'after', 4)).toBeNull();
    expect(resolveReorderIndex(0.5, 0, 'before', 4)).toBeNull();
  });

  it('inserir no fim pelo lado direito do último slide funciona', () => {
    // [A,B,C]: A para depois de C -> [B,C,A]
    expect(resolveReorderIndex(0, 2, 'after', 3)).toBe(2);
  });
});

describe('dropPositionFromPointer', () => {
  const rect = { left: 100, width: 60 };

  it('metade esquerda = antes', () => {
    expect(dropPositionFromPointer(110, rect)).toBe('before');
  });

  it('metade direita = depois', () => {
    expect(dropPositionFromPointer(150, rect)).toBe('after');
  });
});
