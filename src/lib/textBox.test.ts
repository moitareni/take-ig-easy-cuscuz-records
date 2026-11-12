import { describe, expect, it } from 'vitest';
import { resizeTextBoxWidth, screenDeltaToLocal } from './textBox';

const START = { width: 300, x: 500, y: 700, rotation: 0 };
const MIN_W = 16;

describe('resizeTextBoxWidth', () => {
  it('arrastar a alça direita cresce a largura e anda metade para a direita', () => {
    const r = resizeTextBoxWidth(START, 'e', 100, MIN_W);
    expect(r.boxWidth).toBe(400);
    expect(r.x).toBe(550);
    expect(r.y).toBe(700);
  });

  it('arrastar a alça esquerda para a esquerda cresce mantendo a borda direita', () => {
    const r = resizeTextBoxWidth(START, 'w', -100, MIN_W);
    expect(r.boxWidth).toBe(400);
    expect(r.x).toBe(450);
  });

  it('arrastar a alça esquerda para a direita encolhe mantendo a borda direita', () => {
    const r = resizeTextBoxWidth(START, 'w', 100, MIN_W);
    expect(r.boxWidth).toBe(200);
    expect(r.x).toBe(550);
  });

  it('nunca encolhe abaixo do mínimo', () => {
    const r = resizeTextBoxWidth(START, 'w', 1000, MIN_W);
    expect(r.boxWidth).toBe(MIN_W);
    expect(r.y).toBe(700);
  });

  it('não altera a altura (que é automática)', () => {
    const r = resizeTextBoxWidth(START, 'e', 100, MIN_W);
    expect(r).not.toHaveProperty('boxHeight');
  });

  it('com rotação 90°, o centro anda no eixo local girado', () => {
    const r = resizeTextBoxWidth({ ...START, rotation: 90 }, 'e', 100, MIN_W);
    expect(r.boxWidth).toBe(400);
    expect(r.x).toBe(500);
    expect(r.y).toBe(750);
  });
});

describe('screenDeltaToLocal', () => {
  it('sem rotação, só divide pela escala', () => {
    expect(screenDeltaToLocal(100, 50, 0, 2)).toEqual({ dx: 50, dy: 25 });
  });

  it('com rotação 90°, projeta o delta nos eixos locais', () => {
    const r = screenDeltaToLocal(100, 0, 90, 2);
    expect(r.dx).toBeCloseTo(0, 6);
    expect(r.dy).toBeCloseTo(-50, 6);
  });

  it('escala inválida não divide por zero', () => {
    expect(screenDeltaToLocal(10, 0, 0, 0)).toEqual({ dx: 10, dy: 0 });
  });
});
