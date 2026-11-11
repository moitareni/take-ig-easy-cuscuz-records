import { expect, type Page } from '@playwright/test';

export type EditorMode = 'single' | 'carousel';
export type CarouselFormat = '3:4' | '4:3' | '1:1';

export type StoredMode = EditorMode | null;

export interface CarouselSnapshot {
  mode: StoredMode;
  format: string;
  slides: Array<{ doc: { backgroundId: string | null; elements: unknown[] } }>;
}

export interface DraftsSnapshot {
  screen: 'boot' | 'home' | 'editor';
  activeDraftId: string | null;
  activeKind: 'single' | 'carousel' | null;
  drafts: Array<{ id: string; title: string; kind: 'single' | 'carousel' }>;
}

const FORMAT_LABELS: Record<CarouselFormat, string> = {
  '3:4': 'Vertical (3:4)',
  '4:3': 'Horizontal (4:3)',
  '1:1': 'Quadrado (1:1)',
};

export const CREATE_SINGLE = /^(Post único|Criar post único)$/;
export const CREATE_CAROUSEL = /^(Carrossel|Criar carrossel)$/;

/** Espera a home "Meus rascunhos" terminar o boot (migração + IndexedDB). */
export async function waitForHome(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: CREATE_SINGLE }).first()).toBeVisible();
}

/**
 * Entra no editor pela home: "Post único" cria na hora; "Carrossel" passa pelo
 * diálogo de formato. Termina quando o Passo 1 (Fundo) está visível.
 */
export async function startEditor(
  page: Page,
  mode: EditorMode = 'single',
  format: CarouselFormat = '3:4',
): Promise<void> {
  await page.goto('/');
  await waitForHome(page);

  if (mode === 'single') {
    await page.getByRole('button', { name: CREATE_SINGLE }).first().click();
  } else {
    await page.getByRole('button', { name: CREATE_CAROUSEL }).first().click();
    const dialog = page.getByRole('dialog', { name: /Escolha o formato do carrossel/ });
    await dialog.getByRole('button', { name: FORMAT_LABELS[format], exact: true }).click();
    await dialog.getByRole('button', { name: 'Bora criar carrossel!' }).click();
  }

  await expect(page.getByRole('heading', { name: /1\. Escolha o fundo/ })).toBeVisible();
}

/** Abre o app já no Post único. */
export async function openSingle(page: Page): Promise<void> {
  await startEditor(page, 'single');
}

/** Abre o app já no Carrossel, escolhendo o formato na home. */
export async function openCarousel(page: Page, format: CarouselFormat = '3:4'): Promise<void> {
  await startEditor(page, 'carousel', format);
}

/** Volta para a home esperando a lista de rascunhos aparecer. */
export async function goHome(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Voltar para Meus rascunhos' }).click();
  await waitForHome(page);
}

/** Abre o dropdown de modo e escolhe uma opção; não confirma os diálogos seguintes. */
export async function chooseMode(page: Page, target: EditorMode): Promise<void> {
  await page.getByTestId('mode-dropdown-trigger').click();
  await page
    .getByRole('option', { name: target === 'single' ? /Post único/ : /Carrossel/ })
    .click();
}

/** Estado bruto do store de carrossel exposto em window no boot. */
export async function carouselSnapshot(page: Page): Promise<CarouselSnapshot | null> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __useCarousel?: { getState: () => CarouselSnapshot };
    };
    return w.__useCarousel?.getState() ?? null;
  });
}

/** Estado bruto do store de rascunhos (tela ativa, lista e rascunho aberto). */
export async function draftsSnapshot(page: Page): Promise<DraftsSnapshot | null> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __useDraftsStore?: { getState: () => DraftsSnapshot };
    };
    return w.__useDraftsStore?.getState() ?? null;
  });
}
