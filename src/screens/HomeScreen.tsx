import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  Download,
  Images,
  Pencil,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { POST_FORMATS, type PostFormat } from '../brand/brand';
import { getDraftCover } from '../lib/drafts/repository';
import {
  createDraft,
  deleteDraftWithUndo,
  duplicateDraftFromHome,
  onDraftsChanged,
  openDraft,
  refreshDrafts,
  renameDraftFromHome,
} from '../lib/drafts/session';
import { exportDraftsBackup } from '../lib/drafts/backup';
import type { DraftMeta } from '../lib/drafts/types';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { useDraftsStore } from '../store/draftsStore';
import { useEditor } from '../store/editorStore';
import { Button } from '../components/ui/Button';
import { FormatGlyph } from '../components/ui/FormatGlyph';
import { HelpTip } from '../components/ui/HelpTip';
import { IconButton } from '../components/ui/IconButton';
import { PreviewImage } from '../components/ui/PreviewImage';
import { Segmented } from '../components/ui/Segmented';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CreateDraftDropdown, type CreateDraftKind } from '../components/CreateDraftDropdown';
import { HomeDraftExporter } from '../components/HomeDraftExporter';
import styles from './HomeScreen.module.css';

function plural(value: number, singular: string, pluralForm: string): string {
  return value === 1 ? singular : pluralForm;
}

function formatWhen(timestamp: number): string {
  const diff = Math.max(0, Date.now() - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'agora mesmo';
  if (diff < hour) {
    const value = Math.max(1, Math.round(diff / minute));
    return `há ${value} ${plural(value, 'minuto', 'minutos')}`;
  }
  if (diff < day) {
    const value = Math.round(diff / hour);
    return `há ${value} ${plural(value, 'hora', 'horas')}`;
  }
  if (diff < 2 * day) return 'ontem';
  if (diff < 7 * day) {
    const value = Math.round(diff / day);
    return `há ${value} ${plural(value, 'dia', 'dias')}`;
  }
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(
    new Date(timestamp),
  );
}

function kindLabel(draft: DraftMeta): string {
  if (draft.kind === 'carousel') {
    return `Carrossel · ${draft.slideCount} ${plural(draft.slideCount, 'slide', 'slides')}`;
  }
  return 'Post único';
}

/** Blobs de capa viram object URLs e são revogados quando a lista muda. */
function useDraftCovers(drafts: DraftMeta[]): Record<string, string> {
  const [covers, setCovers] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];

    void (async () => {
      const loaded = await Promise.all(
        drafts.map(async (draft) => {
          try {
            return [draft.id, await getDraftCover(draft.id)] as const;
          } catch {
            return [draft.id, null] as const;
          }
        }),
      );
      if (cancelled) return;

      const next: Record<string, string> = {};
      for (const [id, blob] of loaded) {
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        next[id] = url;
      }
      setCovers(next);
    })();

    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [drafts]);

  return covers;
}

const CoverThumb: React.FC<{ draft: DraftMeta; url: string | undefined }> = ({ draft, url }) => (
  <PreviewImage
    src={url}
    alt=""
    imgClassName={styles.coverImage}
    loadingSize="full"
    eager
    fallback={
      <span className={styles.coverPlaceholder} aria-hidden="true">
        {draft.kind === 'carousel' ? (
          <Images size={34} strokeWidth={2.5} />
        ) : (
          <Sparkles size={34} strokeWidth={2.5} />
        )}
        <FormatGlyph format={draft.format} size={26} />
      </span>
    }
  />
);

interface DraftCardProps {
  draft: DraftMeta;
  coverUrl: string | undefined;
  busy: boolean;
  isExporting: boolean;
  onOpen: (draft: DraftMeta) => void;
  onExport: (draft: DraftMeta) => void;
  onRename: (draft: DraftMeta, newTitle: string) => void;
  onDuplicate: (draft: DraftMeta) => void;
  onDelete: (draft: DraftMeta) => void;
}

