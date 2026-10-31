import { describe, expect, it } from 'vitest';
import { alpha } from './pixel';
import { CAT_F, DOG_F, catStrip, dogStrip, type Strip } from './pets';

/** Píxeles con algo pintado en un fotograma de la tira. */
const filled = (s: Strip, i: number) => {
  let n = 0;
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) if (alpha(s.img.get(i * s.w + x, y))) n++;
  return n;
};

describe('animales del salón', () => {
  it.each([
    ['gato', catStrip(), Object.values(CAT_F)],
    ['perro', dogStrip(), Object.values(DOG_F)],
  ] as const)(
    '%s: cada fotograma tiene dibujo y su gemelo mirando a la izquierda',
    (_, s, used) => {
      expect(s.img.w).toBe(s.w * s.n * 2);
      for (const f of used) expect(f).toBeLessThan(s.n);
      for (let i = 0; i < s.n; i++) {
        expect(filled(s, i)).toBeGreaterThan(20);
        expect(filled(s, s.n + i)).toBe(filled(s, i));
      }
    },
  );
});
