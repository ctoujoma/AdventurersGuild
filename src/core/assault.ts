/**
 * El asalto sala a sala, como en un refugio: los bandidos llegan al patio, pelean con los de
 * guardia, rompen la puerta y van hacia la cámara del tesoro peleando con quien encuentren. Los
 * que duermen se despiertan y acuden corriendo; la puerta y la cerradura les dan tiempo. Si
 * abren la cámara, cada bandido carga lo que puede, y lo que llevan se recupera si caen antes de
 * perderse por el camino.
 *
 * Todo se decide aquí, segundo a segundo y con la semilla de la partida; la escena solo enseña
 * la lista de pasos que sale (RaidPlan).
 */
import {
  BANDIT_CARRY,
  BANDIT_HP,
  BANDIT_POWER,
  FIGHT_RATE,
  GUARD_BONUS,
  GUARD_HP,
  HERO_HP,
  LOAD_TIME,
  MAX_GUARDS,
  PALISADE_FIGHT,
  RAID_ALARM,
  RAID_ARRIVE,
  RAID_CELL,
  RAID_EXIT,
  RAID_FLOOR,
  RAID_MAX_T,
  RAID_SPOT,
  RAID_WAKE,
  RAID_WAKE_DOG,
  RAID_YARD,
  WORKER_HP,
  rankIndex,
} from './balance';
import type { Building, GameState, RaidPlan, RaidStep } from './model';
import { skill } from './party';
import { equip } from './resolve';
import { Rng } from './rng';
import { doorTime, lockTime } from './vault';
import { staffBeds } from './workers';

/** El patio delante de la puerta y el camino por el que llegan (y se van) los bandidos. */
export const YARD = 'patio';
export const OUT = 'fuera';
/** Paso de la simulación, en segundos. */
const DT = 0.25;

interface Edge {
  to: string;
  dur: number;
}
/** Por dónde se anda: cada sala con sus vecinas y lo que se tarda en llegar a cada una. */
export type RaidGraph = Map<string, Edge[]>;

/**
 * Las salas como un plano de caminos: de una sala a la de al lado, por las escaleras (que unen
 * todas las salas que las tocan, en cualquier planta) y del recibidor al patio.
 */
export function raidGraph(b: Building): RaidGraph {
  const g: RaidGraph = new Map();
  const link = (a: string, c: string, dur: number) => {
    for (const [x, y] of [
      [a, c],
      [c, a],
    ] as const) {
      const list = g.get(x) ?? [];
      const old = list.find((e) => e.to === y);
      if (old) old.dur = Math.min(old.dur, dur);
      else list.push({ to: y, dur });
      g.set(x, list);
    }
  };
  // La torre no tiene suelo por el que andar: nadie entra ni pelea allí.
  const rooms = b.rooms.filter((r) => r.type !== 'torre');
  const mid = (r: { col: number; w: number }) => r.col + r.w / 2;
  for (const a of rooms) {
    g.set(a.id, g.get(a.id) ?? []);
    for (const c of rooms)
      if (a.floor === c.floor && a.col + a.w === c.col)
        link(a.id, c.id, (mid(c) - mid(a)) * RAID_CELL);
  }
  for (const x of b.stairs) {
    const by = rooms.filter((r) => r.col === x || r.col + r.w === x);
    for (let i = 0; i < by.length; i++)
      for (let j = i + 1; j < by.length; j++) {
        const a = by[i]!;
        const c = by[j]!;
        if (a.floor === c.floor) continue;
        const walk = (Math.abs(mid(a) - x) + Math.abs(mid(c) - x)) * RAID_CELL;
        link(a.id, c.id, walk + Math.abs(a.floor - c.floor) * RAID_FLOOR);
      }
  }
  const door = b.rooms.find((r) => r.type === 'recibidor');
  if (door) link(YARD, door.id, RAID_YARD);
  link(OUT, YARD, RAID_ARRIVE);
  return g;
}

