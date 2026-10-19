import { describe, expect, it } from 'vitest';
import {
  DIG_COST,
  MOVE_COST,
  PLOT_COST,
  ROOM_COST,
  START,
  STAIR_COST,
  STAIR_STEP,
  DEMOLISH_REFUND,
  UPGRADE_COST,
  capacity,
} from './balance';
import {
  canWork,
  endDay,
  needsPlan,
  newGame,
  planIssue,
  reduce,
  tryWorks,
  type Action,
} from './game';
import type { GameState, Room } from './model';
import {
  LOCKED,
  beds,
  extendCostOf,
  facOf,
  problem,
  stairCost,
  uncleBuilding,
  upgradeCostOf,
} from './rooms';

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
    no(s, { type: 'addStair', at: 3, floor: 0 }, LOCKED);
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
  it('una sala nueva queda lista al momento', () => {
    const s = ok(open(), { type: 'upgrade', fac: 'vet' });
    expect(room(s, 'veteranos').works).toBeUndefined();
    expect(s.fac.vet).toBe(1);
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

  it('escaleras por tramos: nada las cruza, sin límite y cada tramo cuesta un poco más', () => {
    const s = ok(open(), { type: 'buyPlot' });
    no(s, { type: 'addStair', at: 2, floor: 0 }, /cruzar la escalera/);
    no(s, { type: 'build', room: 'despensa', col: 4, floor: -1 }, /excavar/);
    // Un tramo suelto en el aire, no.
    no(s, { type: 'addStair', at: 3, floor: 3 }, /tiene que salir/);
    const first = stairCost(s.building);
    expect(first).toBe(STAIR_COST + 3 * STAIR_STEP);
    const t = ok(s, { type: 'addStair', at: 3, floor: 0 });
    expect(t.building.stairs).toContainEqual({ at: 3, floor: 0 });
    expect(t.gold).toBe(9999 - PLOT_COST[0] - first);
    // La columna nueva no corta el paso entre salas (sin tramo, es un pasillo).
    expect(problem(t.building)).toBeNull();
    no(t, { type: 'addStair', at: 3, floor: 0 }, /ya hay escalera/);
    const u = ok(t, { type: 'addStair', at: 3, floor: 1 });
    expect(t.gold - u.gold).toBe(first + STAIR_STEP);
    // Bajo tierra la escalera abre su hueco y junto a ella se puede excavar.
    no(u, { type: 'dig', col: 3, floor: -2 }, /junto a la escalera/);
    let v = ok(u, { type: 'addStair', at: 3, floor: -1 });
    v = ok(v, { type: 'addStair', at: 3, floor: -2 });
    v = ok(v, { type: 'dig', col: 3, floor: -2 });
    expect(v.building.dug).toContain('3,-2');
  });

  it('los tramos de las puntas se quitan (en el borrador, devolviendo todo)', () => {
    const s = ok(open(), { type: 'buyPlot' });
    const add: Action = { type: 'addStair', at: 3, floor: 0 };
    const off: Action = { type: 'removeStair', at: 3, floor: 0 };
    const t = ok(s, add);
    const u = ok(t, off);
    expect(u.building.stairs).not.toContainEqual({ at: 3, floor: 0 });
    expect(u.gold - t.gold).toBe(Math.floor(stairCost(u.building) * DEMOLISH_REFUND));
    no(u, off, /no hay escalera/);
    // Puesto y quitado en el mismo borrador: como si nada.
    const d = tryWorks(s, [add, off]);
    expect('error' in d ? d.error : d.gold).toBe(s.gold);
    // Sin el tramo de arriba, la sala de mapas se queda sin paso.
    no(s, { type: 'removeStair', at: 1, floor: 1 }, /Sala de mapas: se quedaría sin paso/);
  });

  it('en una sala de dos alturas solo se anda por la planta de abajo', () => {
    const b = structuredClone(open().building);
    b.rooms = b.rooms.filter((r) => r.type !== 'dormitorio');
    b.rooms.find((r) => r.type === 'salon')!.h = 2;
    // La capilla solo toca la planta de arriba del salón: por ahí no se pasa.
    expect(problem(b)).toMatch(/Capilla: se quedaría sin paso/);
  });

  it('a una planta solo se llega si los tramos llegan a ella', () => {
    const s = open();
    // Sin el tramo de la planta 1 a la 2, la sala de mapas se queda sin paso.
    const b = structuredClone(s.building);
    b.stairs = b.stairs.filter((x) => x.floor !== 1);
    expect(problem(b)).toMatch(/Sala de mapas: se quedaría sin paso/);
  });

  it('las salas únicas no se repiten', () => {
    no(open(), { type: 'build', room: 'armeria', col: 1, floor: 2 }, /Ya tienes armería/);
  });

  it('ampliar: la sala crece hacia un lado y cuenta ya con su tamaño nuevo', () => {
    let s = open();
    no(s, { type: 'extend', id: room(s, 'dormitorio').id, dir: 'right' }, /otra sala/);
    no(s, { type: 'demolish', id: room(s, 'dormitorio').id }, /Capilla: se quedaría sin paso/);
    s = ok(s, { type: 'demolish', id: room(s, 'capilla').id });
    s = ok(s, { type: 'extend', id: room(s, 'dormitorio').id, dir: 'right' });
    expect(room(s, 'dormitorio').w).toBe(3);
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
    expect(room(s, 'enfermeria')).toMatchObject({ col: 1, floor: 2 });
    expect(room(s, 'enfermeria').works).toBeUndefined();
    // Y se puede volver a mover enseguida (aquí, a donde estaba).
    s = ok(s, { type: 'move', id: room(s, 'enfermeria').id, col: 0, floor: 1 });
    expect(room(s, 'enfermeria')).toMatchObject({ col: 0, floor: 1 });
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
    // Junto al rellano de más abajo, la escalera baja un tramo con lo excavado.
    const flight = stairCost(s.building);
    s = ok(s, { type: 'dig', col: 0, floor: -2 });
    expect(s.gold).toBe(9999 - DIG_COST[2] - flight);
    expect(s.building.stairs).toContainEqual({ at: 1, floor: -2 });
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
    expect(next.gold).toBe(
      9999 - PLOT_COST[0] - ROOM_COST.despensa[1]! - DIG_COST[2] - stairCost(s.building),
    );
    // Sin el solar, la despensa no cabe: no se hace nada.
    expect(reduce(s, { type: 'works', steps: steps.slice(1) })).toBe(s);
    expect(tryWorks(s, steps.slice(1))).toEqual({ error: 'No cabe en el solar.' });
  });

  it('construir al lado de una sala igual y de nivel 1 cuenta como ampliarla; con otro nivel, no', () => {
    let s = ok(ok(open(), { type: 'buyPlot' }), { type: 'buyPlot' });
    s = endDay(ok(s, { type: 'build', room: 'despensa', col: 4, floor: 0 }));
    const base = s;
    const gold = s.gold;
    s = ok(s, { type: 'build', room: 'despensa', col: 5, floor: 0 });
    const d = s.building.rooms.filter((r) => r.type === 'despensa');
    expect(d).toHaveLength(1);
    expect(d[0]!.w).toBe(2);
    expect(gold - s.gold).toBe(extendCostOf(d[0]!, 1));
    expect(gold - s.gold).toBeLessThan(ROOM_COST.despensa[1]!);
    // Si la de al lado es de otro nivel, la nueva va aparte.
    s = ok(base, {
      type: 'upgradeRoom',
      id: base.building.rooms.find((r) => r.type === 'despensa')!.id,
    });
    s = ok(s, { type: 'build', room: 'despensa', col: 5, floor: 0 });
    expect(s.building.rooms.filter((r) => r.type === 'despensa')).toHaveLength(2);
  });

  it('al igualar el nivel, dos salas iguales que se tocan se juntan, sin pasar del ancho máximo', () => {
    let s = ok(ok(open(), { type: 'buyPlot' }), { type: 'buyPlot' });
    s = endDay(ok(s, { type: 'build', room: 'despensa', col: 4, floor: 0 }));
    const first = s.building.rooms.find((r) => r.type === 'despensa')!;
    s = ok(s, { type: 'upgradeRoom', id: first.id });
    s = endDay(ok(s, { type: 'build', room: 'despensa', col: 5, floor: 0 }));
    expect(s.building.rooms.filter((r) => r.type === 'despensa')).toHaveLength(2);
    const second = s.building.rooms.find((r) => r.type === 'despensa' && r.col === 5)!;
    s = ok(s, { type: 'upgradeRoom', id: second.id });
    const d = s.building.rooms.filter((r) => r.type === 'despensa');
    expect(d).toHaveLength(1);
    expect(d[0]!.w).toBe(2);
    expect(d[0]!.level).toBe(2);
    expect(problem(s.building)).toBeNull();
  });

  it('sin oro no hay obra', () => {
    const s = open();
    s.gold = 10;
    no(s, { type: 'buyPlot' }, /Te faltan/);
  });
});

