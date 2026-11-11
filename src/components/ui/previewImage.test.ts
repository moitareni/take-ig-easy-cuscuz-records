import { describe, expect, it } from 'vitest';
import { resolvePreviewStatus } from './PreviewImage';

describe('resolvePreviewStatus', () => {
  it('sem src, a prévia está vazia (não é erro nem loading eterno)', () => {
    expect(resolvePreviewStatus(null, false, false)).toBe('empty');
    expect(resolvePreviewStatus(undefined, false, false)).toBe('empty');
  });

  it('com src e ainda sem onLoad, mostra o skeleton', () => {
    expect(resolvePreviewStatus('/brand/thumbs/deco-flores.webp', false, false)).toBe('loading');
  });

  it('só sai do loading depois do onLoad', () => {
    expect(resolvePreviewStatus('/brand/thumbs/deco-flores.webp', true, false)).toBe('loaded');
  });

  it('falha de decode cai no fallback, nunca no alt cru', () => {
    expect(resolvePreviewStatus('/brand/inexistente.webp', false, true)).toBe('error');
    expect(resolvePreviewStatus('/brand/inexistente.webp', true, true)).toBe('error');
  });
});
