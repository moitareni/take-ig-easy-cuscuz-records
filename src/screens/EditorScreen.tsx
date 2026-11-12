import React, { useEffect, useRef, useState } from 'react';
import { Redo2, Undo2 } from 'lucide-react';
import { getPostDimensions } from '../brand/brand';
import { EditorCanvas, type EditorCanvasHandle } from '../canvas/EditorCanvas';
import { AlignToolbar } from '../components/AlignToolbar';
import { BackgroundMirrorToolbar } from '../components/BackgroundMirrorToolbar';
import { SlideTray } from '../components/carousel/SlideTray';
import { GuideToolbar } from '../components/GuideToolbar';
import { Header } from '../components/Header';
import { StepFooter } from '../components/StepFooter';
import { Stepper } from '../components/Stepper';
import { ZoomControls } from '../components/ZoomControls';
import { IconButton } from '../components/ui/IconButton';
import { DRAFT_COVER_WIDTH, setCoverCaptureProvider } from '../lib/drafts/cover';
import { exportPost } from '../lib/export';
import { CarouselExportError, exportCarousel } from '../lib/exportCarousel';
import { useKeyboardShortcuts } from '../lib/shortcuts';
import { BackgroundStep } from '../steps/BackgroundStep';
import { DecorationStep } from '../steps/DecorationStep';
import { ImageStep } from '../steps/ImageStep';
import { LogoStep } from '../steps/LogoStep';
import { TextStep } from '../steps/TextStep';
import { TextureStep } from '../steps/TextureStep';
import { useCarousel } from '../store/carouselStore';
import { redo, undo, useEditor } from '../store/editorStore';
import type { AlignMode } from '../types';
import styles from '../App.module.css';

