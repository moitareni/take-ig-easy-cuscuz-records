import { getBackground, getDecoration } from '../assets';
import {
  BORDER_TEXTURE_OPACITY_DEFAULT,
  BORDER_TEXTURE_OPACITY_MAX,
  BORDER_TEXTURE_OPACITY_MIN,
  FINISH_ENABLED_DEFAULT,
  GRAIN_INTENSITY_DEFAULT,
  GRAIN_INTENSITY_MAX,
  GRAIN_INTENSITY_MIN,
  GRAIN_SIZE_DEFAULT,
  GRAIN_SIZES,
  PAPER_OPACITY_DEFAULT,
  PAPER_OPACITY_MAX,
  PAPER_OPACITY_MIN,
  type PostFormat,
} from '../brand/brand';
import type { Doc, El, FinishState, SlideData, TextEl } from '../types';
import { isPersistedImage } from './imageRules';

export const VALID_FORMATS: readonly PostFormat[] = ['3:4', '4:3', '1:1'];

/** Gera identificador curto único para elementos e slides. */
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Prende e arredonda um inteiro dentro do intervalo `[min, max]`. */
export const clampInt = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(v)));

/** Type guard para formatos de post suportados. */
export function isPostFormat(value: unknown): value is PostFormat {
  return value === '3:4' || value === '4:3' || value === '1:1';
}

/** Valida e normaliza um formato de post, caindo no padrão `3:4`. */
export function sanitizeFormat(f: unknown): PostFormat {
  return isPostFormat(f) ? f : '3:4';
}

/** Documento vazio padrão (3:4). */
export const emptyDoc = (): Doc => ({
  format: '3:4',
  backgroundId: null,
  backgroundFlipX: false,
  backgroundFlipY: false,
  backgroundOffsetY: 180,
  elements: [],
});

/** Estado padrão de texturas e granulado (tudo desligado por padrão). */
export const defaultFinish = (): FinishState => ({
  paper: { enabled: FINISH_ENABLED_DEFAULT, opacity: PAPER_OPACITY_DEFAULT },
  grain: { enabled: FINISH_ENABLED_DEFAULT, intensity: GRAIN_INTENSITY_DEFAULT, size: GRAIN_SIZE_DEFAULT },
  borderTexture: { enabled: FINISH_ENABLED_DEFAULT, opacity: BORDER_TEXTURE_OPACITY_DEFAULT },
});

/** Valida o acabamento restaurado (rascunho antigo ou corrompido). */
export function sanitizeFinish(f: FinishState | undefined): FinishState {
  const d = defaultFinish();
  if (!f) return d;
  return {
    paper: {
      enabled: f.paper?.enabled === true,
      opacity:
        typeof f.paper?.opacity === 'number'
          ? clampInt(f.paper.opacity, PAPER_OPACITY_MIN, PAPER_OPACITY_MAX)
          : d.paper.opacity,
    },
    grain: {
      enabled: f.grain?.enabled === true,
      intensity:
        typeof f.grain?.intensity === 'number'
          ? clampInt(f.grain.intensity, GRAIN_INTENSITY_MIN, GRAIN_INTENSITY_MAX)
          : d.grain.intensity,
      size: f.grain?.size && f.grain.size in GRAIN_SIZES ? f.grain.size : d.grain.size,
    },
    borderTexture: {
      enabled: f.borderTexture?.enabled === true,
      opacity:
        typeof f.borderTexture?.opacity === 'number'
          ? clampInt(f.borderTexture.opacity, BORDER_TEXTURE_OPACITY_MIN, BORDER_TEXTURE_OPACITY_MAX)
          : d.borderTexture.opacity,
    },
  };
}

/** Normaliza largura positiva da caixa de texto; descarta valores inválidos. */
export const boxSize = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.max(1, Math.round(value));
};

function sanitizeTextElement(el: El): El {
  if (el.kind !== 'text') return el;
  const boxWidth = boxSize(el.boxWidth);
  // `boxHeight` de rascunhos antigos: a altura agora é sempre automática.
  const hasLegacyHeight = Object.prototype.hasOwnProperty.call(el, 'boxHeight');
  if (boxWidth === el.boxWidth && !hasLegacyHeight) return el;
  const next: TextEl = { ...el };
  if (boxWidth === undefined) delete next.boxWidth;
  else next.boxWidth = boxWidth;
  Reflect.deleteProperty(next, 'boxHeight');
  return next;
}

/** Remove referências a assets que não existem mais (ex.: asset apagado da pasta). */
export function sanitize(doc: Doc | undefined): Doc {
  if (!doc) return emptyDoc();
  const format = sanitizeFormat(doc.format);
  const backgroundOffsetY =
    typeof doc.backgroundOffsetY === 'number' && Number.isFinite(doc.backgroundOffsetY)
      ? Math.min(360, Math.max(0, Math.round(doc.backgroundOffsetY)))
      : 180;
  return {
    format,
    backgroundId: getBackground(doc.backgroundId) ? doc.backgroundId : null,
    backgroundFlipX: Boolean(doc.backgroundFlipX),
    backgroundFlipY: Boolean(doc.backgroundFlipY),
    backgroundOffsetY,
    elements: (doc.elements ?? [])
      .filter(
        (e) =>
          // Enfeite só fica se o asset do manifest existir.
          (e.kind !== 'decoration' || getDecoration(e.assetId)) &&
          // Imagem do usuário só fica com metadados completos (o blob vem do IndexedDB).
          (e.kind !== 'image' || isPersistedImage(e)),
      )
      .map(sanitizeTextElement),
  };
}

/** Cria um SlideData vazio no formato informado. */
export function defaultSlide(format: PostFormat = '3:4'): SlideData {
  return {
    id: uid(),
    doc: {
      ...emptyDoc(),
      format: sanitizeFormat(format),
    },
    finish: defaultFinish(),
  };
}

/** Valida e sanitiza um SlideData restaurado. */
export function sanitizeSlide(raw: unknown, fallbackFormat?: PostFormat): SlideData {
  if (!raw || typeof raw !== 'object') {
    return defaultSlide(sanitizeFormat(fallbackFormat));
  }
  const r = raw as Partial<SlideData>;
  const sanitizedDoc = sanitize(r.doc);
  const format = fallbackFormat
    ? sanitizeFormat(fallbackFormat)
    : r.doc?.format
      ? sanitizedDoc.format ?? '3:4'
      : '3:4';
  return {
    id: typeof r.id === 'string' && r.id.trim().length > 0 ? r.id : uid(),
    doc: {
      ...sanitizedDoc,
      format,
    },
    finish: sanitizeFinish(r.finish),
  };
}

/** Verifica se um slide está vazio (sem fundo, sem elementos e com acabamento padrão). */
export function isSlideEmpty(slide: SlideData): boolean {
  const df = defaultFinish();
  return (
    slide.doc.elements.length === 0 &&
    slide.doc.backgroundId === null &&
    slide.finish.paper.enabled === df.paper.enabled &&
    slide.finish.paper.opacity === df.paper.opacity &&
    slide.finish.grain.enabled === df.grain.enabled &&
    slide.finish.grain.intensity === df.grain.intensity &&
    slide.finish.grain.size === df.grain.size &&
    slide.finish.borderTexture.enabled === df.borderTexture.enabled &&
    slide.finish.borderTexture.opacity === df.borderTexture.opacity
  );
}

