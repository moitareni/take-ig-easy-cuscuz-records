import React, { useEffect, useRef, useState } from 'react';
import styles from './FirefoxRoundScrollbar.module.css';

function isFirefoxBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Firefox\//i.test(navigator.userAgent);
}

interface BarMetric {
  id: number;
  el: HTMLElement;
  trackLeft: number;
  trackTop: number;
  trackHeight: number;
  thumbTop: number;
  thumbHeight: number;
  maxScroll: number;
  maxThumbOffset: number;
}

const TRACK_PAD = 4;

/**
 * No Firefox (Gecko), `scrollbar-color` renderiza uma barra quadrada com setas
 * nas pontas e ignora `::-webkit-scrollbar`. Este componente oculta a barra
 * nativa em todos os containers roláveis no Firefox e renderiza trilho + thumb
 * finos (6px) com bordas arredondadas, totalmente interativos (arrastar o thumb,
 * clicar no trilho, além do mouse wheel/teclado/touch nativos).
 */
export const FirefoxRoundScrollbar: React.FC = () => {
  const [enabled] = useState(isFirefoxBrowser);
  const [bars, setBars] = useState<BarMetric[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const barsRef = useRef<BarMetric[]>([]);
  barsRef.current = bars;

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add('ff-round-scrollbars');

    let rafId = 0;
    const compute = () => {
      rafId = 0;
      const candidates = document.querySelectorAll<HTMLElement>(
        '[class*="stepContent"] > *, [class*="canvasArea"] > [class*="container"], [class*="slideList"], [class*="dock"]',
      );
      const next: BarMetric[] = [];
      let id = 0;
      candidates.forEach((el) => {
        const sh = el.scrollHeight;
        const ch = el.clientHeight;
        if (sh <= ch + 2 || ch <= 0) return;
        const style = getComputedStyle(el);
        if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') return;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const borderRight = parseFloat(style.borderRightWidth) || 0;
        const trackHeight = Math.max(0, ch - TRACK_PAD * 2);
        const thumbHeight = Math.max(28, Math.round((ch / sh) * trackHeight));
        const maxScroll = Math.max(1, sh - ch);
        const maxThumbOffset = Math.max(0, trackHeight - thumbHeight);
        const clampedScroll = Math.min(maxScroll, Math.max(0, el.scrollTop));
        const thumbTop =
          rect.top + TRACK_PAD + (clampedScroll / maxScroll) * maxThumbOffset;

        next.push({
          id: id++,
          el,
          trackLeft: Math.round(rect.right - borderRight - 8),
          trackTop: Math.round(rect.top + TRACK_PAD),
          trackHeight: Math.round(trackHeight),
          thumbTop: Math.round(thumbTop),
          thumbHeight,
          maxScroll,
          maxThumbOffset,
        });
      });
      setBars(next);
    };

    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      document.documentElement.classList.remove('ff-round-scrollbars');
    };
  }, [enabled]);

  const handleTrackPointerDown = (bar: BarMetric, e: React.PointerEvent<HTMLDivElement>) => {
    // Se clicou diretamente no thumb, o handler do thumb cuida do arraste
    if ((e.target as HTMLElement).dataset.role === 'thumb') return;
    e.preventDefault();
    e.stopPropagation();

    const clickOffset = e.clientY - bar.trackTop - bar.thumbHeight / 2;
    const ratio = bar.maxThumbOffset > 0 ? Math.min(1, Math.max(0, clickOffset / bar.maxThumbOffset)) : 0;
    bar.el.scrollTop = ratio * bar.maxScroll;
    startThumbDrag(bar, e.clientY, ratio * bar.maxScroll);
  };

  const handleThumbPointerDown = (bar: BarMetric, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    startThumbDrag(bar, e.clientY, bar.el.scrollTop);
  };

  const startThumbDrag = (bar: BarMetric, startClientY: number, startScrollTop: number) => {
    setDraggingId(bar.id);
    const { el, maxScroll, maxThumbOffset } = bar;

    const onPointerMove = (moveEvt: PointerEvent) => {
      if (maxThumbOffset <= 0) return;
      const deltaY = moveEvt.clientY - startClientY;
      const scrollDelta = (deltaY / maxThumbOffset) * maxScroll;
      el.scrollTop = Math.min(maxScroll, Math.max(0, startScrollTop + scrollDelta));
    };

    const onPointerUp = () => {
      setDraggingId(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  if (!enabled || bars.length === 0) return null;

  return (
    <div className={styles.layer} aria-hidden="true">
      {bars.map((bar) => (
        <div
          key={bar.id}
          className={styles.track}
          style={{
            left: `${bar.trackLeft}px`,
            top: `${bar.trackTop}px`,
            height: `${bar.trackHeight}px`,
          }}
          onPointerDown={(e) => handleTrackPointerDown(bar, e)}
        >
          <div
            data-role="thumb"
            className={`${styles.thumb} ${draggingId === bar.id ? styles.thumbActive : ''}`}
            style={{
              top: `${bar.thumbTop - bar.trackTop}px`,
              height: `${bar.thumbHeight}px`,
            }}
            onPointerDown={(e) => handleThumbPointerDown(bar, e)}
          />
        </div>
      ))}
    </div>
  );
};
