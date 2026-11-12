import Konva from 'konva';
import { BORDER_PAD, FONT_BODY, FONT_HEADLINE } from '../brand/brand';
import type { TextEl } from '../types';

/**
 * Medida da área de texto, calculada com a MESMA engine do canvas (Konva
 * Text) e de forma síncrona no render. Nada aqui depende de ref, de seleção
 * ou de um efeito posterior: a caixa de destaque e a área de edição já nascem
 * com as dimensões certas na montagem do slide (AGENTS.md, correção do
 * "texto cortado / tarja colapsada").
 *
 * Semântica:
 * - Só a **largura** da área é definida (`boxWidth`), em px úteis (sem os pads).
 * - `undefined` = área automática: a largura natural do conteúdo define a
 *   caixa e o texto não quebra sozinho (só nas quebras manuais com Enter).
 * - Com área definida, o texto quebra em `boxWidth`.
 * - A **altura é sempre a do conteúdo** (auto-height): cresce e diminui com as
 *   linhas, nunca é definida manualmente e nunca corta o texto.
 */
export interface TextLayout {
  /** Largura útil da área em px do post. */
  contentWidth: number;
  /** Altura do conteúdo em px do post (sem os pads) — é a altura da caixa. */
  contentHeight: number;
  /** Largura de quebra (null = área automática, sem quebra automática). */
  wrapWidth: number | null;
  /** Pads da caixa de destaque em px do post. */
  padX: number;
  padY: number;
  /** Caixa externa (conteúdo + pads), usada pela tarja e pelo offset do grupo. */
  outerWidth: number;
  outerHeight: number;
  displayText: string;
  fontFamily: string;
  fontStyle: string;
}

const isHeadline = (el: TextEl) => el.style !== 'body';

const roundUp = (n: number) => Math.max(1, Math.ceil(n));

let measurer: Konva.Text | null = null;

function getMeasurer(): Konva.Text | null {
  if (typeof document === 'undefined') return null;
  if (!measurer) measurer = new Konva.Text({});
  return measurer;
}

/** Fallback sem canvas (SSR/testes): estimativa determinística. */
function estimateLayout(
  el: TextEl,
  displayText: string,
  wrapWidth: number | null,
): { contentWidth: number; contentHeight: number } {
  const perChar = el.fontSize * 0.62 + el.letterSpacing;
  const lines = displayText.split('\n');
  const longest = Math.max(1, ...lines.map((line) => line.length));
  const naturalWidth = Math.max(el.fontSize * 1.5, longest * perChar);

  if (wrapWidth === null) {
    return {
      contentWidth: naturalWidth,
      contentHeight: Math.max(1, lines.length) * el.fontSize * el.lineHeight,
    };
  }

  let wrappedLines = 0;
  for (const line of lines) {
    const charsPerLine = Math.max(1, Math.floor(wrapWidth / Math.max(1, perChar)));
    wrappedLines += Math.max(1, Math.ceil(line.length / charsPerLine));
  }
  return {
    contentWidth: wrapWidth,
    contentHeight: Math.max(1, wrappedLines) * el.fontSize * el.lineHeight,
  };
}

export function measureTextLayout(el: TextEl): TextLayout {
  const padX = el.border !== 'none' ? el.fontSize * BORDER_PAD.x : 0;
  const padY = el.border !== 'none' ? el.fontSize * BORDER_PAD.y : 0;
  const raw = el.text || ' ';
  const displayText = el.uppercase ? raw.toUpperCase() : raw;
  const wrapWidth =
    el.boxWidth !== undefined && el.boxWidth > 0 ? Math.max(1, Math.round(el.boxWidth)) : null;
  const fontFamily = isHeadline(el) ? FONT_HEADLINE : FONT_BODY;
  const fontStyle = isHeadline(el) ? '900' : 'bold';

  let measured: { contentWidth: number; contentHeight: number };
  const node = getMeasurer();

  if (node) {
    node.setAttrs({
      text: displayText,
      fontFamily,
      fontStyle,
      fontSize: el.fontSize,
      lineHeight: el.lineHeight,
      letterSpacing: el.letterSpacing,
      align: el.align,
      wrap: 'word',
      padding: 0,
      width: wrapWidth ?? 'auto',
      height: 'auto',
    });
    measured = {
      // Com largura definida, a área é exatamente a largura de quebra.
      contentWidth: wrapWidth ?? roundUp(node.getWidth()),
      contentHeight: roundUp(node.getHeight()),
    };
  } else {
    measured = estimateLayout(el, displayText, wrapWidth);
  }

  return {
    contentWidth: measured.contentWidth,
    contentHeight: measured.contentHeight,
    wrapWidth,
    padX,
    padY,
    outerWidth: measured.contentWidth + padX * 2,
    outerHeight: measured.contentHeight + padY * 2,
    displayText,
    fontFamily,
    fontStyle,
  };
}
