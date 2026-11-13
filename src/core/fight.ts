/**
 * El motor común de las peleas: jefes (`combat.ts`), asaltos (`assault.ts`) y el ladrón
 * (`incidents.ts`) pelean igual. Cada uno a su ritmo: golpe con enfriamiento, daño contra la
 * defensa, críticos con ocasión (que el jugador coge a tiempo o, sin él, la IA a veces),
 * habilidad por clase con su recarga y, el jefe, su golpe fuerte con aviso y «¡Cubríos!».
 *
 * Determinista: avanza a pasos fijos con una semilla, y las órdenes llevan el paso en que se
 * dieron. Cada pelea pone el sitio (quién tiene delante a quién: todos en la arena del jefe, por
 * salas en el asalto), lo que pasa alrededor (andar, la puerta, la cámara…) y su registro para
 * la escena (`emit` traduce los sucesos comunes a `CombatEvent`, `RaidStep` o `DuelHit`).
 *
 * Ojo: los informes viejos guardan la pelea de un jefe (montaje y órdenes) para repetirla, así
 * que el orden de las tiradas no se puede cambiar sin que se vean distintas. Las peleas de
 * referencia (`peleas.test.ts`) lo comprueban.
 */
import type { ClassId } from './party';
import { attr, skill, type Member } from './party';
import { Rng } from './rng';

/** Paso fijo de la simulación (s). */
export const STEP = 0.1;
/** Una habilidad lista que el jugador no usa se lanza sola al cabo de esto (s). */
export const AUTO_SKILL = 5;
/** Probabilidad de crítico de los enemigos y cuánto multiplica. */
export const CRIT = 0.1;
export const CRIT_MULT = 1.8;
/**
 * Críticos de los héroes, con gesto: tras un golpe, a veces queda abierta la ocasión de un
 * crítico en el siguiente; si el jugador lo toca a tiempo (orden `crit`), entra. Sin jugador,
 * la IA acierta esta parte de las veces (en total, como el 10 % de antes).
 */
export const CRIT_OPEN = 0.2;
export const AI_CRIT = 0.5;
/** Cuánto antes avisa el jefe de su golpe fuerte (s), y lo que hace si se cubren. */
export const WARN = 2.2;
export const COVERED = 0.3;
/** Sin jugador, la IA se cubre a tiempo esta parte de las veces. */
export const AI_COVER = 0.4;

export type AbilityId = 'provocar' | 'punalada' | 'bola' | 'curar' | 'andanada';

export const ABILITIES: Record<
  AbilityId,
  { name: string; every: number; text: string; cls: ClassId }
> = {
  provocar: {
    cls: 'guerrero',
    name: 'Provocar',
    every: 12,
    text: 'Atrae los golpes hacia sí unos segundos y aguanta más.',
  },
  punalada: {
    cls: 'picaro',
    name: 'Puñalada',
    every: 10,
    text: 'Un golpe por la espalda: el triple de daño.',
  },
  bola: {
    cls: 'mago',
    name: 'Bola de fuego',
    every: 14,
    text: 'Quema a todos los enemigos a la vez.',
  },
  curar: { cls: 'clerigo', name: 'Curar', every: 12, text: 'Cura al que esté peor del grupo.' },
  andanada: {
    cls: 'explorador',
    name: 'Andanada',
    every: 10,
    text: 'Dos flechas seguidas al mismo blanco.',
  },
};

const ABILITY_OF: Record<ClassId, AbilityId> = {
  guerrero: 'provocar',
  picaro: 'punalada',
  mago: 'bola',
  clerigo: 'curar',
  explorador: 'andanada',
};

/** Los de casa (héroes y trabajadores) y los de fuera (jefes, esbirros, bandidos, el ladrón). */
export type Side = 'h' | 'e';

