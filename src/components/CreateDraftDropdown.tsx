import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Images, Plus, Sparkles } from 'lucide-react';
import styles from './CreateDraftDropdown.module.css';

export type CreateDraftKind = 'single' | 'carousel';

interface CreateOption {
  value: CreateDraftKind;
  label: string;
  hint: string;
  icon: React.ReactNode;
}

const OPTIONS: CreateOption[] = [
  {
    value: 'single',
    label: 'Post único',
    hint: 'Uma arte só',
    icon: <Sparkles size={18} strokeWidth={2.5} />,
  },
  {
    value: 'carousel',
    label: 'Carrossel',
    hint: 'Várias artes em sequência',
    icon: <Images size={18} strokeWidth={2.5} />,
  },
];

const TOOLTIP = 'Escolha entre Post único (uma arte) e Carrossel (várias artes).';

export interface CreateDraftDropdownProps {
  onSelect: (kind: CreateDraftKind) => void;
  /** Centraliza o menu sob o gatilho (usado no quadro vazio, longe da borda da tela). */
  centered?: boolean;
  /** Gatilho em bloco: ocupa toda a caixa e a altura do card vizinho (home com rascunhos). */
  block?: boolean;
}

export const CreateDraftDropdown: React.FC<CreateDraftDropdownProps> = ({
  onSelect,
  centered = false,
  block = false,
}) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const focusOption = (index: number) => {
    const wrapped = (index + OPTIONS.length) % OPTIONS.length;
    optionRefs.current[wrapped]?.focus();
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' && !open) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusOption(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusOption(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusOption(0);
        break;
      case 'End':
        event.preventDefault();
        focusOption(OPTIONS.length - 1);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const select = (kind: CreateDraftKind) => {
    setOpen(false);
    triggerRef.current?.focus();
    onSelect(kind);
  };

  return (
    <div
      className={`${styles.root} ${centered ? styles.rootCentered : ''} ${block ? styles.rootBlock : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        ref={triggerRef}
        className={`${styles.trigger} ${block ? styles.triggerBlock : ''} ${open ? styles.triggerOpen : ''}`}
        data-testid="create-draft-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={TOOLTIP}
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={handleTriggerKeyDown}
      >
        <Plus size={18} strokeWidth={3} aria-hidden="true" />
        <span>Criar novo</span>
        <ChevronDown
          size={15}
          strokeWidth={2.5}
          aria-hidden="true"
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
        />
      </button>

      {open && (
        <ul className={styles.list} id={menuId} role="menu" aria-label="Criar novo rascunho">
          {OPTIONS.map((option, index) => (
            <li key={option.value} role="none">
              <button
                type="button"
                role="menuitem"
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                className={styles.option}
                tabIndex={-1}
                onClick={() => select(option.value)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
              >
                <span className={styles.optionIcon} aria-hidden="true">
                  {option.icon}
                </span>
                <span className={styles.optionText}>
                  <span className={styles.optionLabel}>{option.label}</span>
                  <span className={styles.optionHint}>{option.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
