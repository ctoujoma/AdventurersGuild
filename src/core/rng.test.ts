import { describe, expect, it } from 'vitest';
import { Rng, hashString } from './rng';

describe('Rng', () => {
  it('repite la secuencia con la misma semilla', () => {
    const a = new Rng('partida-42');
    const b = new Rng('partida-42');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('da secuencias distintas con semillas distintas', () => {
    expect(new Rng(1).next()).not.toEqual(new Rng(2).next());
  });

  it('next() queda en [0, 1) e int() respeta los límites', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 2000; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      const k = rng.int(3, 6);
      expect(k).toBeGreaterThanOrEqual(3);
      expect(k).toBeLessThanOrEqual(6);
    }
  });

  it('weighted() nunca elige opciones con peso 0', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 500; i++) {
      expect(
        rng.weighted([
          ['a', 1],
          ['b', 0],
          ['c', 3],
        ] as const),
      ).not.toBe('b');
    }
  });

  it('hashString es estable', () => {
    expect(hashString('brom')).toBe(hashString('brom'));
    expect(hashString('brom')).not.toBe(hashString('lysa'));
  });
});
