import { expect, test, type Page } from '@playwright/test';
import { chooseMode, createSingle, goHome, openCarousel, openSingle, pickCarousel, waitForHome } from './helpers';

interface TextSnapshot {
  id: string;
  boxWidth?: number;
  fontSize: number;
  text: string;
}

/** Elemento de texto do doc (fonte de verdade, sem depender de pixel). */
async function readText(page: Page): Promise<TextSnapshot> {
  return page.evaluate(() => {
    const state = (window as unknown as { __useEditor?: { getState: () => { doc: { elements: unknown[] } } } })
      .__useEditor!.getState();
    const el = state.doc.elements.find(
      (e) => (e as { kind?: string }).kind === 'text',
    ) as TextSnapshot;
    return {
      id: el.id,
      boxWidth: el.boxWidth,
      fontSize: el.fontSize,
      text: el.text,
    };
  });
}

/** Centro do elemento na tela, a partir do nó Konva do palco principal. */
async function textScreenCenter(page: Page, id: string): Promise<{ x: number; y: number }> {
  return page.evaluate((eid) => {
    const Konva = (window as unknown as { Konva: { stages: any[] } }).Konva;
    const stage = Konva.stages[0];
    const node = stage.findOne(`#${eid}`);
    const layer = stage.findOne('Layer');
    const box = node.getClientRect({ relativeTo: layer });
    const sheet = document.querySelector('[class*=sheetClip]')!.getBoundingClientRect();
    const k = sheet.width / 1080;
    return {
      x: sheet.left + (box.x + box.width / 2) * k,
      y: sheet.top + (box.y + box.height / 2) * k,
    };
  }, id);
}

