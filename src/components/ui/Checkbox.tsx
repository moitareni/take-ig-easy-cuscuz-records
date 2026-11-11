import React from 'react';
import { Check } from 'lucide-react';
import styles from './Checkbox.module.css';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Nome acessível (o checkbox não tem texto visível próprio). */
  label: string;
  disabled?: boolean;
}

/**
 * Checkbox no tema do kit: quadrado "adesivo" com borda preta e sombra tátil,
 * amarelo da marca quando marcado. Usa um `<input type="checkbox">` real
 * (foco, espaço e leitores de tela funcionam de graça).
 */
export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, label, disabled }) => (
  <span className={styles.box}>
    <input
      type="checkbox"
      className={styles.input}
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
      // O clique no próprio checkbox não deve subir para o card (que também alterna).
      onClick={(e) => e.stopPropagation()}
    />
    <span className={`${styles.mark} ${checked ? styles.checked : ''}`} aria-hidden="true">
      {checked && <Check size={16} strokeWidth={4} color="#0b0500" />}
    </span>
  </span>
);
