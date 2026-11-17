/**
 * Imagens da área de transferência (Ctrl+V na folha).
 *
 * Só interessa arquivo de imagem: texto, HTML e afins são ignorados, para que
 * colar texto fora de um campo não faça nada. Prints e imagens copiadas do
 * navegador chegam como "image.png"; trocamos por um nome legível no painel.
 */

const GENERIC_NAME = /^image\.[a-z0-9]+$/i;

export interface ClipboardItemLike {
  readonly kind: string;
  readonly type: string;
  getAsFile(): File | null;
}

export interface ClipboardDataLike {
  readonly items?: ArrayLike<ClipboardItemLike> | Iterable<ClipboardItemLike> | null;
  readonly files?: ArrayLike<File> | Iterable<File> | null;
}

function extensionOf(type: string): string {
  const sub = type.split('/')[1]?.toLowerCase() ?? 'png';
  return sub === 'jpeg' ? 'jpg' : sub;
}

function withFriendlyName(file: File): File {
  if (file.name && !GENERIC_NAME.test(file.name)) return file;
  return new File([file], `Imagem colada.${extensionOf(file.type)}`, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

export function extractClipboardImageFiles(
  data: ClipboardDataLike | null | undefined,
): File[] {
  if (!data) return [];

  const found: File[] = [];
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== 'file' || !item.type.toLowerCase().startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) found.push(file);
  }

  // Alguns navegadores só preenchem `files` (ex.: arquivo copiado do explorador).
  if (found.length === 0) {
    for (const file of Array.from(data.files ?? [])) {
      if (file.type.toLowerCase().startsWith('image/')) found.push(file);
    }
  }

  return found.map(withFriendlyName);
}
