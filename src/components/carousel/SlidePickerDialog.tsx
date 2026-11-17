import React, { useEffect, useId, useRef, useState } from 'react';
import { SlidePreview } from '../../canvas/SlidePreview';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { convertActiveCarouselToSingle } from '../../lib/drafts/session';
import { useCarousel } from '../../store/carouselStore';
import { Button } from '../ui/Button';
import styles from './SlidePickerDialog.module.css';

export interface SlidePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type SelectionOption = number | 'scratch';

export const SlidePickerDialog: React.FC<SlidePickerDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const slides = useCarousel((s) => s.slides);
  const activeSlideIndex = useCarousel((s) => s.activeSlideIndex);
  const format = useCarousel((s) => s.format);

  const [selected, setSelected] = useState<SelectionOption>(activeSlideIndex);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const messageId = useId();

  useDialogFocus({
    isOpen,
    dialogRef,
    onClose,
  });

  useEffect(() => {
    if (isOpen) setSelected(activeSlideIndex);
  }, [isOpen, activeSlideIndex]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    convertActiveCarouselToSingle(selected === 'scratch' ? null : selected);
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Escolher slide para Post Único"
        aria-describedby={messageId}
      >
        <h3 id={titleId} className={styles.title}>Qual slide você quer manter? 🌽</h3>
        <p id={messageId} className={styles.message}>
          Escolha um dos slides pra levar pro post único.
        </p>

        <div className={styles.slideList}>
          {slides.map((slide, idx) => {
            const isChosen = selected === idx;
            return (
              <button
                key={slide.id}
                type="button"
                className={`${styles.slideOption} ${isChosen ? styles.selected : ''}`}
                onClick={() => setSelected(idx)}
              >
                <div className={styles.thumbBox}>
                  <SlidePreview
                    doc={slide.doc}
                    finish={slide.finish}
                    format={format}
                    width={60}
                    prevSlide={slides[idx - 1]}
                    nextSlide={slides[idx + 1]}
                  />
                </div>
                <span className={styles.slideLabel}>Slide {idx + 1}</span>
              </button>
            );
          })}

          <button
            type="button"
            className={`${styles.slideOption} ${styles.scratchOption} ${
              selected === 'scratch' ? styles.selected : ''
            }`}
            onClick={() => setSelected('scratch')}
          >
            <div className={styles.thumbBox}>
              <span className={styles.thumbPlaceholder}>✨</span>
            </div>
            <span className={styles.slideLabel}>Começar do zero</span>
          </button>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" onClick={handleConfirm}>
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
};