/** Desde cada sitio, por dónde se va a cada otro (el primer paso) y cuánto se tarda. */
function hops(g: RaidGraph): {
  next: Map<string, Map<string, string>>;
  dist: Map<string, Map<string, number>>;
} {
  const next = new Map<string, Map<string, string>>();
  const dist = new Map<string, Map<string, number>>();
  for (const from of g.keys()) {
    const d = new Map<string, number>([[from, 0]]);
    const first = new Map<string, string>();
    const done = new Set<string>();
    for (;;) {
      let u: string | null = null;
      for (const [k, v] of d) if (!done.has(k) && (u === null || v < d.get(u)!)) u = k;
      if (u === null) break;
      done.add(u);
      for (const e of g.get(u) ?? []) {
        const nd = d.get(u)! + e.dur;
        if (nd < (d.get(e.to) ?? Infinity)) {
          d.set(e.to, nd);
          first.set(e.to, u === from ? e.to : first.get(u)!);
        }
      }
    }
    next.set(from, first);
    dist.set(from, d);
  }
  return { next, dist };
}

/** Camino de un sitio a otro, con los dos extremos (null si no se llega). */
export function pathIn(g: RaidGraph, from: string, to: string): string[] | null {
  const { next } = hops(g);
  const out = [from];
  let at = from;
  while (at !== to) {
    const n = next.get(at)?.get(to);
    if (!n || out.length > g.size + 1) return null;
    out.push(n);
    at = n;
  }
  return out;
}

/** Por dónde irían los bandidos: del recibidor a la cámara del tesoro (ids de sala). */
export function raidRoute(b: Building, g = raidGraph(b)): string[] {
  const vault = b.rooms.find((r) => r.type === 'tesoro');
  const door = b.rooms.find((r) => r.type === 'recibidor');
  const path = vault ? pathIn(g, YARD, vault.id) : null;
  return path ? path.slice(1) : door ? [door.id] : [];
}

/** Segundos que tardarían los bandidos en andar de la puerta a la cámara (sin pelear). */
export function routeTime(b: Building, g = raidGraph(b)): number {
  const route = raidRoute(b, g);
  let t = 0;
  for (let i = 1; i < route.length; i++)
    t += g.get(route[i - 1]!)?.find((e) => e.to === route[i])?.dur ?? 0;
  return Math.round(t);
}

/** Quien defiende la casa esta noche: dónde está, cuánto pega y cuánto aguanta. */
export interface Defender {
  id: string;
  power: number;
  hp: number;
  /** Sala en la que está al empezar (los de guardia, en el recibidor). */
  at: string;
  guard?: boolean;
  /** Los trabajadores no corren a pelear: solo se defienden si llegan a su sala. */
  worker?: boolean;
  /** Segundo en que se despierta y sale corriendo. */
  wake: number;
}

export interface AssaultSetup {
  graph: RaidGraph;
  route: string[];
  defenders: Defender[];
  bandits: { id: string; power: number; hp: number }[];
  /** Oro que carga cada bandido y el que hay en la cámara. */
  carry: number;
  gold: number;
  door: number;
  lock: number;
  /** Lo que tardan en llegar al patio (los de guardia los ven venir de lejos). */
  arrive: number;
  /** Lo que suma la empalizada a quien pelea en el patio (parte de su fuerza). */
  yard: number;
}

export interface AssaultResult {
  plan: RaidPlan;
  /** Defensores que cayeron (los héroes, heridos). */
  fell: string[];
  /** Defensores que llegaron a pelear. */
  fought: string[];
  downed: number;
  escaped: number;
  stolen: number;
  recovered: number;
}

/** Cuántos bandidos trae una banda de esa fuerza. */
export const banditCount = (strength: number) => Math.max(2, Math.min(6, Math.round(strength / 6)));

/** Fuerza de una banda que viniera esta noche (la anunciada, si hay chivatazo). */
export function likelyStrength(s: GameState, notoriety: number): number {
  return s.raid?.strength ?? 8 + rankIndex(s.rep) * 5 + Math.floor(notoriety / 15);
}

