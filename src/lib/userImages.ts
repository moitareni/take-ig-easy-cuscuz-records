import { createExternalStore } from './createExternalStore';
import {
  IMAGES_STORE,
  getAllFromStore,
  openEditorDb,
  putInStore,
  requestAsPromise,
  transactionDone,
} from './drafts/db';
import {
  IMAGE_THUMB_SIDE,
  IMAGE_WEBP_QUALITY,
  downscaleDimensions,
  imageFileLabel,
  isImageFileTooBig,
  isSupportedImageFile,
} from './imageRules';

/**
 * Imagens enviadas pelo usuário.
 *
 * O blob processado e a miniatura vivem no IndexedDB (cota muito maior que o
 * localStorage, onde o rascunho leve do doc não daria conta de uma foto em
 * base64). Em memória, um registry de object URLs alimenta o Konva e a lista
 * do painel; o elemento no doc guarda só metadados + `imageId`.
 */

export interface UserImageEntry {
  id: string;
  name: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

export interface StoredImage {
  id: string;
  blob: Blob;
  thumb: Blob;
  name: string;
  width: number;
  height: number;
  createdAt: number;
}

// ---------------------------------------------------------------- registry

const entries = new Map<string, UserImageEntry>();
/**
 * O Map é mutável in-place (add/remove mutam sem substituir o todo), então a
 * reatividade usa uma store de versão: cada emit() bumpa o número e re-renderiza.
 */
const registryVersion = createExternalStore(0);

function emit() {
  registryVersion.set((v) => v + 1);
}

function getEntry(id: string | null | undefined): UserImageEntry | null {
  return id ? entries.get(id) ?? null : null;
}

/** Hook de leitura reativa: devolve o registro do registry (null se indisponível). */
export function useUserImage(imageId: string | null): UserImageEntry | null {
  registryVersion.use(); // subscreve ao registry; getEntry lê o Map na hora do render
  return getEntry(imageId);
}

function addEntry(entry: UserImageEntry) {
  entries.set(entry.id, entry);
  emit();
}

async function removeEntry(id: string) {
  const entry = entries.get(id);
  entries.delete(id);
  if (entry) {
    URL.revokeObjectURL(entry.url);
    URL.revokeObjectURL(entry.thumbUrl);
  }
  emit();
  try {
    const db = await openEditorDb();
    const tx = db.transaction(IMAGES_STORE, 'readwrite');
    tx.objectStore(IMAGES_STORE).delete(id);
    await transactionDone(tx);
  } catch {
    // Banco indisponível: a URL já foi revogada; segue o jogo.
  }
}

// ------------------------------------------------------------ IndexedDB puro

async function getAllStored(): Promise<StoredImage[]> {
  return getAllFromStore<StoredImage>(IMAGES_STORE);
}

async function putStored(rec: StoredImage): Promise<void> {
  await putInStore(IMAGES_STORE, rec);
}

// ------------------------------------------------- carregamento sob demanda

/** Só as chaves: a home e o boot não precisam baixar o acervo de fotos inteiro. */
export async function getStoredImageIds(): Promise<Set<string>> {
  try {
    const db = await openEditorDb();
    const keys = await requestAsPromise(
      db.transaction(IMAGES_STORE).objectStore(IMAGES_STORE).getAllKeys(),
    );
    return new Set(keys.map((key) => String(key)));
  } catch {
    return new Set();
  }
}

/**
 * Carrega para o registry apenas as imagens referenciadas pelo rascunho aberto.
 * Chamadas concorrentes são inofensivas: o registro já existente é preservado.
 */
export async function loadUserImages(ids: Iterable<string>): Promise<void> {
  const missing = [...new Set(ids)].filter((id) => !entries.has(id));
  if (missing.length === 0) return;

  try {
    const db = await openEditorDb();
    const tx = db.transaction(IMAGES_STORE, 'readonly');
    const done = transactionDone(tx);
    const store = tx.objectStore(IMAGES_STORE);
    const records = await Promise.all(
      missing.map((id) => requestAsPromise(store.get(id) as IDBRequest<StoredImage | undefined>)),
    );
    await done;
    for (const rec of records) {
      if (!rec || entries.has(rec.id)) continue;
      addEntry(storedToEntry(rec));
    }
  } catch {
    // Sem banco: os elementos sem blob serão reconciliados ao abrir o rascunho.
  }
}

function storedToEntry(rec: StoredImage): UserImageEntry {
  return {
    id: rec.id,
    name: rec.name,
    url: URL.createObjectURL(rec.blob),
    thumbUrl: URL.createObjectURL(rec.thumb),
    width: rec.width,
    height: rec.height,
  };
}

/**
 * Remove do banco e da memória as imagens que nenhum rascunho referencia.
 * O `keep` DEVE ser a união de todos os rascunhos (imagens e `cutFrom`),
 * nunca apenas o rascunho ativo. Chamar só depois da migração concluída.
 */
export async function collectGarbageImages(keep: Set<string>): Promise<void> {
  let keys: IDBValidKey[];
  try {
    const db = await openEditorDb();
    keys = await requestAsPromise(
      db.transaction(IMAGES_STORE).objectStore(IMAGES_STORE).getAllKeys(),
    );
  } catch {
    return;
  }
  const orphans = keys.map((key) => String(key)).filter((id) => !keep.has(id));
  for (const id of orphans) {
    await removeEntry(id);
  }
}

/** Acervo completo, usado só pelo backup (não hidrata o editor). */
export async function getAllStoredImages(): Promise<StoredImage[]> {
  return getAllStored();
}

// ------------------------------------------------------------- importação

export interface ImportedImage {
  entry: UserImageEntry;
  /** false = IndexedDB indisponível; a imagem só vive nesta sessão. */
  persisted: boolean;
}

/**
 * Registra uma imagem já processada (ex.: recorte sem fundo) sem passar pela
 * validação de arquivo: gera a miniatura, grava no IndexedDB e alimenta o
 * registry com as URLs para o canvas.
 */
export async function registerProcessedImage(
  blob: Blob,
  name: string,
  width: number,
  height: number,
): Promise<ImportedImage> {
  if (!blob.type.startsWith('image/')) throw new Error('encode');
  const decoded = await decodeImageSource(blob);
  let result: ImportedImage;
  try {
    const thumbDims = downscaleDimensions(decoded.width, decoded.height, IMAGE_THUMB_SIDE);
    const thumb = await renderToBlob(decoded.source, thumbDims.width, thumbDims.height);

    const entry: UserImageEntry = {
      id: uid(),
      name,
      url: URL.createObjectURL(blob),
      thumbUrl: URL.createObjectURL(thumb),
      width,
      height,
    };

    let persisted = true;
    try {
      await putStored({
        id: entry.id,
        blob,
        thumb,
        name: entry.name,
        width,
        height,
        createdAt: Date.now(),
      });
    } catch {
      persisted = false;
    }
    addEntry(entry);
    result = { entry, persisted };
  } finally {
    decoded.close();
  }
  return result;
}

/**
 * Fluxo completo de importação: valida, decodifica, redimensiona, encoda,
 * grava no IndexedDB e registra as URLs para o canvas.
 */
export async function importUserImage(file: File): Promise<ImportedImage> {
  if (!isSupportedImageFile(file)) throw new Error('tipo-nao-suportado');
  if (isImageFileTooBig(file)) throw new Error('arquivo-grande');

  const decoded = await decodeImageSource(file);
  let result: ImportedImage;
  try {
    const dims = downscaleDimensions(decoded.width, decoded.height);
    if (!dims.width || !dims.height) throw new Error('decode');

    const blob = await renderToBlob(decoded.source, dims.width, dims.height);
    const thumbDims = downscaleDimensions(decoded.width, decoded.height, IMAGE_THUMB_SIDE);
    const thumb = await renderToBlob(decoded.source, thumbDims.width, thumbDims.height);

    const entry: UserImageEntry = {
      id: uid(),
      name: imageFileLabel(file.name),
      url: URL.createObjectURL(blob),
      thumbUrl: URL.createObjectURL(thumb),
      width: dims.width,
      height: dims.height,
    };

    let persisted = true;
    try {
      await putStored({
        id: entry.id,
        blob,
        thumb,
        name: entry.name,
        width: dims.width,
        height: dims.height,
        createdAt: Date.now(),
      });
    } catch {
      persisted = false;
    }
    addEntry(entry);
    result = { entry, persisted };
  } finally {
    decoded.close();
  }
  return result;
}

// ------------------------------------------------- decode / render / encode

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

async function decodeImageSource(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Formato suportado pelo <img> mas não pelo createImageBitmap (ex.: alguns GIFs/AVIF).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function drawToCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-2d-indisponivel');
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('encode'))),
      type,
      quality,
    );
  });
}

/** WebP primeiro; se o navegador não encodar (ou cair para PNG), vai de JPEG. */
async function renderToBlob(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const canvas = drawToCanvas(source, width, height);
  try {
    const webp = await canvasToBlob(canvas, 'image/webp', IMAGE_WEBP_QUALITY);
    if (webp.type === 'image/webp') return webp;
  } catch {
    // Fallback abaixo.
  }
  return canvasToBlob(canvas, 'image/jpeg', IMAGE_WEBP_QUALITY);
}

function uid(): string {
  return `img-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// ------------------------------------------------------------------- export

/**
 * Garante que as imagens referenciadas estão decodificadas antes de exportar:
 * o `stage.toDataURL` captura nodes com a imagem ainda a meio caminho do load.
 */
export async function ensureUserImagesReady(
  ids: Iterable<string>,
  timeoutMs = 3000,
): Promise<void> {
  const urls = [...new Set([...ids].map((id) => getEntry(id)).filter((e): e is UserImageEntry => !!e).map((e) => e.url))];
  await Promise.race([
    Promise.all(
      urls.map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = url;
            setTimeout(resolve, timeoutMs);
          }),
      ),
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export { getEntry as getUserImageEntry };
