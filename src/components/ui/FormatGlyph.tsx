import React from 'react';
import { POST_FORMATS, type PostFormat } from '../../brand/brand';
import styles from './FormatGlyph.module.css';

export interface FormatGlyphProps {
  format: PostFormat;
  /** Maior lado em px. */
  size?: number;
}

/** Retângulo na proporção real do formato. Decorativo: o rótulo já traz o nome. */
export const FormatGlyph: React.FC<FormatGlyphProps> = ({ format, size = 18 }) => {
  const { width, height } = POST_FORMATS[format];
  const ratio = width / height;
  return (
    <span
      className={styles.glyph}
      data-testid="format-glyph"
      aria-hidden="true"
      style={{
        width: ratio >= 1 ? size : size * ratio,
        height: ratio >= 1 ? size / ratio : size,
      }}
    />
  );
};
