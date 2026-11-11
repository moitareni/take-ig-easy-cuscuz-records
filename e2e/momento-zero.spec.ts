import { expect, test } from '@playwright/test';
import {
  carouselSnapshot,
  chooseMode,
  draftsSnapshot,
  openCarousel,
  openSingle,
  waitForHome,
} from './helpers';

const MODE_LIST = 'Escolher modo de criação';

test.describe('Momento 0 — home Meus rascunhos (release v.3)', () => {
  test('M0.1/M0.2: home limpa, botões de criação visíveis e estado vazio sem jargão', async ({ page }) => {
    await page.goto('/');
    await waitForHome(page);

    // Sem jargão: nada de ZIP/PNG na tela inteira.
    await expect(page.getByText('ZIP')).toHaveCount(0);
    await expect(page.getByText('PNG')).toHaveCount(0);

    await expect(page.getByRole('heading', { name: /Cuscuz Records Insta Kit/ })).toBeVisible();
    await expect(page.getByRole('banner').getByText('Meus rascunhos', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Meus rascunhos' })).toBeVisible();

    // No estado vazio, os botões de criação ficam apenas no quadro central (sem redundância no header).
    await expect(page.getByRole('button', { name: 'Baixar backup' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Post único', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Carrossel', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Criar post único', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar carrossel', exact: true })).toBeVisible();

    // Estado vazio explica o que fazer sem termos técnicos.
    await expect(page.getByText('Nenhum rascunho por aqui ainda')).toBeVisible();
    await expect(page.getByText('Bora criar a primeira arte?', { exact: false })).toBeVisible();
  });

  test('M0.4: segunda tela do carrossel com glifos na proporção certa e botão Voltar', async ({ page }) => {
    await page.goto('/');
    await waitForHome(page);

    await page.getByRole('button', { name: 'Criar carrossel', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: /Escolha o formato do carrossel/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Você escolhe o tamanho uma vez e todos os cards saem iguais.')).toBeVisible();

    const glyphs = dialog.getByTestId('format-glyph');
    await expect(glyphs).toHaveCount(3);

    const vertical = await glyphs.nth(0).boundingBox();
    const horizontal = await glyphs.nth(1).boundingBox();
    const square = await glyphs.nth(2).boundingBox();
    expect(vertical!.height / vertical!.width).toBeCloseTo(4 / 3, 1);
    expect(horizontal!.width / horizontal!.height).toBeCloseTo(4 / 3, 1);
    expect(square!.width / square!.height).toBeCloseTo(1, 1);

    await dialog.getByRole('button', { name: 'Voltar' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Criar post único', exact: true })).toBeVisible();
  });

  test('M0.5: selo junto à folha somado ao contador da tira', async ({ page }) => {
    await openCarousel(page, '4:3');

    const badge = page.getByTestId('slide-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute('role', 'status');
    await expect(badge).toContainText('Slide 1 de 1');

    await expect(page.getByRole('navigation', { name: 'Tira de slides do carrossel' })).toBeVisible();
    await expect(page.getByText('Slide 1 de 1', { exact: true })).toHaveCount(2);

    const snap = await carouselSnapshot(page);
    expect(snap?.mode).toBe('carousel');
    expect(snap?.format).toBe('4:3');
  });

  test('M0.3: post único → carrossel com confirmação amigável e rascunho preservado', async ({ page }) => {
    await openSingle(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await expect(page.locator('footer button:has-text("Próximo")')).toBeEnabled();

    const trigger = page.getByTestId('mode-dropdown-trigger');
    await expect(trigger).toBeVisible();
    await trigger.click();

    const list = page.getByRole('listbox', { name: MODE_LIST });
    await expect(list).toBeVisible();
    await expect(page.getByRole('option', { name: /Post único/ })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('option', { name: /Carrossel/ }).click();

    const confirm = page.getByRole('dialog').filter({ hasText: 'Trocar pra Carrossel?' });
    await expect(confirm).toContainText('Troco pra Carrossel e levo as imagens que você já enviou?');
    await expect(confirm.getByRole('button', { name: 'Ficar aqui' })).toBeVisible();
    await confirm.getByRole('button', { name: 'Bora, trocar!' }).click();

    await expect(page.getByRole('navigation', { name: 'Tira de slides do carrossel' })).toBeVisible();
    const snap = await carouselSnapshot(page);
    expect(snap?.mode).toBe('carousel');
    expect(snap?.slides).toHaveLength(1);
    expect(snap?.slides[0].doc.backgroundId).not.toBeNull();
  });

  test('M0.3: carrossel → post único acontece no mesmo rascunho', async ({ page }) => {
    await openCarousel(page);
    const before = await draftsSnapshot(page);
    expect(before?.activeDraftId).toBeTruthy();

    await chooseMode(page, 'single');

    const picker = page.getByRole('dialog', { name: 'Escolher slide para Post Único' });
    await expect(picker).toBeVisible();
    await expect(picker).toContainText('os outros slides saem deste rascunho');
    await picker.getByRole('button', { name: 'Confirmar' }).click();

    await expect(page.getByRole('navigation', { name: 'Tira de slides do carrossel' })).toHaveCount(0);
    expect((await carouselSnapshot(page))?.mode).toBe('single');

    // Mesma conversão no mesmo rascunho: id não muda.
    const after = await draftsSnapshot(page);
    expect(after?.activeDraftId).toBe(before?.activeDraftId);
    expect(after?.activeKind).toBe('single');
  });

  test('M0.3: trocas de modo nunca devolvem ao seletor nem zera o modo', async ({ page }) => {
    await openSingle(page);

    await chooseMode(page, 'carousel');
    await page
      .getByRole('dialog')
      .filter({ hasText: 'Trocar pra Carrossel?' })
      .getByRole('button', { name: 'Bora, trocar!' })
      .click();
    expect((await carouselSnapshot(page))?.mode).toBe('carousel');

    await chooseMode(page, 'single');
    await page
      .getByRole('dialog', { name: 'Escolher slide para Post Único' })
      .getByRole('button', { name: 'Confirmar' })
      .click();
    expect((await carouselSnapshot(page))?.mode).toBe('single');

    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('M0.3: dropdown com teclado, tooltip nativo e clique fora', async ({ page }) => {
    await openSingle(page);
    const trigger = page.getByTestId('mode-dropdown-trigger');
    await expect(trigger).toContainText('modo');
    await expect(trigger).toHaveAttribute('title', /Escolha entre Post único/);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const list = page.getByRole('listbox', { name: MODE_LIST });
    await expect(list).toBeVisible();
    // Ao abrir, o foco vai para a opção atual; só então as setas navegam.
    await expect(page.getByRole('option', { name: /Post único/ })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option', { name: /Carrossel/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(list).toBeVisible();
    await page.getByRole('heading', { name: /1\. Escolha o fundo/ }).click();
    await expect(list).toHaveCount(0);
    expect((await carouselSnapshot(page))?.mode).toBe('single');
  });

  test('M0.2/M0.3: botões da home e gatilho do dropdown têm alvo de toque ≥ 24px', async ({ page }) => {
    await page.goto('/');
    await waitForHome(page);

    const createBox = await page.getByRole('button', { name: 'Criar carrossel', exact: true }).boundingBox();
    expect(createBox!.height).toBeGreaterThanOrEqual(24);

    await openSingle(page);
    const triggerBox = await page.getByTestId('mode-dropdown-trigger').boundingBox();
    expect(triggerBox!.height).toBeGreaterThanOrEqual(24);
  });

  test('M0: respeita prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await waitForHome(page);
    const card = page.getByRole('button', { name: 'Criar post único', exact: true });
    const duration = await card.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(duration)).toBeLessThan(0.01);
  });

  test('M0: glifos decorativos fora da árvore e gatilho rotulado', async ({ page }) => {
    await page.goto('/');
    await waitForHome(page);
    await page.getByRole('button', { name: 'Criar carrossel', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: /Escolha o formato do carrossel/ });
    await expect(dialog.getByTestId('format-glyph').first()).toHaveAttribute('aria-hidden', 'true');
    await dialog.getByRole('button', { name: 'Bora criar carrossel!' }).click();

    const trigger = page.getByTestId('mode-dropdown-trigger');
    await expect(trigger).toHaveAttribute('title', /Escolha entre Post único/);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(page.getByTestId('slide-badge')).toHaveAttribute('aria-live', 'polite');
  });
});
