import { useEffect } from 'react';
import { extractClipboardImageFiles } from './clipboardImages';
import { importImageFiles } from './imageImport';
import { useEditor } from '../store/editorStore';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Ctrl+V / Cmd+V na folha: se a área de transferência tiver uma imagem, ela
 * entra na folha ativa, fica selecionada e o painel abre na etapa de imagens.
 * Sem imagem (texto, vazio...) não faz nada. Campos de texto e diálogos abertos
 * mantêm o comportamento normal de colar.
 */
export function usePasteImage() {
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (
        isTypingTarget(e.target) ||
        isTypingTarget(document.activeElement) ||
        useEditor.getState().editingId !== null
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;

      const files = extractClipboardImageFiles(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();

      const before = new Set(useEditor.getState().doc.elements.map((el) => el.id));
      void importImageFiles(files).then((added) => {
        if (added === 0) return;
        const st = useEditor.getState();
        const fresh = st.doc.elements.filter((el) => el.kind === 'image' && !before.has(el.id));
        const last = fresh[fresh.length - 1];
        // select() seleciona a imagem recém-colada e leva o painel para a etapa 3 (Sua imagem).
        if (last) st.select(last.id);
      });
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);
}
