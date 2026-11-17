import { describe, expect, it } from 'vitest';
import { generateLook, heroSprites } from '../../art/heroes/hero';
import { rgba } from '../../art/pixel';
import { P } from '../../art/palette';
import type { SceneHero } from '../scene';
import { ATLAS_H, ATLAS_W, F, atlas, cellOf } from './crowd';

/** Los píxeles de un fotograma del atlas (24 × 28, en su celda de la rejilla). */
const cell = (img: ReturnType<typeof atlas>, i: number) => {
  const [x0, y0] = cellOf(i);
  const out: number[] = [];
  for (let y = y0; y < y0 + 28; y++)
    for (let x = x0; x < x0 + 24; x++) out.push(img.data[y * img.w + x]!);
  return out;
};

describe('atlas de la gente', () => {
  it('cabe en una textura de cualquier móvil (4096 px de lado)', () => {
    expect(ATLAS_W).toBeLessThanOrEqual(4096);
    expect(ATLAS_H).toBeLessThanOrEqual(4096);
  });

  it('el trago: en cada cama, tres tiempos distintos, todos con la jarra de espuma', () => {
    const look = generateLook('trago', 'tabernero', 'f');
    const h = { id: 'h', name: '', title: '', status: 'ok', look, marks: {}, guard: false };
    const img = atlas(heroSprites(look, {}), h as SceneHero);
    const foam = rgba(P.white);
    for (let slot = 0; slot < 13; slot++) {
      const up = cell(img, slot < 6 ? F.up + slot : F.upT + slot - 6).join();
      const sips = [0, 1, 2].map((k) => cell(img, F.sip + slot * 3 + k));
      expect(new Set([up, ...sips.map((c) => c.join())]).size).toBe(4);
      for (const c of sips) expect(c.includes(foam)).toBe(true);
    }
  });
});
