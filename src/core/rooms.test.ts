import { describe, expect, it } from 'vitest';
import {
  DIG_COST,
  PLOT_COST,
  ROOM_COST,
  START,
  STAIR_COST,
  UPGRADE_COST,
  capacity,
} from './balance';
import { canWork, endDay, newGame, reduce, tryWorks, type Action } from './game';
import type { GameState, Room } from './model';
import { LOCKED, beds, facOf, problem, uncleBuilding, upgradeCostOf } from './rooms';

const room = (s: GameState, type: Room['type']) => s.building.rooms.find((r) => r.type === type)!;

/** Partida con la deuda pagada (obras abiertas) y oro de sobra. */
function open(seed = 'obras'): GameState {
  const s = newGame(seed);
  s.mode = 'libre';
  s.gold = 9999;
  return s;
}

function ok(s: GameState, a: Action): GameState {
  expect(canWork(s, a)).toBeNull();
  const next = reduce(s, a);
  expect(next).not.toBe(s);
  return next;
}

function no(s: GameState, a: Action, why: RegExp | string) {
  expect(canWork(s, a)).toMatch(why);
  expect(reduce(s, a)).toBe(s);
}

describe('la taberna del tío', () => {
  it('cuadra y da las instalaciones de siempre', () => {
    const b = uncleBuilding();
    expect(problem(b)).toBeNull();
    expect(facOf(b)).toEqual(START.fac);
    expect(beds(b)).toBe(capacity(START.fac.dorm));
    expect(newGame('x').fac).toEqual(START.fac);
  });

  it('antes del día 30 solo se arregla y se mejora en su sitio', () => {
    let s = newGame('deuda');
    s.gold = 9999;
    const forja = room(s, 'forja');
    no(s, { type: 'build', room: 'cocina', col: 1, floor: 2 }, LOCKED);
    no(s, { type: 'extend', id: room(s, 'salon').id, dir: 'up' }, LOCKED);
    no(s, { type: 'move', id: forja.id, col: 1, floor: 2 }, LOCKED);
    no(s, { type: 'demolish', id: forja.id }, LOCKED);
    no(s, { type: 'dig', col: 0, floor: -2 }, LOCKED);
    no(s, { type: 'buyPlot' }, LOCKED);
    no(s, { type: 'addStair', at: 3 }, LOCKED);
    s = ok(s, { type: 'upgradeRoom', id: forja.id });
    expect(s.fac.forja).toBe(1);
    expect(s.gold).toBe(9999 - UPGRADE_COST.forja[1]!);
    s = ok(s, { type: 'upgrade', fac: 'arm' });
    expect(room(s, 'armeria').level).toBe(1);
    expect(s.fac.arm).toBe(1);
    no(s, { type: 'upgrade', fac: 'vet' }, /pagar la deuda/);
  });

  it('el patio sube de nivel como antes', () => {
    let s = newGame('patio');
    s.gold = 9999;
    s = ok(s, { type: 'upgrade', fac: 'establo' });
    expect(s.building.yard.establo).toBe(1);
    expect(s.fac.establo).toBe(1);
  });
});