/** Uno en cualquier pelea: su vida, cómo pega y lo que lleva de habilidad y críticos. */
export interface FightUnit {
  id: string;
  side: Side;
  hp: number;
  max: number;
  atk: number;
  def: number;
  /** Segundos entre golpes, y lo que falta para el siguiente. */
  every: number;
  cool: number;
  /** A quién pega (id). */
  target?: string;
  /** Habilidad (los héroes): lo que falta para tenerla y desde cuándo está lista. */
  ability?: AbilityId;
  charge?: number;
  readyFor?: number;
  /** Provocando: le pegan a él (s que quedan). */
  taunt?: number;
  /** Ocasión de crítico abierta para su próximo golpe, y si el jugador la ha cogido. */
  critOpen?: boolean;
  critTaken?: boolean;
  /** Golpe fuerte (el jefe): lo que falta. */
  special?: number;
  /** De lejos (no se pone delante). */
  ranged?: boolean;
  /** Trabajador: se defiende, pero sin críticos. */
  worker?: boolean;
  /** Se ha ido (el bandido que se pierde por el camino): ya no pelea. */
  gone?: boolean;
}

/** Un héroe, un jefe o un esbirro, con nombre (las peleas de jefe se guardan así). */
export interface Unit extends FightUnit {
  name: string;
  /** Clase del héroe, o el jefe y sus esbirros. */
  kind: ClassId | 'jefe' | 'esbirro';
}

export const alive = (u: FightUnit) => u.hp > 0 && !u.gone;

/** Lo que pesa un héroe en la pelea: de sus atributos, su nivel y su clase. */
export function heroUnit(h: Member & { id: string; name: string }): Unit {
  const ranged = h.cls === 'mago' || h.cls === 'explorador';
  const power =
    h.cls === 'mago' || h.cls === 'clerigo'
      ? Math.max(skill(h, 'Arcano', true), skill(h, 'Combate', true))
      : skill(h, 'Combate', true);
  const extraHp = h.cls === 'guerrero' ? 16 : h.cls === 'clerigo' ? 6 : 0;
  const every = { guerrero: 1.3, picaro: 1.0, mago: 1.6, clerigo: 1.5, explorador: 1.1 }[h.cls];
  const ability = ABILITY_OF[h.cls];
  return {
    id: h.id,
    side: 'h',
    name: h.name,
    kind: h.cls,
    max: 30 + 5 * attr(h, 'F', true) + 4 * (h.lvl - 1) + extraHp,
    hp: 0,
    atk: 2 + power * 0.8,
    def: h.cls === 'guerrero' ? 3 : h.cls === 'clerigo' ? 2 : 1,
    every,
    cool: every * 0.5,
    ability,
    charge: ABILITIES[ability].every * 0.6,
    ranged,
  };
}

/** Órdenes del jugador, con el paso en que se dieron (para repetir la pelea igual). */
export type FightOrder = { step: number; who: string } & (
  | { kind: 'target'; to: string }
  | { kind: 'skill' }
  /** ¡Cubríos! (cualquier héroe): el golpe fuerte del jefe que viene hace mucho menos. */
  | { kind: 'cover' }
  /** Coger la ocasión de crítico de un héroe (tocarlo a tiempo). */
  | { kind: 'crit' }
  /** Ir a una sala y quedarse allí (solo donde hay salas: el asalto). */
  | { kind: 'move'; to: string }
);

/** Una orden tal como la da el jugador (el paso lo pone la pelea). */
export type OrderInput<O extends FightOrder> = O extends FightOrder ? Omit<O, 'step'> : never;

/** Lo que pasa en una pelea, igual en todas; cada una lo apunta a su manera para su escena. */
export type FightEvent =
  /** Un golpe: lo que quita (`amount`) y lo que había de vida para quitar (`dealt`). */
  | { kind: 'hit'; from: string; to: string; amount: number; dealt: number; crit: boolean }
  | { kind: 'down'; from: string; to: string }
  | { kind: 'skill'; from: string; skill: AbilityId }
  /** Una cura: lo que cura (`amount`) y lo que le faltaba para estar entero (`dealt`). */
  | { kind: 'heal'; from: string; to: string; amount: number; dealt: number }
  /** Se abre la ocasión de crítico de un héroe (hasta su siguiente golpe). */
  | { kind: 'chance'; from: string }
  /** El jefe avisa de su golpe fuerte (`WARN` s antes), se cubren y lo descarga. */
  | { kind: 'warn'; from: string }
  | { kind: 'cover'; from: string }
  | { kind: 'special'; from: string; covered: boolean };

