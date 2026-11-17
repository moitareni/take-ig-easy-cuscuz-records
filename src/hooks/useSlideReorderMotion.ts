import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';
import Konva from 'konva';
import { POST_FORMATS, type PostFormat } from '../brand/brand';
import { getElementHorizSpan, isCrossoverCopy } from '../lib/crossover';
import { gsap, useGSAP } from '../lib/gsap';
import {
  dropPositionFromPointer,
  resolveReorderIndex,
  type DropPosition,
} from '../lib/slideOrder';
import type { SlideData } from '../types';

const DRAG_THRESHOLD_PX = 5;
const EDGE_SCROLL_ZONE_PX = 48;
const EDGE_SCROLL_MAX_SPEED = 9;
/** Rede de segurança: se o commit não produzir um novo `slides`, nada fica preso. */
const LANDING_SAFETY_MS = 1200;

/**
 * Durações do movimento (segundos). O arraste é uma micro-interação: tudo aqui
 * é curto para a usuária não esperar a animação terminar para continuar.
 */
const MOTION = {
  ghostIn: 0.16,
  ghostOut: 0.14,
  ghostMove: 0.24,
  ghostPulse: 0.22,
  slotOpen: 0.28,
  slotReturn: 0.26,
  landingMin: 0.24,
  landingMax: 0.5,
  thumbReveal: 0.09,
} as const;

/**
 * `prefers-reduced-motion` não zera o movimento do arraste: ele encurta e tira
 * a física (sem inércia, tilt ou overshoot). Reordenar é feedback essencial —
 * a troca instantânea de posição era justamente o que deixava o DnD confuso.
 */
function calm(reduced: boolean, seconds: number) {
  return reduced ? Math.min(seconds, 0.12) : seconds;
}

export interface ActiveSlideDrag {
  fromIndex: number;
  slide: SlideData;
  width: number;
  height: number;
  hasCrossoverLeft: boolean;
  hasCrossoverRight: boolean;
}

interface SlotPhysics {
  index: number;
  slideId: string;
  left: number;
  right: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  el: HTMLElement;
  targetX: number;
}

interface FloatingPhysics {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  smoothVx: number;
  rot: number;
  vRot: number;
  rotY: number;
  vRotY: number;
  scale: number;
  vScale: number;
  targetScale: number;
}

interface DragSession {
  fromIndex: number;
  previewIndex: number;
  slide: SlideData;
  slots: SlotPhysics[];
  slotStep: number;
  listLeft: number;
  listRight: number;
  initialScrollLeft: number;
  ghostBaseX: number;
  ghostTop: number;
  grabOffsetX: number;
  grabOffsetY: number;
  lastClientX: number;
  lastClientY: number;
  autoScrollSpeed: number;
  physics: FloatingPhysics;
  finishing: boolean;
}

interface PendingLanding {
  slideId: string;
  fromIndex: number;
  toIndex: number;
  startX: number;
  startY: number;
  rot: number;
  rotY: number;
  scale: number;
  siblingScreenX: Map<string, number>;
}

function detectCrossoverSides(slide: SlideData, format: PostFormat) {
  const postW = POST_FORMATS[format].width;
  let hasCrossoverLeft = false;
  let hasCrossoverRight = false;
  for (const el of slide.doc.elements) {
    if (isCrossoverCopy(el)) continue;
    const span = getElementHorizSpan(el, postW);
    if (!span) continue;
    if (span.minX < 0) hasCrossoverLeft = true;
    if (span.maxX > postW) hasCrossoverRight = true;
    if (hasCrossoverLeft && hasCrossoverRight) break;
  }
  return { hasCrossoverLeft, hasCrossoverRight };
}

function stepSpring(
  value: number,
  velocity: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): [number, number] {
  const force = (target - value) * stiffness;
  const nextVel = (velocity + force * dt) * Math.pow(damping, dt);
  const nextVal = value + nextVel * dt;
  return [nextVal, nextVel];
}

export interface UseSlideReorderMotionOptions {
  listRef: React.RefObject<HTMLDivElement | null>;
  floatingRef: React.RefObject<HTMLDivElement | null>;
  ghostRef: React.RefObject<HTMLDivElement | null>;
  badgeRef: React.RefObject<HTMLSpanElement | null>;
  slides: SlideData[];
  format: PostFormat;
  disabled: boolean;
  onReorder: (from: number, to: number) => void;
}

