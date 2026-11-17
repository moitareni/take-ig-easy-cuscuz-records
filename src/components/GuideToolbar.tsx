import React from 'react';
import { Crosshair, Frame, LayoutGrid, Ruler } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { IconButton } from './ui/IconButton';
import { ToolGroupTitle, ToolSubgroupTitle } from './ui/ToolGroupTitle';
import styles from './GuideToolbar.module.css';

/**
 * Controles das guias de layout (margens/centro/terços).
 * Sempre visível na área do canvas; atalho G alterna a visibilidade.
 * A antiga grade de presets "Margem (px)" foi removida: a margem fica no padrão
 * do store (`layoutGuides.margin`) e continua alimentando os presets da logo.
 */
export const GuideToolbar: React.FC = () => {
  const layoutGuides = useEditor((s) => s.layoutGuides);
  const toggleGuidesVisible = useEditor((s) => s.toggleGuidesVisible);
  const setGuideLayer = useEditor((s) => s.setGuideLayer);

  return (
    <aside aria-label="Guias de layout" className={styles.toolbar}>
      <ToolGroupTitle label="Guias" />
      <IconButton
        icon={<Ruler size={17} strokeWidth={2.5} />}
        label={layoutGuides.visible ? 'Esconder guias de layout (G)' : 'Mostrar guias de layout (G)'}
        size="sm"
        active={layoutGuides.visible}
        onClick={toggleGuidesVisible}
      />

      {layoutGuides.visible && (
        <>
          <div className={styles.divider} />
          <div className={styles.section}>
            <ToolSubgroupTitle label="Linhas de Referência" />
            <div className={styles.group}>
              <IconButton
                icon={<Frame size={17} strokeWidth={2.5} />}
                label="Guia de margens"
                size="sm"
                active={layoutGuides.showMargins}
                onClick={() => setGuideLayer({ showMargins: !layoutGuides.showMargins })}
              />
              <IconButton
                icon={<Crosshair size={17} strokeWidth={2.5} />}
                label="Guias centrais"
                size="sm"
                active={layoutGuides.showCenters}
                onClick={() => setGuideLayer({ showCenters: !layoutGuides.showCenters })}
              />
              <IconButton
                icon={<LayoutGrid size={17} strokeWidth={2.5} />}
                label="Guias de terços"
                size="sm"
                active={layoutGuides.showThirds}
                onClick={() => setGuideLayer({ showThirds: !layoutGuides.showThirds })}
              />
            </div>
          </div>
        </>
      )}
    </aside>
  );
};
