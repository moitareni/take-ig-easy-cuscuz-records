import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { bootDrafts, installDraftSession } from './lib/drafts/session';
import { installEditorCarouselSync } from './store/syncEngine';
import './theme/global.css';

installEditorCarouselSync();
installDraftSession();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

void bootDrafts();
