import { describe, expect, it } from 'vitest';
import { uncleBuilding } from '../../core/rooms';
import { GROUND } from '../geometry';
import {
  CELL_W,
  STAIR_W,
  WALL,
  colX,
  floorTop,
  floorY,
  focusPoint,
  roomAtPoint,
  roomsLayout,
  stairX,
  type Rect,
} from './layout';

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('geometría por salas', () => {
  it('la escalera empuja a los huecos de su derecha', () => {
    const b = uncleBuilding();
    expect(colX(b, 0)).toBe(WALL);
    expect(stairX(b, 1)).toBe(WALL + CELL_W);
    expect(colX(b, 1)).toBe(WALL + CELL_W + STAIR_W);
    expect(colX(b, 3)).toBe(WALL + 3 * CELL_W + STAIR_W);
  });

  it('cada planta tiene su sitio: la baja apoya en el suelo, el sótano debajo', () => {
    expect(floorY(0)).toBe(GROUND);
    expect(floorTop(-1)).toBeGreaterThan(GROUND);
    expect(floorY(1)).toBeLessThan(floorTop(0));
  });

  it('las salas de la taberna del tío no se pisan y caben en el mundo', () => {
    const L = roomsLayout(uncleBuilding());
    for (const a of L.rooms) {
      const r = a.rect;
      expect(r.x).toBeGreaterThanOrEqual(L.left);
      expect(r.x + r.w).toBeLessThanOrEqual(L.right);
      expect(r.y).toBeGreaterThan(L.y0);
      expect(r.y + r.h).toBeLessThan(L.y1);
      for (const s of L.stairs) expect(s >= r.x + r.w || s + STAIR_W <= r.x).toBe(true);
      for (const o of L.rooms) if (o !== a) expect(overlap(r, o.rect)).toBe(false);
    }
    expect(L.top).toBe(2);
    expect(L.deepest).toBe(-1);
  });

  it('se encuentra la sala bajo un punto y los sitios de antes', () => {
    const L = roomsLayout(uncleBuilding());
    const salon = L.rooms.find((x) => x.room.type === 'salon')!;
    expect(roomAtPoint(L, salon.rect.x + 5, salon.rect.y + 5)).toBe(salon.room);
    expect(focusPoint(L, 'barra')).toEqual({
      x: salon.rect.x + salon.rect.w / 2,
      y: salon.rect.y + salon.rect.h / 2,
    });
    expect(focusPoint(L, 'patio')!.x).toBeLessThan(0);
    expect(focusPoint(L, 'veteranos')).toBeNull();
  });
});
