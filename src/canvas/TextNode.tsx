import React, { useMemo } from 'react';
import { Group, Image as KonvaImage, Rect, Text as KonvaText } from 'react-konva';
import type Konva from 'konva';
import { manifest } from '../assets';
import { BORDERS, BRAND_EFFECT, COLORS } from '../brand/brand';
import { measureTextLayout } from '../lib/textLayout';
import { useFontsReady } from '../lib/useFontsReady';
import { useImage } from '../lib/useImage';
import type { TextEl } from '../types';

export interface TextNodeProps {
  element: TextEl;
  isSelected: boolean;
  /** Quando true, esconde as camadas de texto (o overlay in-place assume). */
  isEditing?: boolean;
  /** Recebe o evento do Konva: Ctrl/Cmd/Shift soma/remove da seleção. */
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDoubleClick: (e?: Konva.KonvaEventObject<unknown>) => void;
  onChange: (patch: Partial<TextEl>) => void;
  onApplyTextSize: (requested: number) => number;
  onDragMoveSnap: (node: Konva.Node) => void;
  onDragEndSnap: () => void;
}

export const TextNode: React.FC<TextNodeProps> = ({
  element,
  isEditing = false,
  onSelect,
  onDoubleClick,
  onChange,
  onApplyTextSize,
  onDragMoveSnap,
  onDragEndSnap,
}) => {
  const groupRef = React.useRef<Konva.Group>(null);
  const [texture] = useImage(element.border !== 'none' ? manifest.borderTexture.src : null);
  const fontsReady = useFontsReady();

  // Medida síncrona no render (mesma engine do desenho): a caixa de destaque
  // e o offset do grupo nascem corretos, sem depender de seleção ou efeito.
  const layout = useMemo(
    () => measureTextLayout(element),
    [
      fontsReady,
      element.text,
      element.uppercase,
      element.style,
      element.fontSize,
      element.lineHeight,
      element.letterSpacing,
      element.align,
      element.border,
      element.boxWidth,
    ],
  );

  const textColor = COLORS[element.color as keyof typeof COLORS] ?? COLORS.preto;
  const hasBorder = element.border !== 'none';
  const borderConfig = hasBorder ? BORDERS[element.border as keyof typeof BORDERS] : null;
  const wrapped = layout.wrapWidth !== null;

  const textProps = {
    text: layout.displayText,
    x: layout.padX,
    y: layout.padY,
    fontFamily: layout.fontFamily,
    fontStyle: layout.fontStyle,
    fontSize: element.fontSize,
    lineHeight: element.lineHeight,
    letterSpacing: element.letterSpacing,
    align: element.align,
    ...(wrapped ? { width: layout.wrapWidth ?? undefined, wrap: 'word' } : {}),
  };

  return (
    <Group
      ref={groupRef}
      id={element.id}
      x={element.x}
      y={element.y}
      rotation={element.rotation}
      offsetX={layout.outerWidth / 2}
      offsetY={layout.outerHeight / 2}
      scaleX={1}
      scaleY={1}
      draggable={!isEditing}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onDragMove={(e) => {
        onDragMoveSnap(e.target);
      }}
      onDragEnd={(e) => {
        onDragEndSnap();
        onChange({
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onTransformEnd={() => {
        const node = groupRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        const requestedSize = Math.round(element.fontSize * Math.abs(scaleX));

        // Reseta a escala do nó para 1 e atualiza via regra de tamanho de texto.
        // A área definida é escalada proporcionalmente dentro de setTextSize.
        node.scaleX(1);
        node.scaleY(1);

        const appliedSize = onApplyTextSize(requestedSize);

        onChange({
          x: node.x(),
          y: node.y(),
          rotation: Math.round(node.rotation()),
          fontSize: appliedSize,
        });
      }}
    >
      {/* 1. Caixa de destaque com textura em modo 'soft-light' */}
      {hasBorder && borderConfig && (
        <Group
          clipFunc={(ctx) => {
            ctx.rect(0, 0, layout.outerWidth, layout.outerHeight);
          }}
        >
          <Rect
            x={0}
            y={0}
            width={layout.outerWidth}
            height={layout.outerHeight}
            fill={borderConfig.color}
          />
          {texture && (
            <KonvaImage
              image={texture}
              x={0}
              y={0}
              width={layout.outerWidth}
              height={layout.outerHeight}
              globalCompositeOperation="soft-light"
              opacity={borderConfig.textureOpacity}
              listening={false}
            />
          )}
        </Group>
      )}

      {/* 2. Traçado externo e sombra projetada da identidade (Photoshop) */}
      {element.brandEffect && (
        <KonvaText
          {...textProps}
          fill={BRAND_EFFECT.strokeColor}
          stroke={BRAND_EFFECT.strokeColor}
          strokeWidth={BRAND_EFFECT.strokeOutside * 2} // 4px stroke -> 2px visíveis externamente
          shadowColor={BRAND_EFFECT.shadowColor}
          shadowOpacity={BRAND_EFFECT.shadowOpacity}
          shadowOffsetY={BRAND_EFFECT.shadowDistance}
          shadowOffsetX={0}
          shadowBlur={BRAND_EFFECT.shadowBlur}
          listening={false}
          visible={!isEditing}
        />
      )}

      {/* 3. Texto principal preenchido (desenhado no topo para traçado 100% externo) */}
      <KonvaText {...textProps} fill={textColor} visible={!isEditing} />
    </Group>
  );
};