/**
 * Una pelea en marcha: se avanza paso a paso (`tick`, que pone cada pelea) y se le pueden dar
 * órdenes. Aquí está lo que es igual en todas: las órdenes, el golpe, la habilidad, el crítico
 * y el golpe fuerte; cada pelea dice quién tiene delante a quién y cómo lo apunta.
 */
export abstract class Fight<U extends FightUnit, O extends FightOrder, R> {
  step = 0;
  /** Órdenes dadas (para volver a jugarla igual). */
  readonly orders: O[] = [];
  result: R | null = null;
  protected readonly rng: Rng;
  private pending: O[];
  /** Héroes a los que el jugador ya maneja la habilidad. */
  private manual = new Set<string>();
  /** Se han cubierto para el golpe fuerte que viene, y si la IA se cubrirá (decidido al avisar). */
  private covered = false;
  private aiCover = false;

  /**
   * `orders`: las de una pelea ya jugada (se aplican en su paso). `auto`: las habilidades se
   * usan en cuanto están listas (sin jugador); si no, las que maneja el jugador se lanzan solas
   * al cabo de `AUTO_SKILL`.
   */
  constructor(
    readonly units: U[],
    rng: Rng,
    orders: readonly O[],
    private auto: boolean,
    private dt = STEP,
  ) {
    this.rng = rng;
    this.pending = [...orders].sort((a, b) => a.step - b.step);
  }

  abstract tick(): void;

  unit(id: string): U | undefined {
    return this.units.find((u) => u.id === id);
  }

  /** Orden del jugador para el paso de ahora (se guarda para repetirla). */
  order(o: OrderInput<O>): boolean {
    if (this.result) return false;
    const full = { ...o, step: this.step } as O;
    if (!this.apply(full)) return false;
    this.orders.push(full);
    return true;
  }

  /** Juega hasta el final (sin jugador, o repitiendo órdenes). */
  run(): R {
    while (!this.result) this.tick();
    return this.result!;
  }

  // ---------- Lo que pone cada pelea ----------

  /** Los enemigos que tiene delante (en pie). */
  protected abstract foesOf(u: U): U[];
  /** Los suyos que tiene al lado (en pie): a quién puede curar. */
  protected abstract alliesOf(u: U): U[];
  /** A quién pega un héroe que no tiene blanco (los de fuera, a uno cualquiera). */
  protected abstract heroPick(u: U, foes: U[]): U;
  /** Apunta lo que pasa en su registro. */
  protected abstract emit(e: FightEvent): void;

  /** Cuánto multiplica su golpe por donde pelea (la empalizada en el patio). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected boost(_u: U): number {
    return 1;
  }

  /** Si su golpe entra crítico: los héroes, con la ocasión; los demás, a veces. */
  protected crit(u: U): boolean {
    return u.side === 'h' ? this.heroCrit(u) : this.rng.chance(CRIT);
  }

  /** Si tras su golpe se le puede abrir la ocasión de crítico. */
  protected chances(u: U): boolean {
    return u.side === 'h' && !u.worker;
  }

  /** Cae: se apunta (y cada pelea hace lo suyo). */
  protected downed(from: U, to: U): void {
    this.emit({ kind: 'down', from: from.id, to: to.id });
  }

  /** Orden de ir a una sala: solo donde hay salas. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected moveTo(_u: U, _to: string): boolean {
    return false;
  }

  // ---------- Lo común ----------

  /** Las órdenes de una pelea ya jugada, en su paso (y cuentan como dadas, igual que en directo). */
  protected playOrders(): void {
    while (this.pending.length && this.pending[0]!.step <= this.step) {
      const o = this.pending.shift()!;
      if (this.apply(o)) this.orders.push(o);
    }
  }

