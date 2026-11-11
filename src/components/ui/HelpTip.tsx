import React, { useEffect, useId, useRef, useState } from 'react';
import styles from './HelpTip.module.css';

export interface HelpTipProps {
  /** Texto explicativo exibido dentro do balão. */
  tip: string;
  /** Rótulo acessível do botão de ajuda. */
  label?: string;
}

export const HelpTip: React.FC<HelpTipProps> = ({
  tip,
  label = 'Mais informações',
}) => {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const lastPointerTypeRef = useRef<string>('mouse');
  const wasOpenBeforeDownRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className={styles.wrapper}
      onMouseEnter={() => {
        if (lastPointerTypeRef.current !== 'touch') setOpen(true);
      }}
      onMouseLeave={() => {
        if (lastPointerTypeRef.current !== 'touch') setOpen(false);
      }}
    >
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        aria-label={label}
        aria-describedby={tipId}
        aria-expanded={open}
        data-tip={tip}
        onPointerDown={(event) => {
          lastPointerTypeRef.current = event.pointerType || 'mouse';
          wasOpenBeforeDownRef.current = open;
        }}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
        onClick={() => {
          if (lastPointerTypeRef.current === 'touch' && wasOpenBeforeDownRef.current) {
            setOpen(false);
          } else {
            setOpen(true);
          }
        }}
      >
        ?
      </button>
      <span
        id={tipId}
        role="tooltip"
        className={`${styles.balloon} ${open ? styles.open : ''}`}
      >
        {tip}
      </span>
    </span>
  );
};
