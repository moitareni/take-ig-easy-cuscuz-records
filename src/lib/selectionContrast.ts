/**
 * Cor da seleção adaptativa.
 *
 * O amarelo da marca é a cor da caixa de seleção e do realce de texto, mas
 * sobre fundos amarelos (ou creme) ele desaparece por completo. Em vez de
 * trocar a identidade por uma cor "de sistema", a seleção lê o que está
 * ATRÁS do elemento — um anel de amostras em volta da caixa — e escolhe
 * entre o amarelo e o preto da paleta oficial: amarelo quando ele tem
 * contraste suficiente, preto quando o fundo é claro (amarelo, creme,
 * branco).
 *
 * A leitura é barata de propósito: poucos blocos de 4×4 px no canvas já
 * renderizado, sem redesenhar o palco e sem varrer a folha inteira.
 */
import { COLORS } from '../brand/brand';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SelectionAccent = 'amarelo' | 'preto';

export interface SelectionTheme {
  /** Cor do traço da caixa e do realce de texto. */
  accent: string;
  /** Texto sobre o realce — sempre em contraste com o accent. */
  onAccent: string;
  /** Contorno das alças: o oposto do accent, para a alça nunca sumir. */
  outline: string;
}

export const SELECTION_THEMES: Record<SelectionAccent, SelectionTheme> = {
  amarelo: { accent: COLORS.amarelo, onAccent: COLORS.preto, outline: COLORS.preto },
  preto: { accent: COLORS.preto, onAccent: COLORS.creme, outline: COLORS.creme },
};

export const DEFAULT_SELECTION_ACCENT: SelectionAccent = 'amarelo';

/** Contraste mínimo (WCAG) para a caixa continuar legível sobre o fundo. */
export const SELECTION_MIN_CONTRAST = 2.2;
/** Margem a favor do amarelo (cor da marca) quando os dois estão próximos. */
export const SELECTION_YELLOW_BIAS = 0.35;
/** Alfa média mínima da amostra: abaixo disso é área fora da folha. */
const MIN_SAMPLE_ALPHA = 96;

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminância relativa (WCAG 2.x). */
export function relativeLuminance(color: Rgb): number {
  return (
    0.2126 * channelLuminance(color.r) +
    0.7152 * channelLuminance(color.g) +
    0.0722 * channelLuminance(color.b)
  );
}

/** Razão de contraste WCAG entre duas cores (1 = iguais, 21 = preto × branco). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Escolhe o accent da seleção a partir das cores amostradas em volta do
 * elemento. Sem amostras (canvas ilegível, elemento fora da folha) fica o
 * amarelo, que é o padrão da marca.
 */
export function pickSelectionAccent(samples: readonly Rgb[]): SelectionAccent {
  if (samples.length === 0) return DEFAULT_SELECTION_ACCENT;

  const amarelo = hexToRgb(COLORS.amarelo);
  const preto = hexToRgb(COLORS.preto);
  let amareloScore = 0;
  let pretoScore = 0;
  for (const sample of samples) {
    amareloScore += contrastRatio(amarelo, sample);
    pretoScore += contrastRatio(preto, sample);
  }
  amareloScore /= samples.length;
  pretoScore /= samples.length;

  if (amareloScore >= SELECTION_MIN_CONTRAST) return 'amarelo';
  return pretoScore > amareloScore + SELECTION_YELLOW_BIAS ? 'preto' : DEFAULT_SELECTION_ACCENT;
}

/** Cresce (inset > 0) ou encolhe (inset < 0) um retângulo. */
function insetRect(rect: CanvasRect, inset: number): CanvasRect {
  return {
    x: rect.x - inset,
    y: rect.y - inset,
    width: rect.width + inset * 2,
    height: rect.height + inset * 2,
  };
}

/** Pontos igualmente espaçados sobre o perímetro de um retângulo. */
function ringPoints(rect: CanvasRect, count: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const { width: w, height: h } = rect;
  const perimeter = 2 * (w + h);
  if (perimeter <= 0 || count <= 0) return points;

  const step = perimeter / count;
  for (let i = 0; i < count; i++) {
    let s = step * (i + 0.5);
    if (s < w) {
      points.push({ x: rect.x + s, y: rect.y });
      continue;
    }
    s -= w;
    if (s < h) {
      points.push({ x: rect.x + w, y: rect.y + s });
      continue;
    }
    s -= h;
    if (s < w) {
      points.push({ x: rect.x + w - s, y: rect.y + h });
      continue;
    }
    s -= w;
    points.push({ x: rect.x, y: rect.y + h - s });
  }
  return points;
}

/** Média de um bloco já ponderada pelo alfa; null quando é área transparente. */
function readBlock(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  block: number,
): Rgb | null {
  const bx = Math.round(x - block / 2);
  const by = Math.round(y - block / 2);
  const x0 = Math.max(0, bx);
  const y0 = Math.max(0, by);
  const x1 = Math.min(canvas.width, bx + block);
  const y1 = Math.min(canvas.height, by + block);
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  } catch {
    // Canvas contaminado por imagem de outra origem: mantém o padrão da marca.
    return null;
  }

  let r = 0;
  let g = 0;
  let b = 0;
  let alpha = 0;
  let pixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    r += data[i] * a;
    g += data[i + 1] * a;
    b += data[i + 2] * a;
    alpha += a;
    pixels++;
  }
  if (pixels === 0 || alpha / pixels < MIN_SAMPLE_ALPHA / 255) return null;
  return { r: r / alpha, g: g / alpha, b: b / alpha };
}

export interface SampleOptions {
  /** Pontos ao redor da caixa (padrão 20). */
  points?: number;
  /** Lado do bloco lido em cada ponto, em px do canvas (padrão 4). */
  block?: number;
  /** Distância do anel em px do canvas (padrão 14). */
  offset?: number;
}

/**
 * Cores do ambiente da caixa (px do canvas, backing store). Primeiro o anel
 * de fora — o fundo de verdade em volta do elemento; se boa parte dele cair
 * fora da folha (transparente), tenta o anel de dentro.
 */
export function sampleSelectionColors(
  canvas: HTMLCanvasElement,
  rect: CanvasRect,
  options: SampleOptions = {},
): Rgb[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  if (rect.width < 1 || rect.height < 1) return [];

  const points = options.points ?? 20;
  const block = options.block ?? 4;
  const offset = options.offset ?? 14;
  const needed = Math.ceil(points / 2);

  let last: Rgb[] = [];
  for (const inset of [offset, -offset]) {
    const ring = insetRect(rect, inset);
    if (ring.width < 1 || ring.height < 1) continue;
    const samples: Rgb[] = [];
    for (const point of ringPoints(ring, points)) {
      const color = readBlock(ctx, canvas, point.x, point.y, block);
      if (color) samples.push(color);
    }
    if (samples.length >= needed) return samples;
    if (samples.length > last.length) last = samples;
  }
  return last;
}
