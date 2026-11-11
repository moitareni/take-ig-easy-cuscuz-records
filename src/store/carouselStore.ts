import { create } from 'zustand';
import { CAROUSEL_MAX_SLIDES, type PostFormat } from '../brand/brand';
import { reconcileAllCrossovers, syncCrossoverFromActiveSlide } from '../lib/crossover';
import type { Doc, FinishState, SlideData } from '../types';
import { defaultFinish, emptyDoc, sanitize, sanitizeFinish, useEditor } from './editorStore';

export type CarouselMode = 'single' | 'carousel' | null;

export const CAROUSEL_STORAGE_KEY = 'cuscuz-insta-kit:carrossel';
export const SINGLE_STORAGE_KEY = 'cuscuz-insta-kit:rascunho';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const VALID_FORMATS: PostFormat[] = ['3:4', '4:3', '1:1'];

export function sanitizeFormat(f: unknown): PostFormat {
  return VALID_FORMATS.includes(f as PostFormat) ? (f as PostFormat) : '3:4';
}

/** Cria um SlideData vazio no formato informado. */
export function defaultSlide(format: PostFormat = '3:4'): SlideData {
  return {
    id: uid(),
    doc: {
      ...emptyDoc(),
      format: sanitizeFormat(format),
    },
    finish: defaultFinish(),
  };
}

/** Valida e sanitiza um SlideData restaurado do localStorage. */
export function sanitizeSlide(raw: unknown, fallbackFormat?: PostFormat): SlideData {
  const r = raw as Partial<SlideData> | null | undefined;
  const sanitizedDoc = sanitize(r?.doc);
  const format = fallbackFormat
    ? sanitizeFormat(fallbackFormat)
    : r?.doc?.format
      ? sanitizedDoc.format ?? '3:4'
      : '3:4';
  return {
    id: typeof r?.id === 'string' && r.id.trim().length > 0 ? r.id : uid(),
    doc: {
      ...sanitizedDoc,
      format,
    },
    finish: sanitizeFinish(r?.finish),
  };
}

/** Verifica se um slide está vazio (sem fundo, sem elementos e com acabamento padrão). */
export function isSlideEmpty(slide: SlideData): boolean {
  const df = defaultFinish();
  return (
    slide.doc.elements.length === 0 &&
    slide.doc.backgroundId === null &&
    slide.finish.paper.enabled === df.paper.enabled &&
    slide.finish.paper.opacity === df.paper.opacity &&
    slide.finish.grain.enabled === df.grain.enabled &&
    slide.finish.grain.intensity === df.grain.intensity &&
    slide.finish.grain.size === df.grain.size &&
    slide.finish.borderTexture.enabled === df.borderTexture.enabled &&
    slide.finish.borderTexture.opacity === df.borderTexture.opacity
  );
}

/**
 * Reconcilia elementos crossover entre slides adjacentes (e limpa crossover quando resta só 1 slide).
 */
function enforceValidCrossover(slides: SlideData[], format: PostFormat = '3:4'): SlideData[] {
  return reconcileAllCrossovers(slides, format);
}

/**
 * Carrega o slide ativo no useEditor, reseta o passo para 0, limpa seleção e
 * limpa o histórico temporal para isolar o undo/redo por slide.
 */
export function loadSlideIntoEditor(slide: SlideData): void {
  useEditor.setState({
    doc: slide.doc,
    finish: slide.finish,
    step: 0,
    selectedIds: [],
    selectedId: null,
    editingId: null,
  });
  useEditor.temporal.getState().clear();
}

function cloneDocAndFinish(doc: Doc, finish: FinishState, format: PostFormat): { doc: Doc; finish: FinishState } {
  const clonedDoc: Doc = JSON.parse(JSON.stringify(doc));
  clonedDoc.format = format;
  const clonedFinish: FinishState = JSON.parse(JSON.stringify(finish));
  return { doc: clonedDoc, finish: clonedFinish };
}