/** Prepara el asalto con lo que hay en casa esta noche. */
export function assaultSetup(s: GameState, strength: number, rng: Rng): AssaultSetup {
  const graph = raidGraph(s.building);
  const route = raidRoute(s.building, graph);
  const rooms = s.building.rooms;
  const door = rooms.find((r) => r.type === 'recibidor')?.id ?? YARD;
  const byFloor = (a: { floor: number; col: number }, b: { floor: number; col: number }) =>
    b.floor - a.floor || a.col - b.col;
  const beds = rooms.filter((r) => r.type === 'dormitorio' || r.type === 'veteranos').sort(byFloor);
  const staffRooms = rooms.filter((r) => r.type === 'servicio').sort(byFloor);
  const salon = rooms.find((r) => r.type === 'salon')?.id ?? door;
  const dog = !!s.custom?.dog;

  const home = s.heroes.filter((h) => h.status === 'ok');
  const armed = equip(home, s.fac);
  const guards = new Set(home.filter((h) => h.guard).slice(0, MAX_GUARDS));
  const sleepers = home.filter((h) => !guards.has(h));
  // Los de guardia dan la voz de alarma; si no, despierta el jaleo (o el perro, antes).
  const wake = guards.size ? RAID_ALARM : dog ? RAID_WAKE_DOG : RAID_WAKE;
  const defenders: Defender[] = home.map((h, i) => {
    const guard = guards.has(h);
    const k = sleepers.indexOf(h);
    const bed = beds[Math.floor((k * beds.length) / Math.max(1, sleepers.length))];
    return {
      id: h.id,
      power: skill(armed[i]!, 'Combate', true) + (guard ? GUARD_BONUS : 0),
      hp: guard ? GUARD_HP : HERO_HP,
      at: guard ? door : (bed?.id ?? salon),
      guard,
      wake: guard ? 0 : wake + rng.next() * (wake < RAID_WAKE ? 1 : 2),
    };
  });
  // Los trabajadores con cama en el servicio duermen en casa; los del pueblo no están de noche.
  const inside = s.workers.slice(0, staffBeds(s.building));
  inside.forEach((w, k) => {
    const room = staffRooms[Math.floor((k * staffRooms.length) / Math.max(1, inside.length))];
    if (!room) return;
    defenders.push({
      id: w.id,
      power: 1 + w.skill / 3,
      hp: WORKER_HP,
      at: room.id,
      worker: true,
      wake: Infinity,
    });
  });
  const n = banditCount(strength);
  const bandits = Array.from({ length: n }, (_, i) => ({
    id: `b${i}`,
    power: (strength / n) * BANDIT_POWER,
    hp: BANDIT_HP,
  }));
  return {
    graph,
    route,
    defenders,
    bandits,
    carry: BANDIT_CARRY + strength,
    gold: s.gold,
    door: doorTime(s),
    lock: lockTime(s),
    arrive: RAID_ARRIVE + (guards.size ? RAID_SPOT : 0),
    yard: PALISADE_FIGHT * s.fac.empal,
  };
}

interface Unit {
  id: string;
  side: 'd' | 'b';
  power: number;
  hp: number;
  node: string;
  /** En camino hacia una sala vecina (llega en `until`). */
  to: string | null;
  until: number;
  down: boolean;
  /** Bandido que ya se ha perdido por el camino. */
  gone: boolean;
  gold: number;
  wake: number;
  awake: boolean;
  guard: boolean;
  worker: boolean;
  fought: boolean;
}

