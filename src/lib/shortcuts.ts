import { useEffect } from 'react';
import { getPostDimensions } from '../brand/brand';
import { zoomStepIn, zoomStepOut } from './zoom';
import { redo, undo, useEditor } from '../store/editorStore';
import {
  buildTransformPatches,
  groupLimitMessage,
  groupScaleBounds,
  shiftPatches,
} from './multiSelect';

const INTERACTIVE_TARGET_SELECTOR =
  'button, a, select, summary, [role="button"], [role="menuitem"], [role="option"]';

/**
 * Hook para atalhos de teclado globais do editor:
 * - Ctrl+Z / Ctrl+Shift+Z / Cmd+Z / Cmd+Shift+Z (Desfazer / Refazer)
 * - Delete / Backspace (Excluir elemento(s) selecionado(s) se não estiver digitando em input)
 * - Ctrl+D / Cmd+D (Duplicar elemento(s) selecionado(s))
 * - Enter / F2 (Entrar em edição quando 1 texto está selecionado)
 * - Setas direcionais (Mover 1px, ou 10px com Shift; a seleção múltipla anda junta)
 * - [ / ] (Rotacionar −5° / +5°, ou ±1° com Shift)
 * - + / = e - / _ sem modificador Ctrl/Cmd (Escalar ±5%, ou ±1% com Shift)
 * - Escape (Desmarcar seleção)
 * - G (Mostrar/esconder guias de layout)
 * - Ctrl+= / Ctrl+- / Ctrl+0 (Zoom + / Zoom − / Ajustar à tela)
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se o usuário estiver digitando em um input, textarea ou contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      const {
        selectedIds,
        removeElements,
        duplicateElement,
        duplicateElements,
        applyPatches,
        setEditing,
        showToast,
        doc,
        select,
        toggleGuidesVisible,
      } = useEditor.getState();

      // Undo / Redo
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Escape -> Desselecionar
      if (e.key === 'Escape') {
        select(null);
        return;
      }

      // G -> Mostrar/esconder guias de layout (funciona sem seleção)
      if (!mod && !e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        toggleGuidesVisible();
        return;
      }

      // Zoom -> Ctrl+= amplia, Ctrl+- reduz, Ctrl+0 ajusta à tela
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const { zoom, fitWidth, setZoom, doc } = useEditor.getState();
        const { width: postW } = getPostDimensions(doc.format);
        setZoom(zoomStepIn((fitWidth * zoom) / postW) / (fitWidth / postW));
        return;
      }
      if (mod && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        const { zoom, fitWidth, setZoom, doc } = useEditor.getState();
        const { width: postW } = getPostDimensions(doc.format);
        setZoom(zoomStepOut((fitWidth * zoom) / postW) / (fitWidth / postW));
        return;
      }
      if (mod && e.key === '0') {
        e.preventDefault();
        useEditor.getState().setZoom(1);
        return;
      }

      // Se nenhum elemento estiver selecionado, os demais atalhos não operam
      if (selectedIds.length === 0) return;

      const picked = doc.elements.filter((el) => selectedIds.includes(el.id));
      if (picked.length === 0) return;

      // F2 ou Enter fora de controles interativos -> editar texto selecionado
      if (!mod && !e.altKey && picked.length === 1 && picked[0].kind === 'text') {
        if (e.key === 'F2') {
          e.preventDefault();
          setEditing(picked[0].id);
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey && !target?.closest(INTERACTIVE_TARGET_SELECTOR)) {
          e.preventDefault();
          setEditing(picked[0].id);
          return;
        }
      }

      // Duplicate: Ctrl+D
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedIds.length === 1) duplicateElement(selectedIds[0]);
        else duplicateElements(selectedIds);
        return;
      }

      // Delete / Backspace: Excluir
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeElements(selectedIds);
        return;
      }

      // [ / ]: Rotacionar −5° / +5° (±1° com Shift)
      if (!mod && !e.altKey && (e.key === '[' || e.key === '{' || e.key === ']' || e.key === '}')) {
        e.preventDefault();
        const deg = e.shiftKey ? 1 : 5;
        const delta = e.key === '[' || e.key === '{' ? -deg : deg;
        const results = picked.map((el) => ({
          id: el.id,
          x: el.x,
          y: el.y,
          rotation: el.rotation + delta,
          scaleX: el.kind === 'text' ? 1 : el.scale,
        }));
        applyPatches(buildTransformPatches(doc.elements, results));
        return;
      }

      // + / = e - / _: Escalar ±5% (±1% com Shift), respeitando Texto ≤ Título
      if (!mod && !e.altKey && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_')) {
        e.preventDefault();
        const step = e.shiftKey ? 0.01 : 0.05;
        const factor = e.key === '+' || e.key === '=' ? 1 + step : 1 - step;
        const bounds = groupScaleBounds(doc.elements, selectedIds);
        const clampedFactor = Math.min(bounds.max, Math.max(bounds.min, factor));

        if (factor > bounds.max && bounds.maxReason) {
          const msg = groupLimitMessage(bounds.maxReason, 'max', bounds.maxCap);
          if (msg) showToast('error', msg);
        } else if (factor < bounds.min && bounds.minReason) {
          const msg = groupLimitMessage(bounds.minReason, 'min', bounds.maxCap);
          if (msg) showToast('error', msg);
        }

        if (clampedFactor === 1) return;
        const results = picked.map((el) => ({
          id: el.id,
          x: el.x,
          y: el.y,
          rotation: el.rotation,
          scaleX: el.kind === 'text' ? clampedFactor : Math.max(0.05, el.scale * clampedFactor),
        }));
        applyPatches(buildTransformPatches(doc.elements, results));
        return;
      }

      // Arrow keys: Mover
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;

        applyPatches(shiftPatches(doc.elements, selectedIds, dx, dy));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
