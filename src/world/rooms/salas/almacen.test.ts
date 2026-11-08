import { describe, expect, it } from 'vitest';
import { materialIcon, slotIcon } from '../../../art/materials';
import { itemIcon } from '../../../art/items';
import { MATERIAL_LIST } from '../../../core/materials';
import { NO_LOOK, type SalonLook } from '../salon';
import { cornerPile, pile, unitsOf } from './almacen';
import { ART } from '.';
import { worldW } from './kit';
import { CELL_W, WALL } from '../layout';
import type { Room } from '../../../core/model';

const filled = (b: { data: Uint32Array }) => b.data.filter((c) => c >>> 24).length;
const look = (fill: SalonLook['mats']['fill'], store: boolean): SalonLook => ({
  ...NO_LOOK,
  mats: { fill, store },
});

describe('materiales', () => {
  it('cada material, a 16 y a 32, y distintos entre sí', () => {
    for (const size of [16, 32] as const) {
      const all = MATERIAL_LIST.map((m) => materialIcon(m, size));
      for (const b of all) {
        expect([b.w, b.h]).toEqual([size, size]);
        expect(filled(b)).toBeGreaterThan(size * 2);
      }
      expect(new Set(all.map((b) => b.data.join())).size).toBe(MATERIAL_LIST.length);
    }
    expect(slotIcon('arma', 32).w).toBe(32);
  });

  it('los objetos mejorados llevan una raya por mejora', () => {
    const plain = itemIcon('espada', 0);
    expect(itemIcon('espada', 0, 0)).toBe(plain);
    expect(filled(itemIcon('espada', 0, 3))).toBeGreaterThan(filled(itemIcon('espada', 0, 1)));
  });
});

describe('el almacén', () => {
  it('tiene dibujo y las pilas crecen con lo guardado', () => {
    expect(ART.almacen).toBeDefined();
    for (const m of MATERIAL_LIST) {
      expect(unitsOf(m, 0)).toBe(0);
      expect(unitsOf(m, 0.01)).toBe(1);
      expect(filled(pile(m, unitsOf(m, 1)))).toBeGreaterThan(filled(pile(m, unitsOf(m, 0.3))));
    }
  });

  it('en una sala de un hueco con los seis, nada se sale de ella', () => {
    const w = CELL_W - 2 * WALL;
    const all = Object.fromEntries(MATERIAL_LIST.map((m) => [m, 1]));
    const things = ART.almacen!.things!({ w: 1, level: 2 } as Room, w, look(all, true));
    for (const t of things) {
      const half = worldW(t.img, t.z) / 2;
      expect(t.x - half).toBeGreaterThanOrEqual(0);
      expect(t.x + half).toBeLessThanOrEqual(w);
    }
  });

  it('sin almacén, el rincón de la bodega; con almacén o sin nada, no', () => {
    expect(cornerPile(look({ hierro: 0.5 }, false))).not.toBeNull();
    expect(cornerPile(look({ hierro: 0.5 }, true))).toBeNull();
    expect(cornerPile(look({ hierro: 0, cuero: 0 }, false))).toBeNull();
    const few = cornerPile(look({ hierro: 0.2, cuero: 0.2, tela: 0.2 }, false))!;
    const lots = cornerPile(look({ hierro: 1, cuero: 1, tela: 1 }, false))!;
    expect(filled(lots)).toBeGreaterThan(filled(few));
  });
});
