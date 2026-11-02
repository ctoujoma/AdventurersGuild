import { describe, expect, it } from 'vitest';
import { GARDEN_W, MAX_COLS, RANKS, WING_COL, WING_RANK, WING_START } from '../../core/balance';
import { newGame, reduce, type Action } from '../../core/game';
import type { Building, GameState, Room } from '../../core/model';
import { problem, uncleBuilding } from '../../core/rooms';
import {
  CELL_W,
  PARTITION,
  WALL,
  colX,
  focusPoint,
  gardenRect,
  gardenSlots,
  roofRuns,
  roomsLayout,
} from './layout';
import { route, segments } from './people';
import { targetsFor } from './works';

const sala = (id: string, type: Room['type'], col: number, floor: number): Room => ({
  id,
  type,
  col,
  floor,
  w: 1,
  h: 1,
  level: 1,
  spent: 0,
});

/** El edificio a todo lo ancho, con la planta baja hasta el jardín y dos salas en el anexo. */
function withWing(): Building {
  const b = uncleBuilding();
  b.cols = MAX_COLS;
  b.wing = WING_START;
  for (let c = 4; c < MAX_COLS; c++) b.rooms.push(sala(`d${c}`, 'despensa', c, 0));
  b.rooms.push(sala('a1', 'armas', WING_COL, 0), sala('a2', 'tiro', WING_COL + 1, 1));
  b.stairs.push({ at: WING_COL + 1, floor: 0 });
  b.rooms.push(sala('a3', 'biblioteca', WING_COL + 1, 0));
  return b;
}

describe('el anexo en la escena', () => {
  it('cuadra y deja el jardín entre los dos muros', () => {
    const b = withWing();
    expect(problem(b)).toBeNull();
    expect(gardenRect(uncleBuilding())).toBeNull();
    const g = gardenRect(b)!;
    expect(g.x).toBe(colX(b, MAX_COLS) + WALL);
    expect(g.x + g.w).toBe(colX(b, WING_COL) - WALL);
    expect(g.w).toBe(GARDEN_W * CELL_W - 2 * WALL);
    // El mundo llega hasta el final del anexo.
    const L = roomsLayout(b);
    expect(L.right).toBeGreaterThan(colX(b, WING_COL + WING_START - 1) + CELL_W);
    expect(L.garden).toEqual(g);
    expect(PARTITION).toBe(2 * WALL);
    const slots = gardenSlots(b);
    expect(slots).toHaveLength(GARDEN_W);
    expect(slots[0]!.x).toBe(g.x);
    expect(slots.at(-1)!.x + slots.at(-1)!.w).toBeCloseTo(g.x + g.w);
    expect(gardenSlots(uncleBuilding())).toEqual([]);
  });

  it('se anda de la planta baja del edificio a la del anexo por el jardín', () => {
    const L = roomsLayout(withWing());
    const ground = segments(L).get(0)!;
    // El patio, el edificio, el jardín y el anexo: un solo tramo de suelo.
    expect(ground).toHaveLength(1);
    const from = { x: L.rooms.find((r) => r.room.type === 'recibidor')!.rect.x + 20, floor: 0 };
    const up = L.rooms.find((r) => r.room.id === 'a2')!;
    const path = route(L, from, { x: up.rect.x + 30, floor: 1 });
    expect(path).not.toBeNull();
  });

  it('cada edificio lleva su tejado (el jardín no)', () => {
    const L = roomsLayout(withWing());
    const g = L.garden!;
    const runs = roofRuns(L);
    expect(runs.some((r) => r.x0 > g.x + g.w - 20)).toBe(true);
    expect(runs.every((r) => r.x1 <= g.x + 20 || r.x0 >= g.x + g.w - 20)).toBe(true);
  });
});

describe('el anexo en el modo obras', () => {
  it('sale el patio trasero para comprar y, luego, los solares y salas del anexo', () => {
    let s = newGame('anexo-obras');
    s.mode = 'libre';
    s.gold = 99999;
    s.rep = RANKS[WING_RANK]!.at;
    const kinds = (st: GameState) =>
      targetsFor(st, { kind: 'expand' })
        .filter((t) => !t.blocked)
        .map((t) => t.action.type);
    expect(kinds(s)).not.toContain('buyWing');
    while (s.building.cols < MAX_COLS) s = reduce(s, { type: 'buyPlot' });
    expect(kinds(s)).toContain('buyWing');
    expect(kinds(s)).not.toContain('buyPlot');
    s = reduce(s, { type: 'buyWing' });
    expect(kinds(s)).toContain('buyPlot');
    // En el anexo se puede poner una sala (junto al jardín, si la planta baja llega a él).
    for (let c = 4; c < MAX_COLS; c++)
      s = reduce(s, { type: 'build', room: 'despensa', col: c, floor: 0 });
    const spots = targetsFor(s, { kind: 'build', type: 'armas' }).map(
      (t) => t.action as Extract<Action, { type: 'build' }>,
    );
    expect(spots.some((a) => a.col === WING_COL && a.floor === 0)).toBe(true);
    expect(spots.some((a) => a.col >= MAX_COLS && a.col < WING_COL)).toBe(false);
  });
});

describe('el anexo para la cámara', () => {
  it('tiene su punto para saltar a él', () => {
    let s = newGame('salto');
    s.mode = 'libre';
    s.gold = 99999;
    s.rep = RANKS[WING_RANK]!.at;
    expect(focusPoint(roomsLayout(s.building), 'anexo')).toBeNull();
    while (s.building.cols < MAX_COLS) s = reduce(s, { type: 'buyPlot' });
    s = reduce(s, { type: 'buyWing' });
    const L = roomsLayout(s.building);
    const p = focusPoint(L, 'anexo')!;
    expect(p.x).toBeGreaterThan(focusPoint(L, 'sala')!.x);
    expect(p.x).toBeLessThan(L.right);
  });
});
