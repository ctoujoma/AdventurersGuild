import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, EXP_CAMP, MAX_CANDIDATES } from './balance';
import {
  canExpedition,
  distAt,
  dropBundle,
  expSlots,
  itemGlow,
  matGlow,
  optionIssue,
  optionRisk,
  partyCap,
  potionsMax,
  headingOpen,
  hurtSlow,
  HOUR,
  expWeather,
  stepExpeditions,
} from './expedition';
import { emptyStats } from './feats';
import { endDay, newGame, reduce, tick } from './game';
import type { GameState } from './model';
import { GEAR } from '../data/items';
import { tx } from '../textos';
import { marchNow, replayNow } from '../ui/expedition';
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
    expect(canExpedition(s, 'sierra', ids, 10)).toMatch(/5 días/);
    expect(canExpedition({ ...s, expBest: { bosque: 5 } }, 'sierra', ids, 10)).toBeNull();
    expect(canExpedition({ ...s, expBest: { bosque: 5 } }, 'marismas', ids, 10)).toMatch(/6 días/);
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
    if (e) expect(distAt(e)).toBeGreaterThanOrEqual(1);
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
    s.heroes.find((h) => h.id === ids[0])!.hp = 0;
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

  it('el segundo guardián del bosque es el Jabalí Quemado, con su pelea', () => {
    let s = waiting('guardian');
    const e = s.expeditions![0]!;
    e.pending!.foe = 1;
    s = reduce(s, { type: 'expChoose', id: e.id, option: 'pelear' });
    const lines = s.expeditions?.[0]?.log ?? s.reports[0]?.exp?.log ?? [];
    const f = lines.find((l) => l.fight)?.fight;
    expect(f?.exp?.guardian).toBe(true);
    expect(f?.exp?.foe).toBe(1);
    expect(tx(f!.foe)).toMatch(/Jabalí Quemado/);
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

  it('lo que encuentran brilla según su rareza y lo raro se avisa', () => {
    expect([0, 1, 2, 3, 4].map((r) => itemGlow(r as 0))).toEqual([1, 1, 2, 3, 3]);
    expect(matGlow('cristal')).toBe(2);
    expect(matGlow('madera')).toBe(0);
    let s = out('brillo');
    const leg = GEAR.find((g) => g.rarity === 3)!;
    s.expBundles = [
      {
        id: 'f1',
        heading: 'bosque',
        dist: 0.3,
        side: 0,
        day: 1,
        who: ['Bruna'],
        gold: 5,
        mats: {},
        items: [{ id: 'iL', ...leg }],
      },
    ];
    const { news } = stepExpeditions(s, s.expeditions![0]!.from + DAY_SECONDS);
    const e = s.expeditions![0]!;
    expect(e.log.find((l) => tx(l.t).includes('fardo del gremio'))?.g).toBe(3);
    expect(news.some((n) => n.glow === 3 && n.big)).toBe(true);
    // Al volver, el informe guarda la mochila para «La mochila».
    s = reduce(s, { type: 'expBack', id: e.id });
    s = play(s, 2);
    const r = s.reports.find((x) => x.exp)!;
    expect(r.exp!.heading).toBe('bosque');
    expect(r.exp!.bag!.items!.some((it) => it.id === 'iL')).toBe(true);
    expect(r.exp!.days).toBeGreaterThanOrEqual(1);
  });
});

