/**
 * Peleas de referencia: lo que dan jefes, asaltos y el ladrón con semillas fijas, grabado en
 * `fixtures/peleas.json` (la pelea, las órdenes y un resumen del registro). Los informes viejos
 * guardan la pelea para repetirla, así que el motor tiene que seguir dando exactamente lo mismo.
 *
 * Para volver a grabarlas (solo si se cambia la pelea a propósito, y sabiendo que los informes
 * viejos se verán distintos): `GRABAR_PELEAS=1 npx vitest run src/core/peleas.test.ts` y luego
 * `npx prettier --write src/core/fixtures/peleas.json`.
 */
import { describe, expect, it } from 'vitest';
import type { BossKind } from '../data/bosses';
import {
  Assault,
  YARD,
  assaultSetup,
  simulate,
  type AssaultSetup,
  type RaidOrder,
} from './assault';
import { WORKER_HP } from './balance';
import {
  Combat,
  heroUnit,
  questFoes,
  runCombat,
  setupCombat,
  type CombatSetup,
  type Order,
} from './combat';
import { newGame } from './game';
import { generateHero } from './generate';
import { thiefDuel } from './incidents';
import type { Duel, Facilities, GameState, Hero } from './model';
import type { ClassId } from './party';
import { Rng, hashString } from './rng';

declare const process: { env: Record<string, string | undefined> };

// ---------- Resumen del registro ----------

