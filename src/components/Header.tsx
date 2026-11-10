import React, { useState } from 'react';
import { Download, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import { POST_FORMATS, type PostFormat } from '../brand/brand';
import { switchSingleToCarousel, useCarousel } from '../store/carouselStore';
import { redo, undo, useEditor } from '../store/editorStore';
import { ConfirmDialog } from './ConfirmDialog';
import { ModeDropdown, type ModeValue } from './ModeDropdown';
import { SlidePickerDialog } from './carousel/SlidePickerDialog';
import { Button } from './ui/Button';
import { FormatGlyph } from './ui/FormatGlyph';
import { IconButton } from './ui/IconButton';
import styles from './Header.module.css';

export interface HeaderProps {
  onExportCarousel?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onExportCarousel }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showModeConfirm, setShowModeConfirm] = useState(false);
  const [showSlidePicker, setShowSlidePicker] = useState(false);

  const reset = useEditor((s) => s.reset);
  const showToast = useEditor((s) => s.showToast);

  const mode = useCarousel((s) => s.mode);
  const format = useCarousel((s) => s.format);
  const isExporting = useCarousel((s) => s.isExporting);
  const exportProgress = useCarousel((s) => s.exportProgress);
  const docFormat = useEditor((s) => s.doc.format) ?? '3:4';
  const activeFormat: PostFormat = mode === 'carousel' ? format : docFormat;

  const handleConfirmReset = () => {
    reset();
    if (mode === 'carousel') {
      useEditor.getState().setFormat(format);
    }
    setShowConfirm(false);
    showToast('info', 'Tudo limpinho para um novo post ✨');
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

  const exportLabel =
    isExporting && exportProgress
      ? `Exportando slide ${exportProgress.current} de ${exportProgress.total}...`
      : 'Exportar carrossel';

  return (
    <>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img
            src="/brand/favicon-64.png"
            alt="Logo Cuscuz Records"
            className={styles.logo}
          />
          <div>
            <h1 className={styles.title}>Cuscuz Records</h1>
            <span className={styles.subtitle}>
              <FormatGlyph format={activeFormat} size={13} />
              {mode === 'carousel' ? 'Carrossel' : 'Insta Kit'} · {POST_FORMATS[activeFormat].label}
            </span>
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.historyGroup}>
            <IconButton
              icon={<Undo2 size={18} strokeWidth={2.5} />}
              label="Desfazer (Ctrl+Z)"
              size="sm"
              onClick={() => undo()}
            />
            <IconButton
              icon={<Redo2 size={18} strokeWidth={2.5} />}
              label="Refazer (Ctrl+Shift+Z)"
              size="sm"
              onClick={() => redo()}
            />
          </div>

          {mode !== null && (
            <ModeDropdown
              value={mode}
              format={activeFormat}
              onChange={handleModeChange}
            />
          )}

          {mode === 'carousel' && (
            <Button
              variant="primary"
              size="sm"
              icon={<Download size={15} strokeWidth={2.5} />}
              disabled={isExporting}
              onClick={onExportCarousel}
            >
              {exportLabel}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw size={15} strokeWidth={2.5} />}
            onClick={() => setShowConfirm(true)}
          >
            Começar do zero
          </Button>
        </div>
      </header>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Começar do zero?"
        message="Isso vai limpar o post atual e remover todos os elementos da folha. Deseja continuar?"
        onConfirm={handleConfirmReset}
        onCancel={() => setShowConfirm(false)}
      />

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
