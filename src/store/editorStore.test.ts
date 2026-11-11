import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLogo, manifest } from '../assets';
import type { El, LogoEl } from '../types';
import { effectiveLogoMargin, redo, undo, useEditor } from './editorStore';

const base = { x: 100, y: 100, rotation: 0, scale: 1 };
const deco = (id: string): El => ({ ...base, id, kind: 'decoration', assetId: 'a', flipX: false, flipY: false });
const logo = (id: string): El => ({ ...base, id, kind: 'logo', variant: 'paper' });
const text = (id: string): El => ({
  ...base,
  id,
  kind: 'text',
  style: 'title',
  text: id,
  fontSize: 80,
  lineHeight: 1,
  letterSpacing: 0,
  align: 'center',
  uppercase: false,
  color: 'preto',
  brandEffect: false,
  border: 'none',
});
const ids = () => useEditor.getState().doc.elements.map((e) => e.id);
const setDoc = (elements: El[]) => useEditor.setState({ doc: { backgroundId: null, elements } });

/** O store agrupa sets a menos de 400 ms num só passo de undo (handleSet); simula o usuário "parado". */
const idle = () => vi.setSystemTime(Date.now() + 1000);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  useEditor.getState().reset();
  useEditor.setState({ toast: null });
  useEditor.temporal.getState().clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('seleção múltipla no store', () => {
  it('selectedId é derivado: só existe com exatamente 1 selecionado', () => {
    setDoc([deco('a'), deco('b'), deco('c')]);
    const s = useEditor.getState();
    s.select('a');
    expect(useEditor.getState().selectedId).toBe('a');
    useEditor.getState().toggleSelect('b');
    expect(useEditor.getState().selectedIds).toEqual(['a', 'b']);
    expect(useEditor.getState().selectedId).toBeNull();
    useEditor.getState().toggleSelect('a');
    expect(useEditor.getState().selectedIds).toEqual(['b']);
    expect(useEditor.getState().selectedId).toBe('b');
  });

  it('select simples substitui a multi-seleção; select(null) limpa tudo', () => {
    setDoc([deco('a'), deco('b')]);
    useEditor.getState().selectMany(['a', 'b']);
    useEditor.getState().select('b');
    expect(useEditor.getState().selectedIds).toEqual(['b']);
    useEditor.getState().selectMany(['a', 'b']);
    useEditor.getState().select(null);
    expect(useEditor.getState().selectedIds).toEqual([]);
    expect(useEditor.getState().selectedId).toBeNull();
  });

  it('ignora ids inexistentes (toggle e selectMany)', () => {
    setDoc([deco('a')]);
    useEditor.getState().toggleSelect('fantasma');
    expect(useEditor.getState().selectedIds).toEqual([]);
    useEditor.getState().selectMany(['a', 'fantasma']);
    expect(useEditor.getState().selectedIds).toEqual(['a']);
  });

  it('toggle com 2+ NÃO troca o passo; ao restar 1 acompanha o tipo dele', () => {
    setDoc([deco('d'), text('t')]);
    useEditor.getState().select('d'); // passo 1 (enfeites)
    expect(useEditor.getState().step).toBe(1);
    useEditor.getState().toggleSelect('t');
    expect(useEditor.getState().step).toBe(1); // 2 selecionados: mantém
    useEditor.getState().toggleSelect('d');
    expect(useEditor.getState().selectedId).toBe('t');
    expect(useEditor.getState().step).toBe(3); // restou texto
  });

  it('trocar de passo limpa a multi-seleção', () => {
    setDoc([deco('a'), deco('b')]);
    useEditor.getState().selectMany(['a', 'b']);
    useEditor.getState().setStep(1);
    expect(useEditor.getState().selectedIds).toEqual([]);
  });

  it('trocar para o passo do elemento selecionado (único) mantém a seleção', () => {
    setDoc([deco('a')]);
    useEditor.getState().select('a');
    useEditor.getState().setStep(1);
    expect(useEditor.getState().selectedId).toBe('a');
  });

  it('undo/redo poda ids que deixaram de existir', () => {
    setDoc([]);
    useEditor.temporal.getState().clear();
    idle();
    setDoc([deco('a'), deco('b')]);
    useEditor.getState().selectMany(['a', 'b']);
    idle();
    undo(); // volta ao doc vazio
    expect(ids()).toEqual([]);
    expect(useEditor.getState().selectedIds).toEqual([]);
    expect(useEditor.getState().selectedId).toBeNull();
    idle();
    redo();
    expect(ids()).toEqual(['a', 'b']);
  });

  it('seleção não entra no histórico de undo', () => {
    setDoc([deco('a'), deco('b')]);
    useEditor.temporal.getState().clear();
    useEditor.getState().selectMany(['a', 'b']);
    useEditor.getState().toggleSelect('a');
    expect(useEditor.temporal.getState().pastStates).toHaveLength(0);
  });
});