describe('obras', () => {
  it('una sala nueva tarda una noche en estar lista', () => {
    let s = ok(open(), { type: 'upgrade', fac: 'vet' });
    const vet = room(s, 'veteranos');
    expect(vet.works?.kind).toBe('build');
    expect(s.fac.vet).toBe(0);
    s = endDay(s);
    expect(room(s, 'veteranos').works).toBeUndefined();
    expect(s.fac.vet).toBe(1);
    expect(s.dawn.some((e) => /sala nueva/.test(e.t))).toBe(true);
  });

  it('una planta sobresale como mucho un hueco y la torre va encima de todo', () => {
    let s = ok(ok(open(), { type: 'buyPlot' }), { type: 'buyPlot' });
    expect(s.building.cols).toBe(6);
    no(s, { type: 'build', room: 'cocina', col: 5, floor: 1 }, /sobresalir/);
    // La torre no sirve de apoyo: junto a ella, una planta más arriba, no se construye.
    no(s, { type: 'build', room: 'cocina', col: 1, floor: 4 }, /sobresalir/);
    no(s, { type: 'build', room: 'cocina', col: 4, floor: 2 }, /sin paso/);
    no(s, { type: 'build', room: 'cocina', col: 0, floor: 4 }, /torre/);
    s = ok(s, { type: 'build', room: 'cocina', col: 4, floor: 1 });
    expect(problem(s.building)).toBeNull();
  });

  it('nada cruza la escalera ni se queda sin paso', () => {
    const s = ok(open(), { type: 'buyPlot' });
    no(s, { type: 'addStair', at: 2 }, /cruzar la escalera/);
    no(s, { type: 'build', room: 'despensa', col: 4, floor: -1 }, /excavar/);
    const t = ok(s, { type: 'addStair', at: 3 });
    expect(t.building.stairs).toEqual([1, 3]);
    expect(t.gold).toBe(9999 - PLOT_COST[0] - STAIR_COST);
    no(t, { type: 'addStair', at: 4 }, /dos escaleras/);
  });

  it('las salas únicas no se repiten', () => {
    no(open(), { type: 'build', room: 'armeria', col: 1, floor: 2 }, /Ya tienes armería/);
  });

  it('ampliar: la sala crece hacia un lado y cuenta lo de antes hasta que acaba la obra', () => {
    let s = open();
    no(s, { type: 'extend', id: room(s, 'dormitorio').id, dir: 'right' }, /otra sala/);
    no(s, { type: 'demolish', id: room(s, 'dormitorio').id }, /Capilla: se quedaría sin paso/);
    s = ok(s, { type: 'demolish', id: room(s, 'capilla').id });
    s = ok(s, { type: 'extend', id: room(s, 'dormitorio').id, dir: 'right' });
    expect(room(s, 'dormitorio').w).toBe(3);
    expect(beds(s.building)).toBe(4);
    s = endDay(s);
    expect(beds(s.building)).toBe(6);
    no(s, { type: 'extend', id: room(s, 'dormitorio').id, dir: 'left' }, /no crece tanto/);
    expect(upgradeCostOf(room(s, 'dormitorio'))).toBe(Math.round(UPGRADE_COST.dorm[2]! * 1.5));
  });

  it('el salón puede crecer una planta hacia arriba; las demás, no', () => {
    let s = open();
    no(s, { type: 'extend', id: room(s, 'cocina').id, dir: 'up' }, /no crece tanto/);
    s = ok(s, { type: 'demolish', id: room(s, 'capilla').id });
    s = ok(s, { type: 'demolish', id: room(s, 'dormitorio').id });
    s = ok(s, { type: 'extend', id: room(s, 'salon').id, dir: 'up' });
    expect(room(s, 'salon').h).toBe(2);
    expect(problem(s.building)).toBeNull();
  });

  it('mover: a un hueco libre y válido, y el recibidor no se mueve', () => {
    let s = open();
    no(s, { type: 'move', id: room(s, 'recibidor').id, col: 1, floor: 2 }, /no se puede mover/);
    no(s, { type: 'move', id: room(s, 'mapas').id, col: 1, floor: 2 }, /torre/);
    s = ok(s, { type: 'move', id: room(s, 'enfermeria').id, col: 1, floor: 2 });
    expect(room(s, 'enfermeria')).toMatchObject({ col: 1, floor: 2, works: { kind: 'move' } });
  });

  it('destruir devuelve la mitad de lo gastado; el recibidor, el salón y el tesoro se quedan', () => {
    let s = ok(open(), { type: 'upgradeRoom', id: room(open(), 'capilla').id });
    const gold = s.gold;
    s = ok(s, { type: 'demolish', id: room(s, 'capilla').id });
    expect(s.gold).toBe(gold + UPGRADE_COST.cap[1]! / 2);
    for (const t of ['recibidor', 'salon', 'tesoro'] as const)
      no(s, { type: 'demolish', id: room(s, t).id }, /no se puede quitar/);
  });

  it('excavar: junto a la escalera, planta a planta, o junto a otro hueco excavado', () => {
    let s = open();
    no(s, { type: 'dig', col: 0, floor: -3 }, /junto a la escalera/);
    no(s, { type: 'dig', col: 3, floor: -2 }, /junto a la escalera/);
    s = ok(s, { type: 'dig', col: 0, floor: -2 });
    expect(s.gold).toBe(9999 - DIG_COST[2]);
    s = ok(s, { type: 'dig', col: 0, floor: -3 });
    s = ok(s, { type: 'dig', col: 1, floor: -3 });
    no(s, { type: 'dig', col: 1, floor: -3 }, /Ya está excavado/);
    s = ok(s, { type: 'build', room: 'despensa', col: 1, floor: -3 });
    expect(problem(s.building)).toBeNull();
  });

  it('los solares se acaban', () => {
    let s = open();
    for (let i = 0; i < 3; i++) s = ok(s, { type: 'buyPlot' });
    expect(s.building.cols).toBe(7);
    no(s, { type: 'buyPlot' }, /solares/);
  });

  it('el modo plano paga varias obras de una vez, o ninguna si una falla', () => {
    const s = open();
    const steps: Action[] = [
      { type: 'buyPlot' },
      { type: 'build', room: 'despensa', col: 4, floor: 0 },
      { type: 'dig', col: 0, floor: -2 },
    ];
    const next = reduce(s, { type: 'works', steps });
    expect(next.building.cols).toBe(5);
    expect(next.building.rooms.some((r) => r.type === 'despensa' && r.col === 4)).toBe(true);
    expect(next.gold).toBe(9999 - PLOT_COST[0] - ROOM_COST.despensa[1]! - DIG_COST[2]);
    // Sin el solar, la despensa no cabe: no se hace nada.
    expect(reduce(s, { type: 'works', steps: steps.slice(1) })).toBe(s);
    expect(tryWorks(s, steps.slice(1))).toEqual({ error: 'No cabe en el solar.' });
  });

  it('sin oro no hay obra', () => {
    const s = open();
    s.gold = 10;
    no(s, { type: 'buyPlot' }, /Te faltan/);
  });
});
