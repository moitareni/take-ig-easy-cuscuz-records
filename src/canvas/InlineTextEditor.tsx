import React, { useEffect, useRef } from 'react';
import type { SelectionTheme } from '../lib/selectionContrast';
import { editorTextStyle } from '../lib/textEditorStyle';
import { resizeTextBoxWidth, screenDeltaToLocal, type TextBoxHandle } from '../lib/textBox';
import type { TextLayout } from '../lib/textLayout';
import { useEditor } from '../store/editorStore';
import type { TextEl } from '../types';
import styles from './InlineTextEditor.module.css';

export interface InlineTextEditorProps {
  element: TextEl;
  /** Medida síncrona da área de texto (px do post). */
  layout: TextLayout;
  scaleRatio: number; // escala entre o canvas real e o display na tela
  /** Cor do realce de texto, adaptada ao fundo da arte. */
  selectionTheme: SelectionTheme;
  /** Origem da folha (px de tela). Null enquanto o palco não está pronto. */
  stageRect: { left: number; top: number } | null;
  onClose: () => void;
}

/**
 * Só as alças laterais. A altura da área é automática (conteúdo + largura),
 * então não existe alça vertical/diagonal — o que também impede a caixa de
 * edição de "descolar" da caixa real do texto.
 */
const HANDLES: { id: TextBoxHandle; className: string; label: string }[] = [
  { id: 'w', className: styles.handleW, label: 'Redimensionar área: esquerda' },
  { id: 'e', className: styles.handleE, label: 'Redimensionar área: direita' },
];

interface DragStart {
  pointerId: number;
  handle: TextBoxHandle;
  clientX: number;
  clientY: number;
  width: number;
  x: number;
  y: number;
  rotation: number;
}

/**
 * Edição de texto in-place estilo Photoshop: overlay transparente
 * posicionado exatamente sobre o texto original, com a mesma tipografia
 * (as camadas de texto do Konva se escondem durante a edição).
 * Enter quebra linha, Escape/blur/clique fora confirma.
 *
 * As alças verdes redimensionam a LARGURA da área de texto (forçando quebras
 * de linha), nunca a fonte nem a altura — a altura é sempre automática. Com
 * área automática (criação), o primeiro arraste congela a largura atual antes
 * de aplicar o delta.
 */
export const InlineTextEditor: React.FC<InlineTextEditorProps> = ({
  element,
  layout,
  scaleRatio,
  selectionTheme,
  stageRect,
  onClose,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<DragStart | null>(null);
  const updateElement = useEditor((s) => s.updateElement);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  // Altura acompanha o conteúdo (a largura vem da área medida/definida)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [element.text, element.fontSize, element.lineHeight, layout.wrapWidth, layout.contentWidth, scaleRatio]);

  if (!stageRect) return null;

  const screenX = stageRect.left + element.x * scaleRatio;
  const screenY = stageRect.top + element.y * scaleRatio;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateElement(element.id, { text: e.target.value });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  const beginResize = (handle: TextBoxHandle) => (e: React.PointerEvent<HTMLDivElement>) => {
    // Não deixa o clique/foco sair do textarea (senão o blur fecha o editor).
    e.preventDefault();
    e.stopPropagation();

    const current = useEditor.getState().doc.elements.find((el) => el.id === element.id);
    if (!current || current.kind !== 'text') return;

    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      handle,
      clientX: e.clientX,
      clientY: e.clientY,
      width: current.boxWidth ?? layout.contentWidth,
      x: current.x,
      y: current.y,
      rotation: current.rotation,
    };
  };

  const moveResize = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();

    const local = screenDeltaToLocal(
      e.clientX - start.clientX,
      e.clientY - start.clientY,
      start.rotation,
      scaleRatio,
    );
    const patch = resizeTextBoxWidth(
      { width: start.width, x: start.x, y: start.y, rotation: start.rotation },
      start.handle,
      local.dx,
      Math.max(16, element.fontSize * 0.5),
    );
    updateElement(element.id, patch as Partial<TextEl>);
  };

  const endResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };

  // O destaque de seleção do <textarea> herda estas variáveis (global.css):
  // amarelo sobre fundo claro sumiria, então a cor vem do ambiente da arte.
  const boxStyle: React.CSSProperties & { '--selection-bg': string; '--selection-fg': string } = {
    left: `${screenX}px`,
    top: `${screenY}px`,
    width: `${Math.max(1, layout.outerWidth * scaleRatio)}px`,
    minHeight: `${Math.max(1, layout.outerHeight * scaleRatio)}px`,
    transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
    '--selection-bg': selectionTheme.accent,
    '--selection-fg': selectionTheme.onAccent,
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.editorBox} style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <textarea
          ref={textareaRef}
          value={element.text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onClose}
          rows={1}
          wrap={layout.wrapWidth !== null ? 'soft' : 'off'}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="Editar texto"
          style={{
            ...editorTextStyle(element, { scaleRatio, padX: layout.padX, padY: layout.padY }),
            whiteSpace: layout.wrapWidth !== null ? 'pre-wrap' : 'pre',
            overflowWrap: 'break-word',
          }}
          className={styles.textarea}
        />

        {HANDLES.map((handle) => (
          <div
            key={handle.id}
            role="button"
            tabIndex={-1}
            aria-label={handle.label}
            title={handle.label}
            data-handle={handle.id}
            className={`${styles.handle} ${handle.className}`}
            onPointerDown={beginResize(handle.id)}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onClick={(e) => e.stopPropagation()}
          />
        ))}
      </div>
    </div>
  );
};
