import { expect, type Page } from '@playwright/test';

export type EditorMode = 'single' | 'carousel';
export type CarouselFormat = '3:4' | '4:3' | '1:1';

export type StoredMode = EditorMode | null;

export interface CarouselSnapshot {
  mode: StoredMode;
  format: string;
  slides: Array<{ doc: { backgroundId: string | null; elements: unknown[] } }>;
}

const MODE_DIALOG = 'Escolha o modo de criação';

const FORMAT_LABELS: Record<CarouselFormat, string> = {
  '3:4': 'Vertical (3:4)',
  '4:3': 'Horizontal (4:3)',
  '1:1': 'Quadrado (1:1)',
};

/**
 * O ModeSelector é um overlay de tela cheia no primeiro acesso e intercepta
 * qualquer clique no editor. Dispensa-o antes de interagir com a folha; não faz
 * nada quando o modo já veio restaurado do localStorage.
 */
export async function dismissModeSelector(page: Page, mode: EditorMode = 'single'): Promise<void> {
  // O ModeSelector é carregado via React.lazy: no instante do load ele pode ainda
  // não existir no DOM. Perguntar ao store evita um "não está visível" falso.
  const needsChoice = await page.evaluate(() => {
    const w = window as unknown as {
      __useCarousel?: { getState: () => { mode: StoredMode } };
    };
    return w.__useCarousel?.getState().mode == null;
  });
  if (!needsChoice) return;

  const dialog = page.getByRole('dialog', { name: MODE_DIALOG });
  await dialog.waitFor({ state: 'visible' });

  if (mode === 'single') {
    await dialog.getByRole('button', { name: /Post único/ }).click();
  } else {
    await dialog.getByRole('button', { name: /Carrossel/ }).click();
    await dialog.getByRole('button', { name: 'Bora criar carrossel!' }).click();
  }
  await expect(dialog).toBeHidden();
}

/** Abre o app já no Post único. */
export async function openSingle(page: Page): Promise<void> {
  await page.goto('/');
  await dismissModeSelector(page, 'single');
}

/** Abre o app já no Carrossel, escolhendo o formato na segunda tela. */
export async function openCarousel(page: Page, format: CarouselFormat = '3:4'): Promise<void> {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: MODE_DIALOG });
  await dialog.getByRole('button', { name: /Carrossel/ }).click();
  await dialog.getByRole('button', { name: FORMAT_LABELS[format], exact: true }).click();
  await dialog.getByRole('button', { name: 'Bora criar carrossel!' }).click();
  await expect(dialog).toBeHidden();
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
