import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { CAROUSEL_MAX_SLIDES } from '../../brand/brand';
import { SlidePreview } from '../../canvas/SlidePreview';
import { useSlideReorderMotion } from '../../hooks/useSlideReorderMotion';
import { isSlideEmpty, useCarousel } from '../../store/carouselStore';
import { useEditor } from '../../store/editorStore';
import { ConfirmDialog } from '../ConfirmDialog';
import { Button } from '../ui/Button';
import { SLIDE_PREVIEW_WIDTH, SlideThumb } from './SlideThumb';
import styles from './SlideTray.module.css';

/** Teto de segurança: os botões nunca ficam travados se algo falhar. */
const TRAY_READY_TIMEOUT_MS = 1500;

export const SlideTray: React.FC = () => {
  const slides = useCarousel((s) => s.slides);
  const activeSlideIndex = useCarousel((s) => s.activeSlideIndex);
  const format = useCarousel((s) => s.format);
  const addSlide = useCarousel((s) => s.addSlide);
  const duplicateSlide = useCarousel((s) => s.duplicateSlide);
  const removeSlide = useCarousel((s) => s.removeSlide);
  const reorderSlides = useCarousel((s) => s.reorderSlides);
  const setActiveSlide = useCarousel((s) => s.setActiveSlide);
  const showToast = useEditor((s) => s.showToast);

  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);
  const [trayReady, setTrayReady] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  const pendingFocusSlideRef = useRef<number | null>(null);

  const {
    activeDrag,
    handleThumbPointerDown,
    shouldSuppressClick,
  } = useSlideReorderMotion({
    listRef,
    floatingRef,
    ghostRef,
    badgeRef,
    slides,
    format,
    disabled: !trayReady,
    onReorder: reorderSlides,
  });

  // As miniaturas são renderizadas ao vivo a partir do doc: já estão prontas
  // no primeiro frame. O timeout é só uma rede de segurança.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setTrayReady(true));
    const timer = setTimeout(() => setTrayReady(true), TRAY_READY_TIMEOUT_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []);

  // Mantém a miniatura ativa visível na tira (especialmente ao criar/duplicar
  // slide além da largura visível) e transfere o foco para o novo slide.
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;
    const activeWrapper = listEl.querySelector<HTMLElement>(
      `[data-slide-index="${activeSlideIndex}"]`,
    );
    if (!activeWrapper) return;

    const listRect = listEl.getBoundingClientRect();
    if (listRect.width > 0) {
      const thumbRect = activeWrapper.getBoundingClientRect();
      const addBtn =
        activeSlideIndex === slides.length - 1
          ? listEl.querySelector<HTMLElement>('button[aria-label="Novo slide vazio"]')
          : null;
      const addRect = addBtn?.getBoundingClientRect() ?? null;
      const rightEdge = addRect ? Math.max(thumbRect.right, addRect.right) : thumbRect.right;
      const pad = 8;
      const maxRightDelta = thumbRect.left - (listRect.left + pad);

      if (thumbRect.left < listRect.left + pad) {
        listEl.scrollLeft += thumbRect.left - (listRect.left + pad);
      } else if (rightEdge > listRect.right - pad) {
        const needed = rightEdge - (listRect.right - pad);
        const thumbNeeded = thumbRect.right - (listRect.right - pad);
        listEl.scrollLeft += needed <= maxRightDelta ? needed : Math.max(0, thumbNeeded);
      }
    }

    if (pendingFocusSlideRef.current === activeSlideIndex) {
      pendingFocusSlideRef.current = null;
      const thumbBtn = activeWrapper.querySelector<HTMLButtonElement>('button[aria-current="true"]');
      thumbBtn?.focus({ preventScroll: true });
    }
  }, [activeSlideIndex, slides.length]);

  const atMaxSlides = slides.length >= CAROUSEL_MAX_SLIDES;
  const atMinSlides = slides.length <= 1;
  const addAspectClass =
    format === '4:3'
      ? styles.addAspect43
      : format === '1:1'
        ? styles.addAspect11
        : styles.addAspect34;

  const handleAddSlide = () => {
    if (atMaxSlides) {
      showToast('info', 'Máximo de 10 slides atingido!');
      return;
    }
    const willHitMax = slides.length + 1 >= CAROUSEL_MAX_SLIDES;
    pendingFocusSlideRef.current = slides.length;
    addSlide();
    if (willHitMax) {
      showToast('info', 'Máximo de 10 slides atingido!');
    }
  };

  const handleDuplicateSlide = () => {
    if (atMaxSlides) {
      showToast('info', 'Máximo de 10 slides atingido!');
      return;
    }
    const willHitMax = slides.length + 1 >= CAROUSEL_MAX_SLIDES;
    pendingFocusSlideRef.current = activeSlideIndex + 1;
    duplicateSlide(activeSlideIndex);
    if (willHitMax) {
      showToast('info', 'Máximo de 10 slides atingido!');
    }
  };

  const handleRequestRemove = useCallback(
    (index: number) => {
      if (slides.length <= 1) {
        showToast('info', 'O carrossel precisa ter pelo menos 1 slide 😅');
        return;
      }
      const target = slides[index];
      if (!target) return;
      if (isSlideEmpty(target)) {
        removeSlide(index);
      } else {
        setPendingRemoveIndex(index);
      }
    },
    [slides, removeSlide, showToast],
  );

  const handleConfirmRemove = () => {
    if (pendingRemoveIndex !== null) {
      removeSlide(pendingRemoveIndex);
      setPendingRemoveIndex(null);
    }
  };

  return (
    <>
      <nav
        aria-label="Tira de slides do carrossel"
        className={styles.tray}
        aria-busy={!trayReady}
      >
        <div ref={listRef} className={styles.thumbList}>
          {activeDrag && (
            <div
              ref={ghostRef}
              className={styles.dropGhost}
              style={{
                width: activeDrag.width,
                height: activeDrag.height,
              }}
              aria-hidden="true"
            >
              {activeDrag.hasCrossoverLeft && (
                <span className={`${styles.ghostCrossoverCue} ${styles.ghostCueLeft}`} />
              )}
              {activeDrag.hasCrossoverRight && (
                <span className={`${styles.ghostCrossoverCue} ${styles.ghostCueRight}`} />
              )}
            </div>
          )}

          {slides.map((slide, index) => (
            <SlideThumb
              key={slide.id}
              slide={slide}
              prevSlide={slides[index - 1]}
              nextSlide={slides[index + 1]}
              index={index}
              totalSlides={slides.length}
              format={format}
              isActive={index === activeSlideIndex}
              onSelect={setActiveSlide}
              onMoveSlide={reorderSlides}
              onRequestRemove={handleRequestRemove}
              onPointerDownThumb={handleThumbPointerDown}
              shouldSuppressClick={shouldSuppressClick}
              disabled={!trayReady}
            />
          ))}

          <button
            type="button"
            className={`${styles.addThumbBtn} ${addAspectClass}`}
            aria-label="Novo slide vazio"
            title={
              atMaxSlides ? 'Chegou no limite de 10 slides' : 'Adicionar novo slide vazio'
            }
            disabled={!trayReady || atMaxSlides}
            onClick={handleAddSlide}
          >
            <Plus size={20} strokeWidth={2.75} />
          </button>
        </div>

        {!trayReady && (
          <span className={styles.loading} role="status" aria-live="polite">
            <span className={styles.loadingDot} aria-hidden="true" />
            Preparando as miniaturas...
          </span>
        )}

        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            icon={<Copy size={14} strokeWidth={2.5} />}
            disabled={!trayReady || atMaxSlides}
            onClick={handleDuplicateSlide}
          >
            Duplicar slide atual
          </Button>

          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={14} strokeWidth={2.5} />}
            disabled={!trayReady || atMinSlides}
            onClick={() => handleRequestRemove(activeSlideIndex)}
          >
            Remover slide
          </Button>
        </div>
      </nav>

      <ConfirmDialog
        isOpen={pendingRemoveIndex !== null}
        title="Apagar este slide?"
        message="Apagar este slide? O conteúdo vai embora 🗑️"
        confirmLabel="Sim, apagar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmRemove}
        onCancel={() => setPendingRemoveIndex(null)}
      />

      {activeDrag &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={floatingRef}
            className={styles.floatingDragCard}
            style={{
              width: activeDrag.width,
              height: activeDrag.height,
            }}
            aria-hidden="true"
          >
            <div className={styles.floatingPreview}>
              <SlidePreview
                doc={activeDrag.slide.doc}
                finish={activeDrag.slide.finish}
                format={format}
                width={SLIDE_PREVIEW_WIDTH[format]}
              />
            </div>
            <span ref={badgeRef} className={styles.floatingBadge}>
              {activeDrag.fromIndex + 1}
            </span>
          </div>,
          document.body,
        )}
    </>
  );
};

export default SlideTray;