/** JSON con las claves ordenadas (el orden en que se escriben no cuenta). */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.entries(v)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, x]) => `${JSON.stringify(k)}:${canon(x)}`)
      .join(',')}}`;
  return JSON.stringify(v ?? null);
}

const digest = (log: readonly unknown[]) => ({
  n: log.length,
  hash: hashString(canon(log)).toString(16),
});

// ---------- Jefes ----------

/**
 * Habilidades a mano: el primero en cuanto la tiene; el segundo solo la primera vez (luego sale
 * sola al rato, `AUTO_SKILL`); los demás, uno de cada tres pasos.
 */
function skills(
  us: readonly { id: string; charge?: number }[],
  step: number,
  order: (who: string) => boolean,
): void {
  us.forEach((u, i) => {
    if (u.charge !== 0) return;
    if (i === 0 || (i > 1 && step % 3 === 0)) order(u.id);
    else if (i === 1 && !once.has(u.id) && order(u.id)) once.add(u.id);
  });
}
const once = new Set<string>();

interface Player {
  target?: boolean;
  skill?: boolean;
  cover?: boolean;
  crit?: boolean;
}

/** Un jugador de prueba que da órdenes de cada tipo a su ritmo (siempre igual). */
function playCombat(setup: CombatSetup, p: Player): Combat {
  once.clear();
  const c = new Combat(setup, [], false);
  let k = 0;
  while (!c.result) {
    const hs = c.heroes().filter((u) => u.hp > 0);
    const fs = c.foes().filter((u) => u.hp > 0);
    if (p.target && c.step % 23 === 7 && hs.length && fs.length) {
      c.order({ who: hs[k % hs.length]!.id, kind: 'target', to: fs[(k + 1) % fs.length]!.id });
      k++;
    }
    if (p.skill) skills(hs, c.step, (who) => c.order({ who, kind: 'skill' }));
    if (p.cover && hs[0]) {
      let warn = -1;
      for (const e of c.events) if (e.kind === 'warn') warn = e.step;
      // A tiempo, ocho pasos tras el aviso; y de vez en cuando antes de tiempo (no vale).
      if ((warn >= 0 && c.step - warn === 8) || c.step % 50 === 0)
        c.order({ who: hs[hs.length - 1]!.id, kind: 'cover' });
    }
    if (p.crit)
      for (const u of hs)
        if (u.critOpen && !u.critTaken && c.step % 2 === 0) c.order({ who: u.id, kind: 'crit' });
    c.tick();
  }
  return c;
}

const combatSummary = (c: Combat) => ({
  result: c.result,
  hp: c.units.map((u) => u.hp),
  events: digest(c.events),
});

interface CombatCase {
  name: string;
  setup: CombatSetup;
  /** auto: sin jugador (como `runCombat` sin órdenes); idle: con jugador que no toca nada. */
  mode: 'auto' | 'idle' | 'player';
  player?: Player;
  expect: ReturnType<typeof combatSummary> & { orders: Order[] };
}

// ---------- Asaltos ----------

interface RaidPlayer {
  move?: boolean;
  target?: boolean;
  skill?: boolean;
  crit?: boolean;
}

function playAssault(setup: AssaultSetup, state: number, p: RaidPlayer): Assault {
  once.clear();
  const a = new Assault(setup, new Rng(state));
  while (!a.result) {
    const ds = a.defs().filter((d) => !d.down && !d.worker);
    if (p.move && ds.length) {
      if (a.step === 15) a.order({ kind: 'move', who: ds.at(-1)!.id, to: setup.route[1] ?? YARD });
      if (a.step === 300) a.order({ kind: 'move', who: ds[0]!.id, to: YARD });
      if (a.step === 420) a.order({ kind: 'move', who: ds.at(-1)!.id, to: setup.route.at(-1)! });
    }
    if (p.target && a.step % 17 === 3)
      for (const d of ds) {
        const foes = a
          .bands()
          .filter((b) => !b.down && !b.gone && !b.to && !d.to && b.node === d.node);
        if (foes.length > 1) a.order({ kind: 'target', who: d.id, to: foes.at(-1)!.id });
      }
    if (p.skill) skills(ds, a.step, (who) => a.order({ kind: 'skill', who }));
    if (p.crit)
      for (const d of ds)
        if (d.critOpen && !d.critTaken && a.step % 2 === 0) a.order({ kind: 'crit', who: d.id });
    a.tick();
  }
  return a;
}

const assaultSummary = (a: Assault) => {
  const { plan, ...rest } = a.result!;
  return {
    result: rest,
    end: plan.end,
    start: plan.start,
    hp: plan.hp,
    route: plan.route,
    steps: digest(plan.steps),
    left: a.units.map((u) => [u.id, u.hp, u.node]),
  };
};

/** El montaje tal cual se graba: el grafo como lista y la vida infinita como texto. */
type SavedSetup = Omit<AssaultSetup, 'graph'> & {
  graph: [string, { to: string; dur: number }[]][];
};

const saveSetup = (s: AssaultSetup): SavedSetup => ({ ...s, graph: [...s.graph] });
const loadSetup = (s: SavedSetup): AssaultSetup => ({ ...s, graph: new Map(s.graph) });

interface AssaultCase {
  name: string;
  setup: SavedSetup;
  /** Estado del generador al acabar de montar el asalto (sigue la misma secuencia). */
  rng: number;
  player?: RaidPlayer;
  expect: ReturnType<typeof assaultSummary> & { orders: RaidOrder[] };
}

// ---------- El ladrón ----------

interface DuelCase {
  name: string;
  hero: Hero;
  fac: Facilities;
  rep: number;
  seed: string;
  at: number;
  expect: Duel | null;
}

const duelOf = (d: Omit<DuelCase, 'expect'>) =>
  thiefDuel(
    { heroes: [d.hero], fac: d.fac, rep: d.rep } as unknown as GameState,
    d.hero.id,
    d.seed,
    d.at,
  );

// ---------- Lo grabado ----------

interface Fixtures {
  combats: CombatCase[];
  assaults: AssaultCase[];
  duels: DuelCase[];
}

/** En el fichero, cada montaje va una vez y los casos lo nombran (por su semilla o su nombre). */
interface Saved {
  combatSetups: Record<string, CombatSetup>;
  assaultSetups: Record<string, SavedSetup>;
  combats: (Omit<CombatCase, 'setup'> & { setup: string })[];
  assaults: (Omit<AssaultCase, 'setup'> & { setup: string })[];
  duels: DuelCase[];
}

const keyOf = (name: string) => name.replace(/ \(.*\)$/, '');

function pack(fx: Fixtures): Saved {
  const combatSetups: Saved['combatSetups'] = {};
  const assaultSetups: Saved['assaultSetups'] = {};
  return {
    combatSetups,
    assaultSetups,
    combats: fx.combats.map((c) => {
      combatSetups[c.setup.seed] = c.setup;
      return { ...c, setup: c.setup.seed };
    }),
    assaults: fx.assaults.map((a) => {
      assaultSetups[keyOf(a.name)] = a.setup;
      return { ...a, setup: keyOf(a.name) };
    }),
    duels: fx.duels,
  };
}

const unpack = (s: Saved): Fixtures => ({
  combats: s.combats.map((c) => ({ ...c, setup: s.combatSetups[c.setup]! })),
  assaults: s.assaults.map((a) => ({ ...a, setup: s.assaultSetups[a.setup]! })),
  duels: s.duels,
});

const FILE = new URL('./fixtures/peleas.json', import.meta.url);

async function fs(): Promise<{
  readFileSync(p: URL, enc: 'utf8'): string;
  writeFileSync(p: URL, s: string): void;
}> {
  return import(/* @vite-ignore */ ['node', 'fs'].join(':'));
}

const INF = '∞';
const reviver = (_k: string, v: unknown) => (v === INF ? Infinity : v);
const replacer = (_k: string, v: unknown) => (v === Infinity ? INF : v);

// ---------- Cómo se arman (solo para grabar) ----------

function hero(seed: string, cls: ClassId, rank: number): Hero {
  return generateHero(new Rng(seed), `h-${seed}`, { rank, tab: rank + 1, cls });
}

function combatCases(): Omit<CombatCase, 'expect'>[] {
  const parties: [string, ClassId[], number][] = [
    ['pareja', ['guerrero', 'mago'], 0],
    ['trio', ['picaro', 'clerigo', 'explorador'], 1],
    ['cuatro', ['guerrero', 'clerigo', 'mago', 'explorador'], 2],
    ['cinco', ['guerrero', 'picaro', 'mago', 'clerigo', 'explorador'], 3],
    ['solo', ['picaro'], 1],
  ];
  const fights: [BossKind, number, number][] = [
    ['bestia', 12, 2],
    ['ahogado', 16, 2],
    ['reina', 14, 3],
    ['dragona', 22, 3],
    ['sierpe', 9, 1],
  ];
  const players: [string, CombatCase['mode'], Player?][] = [
    ['auto', 'auto'],
    ['idle', 'idle'],
    ['todo', 'player', { target: true, skill: true, cover: true, crit: true }],
    ['blanco', 'player', { target: true }],
    ['habilidad', 'player', { skill: true }],
    ['cubrirse', 'player', { cover: true }],
    ['critico', 'player', { crit: true }],
  ];
  const out: Omit<CombatCase, 'expect'>[] = [];
  parties.forEach(([pname, classes, rank], i) => {
    const heroes = classes.map((c, j) => heroUnit(hero(`${pname}-${j}`, c, rank)));
    for (let f = 0; f < 2; f++) {
      const [boss, diff, n] = fights[(i + f * 2) % fights.length]!;
      const foes = questFoes(
        boss,
        Array.from({ length: n }, () => ({ diff })),
      );
      const setup = setupCombat(`ref-${pname}-${boss}`, boss, heroes, foes);
      for (const [mname, mode, player] of players)
        out.push({ name: `${pname} contra ${boss} (${mname})`, setup, mode, player });
    }
  });
  return out;
}

function assaultCases(): Omit<AssaultCase, 'expect'>[] {
  const out: Omit<AssaultCase, 'expect'>[] = [];
  const build = (
    name: string,
    strength: number,
    tune: (s: GameState) => void,
    edit?: (a: AssaultSetup) => void,
  ) => {
    const s = newGame(`asalto-${name}`);
    tune(s);
    const rng = new Rng(`ref-${name}`);
    const setup = assaultSetup(s, strength, rng);
    edit?.(setup);
    const players: [string, RaidPlayer?][] = [
      ['solos', undefined],
      ['todo', { move: true, target: true, skill: true, crit: true }],
      ['mover', { move: true }],
      ['blanco y habilidad', { target: true, skill: true }],
      ['critico', { crit: true }],
    ];
    for (const [pname, player] of setup.defenders.length ? players : players.slice(0, 1))
      out.push({ name: `${name} (${pname})`, setup: saveSetup(setup), rng: rng.save(), player });
  };
  const add = (s: GameState, cls: ClassId, rank: number, k: number) => {
    const h = hero(`casa-${s.seed}-${k}`, cls, rank);
    s.heroes.push(h);
    return h;
  };
  build('casa vacia', 20, (s) => {
    s.heroes = [];
    s.gold = 300;
  });
  build('durmiendo', 18, (s) => {
    s.gold = 500;
  });
  build('guardia en la puerta', 14, (s) => {
    for (const h of s.heroes) h.guard = true;
  });
  build('guardia en la camara', 24, (s) => {
    const h = add(s, 'guerrero', 2, 1);
    h.guard = true;
    h.post = 'tesoro';
    s.heroes[0]!.guard = true;
    s.gold = 800;
  });
  build('perro y clases', 30, (s) => {
    s.custom = { ...s.custom!, dog: true };
    add(s, 'clerigo', 2, 1);
    add(s, 'mago', 2, 2);
    add(s, 'picaro', 2, 3);
    s.gold = 1200;
  });
  build('guardia con clerigo y mago', 22, (s) => {
    for (const h of s.heroes) h.guard = undefined;
    const a = add(s, 'clerigo', 2, 1);
    const b = add(s, 'mago', 2, 2);
    a.guard = true;
    b.guard = true;
    s.gold = 900;
  });
  build(
    'banda grande y trabajador',
    36,
    (s) => {
      add(s, 'explorador', 3, 1);
      add(s, 'guerrero', 3, 2);
      s.heroes[1]!.guard = true;
      s.gold = 2000;
    },
    (a) => {
      a.defenders.push({
        id: 'w-ref',
        power: 2 + 5 / 3,
        hp: WORKER_HP,
        every: 1.6,
        at: a.route[1] ?? a.route[0]!,
        worker: true,
        wake: Infinity,
      });
    },
  );
  return out;
}

function duelCases(): Omit<DuelCase, 'expect'>[] {
  const fac = newGame('ladron').fac;
  const classes: ClassId[] = ['guerrero', 'picaro', 'mago', 'clerigo', 'explorador'];
  const out: Omit<DuelCase, 'expect'>[] = [];
  classes.forEach((cls, i) => {
    for (const rep of [0, 120, 600]) {
      const h = hero(`ladron-${cls}-${rep}`, cls, Math.min(3, i));
      out.push({
        name: `${cls} con ${rep} de fama`,
        hero: h,
        fac,
        rep,
        seed: `ref-${i}-${rep}`,
        at: 100 + i,
      });
    }
  });
  return out;
}

// ---------- Jugarlas ----------

function playCombatCase(cc: Omit<CombatCase, 'expect'>): Combat {
  if (cc.mode === 'auto') {
    const c = new Combat(cc.setup, [], true);
    c.run();
    return c;
  }
  if (cc.mode === 'idle') {
    const c = new Combat(cc.setup, [], false);
    c.run();
    return c;
  }
  return playCombat(cc.setup, cc.player!);
}

function playAssaultCase(ac: Omit<AssaultCase, 'expect'>): Assault {
  const setup = loadSetup(ac.setup);
  if (!ac.player) {
    const a = new Assault(setup, new Rng(ac.rng));
    a.run();
    return a;
  }
  return playAssault(setup, ac.rng, ac.player);
}

async function record(): Promise<void> {
  const fx: Fixtures = {
    combats: combatCases().map((cc) => {
      const c = playCombatCase(cc);
      return { ...cc, expect: { ...combatSummary(c), orders: c.orders } };
    }),
    assaults: assaultCases().map((ac) => {
      const a = playAssaultCase(ac);
      return { ...ac, expect: { ...assaultSummary(a), orders: a.orders } };
    }),
    duels: duelCases().map((d) => ({ ...d, expect: duelOf(d) })),
  };
  (await fs()).writeFileSync(FILE, `${JSON.stringify(pack(fx), replacer)}\n`);
}

// ---------- Los tests ----------

const RECORD = !!process.env.GRABAR_PELEAS;
if (RECORD) await record();
const fx = unpack(JSON.parse((await fs()).readFileSync(FILE, 'utf8'), reviver) as Saved);

/** Lo mismo que se grabó, pasado por el JSON (sin `undefined`, con `Infinity`). */
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v, replacer), reviver) as T;

describe('peleas de referencia: jefes', () => {
  it('hay de todo: sin jugador, con jugador quieto y con cada tipo de orden', () => {
    expect(fx.combats.length).toBeGreaterThanOrEqual(60);
    const kinds = new Set(fx.combats.flatMap((c) => c.expect.orders.map((o) => o.kind)));
    expect([...kinds].sort()).toEqual(['cover', 'crit', 'skill', 'target']);
    expect(fx.combats.some((c) => c.expect.result!.won)).toBe(true);
    expect(fx.combats.some((c) => !c.expect.result!.won)).toBe(true);
  });

  it.each(fx.combats.map((c) => [c.name, c] as const))('%s', (_, cc) => {
    const { orders, ...want } = cc.expect;
    // Jugada en directo, sale igual y da las mismas órdenes.
    const live = playCombatCase(cc);
    expect(plain({ ...combatSummary(live), orders: live.orders })).toEqual(cc.expect);
    if (cc.mode === 'auto') expect(plain(runCombat(cc.setup))).toEqual(want.result);
    if (cc.mode !== 'player') return;
    // Repetida con las órdenes guardadas (como un informe), también.
    const again = new Combat(cc.setup, orders, false);
    again.run();
    expect(plain(combatSummary(again))).toEqual(want);
    expect(plain(runCombat(cc.setup, orders))).toEqual(want.result);
  });
});

describe('peleas de referencia: asaltos', () => {
  it('hay de todo: sin órdenes y con cada tipo de orden', () => {
    expect(fx.assaults.length).toBeGreaterThanOrEqual(30);
    const kinds = new Set(fx.assaults.flatMap((c) => c.expect.orders.map((o) => o.kind)));
    expect([...kinds].sort()).toEqual(['crit', 'move', 'skill', 'target']);
    expect(fx.assaults.some((c) => c.expect.result.escaped === 0)).toBe(true);
    expect(fx.assaults.some((c) => c.expect.result.stolen > 0)).toBe(true);
  });

  it.each(fx.assaults.map((c) => [c.name, c] as const))('%s', (_, ac) => {
    const { orders, ...want } = ac.expect;
    const live = playAssaultCase(ac);
    expect(plain({ ...assaultSummary(live), orders: live.orders })).toEqual(ac.expect);
    // Repetido con las órdenes guardadas, igual.
    const again = new Assault(loadSetup(ac.setup), new Rng(ac.rng), orders);
    again.run();
    expect(plain(assaultSummary(again))).toEqual(want);
    const r = simulate(loadSetup(ac.setup), new Rng(ac.rng), orders);
    expect(digest(r.plan.steps)).toEqual(want.steps);
  });
});

describe('peleas de referencia: el ladrón', () => {
  it('unas las gana y otras no', () => {
    expect(fx.duels.some((d) => d.expect?.won)).toBe(true);
    expect(fx.duels.some((d) => d.expect && !d.expect.won)).toBe(true);
  });

  it.each(fx.duels.map((d) => [d.name, d] as const))('%s', (_, d) => {
    expect(plain(duelOf(d))).toEqual(d.expect);
  });
});
