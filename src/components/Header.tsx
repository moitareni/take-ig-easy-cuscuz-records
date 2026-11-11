import React, { useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, Download } from 'lucide-react';
import { POST_FORMATS, type PostFormat } from '../brand/brand';
import { closeDraftToHome, renameActiveDraft, retrySave } from '../lib/drafts/session';
import { switchSingleToCarousel, useCarousel } from '../store/carouselStore';
import { useEditor } from '../store/editorStore';
import { useDraftsStore, type SaveStatus } from '../store/draftsStore';
import { ConfirmDialog } from './ConfirmDialog';
import { ExportDropdown } from './ExportDropdown';
import { ModeDropdown, type ModeValue } from './ModeDropdown';
import { SlidePickerDialog } from './carousel/SlidePickerDialog';
import { Button } from './ui/Button';
import { FormatGlyph } from './ui/FormatGlyph';
import { IconButton } from './ui/IconButton';
import styles from './Header.module.css';

export interface HeaderProps {
  isExportingSingle?: boolean;
  onExportSingle?: () => void;
  onExportCarousel?: () => void;
}

const SAVE_STATUS_TEXT: Record<Exclude<SaveStatus, 'idle'>, string> = {
  dirty: 'Alterações...',
  saving: 'Salvando...',
  saved: 'Salvo',
  error: 'Não salvou',
};

export const Header: React.FC<HeaderProps> = ({
  isExportingSingle = false,
  onExportSingle,
  onExportCarousel,
}) => {
  const [showModeConfirm, setShowModeConfirm] = useState(false);
  const [showSlidePicker, setShowSlidePicker] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const closingTitleRef = useRef(false);

  const showToast = useEditor((s) => s.showToast);

  const mode = useCarousel((s) => s.mode);
  const format = useCarousel((s) => s.format);
  const slidesCount = useCarousel((s) => s.slides.length);
  const isExportingCarousel = useCarousel((s) => s.isExporting);
  const exportProgress = useCarousel((s) => s.exportProgress);
  const docFormat = useEditor((s) => s.doc.format) ?? '3:4';
  const activeFormat: PostFormat = mode === 'carousel' ? format : docFormat;

  const activeTitle = useDraftsStore((s) => s.activeTitle);
  const saveStatus = useDraftsStore((s) => s.saveStatus);

  const startEditingTitle = () => {
    closingTitleRef.current = false;
    setTitleDraft(activeTitle || 'Rascunho');
    setIsEditingTitle(true);
  };

  const commitTitleEdit = () => {
    if (closingTitleRef.current) return;
    closingTitleRef.current = true;
    setIsEditingTitle(false);
    const clean = titleDraft.replace(/\s+/g, ' ').trim();
    if (!clean || clean === activeTitle) return;
    void renameActiveDraft(clean);
  };

  const cancelTitleEdit = () => {
    closingTitleRef.current = true;
    setIsEditingTitle(false);
  };

  const handleModeChange = (next: ModeValue) => {
    if (next === mode) return;
    if (next === 'carousel') {
      setShowModeConfirm(true);
    } else {
      setShowSlidePicker(true);
    }
  };

  const handleConfirmModeSwitch = () => {
    setShowModeConfirm(false);
    switchSingleToCarousel();
    showToast('info', 'Modo Carrossel ativado! Seu post virou o primeiro card 🎠');
  };

  const handleBack = () => {
    void closeDraftToHome();
  };

  const carouselExportLabel =
    isExportingCarousel && exportProgress
      ? `Exportando slide ${exportProgress.current} de ${exportProgress.total}...`
      : isExportingSingle
        ? 'Exportando...'
        : 'Exportação';

  return (
    <>
      <header className={styles.header}>
        <div className={styles.left}>
          <IconButton
            icon={<ArrowLeft size={18} strokeWidth={2.5} />}
            label="Voltar para Meus rascunhos"
            size="sm"
            onClick={handleBack}
          />
          <div className={styles.titles}>
            {isEditingTitle ? (
              <div className={styles.titleEditWrapper}>
                <span className={styles.titleGhost} aria-hidden="true">
                  {titleDraft || ' '}
                </span>
                <input
                  type="text"
                  size={1}
                  className={styles.titleInput}
                  value={titleDraft}
                  maxLength={80}
                  autoFocus
                  aria-label="Nome do projeto"
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
              <h1
                className={styles.title}
                title={activeTitle || 'Rascunho'}
                onClick={startEditingTitle}
              >
                {activeTitle || 'Rascunho'}
              </h1>
            )}
            <span className={styles.subtitle}>
              <FormatGlyph format={activeFormat} size={13} />
              {mode === 'carousel' ? 'Carrossel' : 'Post único'} · {POST_FORMATS[activeFormat].label}
            </span>
          </div>

          {saveStatus !== 'idle' && (
            <span
              className={`${styles.saveStatus} ${styles[saveStatus]}`}
              role="status"
              aria-live="polite"
            >
              {saveStatus === 'error' ? (
                <AlertCircle size={15} strokeWidth={2.5} />
              ) : saveStatus === 'saved' ? (
                <Check size={15} strokeWidth={3} />
              ) : null}
              {SAVE_STATUS_TEXT[saveStatus]}
            </span>
          )}
          {saveStatus === 'error' && (
            <Button variant="secondary" size="sm" onClick={retrySave}>
              Tentar de novo
            </Button>
          )}
        </div>

        <div className={styles.controls}>
          {mode !== null && (
            <ModeDropdown
              value={mode}
              format={activeFormat}
              onChange={handleModeChange}
            />
          )}

          {mode === 'carousel' ? (
            <ExportDropdown
              disabled={isExportingCarousel || isExportingSingle}
              label={carouselExportLabel}
              totalSlides={slidesCount}
              onExportCurrent={() => onExportSingle?.()}
              onExportAll={() => onExportCarousel?.()}
            />
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={<Download size={15} strokeWidth={2.5} />}
              disabled={isExportingSingle}
              onClick={onExportSingle}
              aria-label={isExportingSingle ? 'Exportando post...' : 'Exportar'}
            >
              {isExportingSingle ? 'Exportando...' : 'Exportar'}
            </Button>
          )}
        </div>
      </header>

      <ConfirmDialog
        isOpen={showModeConfirm}
        title="Trocar pra Carrossel?"
        message="Troco pra Carrossel e levo as imagens que você já enviou? Seu post vira o primeiro card 🎠"
        confirmLabel="Bora, trocar!"
        cancelLabel="Ficar aqui"
        confirmVariant="primary"
        onConfirm={handleConfirmModeSwitch}
        onCancel={() => setShowModeConfirm(false)}
      />

      <SlidePickerDialog
        isOpen={showSlidePicker}
        onClose={() => setShowSlidePicker(false)}
      />
    </>
  );
};
