import { describe, expect, it } from 'vitest';
import { alpha, type PixelBuffer } from '../../art/pixel';
import { maxOut, uncleBuilding } from '../../core/rooms';
import type { Room } from '../../core/model';
import { GROUND } from '../geometry';
import {
  CELL_W,
  PARTITION,
  PITCH,
  ROOM_H,
  colX,
  floorTop,
  interior,
  roofRuns,
  roomsLayout,
} from './layout';
import { DEEP, backWall, caveCells, facade, sideTex, stairCells, type Facade } from './textures';
import { BACK } from './view3d';

const holes = (b: PixelBuffer) => b.data.filter((c) => alpha(c) === 0).length;
const solid = (F: Facade, x: number, y: number) =>
  alpha(F.buf.get(Math.round(x - F.x), Math.round(y - F.y))) > 0;
const room = (r: Partial<Room>): Room => ({
  id: 'x',
  type: 'salon',
  col: 0,
  floor: 0,
  w: 1,
  h: 1,
  level: 1,
  spent: 0,
  ...r,
});

describe('texturas de la vista 3D', () => {
  it('la pared del fondo se pinta al tamaño con el que se ve', () => {
    for (const r of [room({}), room({ w: 2 }), room({ w: 2, h: 2 })]) {
      const w = r.w * CELL_W - PARTITION;
      const h = r.h * PITCH - (PITCH - ROOM_H);
      const b = backWall(r, w, h);
      expect(b.w).toBe(Math.round(w * BACK));
      expect(b.h).toBe(Math.round(h * BACK));
    }
  });

  it('las salas de arriba tienen ventanas por las que se ve el cielo; abajo y en el tesoro, no', () => {
    const w = CELL_W - PARTITION;
    expect(holes(backWall(room({}), w, ROOM_H))).toBeGreaterThan(100);
    expect(holes(backWall(room({ type: 'bodega', floor: -1 }), w, ROOM_H))).toBe(0);
    expect(holes(backWall(room({ type: 'tesoro', floor: 0 }), w, ROOM_H))).toBe(0);
  });

  it('las paredes de los lados llevan puerta solo en las plantas que dan a otra sala', () => {
    const h = 2 * PITCH - (PITCH - ROOM_H);
    const b = sideTex('yeso', h, [0], 'prueba');
    expect(b.w).toBe(DEEP);
    const door = (y: number) => b.get(14, y);
    expect(door(h - 10)).not.toBe(sideTex('yeso', h, [], 'prueba').get(14, h - 10));
    expect(door(h - PITCH - 10)).toBe(sideTex('yeso', h, [], 'prueba').get(14, h - PITCH - 10));
  });

  it('el corte deja ver dentro de las salas y tapa la tierra, los muros y los forjados', () => {
    const L = roomsLayout(uncleBuilding());
    const F = facade(L);
    for (const { room: r, rect } of L.rooms) {
      if (r.type === 'torre') continue;
      const i = interior(rect);
      expect(solid(F, i.x + i.w / 2, i.y + i.h / 2)).toBe(false);
      // La pared entre huecos y el forjado de debajo, macizos.
      expect(solid(F, rect.x + 1, i.y + i.h / 2)).toBe(true);
      expect(solid(F, i.x + i.w / 2, rect.y + rect.h + 4)).toBe(true);
    }
    // Roca sin excavar bajo el sótano y tierra a los lados.
    expect(solid(F, colX(L.b, 1) + CELL_W / 2, floorTop(-2) + 40)).toBe(true);
    expect(solid(F, L.patio.x + 20, GROUND + 30)).toBe(true);
    // Encima de la capilla no hay nada: se ve el cielo (salvo el hastial del tejado).
    expect(solid(F, colX(L.b, 3) + CELL_W - 12, floorTop(2) + 8)).toBe(false);
    for (const run of F.runs)
      expect(solid(F, (run.x0 + run.x1) / 2, run.base - run.h + 3)).toBe(true);
  });

  it('cuenta los tramos de escalera y los huecos excavados sin sala', () => {
    const b = uncleBuilding();
    const L = roomsLayout(b);
    expect(stairCells(L)).toHaveLength(L.top - L.deepest + 1);
    expect(caveCells(L)).toHaveLength(0);
    b.dug.push('0,-2');
    expect(caveCells(roomsLayout(b))).toHaveLength(1);
  });

  it('con todo al máximo, los tejados cubren cada hueco de arriba', () => {
    const b = uncleBuilding();
    maxOut(b);
    const L = roomsLayout(b);
    const runs = roofRuns(L);
    for (let c = 0; c < b.cols; c++) {
      const x = colX(b, c) + CELL_W / 2;
      expect(runs.some((r) => x > r.x0 && x < r.x1)).toBe(true);
    }
  });
});