test.describe('Regressões da leva P0', () => {
  test('recarregar após criar e converter para carrossel não quebra a home', async ({ page }) => {
    await page.goto('/');
    await waitForHome(page);

    await createSingle(page);
    await expect(page.getByRole('heading', { name: /1\. Escolha o fundo/ })).toBeVisible();
    await page.locator('button[title*="Pronto 1"]').first().click();

    await page.getByTestId('mode-dropdown-trigger').click();
    await page.getByRole('option', { name: /Carrossel/ }).click();
    await page
      .getByRole('dialog')
      .filter({ hasText: 'Trocar pra Carrossel?' })
      .getByRole('button', { name: 'Trocar!' })
      .click();
    await expect(page.getByRole('navigation', { name: 'Tira de slides do carrossel' })).toBeVisible();

    // O autosave é debounced (450ms): esperar o "Salvo" reproduz o cenário real
    // do relato e garante que o rascunho já virou carrossel antes do reload.
    await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 5000 });

    // O defeito original: reload dentro do editor deixava a home coberta pelo
    // placeholder absoluto, com textos e cards escondidos.
    await page.reload();
    await waitForHome(page);

    await expect(page.getByRole('heading', { name: 'Meus rascunhos' })).toBeVisible();
    const helpBtn = page.getByRole('button', { name: 'Sobre Meus rascunhos' });
    await expect(helpBtn).toBeVisible();
    await helpBtn.click();
    await expect(
      page.getByText('Cada post fica salvo neste navegador.', { exact: false }),
    ).toBeVisible();
    await expect(page.locator('article h3').first()).toBeVisible();

    // Nenhum placeholder pode escapar para o viewport (largura ~1440/375).
    const placeholders = page.locator('[class*="coverPlaceholder"]');
    const total = await placeholders.count();
    for (let i = 0; i < total; i += 1) {
      const box = await placeholders.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThan(400);
      expect(box!.height).toBeLessThan(400);
    }
  });

  test('tira de slides nasce no primeiro frame e nunca fica travada', async ({ page }) => {
    await openCarousel(page);

    const tray = page.getByRole('navigation', { name: 'Tira de slides do carrossel' });
    await expect(tray).toBeVisible();

    // A hidratação pode terminar antes da primeira leitura (debounce ~400ms).
    // O contrato é: aparece imediato, libera os botões e não desloca a folha.
    const canvas = page.locator('[class*="canvasArea"]').first();
    const heightAtStart = (await canvas.boundingBox())!.height;

    await expect(tray).toHaveAttribute('aria-busy', 'false', { timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Novo slide vazio' }).first()).toBeEnabled();
    await expect(page.getByText('Preparando as miniaturas...')).toHaveCount(0);

    const heightAtEnd = (await canvas.boundingBox())!.height;
    expect(Math.abs(heightAtEnd - heightAtStart)).toBeLessThan(2);
  });

  test('formato do post só aparece no post único', async ({ page }) => {
    await openCarousel(page);
    await expect(page.getByRole('heading', { name: 'Formato do post' })).toHaveCount(0);

    // A explicação da etapa vive no balão do (?), não como texto fixo.
    const help = page.getByRole('button', { name: 'Sobre esta etapa' });
    const tip = page.getByText('O formato foi definido na criação do carrossel.', { exact: false });
    await expect(help).toBeVisible();
    await expect(tip).toBeHidden();
    await help.focus();
    await expect(tip).toBeVisible();

    await openSingle(page);
    await expect(page.getByRole('heading', { name: 'Formato do post' })).toBeVisible();
  });

  test('Leva 2 (#1 e #2): balão (?) de Meus rascunhos e botões do header dinâmicos', async ({ page }) => {
    await page.goto('/');
    await waitForHome(page);

    const tipText = page.getByText('Cada post fica salvo neste navegador.', { exact: false });
    const helpBtn = page.getByRole('button', { name: 'Sobre Meus rascunhos' });

    // Descrição não fica permanentemente visível até acionar o (?)
    await expect(tipText).toBeHidden();

    // Abre por foco e fecha por Escape
    await helpBtn.focus();
    await expect(tipText).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tipText).toBeHidden();

    // Abre por clique e fecha por clique fora
    await helpBtn.click();
    await expect(tipText).toBeVisible();
    await page.getByRole('heading', { name: /Cuscuz Records Insta Kit/ }).click();
    await expect(tipText).toBeHidden();

    // Com rascunho salvo, o gatilho aparece ao lado do "Continuar"; ao excluir o último, volta para o quadro
    await createSingle(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await goHome(page);

    await expect(page.getByTestId('create-draft-trigger')).toBeVisible();

    await page.locator('article').getByRole('button', { name: 'Excluir rascunho' }).click();
    await page
      .getByRole('dialog')
      .filter({ hasText: 'Excluir este rascunho?' })
      .getByRole('button', { name: 'Sim, excluir' })
      .click();

    await expect(page.getByText('Nenhum rascunho por aqui ainda')).toBeVisible();
    await expect(page.getByTestId('create-draft-trigger')).toBeVisible();
  });

  test('Leva 2 (#3 e #8): espelhamento do fundo no dock com undo e scrollbar temática', async ({ page }) => {
    await openSingle(page);

    const scrollbarStyle = await page
      .locator('[class*="stepContent"] > div')
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { gutter: s.scrollbarGutter };
      });
    expect(scrollbarStyle.gutter).toContain('stable');

    // Sem fundo selecionado, o espelhamento do fundo não aparece no dock
    await expect(page.getByRole('button', { name: 'Espelhar fundo ↔' })).toHaveCount(0);

    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.waitForTimeout(450);
    const flipXBtn = page.getByRole('button', { name: 'Espelhar fundo ↔' });
    await expect(flipXBtn).toBeVisible();
    await flipXBtn.click();

    const flipped = await page.evaluate(() => {
      const w = window as unknown as { __useEditor?: { getState: () => { doc: { backgroundFlipX: boolean } } } };
      return w.__useEditor?.getState().doc.backgroundFlipX;
    });
    expect(flipped).toBe(true);

    await page.getByRole('button', { name: 'Desfazer (Ctrl+Z)' }).click();
    const afterUndo = await page.evaluate(() => {
      const w = window as unknown as { __useEditor?: { getState: () => { doc: { backgroundFlipX: boolean } } } };
      return w.__useEditor?.getState().doc.backgroundFlipX;
    });
    expect(afterUndo).toBe(false);
  });

  test('Leva 2 (#9): renomear projeto inline no Header persiste na home e no reload', async ({ page }) => {
    await openSingle(page);
    await page.locator('button[title*="Pronto 1"]').first().click();

    const headerTitle = page.locator('header h1');
    await headerTitle.click();

    const input = page.getByRole('textbox', { name: 'Nome do projeto' });
    await expect(input).toBeVisible();

    // Escape cancela a edição sem salvar
    await input.fill('Nome descartado');
    await input.press('Escape');
    await expect(headerTitle).not.toHaveText('Nome descartado');

    // Enter confirma e persiste
    await headerTitle.click();
    await input.fill('Show de São João');
    await input.press('Enter');
    await expect(headerTitle).toHaveText('Show de São João');

    await goHome(page);
    await expect(page.locator('article').filter({ hasText: 'Show de São João' })).toHaveCount(1);

    await page.reload();
    await waitForHome(page);
    await expect(page.locator('article').filter({ hasText: 'Show de São João' })).toHaveCount(1);
  });

  test('Textura: cartões compactos com checkbox, prévia sob hover e Ativar/Desativar todas com undo único', async ({ page }) => {
    await openSingle(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.getByRole('button', { name: /6\. Textura/ }).click();

    const paperCb = page.getByRole('checkbox', { name: 'Papel amassado' });
    const borderCb = page.getByRole('checkbox', { name: 'Craquelado' });
    const grainCb = page.getByRole('checkbox', { name: 'Granulado' });

    // Sem botões Ligado/Desligado nem texto explicativo; prévias fechadas
    await expect(page.locator('button:has-text("(Desligado)")')).toHaveCount(0);
    await expect(page.getByText('Opcional 🌽')).toHaveCount(0);
    await expect(page.getByAltText('Prévia do papel amassado')).toHaveCount(0);
    await expect(paperCb).not.toBeChecked();

    // Clicar no cartão inteiro (no nome) liga/desliga; no slider, não
    await page.getByRole('heading', { name: 'Papel amassado' }).click();
    await expect(paperCb).toBeChecked();
    await page.getByRole('heading', { name: 'Papel amassado' }).click();
    await expect(paperCb).not.toBeChecked();

    // "Prévia da textura" só se revela no hover do cartão e abre a imagem
    const previewBtn = page.getByRole('button', { name: 'Prévia da textura' }).first();
    const touchOnly = await page.evaluate(() => window.matchMedia('(hover: none)').matches);
    await page.mouse.move(0, 0);
    if (!touchOnly) {
      await expect(previewBtn).toHaveCSS('opacity', '0');
      await page.getByRole('heading', { name: 'Papel amassado' }).hover();
    }
    await expect(previewBtn).toHaveCSS('opacity', '1');
    await previewBtn.click();
    await expect(page.getByAltText('Prévia do papel amassado')).toBeVisible();
    // Abrir a prévia não liga o papel
    await expect(paperCb).not.toBeChecked();

    // No post único não existe "Aplicar em todos os slides"
    await expect(page.getByRole('button', { name: /Aplicar em todos os slides/ })).toHaveCount(0);

    // Ativar todas as texturas liga os três de uma vez e vira "Desativar todas as texturas"
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: 'Ativar todas as texturas' }).click();
    await expect(paperCb).toBeChecked();
    await expect(borderCb).toBeChecked();
    await expect(grainCb).toBeChecked();
    const disableAllBtn = page.getByRole('button', { name: 'Desativar todas as texturas' });
    await expect(disableAllBtn).toBeVisible();

    // Desativar todas as texturas desliga os três; um único Ctrl+Z religa os três
    await page.waitForTimeout(450);
    await disableAllBtn.click();
    await expect(paperCb).not.toBeChecked();
    await expect(borderCb).not.toBeChecked();
    await expect(grainCb).not.toBeChecked();
    await page.getByRole('button', { name: 'Desfazer (Ctrl+Z)' }).click();
    await expect(paperCb).toBeChecked();
    await expect(borderCb).toBeChecked();
    await expect(grainCb).toBeChecked();

    // "Restaurar padrão" saiu da aba: "Desativar todas as texturas" é o caminho único para
    // desligar os três de uma vez e continua funcionando depois de um undo.
    await expect(page.getByRole('button', { name: /Restaurar padrão/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Desativar todas as texturas' }).click();
    await expect(paperCb).not.toBeChecked();
    await expect(borderCb).not.toBeChecked();
    await expect(grainCb).not.toBeChecked();
  });

  test('Textura no carrossel: Aplicar em todos os slides ao lado de Ativar/Desativar todas as texturas', async ({
    page,
  }) => {
    await openCarousel(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.getByRole('button', { name: 'Novo slide vazio' }).first().click();
    await page.getByRole('button', { name: /^Slide 1/ }).click();
    await page.getByRole('button', { name: /6\. Textura/ }).click();

    const activateAllBtn = page.getByRole('button', { name: 'Ativar todas as texturas' });
    const applyAllBtn = page.getByRole('button', { name: /Aplicar em todos os slides/ });
    await expect(activateAllBtn).toBeVisible();
    await expect(applyAllBtn).toBeVisible();
    await expect(applyAllBtn).toHaveAttribute('aria-pressed', 'true');

    // Botões lado a lado e sem overflow horizontal no painel
    const aBox = await activateAllBtn.boundingBox();
    const bBox = await applyAllBtn.boundingBox();
    expect(aBox && bBox).toBeTruthy();
    expect(Math.abs(bBox!.y - aBox!.y)).toBeLessThan(3);
    expect(bBox!.x).toBeGreaterThan(aBox!.x);

    const hasHorizOverflow = await page
      .locator('[class*="stepContent"] > div')
      .first()
      .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(hasHorizOverflow).toBe(false);

    // Com "Aplicar em todos os slides" ativo por padrão, ativar texturas propaga para todos os slides
    await page.waitForTimeout(450);
    await activateAllBtn.click();
    await expect(page.getByRole('button', { name: 'Desativar todas as texturas' })).toBeVisible();

    const readSlideFinishes = () =>
      page.evaluate(() => {
        const c = (
          window as unknown as {
            __useCarousel: {
              getState: () => {
                applyFinishToAll: boolean;
                slides: Array<{
                  finish: {
                    paper: { enabled: boolean };
                    borderTexture: { enabled: boolean };
                    grain: { enabled: boolean };
                  };
                }>;
              };
            };
          }
        ).__useCarousel.getState();
        return {
          applyFinishToAll: c.applyFinishToAll,
          slides: c.slides.map((s) => ({
            paper: s.finish.paper.enabled,
            border: s.finish.borderTexture.enabled,
            grain: s.finish.grain.enabled,
          })),
        };
      });

    expect(await readSlideFinishes()).toEqual({
      applyFinishToAll: true,
      slides: [
        { paper: true, border: true, grain: true },
        { paper: true, border: true, grain: true },
      ],
    });

    // Desativa "Aplicar em todos os slides":
    // ambos os slides mantêm as texturas atuais; a próxima edição passa a ser individual.
    await applyAllBtn.click();
    await expect(applyAllBtn).toHaveAttribute('aria-pressed', 'false');

    expect(await readSlideFinishes()).toEqual({
      applyFinishToAll: false,
      slides: [
        { paper: true, border: true, grain: true },
        { paper: true, border: true, grain: true },
      ],
    });

    // Troca para o slide 2 e desativa as texturas só do slide 2: o slide 1 continua com as texturas
    await page.getByRole('button', { name: /^Slide 2/ }).click();
    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.getByRole('button', { name: /6\. Textura/ }).click();
    await expect(page.getByRole('checkbox', { name: 'Papel amassado' })).toBeChecked();
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: 'Desativar todas as texturas' }).click();
    await expect(page.getByRole('checkbox', { name: 'Papel amassado' })).not.toBeChecked();

    expect(await readSlideFinishes()).toEqual({
      applyFinishToAll: false,
      slides: [
        { paper: true, border: true, grain: true },
        { paper: false, border: false, grain: false },
      ],
    });

    // Reativa "Aplicar em todos os slides": propaga o finish do slide ativo (slide 2)
    // para todos os slides
    await applyAllBtn.click();
    await expect(applyAllBtn).toHaveAttribute('aria-pressed', 'true');
    expect(await readSlideFinishes()).toEqual({
      applyFinishToAll: true,
      slides: [
        { paper: false, border: false, grain: false },
        { paper: false, border: false, grain: false },
      ],
    });
  });
  test('Presets de logo seguem margem das guias (ou 0 quando desativada) e novo layout de Header/Dock', async ({
    page,
  }) => {
    await openSingle(page);
    await page.locator('button[title*="Pronto 1"]').first().click();

    // Header não tem mais "Começar do zero", tem botão "Exportar" e Undo/Redo estão no dock lateral
    await expect(page.getByRole('button', { name: 'Começar do zero' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toBeVisible();
    const dock = page.getByRole('complementary', { name: 'Ferramentas da folha' });
    await expect(dock.getByRole('button', { name: 'Desfazer (Ctrl+Z)' })).toBeVisible();
    await expect(dock.getByRole('button', { name: 'Refazer (Ctrl+Shift+Z)' })).toBeVisible();

    // Vai para 5. Logo e adiciona logo
    await page.getByRole('button', { name: /5\. Logo/ }).click();
    await page.getByRole('button', { name: 'Adicionar Logo com Papel' }).click();

    // No dock desktop, a base de Cópia e Exclusão alinha com a base de Alinhamento
    const isDesktop = await page.evaluate(() => window.innerWidth > 640);
    if (isDesktop) {
      const alignBottomBtn = dock.getByRole('button', { name: 'Alinhar à base da página' });
      const trashBtn = dock.getByRole('button', { name: 'Excluir (Delete)' });
      const bAlign = await alignBottomBtn.boundingBox();
      const bTrash = await trashBtn.boundingBox();
      expect(bAlign && bTrash).toBeTruthy();
      const bottomAlign = bAlign!.y + bAlign!.height;
      const bottomTrash = bTrash!.y + bTrash!.height;
      expect(Math.abs(bottomAlign - bottomTrash)).toBeLessThanOrEqual(2);
    }

    // Posições Rápidas foram removidas e P / M / G ocupam toda a largura distribuídos igualmente
    await expect(page.getByText('Posições Rápidas')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Canto Sup. Esq.' })).toHaveCount(0);
    const sizeP = page.getByRole('button', { name: 'P', exact: true });
    const sizeM = page.getByRole('button', { name: 'M', exact: true });
    const sizeG = page.getByRole('button', { name: 'G', exact: true });
    await expect(sizeP).toBeVisible();
    await expect(sizeM).toBeVisible();
    await expect(sizeG).toBeVisible();
    const boxP = await sizeP.boundingBox();
    const boxM = await sizeM.boundingBox();
    const boxG = await sizeG.boundingBox();
    expect(boxP && boxM && boxG).toBeTruthy();
    expect(Math.abs(boxP!.width - boxM!.width)).toBeLessThan(2);
    expect(Math.abs(boxM!.width - boxG!.width)).toBeLessThan(2);
    expect(boxP!.width).toBeGreaterThan(70);

    // Margem 56 padrão via placeLogo('tl')
    const pos56 = await page.evaluate(() => {
      const w = window as unknown as {
        __useEditor?: {
          getState: () => {
            placeLogo: (pos: 'tl' | 'tr' | 'bl' | 'br' | 'bc' | 'center') => void;
            doc: { elements: Array<{ kind: string; x: number; y: number }> };
          };
        };
      };
      w.__useEditor?.getState().placeLogo('tl');
      const logo = w.__useEditor?.getState().doc.elements.find((e) => e.kind === 'logo');
      return logo ? { x: logo.x, y: logo.y } : null;
    });
    expect(pos56).not.toBeNull();

    // A grade de presets "Margem (px)" saiu do card de guias (Leva 5)
    await expect(dock.getByText('Margem (px)')).toHaveCount(0);

    // Desliga as guias de layout e reposiciona em 'tl' -> cola no canto (margem 0)
    await dock.getByRole('button', { name: /Esconder guias de layout/ }).click();
    const pos0 = await page.evaluate(() => {
      const w = window as unknown as {
        __useEditor?: {
          getState: () => {
            placeLogo: (pos: 'tl' | 'tr' | 'bl' | 'br' | 'bc' | 'center') => void;
            doc: { elements: Array<{ kind: string; x: number; y: number }> };
          };
        };
      };
      w.__useEditor?.getState().placeLogo('tl');
      const logo = w.__useEditor?.getState().doc.elements.find((e) => e.kind === 'logo');
      return logo ? { x: logo.x, y: logo.y } : null;
    });
    expect(pos56!.x - pos0!.x).toBeCloseTo(56, 1);
    expect(pos56!.y - pos0!.y).toBeCloseTo(56, 1);

    // No modo carrossel, o botão vira o dropdown "Exportação" com "Somente este slide" e "Todos os slides"
    await page.getByTestId('mode-dropdown-trigger').click();
    await page.getByRole('option', { name: /Carrossel/ }).click();
    await page
      .getByRole('dialog')
      .filter({ hasText: 'Trocar pra Carrossel?' })
      .getByRole('button', { name: 'Trocar!' })
      .click();

    const exportTrigger = page.getByTestId('export-dropdown-trigger');
    await expect(exportTrigger).toBeVisible();
    await expect(exportTrigger).toContainText('Exportação');
    await exportTrigger.click();
    await expect(page.getByRole('menuitem', { name: /Somente este slide/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Todos os slides/ })).toBeVisible();
  });

  test('Feedback de carregamento só aparece se demorar e some quando o item fica pronto', async ({ page }) => {
    // Atrasa os assets da marca para simular uma espera real.
    await page.route('**/brand/**/*.webp', async (route) => {
      const url = route.request().url();
      if (url.includes('/thumbs/')) return route.continue();
      await new Promise((r) => setTimeout(r, 900));
      await route.continue();
    });
    await page.goto('/');
    await waitForHome(page);
    await createSingle(page);
    await expect(page.getByRole('heading', { name: /1\. Escolha o fundo/ })).toBeVisible();

    const overlay = page.getByTestId('canvas-busy-overlay');

    // Espera longa: o selo aparece (depois do atraso) e some assim que o fundo carrega.
    await page.locator('button[title*="Pronto 2"]').first().click();
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText(/fundo/i);
    await expect(overlay).toBeHidden({ timeout: 10000 });

    // Asset já em cache: trocar para ele de novo não mostra selo nenhum.
    await page.locator('button[title*="Pronto 3"]').first().click();
    await expect(overlay).toBeHidden({ timeout: 10000 });
    await page.locator('button[title*="Pronto 2"]').first().click();
    await page.waitForTimeout(600);
    await expect(overlay).toHaveCount(0);
  });

  test('Feedback de carregamento: enfeite com asset rápido não pisca o selo', async ({ page }) => {
    await page.goto('/');
    await waitForHome(page);
    await createSingle(page);
    await expect(page.getByRole('heading', { name: /1\. Escolha o fundo/ })).toBeVisible();
    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.getByRole('button', { name: /Próximo/ }).click();
    await expect(page.getByRole('heading', { name: /2\./ })).toBeVisible();

    const item = page.locator('button[title*="Arabesco floral"]').first();
    await item.hover();
    await page.waitForTimeout(1500); // preload em hover termina
    await item.click();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('canvas-busy-overlay')).toHaveCount(0);
  });

  test('Leva 4: log "Na folha" seleciona pela caixa toda, lixeira só exclui e ponto substitui a numeração', async ({
    page,
  }) => {
    await openSingle(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.getByRole('button', { name: /Próximo/ }).click();
    await expect(page.getByRole('heading', { name: /2\./ })).toBeVisible();

    await page.locator('button[title*="Arabesco floral"]').first().click();
    await page.locator('button[title*="Folhagem rendada"]').first().click();
    await expect(page.getByRole('button', { name: 'Selecionar Folhagem rendada' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const row = page.getByRole('button', { name: 'Selecionar Arabesco floral' });
    // Ponto de lista no lugar de "1. ...": rótulo limpo + marcador decorativo.
    await expect(row).toHaveText('Arabesco floral');
    await expect(row.locator('[aria-hidden="true"]')).toHaveCount(1);

    // Clique no canto direito da caixa (longe do nome) também seleciona.
    // O locator.click rola a linha para dentro do painel antes de clicar.
    const box = await row.boundingBox();
    expect(box).not.toBeNull();
    await row.click({ position: { x: box!.width - 56, y: box!.height / 2 } });
    await expect(row).toHaveAttribute('aria-pressed', 'true');

    // A lixeira exclui só a sua linha, sem alterar a seleção do outro enfeite.
    const otherRow = page.getByRole('button', { name: 'Selecionar Folhagem rendada' }).locator('..');
    await otherRow.getByRole('button', { name: 'Remover' }).click();
    await expect(page.getByRole('button', { name: 'Selecionar Folhagem rendada' })).toHaveCount(0);
    await expect(row).toHaveAttribute('aria-pressed', 'true');
  });

  test('Passo 4: botões de criação (+ Título / + Texto) e toggles (Tudo maiúsculo / Texto com borda) ficam lado a lado', async ({ page }) => {
    await openSingle(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.getByRole('button', { name: /Próximo/ }).click();
    await expect(page.getByRole('heading', { name: /2\./ })).toBeVisible();
    await page.locator('footer button:has-text("Pular (sem enfeites)")').click();
    await expect(page.getByRole('heading', { name: /3\./ })).toBeVisible();
    await page.locator('footer button:has-text("Pular (sem imagem)")').click();
    await expect(page.getByRole('heading', { name: /4\./ })).toBeVisible();

    const title = page.getByRole('button', { name: '+ Título', exact: true });
    const body = page.getByRole('button', { name: '+ Texto', exact: true });
    await expect(title).toBeVisible();
    await expect(body).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Texto com borda', exact: true })).toHaveCount(0);

    const a = await title.boundingBox();
    const b = await body.boundingBox();
    expect(a && b).toBeTruthy();
    expect(Math.abs(b!.y - a!.y)).toBeLessThan(2);
    expect(b!.x).toBeGreaterThan(a!.x);

    await title.click();
    const uppercaseBtn = page.getByRole('button', { name: /Tudo maiúsculo/i });
    const borderBtn = page.getByRole('button', { name: /Texto com borda/i });
    await expect(uppercaseBtn).toBeVisible();
    await expect(borderBtn).toBeVisible();

    const u = await uppercaseBtn.boundingBox();
    const br = await borderBtn.boundingBox();
    expect(u && br).toBeTruthy();
    expect(Math.abs(br!.y - u!.y)).toBeLessThan(2);
    expect(br!.x).toBeGreaterThan(u!.x);

    // Opções de cor da borda só aparecem quando "Texto com borda" está ativo
    await expect(page.getByText('Cor da borda:')).toHaveCount(0);
    await borderBtn.click();
    await expect(page.getByText('Cor da borda:')).toBeVisible();
    for (const colorName of ['Preto', 'Barro', 'Amarelo', 'Verde Ceará', 'Creme']) {
      await expect(page.getByRole('button', { name: `Cor da borda: ${colorName}` })).toBeVisible();
    }
  });

  test('Leva 4: "Cor do texto" e caixinhas de destaque com a mesma altura das cores', async ({ page }) => {
    await openSingle(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.getByRole('button', { name: /Próximo/ }).click();
    await expect(page.getByRole('heading', { name: /2\./ })).toBeVisible();
    await page.locator('footer button:has-text("Pular (sem enfeites)")').click();
    await expect(page.getByRole('heading', { name: /3\./ })).toBeVisible();
    await page.locator('footer button:has-text("Pular (sem imagem)")').click();
    await expect(page.getByRole('heading', { name: /4\./ })).toBeVisible();
    await page.getByRole('button', { name: '+ Título', exact: true }).click();

    await expect(page.getByText('Cor do texto:')).toBeVisible();
    await expect(page.getByText('Cor da Marca:')).toHaveCount(0);

    const colorBlock = page.getByText('Cor do texto:').locator('..');
    const borderBlock = page.getByText('Caixa de destaque').locator('..');
    const colorBox = await colorBlock.boundingBox();
    const borderBox = await borderBlock.boundingBox();
    expect(colorBox && borderBox).toBeTruthy();
    expect(Math.abs(colorBox!.height - borderBox!.height)).toBeLessThan(2);

    const swatchBox = await colorBlock.getByRole('button').first().boundingBox();
    const segmentBox = await borderBlock.getByRole('button', { name: 'Nenhuma' }).boundingBox();
    expect(swatchBox && segmentBox).toBeTruthy();
    expect(Math.abs(swatchBox!.height - segmentBox!.height)).toBeLessThan(3);
  });

  test('Área de texto: só largura, altura automática, uma única caixa e destaque correto desde a montagem', async ({
    page,
  }) => {
    await openSingle(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.getByRole('button', { name: /Próximo/ }).click();
    await page.locator('footer button:has-text("Pular (sem enfeites)")').click();
    await page.locator('footer button:has-text("Pular (sem imagem)")').click();
    await expect(page.getByRole('heading', { name: /4\./ })).toBeVisible();

    await page.getByRole('button', { name: '+ Título', exact: true }).click();
    await page
      .locator('textarea[placeholder="Digite o texto aqui..."]')
      .fill('SONORIDADE');
    // Caixa de destaque Barro: a tarja deve acompanhar o texto desde já.
    await page
      .getByText('Caixa de destaque')
      .locator('..')
      .getByRole('button', { name: 'Barro', exact: true })
      .click();

    const created = await readText(page);
    // Durante a criação a área ainda é automática.
    expect(created.boxWidth).toBeUndefined();

    // Entrar em edição NÃO pode encolher a caixa (bug do texto cortado).
    await page.mouse.dblclick(...(Object.values(await textScreenCenter(page, created.id)) as [number, number]));
    const handles = page.locator('[data-handle]');
    // Só largura: nada de alça vertical/diagonal.
    await expect(handles).toHaveCount(2);
    await expect(page.locator('[data-handle="s"]')).toHaveCount(0);
    await expect(page.locator('[data-handle="se"]')).toHaveCount(0);

    const editorBox = page.locator('[class*="editorBox"]');
    const textarea = editorBox.locator('textarea');
    // Regressão da "caixa sólida fantasma": o foco do textarea não desenha
    // outline nenhum; a única caixa visível é o tracejado da área.
    await expect
      .poll(() => textarea.evaluate((el) => getComputedStyle(el).outlineStyle))
      .toBe('none');

    const beforeHandle = (await editorBox.boundingBox())!;
    const handle = page.locator('[data-handle="e"]');
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 + 70, hb.y + hb.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    const afterHandle = (await editorBox.boundingBox())!;
    expect(afterHandle.width).toBeGreaterThan(beforeHandle.width + 30);
    const resized = await readText(page);
    expect(resized.boxWidth).toBeGreaterThan(0);
    expect(resized).not.toHaveProperty('boxHeight');

    // Com largura definida, digitar mais NÃO alarga a caixa (só quebra linha)
    // e a ALTURA cresce sozinha (auto-height).
    await textarea.click();
    await page.keyboard.press('End');
    const widthBeforeTyping = (await editorBox.boundingBox())!.width;
    const heightBeforeTyping = (await editorBox.boundingBox())!.height;
    await page.keyboard.type(' E UM TEXTO LONGO PARA QUEBRAR LINHA NA AREA');
    await page.waitForTimeout(200);
    const afterTyping = (await editorBox.boundingBox())!;
    expect(Math.abs(afterTyping.width - widthBeforeTyping)).toBeLessThan(3);
    expect(afterTyping.height).toBeGreaterThan(heightBeforeTyping + 10);
    const stillResized = await readText(page);
    expect(stillResized.boxWidth).toBe(resized.boxWidth);
    expect(stillResized).not.toHaveProperty('boxHeight');

    // Sair da edição: a largura definida é persistida (altura é automática).
    await page.mouse.click(6, 6);
    await expect(handles).toHaveCount(0);
    await page.waitForTimeout(150);
    const frozen = await readText(page);
    expect(frozen.boxWidth).toBeGreaterThan(0);
    expect(frozen).not.toHaveProperty('boxHeight');

    // Reabrir a edição: caixa == largura definida e nenhum clipping horizontal.
    await page.mouse.dblclick(...(Object.values(await textScreenCenter(page, frozen.id)) as [number, number]));
    await expect(handles).toHaveCount(2);
    const scale = await page.evaluate(
      () => document.querySelector('[class*=sheetClip]')!.getBoundingClientRect().width / 1080,
    );
    const expectedOuter = (frozen.boxWidth! + 2 * frozen.fontSize * 0.38) * scale;
    const reopened = (await editorBox.boundingBox())!;
    expect(Math.abs(reopened.width - expectedOuter)).toBeLessThan(4);
    const clipped = await textarea.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(clipped).toBeLessThanOrEqual(1);

    await page.mouse.click(6, 6);
    await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 5000 });

    // Reload + reabrir: estado preservado e tarja correta JÁ na montagem do slide.
    await page.reload();
    await waitForHome(page);
    await page.getByRole('button', { name: /^Abrir / }).first().click();
    await expect(page.getByRole('heading', { name: /1\. Escolha o fundo/ })).toBeVisible();
    await page.getByRole('button', { name: /4\. Texto/ }).click();

    const persisted = await readText(page);
    expect(persisted.boxWidth).toBe(frozen.boxWidth);
    expect(persisted).not.toHaveProperty('boxHeight');

    const highlight = await page.evaluate((id) => {
      const Konva = (window as unknown as { Konva: { stages: any[] } }).Konva;
      const group = Konva.stages[0].findOne(`#${id}`);
      const rect = group?.findOne('Rect');
      return rect ? { width: rect.width(), height: rect.height() } : null;
    }, persisted.id);
    expect(highlight).not.toBeNull();
    expect(highlight!.width).toBeGreaterThan(200);
    expect(highlight!.width).toBeCloseTo(
      persisted.boxWidth! + 2 * persisted.fontSize * 0.38,
      0,
    );
  });

  test('Reordenar páginas no drag & drop só muda a ordem (conteúdo e fundos intactos)', async ({
    page,
  }) => {
    await openCarousel(page);
    await page.locator('button[title*="Pronto 1"]').first().click();

    // Arte completa na página 1: texto com destaque + logo.
    await page.getByRole('button', { name: /4\. Texto/ }).click();
    await page.getByRole('button', { name: '+ Título', exact: true }).click();
    await page.locator('textarea[placeholder="Digite o texto aqui..."]').fill('SONORIDADE');
    await page.getByRole('button', { name: /5\. Logo/ }).click();
    await page.getByRole('button', { name: 'Adicionar Logo com Papel' }).click();
    await page.getByRole('button', { name: 'Alinhar à esquerda da página' }).click();

    // Verifica também que o card "+" de adicionar slide está alinhado, com borda tracejada,
    // é o único botão "Novo slide vazio" e tem o mesmo tamanho das miniaturas
    const firstSlideThumb = page.locator('[data-slide-index="0"]').first();
    const addSlideButtons = page.getByRole('button', { name: 'Novo slide vazio' });
    await expect(addSlideButtons).toHaveCount(1);
    const addSlideThumb = addSlideButtons.first();
    const addBorderStyle = await addSlideThumb.evaluate((el) => getComputedStyle(el).borderTopStyle);
    expect(addBorderStyle).toBe('dashed');
    const firstBox = await firstSlideThumb.boundingBox();
    const addBox = await addSlideThumb.boundingBox();
    expect(firstBox && addBox).toBeTruthy();
    expect(Math.abs(addBox!.y - firstBox!.y)).toBeLessThanOrEqual(3);
    expect(Math.abs(addBox!.width - firstBox!.width)).toBeLessThan(2);
    expect(Math.abs(addBox!.height - firstBox!.height)).toBeLessThan(2);

    // Duas páginas vazias (3 no total, como no relato).
    await page.getByRole('button', { name: 'Novo slide vazio' }).first().click();
    await page.getByRole('button', { name: 'Novo slide vazio' }).first().click();

    const readSlides = () =>
      page.evaluate(() => {
        const c = (window as unknown as { __useCarousel: { getState: () => { slides: any[] } } })
          .__useCarousel.getState();
        return c.slides.map((s) => ({
          id: s.id as string,
          bg: s.doc.backgroundId as string | null,
          els: s.doc.elements.map((e: { id: string }) => e.id) as string[],
        }));
      });

    const before = await readSlides();
    expect(before).toHaveLength(3);

    const thumbs = page.locator('[data-slide-index]');
    // Arrasta a 3ª página para a METADE DIREITA da 1ª: ela entra DEPOIS,
    // virando a página 2 (a arte continua na página 1).
    await thumbs.nth(2).dragTo(thumbs.nth(0), { targetPosition: { x: 52, y: 40 } });
    await page.waitForTimeout(500);

    const after = await readSlides();
    expect(after.map((s) => s.id)).toEqual([before[0].id, before[2].id, before[1].id]);

    // Nenhum slide mudou de conteúdo/fundo: só a posição no array.
    for (const slide of before) {
      expect(after.find((s) => s.id === slide.id)).toEqual(slide);
    }
    expect(after[0].bg).toBe('pronto-1');
    expect(after[0].els).toHaveLength(2);
  });

  test('Miniaturas mostram a arte de TODOS os slides ao reabrir o rascunho', async ({ page }) => {
    await openCarousel(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.getByRole('button', { name: /4\. Texto/ }).click();
    await page.getByRole('button', { name: '+ Título', exact: true }).click();
    await page.locator('textarea[placeholder="Digite o texto aqui..."]').fill('SLIDE UM');

    // Segundo slide com outro fundo e outro texto.
    await page.getByRole('button', { name: 'Novo slide vazio' }).first().click();
    await page.getByRole('button', { name: /1\. Fundo/ }).click();
    await page.getByRole('button', { name: 'Fundos Puros' }).click();
    await page.locator('button[title*="Puro 2"]').first().click();
    await page.getByRole('button', { name: /4\. Texto/ }).click();
    await page.getByRole('button', { name: '+ Título', exact: true }).click();
    await page.locator('textarea[placeholder="Digite o texto aqui..."]').fill('SLIDE DOIS');

    await page.waitForTimeout(600);
    await goHome(page);

    // Reabrir o rascunho: as duas miniaturas já devem renderizar seus elementos
    // (antes, só o slide ativo tinha arte; os outros mostravam apenas o fundo).
    await page.getByRole('button', { name: /^Abrir / }).first().click();
    await expect(page.getByRole('navigation', { name: 'Tira de slides do carrossel' })).toBeVisible();

    const counts = await page
      .locator('[data-slide-preview]')
      .evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-slide-elements'))));
    expect(counts).toEqual([1, 1]);

    // Cada miniatura desenhou o próprio doc: os canvas não são iguais.
    await expect
      .poll(
        async () => {
          const urls = await page
            .locator('[data-slide-preview]')
            .evaluateAll((els) =>
              els.map((el) => {
                const canvas = el.querySelector('canvas');
                return canvas ? canvas.toDataURL() : '';
              }),
            );
          return new Set(urls.filter(Boolean)).size;
        },
        { timeout: 10000 },
      )
      .toBe(2);
  });

  test('Duplicar slide mantém páginas independentes e reordenar não troca conteúdo', async ({
    page,
  }) => {
    await openCarousel(page);
    await page.locator('button[title*="Pronto 1"]').first().click();

    await page.getByRole('button', { name: /4\. Texto/ }).click();
    await page.getByRole('button', { name: '+ Título', exact: true }).click();
    await page.locator('textarea[placeholder="Digite o texto aqui..."]').fill('SLIDE UM');

    // Duplicar: o novo slide tem os MESMOS elementos visuais, mas ids novos.
    await page.getByRole('button', { name: 'Duplicar slide atual' }).click();
    await page.getByRole('button', { name: /4\. Texto/ }).click();
    await page.getByRole('button', { name: /^Selecionar texto/ }).first().click();
    await page.locator('textarea[placeholder="Digite o texto aqui..."]').fill('SLIDE DOIS');

    const read = () =>
      page.evaluate(() => {
        const c = (window as unknown as { __useCarousel: { getState: () => { slides: any[] } } })
          .__useCarousel.getState();
        return c.slides.map((s) => ({
          id: s.id as string,
          texts: s.doc.elements
            .filter((e: { kind: string }) => e.kind === 'text')
            .map((e: { text: string }) => e.text) as string[],
          elementIds: s.doc.elements.map((e: { id: string }) => e.id) as string[],
        }));
      });

    const before = await read();
    expect(before).toHaveLength(2);
    const allIds = before.flatMap((s) => s.elementIds);
    expect(new Set(allIds).size).toBe(allIds.length); // nenhum id compartilhado

    // Ativar o slide 1 não pode remover os elementos do slide 2.
    await page.getByRole('button', { name: /^Slide 1/ }).click();
    await page.waitForTimeout(200);
    const afterActivate = await read();
    expect(afterActivate.find((s) => s.id === before[0].id)!.texts).toEqual(['SLIDE UM']);
    expect(afterActivate.find((s) => s.id === before[1].id)!.texts).toEqual(['SLIDE DOIS']);

    // Reordenar continua sendo só posicional.
    const thumbs = page.locator('[data-slide-index]');
    await thumbs.nth(1).dragTo(thumbs.nth(0), { targetPosition: { x: 4, y: 40 } });
    await page.waitForTimeout(400);

    const afterReorder = await read();
    expect(afterReorder.map((s) => s.id)).toEqual([before[1].id, before[0].id]);
    for (const slide of before) {
      expect(afterReorder.find((s) => s.id === slide.id)!.texts).toEqual(slide.texts);
    }
  });

  test('Animação GSAP de drag & drop: ghost, abertura de espaço e pouso ease-out mesmo dropado longe', async ({
    page,
  }) => {
    await openCarousel(page);
    await page.getByRole('button', { name: 'Novo slide vazio' }).first().click();
    await page.getByRole('button', { name: 'Novo slide vazio' }).first().click();

    const thumbs = page.locator('[data-slide-index]');
    await expect(thumbs).toHaveCount(3);

    const beforeIds = await thumbs.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-slide-id')),
    );

    const firstBox = (await thumbs.nth(0).boundingBox())!;
    const thirdBox = (await thumbs.nth(2).boundingBox())!;

    // Inicia o arraste no slide 3 e move até acima da tira (fora da área de overflow)
    // alinhado horizontalmente com o início do slide 1.
    await page.mouse.move(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(firstBox.x + 8, firstBox.y - 160, { steps: 14 });
    await page.waitForTimeout(180);

    const ghost = page.locator('[class*="dropGhost"]');
    const floating = page.locator('[class*="floatingDragCard"]');
    await expect(ghost).toBeVisible();
    await expect(floating).toBeVisible();

    const duringDrag = await page.evaluate(() => {
      const ghostEl = document.querySelector('[class*="dropGhost"]') as HTMLElement | null;
      const floatEl = document.querySelector('[class*="floatingDragCard"]') as HTMLElement | null;
      const firstThumb = document.querySelector('[data-slide-index="0"]') as HTMLElement | null;
      const listEl = document.querySelector('[class*="thumbList"]') as HTMLElement | null;
      const parseTx = (el: HTMLElement | null) => {
        if (!el) return 0;
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        return m.m41;
      };
      return {
        ghostOpacity: ghostEl ? Number(getComputedStyle(ghostEl).opacity) : 0,
        floatRect: floatEl ? floatEl.getBoundingClientRect() : null,
        listRect: listEl ? listEl.getBoundingClientRect() : null,
        firstShiftX: parseTx(firstThumb),
      };
    });

    expect(duringDrag.ghostOpacity).toBeGreaterThan(0.8);
    expect(duringDrag.floatRect).not.toBeNull();
    // Portal flutuante fora do recorte da tira (acima de listRect.top)
    expect(duringDrag.floatRect!.top).toBeLessThan(duringDrag.listRect!.top - 60);
    // Slide 1 abriu espaço deslizando para a direita
    expect(duringDrag.firstShiftX).toBeGreaterThan(20);

    // Solta longe da tira: o card flutuante deve pousar com ease-out e limpar tudo ao terminar
    await page.mouse.up();
    await expect(floating).toHaveCount(0, { timeout: 2000 });
    await expect(ghost).toHaveCount(0, { timeout: 2000 });

    const afterState = await page.evaluate(() => {
      const listEl = document.querySelector('[class*="thumbList"]');
      const allThumbs = Array.from(document.querySelectorAll<HTMLElement>('[data-slide-index]'));
      return {
        motionActive: listEl?.getAttribute('data-motion-active') ?? null,
        ids: allThumbs.map((el) => el.getAttribute('data-slide-id')),
        opacities: allThumbs.map((el) => Number(getComputedStyle(el).opacity)),
      };
    });

    expect(afterState.motionActive).toBeNull();
    expect(afterState.ids).toEqual([beforeIds[2], beforeIds[0], beforeIds[1]]);
    expect(afterState.opacities).toEqual([1, 1, 1]);
  });

  test('botão Renomear no header abre edição por teclado e restaura foco ao cancelar', async ({ page }) => {
    await openSingle(page);
    const renameBtn = page.getByRole('button', { name: 'Renomear' });
    await renameBtn.focus();
    await renameBtn.press('Enter');

    const input = page.getByRole('textbox', { name: 'Nome do projeto' });
    await expect(input).toBeFocused();
    await input.press('Escape');

    await expect(renameBtn).toBeFocused();
  });

  test('botões acessíveis de mover slide reordenam o carrossel sem arrastar', async ({ page }) => {
    await openCarousel(page);
    await page.getByRole('button', { name: 'Novo slide vazio' }).first().click();
    const thumbs = page.locator('[data-slide-index]');
    await expect(thumbs).toHaveCount(2);

    const beforeIds = await thumbs.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-slide-id')),
    );

    await page.getByRole('button', { name: 'Mover slide 2 para a esquerda' }).click();

    await expect(async () => {
      const afterIds = await thumbs.evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-slide-id')),
      );
      expect(afterIds).toEqual([beforeIds[1], beforeIds[0]]);
    }).toPass({ timeout: 3000 });
  });

  test('diálogos modais focam botão seguro e fecham com Escape', async ({ page }) => {
    await page.goto('/');
    await waitForHome(page);
    await pickCarousel(page);

    const formatDialog = page.getByRole('dialog', { name: /Escolha o formato do carrossel/ });
    await expect(formatDialog).toBeVisible();
    await expect(formatDialog.getByRole('button', { name: 'Vertical (3:4)' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(formatDialog).toHaveCount(0);

    await createSingle(page);
    await expect(page.getByRole('heading', { name: /1\. Escolha o fundo/ })).toBeVisible();
    await chooseMode(page, 'carousel');

    const confirmDialog = page.getByRole('dialog').filter({ hasText: 'Trocar pra Carrossel?' });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByRole('button', { name: 'Ficar aqui' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(confirmDialog).toHaveCount(0);
  });

  test('Bug #01: "Novo slide vazio" no último slide de rascunho duplicado cria Slide 8 limpo, foca na tira e preserva Slide 7', async ({
    page,
  }) => {
    await openCarousel(page);

    const addSlideBtn = page.getByRole('button', { name: 'Novo slide vazio' });
    for (let i = 0; i < 6; i++) {
      const current = await page.evaluate(() => {
        const w = window as unknown as {
          __useCarousel?: { getState: () => { slides: unknown[] } };
        };
        return w.__useCarousel?.getState().slides.length ?? 0;
      });
      if (current >= 7) break;
      await addSlideBtn.click();
    }

    await page.getByRole('button', { name: /^Slide 7\b/ }).click();
    await expect(page.getByTestId('slide-badge')).toHaveText('Slide 7 de 7');

    // Popula o Slide 7 com fundo, enfeite, título e textura padrão
    await page.locator('button[title*="Pronto 1"]').first().click();

    await page.getByRole('button', { name: /2\. Enfeites/ }).click();
    await page.locator('button[title*="Arabesco floral"]').first().click();

    await page.getByRole('button', { name: /4\. Texto/ }).click();
    await page.locator('button:has-text("+ Título")').click();
    await page.locator('textarea[placeholder="Digite o texto aqui..."]').fill('SLIDE SETE');

    await page.getByRole('button', { name: /6\. Textura/ }).click();
    await page.getByRole('checkbox', { name: 'Papel amassado' }).check();
    await expect(page.getByRole('checkbox', { name: 'Papel amassado' })).toBeChecked();

    // Volta pra home, duplica o rascunho e abre a cópia
    await goHome(page);
    await page.getByRole('button', { name: 'Duplicar rascunho' }).first().click();
    const openCopyBtn = page.getByRole('button', { name: /Abrir .*cópia/i }).first();
    await expect(openCopyBtn).toBeVisible();
    await openCopyBtn.click();
    await expect(page.getByRole('heading', { name: /1\. Escolha o fundo/ })).toBeVisible();

    // Navega até o Slide 7 e cria um novo slide vazio
    await page.getByRole('button', { name: /^Slide 7\b/ }).click();
    await expect(page.getByTestId('slide-badge')).toHaveText('Slide 7 de 7');

    await addSlideBtn.click();

    await expect(page.getByTestId('slide-badge')).toHaveText('Slide 8 de 8');
    const slide8Btn = page.getByRole('button', { name: /Slide 8 \(ativo\)/ });
    await expect(slide8Btn).toBeVisible();
    await expect(slide8Btn).toBeFocused();

    const visibleInTray = await slide8Btn.evaluate((btn) => {
      let scroller: HTMLElement | null = btn.parentElement;
      while (scroller) {
        const ox = getComputedStyle(scroller).overflowX;
        if (ox === 'auto' || ox === 'scroll') break;
        scroller = scroller.parentElement;
      }
      const btnRect = btn.getBoundingClientRect();
      if (!scroller) {
        return btnRect.left >= 0 && btnRect.right <= window.innerWidth;
      }
      const listRect = scroller.getBoundingClientRect();
      return btnRect.left >= listRect.left - 1 && btnRect.right <= listRect.right + 1;
    });
    expect(visibleInTray).toBe(true);

    const snapshot = await page.evaluate(() => {
      const w = window as unknown as {
        __useCarousel?: {
          getState: () => {
            activeSlideIndex: number;
            slides: Array<{
              doc: { backgroundId: string | null; elements: unknown[] };
              finish: { paper: { enabled: boolean } };
            }>;
          };
        };
        __useEditor?: {
          getState: () => {
            doc: { backgroundId: string | null; elements: unknown[] };
            finish: { paper: { enabled: boolean } };
          };
        };
      };
      const carousel = w.__useCarousel?.getState();
      const editor = w.__useEditor?.getState();
      if (!carousel || !editor) return null;
      return {
        activeSlideIndex: carousel.activeSlideIndex,
        slideCount: carousel.slides.length,
        slide7: {
          backgroundId: carousel.slides[6]?.doc.backgroundId ?? null,
          elements: carousel.slides[6]?.doc.elements.length ?? -1,
        },
        slide8: {
          backgroundId: carousel.slides[7]?.doc.backgroundId ?? null,
          elements: carousel.slides[7]?.doc.elements.length ?? -1,
          paperEnabled: carousel.slides[7]?.finish.paper.enabled ?? false,
        },
        editor: {
          backgroundId: editor.doc.backgroundId,
          elements: editor.doc.elements.length,
          paperEnabled: editor.finish.paper.enabled,
        },
      };
    });

    expect(snapshot).toEqual({
      activeSlideIndex: 7,
      slideCount: 8,
      slide7: {
        backgroundId: expect.any(String),
        elements: 2,
      },
      slide8: {
        backgroundId: null,
        elements: 0,
        paperEnabled: true,
      },
      editor: {
        backgroundId: null,
        elements: 0,
        paperEnabled: true,
      },
    });
  });

  test('Melhoria #01: área de trabalho oculta scrollbars visuais mantendo scrollbarGutter stable e rolagem por wheel', async ({
    page,
  }) => {
    await openSingle(page);

    const stepContainer = page.locator('[class*="stepContent"] > div').first();
    const canvasContainer = page.locator('[class*="canvasArea"] > [class*="container"]').first();
    const dock = page.locator('[class*="dock"]').first();

    await expect(stepContainer).toBeVisible();
    await expect(canvasContainer).toBeVisible();
    await expect(dock).toBeVisible();

    const styles = await page.evaluate(() => {
      const stepEl = document.querySelector('[class*="stepContent"] > div') as HTMLElement | null;
      const canvasEl = document.querySelector(
        '[class*="canvasArea"] > [class*="container"]',
      ) as HTMLElement | null;
      const dockEl = document.querySelector('[class*="dock"]') as HTMLElement | null;
      if (!stepEl || !canvasEl || !dockEl) return null;
      const stepCs = getComputedStyle(stepEl);
      const canvasCs = getComputedStyle(canvasEl);
      const dockCs = getComputedStyle(dockEl);
      return {
        stepScrollbarWidth: stepCs.scrollbarWidth,
        stepScrollbarGutter: stepCs.scrollbarGutter,
        canvasScrollbarWidth: canvasCs.scrollbarWidth,
        dockScrollbarWidth: dockCs.scrollbarWidth,
      };
    });

    expect(styles).not.toBeNull();
    expect(styles!.stepScrollbarWidth).toBe('none');
    expect(styles!.stepScrollbarGutter).toContain('stable');
    expect(styles!.canvasScrollbarWidth).toBe('none');
    expect(styles!.dockScrollbarWidth).toBe('none');

    // Garante overflow vertical na área da folha e valida que o scroll por wheel segue funcionando
    await page.setViewportSize({ width: 1280, height: 420 });
    const zoomInBtn = page.getByRole('button', { name: 'Ampliar zoom (Ctrl+=)' });
    await zoomInBtn.click();
    await zoomInBtn.click();

    await expect
      .poll(() => canvasContainer.evaluate((el) => el.scrollHeight > el.clientHeight))
      .toBe(true);

    await canvasContainer.evaluate((el) => {
      el.scrollTop = 0;
    });
    const box = await canvasContainer.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 240);

    await expect
      .poll(() => canvasContainer.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
  });
});
