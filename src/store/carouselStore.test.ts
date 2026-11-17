import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAROUSEL_MAX_SLIDES, type PostFormat } from '../brand/brand';
import { extractSingleSlideData } from '../lib/crossover';
import type { El, SlideData } from '../types';
import {
  CAROUSEL_STORAGE_KEY,
  SINGLE_STORAGE_KEY,
  defaultSlide,
  isSlideEmpty,
  loadSlideIntoEditor,
  sanitizeSlide,
  useCarousel,
} from './carouselStore';
import { defaultFinish, emptyDoc, redo, undo, useEditor } from './editorStore';
import { installEditorCarouselSync } from './syncEngine';

const makeTextEl = (id: string, text = 'CUSCUZ', crossover?: boolean): El => ({
  id,
  kind: 'text',
  style: 'title',
  text,
  x: 540,
  y: 720,
  rotation: 0,
  scale: 1,
  fontSize: 120,
  lineHeight: 0.95,
  letterSpacing: 0,
  align: 'center',
  uppercase: true,
  color: 'preto',
  brandEffect: false,
  border: 'none',
  ...(crossover !== undefined ? { crossover } : {}),
});

const makeImageEl = (id: string, imageId: string): El => ({
  id,
  kind: 'image',
  imageId,
  name: 'foto',
  width: 800,
  height: 600,
  flipX: false,
  flipY: false,
  x: 400,
  y: 400,
  rotation: 0,
  scale: 1,
});

