/**
 * El asalto sala a sala, como en un refugio: los bandidos llegan al patio, pelean con los de
 * guardia, rompen la puerta y van hacia la cámara del tesoro peleando con quien encuentren. Los
 * que duermen se despiertan y acuden corriendo; la puerta y la cerradura les dan tiempo. Si
 * abren la cámara, cada bandido carga lo que puede, y lo que llevan se recupera si caen antes de
 * perderse por el camino.
 *
 * Cada uno con su vida y sus golpes, con el motor común de las peleas (`core/fight.ts`):
 * habilidad por clase y críticos; aquí, cada uno tiene delante a los que están en su sala. Se decide aquí, paso a paso y con una semilla; con el juego
 * abierto se juega en directo (`Assault`, con órdenes del jugador) y, si no, solo. La escena
 * enseña la lista de pasos que sale (RaidPlan).
 */
import {
  BANDIT_CARRY,
  BANDIT_EVERY,
  BANDIT_HP,
  BANDIT_POWER,
  GUARD_BONUS,
  GUARD_HP,
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
  RAID_STEP,
  RAID_WAKE,
  RAID_WAKE_DOG,
  RAID_YARD,
  WORKER_HP,
  rankIndex,
} from './balance';
import {
  ABILITIES,
  Fight,
  alive,
  heroUnit,
  type AbilityId,
  type FightEvent,
  type FightOrder,
  type FightUnit,
  type OrderInput,
} from './fight';
import type { AssaultOutcome, Building, GameState, RaidPlan, RaidStep } from './model';
import { equip } from './resolve';
import { Rng } from './rng';
import { shafts, stairLinks } from './rooms';
import { doorTime, lockTime } from './vault';
import { staffBeds } from './workers';

