import type { PostFormat } from '../../brand/brand';
import type { Doc, FinishState, SlideData } from '../../types';

export type DraftKind = 'single' | 'carousel';
export type TitleSource = 'auto' | 'user';

/** Versão do schema do rascunho. Independente da versão do IndexedDB. */
export const DRAFT_SCHEMA_VERSION = 2;

export const DRAFT_KINDS: DraftKind[] = ['single', 'carousel'];

export interface DraftMeta {
  id: string;
  title: string;
  /** 'user' congela o título renomeado; 'auto' acompanha o primeiro texto do post. */
  titleSource: TitleSource;
  kind: DraftKind;
  format: PostFormat;
  /** 1 no post único; quantidade de slides no carrossel. */
  slideCount: number;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number | null;
  schemaVersion: typeof DRAFT_SCHEMA_VERSION;
}

export interface SingleDraftBody {
  id: string;
  kind: 'single';
  doc: Doc;
  finish: FinishState;
  schemaVersion: typeof DRAFT_SCHEMA_VERSION;
}

export interface CarouselDraftBody {
  id: string;
  kind: 'carousel';
  slides: SlideData[];
  activeSlideIndex: number;
  format: PostFormat;
  applyFinishToAll?: boolean;
  schemaVersion: typeof DRAFT_SCHEMA_VERSION;
}

export type DraftBody = SingleDraftBody | CarouselDraftBody;

export interface DraftRecord {
  meta: DraftMeta;
  body: DraftBody;
}

/** Capa da lista: blob WebP pequeno, separado dos metadados para a home listar rápido. */
export interface DraftCoverRecord {
  id: string;
  blob: Blob;
  updatedAt: number;
}

export interface StoredMetaRecord<T = unknown> {
  key: string;
  value: T;
  updatedAt: number;
}

export function isDraftKind(value: unknown): value is DraftKind {
  return value === 'single' || value === 'carousel';
}

export function isTitleSource(value: unknown): value is TitleSource {
  return value === 'auto' || value === 'user';
}

export function newDraftId(): string {
  const cryptoApi = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `draft-${cryptoApi.randomUUID()}`;
  }
  return `draft-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function newSlideId(): string {
  const cryptoApi = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `slide-${cryptoApi.randomUUID()}`;
  }
  return `slide-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
