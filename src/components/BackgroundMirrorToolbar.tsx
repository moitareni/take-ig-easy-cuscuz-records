import React from 'react';
import { FlipHorizontal, FlipVertical } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { IconButton } from './ui/IconButton';
import styles from './AlignToolbar.module.css';

export const BackgroundMirrorToolbar: React.FC = () => {
  const step = useEditor((s) => s.step);
  const backgroundId = useEditor((s) => s.doc.backgroundId);
  const selectedIds = useEditor((s) => s.selectedIds);
  const backgroundFlipX = useEditor((s) => Boolean(s.doc.backgroundFlipX));
  const backgroundFlipY = useEditor((s) => Boolean(s.doc.backgroundFlipY));
  const toggleBackgroundFlipX = useEditor((s) => s.toggleBackgroundFlipX);
  const toggleBackgroundFlipY = useEditor((s) => s.toggleBackgroundFlipY);

  if (step !== 0 || !backgroundId || selectedIds.length > 0) return null;

  return (
    <aside aria-label="Ações do fundo" className={styles.toolbar}>
      <div className={styles.group}>
        <IconButton
          icon={<FlipHorizontal size={17} strokeWidth={2.5} />}
          label="Espelhar fundo ↔"
          size="sm"
          active={backgroundFlipX}
          onClick={toggleBackgroundFlipX}
        />
        <IconButton
          icon={<FlipVertical size={17} strokeWidth={2.5} />}
          label="Espelhar fundo ↕"
          size="sm"
          active={backgroundFlipY}
          onClick={toggleBackgroundFlipY}
        />
      </div>
    </aside>
  );
};
