import type { Doc, FinishState, SlideData } from '../../types';
import type { DraftBody, DraftKind } from './types';

const MONTHS_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/** Placeholders dos presets de texto não servem como título automático. */
const PLACEHOLDER_TEXTS = new Set([
  'Título aqui',
  'Titulo aqui',
  'Escreva seu texto aqui',
  'Destaque',
]);

const AUTO_TITLE_MAX = 46;

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function firstUsefulText(doc: Doc): string | null {
  for (const el of doc.elements) {
    if (el.kind !== 'text') continue;
    const text = cleanText(el.text);
    if (text.length === 0 || PLACEHOLDER_TEXTS.has(text)) continue;
    return text;
  }
  return null;
}

export function isFinishEnabled(finish: FinishState): boolean {
  return finish.paper.enabled || finish.grain.enabled || finish.borderTexture.enabled;
}

export function isDocMeaningful(doc: Doc, finish: FinishState): boolean {
  return doc.backgroundId !== null || doc.elements.length > 0 || isFinishEnabled(finish);
}

export function isSlideMeaningful(slide: SlideData): boolean {
  return isDocMeaningful(slide.doc, slide.finish);
}

/** Um rascunho vazio nunca vai para o histórico. */
export function isBodyMeaningful(body: DraftBody): boolean {
  if (body.kind === 'single') return isDocMeaningful(body.doc, body.finish);
  return body.slides.some(isSlideMeaningful);
}

export function autoTitleFromBody(body: DraftBody): string | null {
  if (body.kind === 'single') return firstUsefulText(body.doc);
  for (const slide of body.slides) {
    const text = firstUsefulText(slide.doc);
    if (text) return text;
  }
  return null;
}

export function truncateTitle(text: string): string {
  const clean = cleanText(text);
  if (clean.length <= AUTO_TITLE_MAX) return clean;
  return `${clean.slice(0, AUTO_TITLE_MAX - 1).trimEnd()}…`;
}

export function defaultDraftTitle(kind: DraftKind, date = new Date()): string {
  const base = kind === 'carousel' ? 'Carrossel' : 'Post';
  return `${base} de ${date.getDate()} de ${MONTHS_PT[date.getMonth()]}`;
}

/** Título que o card mostra: texto do primeiro título/texto do post ou o nome padrão. */
export function buildAutoTitle(body: DraftBody, kind: DraftKind, createdAt: number): string {
  const fromContent = autoTitleFromBody(body);
  if (fromContent) return truncateTitle(fromContent);
  return defaultDraftTitle(kind, new Date(createdAt));
}
