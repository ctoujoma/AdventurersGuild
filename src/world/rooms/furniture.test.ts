import { describe, expect, it } from 'vitest';
import { ROOMS, type RoomType } from '../../data/rooms';
import type { Room } from '../../core/model';
import { furnish } from './furniture';
import { CELL_W, DEPTH, PARTITION } from './layout';
import { scaleAt } from './view3d';

const room = (type: RoomType, r: Partial<Room> = {}): Room => ({
  id: 'x',
  type,
  col: 0,
  floor: 0,
  w: 1,
  h: 1,
  level: 1,
  spent: 0,
  ...r,
});

describe('muebles de la vista 3D', () => {
  it('cada sala en uso tiene sus muebles dentro y su farol encendido', () => {
    for (const type of Object.keys(ROOMS) as RoomType[]) {
      if (type === 'torre') continue;
      for (const w of [1, 2]) {
        const iw = w * CELL_W - PARTITION;
        const things = furnish(room(type, { w, level: 2 }), iw);
        expect(things.some((t) => t.hang && t.light)).toBe(true);
        for (const t of things) {
          const half = t.img.w / scaleAt(t.z) / 2;
          expect(t.x - half, `${type} ${w}`).toBeGreaterThanOrEqual(-1);
          expect(t.x + half, `${type} ${w}`).toBeLessThanOrEqual(iw + 1);
          expect(t.z).toBeGreaterThan(0);
          expect(t.z).toBeLessThan(DEPTH);
        }
      }
    }
  });

  it('el fuego tiembla y tiene llamas; las salas rotas o en obras no dan luz', () => {
    for (const type of ['salon', 'cocina', 'forja'] as const) {
      const fire = furnish(room(type), CELL_W - PARTITION).find((t) => t.light?.flames);
      expect(fire?.light?.flicker).toBeGreaterThanOrEqual(0.2);
    }
    expect(furnish(room('salon', { level: 0 }), 110).some((t) => t.light)).toBe(false);
    expect(
      furnish(room('salon', { works: { kind: 'build', nights: 1 } }), 110).some((t) => t.light),
    ).toBe(false);
  });
});
