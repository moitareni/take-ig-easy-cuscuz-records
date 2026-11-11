import { getAllStoredImages } from '../userImages';
import { getAllDraftRecords, getDraftCover } from './repository';
import { DRAFT_SCHEMA_VERSION } from './types';

const BACKUP_APP = 'cuscuz-insta-kit';
const BACKUP_VERSION = 1;

interface BackupImageEntry {
  id: string;
  name: string;
  width: number;
  height: number;
  createdAt: number;
  file: string;
  mime: string;
}

interface BackupCoverEntry {
  draftId: string;
  file: string;
  mime: string;
}

interface BackupManifest {
  app: typeof BACKUP_APP;
  backupVersion: typeof BACKUP_VERSION;
  schemaVersion: typeof DRAFT_SCHEMA_VERSION;
  exportedAt: number;
  drafts: Awaited<ReturnType<typeof getAllDraftRecords>>;
  images: BackupImageEntry[];
  covers: BackupCoverEntry[];
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function backupDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function extensionFor(blob: Blob, fallback: string): string {
  if (blob.type === 'image/webp') return 'webp';
  if (blob.type === 'image/jpeg') return 'jpg';
  if (blob.type === 'image/png') return 'png';
  return fallback;
}

function safeFileId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-_]/g, '_');
}

/**
 * Cópia de segurança manual dos rascunhos, capas e fotos.
 *
 * A importação fica para uma fase seguinte; este arquivo já carrega a versão
 * do schema para que a futura importação saiba traduzir dados antigos.
 */
export async function exportDraftsBackup(): Promise<{ drafts: number; images: number }> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const drafts = await getAllDraftRecords();
  const images = await getAllStoredImages();

  const imageEntries: BackupImageEntry[] = [];
  for (const image of images) {
    const ext = extensionFor(image.blob, 'webp');
    const file = `imagens/${safeFileId(image.id)}.${ext}`;
    zip.file(file, image.blob);
    imageEntries.push({
      id: image.id,
      name: image.name,
      width: image.width,
      height: image.height,
      createdAt: image.createdAt,
      file,
      mime: image.blob.type || `image/${ext}`,
    });
  }

  const coverEntries: BackupCoverEntry[] = [];
  for (const record of drafts) {
    const cover = await getDraftCover(record.meta.id);
    if (!cover) continue;
    const ext = extensionFor(cover, 'webp');
    const file = `capas/${safeFileId(record.meta.id)}.${ext}`;
    zip.file(file, cover);
    coverEntries.push({ draftId: record.meta.id, file, mime: cover.type || `image/${ext}` });
  }

  const manifest: BackupManifest = {
    app: BACKUP_APP,
    backupVersion: BACKUP_VERSION,
    schemaVersion: DRAFT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    drafts,
    images: imageEntries,
    covers: coverEntries,
  };

  zip.file('rascunhos.json', JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cuscuz-records-backup-${backupDate()}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  return { drafts: drafts.length, images: images.length };
}
