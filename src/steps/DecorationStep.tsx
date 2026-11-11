import React from 'react';
import { decorationsOf, getDecoration } from '../assets';
import { ElementListRow } from '../components/ui/ElementListRow';
import { HelpTip } from '../components/ui/HelpTip';
import { ThumbGrid } from '../components/ui/ThumbGrid';
import { announceCanvasActivity } from '../lib/useImage';
import { useEditor, useSelected } from '../store/editorStore';
import type { DecorationEl } from '../types';
import styles from './StepPanel.module.css';

export const DecorationStep: React.FC = () => {
  const addDecoration = useEditor((s) => s.addDecoration);
  const removeElement = useEditor((s) => s.removeElement);
  const select = useEditor((s) => s.select);
  const elements = useEditor((s) => s.doc.elements);

  const selected = useSelected();
  const selectedDeco = selected && selected.kind === 'decoration' ? (selected as DecorationEl) : null;

  const currentDecorations = elements.filter((e): e is DecorationEl => e.kind === 'decoration');
  const enfeites = decorationsOf('enfeite');
  const grafismos = decorationsOf('grafismo');
  const molduras = decorationsOf('janela');

  const handleAddDecoration = (id: string) => {
    const asset = getDecoration(id);
    announceCanvasActivity(
      'decoration',
      asset?.label ? `Colando ${asset.label}... ✨` : 'Colando enfeite na folha... ✨',
      asset?.src,
    );
    addDecoration(id);
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>2. Enfeita aí! ✨</h2>
        <HelpTip
          label="Sobre esta etapa"
          align="end"
          tip="Esta etapa é opcional. Toque em um enfeite ou grafismo para adicionar à folha e movimente livremente."
        />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Enfeites de fundo</h3>
        <ThumbGrid
          items={enfeites}
          aspectRatio="1-1"
          columns={3}
          onSelect={handleAddDecoration}
        />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Grafismos</h3>
        <ThumbGrid
          items={grafismos}
          aspectRatio="1-1"
          columns={3}
          onSelect={handleAddDecoration}
        />
      </div>

      {molduras.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Molduras</h3>
          <ThumbGrid
            items={molduras}
            aspectRatio="1-1"
            columns={3}
            onSelect={handleAddDecoration}
          />
        </div>
      )}

      {/* Lista de enfeites presentes na folha */}
      {currentDecorations.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Na folha ({currentDecorations.length})</h3>
          <div className={styles.elementList}>
            {currentDecorations.map((d) => {
              const label = getDecoration(d.assetId)?.label || 'Enfeite';
              return (
                <ElementListRow
                  key={d.id}
                  label={label}
                  selectLabel={`Selecionar ${label}`}
                  removeLabel="Remover"
                  selected={selectedDeco?.id === d.id}
                  onSelect={() => select(d.id)}
                  onRemove={() => removeElement(d.id)}
                  bullet
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