describe('carouselStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useCarousel.getState().resetCarousel();
    useEditor.getState().reset();
    useEditor.setState({ toast: null });
    useEditor.temporal.getState().clear();
    vi.runAllTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('Propriedade 1: Formato uniforme dos slides', () => {
    it('aplica o PostFormat selecionado a todos os slides do carrossel', () => {
      const formats: PostFormat[] = ['3:4', '4:3', '1:1'];
      for (const fmt of formats) {
        useCarousel.getState().resetCarousel();
        useCarousel.getState().setFormat(fmt);
        useCarousel.getState().addSlide();
        useCarousel.getState().duplicateSlide(0);

        const { slides, format } = useCarousel.getState();
        expect(format).toBe(fmt);
        for (const s of slides) {
          expect(s.doc.format).toBe(fmt);
        }
      }
    });
  });

  describe('Propriedade 3: addSlide incrementa e ativa corretamente', () => {
    it('para n < CAROUSEL_MAX_SLIDES, após addSlide(), slides.length === n + 1 e activeSlideIndex === n', () => {
      for (let n = 1; n < CAROUSEL_MAX_SLIDES; n++) {
        expect(useCarousel.getState().slides.length).toBe(n);
        useCarousel.getState().addSlide();
        const st = useCarousel.getState();
        expect(st.slides.length).toBe(n + 1);
        expect(st.activeSlideIndex).toBe(n);
      }

      // Tentativa além de CAROUSEL_MAX_SLIDES é bloqueada com toast
      useCarousel.getState().addSlide();
      expect(useCarousel.getState().slides.length).toBe(CAROUSEL_MAX_SLIDES);
      expect(useEditor.getState().toast?.message).toContain('10 slides');
    });
  });

  describe('Propriedade 4: duplicateSlide preserva dados e cria identidade nova', () => {
    it('cria cópia profunda do doc e finish com id diferente e insere após o índice', () => {
      for (let run = 0; run < 10; run++) {
        useCarousel.getState().resetCarousel();
        useCarousel.getState().setMode('carousel');
        const customDoc = {
          ...emptyDoc(),
          backgroundFlipX: run % 2 === 0,
          elements: [makeTextEl(`txt-${run}`, `Slide ${run}`)],
        };
        const customFinish = {
          ...defaultFinish(),
          paper: { enabled: true, opacity: 30 + run },
        };
        useCarousel.getState().updateActiveSlide(customDoc, customFinish);
        useCarousel.getState().addSlide();

        const orig = useCarousel.getState().slides[0];
        useCarousel.getState().duplicateSlide(0);

        const st = useCarousel.getState();
        expect(st.slides.length).toBe(3);
        expect(st.activeSlideIndex).toBe(1);

        const copy = st.slides[1];
        expect(copy.id).not.toBe(orig.id);

        // Conteúdo igual, mas cada slide é dono dos seus elementos: os ids
        // são novos no duplicado (o crossover casa por id entre vizinhas).
        const withoutElementIds = (doc: typeof orig.doc) => ({
          ...doc,
          elements: doc.elements.map((el) => {
            const content = { ...el };
            delete (content as { id?: string }).id;
            return content;
          }),
        });
        expect(withoutElementIds(copy.doc)).toEqual(withoutElementIds(orig.doc));
        expect(copy.doc.elements[0].id).not.toBe(orig.doc.elements[0].id);
        expect(copy.finish).toEqual(orig.finish);
        // Cópia profunda (referências independentes)
        expect(copy.doc).not.toBe(orig.doc);
        expect(copy.doc.elements).not.toBe(orig.doc.elements);
        expect(copy.finish).not.toBe(orig.finish);
      }
    });
  });

  describe('Propriedade 5: removeSlide mantém slide ativo válido', () => {
    it('para qualquer n > 1 e índice válido i, removeSlide(i) deixa n - 1 slides e activeSlideIndex ∈ [0, n - 2]', () => {
      for (let n = 2; n <= CAROUSEL_MAX_SLIDES; n++) {
        for (let removeIdx = 0; removeIdx < n; removeIdx++) {
          useCarousel.getState().resetCarousel();
          for (let k = 1; k < n; k++) {
            useCarousel.getState().addSlide();
          }
          useCarousel.getState().setActiveSlide(removeIdx);
          useCarousel.getState().removeSlide(removeIdx);

          const st = useCarousel.getState();
          expect(st.slides.length).toBe(n - 1);
          expect(st.activeSlideIndex).toBeGreaterThanOrEqual(0);
          expect(st.activeSlideIndex).toBeLessThanOrEqual(n - 2);
        }
      }

      // Quando há apenas 1 slide, não remove e emite toast
      useCarousel.getState().resetCarousel();
      useCarousel.getState().removeSlide(0);
      expect(useCarousel.getState().slides.length).toBe(1);
      expect(useEditor.getState().toast?.message).toContain('pelo menos 1 slide');
    });
  });

  describe('Propriedade 6: reorderSlides preserva identidade do slide ativo', () => {
    it('o slide ativo antes da reordenação continua sendo o ativo depois', () => {
      useCarousel.getState().resetCarousel();
      for (let k = 1; k < 5; k++) {
        useCarousel.getState().addSlide();
      }

      for (let activeIdx = 0; activeIdx < 5; activeIdx++) {
        for (let from = 0; from < 5; from++) {
          for (let to = 0; to < 5; to++) {
            useCarousel.getState().setActiveSlide(activeIdx);
            const activeIdBefore = useCarousel.getState().slides[activeIdx].id;

            useCarousel.getState().reorderSlides(from, to);

            const st = useCarousel.getState();
            const activeIdAfter = st.slides[st.activeSlideIndex].id;
            expect(activeIdAfter).toBe(activeIdBefore);
          }
        }
      }
    });
  });

  describe('Propriedade 7: setActiveSlide respeita os limites da lista', () => {
    it('altera para j quando 0 <= j < n e ignora índices fora do intervalo', () => {
      useCarousel.getState().resetCarousel();
      useCarousel.getState().addSlide();
      useCarousel.getState().addSlide(); // 3 slides

      useCarousel.getState().setActiveSlide(1);
      expect(useCarousel.getState().activeSlideIndex).toBe(1);

      for (const invalid of [-5, -1, 3, 4, 10, 99]) {
        useCarousel.getState().setActiveSlide(invalid);
        expect(useCarousel.getState().activeSlideIndex).toBe(1);
      }

      useCarousel.getState().setActiveSlide(0);
      expect(useCarousel.getState().activeSlideIndex).toBe(0);
      useCarousel.getState().setActiveSlide(2);
      expect(useCarousel.getState().activeSlideIndex).toBe(2);
    });
  });

  describe('Propriedade 2: Integridade estrutural da lista de slides', () => {
    it('qualquer sequência de addSlide, removeSlide e duplicateSlide mantém length em [1, CAROUSEL_MAX_SLIDES]', () => {
      useCarousel.getState().resetCarousel();
      const ops = [
        () => useCarousel.getState().addSlide(),
        () => useCarousel.getState().duplicateSlide(0),
        () => useCarousel.getState().removeSlide(0),
        () => useCarousel.getState().removeSlide(useCarousel.getState().slides.length - 1),
      ];

      for (let step = 0; step < 60; step++) {
        ops[step % ops.length]();
        const len = useCarousel.getState().slides.length;
        expect(len).toBeGreaterThanOrEqual(1);
        expect(len).toBeLessThanOrEqual(CAROUSEL_MAX_SLIDES);
      }
    });
  });

  describe('Propriedade 20: Isolamento de chaves de persistência', () => {
    it('operações do carrossel nunca gravam nas chaves legadas do localStorage', () => {
      localStorage.setItem(SINGLE_STORAGE_KEY, '{"preserved":true}');
      localStorage.setItem(CAROUSEL_STORAGE_KEY, '{"preserved":true}');
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      useCarousel.getState().setMode('carousel');
      useCarousel.getState().addSlide();
      useCarousel.getState().updateActiveSlide(
        { ...emptyDoc(), elements: [makeTextEl('t1')] },
        defaultFinish(),
      );
      useCarousel.getState().duplicateSlide(1);
      useCarousel.getState().reorderSlides(0, 2);
      useCarousel.getState().setActiveSlide(0);
      useCarousel.getState().removeSlide(1);

      vi.runAllTimers();

      // A persistência agora é feita pela sessão de rascunhos no IndexedDB;
      // os stores em memória não tocam mais no localStorage.
      const writes = setItemSpy.mock.calls.filter(
        ([k]) => k === SINGLE_STORAGE_KEY || k === CAROUSEL_STORAGE_KEY,
      );
      expect(writes).toHaveLength(0);
      expect(localStorage.getItem(SINGLE_STORAGE_KEY)).toBe('{"preserved":true}');
      expect(localStorage.getItem(CAROUSEL_STORAGE_KEY)).toBe('{"preserved":true}');

      setItemSpy.mockRestore();
    });
  });

  describe('Propriedade 16 e 17: Serialização round-trip e ausência de blobs', () => {
    it('sanitizeSlide preserva SlideData válido após JSON round-trip', () => {
      for (const fmt of ['3:4', '4:3', '1:1'] as PostFormat[]) {
        const slide: SlideData = {
          id: `slide-${fmt}`,
          doc: {
            format: fmt,
            backgroundId: null,
            backgroundFlipX: true,
            backgroundFlipY: false,
            backgroundOffsetY: 120,
            elements: [makeTextEl('t1', 'OLÁ'), makeImageEl('img1', 'idb-key-1')],
          },
          finish: {
            paper: { enabled: true, opacity: 45 },
            grain: { enabled: true, intensity: 60, size: 'M' },
            borderTexture: { enabled: false, opacity: 40 },
          },
        };

        const raw = JSON.parse(JSON.stringify(slide));
        const restored = sanitizeSlide(raw);
        expect(restored).toEqual(slide);
      }
    });

    it('o estado do carrossel guarda só metadados: sem blobs nem base64 de imagem', () => {
      useCarousel.getState().setMode('carousel');
      useCarousel.getState().updateActiveSlide(
        {
          ...emptyDoc(),
          elements: [makeImageEl('i1', 'img-id-123'), makeTextEl('t1', 'Cuscuz')],
        },
        defaultFinish(),
      );

      // O que seria gravado é exatamente o corpo serializável do rascunho.
      const payload = JSON.stringify({
        slides: useCarousel.getState().slides,
        activeSlideIndex: useCarousel.getState().activeSlideIndex,
        format: useCarousel.getState().format,
        mode: useCarousel.getState().mode,
      });
      expect(payload).not.toContain('data:image');
      expect(payload).not.toContain('blob:');
      expect(payload).toContain('img-id-123');
    });
  });

  describe('Propriedade 8 e Tarefa 9.2: loadSlideIntoEditor e isolamento de undo/redo', () => {
    it('carrega doc e finish corretos, reseta step=0 e selectedIds=[], e limpa histórico temporal', () => {
      const slide: SlideData = {
        id: 's-test',
        doc: {
          ...emptyDoc(),
          elements: [makeTextEl('t1', 'TESTE')],
        },
        finish: {
          ...defaultFinish(),
          paper: { enabled: true, opacity: 75 },
        },
      };

      // Suja estado do editor antes
      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().addText('title');
      useEditor.getState().setStep(3);
      expect(useEditor.getState().step).toBe(3);
      expect(useEditor.getState().selectedIds.length).toBe(1);
      expect(useEditor.temporal.getState().pastStates.length).toBeGreaterThan(0);

      loadSlideIntoEditor(slide);

      const ed = useEditor.getState();
      expect(ed.doc).toEqual(slide.doc);
      expect(ed.finish).toEqual(slide.finish);
      expect(ed.step).toBe(0);
      expect(ed.selectedIds).toEqual([]);
      expect(ed.selectedId).toBeNull();
      expect(ed.editingId).toBeNull();
      expect(useEditor.temporal.getState().pastStates).toHaveLength(0);
    });

    it('Propriedade 10 e 13: edição e undo/redo afetam apenas o slide ativo', () => {
      useCarousel.getState().resetCarousel();
      useCarousel.getState().setMode('carousel');
      useCarousel.getState().addSlide(); // 2 slides, ativo = 1

      const slide0Before = useCarousel.getState().slides[0];

      // Edita no slide 1 via useEditor e sincroniza
      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().addText('title');
      useCarousel.getState().updateActiveSlide(useEditor.getState().doc, useEditor.getState().finish);

      expect(useCarousel.getState().slides[0]).toBe(slide0Before);
      expect(useCarousel.getState().slides[1].doc.elements).toHaveLength(1);

      // Undo no slide 1
      undo();
      useCarousel.getState().updateActiveSlide(useEditor.getState().doc, useEditor.getState().finish);
      expect(useCarousel.getState().slides[1].doc.elements).toHaveLength(0);
      expect(useCarousel.getState().slides[0]).toBe(slide0Before);

      // Redo no slide 1
      redo();
      useCarousel.getState().updateActiveSlide(useEditor.getState().doc, useEditor.getState().finish);
      expect(useCarousel.getState().slides[1].doc.elements).toHaveLength(1);
      expect(useCarousel.getState().slides[0]).toBe(slide0Before);
    });
  });

  describe('Propriedade 22 e isSlideEmpty', () => {
    it('crossover é permitido em qualquer slide quando há 2+ slides (inclusive no último p/ sangria à esquerda) e removido quando resta só 1 slide', () => {
      useCarousel.getState().resetCarousel();
      useCarousel.getState().setMode('carousel');
      useCarousel.getState().addSlide(); // 2 slides

      // No slide 1 (último), crossover: true é permitido (vaza da esquerda para a direita do slide 0)
      useCarousel.getState().setActiveSlide(1);
      useCarousel.getState().updateActiveSlide(
        { ...emptyDoc(), elements: [makeTextEl('t2', 'Vaza p/ Slide 1', true)] },
        defaultFinish(),
      );
      expect(useCarousel.getState().slides[1].doc.elements[0].crossover).toBe(true);

      // No slide 0 (primeiro), crossover: true também é permitido (vaza da direita para a esquerda do slide 1)
      useCarousel.getState().setActiveSlide(0);
      useCarousel.getState().updateActiveSlide(
        { ...emptyDoc(), elements: [makeTextEl('t1', 'Vaza p/ Slide 2', true)] },
        defaultFinish(),
      );
      expect(useCarousel.getState().slides[0].doc.elements[0].crossover).toBe(true);

      // Ao remover o slide 1, resta apenas 1 slide no carrossel -> crossover é limpo
      useCarousel.getState().removeSlide(1);
      expect(useCarousel.getState().slides[0].doc.elements[0].crossover).toBeUndefined();
    });

    it('isSlideEmpty detecta slides vazios e slides com conteúdo', () => {
      const empty = defaultSlide('3:4');
      expect(isSlideEmpty(empty)).toBe(true);

      const withEl: SlideData = {
        ...empty,
        doc: { ...empty.doc, elements: [makeTextEl('t1')] },
      };
      expect(isSlideEmpty(withEl)).toBe(false);

      const withFinish: SlideData = {
        ...empty,
        finish: { ...empty.finish, paper: { enabled: true, opacity: 40 } },
      };
      expect(isSlideEmpty(withFinish)).toBe(false);
    });

    it('Propriedade 22: permite manipular elemento crossover a partir de qualquer uma das páginas (sincronização bidirecional)', () => {
      useCarousel.getState().resetCarousel();
      useCarousel.getState().setMode('carousel');
      useCarousel.getState().addSlide(); // 2 slides (0 e 1), formato 3:4 (width = 1080)

      // 1. No Slide 0, posiciona imagem na borda direita (x = 980, width = 800 → minX = 580, maxX = 1380 > 1080)
      useCarousel.getState().setActiveSlide(0);
      const imgOnSlide0: El = {
        ...makeImageEl('shared-img', 'blob-1'),
        x: 980,
        y: 500,
        crossover: true,
      };
      useCarousel.getState().updateActiveSlide(
        { ...emptyDoc(), elements: [imgOnSlide0] },
        defaultFinish(),
      );

      // Deve ter sincronizado automaticamente para o Slide 1 em x = 980 - 1080 = -100
      const slide1AfterImport = useCarousel.getState().slides[1];
      expect(slide1AfterImport.doc.elements).toHaveLength(1);
      expect(slide1AfterImport.doc.elements[0].id).toBe('shared-img');
      expect(slide1AfterImport.doc.elements[0].x).toBe(-100);
      expect(slide1AfterImport.doc.elements[0].y).toBe(500);

      // 2. Troca para o Slide 1 (a página que NÃO importou o elemento originalmente) e manipula por lá!
      useCarousel.getState().setActiveSlide(1);
      expect(useEditor.getState().doc.elements).toHaveLength(1);
      expect(useEditor.getState().doc.elements[0].id).toBe('shared-img');

      // Move para x = -200, y = 620, gira 25° e aumenta escala para 1.25 a partir do Slide 1
      useEditor.getState().updateElement('shared-img', {
        x: -200,
        y: 620,
        rotation: 25,
        scale: 1.25,
      });
      useCarousel
        .getState()
        .updateActiveSlide(useEditor.getState().doc, useEditor.getState().finish);

      // Slide 0 deve refletir todas as alterações com x = -200 + 1080 = 880
      const slide0AfterEditOn1 = useCarousel.getState().slides[0];
      expect(slide0AfterEditOn1.doc.elements).toHaveLength(1);
      expect(slide0AfterEditOn1.doc.elements[0]).toMatchObject({
        id: 'shared-img',
        x: 880,
        y: 620,
        rotation: 25,
        scale: 1.25,
        crossover: true,
      });

      // 3. Se no Slide 1 o usuário puxar o elemento totalmente para o centro do Slide 1 (x = 540),
      // ele deixa de sangrar para o Slide 0 → some do Slide 0 e fica só no Slide 1
      useEditor.getState().updateElement('shared-img', {
        x: 540,
        scale: 0.5,
        rotation: 0,
        crossover: false,
      });
      useCarousel
        .getState()
        .updateActiveSlide(useEditor.getState().doc, useEditor.getState().finish);

      expect(useCarousel.getState().slides[0].doc.elements).toHaveLength(0);
      expect(useCarousel.getState().slides[1].doc.elements).toHaveLength(1);
      expect(useCarousel.getState().slides[1].doc.elements[0].x).toBe(540);
      expect(useCarousel.getState().slides[1].doc.elements[0].crossover).toBeUndefined();
    });

    it('Propriedade 23: preserva o elemento crossover ao trocar para Post Único escolhendo a página que não o importou', () => {
      useCarousel.getState().resetCarousel();
      useCarousel.getState().setMode('carousel');
      useCarousel.getState().addSlide(); // 2 slides (0 e 1)

      // Caso A: Importado no Slide 0 (borda direita, x = 950) → escolhe Slide 1 para manter como Post Único
      useCarousel.getState().setActiveSlide(0);
      useCarousel.getState().updateActiveSlide(
        {
          ...emptyDoc(),
          elements: [{ ...makeImageEl('el-from-0', 'img-0'), x: 950, crossover: true }],
        },
        defaultFinish(),
      );

      const chosenSlide1 = extractSingleSlideData(
        useCarousel.getState().slides,
        1,
        useCarousel.getState().format,
      );
      expect(chosenSlide1).not.toBeNull();
      expect(chosenSlide1!.doc.elements).toHaveLength(1);
      expect(chosenSlide1!.doc.elements[0].id).toBe('el-from-0');
      expect(chosenSlide1!.doc.elements[0].x).toBe(950 - 1080);
      expect(chosenSlide1!.doc.elements[0].crossover).toBeUndefined();

      // Caso B: Importado no Slide 1 (borda esquerda, x = 100) → escolhe Slide 0 para manter como Post Único
      useCarousel.getState().resetCarousel();
      useCarousel.getState().setMode('carousel');
      useCarousel.getState().addSlide();
      useCarousel.getState().setActiveSlide(1);
      useCarousel.getState().updateActiveSlide(
        {
          ...emptyDoc(),
          elements: [{ ...makeImageEl('el-from-1', 'img-1'), x: 100, crossover: true }],
        },
        defaultFinish(),
      );

      const chosenSlide0 = extractSingleSlideData(
        useCarousel.getState().slides,
        0,
        useCarousel.getState().format,
      );
      expect(chosenSlide0).not.toBeNull();
      expect(chosenSlide0!.doc.elements).toHaveLength(1);
      expect(chosenSlide0!.doc.elements[0].id).toBe('el-from-1');
      expect(chosenSlide0!.doc.elements[0].x).toBe(100 + 1080);
      expect(chosenSlide0!.doc.elements[0].crossover).toBeUndefined();
    });
  });

  describe('applyFinishToAll (textura em todos os slides)', () => {
    let disposeSync: (() => void) | null = null;

    beforeEach(() => {
      disposeSync = installEditorCarouselSync();
    });

    afterEach(() => {
      disposeSync?.();
      disposeSync = null;
    });

    it('applyFinishToAll nasce ativo (true) por padrão no carrossel', () => {
      useCarousel.getState().resetCarousel();
      expect(useCarousel.getState().applyFinishToAll).toBe(true);
    });

    it('setApplyFinishToAll(true) copia o finish do slide ativo para todos os slides', () => {
      useCarousel.getState().resetCarousel();
      useCarousel.getState().setMode('carousel');
      useCarousel.getState().setApplyFinishToAll(false);
      useCarousel.getState().addSlide();
      useCarousel.getState().setActiveSlide(0);

      useEditor.getState().setPaper({ enabled: true, opacity: 70 });
      useEditor.getState().setGrain({ enabled: true, intensity: 55, size: 'G' });
      expect(useCarousel.getState().slides[1].finish.paper.enabled).toBe(false);

      useCarousel.getState().setApplyFinishToAll(true);

      const st = useCarousel.getState();
      expect(st.applyFinishToAll).toBe(true);
      expect(st.slides[0].finish).toEqual(useEditor.getState().finish);
      expect(st.slides[1].finish).toEqual(useEditor.getState().finish);
      expect(st.slides[1].finish).not.toBe(st.slides[0].finish);
    });

    it('com applyFinishToAll ativo, alterações, undo/redo e addSlide propagam o finish para todos os slides', () => {
      useCarousel.getState().resetCarousel();
      useCarousel.getState().setMode('carousel');
      useCarousel.getState().addSlide();
      useCarousel.getState().setActiveSlide(0);
      useCarousel.getState().setApplyFinishToAll(true);

      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().setPaper({ enabled: true, opacity: 65 });
      expect(useCarousel.getState().slides[1].finish.paper).toEqual({ enabled: true, opacity: 65 });

      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().enableAllFinishes();
      for (const slide of useCarousel.getState().slides) {
        expect(slide.finish.paper.enabled).toBe(true);
        expect(slide.finish.borderTexture.enabled).toBe(true);
        expect(slide.finish.grain.enabled).toBe(true);
      }

      useCarousel.getState().addSlide();
      const slidesAfterAdd = useCarousel.getState().slides;
      expect(slidesAfterAdd).toHaveLength(3);
      expect(slidesAfterAdd[2].finish.paper.enabled).toBe(true);
      expect(slidesAfterAdd[2].finish.borderTexture.enabled).toBe(true);
      expect(slidesAfterAdd[2].finish.grain.enabled).toBe(true);

      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().disableAllFinishes();
      for (const slide of useCarousel.getState().slides) {
        expect(slide.finish.paper.enabled).toBe(false);
        expect(slide.finish.borderTexture.enabled).toBe(false);
        expect(slide.finish.grain.enabled).toBe(false);
      }

      vi.setSystemTime(Date.now() + 1000);
      undo();
      for (const slide of useCarousel.getState().slides) {
        expect(slide.finish.paper.enabled).toBe(true);
        expect(slide.finish.borderTexture.enabled).toBe(true);
        expect(slide.finish.grain.enabled).toBe(true);
      }

      vi.setSystemTime(Date.now() + 1000);
      redo();
      for (const slide of useCarousel.getState().slides) {
        expect(slide.finish.paper.enabled).toBe(false);
        expect(slide.finish.borderTexture.enabled).toBe(false);
        expect(slide.finish.grain.enabled).toBe(false);
      }
    });

    it('setApplyFinishToAll(false) preserva as texturas já aplicadas nos outros slides e passa a editar apenas o slide ativo', () => {
      useCarousel.getState().resetCarousel();
      useCarousel.getState().setMode('carousel');
      useCarousel.getState().addSlide();
      useCarousel.getState().addSlide();
      useCarousel.getState().setActiveSlide(1);
      useCarousel.getState().setApplyFinishToAll(true);

      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().enableAllFinishes();
      expect(useCarousel.getState().slides[0].finish.paper.enabled).toBe(true);
      expect(useCarousel.getState().slides[1].finish.paper.enabled).toBe(true);
      expect(useCarousel.getState().slides[2].finish.paper.enabled).toBe(true);

      // Desliga "Aplicar em todos os slides": nenhum slide perde a textura
      useCarousel.getState().setApplyFinishToAll(false);
      const afterToggleOff = useCarousel.getState();
      expect(afterToggleOff.applyFinishToAll).toBe(false);
      expect(afterToggleOff.slides[0].finish.paper.enabled).toBe(true);
      expect(afterToggleOff.slides[1].finish.paper.enabled).toBe(true);
      expect(afterToggleOff.slides[2].finish.paper.enabled).toBe(true);

      // Agora desativa as texturas no slide ativo (slide 1): só o slide 1 perde
      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().disableAllFinishes();
      const afterDisableOne = useCarousel.getState();
      expect(afterDisableOne.slides[0].finish.paper.enabled).toBe(true);
      expect(afterDisableOne.slides[0].finish.borderTexture.enabled).toBe(true);
      expect(afterDisableOne.slides[0].finish.grain.enabled).toBe(true);
      expect(afterDisableOne.slides[1].finish.paper.enabled).toBe(false);
      expect(afterDisableOne.slides[1].finish.borderTexture.enabled).toBe(false);
      expect(afterDisableOne.slides[1].finish.grain.enabled).toBe(false);
      expect(afterDisableOne.slides[2].finish.paper.enabled).toBe(true);
      expect(afterDisableOne.slides[2].finish.borderTexture.enabled).toBe(true);
      expect(afterDisableOne.slides[2].finish.grain.enabled).toBe(true);
    });

    it('fluxo completo: edições individuais, em lote com applyFinishToAll e desativação isolada após desligar', () => {
      useCarousel.getState().resetCarousel();
      useCarousel.getState().setMode('carousel');
      useCarousel.getState().setApplyFinishToAll(false);
      useCarousel.getState().addSlide();
      useCarousel.getState().addSlide(); // 3 slides

      // 1. Ativa textura em dois slides com applyFinishToAll desativado
      useCarousel.getState().setActiveSlide(0);
      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().setPaper({ enabled: true, opacity: 50 });
      useCarousel.getState().setActiveSlide(1);
      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().setPaper({ enabled: true, opacity: 60 });

      expect(useCarousel.getState().slides[0].finish.paper).toEqual({ enabled: true, opacity: 50 });
      expect(useCarousel.getState().slides[1].finish.paper).toEqual({ enabled: true, opacity: 60 });
      expect(useCarousel.getState().slides[2].finish.paper.enabled).toBe(false);

      // 2. Desativa textura de cada um com applyFinishToAll desativado
      useCarousel.getState().setActiveSlide(0);
      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().setPaper({ enabled: false });
      expect(useCarousel.getState().slides[0].finish.paper.enabled).toBe(false);
      expect(useCarousel.getState().slides[1].finish.paper.enabled).toBe(true);

      useCarousel.getState().setActiveSlide(1);
      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().setPaper({ enabled: false });
      expect(useCarousel.getState().slides[1].finish.paper.enabled).toBe(false);

      // 3. Ativa applyFinishToAll, ativa em um -> aplica em todos; desativa em um -> desativa em todos
      useCarousel.getState().setActiveSlide(0);
      useCarousel.getState().setApplyFinishToAll(true);
      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().enableAllFinishes();
      for (const sl of useCarousel.getState().slides) {
        expect(sl.finish.paper.enabled).toBe(true);
        expect(sl.finish.borderTexture.enabled).toBe(true);
        expect(sl.finish.grain.enabled).toBe(true);
      }

      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().disableAllFinishes();
      for (const sl of useCarousel.getState().slides) {
        expect(sl.finish.paper.enabled).toBe(false);
        expect(sl.finish.borderTexture.enabled).toBe(false);
        expect(sl.finish.grain.enabled).toBe(false);
      }

      // 4. Reativa em todos e depois desliga applyFinishToAll para remover só do slide 2
      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().enableAllFinishes();
      useCarousel.getState().setApplyFinishToAll(false);

      useCarousel.getState().setActiveSlide(2);
      vi.setSystemTime(Date.now() + 1000);
      useEditor.getState().setPaper({ enabled: false });
      expect(useCarousel.getState().slides[0].finish.paper.enabled).toBe(true);
      expect(useCarousel.getState().slides[1].finish.paper.enabled).toBe(true);
      expect(useCarousel.getState().slides[2].finish.paper.enabled).toBe(false);
    });
  });
});
