import { describe, expect, it } from 'vitest';
import { LOCK_TIME, VAULT_STORE } from './balance';
import { YARD, assaultSetup, raidGraph, raidRoute, simulate, type AssaultSetup } from './assault';
import { endDay, guardsFull, newGame, reduce } from './game';
import type { GameState } from './model';
import { Rng } from './rng';
import { goldCap, lockTime } from './vault';

const roomOf = (s: GameState, type: string) => s.building.rooms.find((r) => r.type === type)!;

/** Asalto de prueba sobre la taberna del tío: los bandidos y quién defiende, a mano. */
function setup(s: GameState, over: Partial<AssaultSetup> = {}): AssaultSetup {
  return { ...assaultSetup(s, 20, new Rng('x')), defenders: [], ...over };
}

describe('la cámara del tesoro', () => {
  it('guarda el oro según su tamaño y nivel; lo que no cabe se pierde y se avisa', () => {
    let s = newGame('camara');
    expect(goldCap(s)).toBe(VAULT_STORE[1]);
    s.gold = goldCap(s) - 10;
    s.inventory.push({ id: 'x', name: 'Cáliz', desc: '', value: 40, kind: 'tesoro' });
    s = reduce(s, { type: 'sell', itemId: 'x' });
    expect(s.gold).toBe(goldCap(s));
    expect(s.spilt).toBe(30);
    const next = endDay({ ...s, tips: ['*'] });
    expect(next.spilt).toBeUndefined();
    expect(next.dawn.some((e) => /cámara del tesoro está llena/.test(e.t))).toBe(true);
    // Mejorarla: cabe más y la cerradura aguanta más.
    const v = roomOf(s, 'tesoro');
    v.level = 3;
    v.w = 2;
    expect(goldCap(s)).toBe(VAULT_STORE[3] * 2);
    expect(lockTime(s)).toBe(LOCK_TIME[3]);
  });

  it('en la puerta caben dos de guardia', () => {
    let s = newGame('guardias');
    s.heroes.push({ ...s.heroes[0]!, id: 'h3' });
    for (const h of s.heroes) s = reduce(s, { type: 'guard', id: h.id, on: true });
    expect(s.heroes.filter((h) => h.guard)).toHaveLength(2);
    expect(guardsFull(s)).toBe(true);
  });
});

describe('el asalto sala a sala', () => {
  it('el camino de los bandidos va del recibidor a la cámara por la escalera', () => {
    const s = newGame('ruta');
    const route = raidRoute(s.building);
    expect(route[0]).toBe(roomOf(s, 'recibidor').id);
    expect(route.at(-1)).toBe(roomOf(s, 'tesoro').id);
    // Baja por la escalera al sótano y cruza la armería y la forja.
    expect(route).toContain(roomOf(s, 'armeria').id);
    expect(
      raidGraph(s.building)
        .get(YARD)!
        .some((e) => e.to === route[0]),
    ).toBe(true);
  });

  it('sin nadie en casa: rompen la puerta, abren la cámara y se llevan lo que cargan', () => {
    const s = newGame('vacia');
    s.gold = 400;
    const set = setup(s);
    const r = simulate(set, new Rng('a'));
    const kinds = r.plan.steps.map((x) => x.k);
    expect(kinds).toContain('door');
    expect(kinds).toContain('broke');
    expect(kinds).toContain('open');
    expect(r.escaped).toBe(set.bandits.length);
    expect(r.stolen).toBe(Math.min(400, set.carry * set.bandits.length));
    // La puerta se rompe antes de abrir la cámara, y la cámara antes de escapar.
    expect(kinds.indexOf('broke')).toBeLessThan(kinds.indexOf('open'));
    expect(kinds.lastIndexOf('escape')).toBe(kinds.length - 1);
  });

  it('los de guardia pelean en el patio y, si ganan, no entra nadie', () => {
    const s = newGame('patio');
    const door = roomOf(s, 'recibidor').id;
    const set = setup(s, {
      defenders: [
        { id: 'g1', power: 40, hp: 30, at: door, guard: true, wake: 0 },
        { id: 'g2', power: 40, hp: 30, at: door, guard: true, wake: 0 },
      ],
    });
    const r = simulate(set, new Rng('b'));
    expect(r.plan.steps.find((x) => x.k === 'fight')).toMatchObject({ at: YARD });
    expect(r.plan.steps.some((x) => x.k === 'broke')).toBe(false);
    expect(r.escaped).toBe(0);
    expect(r.downed).toBe(set.bandits.length);
  });

  it('los que duermen acuden; si paran a los bandidos al salir, el oro se recupera', () => {
    const s = newGame('vuelta');
    s.gold = 300;
    const bed = roomOf(s, 'dormitorio').id;
    // Llegan tarde (se despiertan cuando ya han abierto la cámara), pero pegan fuerte.
    const set = setup(s, {
      defenders: [{ id: 'h', power: 60, hp: 60, at: bed, wake: 17 }],
      lock: 3,
      door: 1,
    });
    const r = simulate(set, new Rng('c'));
    expect(r.plan.steps.some((x) => x.k === 'open')).toBe(true);
    expect(r.escaped).toBe(0);
    expect(r.stolen).toBe(0);
    expect(r.recovered).toBeGreaterThan(0);
  });

  it('una cerradura mejor da tiempo a que lleguen los refuerzos', () => {
    const s = newGame('cerradura');
    const bed = roomOf(s, 'dormitorio').id;
    const late = { id: 'h', power: 60, hp: 60, at: bed, wake: 14 };
    const weak = simulate(setup(s, { defenders: [late], lock: 1, door: 1 }), new Rng('d'));
    const strong = simulate(setup(s, { defenders: [late], lock: 30, door: 1 }), new Rng('d'));
    expect(weak.plan.steps.some((x) => x.k === 'open')).toBe(true);
    expect(strong.plan.steps.some((x) => x.k === 'open')).toBe(false);
  });

  it('el informe del asalto lleva la pelea para verla en la escena', () => {
    const s = newGame('informe');
    s.day = 20;
    s.raid = { day: 20, band: 'los Hermanos Cuervo', strength: 20, warned: true };
    const next = endDay({ ...s, tips: ['*'] });
    const plan = next.lastRaid?.plan;
    expect(plan?.route.length).toBeGreaterThan(1);
    expect(plan?.steps.length).toBeGreaterThan(3);
    expect(plan?.end).toBeGreaterThan(0);
    // Quien cae, cae herido (no muere) y deja la guardia.
    for (const id of next.lastRaid!.hurt)
      expect(next.heroes.find((h) => h.id === id)).toMatchObject({ status: 'herido' });
  });
});
