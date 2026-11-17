/**
 * Banco local do editor. O mesmo banco já existia na versão 1 apenas com o
 * store `images`; a versão 2 acrescenta os stores dos rascunhos sem apagar as
 * fotos. Todo acesso a IndexedDB do app passa por aqui para não haver duas
 * conexões disputando o upgrade.
 */

export const EDITOR_DB_NAME = 'cuscuz-insta-kit';
export const EDITOR_DB_VERSION = 2;

export const IMAGES_STORE = 'images';
export const DRAFTS_STORE = 'drafts';
export const DOCUMENTS_STORE = 'documents';
export const COVERS_STORE = 'covers';
export const META_STORE = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;
let dbInstance: IDBDatabase | null = null;

/**
 * Retorna a instância aberta em cache (se houver) de forma síncrona.
 * Permite que `beforeunload`/`pagehide` abram a transação IndexedDB no mesmo tick.
 */
export function getOpenEditorDbSync(): IDBDatabase | null {
  return dbInstance;
}

export function resetEditorDbForTests(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignora erro ao fechar em testes.
    }
    dbInstance = null;
  }
  dbPromise = null;
}

export function openEditorDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexeddb-indisponivel'));
      return;
    }

    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const request = indexedDB.open(EDITOR_DB_NAME, EDITOR_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        const drafts = db.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
        drafts.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) {
        db.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(COVERS_STORE)) {
        db.createObjectStore(COVERS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };

    request.onblocked = () => {
      // Outra aba com a versão antiga aberta impede o upgrade. A aba nova
      // recebe uma mensagem clara em vez de um erro genérico.
      fail(new Error('indexeddb-bloqueado'));
    };

    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      const db = request.result;
      dbInstance = db;
      db.onversionchange = () => {
        db.close();
        if (dbInstance === db) dbInstance = null;
        dbPromise = null;
      };
      db.onclose = () => {
        if (dbInstance === db) dbInstance = null;
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => fail(request.error ?? new Error('indexeddb-erro'));
  });

  dbPromise.catch(() => {
    dbInstance = null;
    dbPromise = null;
  });

  return dbPromise;
}

export function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexeddb-erro'));
  });
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexeddb-transacao'));
    tx.onabort = () => reject(tx.error ?? new Error('indexeddb-transacao-abortada'));
  });
}

export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openEditorDb();
  return requestAsPromise(db.transaction(storeName).objectStore(storeName).getAll() as IDBRequest<T[]>);
}

export async function getFromStore<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openEditorDb();
  return requestAsPromise(
    db.transaction(storeName).objectStore(storeName).get(key) as IDBRequest<T | undefined>,
  );
}

export async function putInStore<T>(storeName: string, value: T): Promise<void> {
  const db = await openEditorDb();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(value);
  await transactionDone(tx);
}

export async function deleteFromStore(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openEditorDb();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
  await transactionDone(tx);
}

/** Mensagem curta e sem jargão para a UI, a partir do erro cru do IndexedDB. */
export function describeStorageError(error: unknown): string {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    if (error.name === 'QuotaExceededError') {
      return 'O navegador ficou sem espaço. Exclua posts antigos ou baixe uma cópia de segurança.';
    }
    if (error.name === 'VersionError') {
      return 'Uma versão mais nova do app está aberta em outra aba. Feche-a e tente de novo.';
    }
  }
  if (error instanceof Error) {
    if (error.message === 'indexeddb-bloqueado') {
      return 'Atualize as outras abas do app para liberar o salvamento dos rascunhos.';
    }
    if (error.message === 'indexeddb-indisponivel') {
      return 'Este navegador não está deixando usar o armazenamento local. Os posts não vão ficar salvos.';
    }
  }
  return 'Não conseguimos acessar os rascunhos salvos neste navegador.';
}
