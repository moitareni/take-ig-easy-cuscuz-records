import { sanitizeFormat } from '../../store/carouselStore';
import { buildAutoTitle, isBodyMeaningful } from './content';
import { getMetaValue, sanitizeDraftBody, saveDraftRecords, setMetaValue } from './repository';
import {
  DRAFT_SCHEMA_VERSION,
  type DraftBody,
  type DraftMeta,
  type DraftRecord,
} from './types';

/** Chaves gravadas pelo persist do Zustand nas versões anteriores. Não são apagadas: são o rollback. */
export const LEGACY_SINGLE_KEY = 'cuscuz-insta-kit:rascunho';
export const LEGACY_CAROUSEL_KEY = 'cuscuz-insta-kit:carrossel';
export const LEGACY_MIGRATION_KEY = 'legacyMigration';
export const LEGACY_RAW_SINGLE_KEY = 'legacyRaw:single';
export const LEGACY_RAW_CAROUSEL_KEY = 'legacyRaw:carousel';

export const LEGACY_SINGLE_DRAFT_ID = 'draft-legacy-single';
export const LEGACY_CAROUSEL_DRAFT_ID = 'draft-legacy-carousel';

export interface LegacyMigrationMarker {
  done: boolean;
  at: number;
  draftIds: string[];
}

export interface MigrationResult {
  migrated: number;
  skipped: boolean;
  draftIds: string[];
}

interface LegacyCarouselState {
  slides?: unknown;
  activeSlideIndex?: unknown;
  format?: unknown;
  mode?: unknown;
}

interface LegacySingleState {
  doc?: unknown;
  finish?: unknown;
}

interface LegacyEnvelope<T> {
  state?: T;
  version?: number;
}

interface RawLegacy<T> {
  raw: string;
  state: T | null;
}

function readLegacy<T>(key: string): RawLegacy<T> | null {
  if (typeof localStorage === 'undefined') return null;

  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as LegacyEnvelope<T> | T;
    if (parsed && typeof parsed === 'object' && 'state' in parsed) {
      return { raw, state: (parsed as LegacyEnvelope<T>).state ?? null };
    }
    return { raw, state: parsed as T };
  } catch {
    return { raw, state: null };
  }
}

function bodyFingerprint(body: DraftBody): string {
  if (body.kind === 'single') return JSON.stringify({ doc: body.doc, finish: body.finish });
  return JSON.stringify({ slides: body.slides, format: body.format });
}

/** O post único pode ser um resto do momento anterior à conversão para carrossel. */
function duplicatesCarousel(singleBody: DraftBody | null, carouselBody: DraftBody | null): boolean {
  if (!singleBody || singleBody.kind !== 'single') return false;
  if (!carouselBody || carouselBody.kind !== 'carousel') return false;
  const singlePrint = bodyFingerprint(singleBody);
  return carouselBody.slides.some((slide) =>
    bodyFingerprint({
      id: 'comparison',
      kind: 'single',
      doc: slide.doc,
      finish: slide.finish,
      schemaVersion: DRAFT_SCHEMA_VERSION,
    }) === singlePrint,
  );
}

/**
 * Migra os rascunhos do localStorage para o IndexedDB v2.
 *
 * - Idempotente: os IDs são fixos e `saveDraftRecords` faz upsert.
 * - Copia as strings cruas para `meta` antes de interpretar (rollback real).
 * - Só marca como concluída depois de gravar todos os documentos.
 * - Nunca apaga as chaves antigas nesta versão.
 */
export async function migrateLegacyDrafts(): Promise<MigrationResult> {
  const marker = await getMetaValue<LegacyMigrationMarker>(LEGACY_MIGRATION_KEY);
  if (marker?.done) {
    return { migrated: 0, skipped: true, draftIds: marker.draftIds };
  }

  const single = readLegacy<LegacySingleState>(LEGACY_SINGLE_KEY);
  const carousel = readLegacy<LegacyCarouselState>(LEGACY_CAROUSEL_KEY);

  if (!single && !carousel) {
    await setMetaValue<LegacyMigrationMarker>(LEGACY_MIGRATION_KEY, {
      done: true,
      at: Date.now(),
      draftIds: [],
    });
    return { migrated: 0, skipped: false, draftIds: [] };
  }

  const copiedAt = Date.now();
  if (single) {
    await setMetaValue(LEGACY_RAW_SINGLE_KEY, { raw: single.raw, copiedAt });
  }
  if (carousel) {
    await setMetaValue(LEGACY_RAW_CAROUSEL_KEY, { raw: carousel.raw, copiedAt });
  }

  if (single && !single.state) throw new Error('migracao-rascunho-invalido');
  if (carousel && !carousel.state) throw new Error('migracao-carrossel-invalido');

  const now = Date.now();
  const records: DraftRecord[] = [];

  let carouselBody: DraftBody | null = null;
  if (carousel?.state) {
    const state = carousel.state;
    const shouldMigrate =
      state.mode === 'carousel' ||
      (state.mode == null && Array.isArray(state.slides) && state.slides.length > 0);
    if (shouldMigrate) {
      carouselBody = sanitizeDraftBody(
        {
          id: LEGACY_CAROUSEL_DRAFT_ID,
          kind: 'carousel',
          slides: state.slides,
          activeSlideIndex: state.activeSlideIndex,
          format: state.format,
        },
        sanitizeFormat(state.format),
      );
      if (carouselBody && !isBodyMeaningful(carouselBody)) carouselBody = null;
    }
  }

  if (carouselBody) {
    const kind = 'carousel' as const;
    const meta: DraftMeta = {
      id: LEGACY_CAROUSEL_DRAFT_ID,
      title: buildAutoTitle(carouselBody, kind, now),
      titleSource: 'auto',
      kind,
      format: carouselBody.kind === 'carousel' ? carouselBody.format : '3:4',
      slideCount: carouselBody.kind === 'carousel' ? carouselBody.slides.length : 1,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: null,
      schemaVersion: DRAFT_SCHEMA_VERSION,
    };
    records.push({ meta, body: carouselBody });
  }

  if (single?.state) {
    const singleBody = sanitizeDraftBody({
      id: LEGACY_SINGLE_DRAFT_ID,
      kind: 'single',
      doc: single.state.doc,
      finish: single.state.finish,
    });
    if (singleBody && isBodyMeaningful(singleBody) && !duplicatesCarousel(singleBody, carouselBody)) {
      const kind = 'single' as const;
      const meta: DraftMeta = {
        id: LEGACY_SINGLE_DRAFT_ID,
        title: buildAutoTitle(singleBody, kind, now),
        titleSource: 'auto',
        kind,
        format: sanitizeFormat(singleBody.kind === 'single' ? singleBody.doc.format : '3:4'),
        slideCount: 1,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: null,
        schemaVersion: DRAFT_SCHEMA_VERSION,
      };
      records.push({ meta, body: singleBody });
    }
  }

  await saveDraftRecords(records);

  const draftIds = records.map((record) => record.meta.id);
  await setMetaValue<LegacyMigrationMarker>(LEGACY_MIGRATION_KEY, {
    done: true,
    at: Date.now(),
    draftIds,
  });

  return { migrated: records.length, skipped: false, draftIds };
}