export interface CarouselState {
  // ── Dados persistidos no localStorage ───────────────────────
  slides: SlideData[];
  activeSlideIndex: number;
  format: PostFormat;
  mode: CarouselMode;

  // ── Estado de sessão (não persiste) ─────────────────────────
  isExporting: boolean;
  exportProgress: { current: number; total: number } | null;

  // ── Actions ─────────────────────────────────────────────────
  setMode: (mode: CarouselMode) => void;
  setFormat: (format: PostFormat) => void;
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

export const useCarousel = create<CarouselState>()(
  (set, get) => ({
      slides: [defaultSlide('3:4')],
      activeSlideIndex: 0,
      format: '3:4',
      mode: null,
      isExporting: false,
      exportProgress: null,

      setMode: (mode) => {
        set({ mode });
        if (mode === 'carousel') {
          const { slides, activeSlideIndex } = get();
          const active = slides[activeSlideIndex];
          if (active) loadSlideIntoEditor(active);
        }
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

      addSlide: () => {
        const s = get();
        if (s.slides.length >= CAROUSEL_MAX_SLIDES) {
          useEditor
            .getState()
            .showToast('info', 'Chegou no limite! Um carrossel pode ter até 10 slides 🎠');
          return;
        }
        const newSlide = defaultSlide(s.format);
        const slides = enforceValidCrossover([...s.slides, newSlide], s.format);
        const activeSlideIndex = slides.length - 1;
        set({ slides, activeSlideIndex });
        loadSlideIntoEditor(slides[activeSlideIndex]);
      },

      duplicateSlide: (index) => {
        const s = get();
        if (index < 0 || index >= s.slides.length) return;
        if (s.slides.length >= CAROUSEL_MAX_SLIDES) {
          useEditor
            .getState()
            .showToast('info', 'Chegou no limite! Um carrossel pode ter até 10 slides 🎠');
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
        set({ slides, activeSlideIndex });
        loadSlideIntoEditor(slides[activeSlideIndex]);
      },

      removeSlide: (index) => {
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
        set({ slides, activeSlideIndex: newActive });
        loadSlideIntoEditor(slides[newActive]);
      },

      reorderSlides: (fromIndex, toIndex) => {
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
          const rawSlides = [...s.slides];
          const [moved] = rawSlides.splice(fromIndex, 1);
          rawSlides.splice(toIndex, 0, moved);
          const slides = enforceValidCrossover(rawSlides, s.format);

          const active = s.activeSlideIndex;
          let newActive = active;
          if (active === fromIndex) newActive = toIndex;
          else if (fromIndex < active && toIndex >= active) newActive = active - 1;
          else if (fromIndex > active && toIndex <= active) newActive = active + 1;

          return { slides, activeSlideIndex: newActive };
        });
      },

      setActiveSlide: (index) => {
        const s = get();
        if (index < 0 || index >= s.slides.length) return;
        set({ activeSlideIndex: index });
        loadSlideIntoEditor(s.slides[index]);
      },

      updateActiveSlide: (doc, finish) => {
        set((s) => {
          const slide = s.slides[s.activeSlideIndex];
          if (!slide) return s;
          const normalizedDoc = doc.format === s.format ? doc : { ...doc, format: s.format };
          const slides = syncCrossoverFromActiveSlide(
            s.slides,
            s.activeSlideIndex,
            slide.doc,
            normalizedDoc,
            finish,
            s.format,
          );
          return slides === s.slides ? s : { slides };
        });
      },

      setExporting: (progress) =>
        set({
          isExporting: progress !== null,
          exportProgress: progress,
        }),

      resetCarousel: () => {
        const initial = defaultSlide('3:4');
        set({
          slides: [initial],
          activeSlideIndex: 0,
          format: '3:4',
          mode: null,
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
  useCarousel.setState({
    slides: [firstSlide],
    activeSlideIndex: 0,
    format,
  });
  useCarousel.getState().setMode('carousel');
  loadSlideIntoEditor(firstSlide);
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__useCarousel = useCarousel;
}