export const EditorScreen: React.FC = () => {
  const canvasRef = useRef<EditorCanvasHandle>(null);
  const [isExporting, setIsExporting] = useState(false);

  const mode = useCarousel((s) => s.mode);
  const activeSlideIndex = useCarousel((s) => s.activeSlideIndex);
  const slidesCount = useCarousel((s) => s.slides.length);
  const step = useEditor((s) => s.step);
  const select = useEditor((s) => s.select);
  const showToast = useEditor((s) => s.showToast);

  // Ativa atalhos de teclado (Ctrl+Z, Delete, Setas, etc.)
  useKeyboardShortcuts();

  // A capa do rascunho é a folha em miniatura: o provedor usa o stage ativo.
  useEffect(() => {
    setCoverCaptureProvider(async () => {
      const canvas = canvasRef.current;
      const stage = canvas?.getStage();
      const displayWidth = canvas?.getDisplayWidth();
      if (!stage || !displayWidth) return null;

      const carousel = useCarousel.getState();
      const format =
        carousel.mode === 'carousel' ? carousel.format : (useEditor.getState().doc.format ?? '3:4');
      const { width: postW, height: postH } = getPostDimensions(format);

      // A captura precisa esconder Transformer/editor/guias, mas NÃO pode
      // roubar a seleção de quem está editando (a capa também é gerada no
      // autosave). Só devolve o que a captura mexeu — e nunca o `step`, que a
      // usuária pode ter mudado durante os 50ms (ex.: clicando em "Próximo").
      const before = useEditor.getState();
      const snapshot = {
        selectedIds: before.selectedIds,
        selectedId: before.selectedId,
        editingId: before.editingId,
        guidesVisible: before.layoutGuides.visible,
      };
      before.select(null);
      before.setEditing(null);
      before.setGuidesVisible(false);
      await new Promise((resolve) => setTimeout(resolve, 50));

      try {
        const dataUrl = stage.toDataURL({
          pixelRatio: DRAFT_COVER_WIDTH / displayWidth,
          mimeType: 'image/webp',
          x: stage.x(),
          y: stage.y(),
          width: displayWidth,
          height: (displayWidth * postH) / postW,
        });
        const blob = await (await fetch(dataUrl)).blob();
        return blob.size > 0 ? blob : null;
      } catch {
        return null;
      } finally {
        useEditor.setState((state) => ({
          ...(state.selectedIds.length === 0
            ? { selectedIds: snapshot.selectedIds, selectedId: snapshot.selectedId }
            : {}),
          ...(state.editingId === null ? { editingId: snapshot.editingId } : {}),
          layoutGuides: { ...state.layoutGuides, visible: snapshot.guidesVisible },
        }));
      }
    });
    return () => setCoverCaptureProvider(null);
  }, []);

  const handleAlign = (alignMode: AlignMode) => {
    canvasRef.current?.alignSelected(alignMode);
  };

  const handleExport = async () => {
    const stage = canvasRef.current?.getStage();
    const displayWidth = canvasRef.current?.getDisplayWidth();

    if (!stage || !displayWidth) {
      showToast('error', 'Ops, não conseguimos capturar a folha 🙈');
      return;
    }

    // Guarda a visibilidade das guias para restaurar depois
    const guidesWereVisible = useEditor.getState().layoutGuides.visible;

    try {
      setIsExporting(true);
      // Desmarca qualquer elemento ativo para que o Transformer não apareça no PNG
      select(null);
      // Fecha a edição in-place (as camadas de texto se escondem ao editar)
      useEditor.getState().setEditing(null);
      // Esconde as guias de layout para que não vazem para o PNG
      useEditor.getState().setGuidesVisible(false);

      // Aguarda um frame para que Transformer, editor e guias saiam da renderização
      await new Promise((res) => setTimeout(res, 50));

      const currentDoc = useEditor.getState().doc;
      const carousel = useCarousel.getState();
      const activeFormat = carousel.mode === 'carousel' ? carousel.format : currentDoc.format;
      const { width: postWidth, height: postHeight } = getPostDimensions(activeFormat);

      await exportPost({
        stage,
        stageDisplayWidth: displayWidth,
        postWidth,
        postHeight,
      });

      showToast(
        'success',
        carousel.mode === 'carousel'
          ? `Slide ${carousel.activeSlideIndex + 1} salvo com sucesso! 🌽`
          : 'Post salvo com sucesso! 🌽 Prontinho pro feed do Insta!',
      );
    } catch (err) {
      console.error(err);
      showToast('error', 'Houve um probleminha ao exportar o post 🙈');
    } finally {
      if (guidesWereVisible) useEditor.getState().setGuidesVisible(true);
      setIsExporting(false);
    }
  };

  const handleExportCarousel = async () => {
    const stage = canvasRef.current?.getStage();
    const displayWidth = canvasRef.current?.getDisplayWidth();
    if (!stage || !displayWidth) {
      showToast('error', 'Ops, não conseguimos capturar a folha 🙈');
      return;
    }

    const { slides, format, activeSlideIndex: originalActiveIndex } = useCarousel.getState();
    const guidesWereVisible = useEditor.getState().layoutGuides.visible;

    try {
      useCarousel.getState().setExporting({ current: 0, total: slides.length });
      useEditor.getState().select(null);
      useEditor.getState().setEditing(null);
      useEditor.getState().setGuidesVisible(false);

      await exportCarousel({
        slides,
        format,
        stage,
        stageDisplayWidth: displayWidth,
        onProgress: (current, total) =>
          useCarousel.getState().setExporting({ current, total }),
      });

      useEditor.getState().showToast('success', 'Carrossel exportado! 🌽 Prontinho pro Insta!');
    } catch (err) {
      console.error(err);
      const slideNum = err instanceof CarouselExportError ? ` ${err.slideNumber}` : '';
      useEditor
        .getState()
        .showToast('error', `Erro ao exportar o slide${slideNum} do carrossel 😵 Tente novamente.`);
    } finally {
      useCarousel.getState().setExporting(null);
      if (guidesWereVisible) useEditor.getState().setGuidesVisible(true);
      // Recarrega o slide que estava ativo antes da exportação
      useCarousel.getState().setActiveSlide(originalActiveIndex);
    }
  };

  return (
    <div className={styles.app}>
      <Header
        isExportingSingle={isExporting}
        onExportSingle={handleExport}
        onExportCarousel={handleExportCarousel}
      />
      <Stepper />

      <main className={styles.main}>
        {/* Painel Lateral com os passos */}
        <section aria-label="Painel de ferramentas" className={styles.sidebar}>
          <div className={styles.stepContent}>
            {step === 0 && <BackgroundStep />}
            {step === 1 && <DecorationStep />}
            {step === 2 && <ImageStep />}
            {step === 3 && <TextStep />}
            {step === 4 && <LogoStep />}
            {step === 5 && <TextureStep />}
          </div>
          <StepFooter />
        </section>

        {/* Coluna da Folha de Criação + Tira de Miniaturas (em Modo Carrossel) */}
        <div className={styles.workspaceColumn}>
          <section aria-label="Folha de criação" className={styles.canvasArea}>
            {mode === 'carousel' && (
              <span
                className={styles.slideBadge}
                data-testid="slide-badge"
                role="status"
                aria-live="polite"
              >
                Slide {activeSlideIndex + 1} de {slidesCount}
              </span>
            )}
            <EditorCanvas ref={canvasRef} />
            {/* Dock lateral: ações do elemento + guias + histórico (undo/redo) */}
            <aside aria-label="Ferramentas da folha" className={styles.dock}>
              <ZoomControls />
              <BackgroundMirrorToolbar />
              <AlignToolbar onAlignToPage={handleAlign} />
              <GuideToolbar />
              <div className={styles.dockHistory} role="group" aria-label="Histórico de ações">
                <IconButton
                  icon={<Undo2 size={18} strokeWidth={2.5} />}
                  label="Desfazer (Ctrl+Z)"
                  size="sm"
                  onClick={() => undo()}
                />
                <IconButton
                  icon={<Redo2 size={18} strokeWidth={2.5} />}
                  label="Refazer (Ctrl+Shift+Z)"
                  size="sm"
                  onClick={() => redo()}
                />
              </div>
            </aside>
          </section>

          {mode === 'carousel' && <SlideTray />}
        </div>
      </main>
    </div>
  );
};
