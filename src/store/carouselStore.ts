import { create } from 'zustand';
import { CAROUSEL_MAX_SLIDES, getPostDimensions, type PostFormat } from '../brand/brand';
import {
  canElementBleedToSide,
  isCrossoverCopy,
  pruneOrphanCrossoverCopies,
  reconcileAllCrossovers,
  syncCrossoverFromActiveSlide,
} from '../lib/crossover';
import type { Doc, El, FinishState, SlideData } from '../types';
import { defaultSlide, isSlideEmpty, sanitizeFormat, sanitizeSlide, uid } from '../lib/sanitize';
import { flushTextEditing, resetEditorFor, useEditor } from './editorStore';
import { isApplyingState, withApplyingState } from './syncEngine';

export type CarouselMode = 'single' | 'carousel' | null;

export { defaultSlide, isSlideEmpty, sanitizeFormat, sanitizeSlide };

export const CAROUSEL_STORAGE_KEY = 'cuscuz-insta-kit:carrossel';
export const SINGLE_STORAGE_KEY = 'cuscuz-insta-kit:rascunho';

/** Id do slide cujo estado está efetivamente carregado no `useEditor`. */
let editorLoadedSlideId: string | null = null;

/** Id do slide efetivamente carregado no `useEditor` (evita gravar doc velho no slide novo). */
export function getEditorLoadedSlideId(): string | null {
  return editorLoadedSlideId;
}

/**
 * Reconcilia elementos crossover entre slides adjacentes (e limpa crossover quando resta só 1 slide).
 */
function enforceValidCrossover(slides: SlideData[], format: PostFormat = '3:4'): SlideData[] {
  return reconcileAllCrossovers(slides, format);
}

/** Id do slide que está no editor (usado por testes e pelo autosave). */
export function activeEditorSlideId(): string | null {
  return useCarousel.getState().activeSlideId;
}

/**
 * Prepara `useEditor` e registra a posse do slide carregado ANTES de disparar
 * subscribers síncronos do `useCarousel`.
 */
function primeEditorForSlide(slide: SlideData): void {
  editorLoadedSlideId = slide.id;
  withApplyingState(() => {
    resetEditorFor(slide.doc, slide.finish);
  });
}

/**
 * Carrega o slide ativo no useEditor, reseta o passo para 0, limpa seleção e
 * limpa o histórico temporal para isolar o undo/redo por slide.
 */
export function loadSlideIntoEditor(slide: SlideData): void {
  primeEditorForSlide(slide);
  useCarousel.setState({ activeSlideId: slide.id });
}

/**
 * Alinha o palco ao doc do slide ativo quando uma limpeza fora do `useEditor`
 * mudou esse doc (o prune de cópias órfãs na reordenação). Sem isso o canvas
 * continua exibindo/listando uma cópia que a página não tem mais — e arrastá-la
 * reivindicaria a arte de outra página.
 *
 * Não é troca de slide: preserva `step` e não cria passo de undo.
 */
function resyncEditorDoc(slide: SlideData): void {
  const editor = useEditor.getState();
  if (editor.doc === slide.doc) return;
  const ids = new Set(slide.doc.elements.map((el) => el.id));
  const temporal = useEditor.temporal.getState();
  temporal.pause();
  withApplyingState(() => {
    try {
      useEditor.setState({
        doc: slide.doc,
        selectedIds: editor.selectedIds.filter((id) => ids.has(id)),
        selectedId: editor.selectedId && ids.has(editor.selectedId) ? editor.selectedId : null,
        editingId: editor.editingId && ids.has(editor.editingId) ? editor.editingId : null,
      });
    } finally {
      temporal.resume();
    }
  });
}

function cloneFinish(finish: FinishState): FinishState {
  return {
    paper: { ...finish.paper },
    grain: { ...finish.grain },
    borderTexture: { ...finish.borderTexture },
  };
}

