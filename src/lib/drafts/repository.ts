import { CAROUSEL_MAX_SLIDES, type PostFormat } from '../../brand/brand';
import { extractSingleSlideData, normalizeCrossoverOwnership } from '../crossover';
import type { Doc, FinishState, SlideData } from '../../types';
import { defaultSlide, sanitizeFormat, sanitizeSlide } from '../../store/carouselStore';
import { sanitize, sanitizeFinish } from '../../store/editorStore';
import { dedupeSlideElementIds } from '../slideIds';
import { defaultDraftTitle } from './content';
import {
  COVERS_STORE,
  DOCUMENTS_STORE,
  DRAFTS_STORE,
  META_STORE,
  getAllFromStore,
  getFromStore,
  openEditorDb,
  putInStore,
  requestAsPromise,
  transactionDone,
} from './db';
import {
  DRAFT_SCHEMA_VERSION,
  type CarouselDraftBody,
  type DraftBody,
  type DraftCoverRecord,
  type DraftMeta,
  type DraftRecord,
  type SingleDraftBody,
  type StoredMetaRecord,
  type TitleSource,
  isDraftKind,
  isTitleSource,
} from './types';

const META_KEY_PREFIX = 'cuscuz-drafts:';

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeTitle(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
}

export function sanitizeDraftMeta(raw: unknown): DraftMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<DraftMeta>;
  if (typeof r.id !== 'string' || r.id.length === 0) return null;

  const kind = isDraftKind(r.kind) ? r.kind : 'single';
  const format = sanitizeFormat(r.format);
  const updatedAt = finiteNumber(r.updatedAt, Date.now());
  const createdAt = finiteNumber(r.createdAt, updatedAt);
  const lastOpenedAt = typeof r.lastOpenedAt === 'number' && Number.isFinite(r.lastOpenedAt)
    ? r.lastOpenedAt
    : null;
  const title = normalizeTitle(r.title) || defaultDraftTitle(kind, new Date(updatedAt));
  const titleSource: TitleSource = isTitleSource(r.titleSource) ? r.titleSource : 'auto';
  const slideCount = kind === 'carousel'
    ? clampInt(r.slideCount, 1, CAROUSEL_MAX_SLIDES, 1)
    : 1;

  return {
    id: r.id,
    title,
    titleSource,
    kind,
    format,
    slideCount,
    createdAt,
    updatedAt,
    lastOpenedAt,
    schemaVersion: DRAFT_SCHEMA_VERSION,
  };
}

interface RawBody {
  id?: unknown;
  kind?: unknown;
  format?: unknown;
  doc?: Doc;
  finish?: FinishState;
  slides?: unknown;
  activeSlideIndex?: unknown;
}

export function sanitizeDraftBody(raw: unknown, fallbackFormat: PostFormat = '3:4'): DraftBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as RawBody;
  if (typeof r.id !== 'string' || r.id.length === 0) return null;

  if (r.kind === 'carousel') {
    const format = sanitizeFormat(r.format ?? fallbackFormat);
    const rawSlides = Array.isArray(r.slides) ? r.slides.slice(0, CAROUSEL_MAX_SLIDES) : [];
    // Cicatriza rascunhos antigos com slides duplicados que compartilham ids
    // de elemento (ver lib/slideIds.ts) antes de qualquer sincronização.
    let slides = dedupeSlideElementIds(rawSlides.map((slide) => sanitizeSlide(slide, format)));
    if (slides.length === 0) slides = [defaultSlide(format)];
    // Cicatriza a posse das cópias de crossover de rascunhos antigos (antes de
    // `crossFrom`) e descarta cópias órfãs — ver lib/crossover.ts.
    slides = normalizeCrossoverOwnership(slides, format);
    const activeSlideIndex = clampInt(r.activeSlideIndex, 0, slides.length - 1, 0);
    return {
      id: r.id,
      kind: 'carousel',
      slides,
      activeSlideIndex,
      format,
      schemaVersion: DRAFT_SCHEMA_VERSION,
    };
  }

  if (r.kind === 'single') {
    return {
      id: r.id,
      kind: 'single',
      doc: sanitize(r.doc),
      finish: sanitizeFinish(r.finish),
      schemaVersion: DRAFT_SCHEMA_VERSION,
    };
  }

  return null;
}

