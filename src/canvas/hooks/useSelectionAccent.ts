import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import { unionBox } from '../../lib/multiSelect';
import {
  DEFAULT_SELECTION_ACCENT,
  SELECTION_THEMES,
  pickSelectionAccent,
  sampleSelectionColors,
  type SelectionAccent,
  type SelectionTheme,
} from '../../lib/selectionContrast';

/** Folga do anel de amostras (px de tela) em volta da caixa do elemento. */
const SAMPLE_RING = 14;

/**
 * Cor da caixa de seleção conforme o fundo do post (ver
 * `lib/selectionContrast.ts`): lê o anel em volta do elemento no canvas já
 * renderizado e devolve amarelo ou preto, com o par de contraste das alças.
 *
 * `revision` é só um gatilho de remedição (fundo, posições, slide, imagens
 * carregadas) — mudanças no meio de um arraste não chegam ao doc, então a
 * cor não pisca enquanto a usuária move o elemento.
 */
export function useSelectionAccent(
  stageRef: RefObject<Konva.Stage | null>,
  layerRef: RefObject<Konva.Layer | null>,
  targetIds: readonly string[],
  revision: string,
): SelectionTheme {
  const [accent, setAccent] = useState<SelectionAccent>(DEFAULT_SELECTION_ACCENT);
  const targets = targetIds.join('|');

  useEffect(() => {
    if (!targets) {
      setAccent(DEFAULT_SELECTION_ACCENT);
      return;
    }

    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;

    const measure = () => {
      const stage = stageRef.current;
      const layer = layerRef.current;
      if (cancelled || !stage || !layer) return;

      const nodes = targets
        .split('|')
        .map((id) => stage.findOne(`#${id}`))
        .filter((node): node is Konva.Node => !!node);
      const box = unionBox(nodes.map((node) => node.getClientRect({ relativeTo: layer })));
      if (!box) return;

      // Coordenadas da camada -> pixels do canvas (escala do palco × pixelRatio)
      const matrix = layer.getAbsoluteTransform();
      const topLeft = matrix.point({ x: box.x, y: box.y });
      const bottomRight = matrix.point({ x: box.x + box.width, y: box.y + box.height });
      const ratio = layer.getCanvas().getPixelRatio();

      const samples = sampleSelectionColors(
        layer.getNativeCanvasElement(),
        {
          x: topLeft.x * ratio,
          y: topLeft.y * ratio,
          width: (bottomRight.x - topLeft.x) * ratio,
          height: (bottomRight.y - topLeft.y) * ratio,
        },
        { offset: SAMPLE_RING * ratio },
      );

      setAccent(pickSelectionAccent(samples));
    };

    // Konva desenha em requestAnimationFrame: lê o canvas depois de dois
    // frames, senão a amostra é do desenho anterior.
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(measure);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [targets, revision, stageRef, layerRef]);

  return SELECTION_THEMES[accent];
}
