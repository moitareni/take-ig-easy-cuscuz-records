import React from 'react';
import { Trash2 } from 'lucide-react';
import type { PostFormat } from '../../brand/brand';
import { SlidePreview } from '../../canvas/SlidePreview';
import type { SlideData } from '../../types';
import styles from './SlideThumb.module.css';

export interface SlideThumbProps {
  slide: SlideData;
  prevSlide?: SlideData;
  nextSlide?: SlideData;
  index: number;
  totalSlides: number;
  format: PostFormat;
  isActive: boolean;
  onSelect: (index: number) => void;
  onRequestRemove: (index: number) => void;
  onPointerDownThumb: (index: number, e: React.PointerEvent<HTMLDivElement>) => void;
  shouldSuppressClick?: () => boolean;
  /** Enquanto a tira hidrata, as miniaturas e seus botões ficam desativados. */
  disabled?: boolean;
}

/** Largura da prévia; casa com as dimensões do `.thumbWrapper` por formato. */
export const SLIDE_PREVIEW_WIDTH: Record<PostFormat, number> = {
  '3:4': 60,
  '4:3': 88,
  '1:1': 72,
};

export const SlideThumb: React.FC<SlideThumbProps> = React.memo(
  ({
    slide,
    prevSlide,
    nextSlide,
    index,
    totalSlides,
    format,
    isActive,
    onSelect,
    onRequestRemove,
    onPointerDownThumb,
    shouldSuppressClick,
    disabled = false,
  }) => {
    const aspectClass =
      format === '4:3'
        ? styles.aspect43
        : format === '1:1'
          ? styles.aspect11
          : styles.aspect34;

    return (
      <div
        className={`${styles.thumbWrapper} ${aspectClass} ${isActive ? styles.active : ''}`}
        onPointerDown={(e) => onPointerDownThumb(index, e)}
        data-slide-index={index}
        data-slide-id={slide.id}
      >
        {/* Miniatura viva: renderiza o doc deste slide, sem captura/cache. */}
        <div className={styles.previewLayer}>
          <SlidePreview
            doc={slide.doc}
            finish={slide.finish}
            format={format}
            width={SLIDE_PREVIEW_WIDTH[format]}
            prevSlide={prevSlide}
            nextSlide={nextSlide}
          />
        </div>

        <button
          type="button"
          className={styles.thumbButton}
          onClick={() => {
            if (shouldSuppressClick?.()) return;
            onSelect(index);
          }}
          disabled={disabled}
          aria-label={`Slide ${index + 1}${isActive ? ' (ativo)' : ''}`}
          aria-current={isActive ? 'true' : undefined}
        />

        <span className={styles.ordinalBadge} aria-hidden="true">
          {index + 1}
        </span>

        <button
          type="button"
          data-no-drag="true"
          className={styles.trashBtn}
          aria-label={`Remover slide ${index + 1}`}
          title={
            totalSlides <= 1
              ? 'O carrossel precisa ter pelo menos 1 slide'
              : `Remover slide ${index + 1}`
          }
          disabled={disabled || totalSlides <= 1}
          onClick={(e) => {
            e.stopPropagation();
            onRequestRemove(index);
          }}
        >
          <Trash2 size={12} strokeWidth={2.5} />
        </button>
      </div>
    );
  },
);

SlideThumb.displayName = 'SlideThumb';
