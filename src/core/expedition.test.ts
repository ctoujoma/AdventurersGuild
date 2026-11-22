import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, EXP_HURT_DOWN } from './balance';
import { canExpedition, distAt, expSlots, partyCap, stepExpeditions } from './expedition';
import { emptyStats } from './feats';
import { endDay, newGame, reduce, tick } from './game';
import type { GameState } from './model';
import { tx } from '../textos';

/** Una partida con veterano, comida de sobra y la sala de mapas a nivel 3 (4 por grupo). */
function ready(seed = 'expedicion'): GameState {
  const s = newGame(seed);
  s.stats = { ...emptyStats(), maxLvl: 8 };
  s.food = 60;
  for (const h of s.heroes) {
    h.lvl = 8;
    h.status = 'ok';
    delete h.guard;
    delete h.job;
  }
  s.building.rooms.find((r) => r.type === 'mapas')!.level = 3;
  return s;
}

/** Pasa días enteros con el juego abierto (el reloj a saltos de `step` segundos). */
function play(s: GameState, days: number, step = 5): GameState {
  for (let d = 0; d < days; d++) {
    for (let c = step; c <= DAY_SECONDS; c += step) s = reduce(s, { type: 'tick', to: c });
    s = endDay(s);
  }
  return s;
}

describe('expediciones', () => {
  it('se abren con el primer veterano y con la sala de mapas', () => {
    const s = ready();
    const ids = s.heroes.slice(0, 2).map((h) => h.id);
    expect(canExpedition(s, 'bosque', ids, 10)).toBeNull();
    expect(canExpedition(s, 'sierra', ids, 10)).toMatch(/obras/);
    expect(canExpedition(s, 'bosque', ids, 3)).toMatch(/raciones/);
    expect(canExpedition(s, 'bosque', ids, 999)).toMatch(/despensa/);
    expect(canExpedition({ ...s, stats: emptyStats() }, 'bosque', ids, 10)).toMatch(/veterano/);
    expect(partyCap(s)).toBe(4);
    expect(expSlots(s)).toBe(1);
  });

  it('salen con sus raciones, van más lejos cada día y vuelven solos', () => {
    let s = ready();
    const ids = s.heroes.slice(0, 2).map((h) => h.id);
    const food = s.food;
    s = reduce(s, { type: 'expedition', heading: 'bosque', heroIds: ids, rations: 12 });
    expect(s.food).toBe(food - 12);
    expect(s.expeditions).toHaveLength(1);
    expect(s.heroes.find((h) => h.id === ids[0])!.status).toBe('mision');
    s = play(s, 2);
    const e = s.expeditions?.[0];
    if (e) expect(distAt(e)).toBeGreaterThan(1);
    s = play(s, 10);
    expect(s.expeditions ?? []).toHaveLength(0);
    const r = s.reports.find((x) => tx(x.title).startsWith('Expedición al bosque'));
    expect(r).toBeTruthy();
    for (const id of ids) expect(s.heroes.find((h) => h.id === id)!.status).not.toBe('mision');
  });

  it('pasa lo mismo con el juego abierto que cerrado', () => {
    let a = ready('igual');
    const ids = a.heroes.slice(0, 3).map((h) => h.id);
    a = reduce(a, { type: 'expedition', heading: 'bosque', heroIds: ids, rations: 18 });
    let b = structuredClone(a);
    a = play(a, 3);
    for (let d = 0; d < 3; d++) b = endDay(tick(b, DAY_SECONDS), true);
    const log = (s: GameState) => (s.expeditions?.[0]?.log ?? []).map((l) => tx(l.t));
    expect(log(a).length).toBeGreaterThan(3);
    expect(log(b)).toEqual(log(a));
  });

  it('se les puede mandar volver: la vuelta tarda la mitad', () => {
    let s = ready('vuelta');
    const ids = s.heroes.slice(0, 1).map((h) => h.id);
    s = reduce(s, { type: 'expedition', heading: 'bosque', heroIds: ids, rations: 20 });
    s = play(s, 2);
    const id = s.expeditions![0]!.id;
    s = reduce(s, { type: 'expBack', id });
    const e = s.expeditions![0]!;
    expect(e.turn?.why).toBe('jugador');
    const far = distAt(e);
    stepExpeditions(s, e.from + (e.hours + Math.ceil(far * 12) - 1) * (DAY_SECONDS / 24));
    expect(s.expeditions).toHaveLength(1);
    s = play(s, Math.ceil(far / 2) + 1);
    expect(s.expeditions ?? []).toHaveLength(0);
  });

  it('si cae alguien, dan la vuelta', () => {
    let s = ready('caer');
    const ids = s.heroes.slice(0, 2).map((h) => h.id);
    s = reduce(s, { type: 'expedition', heading: 'bosque', heroIds: ids, rations: 20 });
    const e = s.expeditions![0]!;
    e.hurt[ids[0]!] = EXP_HURT_DOWN;
    // Una pelea perdida con el otro en pie hace volver; aquí lo forzamos con un día largo lejos.
    s = play(s, 14);
    expect(s.expeditions ?? []).toHaveLength(0);
  });
});
