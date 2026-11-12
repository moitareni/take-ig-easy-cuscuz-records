import { describe, expect, it } from 'vitest';
import { buildTransformPatches } from './multiSelect';
import type { TextEl } from '../types';

const title = (extra: Partial<TextEl> = {}): TextEl => ({
  id: 't1',
  kind: 'text',
  style: 'title',
  text: 'SONORIDADE',
  x: 540,
  y: 720,
  rotation: 0,
  scale: 1,
  fontSize: 120,
  lineHeight: 1,
  letterSpacing: 0,
  align: 'center',
  uppercase: true,
  color: 'preto',
  brandEffect: false,
  border: 'none',
  ...extra,
});

describe('buildTransformPatches — área de texto', () => {
  it('escala a largura definida junto com a fonte (altura é automática)', () => {
    const el = title({ boxWidth: 300 });
    const [patch] = buildTransformPatches([el], [
      { id: 't1', x: 540, y: 720, rotation: 0, scaleX: 2 },
    ]);
    expect(patch.patch).toMatchObject({ fontSize: 240, boxWidth: 600, scale: 1 });
    expect(patch.patch).not.toHaveProperty('boxHeight');
  });

  it('não inventa largura para texto ainda automático', () => {
    const el = title();
    const [patch] = buildTransformPatches([el], [
      { id: 't1', x: 540, y: 720, rotation: 0, scaleX: 1.5 },
    ]);
    expect(patch.patch).not.toHaveProperty('boxWidth');
    expect((patch.patch as Partial<TextEl>).fontSize).toBe(180);
  });
});
