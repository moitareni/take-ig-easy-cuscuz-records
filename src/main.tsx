import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { bootDrafts, installDraftSession } from './lib/drafts/session';
import { useCarousel } from './store/carouselStore';
import { useEditor } from './store/editorStore';
import './theme/global.css';

// Subscriber de sincronização: grava alterações do Slide Ativo de volta no useCarousel.
useEditor.subscribe((s, prev) => {
  const carousel = useCarousel.getState();
  if (carousel.mode !== 'carousel') return;
  if (s.doc === prev.doc && s.finish === prev.finish) return;
  carousel.updateActiveSlide(s.doc, s.finish);
});

installDraftSession();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

void bootDrafts();