/** Garante que metadados e corpo contem a mesma história, mesmo se um dos dois veio corrompido. */
function alignBodyToMeta(meta: DraftMeta, body: DraftBody): DraftBody {
  if (body.kind === 'carousel') {
    if (meta.kind === 'carousel') {
      const slides = body.slides.map((slide) => sanitizeSlide(slide, meta.format));
      const activeSlideIndex = Math.min(body.activeSlideIndex, slides.length - 1);
      return { ...body, id: meta.id, format: meta.format, slides, activeSlideIndex };
    }
    const chosen = extractSingleSlideData(body.slides, body.activeSlideIndex, meta.format);
    const slide = chosen ?? body.slides[0] ?? defaultSlide(meta.format);
    return {
      id: meta.id,
      kind: 'single',
      doc: { ...slide.doc, format: meta.format },
      finish: slide.finish,
      schemaVersion: DRAFT_SCHEMA_VERSION,
    };
  }

  if (meta.kind === 'single') {
    return {
      ...body,
      id: meta.id,
      doc: { ...body.doc, format: meta.format },
    };
  }

  const slide: SlideData = {
    id: `slide-${meta.id}`,
    doc: { ...body.doc, format: meta.format },
    finish: body.finish,
  };
  return {
    id: meta.id,
    kind: 'carousel',
    slides: [slide],
    activeSlideIndex: 0,
    format: meta.format,
    schemaVersion: DRAFT_SCHEMA_VERSION,
  };
}

