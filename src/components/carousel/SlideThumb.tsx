import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { PostFormat } from '../../brand/brand';
import { SlidePreview } from '../../canvas/SlidePreview';
import { dropPositionFromPointer, type DropPosition } from '../../lib/slideOrder';
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
  /** `position` é o lado do alvo onde a página deve entrar (antes/depois). */
  onReorder: (fromIndex: number, targetIndex: number, position: DropPosition) => void;
  /** Enquanto a tira hidrata, as miniaturas e seus botões ficam desativados. */
  disabled?: boolean;
}

/** Largura da prévia; casa com as dimensões do `.thumbWrapper` por formato. */
const PREVIEW_WIDTH: Record<PostFormat, number> = { '3:4': 60, '4:3': 88, '1:1': 72 };

export const SlideThumb: React.FC<SlideThumbProps> = ({
  slide,
  prevSlide,
  nextSlide,
  index,
  totalSlides,
  format,
  isActive,
  onSelect,
  onRequestRemove,
  onReorder,
  disabled = false,
}) => {
  const [dropSide, setDropSide] = useState<DropPosition | null>(null);

  const aspectClass =
    format === '4:3'
      ? styles.aspect43
      : format === '1:1'
        ? styles.aspect11
        : styles.aspect34;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Não deixa o arraste de páginas chegar ao canvas / outros handlers.
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const side = dropPositionFromPointer(e.clientX, e.currentTarget.getBoundingClientRect());
    setDropSide((cur) => (cur === side ? cur : side));
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDropSide(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    const from = Number.parseInt(e.dataTransfer.getData('text/plain'), 10);
    const position = dropPositionFromPointer(
      e.clientX,
      e.currentTarget.getBoundingClientRect(),
    );
    setDropSide(null);
    if (!Number.isNaN(from)) {
      onReorder(from, index, position);
    }
  };

  return (
    <div
      className={`${styles.thumbWrapper} ${aspectClass} ${isActive ? styles.active : ''}`}
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={() => setDropSide(null)}
      data-slide-index={index}
    >
      {dropSide && (
        <span
          className={styles.dropIndicator}
          data-side={dropSide}
          data-drop-indicator={dropSide}
          aria-hidden="true"
        />
      )}

      {/* Miniatura viva: renderiza o doc deste slide, sem captura/cache. */}
      <div className={styles.previewLayer}>
        <SlidePreview
          doc={slide.doc}
          finish={slide.finish}
          format={format}
          width={PREVIEW_WIDTH[format]}
          prevSlide={prevSlide}
          nextSlide={nextSlide}
        />
      </div>

      <button
        type="button"
        className={styles.thumbButton}
        onClick={() => onSelect(index)}
        disabled={disabled}
        aria-label={`Slide ${index + 1}${isActive ? ' (ativo)' : ''}`}
        aria-current={isActive ? 'true' : undefined}
      />

      <span className={styles.ordinalBadge} aria-hidden="true">
        {index + 1}
      </span>

      <button
        type="button"
        className={styles.trashBtn}
        aria-label={`Remover slide ${index + 1}`}
        title={totalSlides <= 1 ? 'O carrossel precisa ter pelo menos 1 slide' : `Remover slide ${index + 1}`}
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
};
