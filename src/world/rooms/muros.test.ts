import { describe, expect, it } from 'vitest';
import { alpha, PixelBuffer } from '../../art/pixel';
import { WALLS, type WallId } from '../../data/custom';
import { wallFace, wallSection } from './muros';

describe('paredes', () => {
  const ids = Object.keys(WALLS) as WallId[];

  it('cada pared, de frente y en corte, tapa su trozo entero (no asoma lo de debajo)', () => {
    for (const id of ids)
      for (const h of [50, 212]) {
        const f = new PixelBuffer(90, h);
        wallFace(f, 0, 0, 90, h, 'prueba', id);
        const s = new PixelBuffer(16, h);
        wallSection(s, 0, 0, 16, h, true, id);
        expect(f.data.every((c) => alpha(c) === 255)).toBe(true);
        expect(s.data.every((c) => alpha(c) === 255)).toBe(true);
      }
  });

  it('cada una con su dibujo (ninguna sale igual que otra)', () => {
    const seen = new Set<string>();
    for (const id of ids) {
      const f = new PixelBuffer(40, 40);
      wallFace(f, 0, 0, 40, 40, 'prueba', id);
      seen.add(Array.from(f.data).join(','));
    }
    expect(seen.size).toBe(ids.length);
  });
});
