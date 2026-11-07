import { describe, expect, it } from 'vitest';
import { MAX_COLS, RANKS, WING_RANK } from '../../core/balance';
import { canWork, newGame, reduce, type Action } from '../../core/game';
import type { GameState } from '../../core/model';
import { roomAt } from '../../core/rooms';
import { colX, floorTop } from './layout';
import { targetsFor, whyNoSpot } from './works';
import { ROOMS, type RoomType } from '../../data/rooms';

function open(): GameState {
  const s = newGame('sitios');
  s.mode = 'libre';
  s.gold = 9999;
  return s;
}

const valid = (s: GameState, a: Action) => canWork(s, a) === null;

describe('sitios para las obras', () => {
  it('construir: solo huecos libres donde la sala cabe, y cada uno en su sitio del corte', () => {
    const s = open();
    const list = targetsFor(s, { kind: 'build', type: 'despensa' });
    expect(list.length).toBeGreaterThan(0);
    for (const t of list) {
      expect(valid(s, t.action)).toBe(true);
      const a = t.action as Extract<Action, { type: 'build' }>;
      expect(roomAt(s.building, a.col, a.floor)).toBeUndefined();
      expect(t.rect.x).toBe(colX(s.building, a.col));
      expect(t.rect.y).toBe(floorTop(a.floor));
    }
    // En el sótano sin excavar no se construye.
    expect(list.some((t) => (t.action as { floor: number }).floor < -1)).toBe(false);
  });

  it('antes de pagar la deuda no hay sitios: solo se arregla y se mejora', () => {
    const s = open();
    s.mode = 'deuda';
    expect(targetsFor(s, { kind: 'build', type: 'despensa' })).toHaveLength(0);
    expect(targetsFor(s, { kind: 'dig' })).toHaveLength(0);
  });

  it('mover, excavar y escalera dan sitios válidos y distintos', () => {
    const s = open();
    const cocina = s.building.rooms.find((r) => r.type === 'cocina')!;
    for (const pick of [
      { kind: 'move', id: cocina.id },
      { kind: 'dig' },
      { kind: 'stair' },
    ] as const) {
      const list = targetsFor(s, pick);
      expect(list.length, pick.kind).toBeGreaterThan(0);
      for (const t of list) expect(valid(s, t.action), JSON.stringify(t.action)).toBe(true);
      const keys = new Set(list.map((t) => JSON.stringify(t.action)));
      expect(keys.size).toBe(list.length);
    }
    expect(targetsFor(s, { kind: 'move', id: 'nada' })).toHaveLength(0);
  });

  it('al mover la enfermería, su hueco del borde se marca libre y se puede construir', () => {
    let s = open();
    s = reduce(s, { type: 'buyPlot' });
    const enf = s.building.rooms.find((r) => r.type === 'enfermeria')!;
    const was = { col: enf.col, floor: enf.floor };
    s = reduce(s, { type: 'move', id: enf.id, col: s.building.cols - 1, floor: 0 });
    expect(roomAt(s.building, was.col, was.floor)).toBeUndefined();
    const free = targetsFor(s, { kind: 'expand' }).filter((t) => t.info);
    const at = (t: { action: Action }) => t.action as Extract<Action, { type: 'build' }>;
    expect(free.some((t) => at(t).col === was.col && at(t).floor === was.floor)).toBe(true);
    const build = targetsFor(s, { kind: 'build', type: 'dormitorio' });
    expect(build.some((t) => at(t).col === was.col && at(t).floor === was.floor)).toBe(true);
  });
});

describe('ganar sitio tocando la escena', () => {
  it('marca los huecos que se pueden excavar y el solar de al lado, cada uno con su obra', () => {
    const s = open();
    const list = targetsFor(s, { kind: 'expand' });
    expect(list.some((t) => t.action.type === 'dig')).toBe(true);
    const plot = list.find((t) => t.action.type === 'buyPlot')!;
    expect(plot.label).toBe('Comprar solar');
    expect(new Set(list.map((t) => t.id)).size).toBe(list.length);
    for (const t of list.filter((x) => !x.blocked)) expect(valid(s, t.action)).toBe(true);
  });

  it('junto a una sala igual de nivel 1, construir sale como ampliarla', () => {
    const s = open();
    const list = targetsFor(s, { kind: 'build', type: 'mapas' });
    // La sala de mapas es única: no hay sitio. Una despensa nueva sí sale como sala nueva.
    expect(list).toHaveLength(0);
    expect(
      targetsFor(s, { kind: 'build', type: 'despensa' }).every((t) => t.label === 'Despensa'),
    ).toBe(true);
  });

  it('las salas únicas que ya están se amplían desde la cinta: a los lados y el salón hacia arriba', () => {
    const s = open();
    // Sin cocina, dormitorio ni capilla, el salón tiene sitio a la derecha y encima.
    const gone = ['cocina', 'dormitorio', 'capilla'];
    s.building.rooms = s.building.rooms.filter((r) => !gone.includes(r.type));
    const list = targetsFor(s, { kind: 'build', type: 'salon' });
    const dirs = list.map((t) => (t.action.type === 'extend' ? t.action.dir : null));
    expect(dirs).toContain('right');
    expect(dirs).toContain('up');
    for (const t of list) {
      expect(t.label).toBe('Ampliar salón');
      expect(valid(s, t.action)).toBe(true);
    }
  });
});

describe('el patio trasero en «ganar sitio»', () => {
  const wing = (s: GameState) =>
    targetsFor(s, { kind: 'expand' }).find((t) => t.action.type === 'buyWing');

  it('sale con candado y el porqué mientras no se puede comprar', () => {
    const s = open();
    const t = wing(s)!;
    expect(t.blocked).toMatch(/solares/);
    // No pisa el solar que sí se puede comprar.
    const plot = targetsFor(s, { kind: 'expand' }).find((x) => x.action.type === 'buyPlot')!;
    expect(t.rect.x).toBeGreaterThan(plot.rect.x);
  });

  it('con el rango y el ancho se compra; comprado, ya no sale', () => {
    let s = open();
    s.rep = RANKS[WING_RANK]!.at;
    while (s.building.cols < MAX_COLS) s = reduce(s, { type: 'buyPlot' });
    expect(wing(s)!.blocked).toBeUndefined();
    s = reduce(s, { type: 'buyWing' });
    expect(wing(s)).toBeUndefined();
  });
});

describe('por qué no hay sitio', () => {
  it('una sala de rango alto dice el rango', () => {
    const s = open();
    const locked = (Object.keys(ROOMS) as RoomType[]).find(
      (t) => targetsFor(s, { kind: 'build', type: t }).length === 0,
    );
    if (!locked) return;
    expect(whyNoSpot(s, locked)).toBeTruthy();
  });
});

describe('huecos libres sin sala', () => {
  it('se marcan al comprar un solar y al derribar una sala, sin tacharlos', () => {
    let s = open();
    const free = () => targetsFor(s, { kind: 'expand' }).filter((t) => t.info);
    const before = free().length;
    s = reduce(s, { type: 'buyPlot' });
    expect(free().length).toBe(before + 1);
    const gone = s.building.rooms.find((x) => x.type === 'cocina')!;
    s = reduce(s, { type: 'demolish', id: gone.id });
    expect(free().length).toBeGreaterThan(before + 1);
  });
});