describe('expediciones: bloque 5 (rumbos, tiempo, pociones y la carta)', () => {
  it('se puede ir a los cuatro rumbos, cada uno con sus enemigos', () => {
    for (const heading of ['sierra', 'marismas', 'ruinas'] as const) {
      let s = ready(`rumbo-${heading}`);
      s.expBest = { bosque: 5, sierra: 6, marismas: 7 };
      const ids = s.heroes.slice(0, 2).map((h) => h.id);
      expect(canExpedition(s, heading, ids, 12)).toBeNull();
      s = reduce(s, { type: 'expedition', heading, heroIds: ids, rations: 12 });
      s = play(s, 8);
      const r = s.reports.find((x) => x.exp?.heading === heading);
      expect(r).toBeTruthy();
    }
  });

  it('el tiempo es el del rumbo lejos de casa, y la nieve gasta más raciones', () => {
    let s = ready('nieve');
    s.expBest = { bosque: 5 };
    const ids = s.heroes.slice(0, 2).map((h) => h.id);
    s = reduce(s, { type: 'expedition', heading: 'sierra', heroIds: ids, rations: 40 });
    const e0 = s.expeditions![0]!;
    expect(expWeather(e0)).toBe('claro');
    s = play(s, 6);
    const e = s.expeditions?.[0] ?? null;
    const log = e?.log ?? s.reports.find((x) => x.exp)!.exp!.log;
    // En seis días por la sierra, alguno nieva o hace viento (y se apunta).
    expect(log.some((l) => /nevar|viento/.test(tx(l.t)))).toBe(true);
  });

  it('las pociones son las hechas en la alquimia, curan por la noche y las que sobran vuelven', () => {
    let s = ready('pocion');
    expect(potionsMax(s)).toBe(0);
    const ids = [s.heroes[0]!.id];
    expect(canExpedition(s, 'bosque', ids, 12, false, 1)).toMatch(/alquimia/);
    s.potions = 3;
    s = reduce(s, { type: 'expedition', heading: 'bosque', heroIds: ids, rations: 12, potions: 2 });
    expect(s.potions).toBe(1);
    s.heroes.find((h) => h.id === ids[0])!.hp = 0.3;
    s = play(s, 1);
    const e = s.expeditions![0]!;
    expect(e.log.some((l) => tx(l.t).includes('bebe una poción'))).toBe(true);
    const left = e.potions ?? 0;
    s = reduce(s, { type: 'expBack', id: e.id });
    s = play(s, 2);
    expect(s.potions).toBe(1 + left);
  });

  it('con el primer veterano llega la carta, una vez y sin pisar otro tutorial', () => {
    let s = ready('carta');
    expect(s.expOpened).toBeUndefined();
    s = endDay(s);
    expect(s.expOpened).toBe(s.day);
    expect(s.reports.filter((r) => r.vet)).toHaveLength(1);
    s = endDay(s);
    expect(s.reports.filter((r) => r.vet)).toHaveLength(1);
    // Con el tutorial de obras en marcha, espera.
    let o = ready('carta-obras');
    o.tutorial = { step: 0, track: 'obras', letter: true, wait: true };
    o = endDay(o);
    expect(o.expOpened).toBeUndefined();
  });

  const out = (seed: string) => {
    const s = ready(seed);
    const h = s.heroes[0]!;
    return reduce(s, { type: 'expedition', heading: 'bosque', heroIds: [h.id], rations: 20 });
  };

  it('el que se une no pasa del tope de la barra, y sin nadie en pie el suceso queda en el diario', () => {
    let s = out('arreglos');
    const e = s.expeditions![0]!;
    const g = { ...s.heroes[1]!, id: 'guest1', name: 'Invitado' };
    e.guest = g;
    while (s.candidates.length < MAX_CANDIDATES)
      s.candidates.push({ ...g, id: `c${s.candidates.length}` });
    const first = s.candidates[0]!.id;
    s = reduce(s, { type: 'expBack', id: e.id });
    s = play(s, 2);
    // (Al amanecer pueden llegar otros: nunca pasa del tope y el primero ya se fue.)
    expect(s.candidates.length).toBeLessThanOrEqual(MAX_CANDIDATES);
    expect(s.candidates.some((c) => c.id === first)).toBe(false);
    // Todos en el suelo con un suceso esperando.
    let t = out('nadie');
    const x = t.expeditions![0]!;
    t.heroes.find((h) => h.id === x.heroIds[0])!.hp = 0;
    x.pending = { kind: 'cofre', h: x.hours, until: x.hours };
    t = play(t, 1);
    const log = (t.expeditions?.[0] ?? null)?.log ?? t.reports.find((r) => r.exp)!.exp!.log;
    expect(log.some((l) => tx(l.t).startsWith('Nadie estaba'))).toBe(true);
  });

  it('la vida se guarda: entran con la suya, se curan algo de noche y vuelven con la que traen', () => {
    let s = out('vida');
    const h = s.heroes.find((x) => x.id === s.expeditions![0]!.heroIds[0])!;
    h.hp = 0.4;
    s = play(s, 1);
    const h1 = s.heroes.find((x) => x.id === h.id)!;
    const e = s.expeditions?.[0];
    // De noche, al acampar, algo mejor (si no les ha pasado nada peor) y avisado de que va herido.
    if (e && !e.log.some((l) => l.k === 'pelea' || l.won === false))
      expect(h1.hp!).toBeGreaterThan(0.4);
    // Ir con heridos les frena.
    if (e) expect(hurtSlow(e, s)).toBeGreaterThanOrEqual(0);
    // Al volver, la vida que traen manda: sigue «leve» o mejor, y en pie (no a la cama).
    s = reduce(s, { type: 'expBack', id: s.expeditions![0]!.id });
    s = play(s, 2);
    const back = s.heroes.find((x) => x.id === h.id)!;
    expect(back.status === 'ok' || back.status === 'herido').toBe(true);
    expect(back.hp).toBeDefined();
  });

  it('las partidas de antes (heridas contadas) pasan a vida al seguir', () => {
    let s = out('antes');
    const e = s.expeditions![0]!;
    const id = e.heroIds[0]!;
    e.hurt = { [id]: 1 };
    s = play(s, 1);
    expect(s.expeditions?.[0]?.hurt).toBeUndefined();
    expect(s.heroes.find((x) => x.id === id)!.hp!).toBeLessThan(1);
  });

  it('al volver con el récord que pide, se abre el rumbo siguiente (con aviso)', () => {
    const s = out('abre');
    s.expBest = { bosque: 4.9 };
    const e = s.expeditions![0]!;
    // Como si hubieran llegado a 5 días: media vuelta allí.
    e.turn = { h: e.hours, dist: 5.2, why: 'jugador', idle: 0 };
    e.hours = 0;
    const { news } = stepExpeditions(s, e.from + 12 * DAY_SECONDS);
    expect(s.expeditions ?? []).toHaveLength(0);
    expect(news.some((n) => n.big && /sierra/.test(tx(n.t)))).toBe(true);
    expect(headingOpen(s, 'sierra')).toBe(true);
  });

  it('un jefe a la vista espera al jugador: pelear, que peleen solos o escapar', () => {
    let s = out('jefe');
    const e = s.expeditions![0]!;
    e.pending = { kind: 'jefe', h: e.hours, until: e.hours + 24, foe: 3 };
    // Esperan parados hasta el día siguiente.
    s = reduce(s, { type: 'tick', to: (s.clock ?? 0) + 60 });
    expect(s.expeditions![0]!.pending?.kind).toBe('jefe');
    // Escapar: sin pelea (bien o con un golpe).
    s = reduce(s, { type: 'expChoose', id: e.id, option: 'escapar' });
    const x = s.expeditions?.[0] ?? null;
    if (x) {
      expect(x.pending).toBeUndefined();
      expect(x.log.some((l) => l.k === 'pelea')).toBe(false);
    }
    // Sin respuesta, pelean solos.
    let t = out('jefe-solos');
    const y = t.expeditions![0]!;
    y.pending = { kind: 'jefe', h: y.hours, until: y.hours + 1, foe: 3 };
    t = play(t, 1);
    const log = t.expeditions?.[0]?.log ?? t.reports.find((r) => r.exp)!.exp!.log;
    expect(log.some((l) => l.k === 'pelea')).toBe(true);
  });

  it('se puede dar una poción a mano (fuera, de las que llevan; en casa, de la alquimia)', () => {
    let s = out('beber');
    const e = s.expeditions![0]!;
    const h = s.heroes.find((x) => x.id === e.heroIds[0])!;
    h.hp = 0.3;
    e.potions = 1;
    s = reduce(s, { type: 'drink', heroId: h.id, expId: e.id });
    expect(s.heroes.find((x) => x.id === h.id)!.hp!).toBeCloseTo(0.65);
    expect(s.expeditions![0]!.potions).toBe(0);
    expect(reduce(s, { type: 'drink', heroId: h.id, expId: e.id })).toBe(s);
    // En casa.
    const home = s.heroes.find((x) => x.status === 'ok')!;
    home.hp = 0.4;
    s.potions = 2;
    s = reduce(s, { type: 'drink', heroId: home.id });
    expect(s.potions).toBe(1);
    expect(s.heroes.find((x) => x.id === home.id)!.hp!).toBeCloseTo(0.75);
  });

  it('quien acaba una pelea grave bebe una poción al momento', () => {
    let s = out('pocion-pelea');
    const e = s.expeditions![0]!;
    const h = s.heroes.find((x) => x.id === e.heroIds[0])!;
    h.hp = 0.15;
    e.potions = 2;
    e.pending = { kind: 'jefe', h: e.hours, until: e.hours + 24, foe: 3 };
    s = reduce(s, { type: 'expChoose', id: e.id, option: 'solos' });
    const x = s.expeditions?.[0];
    const log = x?.log ?? s.reports.find((r) => r.exp)!.exp!.log;
    expect(log.some((l) => tx(l.t).startsWith('Acabada la pelea'))).toBe(true);
    expect(s.heroes.find((y) => y.id === h.id)!.hp!).toBeGreaterThan(0);
  });

  it('con un suceso esperando, en el visor están parados', () => {
    const s = out('parados');
    const e = s.expeditions![0]!;
    e.pending = { kind: 'jefe', h: e.hours, until: e.hours + 24, foe: 3 };
    const m = marchNow(s, e);
    expect(['wait', 'camp']).toContain(m.mode);
  });

  it('de noche, en el campamento, solo pasan cosas de campamento', () => {
    let s = ready('noche-campamento');
    s.expBest = { bosque: 5 };
    const ids = s.heroes.slice(0, 2).map((h) => h.id);
    s = reduce(s, { type: 'expedition', heading: 'bosque', heroIds: ids, rations: 40 });
    const e0 = s.expeditions![0]!;
    s = play(s, 6);
    const e = s.expeditions?.[0];
    const log = e?.log ?? s.reports.find((r) => r.exp)!.exp!.log;
    const hod = (h: number) => Math.floor(((e0.from + h * HOUR) % DAY_SECONDS) / HOUR);
    const night = log.filter((l) => l.h > 0 && hod(l.h) > EXP_CAMP);
    for (const l of night)
      expect(['noche', 'pelea', 'cura', 'herida', 'aviso', 'vuelta', 'llegada']).toContain(l.k);
  });

  it('las peleas guardan lo justo para repetirlas con la escena del visor', () => {
    let s = out('repeticion');
    const e = s.expeditions![0]!;
    e.pending = { kind: 'jefe', h: e.hours, until: e.hours + 24, foe: 3 };
    s = reduce(s, { type: 'expChoose', id: e.id, option: 'solos' });
    const log = s.expeditions?.[0]?.log ?? s.reports.find((r) => r.exp)!.exp!.log;
    const f = log.find((l) => l.fight)!.fight!;
    expect(f.exp?.heading).toBe('bosque');
    const m = replayNow(s, f)!;
    expect(m.mode).toBe('fight');
    expect(m.terrain).toBe('bosque');
    // Las guardadas antes (sin `exp`) también: el rumbo y el enemigo salen de sus textos.
    const old = { ...f, exp: undefined };
    const m2 = replayNow(s, old)!;
    expect(m2.mode).toBe('fight');
    expect(m2.terrain).toBe('bosque');
  });
});
