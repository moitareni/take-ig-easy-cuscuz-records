import React, { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import styles from './Toast.module.css';

/** Esmaecimento final do balão, depois que a barra de tempo enche. */
const FADE_MS = 1200;
/** Abaixo disso o balão já está sumindo: passar o mouse não o segura mais. */
const MIN_SAVE_OPACITY = 0.05;

export const Toast: React.FC = () => {
  const toast = useEditor((s) => s.toast);
  const dismissToast = useEditor((s) => s.dismissToast);
  const toastRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const el = toastRef.current;
    const bar = barRef.current;
    if (!el || !bar) return;

    const duration = toast.duration ?? (toast.action ? 8000 : 4000);

    let frame = 0;
    let last = performance.now();
    let elapsed = 0;
    let fadeElapsed = 0;
    let fading = false;
    let paused = false;
    let finished = false;

    el.style.opacity = '1';
    bar.style.transform = 'scaleX(0)';

    const done = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      dismissToast();
    };

    const currentOpacity = () => Math.max(0, 1 - fadeElapsed / FADE_MS);

    const tick = (now: number) => {
      const delta = Math.min(64, now - last);
      last = now;

      if (!fading) {
        elapsed = Math.min(duration, elapsed + delta);
        if (elapsed >= duration) fading = true;
      } else if (!paused) {
        fadeElapsed += delta;
        const opacity = currentOpacity();
        el.style.opacity = String(opacity);
        if (opacity <= 0) {
          done();
          return;
        }
      }

      bar.style.transform = `scaleX(${elapsed / duration})`;
      frame = requestAnimationFrame(tick);
    };

    // Só um hover de verdade durante o esmaecimento resgata o balão.
    const rescue = () => {
      if (!fading || currentOpacity() <= MIN_SAVE_OPACITY) return;
      fadeElapsed = 0;
      paused = true;
      el.style.opacity = '1';
    };

    const handleLeave = () => {
      paused = false;
    };

    el.addEventListener('pointerenter', rescue);
    el.addEventListener('pointermove', rescue);
    el.addEventListener('pointerleave', handleLeave);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointerenter', rescue);
      el.removeEventListener('pointermove', rescue);
      el.removeEventListener('pointerleave', handleLeave);
    };
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
      ref={toastRef}
      aria-label="Notificações"
      className={`${styles.toast} ${styles[toast.kind]}`}
      role="alert"
    >
      <div className={styles.timer} ref={barRef} aria-hidden="true" />
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
