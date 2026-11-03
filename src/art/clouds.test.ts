import { describe, expect, it } from 'vitest';
import { PHASES, bank, cumulus, paintCloud } from './clouds';
import { alpha } from './pixel';

describe('nubes', () => {
  const shapes = [cumulus('a', 170, 62, 0.85), cumulus('b', 84, 30, 0.45), bank('c', 96, 20)];

  it('la panza es plana y los lados no van cortados a cuchillo', () => {
    for (const s of shapes) {
      const b = paintCloud(s, 'day');
      const filled = (x: number, y: number) => alpha(b.get(x, y)) > 0;
      // La fila de la base, casi llena; la primera y la última columna, casi vacías.
      let base = 0;
      for (let x = 0; x < b.w; x++) if (filled(x, b.h - 2)) base++;
      expect(base / b.w).toBeGreaterThan(0.85);
      for (const x of [0, b.w - 1]) {
        let col = 0;
        for (let y = 0; y < b.h; y++) if (filled(x, y)) col++;
        expect(col / b.h).toBeLessThan(0.5);
      }
    }
  });

  it('la misma silueta a todas las horas (se funden una en otra)', () => {
    for (const s of shapes) {
      const masks = PHASES.map((ph) => Array.from(paintCloud(s, ph).data, (c) => alpha(c) > 0));
      for (const m of masks) expect(m).toEqual(masks[0]);
    }
  });
});
