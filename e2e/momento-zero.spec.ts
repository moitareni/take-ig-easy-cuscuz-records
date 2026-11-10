import { expect, test } from '@playwright/test';
import {
  carouselSnapshot,
  chooseMode,
  dismissModeSelector,
  openCarousel,
  openSingle,
} from './helpers';

const MODE_DIALOG = 'Escolha o modo de criação';
const MODE_LIST = 'Escolher modo de criação';

test.describe('Momento 0 — escolha de modo (release v.2)', () => {
  test('M0.1/M0.2: texto de apoio vive no (?) do canto, carta limpa e centralizada', async ({ page }) => {
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: MODE_DIALOG });
    await dialog.waitFor({ state: 'visible' });

    // O texto saiu das cartas (não visível) e mora no balão nativo do (?).
    const single = dialog.getByRole('button', { name: /Post único/ });
    const carousel = dialog.getByRole('button', { name: /Carrossel/ });
    await expect(single).toBeVisible();
    const singleDescHidden = await single.locator('[class*="modeDesc"]').evaluate((el) => {
      const style = getComputedStyle(el);
      return Number.parseInt(style.width, 10) <= 1 && style.clipPath !== 'none';
    });
    expect(singleDescHidden).toBe(true);
    await expect(single.getByTestId('mode-help-single')).toHaveAttribute(
      'title',
      'Arte isolada, ideal para flyers, anuncios e imagens de capa.',
    );
    await expect(carousel.getByTestId('mode-help-carousel')).toHaveAttribute(
      'title',
      'Várias artes que contam uma história, ideal para quadros da página e montagens de fotos.',
    );

    // Clicar no (?) não escolhe o modo — o seletor continua aberto.
    await single.getByTestId('mode-help-single').click();
    await expect(dialog).toBeVisible();

    await expect(dialog).not.toContainText('ZIP');
    await expect(dialog).not.toContainText('PNG');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    const previews = dialog.getByTestId('mode-preview');
    await expect(previews).toHaveCount(2);
    await expect(previews.first()).toHaveAttribute('aria-hidden', 'true');
    await expect(previews.last()).toHaveAttribute('aria-hidden', 'true');
  });

  test('M0.4: segunda tela com glifos na proporção certa e botão Voltar', async ({ page }) => {
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: MODE_DIALOG });
    await dialog.getByRole('button', { name: /Carrossel/ }).click();

    await expect(dialog.getByText('Escolha o formato do carrossel')).toBeVisible();
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
    await expect(dialog.getByRole('button', { name: /Post único/ })).toBeVisible();
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

  test('M0.3: carrossel → post único reusa o seletor de slide', async ({ page }) => {
    await openCarousel(page);
    await chooseMode(page, 'single');

    const picker = page.getByRole('dialog', { name: 'Escolher slide para Post Único' });
    await expect(picker).toBeVisible();
    await expect(picker).toContainText('O que estiver nele — inclusive as imagens — vai junto.');
    await picker.getByRole('button', { name: 'Confirmar' }).click();

    await expect(page.getByRole('navigation', { name: 'Tira de slides do carrossel' })).toHaveCount(0);
    expect((await carouselSnapshot(page))?.mode).toBe('single');
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

    await expect(page.getByRole('dialog', { name: MODE_DIALOG })).toHaveCount(0);
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
    await expect(page.getByRole('option', { name: /Post único/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('option', { name: /Carrossel/ })).toHaveAttribute('aria-selected', 'false');

    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option', { name: /Carrossel/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(list).toBeVisible();
    await page.locator('h1').first().click();
    await expect(list).toHaveCount(0);
    expect((await carouselSnapshot(page))?.mode).toBe('single');
  });

  test('M0.2/M0.3: miniaturas cabem na carta e gatilho tem alvo de toque ≥ 24px', async ({ page }) => {
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: MODE_DIALOG });
    await dialog.waitFor({ state: 'visible' });

    const cardBox = await dialog.getByRole('button', { name: /Post único/ }).boundingBox();
    const previewBox = await dialog.getByTestId('mode-preview').first().boundingBox();
    expect(cardBox!.width).toBeGreaterThan(0);
    expect(previewBox!.x + previewBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1);

    await dismissModeSelector(page, 'single');
    const triggerBox = await page.getByTestId('mode-dropdown-trigger').boundingBox();
    expect(triggerBox!.height).toBeGreaterThanOrEqual(24);
  });

  test('M0: respeita prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const card = page.getByRole('dialog', { name: MODE_DIALOG }).getByRole('button', { name: /Post único/ });
    await card.waitFor({ state: 'visible' });
    const duration = await card.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(duration)).toBeLessThan(0.01);
  });

  test('M0: glifos decorativos fora da árvore e gatilho rotulado', async ({ page }) => {
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: MODE_DIALOG });
    await dialog.getByRole('button', { name: /Carrossel/ }).click();
    await expect(dialog.getByTestId('format-glyph').first()).toHaveAttribute('aria-hidden', 'true');
    await dialog.getByRole('button', { name: 'Bora criar carrossel!' }).click();

    const trigger = page.getByTestId('mode-dropdown-trigger');
    await expect(trigger).toHaveAttribute('title', /Escolha entre Post único/);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(page.getByTestId('slide-badge')).toHaveAttribute('aria-live', 'polite');
  });
});
