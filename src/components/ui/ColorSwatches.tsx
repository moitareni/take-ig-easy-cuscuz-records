import React from 'react';
import { Check } from 'lucide-react';
import { COLOR_LABELS, COLORS, type BrandColor } from '../../brand/brand';
import styles from './ColorSwatches.module.css';

export interface ColorSwatchesProps {
  value?: BrandColor;
  onChange: (color: BrandColor) => void;
  label?: string;
  colors?: readonly BrandColor[];
  columns?: 2 | 4 | 5;
  ariaLabelPrefix?: string;
}

const COLOR_KEYS = Object.keys(COLORS) as BrandColor[];

export const ColorSwatches: React.FC<ColorSwatchesProps> = ({
  value,
  onChange,
  label = 'Cor do texto:',
  colors = COLOR_KEYS,
  columns = 2,
  ariaLabelPrefix,
}) => {
  const columnClass =
    columns === 5 ? styles.swatches5 : columns === 4 ? styles.swatches4 : '';
  return (
    <div className={styles.container}>
      <span className={styles.label}>{label}</span>
      <div className={`${styles.swatches} ${columnClass}`}>
        {colors.map((k) => {
          const hex = COLORS[k];
          const isSelected = value === k;
          const isLight = k === 'creme' || k === 'amarelo' || k === 'amareloQuente';
          const name = COLOR_LABELS[k];
          return (
            <button
              key={k}
              type="button"
              className={`${styles.swatch} ${isSelected ? styles.selected : ''}`}
              style={{ backgroundColor: hex }}
              onClick={() => onChange(k)}
              title={`${name} (${hex})`}
              aria-label={ariaLabelPrefix ? `${ariaLabelPrefix}: ${name}` : name}
              aria-pressed={isSelected}
            >
              {isSelected && (
                <Check
                  size={16}
                  strokeWidth={4}
                  color={isLight ? '#0b0500' : '#ffffff'}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
