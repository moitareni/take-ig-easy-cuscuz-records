import React from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { EditorScreen } from './screens/EditorScreen';
import { Toast } from './components/Toast';
import { FirefoxRoundScrollbar } from './components/ui/FirefoxRoundScrollbar';
import { useDraftsStore } from './store/draftsStore';

/**
 * A home "Meus rascunhos" é sempre a primeira tela; o editor só existe com um
 * rascunho ativo. O Toast fica no shell para servir às duas telas.
 */
export const App: React.FC = () => {
  const screen = useDraftsStore((s) => s.screen);

  return (
    <>
      {screen === 'boot' && <div aria-hidden="true" style={{ height: '100vh' }} />}
      {screen === 'home' && <HomeScreen />}
      {screen === 'editor' && <EditorScreen />}
      <FirefoxRoundScrollbar />
      <Toast />
    </>
  );
};
