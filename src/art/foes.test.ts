import { describe, expect, it } from 'vitest';
import type { FoeKind } from '../data/journey';
import { FOE_POSES, foeArt } from './foes';
import { alpha } from './pixel';

const KINDS: FoeKind[] = ['bandido', 'trasgo', 'bestia', 'alimana', 'muerto', 'grande'];
const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const filled = (b: { w: number; h: number; get(x: number, y: number): number }) => {
  let n = 0;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (alpha(b.get(x, y))) n++;
  return n;
};

describe('enemigos por familias', () => {
  it('cada uno tiene todas sus poses, de pie del mismo tamaño y distintas entre sí', () => {
    for (const k of KINDS)
      for (const s of SEEDS) {
        const a = foeArt(k, s);
        expect(a.kind).toBe(k);
        const { idle } = a.poses;
        for (const p of FOE_POSES) {
          expect(filled(a.poses[p])).toBeGreaterThan(20);
          if (p === 'down') continue;
          expect([a.poses[p].w, a.poses[p].h]).toEqual([idle.w, idle.h]);
        }
        expect(a.poses.strike.data.join()).not.toBe(idle.data.join());
        expect(a.poses.walk1.data.join()).not.toBe(a.poses.walk2.data.join());
        // Caído: tumbado, más ancho que alto. (El dibujo de pie deja sitio arriba al arma alzada.)
        expect(a.poses.down.w).toBeGreaterThanOrEqual(a.poses.down.h);
      }
  });

  it('el grande es el doble que un héroe; los demás, de su tamaño', () => {
    for (const s of SEEDS) {
      expect(foeArt('grande', s).big).toBe(true);
      expect(foeArt('grande', s).poses.idle.h).toBeGreaterThan(50);
      for (const k of KINDS.filter((x) => x !== 'grande')) {
        expect(foeArt(k, s).big).toBe(false);
        expect(foeArt(k, s).poses.idle.h).toBeLessThanOrEqual(42);
      }
    }
  });

  it('la misma semilla da el mismo enemigo, y otras semillas dan variedad', () => {
    expect(foeArt('bandido', 'x').poses.idle).toBe(foeArt('bandido', 'x').poses.idle);
    for (const k of KINDS) {
      const looks = new Set(SEEDS.map((s) => foeArt(k, s).poses.idle.data.join()));
      expect(looks.size).toBeGreaterThan(1);
    }
  });
});
