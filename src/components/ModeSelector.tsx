import React, { useState } from 'react';
import { Images, Sparkles } from 'lucide-react';
import { POST_FORMATS, type PostFormat } from '../brand/brand';
import { switchSingleToCarousel, useCarousel } from '../store/carouselStore';
import { Button } from './ui/Button';
import { Segmented } from './ui/Segmented';
import styles from './ModeSelector.module.css';

export { switchSingleToCarousel };

/** Miniaturas decorativas: reconhecimento visual em vez de leitura. */
const ModePreview: React.FC<{ variant: 'single' | 'carousel' }> = ({ variant }) => (
  <span className={styles.preview} data-testid="mode-preview" aria-hidden="true">
    {variant === 'single' ? (
      <span className={`${styles.previewSheet} ${styles.previewSheetSingle}`}>
        <span className={styles.previewLine} />
        <span className={styles.previewLineShort} />
      </span>
    ) : (
      <>
        <span className={`${styles.previewSheet} ${styles.previewSheetBack}`} />
        <span className={`${styles.previewSheet} ${styles.previewSheetMid}`} />
        <span className={`${styles.previewSheet} ${styles.previewSheetFront}`}>
          <span className={styles.previewLine} />
          <span className={styles.previewLineShort} />
        </span>
      </>
    )}
  </span>
);

export const ModeSelector: React.FC = () => {
  const [choosingFormat, setChoosingFormat] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<PostFormat>('3:4');

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
              onClick={handleSelectSingle}
            >
              <span className={styles.cardTop}>
                <span className={styles.modeIcon}>
                  <Sparkles size={28} strokeWidth={2.5} />
                </span>
                <ModePreview variant="single" />
              </span>
              <span className={styles.modeTitle}>Post único</span>
              <span className={styles.modeDesc}>
                Uma arte caprichada, do tamanho do feed, pronta pra baixar.
              </span>
            </button>

            <button
              type="button"
              className={styles.modeCard}
              onClick={() => setChoosingFormat(true)}
            >
              <span className={styles.cardTop}>
                <span className={styles.modeIcon}>
                  <Images size={28} strokeWidth={2.5} />
                </span>
                <ModePreview variant="carousel" />
              </span>
              <span className={styles.modeTitle}>Carrossel</span>
              <span className={styles.modeDesc}>
                Vários cards que contam uma história — perfeito pra lançamento de música ou teasers.
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
                { value: '3:4', label: POST_FORMATS['3:4'].label },
                { value: '4:3', label: POST_FORMATS['4:3'].label },
                { value: '1:1', label: POST_FORMATS['1:1'].label },
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
