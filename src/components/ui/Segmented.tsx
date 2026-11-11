import React from 'react';
import styles from './Segmented.module.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  hint?: string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  /** `row` (padrão) ou `column` para grupos estreitos, como "Caixa de destaque". */
  direction?: 'row' | 'column';
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  direction = 'row',
  className = '',
}: SegmentedProps<T>) {
  return (
    <div className={`${styles.container} ${styles[size]} ${styles[direction]} ${className}`}>
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`${styles.segment} ${isSelected ? styles.selected : ''}`}
            onClick={() => onChange(opt.value)}
            title={opt.hint}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
