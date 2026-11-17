import { useMemo } from 'react';
import { create } from 'zustand';
import { temporal } from 'zundo';
import {
  BORDER_TEXTURE_OPACITY_MAX,
  BORDER_TEXTURE_OPACITY_MIN,
  GRAIN_INTENSITY_MAX,
  GRAIN_INTENSITY_MIN,
  GRAIN_SIZES,
  GUIDE_MARGIN_DEFAULT,
  GUIDE_MARGIN_MAX,
  GUIDE_MARGIN_MIN,
  LOGO_MARGIN,
  LOGO_SIZES,
  PAPER_OPACITY_MAX,
  PAPER_OPACITY_MIN,
  POST_H,
  POST_W,
  TEXT_PRESETS,
  getPostDimensions,
  type LogoSize,
  type PostFormat,
  type TextStyle,
} from '../brand/brand';
import { getDecoration, getLogo } from '../assets';
import { clampTextSize } from '../lib/textRules';
import { clampZoom } from '../lib/zoom';
import { clampImageCenter, hasImageSlots, initialImageScale } from '../lib/imageRules';
import {
  boxSize,
  clampInt,
  defaultFinish,
  emptyDoc,
  sanitize,
  sanitizeFinish,
  uid,
} from '../lib/sanitize';
import {
  applyElPatches,
  duplicateGroup,
  pruneIds,
  reorderBackward,
  reorderForward,
  toggleId,
  type ElPatch,
} from '../lib/multiSelect';
import {
  STEP_OF_KIND,
  type BorderTextureFinish,
  type Doc,
  type El,
  type FinishState,
  type GrainFinish,
  type ImageEl,
  type ImageMeta,
  type LogoEl,
  type PaperFinish,
  type StepId,
  type TextEl,
} from '../types';

export { defaultFinish, emptyDoc, sanitize, sanitizeFinish };

/** Metadados de uma imagem importada (o blob vive no userImages/IndexedDB). */
export type { ImageMeta };

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  kind: 'error' | 'success' | 'info';
  message: string;
  /** Ação opcional (ex.: "Desfazer" após excluir). */
  action?: ToastAction;
  /** Tempo visível em ms. Sem ação, o padrão do componente é 4 s. */
  duration?: number;
}

export interface ToastOptions {
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export type LogoPlace = Corner | 'tc' | 'bc' | 'center';

/** Guias de layout (Photoshop-like). Visibilidade fora do doc: nunca persiste nem entra no undo. */
export interface LayoutGuides {
  visible: boolean;
  showMargins: boolean;
  showCenters: boolean;
  showThirds: boolean;
  margin: number;
}

export interface EditorState {
  doc: Doc;
  /**
   * Seleção (ordem de seleção). Fonte da verdade da seleção múltipla.
   * Sessão: nunca persiste nem entra no undo.
   */
  selectedIds: string[];
  /** DERIVADO de `selectedIds`: o id quando há exatamente 1 selecionado, senão null. */
  selectedId: string | null;
  editingId: string | null;
  step: StepId;
  guides: { v: boolean; h: boolean };
  toast: Toast | null;
  layoutGuides: LayoutGuides;
  /** Acabamento (passo 6). Persiste e entra no undo junto com o doc. */
  finish: FinishState;
  /** Zoom da folha (multiplicador sobre o ajuste à tela). Sessão: nunca persiste nem entra no undo. */
  zoom: number;
  /** Largura de ajuste à tela em px (base do zoom). Sessão. */
  fitWidth: number;

  setStep: (step: StepId) => void;
  select: (id: string | null) => void;
  /** Ctrl/Cmd/Shift+clique: soma ou remove da seleção (troca o passo só ao restar 1). */
  toggleSelect: (id: string) => void;
  /** Seleciona vários de uma vez (ignora ids que não existem). */
  selectMany: (ids: string[]) => void;
  setEditing: (id: string | null) => void;
  setGuides: (g: { v: boolean; h: boolean }) => void;
  showToast: (kind: Toast['kind'], message: string, options?: ToastOptions) => void;
  dismissToast: () => void;
  toggleGuidesVisible: () => void;
  setGuideLayer: (patch: Partial<Omit<LayoutGuides, 'margin' | 'visible'>>) => void;
  setGuideMargin: (margin: number) => void;
  setGuidesVisible: (visible: boolean) => void;
  setPaper: (patch: Partial<PaperFinish>) => void;
  setGrain: (patch: Partial<GrainFinish>) => void;
  setBorderTexture: (patch: Partial<BorderTextureFinish>) => void;
  /** Liga os três acabamentos num único passo de undo, preservando opacidades e tamanho do grão. */
  enableAllFinishes: () => void;
  /** Inverso de enableAllFinishes: desliga os três em um único passo de undo, preservando os ajustes. */
  disableAllFinishes: () => void;
  /** Define o zoom prendendo nos limites 25%–400%. */
  setZoom: (factor: number) => void;
  setFitWidth: (width: number) => void;

