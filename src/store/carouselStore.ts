import { create } from 'zustand';
import { CAROUSEL_MAX_SLIDES, type PostFormat } from '../brand/brand';
import {
  isCrossoverCopy,
  pruneOrphanCrossoverCopies,
  reconcileAllCrossovers,
  syncCrossoverFromActiveSlide,
} from '../lib/crossover';
import type { Doc, FinishState, SlideData } from '../types';
import {
  defaultFinish,
  emptyDoc,
  flushTextEditing,
  sanitize,
  sanitizeFinish,
  useEditor,
} from './editorStore';

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
 * Slide cujo `doc` está carregado no `useEditor`. A posse é pelo **id** do
 * slide, nunca pelo índice: depois de reordenar/remover páginas o índice pode
 * estar defasado por um frame, e gravar pelo índice jogava o doc inteiro
 * (fundo, textura, elementos) na página errada.
 */
let editingSlideId: string | null = null;

/** Id do slide que está no editor (usado por testes e pelo autosave). */
export function activeEditorSlideId(): string | null {
  return editingSlideId;
}

/**
 * Carrega o slide ativo no useEditor, reseta o passo para 0, limpa seleção e
 * limpa o histórico temporal para isolar o undo/redo por slide.
 */
export function loadSlideIntoEditor(slide: SlideData): void {
  editingSlideId = slide.id;
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
        // Fecha a edição de texto pendente antes de trocar o slide ativo.
        flushTextEditing();
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
        flushTextEditing();
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
        set({ slides, activeSlideIndex: newActive });
        loadSlideIntoEditor(slides[newActive]);
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
          const editorIndex = editingSlideId
            ? slides.findIndex((slide) => slide.id === editingSlideId)
            : -1;
          const newActive = editorIndex >= 0 ? editorIndex : shiftIndex(s.activeSlideIndex);

          return { slides, activeSlideIndex: newActive };
        });

        // O prune pode ter tirado uma cópia órfã do slide que está no palco.
        const after = get();
        const active = after.slides[after.activeSlideIndex];
        if (active && editingSlideId === active.id) resyncEditorDoc(active);
      },

      setActiveSlide: (index) => {
        // Fecha a edição de texto pendente ANTES de trocar o índice, para o
        // doc congelado ser gravado no slide que está sendo deixado.
        flushTextEditing();
        const s = get();
        if (index < 0 || index >= s.slides.length) return;
        set({ activeSlideIndex: index });
        loadSlideIntoEditor(s.slides[index]);
      },

      updateActiveSlide: (doc, finish) => {
        set((s) => {
          // Grava pelo DONO do doc (id do slide carregado no editor). Se o
          // índice estiver defasado, corrige — o doc nunca cai na página errada.
          const byId = editingSlideId
            ? s.slides.findIndex((slide) => slide.id === editingSlideId)
            : -1;
          const index = byId >= 0 ? byId : s.activeSlideIndex;
          const slide = s.slides[index];
          if (!slide) return s;
          // Nada mudou no palco (ex.: `resyncEditorDoc` devolveu o doc já
          // podado): reagir aqui materializaria sangria em vizinha nova, o que
          // a reordenação não deve fazer.
          if (slide.doc === doc && slide.finish === finish) return s;
          const normalizedDoc = doc.format === s.format ? doc : { ...doc, format: s.format };
          const slides = syncCrossoverFromActiveSlide(
            s.slides,
            index,
            slide.doc,
            normalizedDoc,
            finish,
            s.format,
          );
          if (slides === s.slides && index === s.activeSlideIndex) return s;
          return { slides, activeSlideIndex: index };
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
