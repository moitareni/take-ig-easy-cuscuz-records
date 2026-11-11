import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { getBackground } from '../../assets';
import type { PostFormat } from '../../brand/brand';
import type { EditorCanvasHandle } from '../../canvas/EditorCanvas';
import { useSlideThumb } from '../../canvas/hooks/useSlideThumb';
import { PreviewImage, type PreviewImageStatus } from '../ui/PreviewImage';
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
  stageRef: React.RefObject<EditorCanvasHandle | null>;
  onSelect: (index: number) => void;
  onRequestRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Enquanto a tira hidrata, as miniaturas e seus botões ficam desativados. */
  disabled?: boolean;
  /** Avisa que a prévia deste slide terminou (libera os botões da tira). */
  onPreviewReady?: (index: number) => void;
}

export const SlideThumb: React.FC<SlideThumbProps> = ({
  slide,
  prevSlide,
  nextSlide,
  index,
  totalSlides,
  format,
  isActive,
  stageRef,
  onSelect,
  onRequestRemove,
  onReorder,
  disabled = false,
  onPreviewReady,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsVisible(entry.isIntersecting);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const thumbUrl = useSlideThumb(
    stageRef,
    slide,
    format,
    isActive,
    isVisible,
    prevSlide,
    nextSlide,
  );
  const bgAsset = getBackground(slide.doc.backgroundId);
  const previewSrc = thumbUrl ?? bgAsset?.thumb ?? null;

  // Só a miniatura do slide ativo libera os botões. `error` também libera:
  // uma captura que falhou nunca pode deixar a tira travada.
  const handlePreviewStatus = (status: PreviewImageStatus) => {
    if (status === 'loaded' || status === 'error') onPreviewReady?.(index);
  };

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
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!Number.isNaN(from) && from !== index) {
      onReorder(from, index);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.thumbWrapper} ${aspectClass} ${isActive ? styles.active : ''}`}
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-slide-index={index}
    >
      <button
        type="button"
        className={styles.thumbButton}
        onClick={() => onSelect(index)}
        disabled={disabled}
        aria-label={`Slide ${index + 1}${isActive ? ' (ativo)' : ''}`}
        aria-current={isActive ? 'true' : undefined}
      >
        {/* Slide ativo sem miniatura ainda: mostra o spinner em vez do "Vazio"
            que piscava e sumia. Slides inativos/verdadeiramente vazios mantêm
            o estado neutro. */}
        <PreviewImage
          src={previewSrc}
          alt={`Miniatura do slide ${index + 1}`}
          imgClassName={styles.thumbImage}
          onStatusChange={handlePreviewStatus}
          eager
          fallback={
            isActive && !previewSrc ? undefined : (
              <span className={styles.placeholder}>
                <span className={styles.placeholderText}>Vazio</span>
              </span>
            )
          }
        />
      </button>

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
