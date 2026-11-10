import React, { useId, useState } from 'react';
import { Images, Sparkles } from 'lucide-react';
import { POST_FORMATS, type PostFormat } from '../brand/brand';
import { switchSingleToCarousel, useCarousel } from '../store/carouselStore';
import { Button } from './ui/Button';
import { FormatGlyph } from './ui/FormatGlyph';
import { Segmented } from './ui/Segmented';
import styles from './ModeSelector.module.css';

export { switchSingleToCarousel };

const SINGLE_DESC = 'Arte isolada, ideal para flyers, anuncios e imagens de capa.';
const CAROUSEL_DESC =
  'Várias artes que contam uma história, ideal para quadros da página e montagens de fotos.';

/** O texto de apoio vive só no (?) do canto; na árvore fica escondido p/ leitor de tela. */
const descId = (variant: 'single' | 'carousel', id: string) => `${id}-${variant}-desc`;

export const ModeSelector: React.FC = () => {
  const [choosingFormat, setChoosingFormat] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<PostFormat>('3:4');
  const listId = useId();

  const setMode = useCarousel((s) => s.setMode);
  const setFormat = useCarousel((s) => s.setFormat);
  const addSlide = useCarousel((s) => s.addSlide);

  const handleSelectSingle = () => {
    setMode('single');
  };

  const handleConfirmCarousel = () => {
    useCarousel.setState({ slides: [] });
    setFormat(selectedFormat);
    setMode('carousel');
    addSlide();
  };

  return (
    <div className={styles.screen} role="dialog" aria-modal="true" aria-label="Escolha o modo de criação">
      <div className={styles.card}>
        <div className={styles.brandHeader}>
          <img
            src="/brand/favicon-64.png"
            alt="Logo Cuscuz Records"
            className={styles.logo}
          />
          <div>
            <h1 className={styles.title}>Cuscuz Records Insta Kit 🌽</h1>
            <p className={styles.subtitle}>Bora criar arte bonita pro feed! O que vai sair hoje?</p>
          </div>
        </div>

        {!choosingFormat ? (
          <div className={styles.optionsGrid}>
            <button
              type="button"
              className={styles.modeCard}
              aria-describedby={descId('single', listId)}
              onClick={handleSelectSingle}
            >
              <span
                className={styles.helpDot}
                data-tip={SINGLE_DESC}
                aria-hidden="true"
                onClick={(event) => event.stopPropagation()}
                data-testid="mode-help-single"
              >
                ?
              </span>
              <span className={styles.modeIcon}>
                <Sparkles size={28} strokeWidth={2.5} />
              </span>
              <span className={styles.modeTitle}>Post único</span>
              <span className={styles.modeDesc} id={descId('single', listId)}>
                {SINGLE_DESC}
              </span>
            </button>

            <button
              type="button"
              className={styles.modeCard}
              aria-describedby={descId('carousel', listId)}
              onClick={() => setChoosingFormat(true)}
            >
              <span
                className={styles.helpDot}
                data-tip={CAROUSEL_DESC}
                aria-hidden="true"
                onClick={(event) => event.stopPropagation()}
                data-testid="mode-help-carousel"
              >
                ?
              </span>
              <span className={styles.modeIcon}>
                <Images size={28} strokeWidth={2.5} />
              </span>
              <span className={styles.modeTitle}>Carrossel</span>
              <span className={styles.modeDesc} id={descId('carousel', listId)}>
                {CAROUSEL_DESC}
              </span>
            </button>
          </div>
        ) : (
          <div className={styles.formatPicker}>
            <h2 className={styles.formatTitle}>Escolha o formato do carrossel 🎠</h2>
            <p className={styles.formatHint}>
              Você escolhe o tamanho uma vez e todos os cards saem iguais.
            </p>

            <Segmented
              options={[
                {
                  value: '3:4',
                  label: <><FormatGlyph format="3:4" />{POST_FORMATS['3:4'].label}</>,
                },
                {
                  value: '4:3',
                  label: <><FormatGlyph format="4:3" />{POST_FORMATS['4:3'].label}</>,
                },
                {
                  value: '1:1',
                  label: <><FormatGlyph format="1:1" />{POST_FORMATS['1:1'].label}</>,
                },
              ]}
              value={selectedFormat}
              onChange={(v) => setSelectedFormat(v as PostFormat)}
            />

            <div className={styles.formatActions}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setChoosingFormat(false)}
              >
                Voltar
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleConfirmCarousel}
              >
                Bora criar carrossel!
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModeSelector;