describe('el plano deja la casa a medias', () => {
  it('se puede dejar una sala sin paso mientras se planea, pero no pagar así', () => {
    const s = open('medias');
    const dorm = room(s, 'dormitorio');
    const gone: Action = { type: 'demolish', id: dorm.id };
    // Sin el dormitorio, la capilla se queda sin paso: suelto no se puede, en el plano sí.
    expect(canWork(s, gone)).toMatch(/sin paso/);
    expect(needsPlan(s, gone)).toBe(true);
    const half = tryWorks(s, [gone]);
    if ('error' in half) throw new Error(half.error);
    expect(planIssue(half)).toMatch(/sin paso/);
    expect(reduce(s, { type: 'works', steps: [gone] })).toBe(s);
    // Otras salas en el hueco devuelven el paso y entonces sí se paga.
    const steps: Action[] = [
      gone,
      { type: 'build', room: 'cocina', col: 1, floor: 1 },
      { type: 'build', room: 'bodega', col: 2, floor: 1 },
    ];
    const whole = tryWorks(s, steps);
    if ('error' in whole) throw new Error(whole.error);
    expect(planIssue(whole)).toBeNull();
    expect(reduce(s, { type: 'works', steps })).not.toBe(s);
  });

  it('en el plano se puede quitar el salón para ponerlo en otro sitio, pero no pagar sin él', () => {
    const s = { ...newGame('obligatorias'), mode: 'libre' as const, gold: 9999 };
    const salon = s.building.rooms.find((r) => r.type === 'salon')!;
    const quit: Action = { type: 'demolish', id: salon.id };
    // Fuera del plano no se puede; en el plano sí, y el plano avisa de lo que falta.
    expect(canWork(s, quit)).toMatch(/no se puede quitar/);
    expect(needsPlan(s, quit)).toBe(true);
    const plan = tryWorks(s, [quit]);
    if ('error' in plan) throw new Error(plan.error);
    expect(planIssue(plan)).toMatch(/Falta: Salón/);
    expect(reduce(s, { type: 'works', steps: [quit] })).toBe(s);
  });

  it('en el borrador: mover varias veces paga una mudanza; lo puesto en él se quita gratis', () => {
    const s = open();
    const enf = room(s, 'enfermeria').id;
    const moved = tryWorks(s, [
      { type: 'move', id: enf, col: 1, floor: 2 },
      { type: 'move', id: enf, col: 0, floor: 1 },
      { type: 'move', id: enf, col: 1, floor: 2 },
    ]);
    if ('error' in moved) throw new Error(moved.error);
    expect(s.gold - moved.gold).toBe(MOVE_COST);
    const built = tryWorks(s, [
      { type: 'build', room: 'cocina', col: 1, floor: 2 },
      { type: 'demolish', id: 'r1' },
    ]);
    if ('error' in built) throw new Error(built.error);
    expect(built.gold).toBe(s.gold);
  });

  it('en el borrador no se mira el oro paso a paso: se avisa al pagar', () => {
    const s = { ...open(), gold: 50 };
    const d = tryWorks(s, [{ type: 'build', room: 'cocina', col: 1, floor: 2 }]);
    if ('error' in d) throw new Error(d.error);
    expect(planIssue(d)).toMatch(/Te faltan/);
    expect(
      reduce(s, { type: 'works', steps: [{ type: 'build', room: 'cocina', col: 1, floor: 2 }] }),
    ).toBe(s);
  });
});
