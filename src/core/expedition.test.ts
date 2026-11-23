import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, EXP_HURT_DOWN } from './balance';
import {
  canExpedition,
  distAt,
  dropBundle,
  expSlots,
  optionIssue,
  optionRisk,
  partyCap,
  stepExpeditions,
} from './expedition';
import { emptyStats } from './feats';
import { endDay, newGame, reduce, tick } from './game';
import type { GameState } from './model';
import { tx } from '../textos';
import { runCombat } from './combat';
import { Rng } from './rng';

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

describe('expediciones: sucesos con decisión y peleas', () => {
  /** Una expedición en marcha de un solo héroe (un guerrero) con un suceso a elegir. */
  function waiting(kind: Parameters<typeof raiseFor>[1]) {
    let s = ready('suceso');
    const h = s.heroes[0]!;
    h.cls = 'guerrero';
    s = reduce(s, { type: 'expedition', heading: 'bosque', heroIds: [h.id], rations: 20 });
    raiseFor(s, kind);
    return s;
  }
  function raiseFor(s: GameState, kind: 'cofre' | 'guardian' | 'santuario') {
    const e = s.expeditions![0]!;
    e.pending = { kind, h: e.hours, until: e.hours + 6 };
  }

  it('esperan parados al plazo y, si nadie dice nada, eligen con prudencia', () => {
    let s = waiting('cofre');
    const e0 = structuredClone(s.expeditions![0]!);
    s = play(s, 1);
    const e = s.expeditions![0]!;
    expect(e.pending).toBeUndefined();
    expect(e.idle).toBeGreaterThanOrEqual(6);
    expect(e.log.some((l) => tx(l.t).includes('prudencia'))).toBe(true);
    expect(e.log.some((l) => tx(l.t).includes('Mejor no tocar'))).toBe(true);
    expect(distAt(e)).toBeLessThan(distAt({ ...e, idle: 0 }) + 1e-9);
    expect(e0.idle ?? 0).toBe(0);
  });

  it('las opciones de una clase que no va salen tachadas', () => {
    const s = waiting('cofre');
    const e = s.expeditions![0]!;
    expect(optionIssue(s, e, 'forzar')).toBeNull();
    expect(optionIssue(s, e, 'ganzua')).toMatch(/pícaro/);
    expect(optionRisk(s, e, 'forzar').level).toBeGreaterThanOrEqual(0);
  });

  it('elegir resuelve ya; silenciar decide con prudencia', () => {
    let s = waiting('cofre');
    const id = s.expeditions![0]!.id;
    s = reduce(s, { type: 'expChoose', id, option: 'forzar' });
    expect(s.expeditions![0]!.pending).toBeUndefined();
    let m = waiting('santuario');
    m = reduce(m, { type: 'expMute', id: m.expeditions![0]!.id, on: true });
    expect(m.expeditions![0]!.pending).toBeUndefined();
    expect(m.expeditions![0]!.mute).toBe(true);
  });

  it('las peleas quedan guardadas y se repiten igual', () => {
    let s = waiting('guardian');
    const id = s.expeditions![0]!.id;
    s = reduce(s, { type: 'expChoose', id, option: 'pelear' });
    const f =
      s.expeditions?.[0]?.log.find((l) => l.fight)?.fight ??
      s.reports[0]?.exp?.log.find((l) => l.fight)?.fight;
    expect(f).toBeTruthy();
    expect(runCombat(f!.sim!.setup).won).toBe(f!.won);
  });
});

describe('expediciones: el mapa (parajes, fardos y récords)', () => {
  function out(seed: string, mute = false) {
    let s = ready(seed);
    const h = s.heroes[0]!;
    h.cls = 'guerrero';
    s = reduce(s, { type: 'expedition', heading: 'bosque', heroIds: [h.id], rations: 20 });
    if (mute) s.expeditions![0]!.mute = true;
    return s;
  }
  const site = {
    id: 'p1',
    kind: 'cueva' as const,
    heading: 'bosque' as const,
    dist: 0.3,
    side: 0,
    day: 1,
  };

  it('un paraje sin ver vuelve a salir al pasar; entrar lo deja visto', () => {
    let s = out('paraje');
    s.expSites = [{ ...site }];
    s = play(s, 1);
    const e = s.expeditions![0]!;
    expect(e.passed).toContain('p1');
    expect(e.log.some((l) => tx(l.t).includes('dejó sin explorar'))).toBe(true);
    if (e.pending) {
      expect(e.pending.site).toBe('p1');
      s = reduce(s, { type: 'expChoose', id: e.id, option: 'entrar' });
      expect(s.expSites![0]!.done).toBe(s.day);
    } else expect(s.expSites![0]!.done).toBeUndefined();
  });

  it('silenciada, sigue de largo y el paraje queda para otra vez', () => {
    let s = out('paraje-mudo', true);
    s.expSites = [{ ...site }];
    s = play(s, 1);
    const e = s.expeditions![0]!;
    expect(e.pending).toBeUndefined();
    expect(e.log.some((l) => tx(l.t).includes('prudencia'))).toBe(true);
    expect(s.expSites![0]!.done).toBeUndefined();
  });

  it('si caen todos, lo que no cargan queda como fardo y otra expedición lo recoge', () => {
    let s = out('fardo');
    const e = s.expeditions![0]!;
    e.bag.gold = 90;
    e.bag.mats = { madera: 6 };
    dropBundle(s, e, new Rng('x'), 0.3);
    expect(e.bag.gold).toBe(30);
    expect(e.bag.mats.madera).toBe(2);
    const b = s.expBundles![0]!;
    expect(b.gold).toBe(60);
    expect(b.mats.madera).toBe(4);
    // Otra expedición al bosque pasa por allí.
    s.expeditions = [];
    s.heroes[0]!.status = 'ok';
    s = reduce(s, {
      type: 'expedition',
      heading: 'bosque',
      heroIds: [s.heroes[0]!.id],
      rations: 20,
    });
    s = play(s, 1);
    expect(s.expBundles ?? []).toHaveLength(0);
    expect(s.stats!.expBundles).toBe(1);
    const e2 = s.expeditions![0]!;
    expect(e2.bag.gold).toBeGreaterThanOrEqual(60);
    expect(e2.log.some((l) => tx(l.t).includes('fardo del gremio'))).toBe(true);
  });

  it('al pasar el récord del rumbo lo apuntan; al volver, el récord sube', () => {
    let s = out('record');
    s.expBest = { bosque: 0.1 };
    s = play(s, 1);
    expect(s.expeditions![0]!.log.some((l) => tx(l.t).includes('récord'))).toBe(true);
    s = reduce(s, { type: 'expBack', id: s.expeditions![0]!.id });
    s = play(s, 2);
    expect(s.expBest!.bosque!).toBeGreaterThan(0.1);
    expect(s.stats!.expeditions).toBe(1);
  });
});
