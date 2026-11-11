import React, { useState } from 'react';
import { getBackground, manifest } from '../assets';
import type { PostFormat } from '../brand/brand';
import { Button } from '../components/ui/Button';
import { HelpTip } from '../components/ui/HelpTip';
import { Segmented } from '../components/ui/Segmented';
import { Slider } from '../components/ui/Slider';
import { ThumbGrid } from '../components/ui/ThumbGrid';
import { announceCanvasActivity } from '../lib/useImage';
import { useCarousel } from '../store/carouselStore';
import { useEditor } from '../store/editorStore';
import styles from './StepPanel.module.css';

export const BackgroundStep: React.FC = () => {
  const [tab, setTab] = useState<'pronto' | 'puro'>('pronto');
  const mode = useCarousel((s) => s.mode);
  const carouselFormat = useCarousel((s) => s.format);
  const docFormat = useEditor((s) => s.doc.format ?? '3:4');
  const format: PostFormat = mode === 'carousel' ? carouselFormat : docFormat;
  const backgroundId = useEditor((s) => s.doc.backgroundId);
  const backgroundOffsetY = useEditor((s) => s.doc.backgroundOffsetY ?? 180);

  const setFormat = useEditor((s) => s.setFormat);
  const setBackground = useEditor((s) => s.setBackground);
  const setBackgroundOffsetY = useEditor((s) => s.setBackgroundOffsetY);
  const showToast = useEditor((s) => s.showToast);

  const filtered = manifest.backgrounds.filter((b) => b.category === tab);
  const gridAspectRatio = format === '4:3' ? '4-3' : format === '1:1' ? '1-1' : '3-4';

  const handleFormatChange = (nextFormat: PostFormat) => {
    if (mode === 'carousel') {
      showToast('info', 'O formato não pode ser alterado depois que o carrossel foi criado 🎠');
      return;
    }
    setFormat(nextFormat);
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>1. Escolha o fundo 🌽</h2>
        <HelpTip
          label="Sobre esta etapa"
          align="end"
          tip={
            mode === 'carousel'
              ? 'Escolha a textura da sua arte. O formato foi definido na criação do carrossel.'
              : 'Selecione o formato do post e a textura da sua arte.'
          }
        />
      </div>

      {/* No carrossel o formato é fixo desde a criação: mostrar um seletor que
          não responde só suja o painel e induz a usuária a tentar trocar. */}
      {mode !== 'carousel' && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Formato do post</h3>
          <Segmented
            options={[
              { value: '3:4', label: 'Vertical (3:4)' },
              { value: '4:3', label: 'Horizontal (4:3)' },
              { value: '1:1', label: 'Quadrado (1:1)' },
            ]}
            value={format}
            onChange={(v) => handleFormatChange(v as PostFormat)}
          />
        </div>
      )}

      {backgroundId && format === '1:1' && (
        <div className={styles.section}>
          <Slider
            label="Corte vertical"
            value={backgroundOffsetY}
            min={0}
            max={360}
            step={1}
            unit="px"
            onChange={setBackgroundOffsetY}
          />
          <div className={styles.buttonGrid3}>
            <Button
              variant={backgroundOffsetY === 0 ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setBackgroundOffsetY(0)}
            >
              Topo
            </Button>
            <Button
              variant={backgroundOffsetY === 180 ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setBackgroundOffsetY(180)}
            >
              Centro
            </Button>
            <Button
              variant={backgroundOffsetY === 360 ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setBackgroundOffsetY(360)}
            >
              Base
            </Button>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--c-text-muted)' }}>
            💡 Você também pode clicar e arrastar o fundo direto na folha para ajustar o corte.
          </p>
        </div>
      )}

      <Segmented
        options={[
          { value: 'pronto', label: 'Fundos Prontos' },
          { value: 'puro', label: 'Fundos Puros' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <ThumbGrid
        items={filtered}
        selectedId={backgroundId}
        aspectRatio={gridAspectRatio}
        columns={2}
        onSelect={(id) => {
          if (id !== backgroundId) {
            const asset = getBackground(id);
            announceCanvasActivity(
              'background',
              backgroundId ? 'Trocando o fundo... 🌽' : 'Colando o fundo na folha... 🌽',
              asset?.src,
            );
          }
          setBackground(id);
        }}
      />
    </div>
  );
};