  setFormat: (format: PostFormat) => void;
  setBackgroundOffsetY: (offsetY: number) => void;
  setBackground: (id: string) => void;
  toggleBackgroundFlipX: () => void;
  toggleBackgroundFlipY: () => void;
  addDecoration: (assetId: string) => void;
  addText: (style: TextStyle) => void;
  addLogo: (variant: LogoEl['variant']) => void;
  /** Adiciona imagem do usuário (limite de 5). `at` = centro do drop na folha. */
  addImage: (meta: ImageMeta, at?: { x: number; y: number }) => void;
  /** Troca a fonte da imagem mantendo posição, rotação, flips e largura visual.
   *  `restore` guarda a imagem anterior p/ o botão "Reverter fundo"; omitir limpa. */
  replaceImage: (id: string, meta: ImageMeta, restore?: ImageMeta) => void;
  /** Remove elementos de imagem cujo blob não existe mais (após hidratar o IndexedDB). */
  reconcileImages: (availableIds: Set<string>) => void;
  setLogoSize: (size: LogoSize) => void;
  placeLogo: (place: LogoPlace) => void;

  updateElement: (id: string, patch: Partial<El>) => void;
  /** Aplica a regra Texto ≤ Título. Retorna o tamanho efetivamente aplicado. */
  setTextSize: (id: string, requested: number) => number;
  removeElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  /** Aplica vários patches num ÚNICO set do doc (um passo de undo). Sem validação de texto: use `buildTransformPatches`. */
  applyPatches: (patches: ElPatch[]) => void;
  removeElements: (ids: string[]) => void;
  /** Duplica o conjunto como bloco e seleciona as cópias (logo ignorada; imagens tudo-ou-nada). */
  duplicateElements: (ids: string[]) => void;
  bringForwardMany: (ids: string[]) => void;
  sendBackwardMany: (ids: string[]) => void;
  reset: () => void;
}

/** Estado de seleção coerente: `selectedId` é sempre derivado de `selectedIds`. */
const selection = (ids: string[]) => ({
  selectedIds: ids,
  selectedId: ids.length === 1 ? ids[0] : null,
});

/** Evita empilhar elementos novos exatamente no mesmo ponto. */
function freeCenter(elements: El[], x = POST_W / 2, y = POST_H / 2) {
  let cx = x;
  let cy = y;
  while (elements.some((e) => Math.abs(e.x - cx) < 1 && Math.abs(e.y - cy) < 1)) {
    cx += 32;
    cy += 32;
  }
  return { x: cx, y: cy };
}

export function effectiveLogoMargin(layoutGuides: LayoutGuides): number {
  return layoutGuides.visible && layoutGuides.showMargins ? layoutGuides.margin : 0;
}

function logoPlacement(
  el: LogoEl,
  place: LogoPlace,
  format: PostFormat = '3:4',
  margin: number = LOGO_MARGIN,
) {
  const { width: postW, height: postH } = getPostDimensions(format);
  const asset = getLogo(el.variant);
  const w = asset.width * el.scale;
  const h = asset.height * el.scale;
  const m = margin;
  const left = m + w / 2;
  const right = postW - m - w / 2;
  const top = m + h / 2;
  const bottom = postH - m - h / 2;
  const map: Record<LogoPlace, { x: number; y: number }> = {
    tl: { x: left, y: top },
    tr: { x: right, y: top },
    bl: { x: left, y: bottom },
    br: { x: right, y: bottom },
    tc: { x: postW / 2, y: top },
    bc: { x: postW / 2, y: bottom },
    center: { x: postW / 2, y: postH / 2 },
  };
  return { ...map[place], rotation: 0 };
}

/**
 * Medidor da área de texto, registrado pelo EditorCanvas (é lá que o Konva
 * está disponível). O store usa isto para congelar as dimensões do conteúdo
 * quando a edição termina, sem importar Konva aqui.
 */
export type TextBoxMeasurer = (el: TextEl) => number;

let textBoxMeasurer: TextBoxMeasurer | null = null;

export function setTextBoxMeasurer(measurer: TextBoxMeasurer | null): void {
  textBoxMeasurer = measurer;
}

/**
 * Congela a área automática (durante a criação) com as dimensões atuais do
 * conteúdo. Depois disso, edições posteriores respeitam a área definida.
 */
function freezeTextBox(el: El): El {
  if (el.kind !== 'text' || el.boxWidth !== undefined || !textBoxMeasurer) return el;
  const width = boxSize(textBoxMeasurer(el));
  if (width === undefined) return el;
  return { ...el, boxWidth: width };
}

function freezeDocTextBox(doc: Doc, editingId: string | null): Doc {
  if (!editingId) return doc;
  const el = doc.elements.find((e) => e.id === editingId);
  if (!el || el.kind !== 'text' || el.boxWidth !== undefined) return doc;
  const frozen = freezeTextBox(el);
  if (frozen === el) return doc;
  return { ...doc, elements: doc.elements.map((e) => (e.id === editingId ? frozen : e)) };
}

/** Fecha a edição de texto pendente, gravando a área automática no doc. */
export function flushTextEditing(): void {
  const state = useEditor.getState();
  if (!state.editingId) return;
  const doc = freezeDocTextBox(state.doc, state.editingId);
  if (doc !== state.doc) useEditor.setState({ doc });
}

/** Aplica um patch parcial preservando o discriminante `kind` da união. */
function mergeElementPatch(el: El, patch: Partial<El>): El {
  const clean = { ...patch };
  delete clean.kind;
  return Object.assign({}, el, clean);
}

export const useEditor = create<EditorState>()(
  temporal(
    (set, get) => {
        const setDoc = (fn: (doc: Doc) => Doc) => set((s) => ({ doc: fn(s.doc) }));
        const mapEl = (id: string, fn: (e: El) => El) =>
          setDoc((d) => ({ ...d, elements: d.elements.map((e) => (e.id === id ? fn(e) : e)) }));
        const findEl = (id: string) => get().doc.elements.find((e) => e.id === id);

        return {
          doc: emptyDoc(),
          ...selection([]),
          editingId: null,
          step: 0,
          guides: { v: false, h: false },
          toast: null,
          layoutGuides: {
            visible: true,
            showMargins: true,
            showCenters: false,
            showThirds: false,
            margin: GUIDE_MARGIN_DEFAULT,
          },
          finish: defaultFinish(),
          zoom: 1,
          fitWidth: 360,

          setStep: (step) =>
            set((s) => {
              // Trocar de etapa encerra a edição: a área automática é congelada.
              const doc = freezeDocTextBox(s.doc, s.editingId);
              const sel = doc.elements.find((e) => e.id === s.selectedId);
              const keep = sel && STEP_OF_KIND[sel.kind] === step;
              return { doc, step, ...selection(keep && sel ? [sel.id] : []), editingId: null };
            }),
          select: (id) =>
            set((s) => {
              if (!id) return selection([]);
              const el = s.doc.elements.find((e) => e.id === id);
              return el ? { ...selection([id]), step: STEP_OF_KIND[el.kind] } : {};
            }),
          toggleSelect: (id) =>
            set((s) => {
              if (!s.doc.elements.some((e) => e.id === id)) return {};
              const next = toggleId(s.selectedIds, id);
              // Restou 1: o painel lateral acompanha o tipo dele (invariante passo × seleção única).
              const only = next.length === 1 ? s.doc.elements.find((e) => e.id === next[0]) : undefined;
              return only ? { ...selection(next), step: STEP_OF_KIND[only.kind] } : selection(next);
            }),
          selectMany: (ids) =>
            set((s) => {
              const next = pruneIds(ids, s.doc.elements);
              const only = next.length === 1 ? s.doc.elements.find((e) => e.id === next[0]) : undefined;
              return only ? { ...selection(next), step: STEP_OF_KIND[only.kind] } : selection(next);
            }),
          setEditing: (id) =>
            set((s) => {
              // Sair da edição define a área de texto com o tamanho do conteúdo
              // (Cenário 1 de 4.2). Edições posteriores respeitam essa área.
              if (!s.editingId || s.editingId === id) return { editingId: id };
              return { editingId: id, doc: freezeDocTextBox(s.doc, s.editingId) };
            }),
          setGuides: (g) => {
            const cur = get().guides;
            if (cur.v !== g.v || cur.h !== g.h) set({ guides: g });
          },
          showToast: (kind, message, options) =>
            set({
              toast: {
                id: Date.now() + Math.random(),
                kind,
                message,
                action:
                  options?.actionLabel && options.onAction
                    ? { label: options.actionLabel, onClick: options.onAction }
                    : undefined,
                duration: options?.duration,
              },
            }),
          dismissToast: () => set({ toast: null }),
          toggleGuidesVisible: () =>
            set((s) => ({ layoutGuides: { ...s.layoutGuides, visible: !s.layoutGuides.visible } })),
          setGuideLayer: (patch) => set((s) => ({ layoutGuides: { ...s.layoutGuides, ...patch } })),
          setGuideMargin: (margin) =>
            set((s) => ({
              layoutGuides: {
                ...s.layoutGuides,
                margin: Math.min(GUIDE_MARGIN_MAX, Math.max(GUIDE_MARGIN_MIN, Math.round(margin))),
              },
            })),
          setGuidesVisible: (visible) => set((s) => ({ layoutGuides: { ...s.layoutGuides, visible } })),
          enableAllFinishes: () =>
            set((s) => {
              if (s.finish.paper.enabled && s.finish.grain.enabled && s.finish.borderTexture.enabled) {
                return {};
              }
              return {
                finish: {
                  paper: { ...s.finish.paper, enabled: true },
                  grain: { ...s.finish.grain, enabled: true },
                  borderTexture: { ...s.finish.borderTexture, enabled: true },
                },
              };
            }),
          disableAllFinishes: () =>
            set((s) => {
              if (!s.finish.paper.enabled && !s.finish.grain.enabled && !s.finish.borderTexture.enabled) {
                return {};
              }
              return {
                finish: {
                  paper: { ...s.finish.paper, enabled: false },
                  grain: { ...s.finish.grain, enabled: false },
                  borderTexture: { ...s.finish.borderTexture, enabled: false },
                },
              };
            }),
          setZoom: (factor) => {
            const next = clampZoom(factor);
            if (get().zoom !== next) set({ zoom: next });
          },
          setFitWidth: (width) => {
            const next = Math.max(1, Math.round(width));
            if (get().fitWidth !== next) set({ fitWidth: next });
          },
          setPaper: (patch) =>
            set((s) => ({
              finish: {
                ...s.finish,
                paper: {
                  enabled: patch.enabled ?? s.finish.paper.enabled,
                  opacity:
                    patch.opacity === undefined
                      ? s.finish.paper.opacity
                      : clampInt(patch.opacity, PAPER_OPACITY_MIN, PAPER_OPACITY_MAX),
                },
              },
            })),
          setGrain: (patch) =>
            set((s) => ({
              finish: {
                ...s.finish,
                grain: {
                  enabled: patch.enabled ?? s.finish.grain.enabled,
                  intensity:
                    patch.intensity === undefined
                      ? s.finish.grain.intensity
                      : clampInt(patch.intensity, GRAIN_INTENSITY_MIN, GRAIN_INTENSITY_MAX),
                  size: patch.size && patch.size in GRAIN_SIZES ? patch.size : s.finish.grain.size,
                },
              },
            })),
          setBorderTexture: (patch) =>
            set((s) => ({
              finish: {
                ...s.finish,
                borderTexture: {
                  enabled: patch.enabled ?? s.finish.borderTexture.enabled,
                  opacity:
                    patch.opacity === undefined
                      ? s.finish.borderTexture.opacity
                      : clampInt(patch.opacity, BORDER_TEXTURE_OPACITY_MIN, BORDER_TEXTURE_OPACITY_MAX),
                },
              },
            })),

          setFormat: (format) =>
            setDoc((d) => ({
              ...d,
              format,
              backgroundOffsetY: d.backgroundOffsetY ?? 180,
            })),
          setBackgroundOffsetY: (offsetY) => {
            const clamped = Math.min(360, Math.max(0, Math.round(offsetY)));
            setDoc((d) => ({ ...d, backgroundOffsetY: clamped }));
          },
          setBackground: (id) => setDoc((d) => ({ ...d, backgroundId: id })),
          toggleBackgroundFlipX: () =>
            setDoc((d) => ({ ...d, backgroundFlipX: !d.backgroundFlipX })),
          toggleBackgroundFlipY: () =>
            setDoc((d) => ({ ...d, backgroundFlipY: !d.backgroundFlipY })),

          addDecoration: (assetId) => {
            const asset = getDecoration(assetId);
            if (!asset) return;
            const { width: postW, height: postH } = getPostDimensions(get().doc.format);
            const pos = asset.fullSheet
              ? { x: postW / 2, y: postH / 2 }
              : freeCenter(get().doc.elements, postW / 2, postH / 2);
            const el: El = { id: uid(), kind: 'decoration', assetId, ...pos, rotation: 0, scale: 1, flipX: false, flipY: false };
            setDoc((d) => ({ ...d, elements: [...d.elements, el] }));
            set(selection([el.id]));
          },

          addText: (style) => {
            const p = TEXT_PRESETS[style];
            const elements = get().doc.elements;
            const { width: postW, height: postH } = getPostDimensions(get().doc.format);
            const pos = freeCenter(elements, postW / 2, postH / 2);
            const base: TextEl = {
              id: uid(),
              kind: 'text',
              style,
              text: p.placeholder,
              ...pos,
              rotation: 0,
              scale: 1,
              fontSize: p.fontSize,
              lineHeight: p.lineHeight,
              letterSpacing: p.letterSpacing,
              align: 'center',
              uppercase: p.uppercase,
              color: p.color,
              brandEffect: p.brandEffect,
              border: p.border,
            };
            // Nasce já respeitando a regra (sem mostrar erro: o usuário não pediu esse tamanho).
            base.fontSize = clampTextSize(elements, base, p.fontSize).value;
            setDoc((d) => ({ ...d, elements: [...d.elements, base] }));
            set(selection([base.id]));
          },

          addLogo: (variant) => {
            const existing = get().doc.elements.find((e): e is LogoEl => e.kind === 'logo');
            if (existing) {
              // Troca a versão mantendo a largura visual.
              const oldW = getLogo(existing.variant).width * existing.scale;
              const scale = oldW / getLogo(variant).width;
              mapEl(existing.id, (e) => (e.kind === 'logo' ? { ...e, variant, scale } : e));
              set(selection([existing.id]));
              return;
            }
            const scale = LOGO_SIZES.M / getLogo(variant).width;
            const el: LogoEl = { id: uid(), kind: 'logo', variant, x: 0, y: 0, rotation: 0, scale };
            const margin = effectiveLogoMargin(get().layoutGuides);
            Object.assign(el, logoPlacement(el, 'bc', get().doc.format, margin));
            setDoc((d) => ({ ...d, elements: [...d.elements, el] }));
            set(selection([el.id]));
          },

          setLogoSize: (size) => {
            const logo = get().doc.elements.find((e): e is LogoEl => e.kind === 'logo');
            if (!logo) return;
            mapEl(logo.id, (e) => ({ ...e, scale: LOGO_SIZES[size] / getLogo(logo.variant).width }));
          },

          placeLogo: (place) => {
            const logo = get().doc.elements.find((e): e is LogoEl => e.kind === 'logo');
            if (!logo) return;
            const margin = effectiveLogoMargin(get().layoutGuides);
            mapEl(logo.id, (e) => ({ ...e, ...logoPlacement(logo, place, get().doc.format, margin) }));
            set(selection([logo.id]));
          },

          addImage: (meta, at) => {
            if (!meta.imageId || !(meta.width > 0) || !(meta.height > 0)) return;
            const elements = get().doc.elements;
            if (!hasImageSlots(elements)) {
              get().showToast('error', 'Tá lotado! Cabem até 5 imagens por post 😅');
              return;
            }
            const { width: postW, height: postH } = getPostDimensions(get().doc.format);
            const pos = at ? clampImageCenter(at.x, at.y, postW, postH) : freeCenter(elements, postW / 2, postH / 2);
            const el: ImageEl = {
              id: uid(),
              kind: 'image',
              imageId: meta.imageId,
              name: meta.name,
              x: pos.x,
              y: pos.y,
              rotation: 0,
              scale: initialImageScale(meta.width, meta.height, 0.7, postW, postH),
              flipX: false,
              flipY: false,
              width: meta.width,
              height: meta.height,
            };
            setDoc((d) => ({ ...d, elements: [...d.elements, el] }));
            set(selection([el.id]));
          },

          replaceImage: (id, meta, restore) => {
            const el = findEl(id);
            if (!el || el.kind !== 'image' || !(meta.width > 0) || !(meta.height > 0)) return;
            const cur = el;
            // Mantém a largura visual da imagem anterior.
            const scale = cur.width > 0 && meta.width > 0 ? (cur.width * cur.scale) / meta.width : cur.scale;
            mapEl(id, (e) => {
              if (e.kind !== 'image') return e;
              const next: ImageEl = {
                ...e,
                imageId: meta.imageId,
                name: meta.name,
                width: meta.width,
                height: meta.height,
                scale,
              };
              if (restore) next.cutFrom = restore;
              else delete next.cutFrom;
              return next;
            });
          },

          reconcileImages: (availableIds) => {
            const ghosts = get().doc.elements.filter(
              (e): e is ImageEl => e.kind === 'image' && !availableIds.has(e.imageId),
            );
            if (ghosts.length === 0) return;
            const ids = new Set(ghosts.map((g) => g.id));
            setDoc((d) => ({ ...d, elements: d.elements.filter((e) => !ids.has(e.id)) }));
          },

          updateElement: (id, patch) => {
            const el = findEl(id);
            if (!el) return;
            if (el.kind === 'text' && 'fontSize' in patch && typeof patch.fontSize === 'number') {
              const requested = patch.fontSize;
              const size = get().setTextSize(id, requested);
              mapEl(id, (e) => mergeElementPatch(e, { ...patch, fontSize: size }));
              return;
            }
            mapEl(id, (e) => mergeElementPatch(e, patch));
          },

          setTextSize: (id, requested) => {
            const el = findEl(id);
            if (!el || el.kind !== 'text') return requested;
            const { value, error } = clampTextSize(get().doc.elements, el, requested);
            if (error) get().showToast('error', error);

            // A largura definida acompanha proporcionalmente a fonte (4.5),
            // preservando as quebras. A altura é automática e acompanha sozinha.
            const ratio = el.fontSize > 0 ? value / el.fontSize : 1;
            const nextBoxWidth =
              el.boxWidth !== undefined ? Math.max(1, Math.round(el.boxWidth * ratio)) : undefined;
            const boxChanged = nextBoxWidth !== el.boxWidth;

            if (value !== el.fontSize || el.scale !== 1 || boxChanged) {
              mapEl(id, (e) => {
                if (e.kind !== 'text') return e;
                const next: TextEl = { ...e, fontSize: value, scale: 1 };
                if (nextBoxWidth !== undefined) next.boxWidth = nextBoxWidth;
                return next;
              });
            }
            return value;
          },

          removeElement: (id) => {
            setDoc((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== id) }));
            set((s) => ({ ...selection(s.selectedIds.filter((i) => i !== id)), editingId: null }));
          },

          duplicateElement: (id) => {
            const el = findEl(id);
            if (!el) return;
            if (el.kind === 'logo') {
              get().showToast('info', 'Só cabe uma logo por post 😉');
              return;
            }
            if (el.kind === 'image' && !hasImageSlots(get().doc.elements)) {
              get().showToast('error', 'Tá lotado! Cabem até 5 imagens por post 😅');
              return;
            }
            const copy: El = { ...el, id: uid(), ...freeCenter(get().doc.elements, el.x + 32, el.y + 32) };
            setDoc((d) => {
              const i = d.elements.findIndex((e) => e.id === id);
              const elements = [...d.elements];
              elements.splice(i + 1, 0, copy);
              return { ...d, elements };
            });
            set(selection([copy.id]));
          },

          bringForward: (id) =>
            setDoc((d) => {
              const i = d.elements.findIndex((e) => e.id === id);
              if (i < 0 || i === d.elements.length - 1) return d;
              const elements = [...d.elements];
              [elements[i], elements[i + 1]] = [elements[i + 1], elements[i]];
              return { ...d, elements };
            }),

          sendBackward: (id) =>
            setDoc((d) => {
              const i = d.elements.findIndex((e) => e.id === id);
              if (i <= 0) return d;
              const elements = [...d.elements];
              [elements[i], elements[i - 1]] = [elements[i - 1], elements[i]];
              return { ...d, elements };
            }),

          applyPatches: (patches) => {
            if (patches.length === 0) return;
            setDoc((d) => ({ ...d, elements: applyElPatches(d.elements, patches) }));
          },

          removeElements: (ids) => {
            if (ids.length === 0) return;
            const gone = new Set(ids);
            setDoc((d) => ({ ...d, elements: d.elements.filter((e) => !gone.has(e.id)) }));
            set((s) => ({ ...selection(s.selectedIds.filter((i) => !gone.has(i))), editingId: null }));
          },

          duplicateElements: (ids) => {
            const r = duplicateGroup(get().doc.elements, ids, uid);
            if (r.blocked === 'noImageSlots') {
              get().showToast('error', 'Tá lotado! Cabem até 5 imagens por post 😅');
              return;
            }
            if (r.blocked === 'onlyLogo') {
              get().showToast('info', 'Só cabe uma logo por post 😉');
              return;
            }
            if (r.copyIds.length === 0) return;
            setDoc((d) => ({ ...d, elements: r.elements }));
            const only = r.copyIds.length === 1 ? r.elements.find((e) => e.id === r.copyIds[0]) : undefined;
            set(only ? { ...selection(r.copyIds), step: STEP_OF_KIND[only.kind] } : selection(r.copyIds));
            if (r.skippedLogo) get().showToast('info', 'A logo ficou de fora: só cabe uma por post 😉');
          },

          bringForwardMany: (ids) =>
            setDoc((d) => {
              const elements = reorderForward(d.elements, ids);
              return elements.every((e, i) => e === d.elements[i]) ? d : { ...d, elements };
            }),

          sendBackwardMany: (ids) =>
            setDoc((d) => {
              const elements = reorderBackward(d.elements, ids);
              return elements.every((e, i) => e === d.elements[i]) ? d : { ...d, elements };
            }),

          reset: () => set({ doc: emptyDoc(), finish: defaultFinish(), ...selection([]), editingId: null, step: 0 }),
        };
    },
    {
      limit: 50,
      partialize: (s) => ({ doc: s.doc, finish: s.finish }),
      equality: (a, b) => a.doc === b.doc && a.finish === b.finish,
      // Agrupa mudanças contínuas (ex.: arrastar um slider) em um único passo de desfazer.
      handleSet: (handleSet) => {
        let last = 0;
        return ((...args: Parameters<typeof handleSet>) => {
          const now = Date.now();
          if (now - last > 400) handleSet(...args);
          last = now;
        }) as typeof handleSet;
      },
    },
  ),
);

