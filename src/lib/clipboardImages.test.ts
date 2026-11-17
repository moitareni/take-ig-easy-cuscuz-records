import { describe, expect, it } from 'vitest';
import { extractClipboardImageFiles, type ClipboardDataLike, type ClipboardItemLike } from './clipboardImages';

const file = (name: string, type: string) => new File(['x'], name, { type });

const item = (kind: string, type: string, f: File | null): ClipboardItemLike => ({
  kind,
  type,
  getAsFile: () => f,
});

function data(items: ClipboardItemLike[], files: File[] = []): ClipboardDataLike {
  return { items, files };
}

describe('extractClipboardImageFiles', () => {
  it('devolve vazio sem área de transferência ou sem imagem', () => {
    expect(extractClipboardImageFiles(null)).toEqual([]);
    expect(extractClipboardImageFiles(undefined)).toEqual([]);
    expect(extractClipboardImageFiles(data([item('string', 'text/plain', null)]))).toEqual([]);
    expect(extractClipboardImageFiles(data([item('file', 'application/pdf', file('a.pdf', 'application/pdf'))]))).toEqual([]);
  });

  it('pega a imagem e ignora o texto/html que vem junto (cópia de imagem de página)', () => {
    const png = file('image.png', 'image/png');
    const out = extractClipboardImageFiles(
      data([item('string', 'text/html', null), item('file', 'image/png', png)]),
    );
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('image/png');
  });

  it('dá nome amigável ao print genérico "image.png"', () => {
    const out = extractClipboardImageFiles(data([item('file', 'image/png', file('image.png', 'image/png'))]));
    expect(out[0].name).toBe('Imagem colada.png');
  });

  it('mantém o nome de arquivos copiados do explorador', () => {
    const out = extractClipboardImageFiles(data([item('file', 'image/jpeg', file('foto-show.jpg', 'image/jpeg'))]));
    expect(out[0].name).toBe('foto-show.jpg');
  });

  it('usa clipboard.files quando items não traz imagem', () => {
    const jpg = file('capa.jpg', 'image/jpeg');
    const out = extractClipboardImageFiles(data([], [jpg]));
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('capa.jpg');
  });

  it('não duplica quando items e files trazem a mesma imagem', () => {
    const png = file('capa.png', 'image/png');
    const out = extractClipboardImageFiles(data([item('file', 'image/png', png)], [png]));
    expect(out).toHaveLength(1);
  });
});
