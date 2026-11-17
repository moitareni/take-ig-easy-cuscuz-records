import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultFinish, emptyDoc } from '../lib/sanitize';
import { loadSlideIntoEditor, useCarousel } from './carouselStore';
import { useEditor } from './editorStore';
import { installEditorCarouselSync, isApplyingState, withApplyingState } from './syncEngine';

describe('syncEngine', () => {
  let disposeSync: (() => void) | null = null;

  beforeEach(() => {
    disposeSync?.();
    disposeSync = null;

    const slides = [
      {
        id: 'slide-1',
        doc: { ...emptyDoc(), backgroundId: 'bg-a' },
        finish: defaultFinish(),
      },
      {
        id: 'slide-2',
        doc: { ...emptyDoc(), backgroundId: 'bg-b' },
        finish: defaultFinish(),
      },
    ];
    useCarousel.setState({
      mode: 'carousel',
      slides,
      activeSlideIndex: 0,
      activeSlideId: slides[0].id,
      format: '3:4',
    });
    loadSlideIntoEditor(slides[0]);
    disposeSync = installEditorCarouselSync();
  });

  afterEach(() => {
    disposeSync?.();
    disposeSync = null;
  });

  it('mantém guarda por profundidade e restaura após exceção em withApplyingState', () => {
    expect(isApplyingState()).toBe(false);

    withApplyingState(() => {
      expect(isApplyingState()).toBe(true);
      withApplyingState(() => {
        expect(isApplyingState()).toBe(true);
      });
      expect(isApplyingState()).toBe(true);
    });
    expect(isApplyingState()).toBe(false);

    expect(() =>
      withApplyingState(() => {
        expect(isApplyingState()).toBe(true);
        throw new Error('falha controlada');
      }),
    ).toThrow('falha controlada');
    expect(isApplyingState()).toBe(false);
  });

  it('bloqueia updateActiveSlide reentrante durante withApplyingState e sincroniza fora dele', () => {
    const spy = vi.spyOn(useCarousel.getState(), 'updateActiveSlide');

    withApplyingState(() => {
      useEditor.setState((prev) => ({
        doc: { ...prev.doc, backgroundId: 'bg-ignorado' },
      }));
    });
    expect(spy).not.toHaveBeenCalled();
    expect(useCarousel.getState().slides[0].doc.backgroundId).toBe('bg-a');

    useEditor.getState().setBackground('bg-c');
    expect(useCarousel.getState().slides[0].doc.backgroundId).toBe('bg-c');

    spy.mockRestore();
  });

  it('loadSlideIntoEditor troca de slide sem sobrescrever o slide anterior', () => {
    useCarousel.getState().setActiveSlide(1);

    expect(useEditor.getState().doc.backgroundId).toBe('bg-b');
    expect(useCarousel.getState().activeSlideIndex).toBe(1);
    expect(useCarousel.getState().slides[0].doc.backgroundId).toBe('bg-a');
  });
});
