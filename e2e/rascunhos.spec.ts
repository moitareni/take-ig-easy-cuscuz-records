import { expect, test } from '@playwright/test';
import { draftsSnapshot, goHome, startEditor, waitForHome } from './helpers';

test.describe('Meus rascunhos — histórico local', () => {
  test('cria, salva ao voltar, reabre e lista o rascunho de post único', async ({ page }) => {
    await startEditor(page);
    await page.locator('button[title*="Pronto 1"]').first().click();

    await goHome(page);

    // O rascunho aparece no "Continuar" e na grade, com título automático.
    await expect(page.getByText('Continuar de onde parou')).toBeVisible();
    await expect(page.getByRole('heading', { name: /1\. Escolha o fundo/ })).toHaveCount(0);

    const gridCard = page.locator('article').filter({ hasText: /Post de/ });
    await expect(gridCard).toHaveCount(1);
    await expect(gridCard).toContainText('Post único');

    // Reabrir pela grade restaura o fundo escolhido.
    await gridCard.getByRole('button', { name: /^Abrir / }).click();
    await expect(page.getByRole('heading', { name: /1\. Escolha o fundo/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Espelhar fundo ↔' })).toBeVisible();
  });

  test('rascunho recém-criado e vazio não vira card na home', async ({ page }) => {
    await startEditor(page);
    await goHome(page);

    await expect(page.getByText('Nenhum rascunho por aqui ainda')).toBeVisible();
    const snapshot = await draftsSnapshot(page);
    expect(snapshot?.drafts).toHaveLength(0);
  });

  test('renomear atualiza o título do card e exportar direto do card baixa o post', async ({ page }) => {
    await startEditor(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await goHome(page);

    const card = page.locator('article').filter({ hasText: /Post de/ });
    const renameBtn = card.getByRole('button', { name: 'Renomear' });
    await expect(renameBtn).toHaveAttribute('title', 'Renomear');
    await renameBtn.click();

    const input = page.getByRole('textbox', { name: 'Nome do rascunho' });
    await expect(input).toBeVisible();
    await input.fill('Flyer do forró');
    await input.press('Enter');

    const renamedCard = page.locator('article').filter({ hasText: 'Flyer do forró' });
    await expect(renamedCard).toHaveCount(1);
    await expect(page.locator('article').filter({ hasText: /Post de/ })).toHaveCount(0);

    // Exportar direto do card na home
    const downloadPromise = page.waitForEvent('download');
    await renamedCard.getByRole('button', { name: 'Exportar' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^cuscuz-post-\d{4}-\d{2}-\d{2}-\d{4}\.png$/);
  });

  test('excluir pede confirmação e permite desfazer pelo aviso', async ({ page }) => {
    await startEditor(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await goHome(page);

    const card = page.locator('article').filter({ hasText: /Post de/ });
    await card.getByRole('button', { name: 'Excluir rascunho' }).click();

    const confirm = page.getByRole('dialog').filter({ hasText: 'Excluir este rascunho?' });
    await expect(confirm).toContainText('Você pode desfazer pelo aviso');
    await confirm.getByRole('button', { name: 'Sim, excluir' }).click();
    await expect(confirm).toHaveCount(0);

    // Card some e o aviso oferece Desfazer.
    await expect(page.locator('article').filter({ hasText: /Post de/ })).toHaveCount(0);
    const toast = page.getByRole('alert').filter({ hasText: 'foi excluído' });
    await toast.getByRole('button', { name: 'Desfazer' }).click();

    await expect(page.locator('article').filter({ hasText: /Post de/ })).toHaveCount(1);
  });

  test('carrossel criado em 1:1 volta como Carrossel e converte no mesmo rascunho', async ({ page }) => {
    await startEditor(page, 'carousel', '1:1');
    await page.locator('button[title*="Pronto 1"]').first().click();
    await goHome(page);

    const card = page.locator('article').filter({ hasText: /Carrossel de/ });
    await expect(card).toContainText('Carrossel · 1 slide');

    await card.getByRole('button', { name: /^Abrir / }).click();
    await expect(page.getByRole('heading', { name: /1\. Escolha o fundo/ })).toBeVisible();

    const before = await draftsSnapshot(page);
    expect(before?.activeKind).toBe('carousel');

    // Converte para post único no MESMO rascunho.
    await page.getByTestId('mode-dropdown-trigger').click();
    await page.getByRole('option', { name: /Post único/ }).click();
    const picker = page.getByRole('dialog', { name: 'Escolher slide para Post Único' });
    await picker.getByRole('button', { name: 'Confirmar' }).click();

    await expect(page.getByRole('navigation', { name: 'Tira de slides do carrossel' })).toHaveCount(0);

    const after = await draftsSnapshot(page);
    expect(after?.activeDraftId).toBe(before?.activeDraftId);
    expect(after?.activeKind).toBe('single');

    // O aviso de conversão oferece Desfazer.
    const toast = page.getByRole('alert').filter({ hasText: 'Carrossel convertido' });
    await toast.getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByRole('navigation', { name: 'Tira de slides do carrossel' })).toBeVisible();
  });
});
