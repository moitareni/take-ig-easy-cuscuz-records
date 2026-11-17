import type { BorderKind, BrandColor, FormatDimensions, GrainSize, PostFormat, TextStyle } from './brand/brand';
import { POST_FORMATS } from './brand/brand';
export type { BorderKind, BrandColor, FormatDimensions, PostFormat, TextStyle };
export { POST_FORMATS };

export interface BaseEl {
  id: string;
  /** Centro do elemento, em px do post (1080×1440 padrão). */
  x: number;
  y: number;
  rotation: number;
  /** Escala uniforme (sempre positiva). Textos mantêm scale=1 e usam fontSize. */
  scale: number;
  /** true = este elemento vaza para o slide seguinte (crossover visual). */
  crossover?: boolean;
  /**
   * Presente só em **cópias materializadas** de crossover: id do slide DONO da
   * arte. A cópia nunca é fonte de sangria — só o dono cria/atualiza/remove.
   * Sem isso, uma cópia órfã (após reordenar páginas) se comportava como dona e
   * apagava/colonizava elementos de outras páginas.
   */
  crossFrom?: string;
}

export interface DecorationEl extends BaseEl {
  kind: 'decoration';
  assetId: string;
  flipX: boolean;
  flipY: boolean;
}

export interface TextEl extends BaseEl {
  kind: 'text';
  style: TextStyle;
  text: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  align: 'left' | 'center' | 'right';
  uppercase: boolean;
  color: BrandColor;
  brandEffect: boolean;
  /** Cor opcional do traçado do "Texto com borda" (padrão: creme). */
  brandEffectColor?: BrandColor;
  border: BorderKind;
  /**
   * Largura da área de texto em px do post (área útil de quebra, sem os pads
   * da borda). `undefined` = área automática (durante a criação); ao sair da
   * edição ela é congelada com a largura do conteúdo.
   *
   * A **altura é sempre automática** (calculada pelo conteúdo e pela largura).
   * Não existe altura manual: as alças da área mudam só a largura.
   */
  boxWidth?: number;
}

export interface LogoEl extends BaseEl {
  kind: 'logo';
  variant: 'paper' | 'clean';
}

export interface ImageEl extends BaseEl {
  kind: 'image';
  /** Chave do registro no IndexedDB (src/lib/userImages). */
  imageId: string;
  name: string;
  /** Dimensões naturais em px, já no tamanho processado (máx. 3000 no maior lado). */
  width: number;
  height: number;
  flipX: boolean;
  flipY: boolean;
  /**
   * Imagem anterior ao recorte sem fundo — alimenta o botão "Reverter fundo".
   * Vai no doc (persiste) e precisa ser considerada pelo GC do IndexedDB.
   */
  cutFrom?: ImageMeta;
}

/** Metadados de uma imagem do usuário (o binário vive no IndexedDB). */
export interface ImageMeta {
  imageId: string;
  name: string;
  width: number;
  height: number;
}

export type El = DecorationEl | ImageEl | TextEl | LogoEl;
export type ElKind = El['kind'];

export interface Doc {
  format?: PostFormat;
  backgroundId: string | null;
  backgroundFlipX?: boolean;
  backgroundFlipY?: boolean;
  backgroundOffsetY?: number;
  /** Ordem do array = ordem das camadas (último fica por cima). */
  elements: El[];
}

export type StepId = 0 | 1 | 2 | 3 | 4 | 5;
export const STEP_OF_KIND: Record<ElKind, StepId> = { decoration: 1, image: 2, text: 3, logo: 4 };
export const LAST_STEP: StepId = 5;

/** Acabamento do post (passo 6). Fora de `elements`: nunca selecionável. */
export interface PaperFinish {
  enabled: boolean;
  /** Opacidade 0–100. */
  opacity: number;
}
export interface GrainFinish {
  enabled: boolean;
  /** Intensidade 0–100 (vira opacidade do overlay). */
  intensity: number;
  size: GrainSize;
}
export interface BorderTextureFinish {
  enabled: boolean;
  /** Opacidade 0–100. */
  opacity: number;
}
export interface FinishState {
  paper: PaperFinish;
  grain: GrainFinish;
  borderTexture: BorderTextureFinish;
}

export type AlignMode = 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Uma unidade do carrossel: doc + acabamento + id único. */
export interface SlideData {
  /** Identificador único do slide (gerado na criação, imutável). */
  id: string;
  /** Estado do documento (elementos, fundo, formato). */
  doc: Doc;
  /** Acabamentos (papel, granulado, craquelado). */
  finish: FinishState;
}
