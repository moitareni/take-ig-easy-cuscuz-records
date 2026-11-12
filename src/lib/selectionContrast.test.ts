import { describe, expect, it } from 'vitest';
import { COLORS } from '../brand/brand';
import {
  contrastRatio,
  hexToRgb,
  pickSelectionAccent,
  SELECTION_THEMES,
} from './selectionContrast';

describe('contrastRatio', () => {
  it('preto × branco é o máximo (21)', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 0);
  });

  it('a mesma cor tem contraste 1', () => {
    expect(contrastRatio(hexToRgb(COLORS.amarelo), hexToRgb(COLORS.amarelo))).toBeCloseTo(1, 6);
  });
});

describe('pickSelectionAccent', () => {
  const of = (hex: string) => [hexToRgb(hex)];

  it('sem amostras, mantém o amarelo da marca', () => {
    expect(pickSelectionAccent([])).toBe('amarelo');
  });

  it('fundo amarelo troca a seleção para preto', () => {
    expect(pickSelectionAccent(of(COLORS.amarelo))).toBe('preto');
  });

  it('fundo creme troca a seleção para preto', () => {
    expect(pickSelectionAccent(of(COLORS.creme))).toBe('preto');
  });

  it('fundo escuro mantém o amarelo', () => {
    expect(pickSelectionAccent(of(COLORS.preto))).toBe('amarelo');
  });

  it('fundo verde e barro mantêm o amarelo', () => {
    expect(pickSelectionAccent(of(COLORS.verde))).toBe('amarelo');
    expect(pickSelectionAccent(of(COLORS.barro))).toBe('amarelo');
  });

  it('metade amarela e metade escura mantém o amarelo', () => {
    expect(pickSelectionAccent([hexToRgb(COLORS.amarelo), hexToRgb(COLORS.preto)])).toBe('amarelo');
  });
});

describe('SELECTION_THEMES', () => {
  it('o texto do realce contrasta com o accent', () => {
    for (const theme of Object.values(SELECTION_THEMES)) {
      const ratio = contrastRatio(hexToRgb(theme.accent), hexToRgb(theme.onAccent));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