const DraftCard: React.FC<DraftCardProps> = ({
  draft,
  coverUrl,
  busy,
  isExporting,
  onOpen,
  onExport,
  onRename,
  onDuplicate,
  onDelete,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const closingTitleRef = useRef(false);

  const startEditingTitle = () => {
    if (busy) return;
    closingTitleRef.current = false;
    setTitleDraft(draft.title || 'Rascunho');
    setIsEditingTitle(true);
  };

  const commitTitleEdit = () => {
    if (closingTitleRef.current) return;
    closingTitleRef.current = true;
    setIsEditingTitle(false);
    const clean = titleDraft.replace(/\s+/g, ' ').trim();
    if (!clean || clean === draft.title) return;
    onRename(draft, clean);
  };

  const cancelTitleEdit = () => {
    closingTitleRef.current = true;
    setIsEditingTitle(false);
  };

  return (
    <article className={styles.draftCard}>
      <button
        type="button"
        className={styles.coverButton}
        onClick={() => onOpen(draft)}
        disabled={busy}
        aria-label={`Abrir ${draft.title}`}
      >
        <CoverThumb draft={draft} url={coverUrl} />
        <span className={styles.kindBadge}>{draft.kind === 'carousel' ? 'Carrossel' : 'Post único'}</span>
      </button>

      <div className={styles.cardBody}>
        <div className={styles.cardTitleRow}>
          {isEditingTitle ? (
            <div className={styles.cardTitleEditWrapper}>
              <span className={styles.cardTitleGhost} aria-hidden="true">
                {titleDraft || ' '}
              </span>
              <input
                type="text"
                size={1}
                className={styles.cardTitleInput}
                value={titleDraft}
                maxLength={80}
                autoFocus
                aria-label="Nome do rascunho"
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={commitTitleEdit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitTitleEdit();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelTitleEdit();
                  }
                }}
              />
            </div>
          ) : (
            <h3
              className={styles.cardTitle}
              title={draft.title}
              onClick={startEditingTitle}
            >
              {draft.title}
            </h3>
          )}
          {!isEditingTitle && (
            <button
              type="button"
              className={styles.renameIconBtn}
              aria-label="Renomear"
              title="Renomear"
              onClick={startEditingTitle}
              disabled={busy}
            >
              <Pencil size={15} strokeWidth={2.5} />
            </button>
          )}
        </div>
        <p className={styles.cardMeta}>
          {kindLabel(draft)} · {formatWhen(draft.updatedAt)}
        </p>

        <div className={styles.cardActions}>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={15} strokeWidth={2.5} />}
            onClick={() => onExport(draft)}
            disabled={busy}
          >
            {isExporting ? 'Exportando...' : 'Exportar'}
          </Button>
          <IconButton
            icon={<Copy size={16} strokeWidth={2.5} />}
            label="Duplicar rascunho"
            size="sm"
            onClick={() => onDuplicate(draft)}
            disabled={busy}
          />
          <IconButton
            icon={<Trash2 size={16} strokeWidth={2.5} />}
            label="Excluir rascunho"
            variant="danger"
            size="sm"
            onClick={() => onDelete(draft)}
            disabled={busy}
          />
        </div>
      </div>
    </article>
  );
};