  protected apply(o: O): boolean {
    const u = this.unit(o.who);
    if (!u || u.side !== 'h' || !alive(u)) return false;
    switch (o.kind) {
      case 'move':
        return this.moveTo(u, o.to);
      case 'target': {
        const to = this.unit(o.to);
        if (!to || to.side !== 'e' || !alive(to)) return false;
        u.target = to.id;
        return true;
      }
      case 'crit':
        if (!u.critOpen || u.critTaken) return false;
        u.critTaken = true;
        return true;
      case 'cover': {
        // Solo sirve con el aviso dado: antes de tiempo no se aguanta la guardia.
        const boss = this.units.find((f) => f.side === 'e' && f.special !== undefined && alive(f));
        if (!boss || boss.special! > WARN || this.covered) return false;
        this.covered = true;
        this.emit({ kind: 'cover', from: u.id });
        return true;
      }
      case 'skill':
        if (!u.ability || (u.charge ?? 0) > 0 || !this.foesOf(u).length) return false;
        this.manual.add(u.id);
        this.useSkill(u);
        return true;
    }
  }

  /** Lo que hace uno en pie en un paso: habilidad, golpe fuerte y su golpe, cada cosa a su ritmo. */
  protected act(u: U): void {
    const dt = this.dt;
    if (u.taunt) u.taunt = Math.max(0, u.taunt - dt);
    if (u.ability !== undefined) {
      if ((u.charge ?? 0) > 0) u.charge = Math.max(0, u.charge! - dt);
      else {
        u.readyFor = (u.readyFor ?? 0) + dt;
        if (this.wantsSkill(u)) this.useSkill(u);
      }
    }
    if (u.special !== undefined) this.special(u);
    u.cool -= dt;
    if (u.cool > 0) return;
    u.cool += u.every;
    const to = this.targetOf(u);
    if (!to) return;
    const crit = this.crit(u);
    const raw = u.atk * this.boost(u) * (0.85 + this.rng.next() * 0.3) * (crit ? CRIT_MULT : 1);
    this.hit(u, to, raw, crit);
    // Tras su golpe, a veces queda la ocasión de un crítico en el siguiente.
    if (this.chances(u) && alive(u) && this.rng.chance(CRIT_OPEN)) {
      u.critOpen = true;
      this.emit({ kind: 'chance', from: u.id });
    }
  }

  /** El golpe fuerte del jefe a todos: avisa antes y, si se cubren a tiempo, hace menos. */
  private special(u: U): void {
    const before = u.special!;
    u.special = before - this.dt;
    if (before > WARN && u.special <= WARN) {
      this.emit({ kind: 'warn', from: u.id });
      this.covered = false;
      this.aiCover = this.rng.chance(AI_COVER);
    }
    if (u.special > 0) return;
    u.special = 9;
    // Sin que el jugador diga nada, la IA se cubre a veces.
    const covered = this.covered || (!this.orders.some((o) => o.kind === 'cover') && this.aiCover);
    this.emit({ kind: 'special', from: u.id, covered });
    for (const h of this.foesOf(u)) this.hit(u, h, u.atk * 1.1 * (covered ? COVERED : 1), false);
    this.covered = false;
  }

  /** Si el golpe de un héroe entra crítico: la ocasión cogida (o, sin jugador, la IA a veces). */
  protected heroCrit(u: U): boolean {
    if (!u.critOpen) return false;
    const taken = u.critTaken;
    u.critOpen = false;
    u.critTaken = false;
    if (taken) return true;
    // Si el jugador nunca toca los críticos, los coge la IA como si no hubiera jugador.
    const playing = this.orders.some((o) => o.kind === 'crit');
    return !playing && this.rng.chance(AI_CRIT);
  }

  private wantsSkill(u: U): boolean {
    // Si el jugador ya la maneja, espera su orden (y si se le olvida, sale sola al rato).
    if (!this.auto && this.manual.has(u.id)) return (u.readyFor ?? 0) >= AUTO_SKILL;
    // Sin jugador: curar solo si hace falta; lo demás, en cuanto se puede.
    if (u.ability === 'curar') return this.alliesOf(u).some((h) => h.hp < h.max * 0.6);
    return true;
  }

  private useSkill(u: U): void {
    const id = u.ability!;
    u.charge = ABILITIES[id].every;
    u.readyFor = 0;
    this.emit({ kind: 'skill', from: u.id, skill: id });
    const to = this.targetOf(u);
    if (id === 'provocar') u.taunt = 6;
    else if (id === 'punalada' && to) this.hit(u, to, u.atk * 3, false);
    else if (id === 'andanada' && to) {
      this.hit(u, to, u.atk * 1.1, false);
      if (alive(to)) this.hit(u, to, u.atk * 1.1, false);
    } else if (id === 'bola') for (const f of this.foesOf(u)) this.hit(u, f, u.atk * 1.4, false);
    else if (id === 'curar') {
      const low = this.alliesOf(u).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
      if (low) {
        const amount = Math.round(low.max * 0.35);
        const dealt = Math.min(low.max - low.hp, amount);
        low.hp = Math.min(low.max, low.hp + amount);
        this.emit({ kind: 'heal', from: u.id, to: low.id, amount, dealt });
      }
    }
  }

