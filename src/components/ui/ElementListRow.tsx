import React from 'react';
import { Trash2 } from 'lucide-react';
import { IconButton } from './IconButton';
import styles from './ElementListRow.module.css';

export interface ElementListRowProps {
  label: React.ReactNode;
  /** Nome acessível do botão que ocupa a caixa inteira. */
  selectLabel: string;
  /** Nome acessível da lixeira. */
  removeLabel: string;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  /** Miniatura opcional (imagens do usuário). */
  leading?: React.ReactNode;
  /** Ponto de lista personalizado, no lugar da numeração "1. ...". */
  bullet?: boolean;
  /** Nome completo no tooltip, quando o label vem truncado. */
  title?: string;
}

/**
 * Linha do log "Na folha". O botão de seleção cobre a caixa toda; a lixeira é
 * um elemento irmão posicionado à direita, então excluir nunca seleciona.
 */
export const ElementListRow: React.FC<ElementListRowProps> = ({
  label,
  selectLabel,
  removeLabel,
  selected,
  onSelect,
  onRemove,
  leading,
  bullet = false,
  title,
}) => {
  return (
    <div className={`${styles.row} ${selected ? styles.selected : ''}`}>
      <button
        type="button"
        className={styles.hit}
        onClick={onSelect}
        aria-label={selectLabel}
        aria-pressed={selected}
        title={title}
      >
        {bullet && <span className={styles.bullet} aria-hidden="true" />}
        {leading && <span className={styles.leading}>{leading}</span>}
        <span className={styles.label}>{label}</span>
      </button>
      <span className={styles.remove}>
        <IconButton
          icon={<Trash2 size={14} strokeWidth={2.5} />}
          label={removeLabel}
          size="sm"
          variant="ghost"
          onClick={onRemove}
        />
      </span>
    </div>
  );
};
