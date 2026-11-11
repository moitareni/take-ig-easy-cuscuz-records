import React from 'react';
import { Check } from 'lucide-react';
import { preloadImage, useCanvasActivity, useLoadingImages } from '../../lib/useImage';
import { useDelayedFlag } from '../../lib/useDelayedFlag';
import { PreviewImage } from './PreviewImage';
import styles from './ThumbGrid.module.css';

export interface ThumbItem {
  id: string;
  label: string;
  thumb: string;
  src?: string;
}

export interface ThumbGridProps {
  items: ThumbItem[];
  selectedId?: string | null;
  aspectRatio?: '3-4' | '4-3' | '1-1';
  columns?: 2 | 3;
  onSelect: (id: string) => void;
}

export const ThumbGrid: React.FC<ThumbGridProps> = ({
  items,
  selectedId,
  aspectRatio = '3-4',
  columns = 2,
  onSelect,
}) => {
  const loadingUrls = useLoadingImages();
  const activity = useCanvasActivity();
  // Spinner na miniatura só se a espera passar de ~200 ms (esperas curtas não piscam).
  const waiting = useDelayedFlag(loadingUrls.size > 0 || activity !== null);

  return (
    <div className={`${styles.grid} ${styles[`cols-${columns}`]}`}>
      {items.map((item) => {
        const isSelected = selectedId === item.id;
        const isLoadingOnCanvas = waiting && Boolean(
          item.src &&
            (loadingUrls.has(item.src) || (activity?.targetSrc && activity.targetSrc === item.src)),
        );
        return (
          <button
            key={item.id}
            type="button"
            className={`${styles.item} ${styles[aspectRatio]} ${isSelected ? styles.selected : ''}`}
            onMouseEnter={() => {
              if (item.src) void preloadImage(item.src);
            }}
            onFocus={() => {
              if (item.src) void preloadImage(item.src);
            }}
            onClick={() => onSelect(item.id)}
            title={item.label}
          >
            <div className={styles.imageWrapper}>
              <PreviewImage src={item.thumb} alt={item.label} imgClassName={styles.image}>
                {(isSelected || isLoadingOnCanvas) && (
                  <span
                    className={`${styles.checkBadge} ${
                      isLoadingOnCanvas ? styles.checkBadgeLoading : ''
                    }`}
                  >
                    {isLoadingOnCanvas ? (
                      <span className={styles.badgeSpinner} aria-hidden="true" />
                    ) : (
                      <Check size={14} strokeWidth={4} color="#0b0500" />
                    )}
                  </span>
                )}
              </PreviewImage>
            </div>
            <span className={styles.label}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
