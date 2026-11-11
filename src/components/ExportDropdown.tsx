import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Download, FileImage, Images } from 'lucide-react';
import styles from './ExportDropdown.module.css';

export interface ExportDropdownProps {
  disabled?: boolean;
  label?: string;
  totalSlides: number;
  onExportCurrent: () => void;
  onExportAll: () => void;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  disabled = false,
  label = 'Exportação',
  totalSlides,
  onExportCurrent,
  onExportAll,
}) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

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

  const options = [
    {
      id: 'current',
      label: 'Somente este slide',
      countBadge: null as string | null,
      icon: <FileImage size={18} strokeWidth={2.5} />,
      onSelect: onExportCurrent,
    },
    {
      id: 'all',
      label: 'Todos os slides',
      countBadge: `${totalSlides}`,
      icon: <Images size={18} strokeWidth={2.5} />,
      onSelect: onExportAll,
    },
  ];

  const focusOption = (index: number) => {
    const wrapped = (index + options.length) % options.length;
    optionRefs.current[wrapped]?.focus();
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' && !open && !disabled) {
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
        focusOption(options.length - 1);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const handlePick = (action: () => void) => {
    setOpen(false);
    triggerRef.current?.focus();
    action();
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        data-testid="export-dropdown-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
      >
        <Download size={15} strokeWidth={2.5} aria-hidden="true" />
        <span>{label}</span>
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
          id={menuId}
          role="menu"
          aria-label="Opções de exportação do carrossel"
        >
          {options.map((option, index) => (
            <li key={option.id} role="none">
              <button
                type="button"
                role="menuitem"
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                className={styles.option}
                tabIndex={-1}
                onClick={() => handlePick(option.onSelect)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
              >
                <span className={styles.optionIcon} aria-hidden="true">
                  {option.icon}
                </span>
                <span className={styles.optionLabel}>{option.label}</span>
                {option.countBadge !== null && (
                  <span className={styles.countBadge}>{option.countBadge}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
