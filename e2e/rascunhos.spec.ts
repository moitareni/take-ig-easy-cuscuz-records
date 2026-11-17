import { expect, test } from '@playwright/test';
import { carouselSnapshot, draftsSnapshot, goHome, startEditor, waitForHome } from './helpers';

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
    // O lápis sai durante a edição e só volta quando o nome é confirmado.
    await expect(card.getByRole('button', { name: 'Renomear' })).toHaveCount(0);
    await input.fill('Flyer do forró');
    await input.press('Enter');

    const renamedCard = page.locator('article').filter({ hasText: 'Flyer do forró' });
    await expect(renamedCard).toHaveCount(1);
    await expect(renamedCard.getByRole('button', { name: 'Renomear' })).toBeVisible();
    await expect(page.locator('article').filter({ hasText: /Post de/ })).toHaveCount(0);

    // Clicar direto no nome também esconde o lápis; Esc cancela e o traz de volta.
    await renamedCard.getByRole('heading', { name: 'Flyer do forró' }).click();
    await expect(renamedCard.getByRole('button', { name: 'Renomear' })).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Nome do rascunho' }).press('Escape');
    await expect(renamedCard.getByRole('button', { name: 'Renomear' })).toBeVisible();

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

  test('duplicar carrossel, editar múltiplos slides e recarregar a página mantém todas as alterações', async ({ page }) => {
    // 1. Cria um carrossel original com 1 slide e fundo Pronto 1
    await startEditor(page, 'carousel', '3:4');
    await page.locator('button[title*="Pronto 1"]').first().click();
    await goHome(page);

    const origCard = page.locator('article').filter({ hasText: /Carrossel de/ }).first();
    await expect(origCard).toContainText('Carrossel · 1 slide');

    // 2. Duplica pela home e abre a cópia
    await origCard.getByRole('button', { name: 'Duplicar rascunho' }).click();
    const copyCard = page.locator('article').filter({ hasText: '(cópia)' });
    await expect(copyCard).toHaveCount(1);
    await copyCard.getByRole('button', { name: /^Abrir / }).click();
    await expect(page.getByRole('heading', { name: /1\. Escolha o fundo/ })).toBeVisible();

    // 3. Modifica o slide 1 (troca fundo e adiciona texto) e cria slide 2 com outro fundo
    await page.locator('button[title*="Pronto 2"]').first().click();
    await page.getByRole('button', { name: /4\. Texto/ }).click();
    await page.locator('button:has-text("+ Título")').click();
    const textarea = page.locator('textarea[placeholder="Digite o texto aqui..."]');
    await textarea.fill('EDITADO NA CÓPIA');

    await page.getByRole('button', { name: 'Novo slide vazio' }).first().click();
    await expect(page.getByTestId('slide-badge')).toHaveText('Slide 2 de 2');
    await page.getByRole('button', { name: /1\. Fundo/ }).click();
    await page.locator('button[title*="Pronto 3"]').first().click();

    // Aguarda o indicador Salvo antes de forçar reload na página inteira (sem clicar Voltar)
    await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 5000 });
    await page.reload();
    await waitForHome(page);

    // 4. Na home, a cópia aparece em "Continuar de onde parou" e já exibe 2 slides
    const continueHero = page.locator('section').filter({ hasText: 'Continuar de onde parou' });
    await expect(continueHero).toContainText('(cópia)');
    const updatedCopyCard = page.locator('article').filter({ hasText: '(cópia)' });
    await expect(updatedCopyCard).toContainText('Carrossel · 2 slides');

    // 5. Reabre a cópia e confirma que todas as alterações dos slides voltaram íntegras
    await updatedCopyCard.getByRole('button', { name: /^Abrir / }).click();
    await expect(page.getByRole('navigation', { name: 'Tira de slides do carrossel' })).toBeVisible();

    const restoredCopy = await carouselSnapshot(page);
    expect(restoredCopy?.slides).toHaveLength(2);
    expect(restoredCopy?.slides[0].doc.backgroundId).not.toBe('pronto-1');
    expect(
      JSON.stringify(restoredCopy?.slides[0].doc.elements),
    ).toContain('EDITADO NA CÓPIA');
    expect(restoredCopy?.slides[1].doc.backgroundId).not.toBe(restoredCopy?.slides[0].doc.backgroundId);

    // 6. Confirma que o carrossel original permaneceu intacto (1 slide, Pronto 1)
    await goHome(page);
    const origAfter = page.locator('article').filter({ hasText: /Carrossel de/ }).filter({ hasNotText: '(cópia)' });
    await expect(origAfter).toContainText('Carrossel · 1 slide');
  });

  test('recarregar imediatamente após editar texto no carrossel duplicado preserva a edição via beforeunload', async ({ page }) => {
    await startEditor(page, 'carousel', '3:4');
    await page.locator('button[title*="Pronto 1"]').first().click();
    await goHome(page);

    await page.locator('article').first().getByRole('button', { name: 'Duplicar rascunho' }).click();
    const copyCard = page.locator('article').filter({ hasText: '(cópia)' });
    await copyCard.getByRole('button', { name: /^Abrir / }).click();

    await page.getByRole('button', { name: /4\. Texto/ }).click();
    await page.locator('button:has-text("+ Título")').click();
    const textarea = page.locator('textarea[placeholder="Digite o texto aqui..."]');
    await textarea.fill('SEM ESPERAR DEBOUNCE');

    // Reload imediato (sem aguardar "Salvo" do debounce)
    await page.reload();
    await waitForHome(page);

    await page.locator('article').filter({ hasText: '(cópia)' }).getByRole('button', { name: /^Abrir / }).click();
    await expect(page.getByRole('navigation', { name: 'Tira de slides do carrossel' })).toBeVisible();

    const snap = await carouselSnapshot(page);
    expect(JSON.stringify(snap?.slides[0].doc.elements)).toContain('SEM ESPERAR DEBOUNCE');
  });
});
