import React, { useMemo } from 'react';
import { Group, Image as KonvaImage, Rect, Text as KonvaText } from 'react-konva';
import { canvasBlendOf, getDecoration, getLogo, manifest } from '../assets';
import { BORDERS, BRAND_EFFECT, COLORS, getBrandEffectStrokeColor } from '../brand/brand';
import { measureTextLayout } from '../lib/textLayout';
import { useFontsReady } from '../lib/useFontsReady';
import { useImage } from '../lib/useImage';
import { useUserImage } from '../lib/userImages';
import type { DecorationEl, El, ImageEl, LogoEl, TextEl } from '../types';

export interface CrossoverMirrorNodeProps {
  element: El;
  /**
   * Deslocamento horizontal em px do post:
   * - `-postWidth` quando o elemento vem do slide anterior (entra pela borda esquerda)
   * - `+postWidth` quando o elemento vem do slide seguinte (entra pela borda direita)
   */
  offsetX: number;
  listening?: boolean;
}

const ContinuationDecoration: React.FC<{ element: DecorationEl; offsetX: number }> = ({
  element,
  offsetX,
}) => {
  const asset = getDecoration(element.assetId);
  const [image] = useImage(asset?.src);
  if (!asset || !image) return null;

  const { width, height } = asset;
  const blendOp = canvasBlendOf(asset.blend);

  return (
    <Group
      x={element.x + offsetX}
      y={element.y}
      rotation={element.rotation}
      scaleX={element.scale}
      scaleY={element.scale}
      listening={false}
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
        listening={false}
      />
    </Group>
  );
};

const ContinuationLogo: React.FC<{ element: LogoEl; offsetX: number }> = ({
  element,
  offsetX,
}) => {
  const asset = getLogo(element.variant);
  const [image] = useImage(asset?.src);
  if (!asset || !image) return null;

  const { width, height } = asset;

  return (
    <KonvaImage
      image={image}
      x={element.x + offsetX}
      y={element.y}
      width={width}
      height={height}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={element.rotation}
      scaleX={element.scale}
      scaleY={element.scale}
      listening={false}
    />
  );
};

const ContinuationImage: React.FC<{ element: ImageEl; offsetX: number }> = ({
  element,
  offsetX,
}) => {
  const entry = useUserImage(element.imageId);
  const [image] = useImage(entry?.url);
  if (!entry || !image) return null;

  const { width, height } = element;

  return (
    <Group
      x={element.x + offsetX}
      y={element.y}
      rotation={element.rotation}
      scaleX={element.scale}
      scaleY={element.scale}
      data={{ userImageId: element.imageId }}
      listening={false}
    >
      <KonvaImage
        image={image}
        width={width}
        height={height}
        offsetX={width / 2}
        offsetY={height / 2}
        scaleX={element.flipX ? -1 : 1}
        scaleY={element.flipY ? -1 : 1}
        listening={false}
      />
    </Group>
  );
};

const ContinuationText: React.FC<{ element: TextEl; offsetX: number }> = ({
  element,
  offsetX,
}) => {
  const [texture] = useImage(element.border !== 'none' ? manifest.borderTexture.src : null);
  const fontsReady = useFontsReady();
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

  const hasBorder = element.border !== 'none';
  const borderConfig = hasBorder ? BORDERS[element.border as keyof typeof BORDERS] : null;
  const textColor = COLORS[element.color as keyof typeof COLORS] ?? COLORS.preto;
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
      x={element.x + offsetX}
      y={element.y}
      rotation={element.rotation}
      offsetX={layout.outerWidth / 2}
      offsetY={layout.outerHeight / 2}
      scaleX={1}
      scaleY={1}
      listening={false}
    >
      {hasBorder && borderConfig && (
        <Group
          clipFunc={(ctx) => {
            ctx.rect(0, 0, layout.outerWidth, layout.outerHeight);
          }}
          listening={false}
        >
          <Rect
            x={0}
            y={0}
            width={layout.outerWidth}
            height={layout.outerHeight}
            fill={borderConfig.color}
            listening={false}
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
      {element.brandEffect && (
        <KonvaText
          {...textProps}
          fill={getBrandEffectStrokeColor(element.brandEffectColor)}
          stroke={getBrandEffectStrokeColor(element.brandEffectColor)}
          strokeWidth={BRAND_EFFECT.strokeOutside * 2}
          shadowColor={BRAND_EFFECT.shadowColor}
          shadowOpacity={BRAND_EFFECT.shadowOpacity}
          shadowOffsetY={BRAND_EFFECT.shadowDistance}
          shadowOffsetX={0}
          shadowBlur={BRAND_EFFECT.shadowBlur}
          listening={false}
        />
      )}
      <KonvaText {...textProps} fill={textColor} listening={false} />
    </Group>
  );
};

/**
 * Continuação Visual somente leitura de um Elemento Crossover de um slide adjacente
 * (anterior com offsetX = -postWidth, ou seguinte com offsetX = +postWidth).
 * Renderizado com opacidade 100% (opacity: 1) e mesma orientação do original.
 */
const CrossoverMirrorNodeImpl: React.FC<CrossoverMirrorNodeProps> = ({
  element,
  offsetX,
}) => {
  if (element.kind === 'decoration') {
    return <ContinuationDecoration element={element} offsetX={offsetX} />;
  }
  if (element.kind === 'logo') {
    return <ContinuationLogo element={element} offsetX={offsetX} />;
  }
  if (element.kind === 'image') {
    return <ContinuationImage element={element} offsetX={offsetX} />;
  }
  if (element.kind === 'text') {
    return <ContinuationText element={element} offsetX={offsetX} />;
  }
  return null;
};

export const CrossoverMirrorNode = React.memo(CrossoverMirrorNodeImpl);
