import { describe, expect, it } from 'vitest';
import { MAX_COLS, WING_COL, WING_MAX, WING_START } from '../../core/balance';
import type { Building, Room } from '../../core/model';
import { uncleBuilding } from '../../core/rooms';
import { DEPTH, roomsLayout } from './layout';
import { LAWN_D, treeHalf, tuftAllowed, yardBushes, yardTrees } from './patio';

const sala = (id: string, type: Room['type'], col: number): Room => ({
  id,
  type,
  col,
  floor: 0,
  w: 1,
  h: 1,
  level: 1,
  spent: 0,
});

/** El edificio a todo lo ancho y el anexo de `wing` huecos, con una sala en su primer hueco. */
function withWing(wing: number): Building {
  const b = uncleBuilding();
  b.cols = MAX_COLS;
  b.wing = wing;
  b.rooms.push(sala('a1', 'armas', WING_COL));
  return b;
}

describe('lo de fuera no se cuela en el jardín ni en el anexo', () => {
  for (let wing = WING_START; wing <= WING_MAX; wing++)
    it(`con un anexo de ${wing} huecos`, () => {
      const L = roomsLayout(withWing(wing));
      const g = L.garden!;
      // Árboles y arbustos: del todo a un lado del edificio, el jardín y el anexo.
      for (const t of yardTrees(L)) {
        const h = treeHalf(t);
        expect(t.x + h <= L.left || t.x - h >= L.right).toBe(true);
      }
      for (const b of yardBushes(L)) expect(b.x + 11 <= L.left || b.x - 11 >= L.right).toBe(true);
      // Matas: ninguna en el césped del jardín ni en el anexo (ni en sus solares vacíos).
      for (let x = g.x + 10; x < g.x + g.w - 10; x += 7)
        for (let z = 0; z < LAWN_D - 10; z += 5) expect(tuftAllowed(L, x, z)).toBe(false);
      for (let x = g.x + g.w; x < L.right; x += 7)
        for (let z = 0; z < DEPTH + 8; z += 5) expect(tuftAllowed(L, x, z)).toBe(false);
      // Detrás del jardín, en su borde sin segar, sí.
      expect(tuftAllowed(L, g.x + g.w / 2, LAWN_D - 4)).toBe(true);
    });
});
