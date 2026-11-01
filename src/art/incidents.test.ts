import { describe, expect, it } from 'vitest';
import { alpha } from './pixel';
import {
  BLAZE_F,
  BLAZE_W,
  BRAWL_F,
  blazeStrip,
  brawlStrip,
  nobleStrip,
  taxmanStrip,
  thiefStrip,
} from './incidents';

/** Píxeles con algo en el fotograma `i` de una tira de `w` de ancho. */
function filled(img: { get(x: number, y: number): number; h: number }, w: number, i: number) {
  let n = 0;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < w; x++) if (alpha(img.get(i * w + x, y))) n++;
  return n;
}

describe('dibujos de los incidentes', () => {
  it('las figuras tienen todos sus fotogramas, y distintos', () => {
    for (const [s, n] of [
      [brawlStrip(), BRAWL_F],
      [thiefStrip(), 2],
      [taxmanStrip(), 2],
      [nobleStrip(), 3],
    ] as const) {
      expect(s.n).toBe(n);
      expect(s.img.w).toBe(s.w * n * 2);
      const frames = Array.from({ length: n }, (_, i) =>
        Array.from({ length: s.w * s.h }, (_, k) =>
          s.img.get(i * s.w + (k % s.w), Math.floor(k / s.w)),
        ).join(),
      );
      expect(new Set(frames).size).toBe(n);
      for (let i = 0; i < n; i++) expect(filled(s.img, s.w, i)).toBeGreaterThan(60);
    }
  });

  it('las llamas cambian de un fotograma a otro', () => {
    const b = blazeStrip();
    expect(b.w).toBe(BLAZE_W * BLAZE_F);
    const sizes = Array.from({ length: BLAZE_F }, (_, i) => filled(b, BLAZE_W, i));
    expect(Math.min(...sizes)).toBeGreaterThan(150);
    expect(new Set(sizes).size).toBeGreaterThan(1);
  });
});
