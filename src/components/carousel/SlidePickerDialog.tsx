import React, { useEffect, useState } from 'react';
import { getCachedSlideThumb } from '../../canvas/hooks/useSlideThumb';
import { convertActiveCarouselToSingle } from '../../lib/drafts/session';
import { useCarousel } from '../../store/carouselStore';
import { Button } from '../ui/Button';
import { PreviewImage } from '../ui/PreviewImage';
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

  const [selected, setSelected] = useState<SelectionOption>(activeSlideIndex);

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
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Escolher slide para Post Único"
      >
        <h3 className={styles.title}>Qual slide você quer manter? 🌽</h3>
        <p className={styles.message}>
          Escolha um dos slides pra levar pro post único.
        </p>

        <div className={styles.slideList}>
          {slides.map((slide, idx) => {
            const thumb = getCachedSlideThumb(slide.id);
            const isChosen = selected === idx;
            return (
              <button
                key={slide.id}
                type="button"
                className={`${styles.slideOption} ${isChosen ? styles.selected : ''}`}
                onClick={() => setSelected(idx)}
              >
                <div className={styles.thumbBox}>
                  <PreviewImage
                    src={thumb}
                    alt={`Miniatura do slide ${idx + 1}`}
                    imgClassName={styles.thumbImg}
                    eager
                    fallback={<span className={styles.thumbPlaceholder}>#{idx + 1}</span>}
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