export async function listDraftMetas(): Promise<DraftMeta[]> {
  const raw = await getAllFromStore<unknown>(DRAFTS_STORE);
  return raw
    .map(sanitizeDraftMeta)
    .filter((meta): meta is DraftMeta => meta !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getDraftMeta(id: string): Promise<DraftMeta | null> {
  const raw = await getFromStore<unknown>(DRAFTS_STORE, id);
  return sanitizeDraftMeta(raw);
}

export async function getDraftBody(meta: DraftMeta): Promise<DraftBody | null> {
  const raw = await getFromStore<unknown>(DOCUMENTS_STORE, meta.id);
  const body = sanitizeDraftBody(raw, meta.format);
  return body ? alignBodyToMeta(meta, body) : null;
}

export async function readDraftRecord(id: string): Promise<DraftRecord | null> {
  const db = await openEditorDb();
  const tx = db.transaction([DRAFTS_STORE, DOCUMENTS_STORE], 'readonly');
  const done = transactionDone(tx);
  const metaReq = tx.objectStore(DRAFTS_STORE).get(id) as IDBRequest<unknown>;
  const bodyReq = tx.objectStore(DOCUMENTS_STORE).get(id) as IDBRequest<unknown>;
  const [rawMeta, rawBody] = await Promise.all([
    requestAsPromise(metaReq),
    requestAsPromise(bodyReq),
  ]);
  await done;

  const meta = sanitizeDraftMeta(rawMeta);
  if (!meta) return null;
  const parsedBody = sanitizeDraftBody(rawBody, meta.format);
  const body = parsedBody ? alignBodyToMeta(meta, parsedBody) : null;
  if (!body) return null;
  return { meta, body };
}

export async function saveDraftRecord(meta: DraftMeta, body: DraftBody): Promise<void> {
  const safeMeta: DraftMeta = {
    ...normalizeMeta(meta),
    schemaVersion: DRAFT_SCHEMA_VERSION,
  };
  const safeBody: DraftBody = { ...body, id: safeMeta.id, schemaVersion: DRAFT_SCHEMA_VERSION };

  const db = await openEditorDb();
  const tx = db.transaction([DRAFTS_STORE, DOCUMENTS_STORE], 'readwrite');
  tx.objectStore(DRAFTS_STORE).put(safeMeta);
  tx.objectStore(DOCUMENTS_STORE).put(safeBody);
  await transactionDone(tx);
}

export async function saveDraftRecords(records: DraftRecord[]): Promise<void> {
  if (records.length === 0) return;
  const db = await openEditorDb();
  const tx = db.transaction([DRAFTS_STORE, DOCUMENTS_STORE], 'readwrite');
  const drafts = tx.objectStore(DRAFTS_STORE);
  const documents = tx.objectStore(DOCUMENTS_STORE);
  for (const record of records) {
    const meta = normalizeMeta(record.meta);
    drafts.put(meta);
    documents.put({ ...record.body, id: meta.id, schemaVersion: DRAFT_SCHEMA_VERSION });
  }
  await transactionDone(tx);
}

function normalizeMeta(meta: DraftMeta): DraftMeta {
  return {
    ...meta,
    title: normalizeTitle(meta.title) || defaultDraftTitle(meta.kind, new Date(meta.updatedAt)),
    kind: isDraftKind(meta.kind) ? meta.kind : 'single',
    format: sanitizeFormat(meta.format),
    slideCount: meta.kind === 'carousel' ? clampInt(meta.slideCount, 1, CAROUSEL_MAX_SLIDES, 1) : 1,
    createdAt: finiteNumber(meta.createdAt, Date.now()),
    updatedAt: finiteNumber(meta.updatedAt, Date.now()),
    lastOpenedAt: typeof meta.lastOpenedAt === 'number' ? meta.lastOpenedAt : null,
    schemaVersion: DRAFT_SCHEMA_VERSION,
  };
}

export async function updateDraftMeta(
  id: string,
  patch: Partial<Pick<DraftMeta, 'title' | 'titleSource' | 'kind' | 'format' | 'slideCount' | 'updatedAt' | 'lastOpenedAt'>>,
): Promise<DraftMeta | null> {
  const current = await getDraftMeta(id);
  if (!current) return null;
  const next = normalizeMeta({ ...current, ...patch });
  await putInStore(DRAFTS_STORE, next);
  return next;
}

export async function deleteDraftRecord(id: string): Promise<void> {
  const db = await openEditorDb();
  const tx = db.transaction([DRAFTS_STORE, DOCUMENTS_STORE, COVERS_STORE], 'readwrite');
  tx.objectStore(DRAFTS_STORE).delete(id);
  tx.objectStore(DOCUMENTS_STORE).delete(id);
  tx.objectStore(COVERS_STORE).delete(id);
  await transactionDone(tx);
}

export async function getAllDraftBodies(): Promise<DraftBody[]> {
  const raw = await getAllFromStore<unknown>(DOCUMENTS_STORE);
  return raw
    .map((body) => sanitizeDraftBody(body))
    .filter((body): body is DraftBody => body !== null);
}

export async function getAllDraftRecords(): Promise<DraftRecord[]> {
  const [metas, bodies] = await Promise.all([listDraftMetas(), getAllDraftBodies()]);
  const byId = new Map(bodies.map((body) => [body.id, body]));
  const records: DraftRecord[] = [];
  for (const meta of metas) {
    const body = byId.get(meta.id);
    if (!body) continue;
    records.push({ meta, body: alignBodyToMeta(meta, body) });
  }
  return records;
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function duplicateDraftRecord(record: DraftRecord, id: string): Promise<DraftRecord> {
  const now = Date.now();
  const meta: DraftMeta = {
    ...record.meta,
    id,
    title: `${record.meta.title} (cópia)`,
    titleSource: 'user',
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
  };

  let body: DraftBody;
  if (record.body.kind === 'single') {
    const single: SingleDraftBody = {
      ...cloneValue(record.body),
      id,
    };
    body = single;
  } else {
    const carousel: CarouselDraftBody = {
      ...cloneValue(record.body),
      id,
      slides: record.body.slides.map((slide, index) => ({
        ...cloneValue(slide),
        id: `slide-${id}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      })),
    };
    body = carousel;
  }

  await saveDraftRecord(meta, body);

  try {
    const cover = await getDraftCover(record.meta.id);
    if (cover) await putDraftCover(id, cover);
  } catch {
    // Capa é cosmética: falhar na cópia não impede o rascunho duplicado.
  }

  return { meta, body };
}

export async function putDraftCover(id: string, blob: Blob): Promise<void> {
  await putInStore<DraftCoverRecord>(COVERS_STORE, { id, blob, updatedAt: Date.now() });
}

export async function getDraftCover(id: string): Promise<Blob | null> {
  const record = await getFromStore<DraftCoverRecord>(COVERS_STORE, id);
  return record?.blob instanceof Blob ? record.blob : null;
}

export async function deleteDraftCover(id: string): Promise<void> {
  const db = await openEditorDb();
  const tx = db.transaction(COVERS_STORE, 'readwrite');
  tx.objectStore(COVERS_STORE).delete(id);
  await transactionDone(tx);
}

export function metaStorageKey(key: string): string {
  return `${META_KEY_PREFIX}${key}`;
}

export async function getMetaValue<T>(key: string): Promise<T | undefined> {
  const record = await getFromStore<StoredMetaRecord<T>>(META_STORE, metaStorageKey(key));
  return record?.value;
}

export async function setMetaValue<T>(key: string, value: T): Promise<void> {
  await putInStore<StoredMetaRecord<T>>(META_STORE, {
    key: metaStorageKey(key),
    value,
    updatedAt: Date.now(),
  });
}