  protected hit(from: U, to: U, raw: number, crit: boolean): void {
    const def = to.def + (to.taunt ? 3 : 0);
    const amount = Math.max(1, Math.round(raw - def * 0.5));
    const dealt = Math.min(to.hp, amount);
    to.hp = Math.max(0, to.hp - amount);
    this.emit({ kind: 'hit', from: from.id, to: to.id, amount, dealt, crit });
    if (to.hp <= 0) this.downed(from, to);
  }

  /** A quién pega: el que provoca; si no, su blanco si sigue delante; si no, otro. */
  protected targetOf(u: U): U | undefined {
    const foes = this.foesOf(u);
    if (!foes.length) return undefined;
    if (u.side === 'e') {
      const taunter = foes.find((f) => f.taunt);
      if (taunter) return taunter;
    }
    const t = foes.find((f) => f.id === u.target);
    if (t) return t;
    const pick = this.pick(u, foes);
    u.target = pick.id;
    return pick;
  }

  /** Blanco nuevo: los de fuera, a uno cualquiera (más a los de delante). */
  protected pick(u: U, foes: U[]): U {
    if (u.side === 'h') return this.heroPick(u, foes);
    return this.rng.weighted(foes.map((f) => [f, f.ranged ? 1 : 2] as const));
  }
}

/**
 * Uno contra uno con reloj (el ladrón): si `a` tumba a `b` antes de `limit` segundos, gana; si
 * no, `b` se escapa. Sin habilidades ni ocasiones de crítico; solo `a` mete críticos, a veces.
 */
export function clockDuel(
  a: FightUnit,
  b: FightUnit,
  seed: string,
  limit: number,
): {
  won: boolean;
  t: number;
  hits: { t: number; by: 'a' | 'b'; amount: number; crit?: boolean }[];
} {
  const d = new ClockDuel(a, b, seed, limit);
  d.run();
  return { won: d.result!.won, t: d.t, hits: d.hits };
}

class ClockDuel extends Fight<FightUnit, never, { won: boolean }> {
  readonly hits: { t: number; by: 'a' | 'b'; amount: number; crit?: boolean }[] = [];

  constructor(
    a: FightUnit,
    b: FightUnit,
    seed: string,
    private limit: number,
  ) {
    super(
      [
        { ...a, side: 'h', ability: undefined, target: b.id },
        { ...b, side: 'e', ability: undefined, target: a.id },
      ],
      new Rng(seed),
      [],
      true,
    );
  }

  /** Segundos, contados en décimas para no arrastrar decimales. */
  get t(): number {
    return this.step / 10;
  }

  tick(): void {
    const [a, b] = this.units as [FightUnit, FightUnit];
    if (this.t >= this.limit || !alive(a) || !alive(b)) {
      this.result = { won: !alive(b) };
      return;
    }
    for (const u of this.units) if (alive(u)) this.act(u);
    this.step++;
  }

  protected foesOf(u: FightUnit): FightUnit[] {
    return this.units.filter((f) => f.side !== u.side && alive(f));
  }

  protected alliesOf(): FightUnit[] {
    return [];
  }

  protected heroPick(_u: FightUnit, foes: FightUnit[]): FightUnit {
    return foes[0]!;
  }

  protected crit(u: FightUnit): boolean {
    return u.side === 'h' && this.rng.chance(CRIT);
  }

  protected chances(): boolean {
    return false;
  }

  protected emit(e: FightEvent): void {
    if (e.kind !== 'hit') return;
    const by = e.from === this.units[0]!.id ? 'a' : 'b';
    this.hits.push({ t: this.t, by, amount: e.dealt, ...(e.crit ? { crit: true } : {}) });
  }
}
