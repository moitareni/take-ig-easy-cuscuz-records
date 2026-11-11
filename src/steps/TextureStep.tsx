import React, { useState } from 'react';
import { ChevronDown, Sparkles, X } from 'lucide-react';
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
import { Checkbox } from '../components/ui/Checkbox';
import { PreviewImage } from '../components/ui/PreviewImage';
import { Segmented } from '../components/ui/Segmented';
import { Slider } from '../components/ui/Slider';
import { announceCanvasActivity } from '../lib/useImage';
import { useEditor } from '../store/editorStore';
import styles from './StepPanel.module.css';
import textureStyles from './TextureStep.module.css';

interface TextureOptionProps {
  title: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  /** Prévia da textura (mostrada sob demanda). Sem `previewSrc`, o botão nem existe. */
  previewSrc?: string;
  previewAlt?: string;
  children: React.ReactNode;
}

/**
 * Cartão compacto de acabamento: nome + checkbox no topo, ajustes embaixo.
 * Clicar em qualquer parte do cartão (fora dos ajustes) liga/desliga.
 */
const TextureOption: React.FC<TextureOptionProps> = ({
  title,
  enabled,
  onToggle,
  previewSrc,
  previewAlt,
  children,
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  return (
    <div
      className={`${textureStyles.option} ${enabled ? textureStyles.enabled : ''}`}
      onClick={() => onToggle(!enabled)}
      data-enabled={enabled}
    >
      <div className={textureStyles.head}>
        <h3 className={textureStyles.name}>{title}</h3>
        {previewSrc && (
          <button
            type="button"
            className={textureStyles.previewBtn}
            aria-expanded={previewOpen}
            onClick={(e) => {
              e.stopPropagation();
              setPreviewOpen((v) => !v);
            }}
          >
            Prévia da textura
            <ChevronDown size={14} strokeWidth={2.5} className={textureStyles.chevron} />
          </button>
        )}
        <Checkbox checked={enabled} onChange={onToggle} label={title} />
      </div>
      <div className={textureStyles.controls} onClick={(e) => e.stopPropagation()}>
        {children}
        {previewSrc && previewOpen && (
          <PreviewImage
            src={previewSrc}
            alt={previewAlt ?? `Prévia: ${title}`}
            className={textureStyles.preview}
            imgClassName={textureStyles.previewImage}
            style={{ height: 'auto' }}
            loadingSize="full"
          />
        )}
      </div>
    </div>
  );
};

export const TextureStep: React.FC = () => {
  const finish = useEditor((s) => s.finish);
  const setPaper = useEditor((s) => s.setPaper);
  const setBorderTexture = useEditor((s) => s.setBorderTexture);
  const setGrain = useEditor((s) => s.setGrain);
  const enableAllFinishes = useEditor((s) => s.enableAllFinishes);
  const disableAllFinishes = useEditor((s) => s.disableAllFinishes);
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
          O acabamento da arte. Marque as texturas que quiser, regule e veja na hora — tudo começa desligado.
        </p>
      </div>

      {allEnabled ? (
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          icon={<X size={16} strokeWidth={2.5} />}
          onClick={disableAllFinishes}
        >
          Desativar todas
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          icon={<Sparkles size={16} strokeWidth={2.5} />}
          onClick={() => {
            announceCanvasActivity('texture', 'Aplicando textura... ✨', paper?.src);
            enableAllFinishes();
          }}
        >
          Ativar todas
        </Button>
      )}

      {/* Papel Amassado em overlay */}
      <TextureOption
        title="Papel amassado"
        enabled={finish.paper.enabled}
        onToggle={(next) => {
          if (next) announceCanvasActivity('texture', 'Aplicando textura... ✨', paper?.src);
          setPaper({ enabled: next });
        }}
        previewSrc={paper?.thumb}
        previewAlt="Prévia do papel amassado"
      >
        <Slider
          label="Opacidade do papel"
          value={finish.paper.opacity}
          min={PAPER_OPACITY_MIN}
          max={PAPER_OPACITY_MAX}
          unit="%"
          onChange={(v) => setPaper({ opacity: v, enabled: true })}
        />
      </TextureOption>

      {/* Textura de borda (BORDER) em overlay */}
      <TextureOption
        title="Textura de borda"
        enabled={finish.borderTexture.enabled}
        onToggle={(next) => {
          if (next) announceCanvasActivity('texture', 'Aplicando textura... ✨', border?.src);
          setBorderTexture({ enabled: next });
        }}
        previewSrc={border?.src}
        previewAlt="Prévia da textura de borda"
      >
        <Slider
          label="Opacidade da textura"
          value={finish.borderTexture.opacity}
          min={BORDER_TEXTURE_OPACITY_MIN}
          max={BORDER_TEXTURE_OPACITY_MAX}
          unit="%"
          onChange={(v) => setBorderTexture({ opacity: v, enabled: true })}
        />
      </TextureOption>

      {/* Granulado monocromático em overlay */}
      <TextureOption
        title="Granulado"
        enabled={finish.grain.enabled}
        onToggle={(next) => setGrain({ enabled: next })}
      >
        <Slider
          label="Intensidade do grain"
          value={finish.grain.intensity}
          min={GRAIN_INTENSITY_MIN}
          max={GRAIN_INTENSITY_MAX}
          unit="%"
          onChange={(v) => setGrain({ intensity: v, enabled: true })}
        />
        <span className={textureStyles.controlLabel}>Tamanho do grão</span>
        <Segmented<GrainSize>
          options={(Object.keys(GRAIN_SIZES) as GrainSize[]).map((sz) => ({
            value: sz,
            label: GRAIN_SIZES[sz].label,
            hint: GRAIN_SIZES[sz].hint,
          }))}
          value={finish.grain.size}
          onChange={(size) => setGrain({ size, enabled: true })}
        />
      </TextureOption>

      {/* Volta ao acabamento padrão (desligado) */}
      <Button variant="ghost" size="sm" fullWidth onClick={resetFinish}>
        Restaurar padrão ✨
      </Button>
    </div>
  );
};