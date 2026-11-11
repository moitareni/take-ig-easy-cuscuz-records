import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import styles from './Toast.module.css';

export const Toast: React.FC = () => {
  const toast = useEditor((s) => s.toast);
  const dismissToast = useEditor((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      dismissToast();
    }, toast.duration ?? (toast.action ? 8000 : 4000));
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;

  const Icon =
    toast.kind === 'error'
      ? AlertCircle
      : toast.kind === 'success'
        ? CheckCircle
        : Info;

  return (
    <aside
      aria-label="Notificações"
      className={`${styles.toast} ${styles[toast.kind]}`}
      role="alert"
    >
      <div className={styles.icon}>
        <Icon size={20} strokeWidth={3} />
      </div>
      <span className={styles.message}>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            const action = toast.action;
            dismissToast();
            action?.onClick();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        className={styles.close}
        onClick={dismissToast}
        aria-label="Fechar notificação"
      >
        <X size={16} strokeWidth={3} />
      </button>
    </aside>
  );
};
