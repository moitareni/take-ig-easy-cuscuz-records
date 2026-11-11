import { expect, test } from '@playwright/test';
import { goHome, openCarousel, openSingle, waitForHome } from './helpers';

test.describe('Regressões da leva P0', () => {
  test('recarregar após criar e converter para carrossel não quebra a home', async ({ page }) => {
    await page.goto('/');
    await waitForHome(page);

    await page.getByRole('button', { name: 'Criar post único', exact: true }).click();
    await expect(page.getByRole('heading', { name: /1\. Escolha o fundo/ })).toBeVisible();
    await page.locator('button[title*="Pronto 1"]').first().click();

    await page.getByTestId('mode-dropdown-trigger').click();
    await page.getByRole('option', { name: /Carrossel/ }).click();
    await page
      .getByRole('dialog')
      .filter({ hasText: 'Trocar pra Carrossel?' })
      .getByRole('button', { name: 'Bora, trocar!' })
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
    await expect(
      page.getByText('O formato foi definido na criação do carrossel.', { exact: false }),
    ).toBeVisible();

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

    // Com rascunho salvo, os botões do header aparecem; ao excluir o último, somem de novo
    await page.getByRole('button', { name: 'Criar post único', exact: true }).click();
    await page.locator('button[title*="Pronto 1"]').first().click();
    await goHome(page);

    await expect(page.getByRole('button', { name: 'Post único', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Carrossel', exact: true })).toBeVisible();

    await page.locator('article').getByRole('button', { name: 'Excluir rascunho' }).click();
    await page
      .getByRole('dialog')
      .filter({ hasText: 'Excluir este rascunho?' })
      .getByRole('button', { name: 'Sim, excluir' })
      .click();

    await expect(page.getByRole('button', { name: 'Post único', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Criar post único', exact: true })).toBeVisible();
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

  test('Leva 2 (#13): prévias de textura em dropdown e Ativar todas com undo único', async ({ page }) => {
    await openSingle(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.getByRole('button', { name: /6\. Textura/ }).click();

    // Prévias fechadas por padrão
    await expect(page.getByAltText('Prévia do papel amassado')).toHaveCount(0);
    await expect(page.getByAltText('Prévia da textura de borda')).toHaveCount(0);

    // Abrir summary revela a prévia
    await page.locator('summary:has-text("Ver prévia da textura")').first().click();
    await expect(page.getByAltText('Prévia do papel amassado')).toBeVisible();

    // Ativar todas liga os três de uma vez e desfaz em um único passo
    await page.waitForTimeout(450);
    const activateAllBtn = page.getByRole('button', { name: 'Ativar todas' });
    await expect(activateAllBtn).toBeEnabled();
    await activateAllBtn.click();
    await expect(activateAllBtn).toBeDisabled();
    await expect(page.locator('button:has-text("Papel (Ligado)")')).toBeVisible();
    await expect(page.locator('button:has-text("Borda (Ligado)")')).toBeVisible();
    await expect(page.locator('button:has-text("Grain (Ligado)")')).toBeVisible();

    await page.getByRole('button', { name: 'Desfazer (Ctrl+Z)' }).click();
    await expect(page.locator('button:has-text("Papel (Desligado)")')).toBeVisible();
    await expect(page.locator('button:has-text("Borda (Desligado)")')).toBeVisible();
    await expect(page.locator('button:has-text("Grain (Desligado)")')).toBeVisible();

    // Restaurar padrão desliga novamente
    await activateAllBtn.click();
    await page.getByRole('button', { name: /Restaurar padrão/ }).click();
    await expect(page.locator('button:has-text("Papel (Desligado)")')).toBeVisible();
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

    // Margem 56 padrão no Canto Sup. Esq.
    await page.getByRole('button', { name: 'Canto Sup. Esq.' }).click();
    const pos56 = await page.evaluate(() => {
      const w = window as unknown as {
        __useEditor?: { getState: () => { doc: { elements: Array<{ kind: string; x: number; y: number }> } } };
      };
      const logo = w.__useEditor?.getState().doc.elements.find((e) => e.kind === 'logo');
      return logo ? { x: logo.x, y: logo.y } : null;
    });
    expect(pos56).not.toBeNull();

    // Muda a margem para 100px na GuideToolbar e clica em Canto Sup. Esq.
    await dock.getByRole('button', { name: '100', exact: true }).click();
    await page.getByRole('button', { name: 'Canto Sup. Esq.' }).click();
    const pos100 = await page.evaluate(() => {
      const w = window as unknown as {
        __useEditor?: { getState: () => { doc: { elements: Array<{ kind: string; x: number; y: number }> } } };
      };
      const logo = w.__useEditor?.getState().doc.elements.find((e) => e.kind === 'logo');
      return logo ? { x: logo.x, y: logo.y } : null;
    });
    expect(pos100!.x - pos56!.x).toBeCloseTo(44, 1);
    expect(pos100!.y - pos56!.y).toBeCloseTo(44, 1);

    // Desliga as guias de layout e clica em Canto Sup. Esq. -> cola no canto (margem 0)
    await dock.getByRole('button', { name: /Esconder guias de layout/ }).click();
    await page.getByRole('button', { name: 'Canto Sup. Esq.' }).click();
    const pos0 = await page.evaluate(() => {
      const w = window as unknown as {
        __useEditor?: { getState: () => { doc: { elements: Array<{ kind: string; x: number; y: number }> } } };
      };
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
      .getByRole('button', { name: 'Bora, trocar!' })
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
    await page.getByRole('button', { name: 'Criar post único', exact: true }).click();
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
    await page.getByRole('button', { name: 'Criar post único', exact: true }).click();
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
  });});
