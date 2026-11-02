import { describe, expect, it } from 'vitest';
import {
  GARDEN_W,
  MAX_COLS,
  RANKS,
  WING_COL,
  WING_COST,
  WING_MAX,
  WING_PLOT_COST,
  WING_RANK,
  WING_START,
} from './balance';
import { canWork, newGame, reduce, type Action } from './game';
import type { GameState, Room } from './model';
import { LOCKED, inGarden, inWing, onLot, problem, spanOf, uncleBuilding } from './rooms';

/** Deuda pagada, oro de sobra, rango para el anexo y el edificio ya a todo lo ancho. */
function wide(seed = 'anexo'): GameState {
  let s = newGame(seed);
  s.mode = 'libre';
  s.gold = 99999;
  s.rep = RANKS[WING_RANK]!.at;
  while (s.building.cols < MAX_COLS) s = reduce(s, { type: 'buyPlot' });
  return s;
}

function ok(s: GameState, a: Action): GameState {
  expect(canWork(s, a)).toBeNull();
  return reduce(s, a);
}

const sala = (col: number, floor: number, w = 1): Room => ({
  id: 'x',
  type: 'despensa',
  col,
  floor,
  w,
  h: 1,
  level: 1,
  spent: 0,
});

/** La planta baja del edificio llega hasta el jardín (despensas del hueco 4 al 6). */
function toGarden(s: GameState): GameState {
  for (let c = s.building.cols - 3; c < s.building.cols; c++)
    s = ok(s, { type: 'build', room: 'despensa', col: c, floor: 0 });
  return s;
}

describe('el patio trasero (anexo)', () => {
  it('las partidas de antes no tienen anexo ni jardín', () => {
    const b = uncleBuilding();
    expect(b.wing).toBeUndefined();
    expect(spanOf(b)).toBe(b.cols);
    expect(inGarden(b, b.cols)).toBe(false);
    expect(onLot(b, b.cols)).toBe(false);
  });

  it('se compra con las obras abiertas, el edificio a todo lo ancho y el rango', () => {
    const fresh = newGame('anexo');
    expect(canWork(fresh, { type: 'buyWing' })).toBe(LOCKED);
    const narrow = { ...wide(), building: uncleBuilding() };
    expect(canWork(narrow, { type: 'buyWing' })).toMatch(/solares/);
    const low = { ...wide(), rep: 0 };
    expect(canWork(low, { type: 'buyWing' })).toMatch(RANKS[WING_RANK]!.name);
    expect(canWork(wide(), { type: 'buyPlot' })).toMatch(/patio trasero/);

    const s = wide();
    const t = ok(s, { type: 'buyWing' });
    expect(t.building.wing).toBe(WING_START);
    expect(t.gold).toBe(s.gold - WING_COST);
    expect(spanOf(t.building)).toBe(WING_COL + WING_START);
    expect(canWork(t, { type: 'buyWing' })).toMatch(/Ya tienes/);
  });

  it('deja un jardín de GARDEN_W huecos en el que no se construye', () => {
    const s = toGarden(ok(wide(), { type: 'buyWing' }));
    const b = s.building;
    for (let c = MAX_COLS; c < WING_COL; c++) {
      expect(inGarden(b, c)).toBe(true);
      expect(canWork(s, { type: 'build', room: 'despensa', col: c, floor: 0 })).toMatch(/jardín/);
    }
    expect(WING_COL - MAX_COLS).toBe(GARDEN_W);
    expect(inWing(b, WING_COL)).toBe(true);
    // Ni una sala ancha que cruce el jardín.
    const bridge = { ...b, rooms: [...b.rooms, sala(MAX_COLS - 1, 0, 3)] };
    expect(problem(bridge)).toMatch(/jardín|solar/);
  });

  it('al anexo se llega cruzando el jardín por la planta baja', () => {
    const bought = ok(wide(), { type: 'buyWing' });
    // Sin planta baja hasta el jardín, la sala del anexo se quedaría sin paso.
    expect(canWork(bought, { type: 'build', room: 'armas', col: WING_COL, floor: 0 })).toMatch(
      /sin paso/,
    );
    let s = ok(toGarden(bought), { type: 'build', room: 'armas', col: WING_COL, floor: 0 });
    // Arriba, con su escalera, como en el edificio.
    expect(canWork(s, { type: 'build', room: 'tiro', col: WING_COL, floor: 1 })).toMatch(
      /sin paso/,
    );
    s = ok(s, { type: 'addStair', at: WING_COL + 1, floor: 0 });
    s = ok(s, { type: 'build', room: 'tiro', col: WING_COL + 1, floor: 0 });
    s = ok(s, { type: 'build', room: 'biblioteca', col: WING_COL, floor: 1 });
    expect(problem(s.building)).toBeNull();
  });

  it('una escalera al borde sin rellano en la planta baja tapa la salida al jardín', () => {
    let s = toGarden(ok(wide(), { type: 'buyWing' }));
    s = ok(s, { type: 'build', room: 'armas', col: WING_COL, floor: 0 });
    // Un tramo de la planta 1 a la 2 en el borde del anexo: hace columna y no tiene rellano abajo.
    const b = { ...s.building, stairs: [...s.building.stairs, { at: WING_COL, floor: 1 }] };
    expect(problem(b)).toMatch(/sin paso|escalera/);
  });

  it('bajo el anexo no se excava', () => {
    const s = toGarden(ok(wide(), { type: 'buyWing' }));
    expect(canWork(s, { type: 'dig', col: WING_COL, floor: -1 })).toMatch(/excavar/);
    expect(canWork(s, { type: 'addStair', at: WING_COL + 1, floor: -1 })).toMatch(/anexo/);
    const b = s.building;
    const deep = { ...b, rooms: [...b.rooms, sala(WING_COL, -1)] };
    expect(problem(deep)).toMatch(/anexo/);
  });

  it('crece con sus propios solares hasta WING_MAX', () => {
    let s = ok(wide(), { type: 'buyWing' });
    for (let i = WING_START; i < WING_MAX; i++) {
      const before = s.gold;
      s = ok(s, { type: 'buyPlot' });
      expect(s.gold).toBe(before - WING_PLOT_COST[i - WING_START]!);
      expect(s.building.cols).toBe(MAX_COLS);
    }
    expect(s.building.wing).toBe(WING_MAX);
    expect(canWork(s, { type: 'buyPlot' })).toMatch(/No quedan/);
  });

  it('el jardín se adorna solo con anexo y con piezas que existen', () => {
    const plain = wide();
    expect(reduce(plain, { type: 'gardenLook', patch: { ground: 'grava' } })).toBe(plain);
    const s = ok(plain, { type: 'buyWing' });
    const t = reduce(s, {
      type: 'gardenLook',
      patch: { ground: 'losas', slots: ['fuente', null, 'arbol'], cloister: true },
    });
    expect(t.custom?.garden).toEqual({
      ground: 'losas',
      slots: ['fuente', null, 'arbol'],
      cloister: true,
    });
    const u = reduce(t, { type: 'gardenLook', patch: { edge: 'seto' } });
    expect(u.custom?.garden?.ground).toBe('losas');
    expect(u.custom?.garden?.edge).toBe('seto');
    // Piezas que no existen o más huecos de los que tiene el jardín: no se hace nada.
    const bad = { slots: ['dragon'] } as unknown as { slots: null[] };
    expect(reduce(t, { type: 'gardenLook', patch: bad })).toBe(t);
    const many = { slots: Array<null>(GARDEN_W + 1).fill(null) };
    expect(reduce(t, { type: 'gardenLook', patch: many })).toBe(t);
  });
});