export function useSlideReorderMotion({
  listRef,
  floatingRef,
  ghostRef,
  badgeRef,
  slides,
  format,
  disabled,
  onReorder,
}: UseSlideReorderMotionOptions) {
  // Montado no início do arraste e desmontado só após o pouso (0 re-renders durante o arraste)
  const [activeDrag, setActiveDrag] = useState<ActiveSlideDrag | null>(null);

  const sessionRef = useRef<DragSession | null>(null);
  const pendingLandingRef = useRef<PendingLanding | null>(null);
  const landingCleanupRef = useRef<(() => void) | null>(null);
  const landingSafetyRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);
  const suppressClickUntilRef = useRef(0);

  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const formatRef = useRef(format);
  formatRef.current = format;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  // Respeita prefers-reduced-motion via gsap.matchMedia (skill gsap-core)
  useGSAP(
    () => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return;
      }
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: reduce)', () => {
        reducedMotionRef.current = true;
        return () => {
          reducedMotionRef.current = false;
        };
      });
    },
    { scope: listRef },
  );

  /** Devolve a tira ao estado de repouso. Usado no pouso, no cancelamento e na rede de segurança. */
  const resetMotionArtifacts = useCallback(() => {
    const listEl = listRef.current;
    const floatEl = floatingRef.current;
    const ghostEl = ghostRef.current;

    if (floatEl) {
      gsap.killTweensOf(floatEl);
      gsap.set(floatEl, { autoAlpha: 1 });
    }
    if (ghostEl) {
      gsap.killTweensOf(ghostEl);
      gsap.set(ghostEl, { autoAlpha: 0 });
    }
    if (listEl) {
      const thumbs = Array.from(listEl.querySelectorAll<HTMLElement>('[data-slide-index]'));
      gsap.killTweensOf(thumbs);
      for (const el of thumbs) {
        el.style.opacity = '';
        el.style.pointerEvents = '';
      }
      gsap.set(thumbs, { clearProps: 'transform' });
      listEl.removeAttribute('data-motion-active');
    }
    if (typeof document !== 'undefined') {
      document.body.removeAttribute('data-slide-dragging');
    }
    if (landingSafetyRef.current !== null) {
      clearTimeout(landingSafetyRef.current);
      landingSafetyRef.current = null;
    }
    sessionRef.current = null;
    landingCleanupRef.current = null;
    setActiveDrag(null);
  }, [floatingRef, ghostRef, listRef]);

  const computeTargetIndex = useCallback(
    (session: DragSession, pointerContentX: number): number => {
      const { slots, fromIndex } = session;
      if (slots.length <= 1) return fromIndex;

      let targetSlot = slots[0];
      if (pointerContentX <= slots[0].left) {
        targetSlot = slots[0];
      } else if (pointerContentX >= slots[slots.length - 1].right) {
        targetSlot = slots[slots.length - 1];
      } else {
        let bestDist = Infinity;
        for (const slot of slots) {
          if (pointerContentX >= slot.left && pointerContentX <= slot.right) {
            targetSlot = slot;
            break;
          }
          const dist = Math.abs(pointerContentX - slot.centerX);
          if (dist < bestDist) {
            bestDist = dist;
            targetSlot = slot;
          }
        }
      }

      const position: DropPosition = dropPositionFromPointer(pointerContentX, {
        left: targetSlot.left,
        width: targetSlot.width,
      });
      return resolveReorderIndex(fromIndex, targetSlot.index, position, slots.length) ?? fromIndex;
    },
    [],
  );

  // Abre espaço nas irmãs (em onda), desliza o ghost e atualiza o selo
  const syncSlotLayoutAndGhost = useCallback(
    (session: DragSession, nextPreview: number) => {
      session.previewIndex = nextPreview;
      const reduced = reducedMotionRef.current;
      const { fromIndex, slots, slotStep } = session;

      // Ghost: desliza para o slot de destino e dá um "clique" curto ao chegar
      if (ghostRef.current) {
        gsap.to(ghostRef.current, {
          x: session.ghostBaseX + (nextPreview - fromIndex) * slotStep,
          duration: calm(reduced, MOTION.ghostMove),
          ease: 'power3.out',
          overwrite: 'auto',
        });
        if (!reduced) {
          gsap.fromTo(
            ghostRef.current,
            { scale: 1.05 },
            { scale: 1, duration: MOTION.ghostPulse, ease: 'power2.out', overwrite: 'auto' },
          );
        }
      }

      if (badgeRef.current) {
        const nextText =
          fromIndex !== nextPreview
            ? `${fromIndex + 1} → ${nextPreview + 1}`
            : String(fromIndex + 1);
        if (badgeRef.current.textContent !== nextText) {
          badgeRef.current.textContent = nextText;
          if (!reduced) {
            gsap.fromTo(
              badgeRef.current,
              { scale: 1.24 },
              { scale: 1, duration: 0.22, ease: 'back.out(2.2)', overwrite: 'auto' },
            );
          }
        }
      }

      // Irmãs abrem (ou fecham) o espaço do slot com ease e chegada em onda:
      // quanto mais longe da página arrastada, um fio mais longo no trajeto.
      for (const slot of slots) {
        if (slot.index === fromIndex) continue;

        let shift = 0;
        if (fromIndex < nextPreview && slot.index > fromIndex && slot.index <= nextPreview) {
          shift = -slotStep;
        } else if (
          fromIndex > nextPreview &&
          slot.index >= nextPreview &&
          slot.index < fromIndex
        ) {
          shift = slotStep;
        }

        if (shift === slot.targetX) continue;
        slot.targetX = shift;

        const distance = Math.abs(slot.index - fromIndex);
        gsap.to(slot.el, {
          x: shift,
          duration: calm(reduced, MOTION.slotOpen + Math.min(0.06, (distance - 1) * 0.02)),
          ease: reduced ? 'power2.out' : 'power3.out',
          overwrite: 'auto',
        });
      }
    },
    [badgeRef, ghostRef],
  );

  // Setup da camada flutuante, fade-in rápido do ghost e loop de inércia via gsap.ticker
  useLayoutEffect(() => {
    const floatEl = floatingRef.current;
    const ghostEl = ghostRef.current;
    const session = sessionRef.current;
    const listEl = listRef.current;
    if (!activeDrag || !floatEl || !session || !listEl) return;

    const reduced = reducedMotionRef.current;

    gsap.killTweensOf(floatEl);
    if (ghostEl) gsap.killTweensOf(ghostEl);

    // Posição inicial exata (zero salto visual); o "pop" de pegar começa abaixo do tamanho final
    gsap.set(floatEl, {
      x: session.physics.x,
      y: session.physics.y,
      scale: session.physics.scale,
      rotation: 0,
      rotationY: 0,
      autoAlpha: 1,
      transformPerspective: 800,
      force3D: true,
    });

    if (ghostEl) {
      const initialGhostX =
        session.ghostBaseX + (session.previewIndex - session.fromIndex) * session.slotStep;
      gsap.set(ghostEl, {
        x: initialGhostX,
        y: session.ghostTop,
        autoAlpha: 0,
        scale: reduced ? 1 : 0.92,
        force3D: true,
      });
      // Fade in rápido (opacidade + leve crescimento) do slot tracejado
      gsap.to(ghostEl, {
        autoAlpha: 1,
        duration: calm(reduced, MOTION.ghostIn),
        ease: 'power2.out',
        overwrite: 'auto',
      });
      if (!reduced) {
        gsap.to(ghostEl, {
          scale: 1,
          duration: MOTION.ghostIn + 0.14,
          ease: 'back.out(2)',
          overwrite: 'auto',
        });
      }
    }

    // Caso o primeiro move antes da montagem já tenha mudado de slot, sincroniza as irmãs
    if (session.previewIndex !== session.fromIndex) {
      syncSlotLayoutAndGhost(session, session.previewIndex);
    }

    const setFloatX = gsap.quickSetter(floatEl, 'x', 'px');
    const setFloatY = gsap.quickSetter(floatEl, 'y', 'px');
    const setFloatRot = gsap.quickSetter(floatEl, 'rotation', 'deg');
    const setFloatRotY = gsap.quickSetter(floatEl, 'rotationY', 'deg');
    // `quickSetter(el, 'scale')` não renderiza: o alias "scale" mapeia para
    // "scaleX,scaleY" (composta) e o getSetter não resolve propriedade com
    // vírgula — o valor nunca chegava ao transform. Setters individuais funcionam.
    const setFloatScaleX = gsap.quickSetter(floatEl, 'scaleX');
    const setFloatScaleY = gsap.quickSetter(floatEl, 'scaleY');

    // Pinta o palco do portal sincronamente: o primeiro batchDraw do Konva é
    // rAF-adiado e, se o commit cair depois da fase de rAF do frame, o card
    // aparecia 1 frame com o canvas vazio (o "piscar" da arte na pegada).
    const dragStage = Konva.stages.find((s) => floatEl.contains(s.container()));
    if (dragStage) dragStage.draw();

    // Esconde a miniatura real só agora, no mesmo bloco pré-paint em que o card
    // flutuante já está posicionado: nunca há um frame em que ela sumiu e o
    // card ainda não apareceu no lugar (a causa do "piscar" no início do arraste).
    const fromSlot = session.slots[session.fromIndex];
    if (fromSlot) {
      fromSlot.el.style.opacity = '0';
      fromSlot.el.style.pointerEvents = 'none';
    }

    const tick = () => {
      const cur = sessionRef.current;
      if (!cur || cur.finishing) return;

      const dt = Math.min(gsap.ticker.deltaRatio(60), 2.5);
      const p = cur.physics;

      // Auto-scroll contínuo nas bordas horizontais da tira
      if (cur.autoScrollSpeed !== 0 && listRef.current) {
        const prevScroll = listRef.current.scrollLeft;
        listRef.current.scrollLeft += cur.autoScrollSpeed * dt;
        if (listRef.current.scrollLeft !== prevScroll) {
          const scrollDelta = listRef.current.scrollLeft - cur.initialScrollLeft;
          const pointerContentX = cur.lastClientX + scrollDelta;
          const nextPreview = computeTargetIndex(cur, pointerContentX);
          if (nextPreview !== cur.previewIndex) {
            syncSlotLayoutAndGhost(cur, nextPreview);
          }
        }
      }

      if (reduced) {
        p.x = p.targetX;
        p.y = p.targetY;
        p.rot = 0;
        p.rotY = 0;
        p.scale = 1;
        setFloatX(p.x);
        setFloatY(p.y);
        setFloatRot(0);
        setFloatRotY(0);
        setFloatScaleX(1);
        setFloatScaleY(1);
        return;
      }

      // Inércia posicional: o card persegue o ponteiro com peso, sem jamais "colar" nele
      const prevX = p.x;
      const followFactor = 1 - Math.pow(0.72, dt);
      p.x += (p.targetX - p.x) * followFactor;
      p.y += (p.targetY - p.y) * followFactor;

      const instantVx = (p.x - prevX) / Math.max(dt, 0.25);
      p.smoothVx += (instantVx - p.smoothVx) * (1 - Math.pow(0.55, dt));
      p.vx = p.smoothVx;

      // Pêndulo de inércia angular proporcional à velocidade (sem vibração)
      const targetRot = gsap.utils.clamp(-12, 12, p.vx * 0.42);
      const targetRotY = gsap.utils.clamp(-7, 7, p.vx * 0.26);
      [p.rot, p.vRot] = stepSpring(p.rot, p.vRot, targetRot, 0.16, 0.58, dt);
      [p.rotY, p.vRotY] = stepSpring(p.rotY, p.vRotY, targetRotY, 0.16, 0.6, dt);
      [p.scale, p.vScale] = stepSpring(p.scale, p.vScale, p.targetScale, 0.22, 0.62, dt);

      setFloatX(p.x);
      setFloatY(p.y);
      setFloatRot(p.rot);
      setFloatRotY(p.rotY);
      setFloatScaleX(p.scale);
      setFloatScaleY(p.scale);
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
    };
  }, [activeDrag, computeTargetIndex, floatingRef, ghostRef, listRef, syncSlotLayoutAndGhost]);

  // Pouso suave (ease-out no portal sem recorte de overflow) após o React comitar a nova ordem
  useLayoutEffect(() => {
    const landing = pendingLandingRef.current;
    const listEl = listRef.current;
    if (!landing) {
      // Se slides mudaram externamente durante um pouso em curso, finaliza limpo
      if (landingCleanupRef.current) {
        landingCleanupRef.current();
      }
      return;
    }
    pendingLandingRef.current = null;
    if (landingSafetyRef.current !== null) {
      clearTimeout(landingSafetyRef.current);
      landingSafetyRef.current = null;
    }
    if (!listEl) {
      resetMotionArtifacts();
      return;
    }

    const thumbs = Array.from(listEl.querySelectorAll<HTMLElement>('[data-slide-index]'));

    gsap.killTweensOf(thumbs);
    for (const el of thumbs) {
      el.style.opacity = '';
      el.style.pointerEvents = '';
    }
    gsap.set(thumbs, { clearProps: 'transform' });

    const landedEl = thumbs.find((el) => Number(el.dataset.slideIndex) === landing.toIndex);
    const floatEl = floatingRef.current;
    const ghostEl = ghostRef.current;

    if (!floatEl || !landedEl) {
      resetMotionArtifacts();
      return;
    }

    const reduced = reducedMotionRef.current;

    // Irmãs continuam exatamente da posição visual em que estavam (zero salto) e
    // terminam de deslizar junto com o card que chega.
    for (const el of thumbs) {
      const idx = Number(el.dataset.slideIndex);
      if (idx === landing.toIndex) continue;
      const oldX = landing.siblingScreenX.get(el.dataset.slideId ?? '');
      if (oldX === undefined) continue;
      const newRect = el.getBoundingClientRect();
      const delta = oldX - newRect.left;
      if (Math.abs(delta) > 0.5) {
        gsap.fromTo(
          el,
          { x: delta },
          {
            x: 0,
            duration: calm(reduced, MOTION.slotReturn),
            ease: 'power3.out',
            clearProps: 'transform',
            overwrite: 'auto',
          },
        );
      }
    }

    const toRect = landedEl.getBoundingClientRect();
    if (toRect.width <= 0) {
      resetMotionArtifacts();
      return;
    }

    // Esconde o card real no destino enquanto o portal flutuante voa até ele sem corte de overflow
    landedEl.style.opacity = '0';

    if (ghostEl) {
      gsap.to(ghostEl, {
        autoAlpha: 0,
        scale: reduced ? 1 : 0.92,
        duration: calm(reduced, MOTION.ghostOut),
        ease: 'power2.in',
        overwrite: 'auto',
      });
    }

    if (badgeRef.current) {
      badgeRef.current.textContent = String(landing.toIndex + 1);
    }

    const dist = Math.hypot(toRect.left - landing.startX, toRect.top - landing.startY);
    const duration = reduced
      ? 0.12
      : gsap.utils.clamp(MOTION.landingMin, MOTION.landingMax, 0.2 + dist / 1400);

    let done = false;
    const finalize = () => {
      if (done) return;
      done = true;
      landingCleanupRef.current = null;
      gsap.killTweensOf(floatEl);
      if (ghostEl) gsap.killTweensOf(ghostEl);
      gsap.killTweensOf(thumbs);
      gsap.set(thumbs, { clearProps: 'transform' });
      landedEl.style.opacity = '';
      gsap.set(floatEl, { autoAlpha: 1 });
      listEl.removeAttribute('data-motion-active');
      if (typeof document !== 'undefined') {
        document.body.removeAttribute('data-slide-dragging');
      }
      setActiveDrag(null);
    };

    landingCleanupRef.current = finalize;

    // Troca invisível: o card real já ocupa os mesmos pixels, então o portal só esmaece
    const revealRealThumb = () => {
      landedEl.style.opacity = '1';
      gsap.to(floatEl, {
        autoAlpha: 0,
        duration: MOTION.thumbReveal,
        ease: 'power1.out',
        overwrite: 'auto',
        onComplete: finalize,
      });
    };

    gsap.fromTo(
      floatEl,
      {
        x: landing.startX,
        y: landing.startY,
        rotation: landing.rot,
        rotationY: landing.rotY,
        scale: landing.scale,
        force3D: true,
      },
      {
        x: toRect.left,
        y: toRect.top,
        rotation: 0,
        rotationY: 0,
        scale: 1,
        duration,
        ease: 'power3.out',
        overwrite: true,
        onComplete: revealRealThumb,
      },
    );
  }, [slides, listRef, floatingRef, ghostRef, badgeRef, resetMotionArtifacts]);

  const updatePointerTarget = useCallback(
    (clientX: number, clientY: number) => {
      const session = sessionRef.current;
      const listEl = listRef.current;
      if (!session || !listEl || session.finishing) return;

      session.physics.targetX = clientX - session.grabOffsetX;
      session.physics.targetY = clientY - session.grabOffsetY;
      session.lastClientX = clientX;
      session.lastClientY = clientY;

      // Auto-scroll magnético perto das bordas horizontais da tira
      if (clientX < session.listLeft + EDGE_SCROLL_ZONE_PX) {
        session.autoScrollSpeed = -gsap.utils.clamp(
          0,
          EDGE_SCROLL_MAX_SPEED,
          gsap.utils.mapRange(
            session.listLeft + EDGE_SCROLL_ZONE_PX,
            session.listLeft,
            0,
            EDGE_SCROLL_MAX_SPEED,
            clientX,
          ),
        );
      } else if (clientX > session.listRight - EDGE_SCROLL_ZONE_PX) {
        session.autoScrollSpeed = gsap.utils.clamp(
          0,
          EDGE_SCROLL_MAX_SPEED,
          gsap.utils.mapRange(
            session.listRight - EDGE_SCROLL_ZONE_PX,
            session.listRight,
            0,
            EDGE_SCROLL_MAX_SPEED,
            clientX,
          ),
        );
      } else {
        session.autoScrollSpeed = 0;
      }

      const scrollDelta = listEl.scrollLeft - session.initialScrollLeft;
      const pointerContentX = clientX + scrollDelta;
      const nextPreview = computeTargetIndex(session, pointerContentX);

      if (nextPreview !== session.previewIndex) {
        syncSlotLayoutAndGhost(session, nextPreview);
      }
    },
    [computeTargetIndex, listRef, syncSlotLayoutAndGhost],
  );

  const finishSession = useCallback(
    (shouldCommit: boolean) => {
      const session = sessionRef.current;
      const listEl = listRef.current;
      if (!session || session.finishing) return;
      session.finishing = true;
      session.autoScrollSpeed = 0;
      suppressClickUntilRef.current = performance.now() + 140;

      if (typeof document !== 'undefined') {
        document.body.removeAttribute('data-slide-dragging');
      }

      const fromIdx = session.fromIndex;
      const toIdx = session.previewIndex;
      const scrollDelta = listEl ? listEl.scrollLeft - session.initialScrollLeft : 0;
      const reduced = reducedMotionRef.current;

      // Caso 1: troca de posição confirmada -> comita no store e mantém o portal para o pouso ease-out
      if (shouldCommit && fromIdx !== toIdx) {
        const siblingScreenX = new Map<string, number>();
        for (const slot of session.slots) {
          if (slot.index === fromIdx) continue;
          const currentX = Number(gsap.getProperty(slot.el, 'x')) || 0;
          siblingScreenX.set(slot.slideId, slot.left - scrollDelta + currentX);
        }

        pendingLandingRef.current = {
          slideId: session.slide.id,
          fromIndex: fromIdx,
          toIndex: toIdx,
          startX: session.physics.x,
          startY: session.physics.y,
          rot: session.physics.rot,
          rotY: session.physics.rotY,
          scale: session.physics.scale,
          siblingScreenX,
        };

        sessionRef.current = null;

        // Se o store não devolver um novo `slides`, o pouso nunca roda: libera tudo.
        if (landingSafetyRef.current !== null) clearTimeout(landingSafetyRef.current);
        landingSafetyRef.current = window.setTimeout(() => {
          if (!pendingLandingRef.current) return;
          pendingLandingRef.current = null;
          resetMotionArtifacts();
        }, LANDING_SAFETY_MS);

        onReorderRef.current(fromIdx, toIdx);
        return;
      }

      // Caso 2: cancelamento ou mesmo slot -> fade-out rápido do ghost e retorno ease-out
      const floatEl = floatingRef.current;
      const ghostEl = ghostRef.current;
      const origSlot = session.slots[fromIdx];

      let done = false;
      const cleanupCancel = () => {
        if (done) return;
        done = true;
        landingCleanupRef.current = null;
        if (floatEl) gsap.killTweensOf(floatEl);
        if (ghostEl) gsap.killTweensOf(ghostEl);
        if (origSlot) {
          origSlot.el.style.opacity = '';
          origSlot.el.style.pointerEvents = '';
        }
        for (const slot of session.slots) {
          gsap.killTweensOf(slot.el);
          gsap.set(slot.el, { clearProps: 'transform' });
        }
        listEl?.removeAttribute('data-motion-active');
        sessionRef.current = null;
        setActiveDrag(null);
      };

      if (!floatEl || !origSlot) {
        cleanupCancel();
        return;
      }

      landingCleanupRef.current = cleanupCancel;

      if (ghostEl) {
        gsap.to(ghostEl, {
          autoAlpha: 0,
          scale: reduced ? 1 : 0.92,
          duration: calm(reduced, MOTION.ghostOut),
          ease: 'power2.in',
          overwrite: 'auto',
        });
      }

      for (const slot of session.slots) {
        if (slot.index === fromIdx) continue;
        gsap.to(slot.el, {
          x: 0,
          duration: calm(reduced, MOTION.slotReturn),
          ease: 'power3.out',
          overwrite: 'auto',
        });
      }

      const targetX = origSlot.left - scrollDelta;
      const targetY = origSlot.top;
      const dist = Math.hypot(targetX - session.physics.x, targetY - session.physics.y);
      const duration = reduced
        ? 0.12
        : gsap.utils.clamp(0.22, 0.46, 0.2 + dist / 1400);

      gsap.to(floatEl, {
        x: targetX,
        y: targetY,
        scale: 1,
        rotation: 0,
        rotationY: 0,
        duration,
        ease: 'power3.out',
        overwrite: true,
        onComplete: cleanupCancel,
      });
    },
    [listRef, floatingRef, ghostRef, resetMotionArtifacts],
  );

  const startSession = useCallback(
    (
      index: number,
      downClientX: number,
      downClientY: number,
      currentClientX: number,
      currentClientY: number,
    ) => {
      if (disabledRef.current) return;
      // Se um pouso anterior ainda estiver terminando, conclui imediatamente antes de medir os slots
      landingCleanupRef.current?.();

      const listEl = listRef.current;
      const slide = slidesRef.current[index];
      if (!listEl || !slide) return;

      const thumbEls = Array.from(
        listEl.querySelectorAll<HTMLElement>('[data-slide-index]'),
      ).sort((a, b) => Number(a.dataset.slideIndex) - Number(b.dataset.slideIndex));

      if (thumbEls.length <= 1) return;

      listEl.setAttribute('data-motion-active', 'true');
      if (typeof document !== 'undefined') {
        document.body.setAttribute('data-slide-dragging', 'true');
      }

      gsap.killTweensOf(thumbEls);
      gsap.set(thumbEls, { clearProps: 'transform' });

      const slots: SlotPhysics[] = thumbEls.map((el, i) => {
        const rect = el.getBoundingClientRect();
        return {
          index: Number(el.dataset.slideIndex ?? i),
          slideId: el.dataset.slideId ?? '',
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          centerX: rect.left + rect.width / 2,
          el,
          targetX: 0,
        };
      });

      const fromSlot = slots[index];
      if (!fromSlot) return;

      // A miniatura real NÃO é escondida aqui: ela some apenas no useLayoutEffect
      // do card flutuante, no mesmo bloco pré-paint em que ele é posicionado —
      // esconder antes do portal montar deixava um frame sem nenhum dos dois.

      const listRect = listEl.getBoundingClientRect();
      const slotStep =
        slots.length > 1 ? slots[1].left - slots[0].left : fromSlot.width + 10;

      // Usa a linha de base sem o deslocamento de -2px do slide ativo
      const baseTop = Math.max(...slots.map((s) => s.top));
      const ghostBaseX =
        fromSlot.left - listRect.left - listEl.clientLeft + listEl.scrollLeft;
      const ghostTop = baseTop - listRect.top - listEl.clientTop + listEl.scrollTop;

      const grabOffsetX = downClientX - fromSlot.left;
      const grabOffsetY = downClientY - fromSlot.top;

      // Onde o ponteiro está AGORA (no frame em que o arraste começa): a física
      // nasce nessa posição, não no slot de origem — senão, em puxões rápidos,
      // o card reaparecia no lugar antigo e deslizava até o cursor.

      const { hasCrossoverLeft, hasCrossoverRight } = detectCrossoverSides(
        slide,
        formatRef.current,
      );

      const reduced = reducedMotionRef.current;

      sessionRef.current = {
        fromIndex: index,
        previewIndex: index,
        slide,
        slots,
        slotStep,
        listLeft: listRect.left,
        listRight: listRect.right,
        initialScrollLeft: listEl.scrollLeft,
        ghostBaseX,
        ghostTop,
        grabOffsetX,
        grabOffsetY,
        lastClientX: currentClientX,
        lastClientY: currentClientY,
        autoScrollSpeed: 0,
        finishing: false,
        physics: {
          x: currentClientX - grabOffsetX,
          y: currentClientY - grabOffsetY,
          targetX: currentClientX - grabOffsetX,
          targetY: currentClientY - grabOffsetY,
          vx: 0,
          smoothVx: 0,
          rot: 0,
          vRot: 0,
          rotY: 0,
          vRotY: 0,
          // Nasce no tamanho real: o "pop" de pegar sobe com spring até 1.06
          // sem nunca encolher a arte abaixo do repouso (fonte de "piscar").
          scale: 1,
          vScale: 0,
          targetScale: reduced ? 1 : 1.06,
        },
      };

      setActiveDrag({
        fromIndex: index,
        slide,
        width: fromSlot.width,
        height: fromSlot.height,
        hasCrossoverLeft,
        hasCrossoverRight,
      });
    },
    [listRef],
  );

  // Tecla Escape ou perda de foco cancela o arraste suavemente
  useEffect(() => {
    if (!activeDrag) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finishSession(false);
      }
    };
    const onBlur = () => finishSession(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
    };
  }, [activeDrag, finishSession]);

  // Limpeza garantida se o componente desmontar no meio de um arraste ou pouso
  useEffect(() => {
    return () => {
      landingCleanupRef.current?.();
      if (landingSafetyRef.current !== null) {
        clearTimeout(landingSafetyRef.current);
        landingSafetyRef.current = null;
      }
      if (typeof document !== 'undefined') {
        document.body.removeAttribute('data-slide-dragging');
      }
    };
  }, []);

  // Pointer Events unificados (desktop mouse + trackpad + touch + pen + Playwright dragTo)
  const handleThumbPointerDown = useCallback(
    (index: number, e: React.PointerEvent<HTMLDivElement>) => {
      if (disabledRef.current || slidesRef.current.length <= 1) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if ((e.target as HTMLElement).closest('[data-no-drag="true"]')) return;
      if (sessionRef.current) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const pointerId = e.pointerId;
      let started = false;

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        if (!started) {
          const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
          if (dist < DRAG_THRESHOLD_PX) return;
          started = true;
          // Coordenadas do ponteiro AGORA (não as do pointerdown): a sessão
          // nasce presa ao cursor, com o offset de pegar vindo do pointerdown.
          startSession(index, startX, startY, ev.clientX, ev.clientY);
        }
        updatePointerTarget(ev.clientX, ev.clientY);
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        cleanup();
        if (started) {
          finishSession(true);
        }
      };

      const onCancel = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        cleanup();
        if (started) {
          finishSession(false);
        }
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
      };

      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    },
    [finishSession, startSession, updatePointerTarget],
  );

  const shouldSuppressClick = useCallback(
    () => performance.now() < suppressClickUntilRef.current,
    [],
  );

  return {
    activeDrag,
    handleThumbPointerDown,
    shouldSuppressClick,
  };
}
