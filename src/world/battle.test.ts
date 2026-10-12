import { describe, expect, it } from 'vitest';
import { HAND, fightSprites, generateLook } from '../art/heroes/hero';
import { MOVES } from './battle';
import { WEAPONS } from './weapons';

describe('combate con estilo', () => {
  it('cada clase y cada tipo de bandido tiene al menos tres ataques distintos', () => {
    for (const [style, moves] of Object.entries(MOVES)) {
      expect(moves.length, style).toBeGreaterThanOrEqual(3);
      for (const m of moves) {
        expect(m.hits.length).toBeGreaterThan(0);
        expect(m.hits.every((h) => h > 0 && h <= 1)).toBe(true);
        // Todas las fases del ataque dan una pose válida.
        for (const p of [0, 0.25, 0.5, 0.75, 1])
          expect(HAND[m.frame(p, {} as never).pose]).toBeDefined();
      }
    }
  });

  it('hay poses de combate para todas las clases y las armas tienen su agarre dentro', () => {
    for (const cls of ['guerrero', 'picaro', 'mago', 'clerigo', 'explorador'] as const) {
      const poses = fightSprites(generateLook(cls, cls, 'f'));
      expect(Object.keys(poses)).toEqual(['ready', 'windup', 'strike', 'up', 'thrust']);
    }
    for (const w of Object.values(WEAPONS)) {
      expect(w.px).toBeLessThan(w.img.w);
      expect(w.py).toBeLessThan(w.img.h);
    }
  });
});