describe('ações em lote', () => {
  it('applyPatches faz UM set do doc e um único passo de undo', () => {
    setDoc([deco('a'), deco('b'), deco('c')]);
    useEditor.temporal.getState().clear();
    idle();
    let docChanges = 0;
    const unsub = useEditor.subscribe((s, p) => {
      if (s.doc !== p.doc) docChanges++;
    });
    useEditor.getState().applyPatches([
      { id: 'a', patch: { x: 1 } },
      { id: 'b', patch: { x: 2 } },
    ]);
    unsub();
    const els = useEditor.getState().doc.elements;
    expect([els[0].x, els[1].x, els[2].x]).toEqual([1, 2, 100]);
    expect(docChanges).toBe(1);
    expect(useEditor.temporal.getState().pastStates).toHaveLength(1);
    undo();
    expect(useEditor.getState().doc.elements[0].x).toBe(100);
    expect(useEditor.getState().doc.elements[1].x).toBe(100);
  });

  it('applyPatches vazio não mexe no doc', () => {
    setDoc([deco('a')]);
    const before = useEditor.getState().doc;
    useEditor.getState().applyPatches([]);
    expect(useEditor.getState().doc).toBe(before);
  });

  it('removeElements apaga o conjunto e limpa a seleção dele', () => {
    setDoc([deco('a'), deco('b'), deco('c')]);
    useEditor.getState().selectMany(['a', 'b', 'c']);
    useEditor.getState().removeElements(['a', 'b']);
    expect(ids()).toEqual(['c']);
    expect(useEditor.getState().selectedIds).toEqual(['c']);
    expect(useEditor.getState().selectedId).toBe('c');
  });

  it('duplicateElements cria cópias e as seleciona', () => {
    setDoc([deco('a'), deco('b')]);
    useEditor.getState().selectMany(['a', 'b']);
    useEditor.getState().duplicateElements(['a', 'b']);
    const s = useEditor.getState();
    expect(s.doc.elements).toHaveLength(4);
    expect(s.selectedIds).toHaveLength(2);
    expect(s.selectedIds.every((id) => !['a', 'b'].includes(id))).toBe(true);
    expect(s.selectedId).toBeNull();
  });

  it('duplicateElements: só logo avisa e não altera o doc', () => {
    setDoc([logo('l')]);
    const before = useEditor.getState().doc;
    useEditor.getState().duplicateElements(['l']);
    expect(useEditor.getState().doc).toBe(before);
    expect(useEditor.getState().toast?.kind).toBe('info');
  });

  it('duplicateElements: logo + enfeite copia só o enfeite e avisa da logo', () => {
    setDoc([deco('a'), logo('l')]);
    useEditor.getState().duplicateElements(['a', 'l']);
    const els = useEditor.getState().doc.elements;
    expect(els.filter((e) => e.kind === 'logo')).toHaveLength(1);
    expect(els).toHaveLength(3);
    expect(useEditor.getState().selectedIds).toHaveLength(1);
    expect(useEditor.getState().toast?.kind).toBe('info');
  });

  it('camadas em lote: sobe e desce o bloco; sem efeito não polui o undo', () => {
    setDoc([deco('a'), deco('b'), deco('c'), deco('d')]);
    useEditor.temporal.getState().clear();
    useEditor.getState().bringForwardMany(['b', 'c']);
    expect(ids()).toEqual(['a', 'd', 'b', 'c']);
    useEditor.temporal.getState().clear();
    useEditor.getState().bringForwardMany(['b', 'c']); // já no topo: nada muda
    expect(ids()).toEqual(['a', 'd', 'b', 'c']);
    expect(useEditor.temporal.getState().pastStates).toHaveLength(0);
    useEditor.getState().sendBackwardMany(['b', 'c']);
    expect(ids()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('removeElement (único) continua tirando o item da seleção múltipla', () => {
    setDoc([deco('a'), deco('b'), deco('c')]);
    useEditor.getState().selectMany(['a', 'b', 'c']);
    useEditor.getState().removeElement('b');
    expect(useEditor.getState().selectedIds).toEqual(['a', 'c']);
  });
});

describe('formatos de post e corte de fundo', () => {
  it('inicializa com formato 3:4 e backgroundOffsetY = 180', () => {
    const doc = useEditor.getState().doc;
    expect(doc.format).toBe('3:4');
    expect(doc.backgroundOffsetY).toBe(180);
  });

  it('setFormat altera o formato e entra no undo', () => {
    idle();
    useEditor.getState().setFormat('4:3');
    expect(useEditor.getState().doc.format).toBe('4:3');

    idle();
    useEditor.getState().setFormat('1:1');
    expect(useEditor.getState().doc.format).toBe('1:1');

    undo();
    expect(useEditor.getState().doc.format).toBe('4:3');

    redo();
    expect(useEditor.getState().doc.format).toBe('1:1');
  });

  it('setBackgroundOffsetY altera e trava entre 0 e 360', () => {
    useEditor.getState().setBackgroundOffsetY(200);
    expect(useEditor.getState().doc.backgroundOffsetY).toBe(200);

    useEditor.getState().setBackgroundOffsetY(-50);
    expect(useEditor.getState().doc.backgroundOffsetY).toBe(0);

    useEditor.getState().setBackgroundOffsetY(450);
    expect(useEditor.getState().doc.backgroundOffsetY).toBe(360);
  });
});

describe('acabamentos (etapa 6 — Textura)', () => {
  it('enableAllFinishes liga os três acabamentos em um único passo de undo e preserva ajustes', () => {
    useEditor.getState().setPaper({ opacity: 65, enabled: false });
    idle();
    useEditor.getState().setBorderTexture({ opacity: 25, enabled: false });
    idle();
    useEditor.getState().setGrain({ intensity: 70, size: 'G', enabled: false });
    useEditor.temporal.getState().clear();
    idle();

    useEditor.getState().enableAllFinishes();
    const after = useEditor.getState().finish;
    expect(after.paper).toEqual({ enabled: true, opacity: 65 });
    expect(after.borderTexture).toEqual({ enabled: true, opacity: 25 });
    expect(after.grain).toEqual({ enabled: true, intensity: 70, size: 'G' });
    expect(useEditor.temporal.getState().pastStates).toHaveLength(1);

    // Chamar de novo com os três já ligados é no-op e não polui o undo
    idle();
    useEditor.getState().enableAllFinishes();
    expect(useEditor.temporal.getState().pastStates).toHaveLength(1);

    // Um único Ctrl+Z desfaz os três de uma vez
    undo();
    const undone = useEditor.getState().finish;
    expect(undone.paper.enabled).toBe(false);
    expect(undone.borderTexture.enabled).toBe(false);
    expect(undone.grain.enabled).toBe(false);
  });
});

describe('manifest.decorations — convenção de nomes (#6)', () => {
  it('mantém os 12 ids imutáveis e aplica labels padronizados sem CAIXA ALTA nem sufixo numérico', () => {
    const ids = manifest.decorations.map((d) => d.id);
    expect(ids).toEqual([
      'flores',
      'folhas-1',
      'folhas-2',
      'ondas-1',
      'ondas-2',
      'grade',
      'sobrepor',
      'chain',
      'esqueleto',
      'mp3player',
      'papel-divisao',
      'janela',
    ]);

    for (const deco of manifest.decorations) {
      expect(deco.label.length).toBeGreaterThan(0);
      expect(deco.label.length).toBeLessThanOrEqual(24);
      // Nenhum label todo em maiúsculas
      expect(deco.label).not.toBe(deco.label.toUpperCase());
      // Nenhum label terminando em dígito isolado ("Folhas 1", "Ondas 2")
      expect(deco.label).not.toMatch(/\s\d+$/);
    }
  });
});

describe('presets de posição da Logo e margem das guias', () => {
  it('segue a margem configurada nas guias (32, 56, 80, 100) e cola no canto (0) quando desativada', () => {
    useEditor.getState().addLogo('paper');
    const getLogoEl = () =>
      useEditor.getState().doc.elements.find((e): e is LogoEl => e.kind === 'logo')!;

    const asset = getLogo('paper');
    const w = asset.width * getLogoEl().scale;
    const h = asset.height * getLogoEl().scale;

    // Padrão: guias visíveis com margem 56
    useEditor.getState().placeLogo('tl');
    expect(getLogoEl().x).toBeCloseTo(56 + w / 2, 2);
    expect(getLogoEl().y).toBeCloseTo(56 + h / 2, 2);

    // Altera margem para 100
    useEditor.getState().setGuideMargin(100);
    useEditor.getState().placeLogo('tl');
    expect(getLogoEl().x).toBeCloseTo(100 + w / 2, 2);
    expect(getLogoEl().y).toBeCloseTo(100 + h / 2, 2);

    useEditor.getState().placeLogo('br');
    expect(getLogoEl().x).toBeCloseTo(1080 - 100 - w / 2, 2);
    expect(getLogoEl().y).toBeCloseTo(1440 - 100 - h / 2, 2);

    // Desativa sub-opção "Guia de margens" → margem efetiva 0 (cola no canto)
    useEditor.getState().setGuideLayer({ showMargins: false });
    expect(effectiveLogoMargin(useEditor.getState().layoutGuides)).toBe(0);
    useEditor.getState().placeLogo('tl');
    expect(getLogoEl().x).toBeCloseTo(w / 2, 2);
    expect(getLogoEl().y).toBeCloseTo(h / 2, 2);

    // Reativa showMargins mas esconde as guias gerais (G) → também cola no canto (0)
    useEditor.getState().setGuideLayer({ showMargins: true });
    useEditor.getState().setGuidesVisible(false);
    expect(effectiveLogoMargin(useEditor.getState().layoutGuides)).toBe(0);
    useEditor.getState().placeLogo('tr');
    expect(getLogoEl().x).toBeCloseTo(1080 - w / 2, 2);
    expect(getLogoEl().y).toBeCloseTo(h / 2, 2);
  });
});
