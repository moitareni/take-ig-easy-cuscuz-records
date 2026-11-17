import React, { useId, useRef } from 'react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { Button } from './ui/Button';
import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' para ações destrutivas; 'primary' para trocas sem perda de dados. */
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Sim, zerar tudo',
  cancelLabel = 'Cancelar',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  useDialogFocus({
    isOpen,
    dialogRef,
    initialFocusRef: cancelBtnRef,
    onClose: onCancel,
  });

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <h3 id={titleId} className={styles.title}>{title}</h3>
        <p id={messageId} className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <Button ref={cancelBtnRef} variant="secondary" size="md" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} size="md" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
