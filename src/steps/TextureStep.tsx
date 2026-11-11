import React, { useState } from 'react';
import { ChevronDown, Frame, Layers, Newspaper, Sparkles } from 'lucide-react';
import {
  BORDER_TEXTURE_OPACITY_MAX,
  BORDER_TEXTURE_OPACITY_MIN,
  GRAIN_INTENSITY_MAX,
  GRAIN_INTENSITY_MIN,
  GRAIN_SIZES,
  PAPER_OPACITY_MAX,
  PAPER_OPACITY_MIN,
  type GrainSize,
} from '../brand/brand';
import { getBorderTexture, getPaperTexture } from '../assets';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PreviewImage } from '../components/ui/PreviewImage';
import { Segmented } from '../components/ui/Segmented';
import { Slider } from '../components/ui/Slider';
import { announceCanvasActivity } from '../lib/useImage';
import { useEditor } from '../store/editorStore';
import styles from './StepPanel.module.css';

export const TextureStep: React.FC = () => {
  const [paperPreviewOpen, setPaperPreviewOpen] = useState(false);
  const [borderPreviewOpen, setBorderPreviewOpen] = useState(false);

  const finish = useEditor((s) => s.finish);
  const setPaper = useEditor((s) => s.setPaper);
  const setBorderTexture = useEditor((s) => s.setBorderTexture);
  const setGrain = useEditor((s) => s.setGrain);
  const enableAllFinishes = useEditor((s) => s.enableAllFinishes);
  const resetFinish = useEditor((s) => s.resetFinish);
  const paper = getPaperTexture();
  const border = getBorderTexture();

  const allEnabled =
    finish.paper.enabled && finish.borderTexture.enabled && finish.grain.enabled;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>6. Textura final ✨</h2>
        <p className={styles.description}>
          O acabamento da arte. Papel amassado, textura de borda e granulado vêm desligados — ligue, regule e veja na hora.
        </p>
      </div>

      <Button
        variant="secondary"
        size="sm"
        fullWidth
        icon={<Sparkles size={16} strokeWidth={2.5} />}
        disabled={allEnabled}
        onClick={() => {
          announceCanvasActivity('texture', 'Aplicando textura... ✨', paper?.src);
          enableAllFinishes();
        }}
      >
        Ativar todas
      </Button>

      {/* Papel Amassado em overlay */}
      <Card title="Papel Amassado" subtitle="Opcional 🌽 desligado por padrão (sugestão: 40%)">
        <div className={styles.section}>
          <Button
            variant={finish.paper.enabled ? 'primary' : 'secondary'}
            size="sm"
            fullWidth
            icon={<Newspaper size={16} strokeWidth={2.5} />}
            onClick={() => {
              if (!finish.paper.enabled) {
                announceCanvasActivity('texture', 'Aplicando textura... ✨', paper?.src);
              }
              setPaper({ enabled: !finish.paper.enabled });
            }}
          >
            {finish.paper.enabled ? 'Papel (Ligado)' : 'Papel (Desligado)'}
          </Button>
          <Slider
            label="Opacidade do papel"
            value={finish.paper.opacity}
            min={PAPER_OPACITY_MIN}
            max={PAPER_OPACITY_MAX}
            unit="%"
            onChange={(v) => setPaper({ opacity: v, enabled: true })}
          />
          {paper && (
            <details
              className={styles.textureDetails}
              onToggle={(event) => setPaperPreviewOpen(event.currentTarget.open)}
            >
              <summary className={styles.textureSummary}>
                <span>Ver prévia da textura</span>
                <ChevronDown size={16} strokeWidth={2.5} className={styles.textureChevron} />
              </summary>
              {paperPreviewOpen && (
                <PreviewImage
                  src={paper.thumb}
                  alt="Prévia do papel amassado"
                  className={styles.texturePreview}
                  imgClassName={styles.texturePreviewImage}
                  style={{ height: 'auto' }}
                  loadingSize="full"
                />
              )}
            </details>
          )}
        </div>
      </Card>

      {/* Textura de borda (BORDER) em overlay */}
      <Card title="Textura de Borda" subtitle="Opcional 🌽 mesclagem overlay (sugestão: 40%)">
        <div className={styles.section}>
          <Button
            variant={finish.borderTexture.enabled ? 'primary' : 'secondary'}
            size="sm"
            fullWidth
            icon={<Frame size={16} strokeWidth={2.5} />}
            onClick={() => {
              if (!finish.borderTexture.enabled) {
                announceCanvasActivity('texture', 'Aplicando textura... ✨', border?.src);
              }
              setBorderTexture({ enabled: !finish.borderTexture.enabled });
            }}
          >
            {finish.borderTexture.enabled ? 'Borda (Ligado)' : 'Borda (Desligado)'}
          </Button>
          <Slider
            label="Opacidade da textura"
            value={finish.borderTexture.opacity}
            min={BORDER_TEXTURE_OPACITY_MIN}
            max={BORDER_TEXTURE_OPACITY_MAX}
            unit="%"
            onChange={(v) => setBorderTexture({ opacity: v, enabled: true })}
          />
          {border && (
            <details
              className={styles.textureDetails}
              onToggle={(event) => setBorderPreviewOpen(event.currentTarget.open)}
            >
              <summary className={styles.textureSummary}>
                <span>Ver prévia da textura</span>
                <ChevronDown size={16} strokeWidth={2.5} className={styles.textureChevron} />
              </summary>
              {borderPreviewOpen && (
                <PreviewImage
                  src={border.src}
                  alt="Prévia da textura de borda"
                  className={styles.texturePreview}
                  imgClassName={styles.texturePreviewImage}
                  style={{ height: 'auto' }}
                  loadingSize="full"
                />
              )}
            </details>
          )}
        </div>
      </Card>

      {/* Granulado monocromático em overlay */}
      <Card title="Granulado (Grain)" subtitle="Opcional 🌽 desligado por padrão (sugestão: 50%, grão P)">
        <div className={styles.section}>
          <Button
            variant={finish.grain.enabled ? 'primary' : 'secondary'}
            size="sm"
            fullWidth
            icon={<Layers size={16} strokeWidth={2.5} />}
            onClick={() => setGrain({ enabled: !finish.grain.enabled })}
          >
            {finish.grain.enabled ? 'Grain (Ligado)' : 'Grain (Desligado)'}
          </Button>
          <Slider
            label="Intensidade do grain"
            value={finish.grain.intensity}
            min={GRAIN_INTENSITY_MIN}
            max={GRAIN_INTENSITY_MAX}
            unit="%"
            onChange={(v) => setGrain({ intensity: v, enabled: true })}
          />
          <span style={{ fontSize: '15px', fontWeight: 700 }}>Tamanho do grão</span>
          <Segmented<GrainSize>
            options={(Object.keys(GRAIN_SIZES) as GrainSize[]).map((sz) => ({
              value: sz,
              label: GRAIN_SIZES[sz].label,
              hint: GRAIN_SIZES[sz].hint,
            }))}
            value={finish.grain.size}
            onChange={(size) => setGrain({ size, enabled: true })}
          />
        </div>
      </Card>

      {/* Volta ao acabamento padrão (desligado) */}
      <Button variant="ghost" size="sm" fullWidth onClick={resetFinish}>
        Restaurar padrão ✨
      </Button>
    </div>
  );
};