/** Juega el asalto entero y devuelve lo que pasó, paso a paso. */
export function simulate(setup: AssaultSetup, rng: Rng): AssaultResult {
  const { graph: g, route } = setup;
  const { next, dist } = hops(g);
  const durOf = (a: string, b: string) => g.get(a)?.find((e) => e.to === b)?.dur ?? 1;
  const steps: RaidStep[] = [];
  const units: Unit[] = [
    ...setup.defenders.map((d): Unit => ({
      id: d.id,
      side: 'd',
      power: d.power,
      hp: d.hp,
      node: d.at,
      to: null,
      until: 0,
      down: false,
      gone: false,
      gold: 0,
      wake: d.wake,
      awake: false,
      guard: !!d.guard,
      worker: !!d.worker,
      fought: false,
    })),
    ...setup.bandits.map((b): Unit => ({
      id: b.id,
      side: 'b',
      power: b.power,
      hp: b.hp,
      node: OUT,
      to: null,
      until: 0,
      down: false,
      gone: false,
      gold: 0,
      wake: 0,
      awake: true,
      guard: false,
      worker: false,
      fought: false,
    })),
  ];
  const start: Record<string, string> = {};
  for (const u of units) start[u.id] = u.node;
  const defs = units.filter((u) => u.side === 'd');
  const bands = units.filter((u) => u.side === 'b');
  const standing = (u: Unit) => !u.down && !u.gone;
  const here = (u: Unit, node: string) => standing(u) && !u.to && u.node === node;
  const move = (us: Unit[], to: string, t: number) => {
    const dur = to === OUT ? RAID_EXIT : durOf(us[0]!.node, to);
    for (const u of us) {
      u.to = to;
      u.until = t + dur;
    }
    steps.push({ t, k: 'move', ids: us.map((u) => u.id), to, dur });
  };

  let phase: 'in' | 'out' = 'in';
  let door = setup.door;
  let doorOpen = !route.length;
  let doorStarted = false;
  let lock = setup.lock;
  let lockStarted = false;
  let loadUntil = 0;
  let left = setup.gold;
  let stolen = 0;
  let recovered = 0;
  const fights = new Set<string>();
  const fell: string[] = [];
  const vault = route.at(-1);

  // Llegan por el camino; los de guardia salen al patio a recibirlos.
  for (const b of bands) {
    b.to = YARD;
    b.until = setup.arrive;
  }
  steps.push({ t: 0, k: 'move', ids: bands.map((b) => b.id), to: YARD, dur: setup.arrive });
  const guards = defs.filter((d) => d.guard);
  if (guards.length && route.length) move(guards, YARD, 0);

  let t = 0;
  for (; t < RAID_MAX_T; t = Math.round((t + DT) * 100) / 100) {
    for (const u of units)
      if (u.to && t >= u.until - 1e-6) {
        u.node = u.to;
        u.to = null;
      }
    // Se pierden de vista con lo que llevan.
    for (const b of bands)
      if (standing(b) && !b.to && b.node === OUT && phase === 'out') {
        b.gone = true;
        stolen += b.gold;
        steps.push({ t, k: 'escape', id: b.id, gold: b.gold });
      }
    // Se despiertan con el jaleo (o al tenerlos delante).
    for (const d of defs) {
      if (d.awake || d.down) continue;
      if (t >= d.wake || bands.some((b) => here(b, d.node))) {
        d.awake = true;
        if (!d.guard) steps.push({ t, k: 'wake', id: d.id });
      }
    }
    // Peleas: en cada sitio donde hay de los dos bandos, todos pegan a la vez.
    const nodes = new Set(units.filter((u) => standing(u) && !u.to).map((u) => u.node));
    const hits: [Unit, number][] = [];
    for (const node of nodes) {
      const ds = defs.filter((d) => here(d, node) && d.awake);
      const bs = bands.filter((b) => here(b, node));
      if (!ds.length || !bs.length) {
        fights.delete(node);
        continue;
      }
      if (!fights.has(node)) {
        fights.add(node);
        steps.push({ t, k: 'fight', at: node });
      }
      const boost = node === YARD ? 1 + setup.yard : 1;
      for (const d of ds) {
        d.fought = true;
        hits.push([bs[rng.int(0, bs.length - 1)]!, d.power * boost]);
      }
      for (const b of bs) hits.push([ds[rng.int(0, ds.length - 1)]!, b.power]);
    }
    for (const [u, power] of hits) u.hp -= power * FIGHT_RATE * DT * (0.6 + 0.8 * rng.next());
    for (const u of units) {
      if (u.down || u.gone || u.hp > 0) continue;
      u.down = true;
      if (u.side === 'd') {
        fell.push(u.id);
        steps.push({ t, k: 'fall', id: u.id });
      } else {
        recovered += u.gold;
        steps.push({ t, k: 'down', id: u.id, gold: u.gold });
      }
    }
    const pack = bands.filter(standing);
    if (!pack.length) break;

    // Los bandidos van todos juntos; mientras alguien les planta cara, no avanzan.
    const lead = pack[0]!;
    const busy = !!lead.to || defs.some((d) => here(d, lead.node) && d.awake);
    if (!busy) {
      const node = lead.node;
      if (phase === 'in') {
        if (node === YARD) {
          if (doorOpen) move(pack, route[0]!, t);
          else {
            if (!doorStarted) {
              doorStarted = true;
              steps.push({ t, k: 'door', dur: door });
            }
            door -= DT;
            if (door <= 1e-6) {
              doorOpen = true;
              steps.push({ t, k: 'broke' });
            }
          }
        } else if (node !== vault) {
          const i = route.indexOf(node);
          move(pack, route[i + 1] ?? vault!, t);
        } else {
          if (!lockStarted) {
            lockStarted = true;
            steps.push({ t, k: 'lock', dur: lock });
          }
          lock -= DT;
          if (lock <= 1e-6) {
            steps.push({ t, k: 'open' });
            for (const b of pack) {
              b.gold = Math.min(setup.carry, left);
              left -= b.gold;
              steps.push({ t, k: 'loot', id: b.id, gold: b.gold });
            }
            loadUntil = t + LOAD_TIME;
            phase = 'out';
          }
        }
      } else if (t >= loadUntil - 1e-6) {
        if (node === YARD) move(pack, OUT, t);
        else {
          const i = route.indexOf(node);
          move(pack, i > 0 ? route[i - 1]! : YARD, t);
        }
      }
    }

    // Los despiertos corren a cortarles el paso: a la primera sala de su camino a la que lleguen
    // antes que ellos (sin salir al patio mientras aguante la puerta).
    const ahead: [string, number][] = [];
    {
      let at = lead.to ?? lead.node;
      let eta = lead.to ? lead.until - t : 0;
      ahead.push([at, eta]);
      const seq =
        phase === 'in'
          ? at === YARD || at === OUT
            ? route
            : route.slice(route.indexOf(at) + 1)
          : at === YARD || at === OUT
            ? []
            : [...route.slice(0, Math.max(0, route.indexOf(at))).reverse(), YARD];
      for (const n of seq) {
        eta += durOf(at, n);
        ahead.push([n, eta]);
        at = n;
      }
    }
    for (const d of defs) {
      if (!standing(d) || !d.awake || d.worker || d.to) continue;
      if (bands.some((b) => here(b, d.node))) continue;
      // Mientras los de guardia aguantan en el patio, la puerta está abierta para ir a ayudarles.
      const yardHeld = defs.some((g) => g.guard && here(g, YARD));
      const open = (n: string) => n !== OUT && (n !== YARD || doorOpen || d.guard || yardHeld);
      const reach = ahead.filter(([n]) => open(n));
      // Si ya están peleando con alguien (o los de guardia esperan en el patio), a su lado.
      const brawl = yardHeld ? YARD : !lead.to && busy && open(lead.node) ? lead.node : undefined;
      const goal =
        brawl ??
        reach.find(([n, eta]) => (dist.get(d.node)?.get(n) ?? Infinity) <= eta + 0.5)?.[0] ??
        reach.at(-1)?.[0];
      if (!goal || d.node === goal) continue;
      const step = next.get(d.node)?.get(goal);
      if (step && open(step)) move([d], step, t);
    }
  }
  // Se acabó el tiempo: los que quedan se van con lo que lleven.
  for (const b of bands)
    if (standing(b)) {
      b.gone = true;
      stolen += b.gold;
      steps.push({ t, k: 'escape', id: b.id, gold: b.gold });
    }
  return {
    plan: { route, start, steps, end: t },
    fell,
    fought: defs.filter((d) => d.fought).map((d) => d.id),
    downed: bands.filter((b) => b.down).length,
    escaped: bands.filter((b) => b.gone).length,
    stolen,
    recovered,
  };
}

/**
 * De cada diez asaltos como el que podría venir esta noche, cuántos se pararían sin que nadie
 * se lleve nada. Sirve para planear la defensa (no cambia la partida).
 */
export function holdOdds(s: GameState, strength: number, tries = 10): number {
  let held = 0;
  for (let i = 0; i < tries; i++) {
    const rng = new Rng(`aguante-${s.day}-${i}`);
    const r = simulate(assaultSetup(s, strength, rng), rng);
    if (!r.escaped) held++;
  }
  return held / tries;
}