function finishesEqual(a: FinishState, b: FinishState): boolean {
  return (
    a.paper.enabled === b.paper.enabled &&
    a.paper.opacity === b.paper.opacity &&
    a.grain.enabled === b.grain.enabled &&
    a.grain.intensity === b.grain.intensity &&
    a.grain.size === b.grain.size &&
    a.borderTexture.enabled === b.borderTexture.enabled &&
    a.borderTexture.opacity === b.borderTexture.opacity
  );
}

function cloneDocAndFinish(doc: Doc, finish: FinishState, format: PostFormat): { doc: Doc; finish: FinishState } {
  const clonedDoc: Doc = JSON.parse(JSON.stringify(doc));
  clonedDoc.format = format;
  // Cada slide é dono dos seus elementos: o duplicado ganha ids NOVOS. O
  // crossover casa elementos por id entre páginas vizinhas — ids repetidos
  // faziam o slide duplicado ser tratado como "cópia crossover" e perder os
  // elementos ao ativar o original.
  // Cópias de crossover não são arte do slide: o duplicado nasce só com os
  // donos (e o reconcile materializa as cópias da vizinhança nova).
  clonedDoc.elements = clonedDoc.elements
    .filter((el) => !isCrossoverCopy(el))
    .map((el) => ({ ...el, id: uid() }));
  const clonedFinish = cloneFinish(finish);
  return { doc: clonedDoc, finish: clonedFinish };
}

export interface CarouselState {
  // ── Estado em memória (persistido no IndexedDB de rascunhos) ────
  slides: SlideData[];
  activeSlideIndex: number;
  /** Id do slide atualmente carregado no `useEditor` (posse explícita contra reordenação). */
  activeSlideId: string | null;
  format: PostFormat;
  mode: CarouselMode;
  /** Quando ativo no carrossel, mudanças de textura são aplicadas em todos os slides. */
  applyFinishToAll: boolean;

  // ── Estado de sessão (não persiste) ─────────────────────────
  isExporting: boolean;
  exportProgress: { current: number; total: number } | null;

  // ── Actions ─────────────────────────────────────────────────
  setMode: (mode: CarouselMode) => void;
  setFormat: (format: PostFormat) => void;
  setApplyFinishToAll: (enabled: boolean) => void;
  addSlide: () => void;
  duplicateSlide: (index: number) => void;
  removeSlide: (index: number) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;
  setActiveSlide: (index: number) => void;
  /** Chamado pelo subscriber do useEditor para gravar as mudanças do slide ativo. */
  updateActiveSlide: (doc: Doc, finish: FinishState) => void;
  setExporting: (progress: { current: number; total: number } | null) => void;
  resetCarousel: () => void;
}

const initialSlide = defaultSlide('3:4');

