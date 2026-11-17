import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { startEditor } from './helpers';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'foto.png');

test.describe('Etapa 3 - Imagens do usuário', () => {
  test('upload, transformações, limite de 5 e export', async ({ page }) => {
    await page.goto('/');
    await startEditor(page);

    // Fundo obrigatório → Enfeites
    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.locator('footer button:has-text("Próximo")').click();

    // Etapa 3: Imagem
    await page.locator('footer button:has-text("Pular (sem enfeites)")').click();
    await expect(page.locator('h2')).toContainText('3. Sua imagem');
    await expect(page.locator('text=0 de 5')).toBeVisible();

    // Upload via seletor
    const addInput = page.locator('input[type="file"]').first();
    await addInput.setInputFiles(FIXTURE);
    await expect(page.locator('text=Na folha (1/5)')).toBeVisible();

    // A imagem entra selecionada e o card de opções aparece
    await expect(page.getByText('Imagem Selecionada')).toBeVisible();

    // Espelha horizontal e verticalmente pelo dock direito (AlignToolbar)
    await page.getByRole('button', { name: 'Espelhar horizontalmente' }).click();
    await page.getByRole('button', { name: 'Espelhar verticalmente' }).click();

    // A gravação no histórico de undo agrupa mudanças a cada ~400ms:
    // espera a janela passar para que remover/voltar enregistre states distintos.
    await page.waitForTimeout(450);

    // Remove e volta com undo (sem imagens a lista nem é renderizada)
    await page.getByRole('button', { name: 'Excluir (Delete)' }).click();
    await expect(page.locator('text=Na folha (1/5)')).toHaveCount(0);
    await page.waitForTimeout(450);
    await page.keyboard.press('Control+z');
    await expect(page.locator('text=Na folha (1/5)')).toBeVisible();

    // O undo volta sem seleção: seleciona na lista para reabrir o card
    await page.locator('button[title="foto"]').click();
    await expect(page.getByText('Imagem Selecionada')).toBeVisible();

    // Reordena camadas sem erro (dock direito)
    await page.getByRole('button', { name: 'Trazer para frente' }).click();
    await page.getByRole('button', { name: 'Enviar para trás' }).click();

    // Enche a folha até o limite de 5
    for (let i = 2; i <= 5; i++) {
      await addInput.setInputFiles(FIXTURE);
      await expect(page.locator(`text=Na folha (${i}/5)`)).toBeVisible();
    }
    await expect(page.locator('text=Folha cheia de imagens!')).toBeVisible();

    // A 6ª é bloqueada com toast amigável
    await addInput.setInputFiles(FIXTURE);
    await expect(page.locator('text=Tá lotado! Cabem até 5 imagens por post 😅')).toBeVisible();

    // Export com imagens na folha
    await page.getByRole('button', { name: /6\. Textura/ }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^cuscuz-post-\d{4}-\d{2}-\d{2}-\d{4}\.png$/);
    await expect(page.locator('text=Post salvo com sucesso!')).toBeVisible();
  });

  test('solta arquivo direto na folha e importa na posição do cursor', async ({ page }) => {
    await page.goto('/');
    await startEditor(page);

    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.locator('footer button:has-text("Próximo")').click();
    await page.locator('footer button:has-text("Pular (sem enfeites)")').click();
    await expect(page.locator('h2')).toContainText('3. Sua imagem');

    // Monta o DataTransfer com a fixture dentro do contexto da página
    const png = await fs.readFile(FIXTURE);
    const dataTransfer = await page.evaluateHandle((b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const file = new File([bytes], 'foto.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      return dt;
    }, png.toString('base64'));

    // drop direto na área da folha (o evento "dragenter/dragover" já é
    // repassado pelo guard global: sem preventDefault não havia drop)
    const folha = page.locator('[aria-label="Folha de criação"]').locator('div').first();
    await folha.dispatchEvent('drop', { dataTransfer });

    // Importou para o doc e está na lista
    await expect(page.locator('text=Na folha (1/5)')).toBeVisible();
    // Navegação guardada: ainda na página do app
    expect(page.url()).not.toContain('blob:');
  });

  test('remover fundo: quadro fixo, clique fora não fecha e zero download', async ({ page }) => {
    // O modelo só pode ser baixado quando um tipo é escolhido — este teste
    // valida a UI sem tocar na rede.
    const hfRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('huggingface')) hfRequests.push(req.url());
    });

    await page.goto('/');
    await startEditor(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.locator('footer button:has-text("Próximo")').click();
    await page.locator('footer button:has-text("Pular (sem enfeites)")').click();
    await expect(page.locator('h2')).toContainText('3. Sua imagem');

    const addInput = page.locator('input[type="file"]').first();
    await addInput.setInputFiles(FIXTURE);
    await expect(page.locator('text=Na folha (1/5)')).toBeVisible();

    // Botão do card abre o quadro — que nasce NO LUGAR do botão
    await page.getByRole('button', { name: 'Remover fundo', exact: true }).click();
    const panel = page.getByRole('group', { name: 'Remover fundo' });
    await expect(panel).toContainText('O que há na imagem para recortar?');
    await expect(page.getByRole('button', { name: 'Pessoa', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Objeto', exact: true })).toBeVisible();
    // O quadro substituiu o botão dentro do card
    await expect(page.getByRole('button', { name: 'Remover fundo', exact: true })).toHaveCount(0);

    // Nota da primeira vez (modelo ainda não baixado), com "!" no lugar do emoji
    await expect(panel).toContainText('uma vez só e guardamos no navegador');
    await expect(panel).not.toContainText('🌽');

    // Clicar na folha deseleciona a imagem, mas o quadro NÃO fecha: só o X fecha.
    // (A folha são N canvas de layers Konva empilhados; a de baixo não recebe
    // pointer-events, então o clique é físico por coordenadas.)
    const canvasBox = await page
      .locator('section[aria-label="Folha de criação"] canvas')
      .first()
      .boundingBox();
    await page.mouse.click(canvasBox.x + 24, canvasBox.y + 24);
    await expect(page.getByText('Imagem Selecionada')).toHaveCount(0);
    await expect(panel).toBeVisible();

    // X fecha sem escolher nada
    await page.getByRole('button', { name: 'Fechar' }).click();
    await expect(panel).toHaveCount(0);

    // A lista não tem mais tesourinha: selecionar na lista e recortar pelo card
    await page.locator('button[title="foto"]').click();
    await page.getByRole('button', { name: 'Remover fundo', exact: true }).click();
    await expect(panel).toContainText('O que há na imagem para recortar?');
    await page.getByRole('button', { name: 'Fechar' }).click();
    await expect(panel).toHaveCount(0);

    // Nenhum tipo escolhido: nada do modelo passou pela rede
    expect(hfRequests).toEqual([]);
  });

  test('card da imagem fica enxuto: só Trocar imagem e Remover fundo', async ({ page }) => {
    await page.goto('/');
    await startEditor(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.locator('footer button:has-text("Próximo")').click();
    await page.locator('footer button:has-text("Pular (sem enfeites)")').click();
    await expect(page.locator('h2')).toContainText('3. Sua imagem');

    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await expect(page.getByText('Imagem Selecionada')).toBeVisible();

    // Sobraram só os dois botões, lado a lado
    await expect(page.getByRole('button', { name: 'Trocar imagem' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remover fundo', exact: true })).toBeVisible();

    // O que era duplicado do dock direito saiu do card
    await expect(page.getByRole('button', { name: 'Espelhar ↔' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Espelhar ↕' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Trazer pra frente' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Enviar pra trás' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remover imagem selecionada' })).toHaveCount(0);

    // A tesourinha da lista "Na folha" também foi
    await expect(page.getByRole('button', { name: /^Remover fundo de / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remover imagem' })).toBeVisible();
  });

  test('modos de recorte lado a lado, com explicação no (i) e sem travessão', async ({ page }) => {
    await page.goto('/');
    await startEditor(page);
    await page.locator('button[title*="Pronto 1"]').first().click();
    await page.locator('footer button:has-text("Próximo")').click();
    await page.locator('footer button:has-text("Pular (sem enfeites)")').click();
    await expect(page.locator('h2')).toContainText('3. Sua imagem');

    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('button', { name: 'Remover fundo', exact: true }).click();
    const panel = page.getByRole('group', { name: 'Remover fundo' });

    // Um ao lado do outro: mesma linha, colunas diferentes
    const pessoa = await page.getByRole('button', { name: 'Pessoa', exact: true }).boundingBox();
    const objeto = await page.getByRole('button', { name: 'Objeto', exact: true }).boundingBox();
    expect(pessoa!.y).toBeCloseTo(objeto!.y, 0);
    expect(objeto!.x).toBeGreaterThan(pessoa!.x + pessoa!.width - 1);

    // A explicação não fica solta no cartão: o balão começa escondido
    await expect(page.getByRole('tooltip')).not.toBeVisible();
    const infoPessoa = page.getByRole('button', { name: 'Como funciona o modo Pessoa' });
    const infoObjeto = page.getByRole('button', { name: 'Como funciona o modo Objeto' });
    await expect(infoPessoa).toContainText('?');
    await expect(infoObjeto).toContainText('?');

    // O balão abre no hover, fica POR CIMA do cartão vizinho e some na saída
    await infoPessoa.hover();
    const tip = page.getByRole('tooltip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Pra retratos e figuras, com cabelo e detalhes suaves preservados');

    // Regressão de empilhamento: o cartão "Objeto" não pode cobrir o balão.
    const balaoNoTopo = await page.evaluate(() => {
      // Há mais de um (?) na etapa; interessa o balão aberto.
      const balao = Array.from(document.querySelectorAll('[role="tooltip"]')).find(
        (el) => getComputedStyle(el).visibility === 'visible',
      );
      if (!balao) return false;
      const r = balao.getBoundingClientRect();
      const x = r.left + r.width * 0.75;
      const y = r.top + r.height * 0.5;
      const el = document.elementFromPoint(x, y);
      return !!el && (balao === el || balao.contains(el));
    });
    expect(balaoNoTopo).toBe(true);

    await page.mouse.move(0, 0);
    await expect(tip).not.toBeVisible();

    // Nenhum texto do painel usa travessão
    const textos = await panel.locator('strong, p, span').allInnerTexts();
    expect(textos.join(' ')).not.toContain('—');
  });
});


test.describe('Ctrl+V na folha', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  async function copyFixtureImage(page: Page) {
    const png = await fs.readFile(FIXTURE);
    await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'image/png' });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    }, png.toString('base64'));
  }

  async function imageCount(page: Page): Promise<number> {
    return page.evaluate(
      () =>
        (
          window as unknown as {
            __useEditor: { getState: () => { doc: { elements: { kind: string }[] } } };
          }
        ).__useEditor
          .getState()
          .doc.elements.filter((e) => e.kind === 'image').length,
    );
  }

  test('cola a imagem da área de transferência: entra selecionada e abre a aba de imagem', async ({ page }) => {
    await page.goto('/');
    await startEditor(page);
    // Começa no Passo 1 (Fundo): o paste precisa levar o painel para a etapa de imagens.
    await expect(page.getByRole('heading', { name: /1\. Escolha o fundo/ })).toBeVisible();

    await copyFixtureImage(page);
    await page.keyboard.press('Control+v');

    await expect(page.locator('h2')).toContainText('3. Sua imagem');
    await expect(page.locator('text=Na folha (1/5)')).toBeVisible();
    await expect(page.getByText('Imagem Selecionada')).toBeVisible();
    await expect(page.locator('button[title="Imagem colada"]')).toBeVisible();

    // Segunda colagem: soma outra imagem
    await copyFixtureImage(page);
    await page.keyboard.press('Control+v');
    await expect(page.locator('text=Na folha (2/5)')).toBeVisible();
  });

  test('sem imagem na área de transferência não cola nada', async ({ page }) => {
    await page.goto('/');
    await startEditor(page);

    await page.evaluate(() => navigator.clipboard.writeText('só texto, nada de imagem'));
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(600);

    // Continua no Passo 1 e nenhuma imagem entrou na folha
    await expect(page.getByRole('heading', { name: /1\. Escolha o fundo/ })).toBeVisible();
    expect(await imageCount(page)).toBe(0);
  });
});
