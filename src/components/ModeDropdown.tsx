import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeftRight, Check, ChevronDown, Images, Sparkles } from 'lucide-react';
import styles from './ModeDropdown.module.css';

export type ModeValue = 'single' | 'carousel';

export interface ModeDropdownProps {
  value: ModeValue;
  onChange: (value: ModeValue) => void;
}

interface ModeOption {
  value: ModeValue;
  label: string;
  hint: string;
  icon: React.ReactNode;
}

const OPTIONS: ModeOption[] = [
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

const TOOLTIP =
  'Escolha entre Post único (uma arte) e Carrossel (várias artes). O que você já fez vai junto na troca.';

export const ModeDropdown: React.FC<ModeDropdownProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const current = OPTIONS.find((option) => option.value === value) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const index = OPTIONS.findIndex((option) => option.value === value);
    optionRefs.current[index >= 0 ? index : 0]?.focus();
  }, [open, value]);

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

  const select = (next: ModeValue) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (next !== value) onChange(next);
  };

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

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        data-testid="mode-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Modo: ${current.label}. Abrir lista de modos`}
        title={TOOLTIP}
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={handleTriggerKeyDown}
      >
        <ArrowLeftRight size={15} strokeWidth={2.5} aria-hidden="true" />
        <span>Modo</span>
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          aria-hidden="true"
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
        />
      </button>

      {open && (
        <ul
          className={styles.list}
          id={listId}
          role="listbox"
          aria-label="Escolher modo de criação"
        >
          {OPTIONS.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
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
                  {isSelected && <Check size={16} strokeWidth={3} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
