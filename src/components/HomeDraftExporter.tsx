import React, { useEffect, useRef } from 'react';
import { getPostDimensions } from '../brand/brand';
import { EditorCanvas, type EditorCanvasHandle } from '../canvas/EditorCanvas';
import { readDraftRecord } from '../lib/drafts/repository';
import { prepareDraftForHomeExport } from '../lib/drafts/session';
import { exportPost } from '../lib/export';
import { CarouselExportError, exportCarousel } from '../lib/exportCarousel';
import { useCarousel } from '../store/carouselStore';
import { useEditor } from '../store/editorStore';

export interface HomeDraftExporterProps {
  draftId: string;
  onDone: () => void;
}

/**
 * Monta um EditorCanvas invisível fora da tela apenas durante a exportação
 * direta de um card na home ("Meus rascunhos"), gerando PNG (post único) ou
 * ZIP (carrossel) com 100% de fidelidade de fontes, texturas, imagens e crossovers.
 */
export const HomeDraftExporter: React.FC<HomeDraftExporterProps> = ({ draftId, onDone }) => {
  const canvasRef = useRef<EditorCanvasHandle>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const guidesWereVisible = useEditor.getState().layoutGuides.visible;
      try {
        const record = await readDraftRecord(draftId);
        if (!record) {
          useEditor.getState().showToast('error', 'Não encontramos esse rascunho para exportar.');
          return;
        }

        const body = await prepareDraftForHomeExport(record.body);
        if (cancelled) return;

        useEditor.getState().select(null);
        useEditor.getState().setEditing(null);
        useEditor.getState().setGuidesVisible(false);

        // Aguarda a montagem do Stage Konva e carregamento dos assets/texturas nas camadas
        let stage = canvasRef.current?.getStage() ?? null;
        let displayWidth = canvasRef.current?.getDisplayWidth() ?? 0;
        for (let attempt = 0; attempt < 20 && (!stage || !displayWidth); attempt++) {
          await new Promise((res) => setTimeout(res, 50));
          stage = canvasRef.current?.getStage() ?? null;
          displayWidth = canvasRef.current?.getDisplayWidth() ?? 0;
        }

        if (!stage || !displayWidth || cancelled) {
          throw new Error('Stage indisponível');
        }

        // Aguarda um ciclo extra para que imagens de fundo/enfeites/texturas WebP decodifiquem no Konva
        await new Promise((res) => setTimeout(res, 160));
        if (cancelled) return;

        if (body.kind === 'carousel') {
          const { slides, format } = useCarousel.getState();
          await exportCarousel({
            slides,
            format,
            stage,
            stageDisplayWidth: displayWidth,
            onProgress: () => undefined,
          });
          useEditor.getState().showToast('success', 'Carrossel exportado! 🌽 Prontinho pro Insta!');
        } else {
          const currentDoc = useEditor.getState().doc;
          const { width: postWidth, height: postHeight } = getPostDimensions(currentDoc.format);
          await exportPost({
            stage,
            stageDisplayWidth: displayWidth,
            postWidth,
            postHeight,
          });
          useEditor
            .getState()
            .showToast('success', 'Post salvo com sucesso! 🌽 Prontinho pro feed do Insta!');
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          const slideNum = err instanceof CarouselExportError ? ` ${err.slideNumber}` : '';
          useEditor
            .getState()
            .showToast(
              'error',
              slideNum
                ? `Erro ao exportar o slide${slideNum} do carrossel 😵 Tente novamente.`
                : 'Houve um probleminha ao exportar este rascunho 🙈',
            );
        }
      } finally {
        if (guidesWereVisible) useEditor.getState().setGuidesVisible(true);
        useCarousel.setState({ mode: null });
        if (!cancelled) onDone();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draftId, onDone]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: '-9999px',
        top: 0,
        width: '720px',
        height: '960px',
        pointerEvents: 'none',
        opacity: 0,
        overflow: 'hidden',
      }}
    >
      <EditorCanvas ref={canvasRef} />
    </div>
  );
};
