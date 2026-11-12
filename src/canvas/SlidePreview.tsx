import React from 'react';
import { Group, Layer, Stage } from 'react-konva';
import { getPostDimensions, type PostFormat } from '../brand/brand';
import { canElementBleedToSide, isCrossoverCopy } from '../lib/crossover';
import type { Doc, FinishState, SlideData } from '../types';
import { BackgroundNode } from './BackgroundNode';
import { CrossoverMirrorNode } from './CrossoverMirrorNode';
import { DecorationNode } from './DecorationNode';
import { ImageNode } from './ImageNode';
import { LogoNode } from './LogoNode';
import { TextNode } from './TextNode';
import { TextureOverlays } from './TextureOverlays';
import styles from './SlidePreview.module.css';

export interface SlidePreviewProps {
  doc: Doc;
  finish: FinishState;
  format: PostFormat;
  /** Largura de exibição em px de tela (a altura segue o formato). */
  width: number;
  prevSlide?: SlideData | null;
  nextSlide?: SlideData | null;
}

/** Largura de renderização (supersampling para a miniatura ficar nítida). */
const RENDER_WIDTH = 240;

const noop = () => {};
const noopPatch = () => {};

const SlidePreviewImpl: React.FC<SlidePreviewProps> = ({
  doc,
  finish,
  format,
  width,
  prevSlide,
  nextSlide,
}) => {
  const { width: postW, height: postH } = getPostDimensions(format);
  const scale = RENDER_WIDTH / postW;
  const renderHeight = Math.round(postH * scale);
  const displayHeight = (width * postH) / postW;
  const cssScale = width / RENDER_WIDTH;

  // Continuações visuais de crossovers dos vizinhos (mesma regra do
  // EditorCanvas), recortadas pela folha.
  const prevMirrors =
    prevSlide?.doc.elements.filter(
      (el) =>
        !isCrossoverCopy(el) &&
        canElementBleedToSide(el, 'right', postW) &&
        !doc.elements.some((cur) => cur.id === el.id),
    ) ?? [];
  const nextMirrors =
    nextSlide?.doc.elements.filter(
      (el) =>
        !isCrossoverCopy(el) &&
        canElementBleedToSide(el, 'left', postW) &&
        !doc.elements.some((cur) => cur.id === el.id),
    ) ?? [];

  return (
    <div
      className={styles.preview}
      style={{ width: `${width}px`, height: `${displayHeight}px` }}
      data-slide-preview=""
      data-slide-elements={doc.elements.length}
      aria-hidden="true"
    >
      <div
        className={styles.previewInner}
        style={{
          width: `${RENDER_WIDTH}px`,
          height: `${renderHeight}px`,
          transform: `scale(${cssScale})`,
        }}
      >
        <Stage width={RENDER_WIDTH} height={renderHeight} listening={false}>
          <Layer listening={false}>
            <Group
              clipX={0}
              clipY={0}
              clipWidth={postW}
              clipHeight={postH}
              scaleX={scale}
              scaleY={scale}
              listening={false}
            >
              <BackgroundNode
                backgroundId={doc.backgroundId}
                flipX={doc.backgroundFlipX}
                flipY={doc.backgroundFlipY}
                format={format}
                offsetY={doc.backgroundOffsetY ?? 180}
                isInteractive={false}
              />

              {doc.elements.map((el) => {
                if (el.kind === 'decoration') {
                  return (
                    <DecorationNode
                      key={el.id}
                      element={el}
                      isSelected={false}
                      onSelect={noop}
                      onChange={noopPatch}
                      onDragMoveSnap={noop}
                      onDragEndSnap={noop}
                    />
                  );
                }
                if (el.kind === 'text') {
                  return (
                    <TextNode
                      key={el.id}
                      element={el}
                      isSelected={false}
                      isEditing={false}
                      onSelect={noop}
                      onDoubleClick={noop}
                      onChange={noopPatch}
                      onApplyTextSize={() => el.fontSize}
                      onDragMoveSnap={noop}
                      onDragEndSnap={noop}
                    />
                  );
                }
                if (el.kind === 'image') {
                  return (
                    <ImageNode
                      key={el.id}
                      element={el}
                      isSelected={false}
                      onSelect={noop}
                      onChange={noopPatch}
                      onDragMoveSnap={noop}
                      onDragEndSnap={noop}
                    />
                  );
                }
                return (
                  <LogoNode
                    key={el.id}
                    element={el}
                    isSelected={false}
                    onSelect={noop}
                    onChange={noopPatch}
                    onDragMoveSnap={noop}
                    onDragEndSnap={noop}
                  />
                );
              })}

              {prevMirrors.map((el) => (
                <CrossoverMirrorNode
                  key={`mirror-prev-${el.id}`}
                  element={el}
                  offsetX={-postW}
                  listening={false}
                />
              ))}
              {nextMirrors.map((el) => (
                <CrossoverMirrorNode
                  key={`mirror-next-${el.id}`}
                  element={el}
                  offsetX={postW}
                  listening={false}
                />
              ))}

              <TextureOverlays
                finish={finish}
                format={format}
                postWidth={postW}
                postHeight={postH}
              />
            </Group>
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

/**
 * Miniatura viva e somente-leitura de um slide, renderizada a partir do `doc`
 * (mesmos componentes do canvas principal). Não depende de captura, cache de
 * sessão nem de o slide ter sido aberto — resolve a tira mostrando só o fundo
 * ao abrir um rascunho.
 *
 * `React.memo` é essencial: enquanto a usuária edita o slide ativo, os outros
 * slides mantêm as mesmas referências e não redesenham.
 */
export const SlidePreview = React.memo(SlidePreviewImpl);