// Undo/redo (ou qualquer troca de doc) pode remover elementos selecionados: poda os ids fantasmas.
useEditor.subscribe((s, prev) => {
  if (s.doc === prev.doc) return;
  const pruned = pruneIds(s.selectedIds, s.doc.elements);
  if (pruned.length !== s.selectedIds.length) useEditor.setState(selection(pruned));
});

/**
 * Carrega documento e acabamento no editor, zerando passo, seleção e histórico
 * de Undo/Redo. Usado ao abrir, criar ou trocar slides de rascunho.
 */
export function resetEditorFor(doc: Doc, finish: FinishState): void {
  useEditor.setState({
    doc,
    finish,
    step: 0,
    ...selection([]),
    editingId: null,
  });
  useEditor.temporal.getState().clear();
}

export const useSelected = () => useEditor((s) => s.doc.elements.find((e) => e.id === s.selectedId) ?? null);
/** Elementos selecionados, na ordem das camadas (referência estável enquanto doc/seleção não mudam). */
export const useSelectedElements = () => {
  const elements = useEditor((s) => s.doc.elements);
  const ids = useEditor((s) => s.selectedIds);
  return useMemo(() => elements.filter((e) => ids.includes(e.id)), [elements, ids]);
};
export const undo = () => useEditor.temporal.getState().undo();
export const redo = () => useEditor.temporal.getState().redo();

// Exposto intencionalmente em produção (dist/): a suíte E2E (Playwright sobre
// `vite preview`) inspeciona e prepara o estado do editor via `page.evaluate`.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__useEditor = useEditor;
}
