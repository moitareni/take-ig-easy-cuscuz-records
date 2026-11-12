/**
 * Álgebra pura do redimensionamento da ÁREA de texto.
 *
 * A área tem **só largura**: a altura é sempre automática (conteúdo + largura).
 * As alças mudam exclusivamente `boxWidth`; a fonte nunca é alterada.
 *
 * Convenção: `x,y` do elemento é o **centro** da caixa e o delta chega no
 * espaço local do elemento (px do post, sem rotação). A alça oposta fica
 * presa: ao crescer para a direita, o centro anda metade do crescimento.
 */

export type TextBoxHandle = 'e' | 'w';

export interface TextBoxStart {
  width: number;
  x: number;
  y: number;
  rotation: number;
}

export interface TextBoxPatch {
  boxWidth: number;
  x: number;
  y: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Converte o arraste de uma alça lateral em nova largura/posição da área.
 * `dxLocal` é o deslocamento em px do post, no referencial local.
 */
export function resizeTextBoxWidth(
  start: TextBoxStart,
  handle: TextBoxHandle,
  dxLocal: number,
  minWidth: number,
): TextBoxPatch {
  const rawWidth = start.width + (handle === 'e' ? dxLocal : -dxLocal);
  const width = Math.max(Math.max(1, minWidth), rawWidth);
  const shiftX = handle === 'e' ? (width - start.width) / 2 : -(width - start.width) / 2;

  const rad = (start.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return {
    // Largura inteira, como o resto do doc (px do post).
    boxWidth: Math.max(1, Math.round(width)),
    x: round2(start.x + shiftX * cos),
    y: round2(start.y + shiftX * sin),
  };
}

/** Converte um delta de tela em delta local (px do post, sem rotação). */
export function screenDeltaToLocal(
  dxScreen: number,
  dyScreen: number,
  rotation: number,
  scaleRatio: number,
): { dx: number; dy: number } {
  const scale = scaleRatio > 0 ? scaleRatio : 1;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    dx: (dxScreen * cos + dyScreen * sin) / scale,
    dy: (-dxScreen * sin + dyScreen * cos) / scale,
  };
}