/** El patio delante de la puerta y el camino por el que llegan (y se van) los bandidos. */
export const YARD = 'patio';
export const OUT = 'fuera';

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
  // Por cada escalera, las salas que dan a sus rellanos, si los tramos las unen.
  for (const x of shafts(b)) {
    const by = rooms.filter((r) => r.col === x || r.col + r.w === x);
    for (let i = 0; i < by.length; i++)
      for (let j = i + 1; j < by.length; j++) {
        const a = by[i]!;
        const c = by[j]!;
        if (a.floor === c.floor) continue;
        // Se entra por el suelo de cada sala (en las altas, la planta de abajo).
        if (!stairLinks(b, x, a.floor, c.floor)) continue;
        const climb = Math.abs(a.floor - c.floor);
        const walk = (Math.abs(mid(a) - x) + Math.abs(mid(c) - x)) * RAID_CELL;
        link(a.id, c.id, walk + climb * RAID_FLOOR);
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

/** Quien defiende la casa esta noche: dónde está, su vida y cómo pega. */
export interface Defender {
  id: string;
  /** Daño de cada golpe (antes de la defensa del otro). */
  power: number;
  /** Vida. */
  hp: number;
  /** Sala en la que está al empezar (los de guardia, en el recibidor). */
  at: string;
  guard?: boolean;
  /** De guardia en la cámara: despierto y sin moverse de ella (la última defensa). */
  vault?: boolean;
  /** Los trabajadores no corren a pelear: solo se defienden si llegan a su sala. */
  worker?: boolean;
  /** Segundo en que se despierta y sale corriendo. */
  wake: number;
  /** Defensa, segundos entre golpes, habilidad de su clase y si pega de lejos. */
  def?: number;
  every?: number;
  ability?: AbilityId;
  ranged?: boolean;
}

export interface Bandit {
  id: string;
  /** Daño de cada golpe y vida. */
  power: number;
  hp: number;
}

export interface AssaultSetup {
  graph: RaidGraph;
  route: string[];
  defenders: Defender[];
  bandits: Bandit[];
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

/** Lo que sale: quién cayó (los héroes, heridos), quién peleó, y el oro. */
export type AssaultResult = AssaultOutcome;

/** Cuántos bandidos trae una banda de esa fuerza. */
export const banditCount = (strength: number) => Math.max(2, Math.min(6, Math.round(strength / 6)));

/** Fuerza de una banda que viniera esta noche (la anunciada, si hay chivatazo). */
export function likelyStrength(s: GameState, notoriety: number): number {
  return s.raid?.strength ?? 8 + rankIndex(s.rep) * 5 + Math.floor(notoriety / 15);
}

/** La semilla del asalto de esta noche: la escena en directo y el núcleo arman el mismo. */
export const raidSeed = (s: GameState) => `asalto-${s.seed}-${s.day}`;

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
  const guards = new Set(home.filter((h) => h.guard && !h.post).slice(0, MAX_GUARDS));
  const vaultRoom = rooms.find((r) => r.type === 'tesoro')?.id;
  const keepers = new Set(
    vaultRoom ? home.filter((h) => h.guard && h.post === 'tesoro').slice(0, MAX_GUARDS) : [],
  );
  const sleepers = home.filter((h) => !guards.has(h) && !keepers.has(h));
  // Los de guardia dan la voz de alarma; si no, despierta el jaleo (o el perro, antes).
  const wake = guards.size ? RAID_ALARM : dog ? RAID_WAKE_DOG : RAID_WAKE;
  const defenders: Defender[] = home.map((h, i) => {
    const vault = keepers.has(h);
    const guard = guards.has(h);
    const armedUp = guard || vault;
    const k = sleepers.indexOf(h);
    const bed = beds[Math.floor((k * beds.length) / Math.max(1, sleepers.length))];
    // Las mismas cuentas que contra los jefes; los de guardia, vestidos y armados.
    const u = heroUnit({ ...armed[i]!, id: h.id, name: h.name });
    return {
      id: h.id,
      power: u.atk + (armedUp ? GUARD_BONUS : 0),
      hp: Math.round(u.max * (armedUp ? GUARD_HP : 1)),
      def: u.def,
      every: u.every,
      ability: u.ability,
      ranged: u.ranged,
      at: guard ? door : vault ? vaultRoom! : (bed?.id ?? salon),
      guard,
      ...(vault ? { vault } : {}),
      wake: armedUp ? 0 : wake + rng.next() * (wake < RAID_WAKE ? 1 : 2),
    };
  });
  // Los trabajadores con cama en el servicio duermen en casa; los del pueblo no están de noche.
  const inside = s.workers.slice(0, staffBeds(s.building));
  inside.forEach((w, k) => {
    const room = staffRooms[Math.floor((k * staffRooms.length) / Math.max(1, inside.length))];
    if (!room) return;
    defenders.push({
      id: w.id,
      power: 2 + w.skill / 3,
      hp: WORKER_HP,
      every: 1.6,
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

/** Uno en el asalto: dónde está, a dónde va y cómo va de vida (los de casa, `h`; bandidos, `e`). */
export interface Fighter extends FightUnit {
  node: string;
  /** En camino hacia una sala vecina (llega en el segundo `until`). */
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
  ranged: boolean;
  /** Sala a la que le ha mandado el jugador: va allí y se queda. */
  hold?: string;
  charge: number;
  readyFor: number;
  taunt: number;
  critOpen: boolean;
  critTaken: boolean;
}

/** Órdenes del jugador durante el asalto (las comunes menos cubrirse: no hay golpe fuerte). */
export type RaidOrder = Exclude<FightOrder, { kind: 'cover' }>;
export type RaidOrderInput = OrderInput<RaidOrder>;

/** Los del asalto al empezar: los de casa donde estén y los bandidos fuera. */
function fighters(setup: AssaultSetup): Fighter[] {
  const base = {
    to: null,
    until: 0,
    down: false,
    gone: false,
    gold: 0,
    fought: false,
    charge: 0,
    readyFor: 0,
    taunt: 0,
    critOpen: false,
    critTaken: false,
  };
  return [
    ...setup.defenders.map((d, i): Fighter => ({
      ...base,
      id: d.id,
      side: 'h',
      hp: d.hp,
      max: d.hp,
      atk: d.power,
      def: d.def ?? 1,
      every: d.every ?? 1.3,
      cool: (d.every ?? 1.3) * (0.4 + 0.1 * (i % 4)),
      node: d.at,
      wake: d.wake,
      // Los de la cámara están despiertos y no se mueven de allí (salvo que se les mande).
      awake: !!d.vault,
      ...(d.vault ? { hold: d.at } : {}),
      guard: !!d.guard,
      worker: !!d.worker,
      ranged: !!d.ranged,
      ability: d.ability,
      charge: d.ability ? ABILITIES[d.ability].every * 0.6 : 0,
    })),
    ...setup.bandits.map((b, i): Fighter => ({
      ...base,
      id: b.id,
      side: 'e',
      hp: b.hp,
      max: b.hp,
      atk: b.power,
      def: 1,
      every: BANDIT_EVERY,
      cool: BANDIT_EVERY * (0.5 + 0.15 * (i % 3)),
      node: OUT,
      wake: 0,
      awake: true,
      guard: false,
      worker: false,
      ranged: false,
    })),
  ];
}

/**
 * El asalto en marcha, paso a paso: se le pueden dar órdenes (mover a alguien, elegir a quién
 * pegan, la habilidad, el crítico) y va dejando los pasos para la escena. Sin órdenes, cada uno
 * hace lo suyo. Determinista con la semilla: con las mismas órdenes sale lo mismo.
 */
export class Assault extends Fight<Fighter, RaidOrder, AssaultResult> {
  readonly steps: RaidStep[] = [];
  private next: Map<string, Map<string, string>>;
  private dist: Map<string, Map<string, number>>;
  private start: Record<string, string> = {};
  private phase: 'in' | 'out' = 'in';
  private door: number;
  private doorOpen: boolean;
  private doorStarted = false;
  private lock: number;
  private lockStarted = false;
  private loadUntil = 0;
  private left: number;
  private stolen = 0;
  private recovered = 0;
  private fights = new Set<string>();
  private fell: string[] = [];

  constructor(
    private setup: AssaultSetup,
    seed: string | Rng,
    orders: readonly RaidOrder[] = [],
  ) {
    super(
      fighters(setup),
      typeof seed === 'string' ? new Rng(seed) : seed,
      orders,
      false,
      RAID_STEP,
    );
    ({ next: this.next, dist: this.dist } = hops(setup.graph));
    this.door = setup.door;
    this.doorOpen = !setup.route.length;
    this.lock = setup.lock;
    this.left = setup.gold;
    for (const u of this.units) this.start[u.id] = u.node;
    // Llegan por el camino; los de guardia salen al patio a recibirlos.
    const bands = this.bands();
    for (const b of bands) {
      b.to = YARD;
      b.until = setup.arrive;
    }
    this.steps.push({ t: 0, k: 'move', ids: bands.map((b) => b.id), to: YARD, dur: setup.arrive });
    const guards = this.defs().filter((d) => d.guard);
    if (guards.length && setup.route.length) this.move(guards, YARD);
  }

  /** Segundos de asalto. */
  get t(): number {
    return Math.round(this.step * RAID_STEP * 100) / 100;
  }

  defs(): Fighter[] {
    return this.units.filter((u) => u.side === 'h');
  }

  bands(): Fighter[] {
    return this.units.filter((u) => u.side === 'e');
  }

  /** Lo que se ve ahora (y la vida de cada uno): para la escena y el informe. */
  plan(): RaidPlan {
    const hp: Record<string, number> = {};
    for (const u of this.units) hp[u.id] = u.max;
    return { route: this.setup.route, start: this.start, steps: this.steps, end: this.t, hp };
  }

  tick(): void {
    if (this.result) return;
    this.playOrders();
    const t = this.t;
    if (t >= RAID_MAX_T) return this.finish();
    const defs = this.defs();
    const bands = this.bands();
    for (const u of this.units)
      if (u.to && t >= u.until - 1e-6) {
        u.node = u.to;
        u.to = null;
      }
    // Se pierden de vista con lo que llevan.
    for (const b of bands)
      if (alive(b) && !b.to && b.node === OUT && this.phase === 'out') {
        b.gone = true;
        this.stolen += b.gold;
        this.steps.push({ t, k: 'escape', id: b.id, gold: b.gold });
      }
    // Se despiertan con el jaleo (o al tenerlos delante).
    for (const d of defs) {
      if (d.awake || d.down) continue;
      if (t >= d.wake || bands.some((b) => this.here(b, d.node))) this.rouse(d);
    }
    this.brawl(t);
    if (!bands.some(alive)) return this.finish();
    this.advance(t);
    this.chase(t);
    this.step++;
  }

  // ---------- La pelea, por salas ----------

  /** Los enemigos que tiene delante (en su sala y sin ir de camino). */
  protected foesOf(u: Fighter): Fighter[] {
    if (u.to || !alive(u) || (u.side === 'h' && !u.awake)) return [];
    return this.units.filter((f) => f.side !== u.side && this.here(f, u.node));
  }

  protected alliesOf(u: Fighter): Fighter[] {
    return this.units.filter((f) => f.side === u.side && this.here(f, u.node));
  }

  /** Los de casa pegan al que tenga menos vida de los que tienen delante. */
  protected heroPick(_u: Fighter, foes: Fighter[]): Fighter {
    return foes.reduce((a, b) => (b.hp < a.hp ? b : a));
  }

  /** La empalizada ayuda a los de casa que pelean en el patio. */
  protected override boost(u: Fighter): number {
    return u.side === 'h' && u.node === YARD ? 1 + this.setup.yard : 1;
  }

  protected override downed(_from: Fighter, to: Fighter): void {
    to.down = true;
    if (to.side === 'h') {
      this.fell.push(to.id);
      this.steps.push({ t: this.t, k: 'fall', id: to.id });
    } else {
      this.recovered += to.gold;
      this.steps.push({ t: this.t, k: 'down', id: to.id, gold: to.gold });
    }
  }

  /** Lo que pasa en la pelea, como lo lee la escena del asalto (`RaidStep`). */
  protected emit(e: FightEvent): void {
    const t = this.t;
    if (e.kind === 'hit')
      this.steps.push({
        t,
        k: 'hit',
        from: e.from,
        id: e.to,
        amount: e.dealt,
        crit: e.crit || undefined,
      });
    else if (e.kind === 'skill') this.steps.push({ t, k: 'skill', id: e.from, skill: e.skill });
    else if (e.kind === 'heal')
      this.steps.push({ t, k: 'heal', from: e.from, id: e.to, amount: e.dealt });
    else if (e.kind === 'chance') this.steps.push({ t, k: 'chance', id: e.from });
  }

  protected override moveTo(u: Fighter, to: string): boolean {
    if (!this.setup.graph.has(to) || to === OUT) return false;
    // Mientras aguanta la puerta, de dentro no se sale al patio (salvo los de guardia).
    if (to === YARD && !this.doorOpen && !u.guard && u.node !== YARD) return false;
    u.hold = to;
    this.rouse(u);
    return true;
  }

  /** En cada sala con gente de los dos bandos: cada uno pega a su ritmo. */
  private brawl(t: number): void {
    const nodes = new Set(this.units.filter((u) => alive(u) && !u.to).map((u) => u.node));
    for (const node of nodes) {
      const ds = this.defs().filter((d) => this.here(d, node) && d.awake);
      const bs = this.bands().filter((b) => this.here(b, node));
      if (!ds.length || !bs.length) {
        this.fights.delete(node);
        continue;
      }
      if (!this.fights.has(node)) {
        this.fights.add(node);
        this.steps.push({ t, k: 'fight', at: node });
      }
      for (const u of [...ds, ...bs]) {
        if (!alive(u)) continue;
        if (u.side === 'h') u.fought = true;
        this.act(u);
      }
    }
  }

  // ---------- Por la casa ----------

  private here = (u: Fighter, node: string) => alive(u) && !u.to && u.node === node;

  private rouse(d: Fighter): void {
    if (d.awake) return;
    d.awake = true;
    if (!d.guard) this.steps.push({ t: this.t, k: 'wake', id: d.id });
  }

  private durOf(a: string, b: string): number {
    return this.setup.graph.get(a)?.find((e) => e.to === b)?.dur ?? 1;
  }

  private move(us: Fighter[], to: string): void {
    const t = this.t;
    const dur = to === OUT ? RAID_EXIT : this.durOf(us[0]!.node, to);
    for (const u of us) {
      u.to = to;
      u.until = t + dur;
      u.target = undefined;
    }
    this.steps.push({ t, k: 'move', ids: us.map((u) => u.id), to, dur });
  }

  /** Los bandidos van todos juntos; mientras alguien les planta cara, no avanzan. */
  private advance(t: number): void {
    const route = this.setup.route;
    const vault = route.at(-1);
    const pack = this.bands().filter(alive);
    const lead = pack[0]!;
    const busy = !!lead.to || this.defs().some((d) => this.here(d, lead.node) && d.awake);
    if (busy) return;
    const node = lead.node;
    if (this.phase === 'in') {
      if (node === YARD || node === OUT) {
        if (node === OUT) return;
        if (this.doorOpen) this.move(pack, route[0]!);
        else {
          if (!this.doorStarted) {
            this.doorStarted = true;
            this.steps.push({ t, k: 'door', dur: this.door });
          }
          this.door -= RAID_STEP;
          if (this.door <= 1e-6) {
            this.doorOpen = true;
            this.steps.push({ t, k: 'broke' });
          }
        }
      } else if (node !== vault) {
        const i = route.indexOf(node);
        this.move(pack, route[i + 1] ?? vault!);
      } else {
        if (!this.lockStarted) {
          this.lockStarted = true;
          this.steps.push({ t, k: 'lock', dur: this.lock });
        }
        this.lock -= RAID_STEP;
        if (this.lock <= 1e-6) {
          this.steps.push({ t, k: 'open' });
          for (const b of pack) {
            b.gold = Math.min(this.setup.carry, this.left);
            this.left -= b.gold;
            this.steps.push({ t, k: 'loot', id: b.id, gold: b.gold });
          }
          this.loadUntil = t + LOAD_TIME;
          this.phase = 'out';
        }
      }
    } else if (t >= this.loadUntil - 1e-6) {
      if (node === YARD) this.move(pack, OUT);
      else {
        const i = route.indexOf(node);
        this.move(pack, i > 0 ? route[i - 1]! : YARD);
      }
    }
  }

  /**
   * Los despiertos corren a cortarles el paso: a la primera sala de su camino a la que lleguen
   * antes que ellos (sin salir al patio mientras aguante la puerta). A los que manda el jugador,
   * a su sala, y allí se quedan.
   */
  private chase(t: number): void {
    const route = this.setup.route;
    const pack = this.bands().filter(alive);
    const lead = pack[0]!;
    const busy = !!lead.to || this.defs().some((d) => this.here(d, lead.node) && d.awake);
    const ahead: [string, number][] = [];
    {
      let at = lead.to ?? lead.node;
      let eta = lead.to ? lead.until - t : 0;
      ahead.push([at, eta]);
      const seq =
        this.phase === 'in'
          ? at === YARD || at === OUT
            ? route
            : route.slice(route.indexOf(at) + 1)
          : at === YARD || at === OUT
            ? []
            : [...route.slice(0, Math.max(0, route.indexOf(at))).reverse(), YARD];
      for (const n of seq) {
        eta += this.durOf(at, n);
        ahead.push([n, eta]);
        at = n;
      }
    }
    const yardHeld = this.defs().some((g) => g.guard && this.here(g, YARD));
    for (const d of this.defs()) {
      if (!alive(d) || !d.awake || d.to) continue;
      const open = (n: string) =>
        n !== OUT && (n !== YARD || this.doorOpen || d.guard || yardHeld || d.node === YARD);
      let goal: string | undefined;
      if (d.hold) goal = d.hold;
      else {
        if (d.worker) continue;
        if (this.bands().some((b) => this.here(b, d.node))) continue;
        const reach = ahead.filter(([n]) => open(n));
        // Si ya están peleando con alguien (o los de guardia esperan en el patio), a su lado.
        const brawl = yardHeld ? YARD : !lead.to && busy && open(lead.node) ? lead.node : undefined;
        goal =
          brawl ??
          reach.find(([n, eta]) => (this.dist.get(d.node)?.get(n) ?? Infinity) <= eta + 0.5)?.[0] ??
          reach.at(-1)?.[0];
      }
      if (!goal || d.node === goal) continue;
      const step = this.next.get(d.node)?.get(goal);
      if (step && open(step)) this.move([d], step);
    }
  }

  private finish(): void {
    const t = this.t;
    // Se acabó el tiempo: los que quedan se van con lo que lleven.
    for (const b of this.bands())
      if (alive(b)) {
        b.gone = true;
        this.stolen += b.gold;
        this.steps.push({ t, k: 'escape', id: b.id, gold: b.gold });
      }
    const bands = this.bands();
    this.result = {
      plan: this.plan(),
      fell: this.fell,
      fought: this.defs()
        .filter((d) => d.fought)
        .map((d) => d.id),
      downed: bands.filter((b) => b.down).length,
      escaped: bands.filter((b) => b.gone).length,
      stolen: this.stolen,
      recovered: this.recovered,
    };
  }
}

/** Juega el asalto entero: sin órdenes (se las apañan) o repitiendo las del jugador. */
export function simulate(
  setup: AssaultSetup,
  rng: Rng | string,
  orders: readonly RaidOrder[] = [],
): AssaultResult {
  return new Assault(setup, rng, orders).run();
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