export const useCarousel = create<CarouselState>()(
  (set, get) => ({
      slides: [initialSlide],
      activeSlideIndex: 0,
      activeSlideId: null,
      format: '3:4',
      mode: null,
      applyFinishToAll: true,
      isExporting: false,
      exportProgress: null,

      setMode: (mode) => {
        if (mode === 'carousel') {
          const { slides, activeSlideIndex } = get();
          const active = slides[activeSlideIndex];
          if (active) {
            primeEditorForSlide(active);
            set({ mode, activeSlideId: active.id });
            return;
          }
        }
        set({ mode });
      },

      setFormat: (format) => {
        const validFormat = sanitizeFormat(format);
        set((s) => ({
          format: validFormat,
          slides: s.slides.map((slide) => ({
            ...slide,
            doc: { ...slide.doc, format: validFormat },
          })),
        }));
      },

      setApplyFinishToAll: (enabled) =>
        set((s) => {
          const byId = s.activeSlideId
            ? s.slides.findIndex((slide) => slide.id === s.activeSlideId)
            : -1;
          const index = byId >= 0 ? byId : s.activeSlideIndex;
          const activeFinish = useEditor.getState().finish;

          if (enabled) {
            const slides = s.slides.map((sl) =>
              finishesEqual(sl.finish, activeFinish)
                ? sl
                : { ...sl, finish: cloneFinish(activeFinish) },
            );
            const changed = slides.some((sl, i) => sl !== s.slides[i]);
            if (s.applyFinishToAll && !changed) return s;
            return {
              applyFinishToAll: true,
              ...(changed ? { slides } : {}),
            };
          }

          // Desativar "Aplicar em todos os slides" apenas para de propagar
          // mudanças futuras; os demais slides mantêm suas texturas atuais.
          const slides = s.slides.map((sl, i) => {
            if (i !== index || finishesEqual(sl.finish, activeFinish)) return sl;
            return { ...sl, finish: cloneFinish(activeFinish) };
          });
          const changed = slides.some((sl, i) => sl !== s.slides[i]);
          if (!s.applyFinishToAll && !changed) return s;
          return {
            applyFinishToAll: false,
            ...(changed ? { slides } : {}),
          };
        }),

      addSlide: () => {
        // Fecha a edição de texto pendente antes de trocar o slide ativo.
        flushTextEditing();
        const s = get();
        if (s.slides.length >= CAROUSEL_MAX_SLIDES) {
          useEditor
            .getState()
            .showToast('info', 'Máximo de 10 slides atingido!');
          return;
        }
        const { width: postW } = getPostDimensions(s.format);
        // Antes de criar a nova página no fim, limpa eventual flag `crossover`
        // residual à direita no antigo último slide (não havia vizinha à direita).
        const prevSlides = s.slides.map((sl, idx) => {
          if (idx !== s.slides.length - 1) return sl;
          let changed = false;
          const cleanedElements = sl.doc.elements.map((el) => {
            if (isCrossoverCopy(el) || el.crossover === undefined) return el;
            const bleedsLeft = s.slides.length > 1 && canElementBleedToSide(el, 'left', postW);
            if (bleedsLeft) return el;
            changed = true;
            const nextEl: El = { ...el };
            delete nextEl.crossover;
            return nextEl;
          });
          return changed ? { ...sl, doc: { ...sl.doc, elements: cleanedElements } } : sl;
        });
        const baseSlide = defaultSlide(s.format);
        const newSlide = s.applyFinishToAll
          ? { ...baseSlide, finish: cloneFinish(useEditor.getState().finish) }
          : baseSlide;
        const slides = enforceValidCrossover([...prevSlides, newSlide], s.format);
        const activeSlideIndex = slides.length - 1;
        const targetSlide = slides[activeSlideIndex];
        primeEditorForSlide(targetSlide);
        set({ slides, activeSlideIndex, activeSlideId: targetSlide.id });
      },

      duplicateSlide: (index) => {
        flushTextEditing();
        const s = get();
        if (index < 0 || index >= s.slides.length) return;
        if (s.slides.length >= CAROUSEL_MAX_SLIDES) {
          useEditor
            .getState()
            .showToast('info', 'Máximo de 10 slides atingido!');
          return;
        }
        const source = s.slides[index];
        const { doc, finish } = cloneDocAndFinish(source.doc, source.finish, s.format);
        const duplicated: SlideData = {
          id: uid(),
          doc,
          finish,
        };
        const nextSlides = [...s.slides];
        nextSlides.splice(index + 1, 0, duplicated);
        const slides = enforceValidCrossover(nextSlides, s.format);
        const activeSlideIndex = index + 1;
        const targetSlide = slides[activeSlideIndex];
        primeEditorForSlide(targetSlide);
        set({ slides, activeSlideIndex, activeSlideId: targetSlide.id });
      },

      removeSlide: (index) => {
        flushTextEditing();
        const s = get();
        if (index < 0 || index >= s.slides.length) return;
        if (s.slides.length <= 1) {
          useEditor
            .getState()
            .showToast('info', 'O carrossel precisa ter pelo menos 1 slide 😅');
          return;
        }
        const rawSlides = s.slides.filter((_, i) => i !== index);
        const slides = enforceValidCrossover(rawSlides, s.format);
        let newActive = s.activeSlideIndex;
        if (index === s.activeSlideIndex) {
          newActive = Math.max(0, index - 1);
        } else if (index < s.activeSlideIndex) {
          newActive = s.activeSlideIndex - 1;
        } else {
          newActive = Math.min(s.activeSlideIndex, slides.length - 1);
        }
        const targetSlide = slides[newActive];
        primeEditorForSlide(targetSlide);
        set({ slides, activeSlideIndex: newActive, activeSlideId: targetSlide.id });
      },

      reorderSlides: (fromIndex, toIndex) => {
        flushTextEditing();
        /** Deslocamento do índice ativo quando não há slide do editor (fallback). */
        const shiftIndex = (active: number): number => {
          if (active === fromIndex) return toIndex;
          if (fromIndex < active && toIndex >= active) return active - 1;
          if (fromIndex > active && toIndex <= active) return active + 1;
          return active;
        };
        set((s) => {
          if (
            fromIndex < 0 ||
            fromIndex >= s.slides.length ||
            toIndex < 0 ||
            toIndex >= s.slides.length ||
            fromIndex === toIndex
          ) {
            return s;
          }
          // Reordenar é SÓ trocar posições: os docs/finishes são os MESMOS
          // objetos. Nada de reconcile/crossover aqui — materializar vizinhos
          // nesta ação movia elementos entre páginas e corrompia a arte.
          const ordered = [...s.slides];
          const [moved] = ordered.splice(fromIndex, 1);
          ordered.splice(toIndex, 0, moved);

          // A única limpeza: cópias de crossover que perderam o dono vizinho
          // saem (ver lib/crossover.ts — posse explícita por `crossFrom`).
          const slides = pruneOrphanCrossoverCopies(ordered, s.format);

          // A página ativa é a que está no editor (posse por id), não o índice
          // antigo: se algo defasou, quem manda é o doc que a usuária vê.
          const editorIndex = s.activeSlideId
            ? slides.findIndex((slide) => slide.id === s.activeSlideId)
            : -1;
          const newActive = editorIndex >= 0 ? editorIndex : shiftIndex(s.activeSlideIndex);

          return {
            slides,
            activeSlideIndex: newActive,
            activeSlideId: slides[newActive]?.id ?? s.activeSlideId,
          };
        });

        // O prune pode ter tirado uma cópia órfã do slide que está no palco.
        const after = get();
        const active = after.slides[after.activeSlideIndex];
        if (active && after.activeSlideId === active.id) resyncEditorDoc(active);
      },

      setActiveSlide: (index) => {
        // Fecha a edição de texto pendente ANTES de trocar o índice, para o
        // doc congelado ser gravado no slide que está sendo deixado.
        flushTextEditing();
        const s = get();
        if (index < 0 || index >= s.slides.length) return;
        // A cópia de crossover precisa estar no DOC da página: o espelho é
        // desenhado, mas não recebe clique. Reconciliar antes de carregar
        // garante a página vizinha interativa já no primeiro frame e evita
        // disparar subscribers com `useEditor` apontando para o slide anterior.
        const reconciled = reconcileAllCrossovers(s.slides, s.format);
        const targetId = s.slides[index].id;
        const byId = reconciled.findIndex((slide) => slide.id === targetId);
        const activeIndex = byId >= 0 ? byId : index;
        const active = reconciled[activeIndex];
        if (!active) return;
        primeEditorForSlide(active);
        set({
          ...(reconciled !== s.slides ? { slides: reconciled } : {}),
          activeSlideIndex: activeIndex,
          activeSlideId: active.id,
        });
      },

      updateActiveSlide: (doc, finish) => {
        if (isApplyingState()) return;
        set((s) => {
          // Grava pelo DONO do doc (id do slide carregado no editor). Se o
          // índice estiver defasado, corrige — o doc nunca cai na página errada.
          if (editorLoadedSlideId !== null && s.activeSlideId && editorLoadedSlideId !== s.activeSlideId) {
            return s;
          }
          const byId = s.activeSlideId
            ? s.slides.findIndex((slide) => slide.id === s.activeSlideId)
            : -1;
          const index = byId >= 0 ? byId : s.activeSlideIndex;
          const slide = s.slides[index];
          if (!slide) return s;
          // Nada mudou no palco (ex.: `resyncEditorDoc` devolveu o doc já
          // podado): reagir aqui materializaria sangria em vizinha nova, o que
          // a reordenação não deve fazer.
          if (
            slide.doc === doc &&
            slide.finish === finish &&
            (!s.applyFinishToAll || s.slides.every((sl) => finishesEqual(sl.finish, finish)))
          ) {
            return s;
          }
          const normalizedDoc = doc.format === s.format ? doc : { ...doc, format: s.format };
          let slides = syncCrossoverFromActiveSlide(
            s.slides,
            index,
            slide.doc,
            normalizedDoc,
            finish,
            s.format,
          );
          if (s.applyFinishToAll) {
            let propagated = false;
            const withFinish = slides.map((sl, i) => {
              if (i === index || finishesEqual(sl.finish, finish)) return sl;
              propagated = true;
              return { ...sl, finish: cloneFinish(finish) };
            });
            if (propagated) slides = withFinish;
          }
          const nextActiveId = slides[index]?.id ?? slide.id;
          if (slides === s.slides && index === s.activeSlideIndex && s.activeSlideId === nextActiveId) {
            return s;
          }
          return { slides, activeSlideIndex: index, activeSlideId: nextActiveId };
        });
        // O sync pode normalizar marcas e remover cópias fantasmas do doc ativo.
        // O palco precisa ficar com o MESMO doc que o store gravou; senão a
        // próxima edição parte de um `prevActiveDoc` diferente do que está na
        // tela (e arrastar o fantasma não espelharia para lugar nenhum).
        const after = get();
        const byId = after.activeSlideId
          ? after.slides.findIndex((slide) => slide.id === after.activeSlideId)
          : -1;
        const active = after.slides[byId >= 0 ? byId : after.activeSlideIndex];
        if (active) resyncEditorDoc(active);
      },

      setExporting: (progress) =>
        set({
          isExporting: progress !== null,
          exportProgress: progress,
        }),

      resetCarousel: () => {
        editorLoadedSlideId = null;
        const initial = defaultSlide('3:4');
        set({
          slides: [initial],
          activeSlideIndex: 0,
          activeSlideId: null,
          format: '3:4',
          mode: null,
          applyFinishToAll: true,
          isExporting: false,
          exportProgress: null,
        });
      },
    }),
);

/**
 * Converte o Post Único atual para o primeiro slide do Modo Carrossel sem confirmação
 * (Requisitos 1.4 e 1.5).
 */
export function switchSingleToCarousel(): void {
  const { doc, finish } = useEditor.getState();
  const format: PostFormat = doc.format ?? '3:4';
  const firstSlide: SlideData = {
    id: defaultSlide(format).id,
    doc: { ...doc, format },
    finish,
  };
  primeEditorForSlide(firstSlide);
  useCarousel.setState({
    mode: 'carousel',
    slides: [firstSlide],
    activeSlideIndex: 0,
    activeSlideId: firstSlide.id,
    format,
    applyFinishToAll: true,
  });
}

// Exposto intencionalmente em produção (dist/): a suíte E2E (Playwright sobre
// `vite preview`) inspeciona e prepara o estado dos stores via `page.evaluate`.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__useCarousel = useCarousel;
}
