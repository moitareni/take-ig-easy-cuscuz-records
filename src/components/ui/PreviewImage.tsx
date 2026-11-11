import React, { useEffect, useRef, useState } from 'react';
import styles from './PreviewImage.module.css';

export type PreviewImageStatus = 'empty' | 'loading' | 'loaded' | 'error';

/**
 * Máquina de estados da prévia. Separada do componente para ser testável sem DOM:
 * enquanto a imagem não carregou, o <img> fica transparente — o `alt` cru nunca
 * aparece na tela, que era o defeito relatado nos painéis de enfeites/texturas.
 */
export function resolvePreviewStatus(
  src: string | null | undefined,
  loaded: boolean,
  failed: boolean,
): PreviewImageStatus {
  if (!src) return 'empty';
  if (failed) return 'error';
  return loaded ? 'loaded' : 'loading';
}

export interface PreviewImageProps {
  /** `null`/`undefined` = prévia ainda em geração (ex.: miniatura de slide). */
  src?: string | null;
  alt?: string;
  /** Classe do container: define largura, altura e proporção. */
  className?: string;
  /** Classe do <img>: object-fit, arredondamento etc. */
  imgClassName?: string;
  /** Estilos pontuais no container (ex.: aspect-ratio de uma prévia de textura). */
  style?: React.CSSProperties;
  /** Conteúdo sobreposto à prévia (selos, badges). */
  children?: React.ReactNode;
  /** Substitui o skeleton quando não há prévia ou quando o carregamento falha. */
  fallback?: React.ReactNode;
  /**
   * `full` = selo adesivo com spinner + "Carregando..." (prévias grandes).
   * `compact` = só o spinner, dimensionado pelo container (miniaturas).
   */
  loadingSize?: 'compact' | 'full';
  /** Quem precisa saber quando a prévia ficou pronta (ex.: tira de slides). */
  onStatusChange?: (status: PreviewImageStatus) => void;
  /** Desliga o lazy loading em prévias pequenas já visíveis. */
  eager?: boolean;
}

/**
 * Prévia de imagem com skeleton animado. O <img> nasce com opacidade 0 e só
 * aparece no onLoad — nem alt nem ícone de imagem quebrada vazam durante a
 * espera. Respeita `prefers-reduced-motion` pela regra global.
 *
 * O estado é guardado POR `src` (e não por boolean solto): trocar a prévia
 * nunca reporta "pronta" usando o carregamento da imagem anterior.
 */
export const PreviewImage: React.FC<PreviewImageProps> = ({
  src,
  alt = '',
  className = '',
  imgClassName = '',
  style,
  children,
  fallback,
  loadingSize = 'compact',
  onStatusChange,
  eager = false,
}) => {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const notify = useRef(onStatusChange);

  useEffect(() => {
    notify.current = onStatusChange;
  }, [onStatusChange]);

  const status = resolvePreviewStatus(
    src,
    src != null && loadedSrc === src,
    src != null && failedSrc === src,
  );

  // Imagens em cache (e blob URLs) podem ficar `complete` antes de o React
  // anexar o onLoad. Sem esta checagem o skeleton ficaria visível para sempre.
  useEffect(() => {
    const img = imgRef.current;
    if (!src || !img || !img.complete) return;
    if (img.naturalWidth > 0) setLoadedSrc(src);
    else setFailedSrc(src);
  }, [src]);

  useEffect(() => {
    notify.current?.(status);
  }, [status]);

  const showSkeleton = status === 'loading' || (status === 'empty' && !fallback);
  const showFallback = status === 'error' || (status === 'empty' && Boolean(fallback));

  return (
    <div
      className={`${styles.wrapper} ${className}`}
      style={style}
      aria-busy={status === 'loading' || (status === 'empty' && !fallback)}
    >
      {showSkeleton && (
        <span
          className={`${styles.skeleton} ${loadingSize === 'compact' ? styles.skeletonCompact : ''}`}
          aria-hidden="true"
        >
          {loadingSize === 'full' ? (
            <span className={styles.loadingBadge}>
              <span className={styles.spinner} />
              <span className={styles.loadingLabel}>Carregando prévia...</span>
            </span>
          ) : (
            <span className={`${styles.spinner} ${styles.spinnerCompact}`} />
          )}
        </span>
      )}
      {showFallback && <span className={styles.fallback}>{fallback}</span>}
      {src && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          className={`${styles.image} ${imgClassName} ${status === 'loaded' ? styles.imageLoaded : ''}`}
          onLoad={() => {
            setLoadedSrc(src);
            setFailedSrc(null);
          }}
          onError={() => {
            setFailedSrc(src);
            setLoadedSrc(null);
          }}
        />
      )}
      {children}
    </div>
  );
};