export const HomeScreen: React.FC = () => {
  const drafts = useDraftsStore((s) => s.drafts);
  const listStatus = useDraftsStore((s) => s.listStatus);
  const listError = useDraftsStore((s) => s.listError);
  const storageWarning = useDraftsStore((s) => s.storageWarning);
  const showToast = useEditor((s) => s.showToast);

  const covers = useDraftCovers(drafts);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [exportingDraftId, setExportingDraftId] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [deleting, setDeleting] = useState<DraftMeta | null>(null);
  const [creatingCarousel, setCreatingCarousel] = useState(false);
  const [carouselFormat, setCarouselFormat] = useState<PostFormat>('3:4');
  const carouselDialogRef = useRef<HTMLDivElement>(null);

  useDialogFocus({
    isOpen: creatingCarousel,
    dialogRef: carouselDialogRef,
    onClose: () => setCreatingCarousel(false),
  });

  useEffect(() => {
    const unsubscribe = onDraftsChanged(() => {
      void refreshDrafts({ silent: true });
    });
    return unsubscribe;
  }, []);

  const continueDraft = useMemo(() => {
    if (drafts.length === 0) return null;
    return [...drafts].sort(
      (a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt),
    )[0];
  }, [drafts]);

  // O `+ Criar novo` mora ao lado do "Continuar" quando há rascunhos; no header só
  // enquanto a lista ainda não está pronta (senão ficaria sem nenhum caminho de criação).
  const showHeaderCreate = drafts.length === 0 && listStatus !== 'ready';

  const handleOpen = async (draft: DraftMeta) => {
    if (busyId || exportingDraftId) return;
    setBusyId(draft.id);
    try {
      await openDraft(draft.id);
    } finally {
      setBusyId(null);
    }
  };

  const handleExportDraft = (draft: DraftMeta) => {
    if (busyId || exportingDraftId) return;
    setExportingDraftId(draft.id);
  };

  const handleCreateSingle = () => {
    createDraft('single');
  };

  const handleCreateCarousel = () => {
    createDraft('carousel', carouselFormat);
    setCreatingCarousel(false);
  };

  const handleCreate = (kind: CreateDraftKind) => {
    if (kind === 'carousel') {
      setCreatingCarousel(true);
      return;
    }
    handleCreateSingle();
  };

  const handleRenameDraft = async (draft: DraftMeta, newTitle: string) => {
    const clean = newTitle.replace(/\s+/g, ' ').trim();
    if (!clean || clean === draft.title) return;
    await renameDraftFromHome(draft, clean);
  };

  const handleDuplicate = async (draft: DraftMeta) => {
    if (busyId) return;
    setBusyId(draft.id);
    try {
      await duplicateDraftFromHome(draft);
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    void deleteDraftWithUndo(target);
  };

  const handleBackup = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      const result = await exportDraftsBackup();
      showToast(
        'success',
        `Backup pronto! ${result.drafts} ${plural(result.drafts, 'rascunho', 'rascunhos')} e ${result.images} ${plural(result.images, 'foto', 'fotos')} no ZIP.`,
      );
    } catch (error) {
      console.error(error);
      showToast('error', 'Não conseguimos montar o backup agora. Tente de novo em instantes.');
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className={styles.screen}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <img src="/brand/favicon-64.png" alt="Logo Cuscuz Records" className={styles.logo} />
          <div>
            <h1 className={styles.title}>Cuscuz Records Insta Kit 🌽</h1>
            <p className={styles.subtitle}>Meus rascunhos</p>
          </div>
        </div>

        <div className={styles.topActions}>
          <Button
            variant="ghost"
            size="sm"
            icon={<Download size={16} strokeWidth={2.5} />}
            onClick={() => void handleBackup()}
            disabled={isBackingUp}
          >
            {isBackingUp ? 'Montando backup...' : 'Baixar backup'}
          </Button>
          {showHeaderCreate && <CreateDraftDropdown onSelect={handleCreate} />}
        </div>
      </header>

      <main className={styles.content}>
        {storageWarning && (
          <div className={styles.warning} role="status">
            <AlertTriangle size={20} strokeWidth={2.5} />
            <span>{storageWarning}</span>
          </div>
        )}

        {continueDraft && (
          <div className={styles.startRow}>
            <div className={styles.createTile}>
              <CreateDraftDropdown onSelect={handleCreate} block />
            </div>
            <section className={styles.continueCard} aria-labelledby="continue-title">
              <div className={styles.continueCover}>
                <CoverThumb draft={continueDraft} url={covers[continueDraft.id]} />
              </div>
              <div className={styles.continueBody}>
                <p className={styles.continueEyebrow}>Continuar de onde parou</p>
                <h2 id="continue-title" className={styles.continueTitle}>
                  {continueDraft.title}
                </h2>
                <p className={styles.cardMeta}>
                  {kindLabel(continueDraft)} · {formatWhen(continueDraft.updatedAt)}
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                icon={<ArrowRight size={18} strokeWidth={2.5} />}
                onClick={() => void handleOpen(continueDraft)}
                disabled={busyId !== null}
              >
                Continuar
              </Button>
            </section>
          </div>
        )}

        <section aria-labelledby="drafts-title" className={styles.draftsSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleRow}>
              <h2 id="drafts-title" className={styles.sectionTitle}>
                Meus rascunhos
              </h2>
              <HelpTip
                label="Sobre Meus rascunhos"
                tip="Cada post fica salvo neste navegador. Abra, renomeie ou duplique quando quiser."
              />
            </div>
            {drafts.length > 0 && (
              <span className={styles.countBadge}>
                {drafts.length} {plural(drafts.length, 'rascunho', 'rascunhos')}
              </span>
            )}
          </div>

          {listStatus === 'loading' && (
            <p className={styles.stateMessage} role="status">
              Carregando seus rascunhos...
            </p>
          )}

          {listStatus === 'error' && (
            <div className={styles.errorState} role="alert">
              <p>{listError ?? 'Não conseguimos abrir a lista de rascunhos.'}</p>
              <Button variant="secondary" size="sm" onClick={() => void refreshDrafts()}>
                Tentar de novo
              </Button>
            </div>
          )}

          {listStatus === 'ready' && drafts.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} aria-hidden="true">
                🌽
              </span>
              <h3 className={styles.emptyTitle}>Nenhum rascunho por aqui ainda</h3>
              <div className={styles.emptyActions}>
                <CreateDraftDropdown onSelect={handleCreate} centered />
              </div>
            </div>
          )}

          {listStatus === 'ready' && drafts.length > 0 && (
            <div className={styles.grid}>
              {drafts.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  coverUrl={covers[draft.id]}
                  busy={busyId !== null || exportingDraftId !== null}
                  isExporting={exportingDraftId === draft.id}
                  onOpen={(item) => void handleOpen(item)}
                  onExport={handleExportDraft}
                  onRename={(item, newTitle) => void handleRenameDraft(item, newTitle)}
                  onDuplicate={(item) => void handleDuplicate(item)}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {creatingCarousel && (
        <div className={styles.backdrop} onMouseDown={() => setCreatingCarousel(false)}>
          <div
            ref={carouselDialogRef}
            tabIndex={-1}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="carousel-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="carousel-title" className={styles.dialogTitle}>
              Escolha o formato do carrossel 🎠
            </h2>
            <p className={styles.dialogHint}>
              Você escolhe o tamanho uma vez e todos os cards saem iguais.
            </p>
            <Segmented
              options={[
                {
                  value: '3:4',
                  label: (
                    <>
                      <FormatGlyph format="3:4" />
                      {POST_FORMATS['3:4'].label}
                    </>
                  ),
                },
                {
                  value: '4:3',
                  label: (
                    <>
                      <FormatGlyph format="4:3" />
                      {POST_FORMATS['4:3'].label}
                    </>
                  ),
                },
                {
                  value: '1:1',
                  label: (
                    <>
                      <FormatGlyph format="1:1" />
                      {POST_FORMATS['1:1'].label}
                    </>
                  ),
                },
              ]}
              value={carouselFormat}
              onChange={(value) => setCarouselFormat(value as PostFormat)}
            />
            <div className={styles.dialogActions}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setCreatingCarousel(false)}
              >
                Voltar
              </Button>
              <Button variant="primary" size="md" onClick={handleCreateCarousel}>
                Bora criar carrossel!
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleting !== null}
        title="Excluir este rascunho?"
        message={
          deleting
            ? `“${deleting.title}” sai da sua lista. Você pode desfazer pelo aviso que aparece logo depois.`
            : ''
        }
        confirmLabel="Sim, excluir"
        cancelLabel="Deixar como está"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleting(null)}
      />

      {exportingDraftId && (
        <HomeDraftExporter
          draftId={exportingDraftId}
          onDone={() => setExportingDraftId(null)}
        />
      )}
    </div>
  );
};
