import { describe, expect, it } from 'vitest';
import { P } from '../../art/palette';
import { PixelBuffer, rgba } from '../../art/pixel';
import { groundTex } from './textures';
import { moodGround } from './suelo';

describe('suelo (luz con ambiente)', () => {
  it('no deja ningún verde de la paleta de siempre', () => {
    const src = groundTex(64, 40, true, 'prueba');
    const out = moodGround(src);
    const old = new Set([P.deep, P.forest, P.leaf, P.lime].map(rgba));
    expect(out.data.some((c) => old.has(c))).toBe(false);
  });

  it('la tierra sigue siendo tierra (el camino no se pierde)', () => {
    const src = new PixelBuffer(8, 4);
    src.rect(0, 0, 8, 4, P.bark);
    const out = moodGround(src);
    const c = out.get(3, 2);
    expect(c & 255).toBeGreaterThan((c >> 8) & 255);
  });
});

describe('el camino del patio', () => {
  it('va delante (la fila 0 de la textura es la del fondo)', () => {
    const b = groundTex(64, 40, true, 'camino', false);
    const dirt = (y: number) =>
      Array.from({ length: 64 }, (_, x) => b.get(x, y)).filter((c) =>
        [P.umber, P.bark, P.mocha, P.cocoa].map(rgba).includes(c),
      ).length;
    expect(dirt(40 - 8)).toBeGreaterThan(dirt(8));
  });
});
