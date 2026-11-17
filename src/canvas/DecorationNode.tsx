import React, { useRef } from 'react';
import { Group as KonvaGroup, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import { canvasBlendOf, getDecoration } from '../assets';
import { useImage } from '../lib/useImage';
import type { DecorationEl } from '../types';

export interface DecorationNodeProps {
  element: DecorationEl;
  isSelected: boolean;
  /** Recebe o id e o evento do Konva: Ctrl/Cmd/Shift soma/remove da seleção. */
  onSelect: (id: string, e: Konva.KonvaEventObject<Event>) => void;
  onChange: (id: string, patch: Partial<DecorationEl>) => void;
  onDragMoveSnap: (node: Konva.Node) => void;
  onDragEndSnap: () => void;
}

/**
 * Enfeite no canvas.
 *
 * O nó que recebe o Transformer é um `Group` SEMPRE com escala positiva. O
 * espelhamento (flipX/flipY) vive apenas na `Image` interna (escala ±1 fixa,
 * vinda do store). Isso é essencial: quando a escala negativa fica no próprio
 * nó anexado ao Transformer, o `Transform.decompose()` do Konva — chamado a
 * cada transformação — normaliza a matriz e converte o espelhamento em
 * rotação 180° + scaleY negativo. O resultado era a âncora de rotação pulando
 * para baixo e os botões de espelhar trocando de estado sozinhos.
 */
const DecorationNodeImpl: React.FC<DecorationNodeProps> = ({
  element,
  onSelect,
  onChange,
  onDragMoveSnap,
  onDragEndSnap,
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const asset = getDecoration(element.assetId);
  const [image] = useImage(asset?.src);

  if (!asset || !image) return null;

  const width = asset.width;
  const height = asset.height;
  const blendOp = canvasBlendOf(asset.blend);

  return (
    <KonvaGroup
      ref={groupRef}
      id={element.id}
      x={element.x}
      y={element.y}
      rotation={element.rotation}
      scaleX={element.scale}
      scaleY={element.scale}
      draggable
      onClick={(e) => onSelect(element.id, e)}
      onTap={(e) => onSelect(element.id, e)}
      onDragMove={(e) => {
        onDragMoveSnap(e.target);
      }}
      onDragEnd={(e) => {
        onDragEndSnap();
        onChange(element.id, {
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onTransformEnd={() => {
        const node = groupRef.current;
        if (!node) return;
        // A escala do Grupo é sempre positiva (boundBoxFunc bloqueia caixas
        // invertidas). O espelhamento é controlado só pelos botões do store,
        // então NÃO derivamos flipX/flipY daqui — escrever os sinais da escala
        // apagaria o flip do usuário a cada resize.
        const sx = node.scaleX();
        onChange(element.id, {
          x: node.x(),
          y: node.y(),
          rotation: Math.round(node.rotation()),
          scale: Math.abs(sx),
        });
      }}
    >
      <KonvaImage
        image={image}
        width={width}
        height={height}
        offsetX={width / 2}
        offsetY={height / 2}
        scaleX={element.flipX ? -1 : 1}
        scaleY={element.flipY ? -1 : 1}
        globalCompositeOperation={blendOp}
      />
    </KonvaGroup>
  );
};

export const DecorationNode = React.memo(DecorationNodeImpl);
