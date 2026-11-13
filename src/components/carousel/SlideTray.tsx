import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { CAROUSEL_MAX_SLIDES } from '../../brand/brand';
import { SlidePreview } from '../../canvas/SlidePreview';
import { useSlideReorderMotion } from '../../hooks/useSlideReorderMotion';
import { isSlideEmpty, useCarousel } from '../../store/carouselStore';
import { useEditor } from '../../store/editorStore';
import { ConfirmDialog } from '../ConfirmDialog';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
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

  const atMaxSlides = slides.length >= CAROUSEL_MAX_SLIDES;
  const atMinSlides = slides.length <= 1;
  const hasPrev = activeSlideIndex > 0;
  const hasNext = activeSlideIndex < slides.length - 1;

  const handleAddSlide = () => {
    if (atMaxSlides) {
      showToast('info', 'Chegou no limite! Um carrossel pode ter até 10 slides 🎠');
      return;
    }
    const willHitMax = slides.length + 1 >= CAROUSEL_MAX_SLIDES;
    addSlide();
    if (willHitMax) {
      showToast('info', 'Chegou no limite! Um carrossel pode ter até 10 slides 🎠');
    }
  };

  const handleDuplicateSlide = () => {
    if (atMaxSlides) {
      showToast('info', 'Chegou no limite! Um carrossel pode ter até 10 slides 🎠');
      return;
    }
    const willHitMax = slides.length + 1 >= CAROUSEL_MAX_SLIDES;
    duplicateSlide(activeSlideIndex);
    if (willHitMax) {
      showToast('info', 'Chegou no limite! Um carrossel pode ter até 10 slides 🎠');
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
        <div className={styles.stripRow}>
          <IconButton
            icon={<ChevronLeft size={18} strokeWidth={2.5} />}
            label="Slide anterior"
            size="sm"
            disabled={!trayReady || !hasPrev}
            onClick={() => setActiveSlide(activeSlideIndex - 1)}
          />

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
                onRequestRemove={handleRequestRemove}
                onPointerDownThumb={handleThumbPointerDown}
                shouldSuppressClick={shouldSuppressClick}
                disabled={!trayReady}
              />
            ))}

            <button
              type="button"
              className={styles.addThumbBtn}
              aria-label="Novo slide vazio"
              title={
                atMaxSlides
                  ? 'Chegou no limite de 10 slides'
                  : 'Adicionar novo slide vazio'
              }
              disabled={!trayReady || atMaxSlides}
              onClick={handleAddSlide}
            >
              <Plus size={20} strokeWidth={2.75} />
            </button>
          </div>

          <IconButton
            icon={<ChevronRight size={18} strokeWidth={2.5} />}
            label="Próximo slide"
            size="sm"
            disabled={!trayReady || !hasNext}
            onClick={() => setActiveSlide(activeSlideIndex + 1)}
          />
        </div>

        <div className={styles.controlsRow}>
          <span className={styles.counter}>
            Slide {activeSlideIndex + 1} de {slides.length}
          </span>

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
              icon={<Plus size={14} strokeWidth={2.5} />}
              disabled={!trayReady || atMaxSlides}
              onClick={handleAddSlide}
            >
              Novo slide vazio
            </Button>

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
