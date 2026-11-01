/**
 * La pelea contra un jefe, de verdad: vida, ataque y defensa, cada uno a su ritmo, con una
 * habilidad por clase que se recarga. Sin órdenes, cada uno hace lo suyo (la IA); con órdenes,
 * el jugador elige a quién pega cada héroe y cuándo usa su habilidad.
 *
 * Es determinista: avanza a pasos fijos (`STEP`) con una semilla, y las órdenes llevan el paso
 * en que se dieron. La interfaz juega la pelea en directo y el núcleo la vuelve a jugar con las
 * mismas órdenes para sacar el resultado (y el informe la repite igual).
 */
import { BOSSES, type BossKind } from '../data/bosses';
import type { ClassId } from './party';
import { attr, skill, type Member } from './party';
import { equip } from './resolve';
import type { GameState, Mission } from './model';
import { Rng } from './rng';

/** Paso fijo de la simulación (s). */
export const STEP = 0.1;
/** Si nadie ha caído del todo en este tiempo, el grupo se retira (cuenta como perder). */
export const MAX_TIME = 90;
/** Una habilidad lista que el jugador no usa se lanza sola al cabo de esto (s). */
export const AUTO_SKILL = 5;
/** Probabilidad de crítico y cuánto multiplica. */
export const CRIT = 0.1;
export const CRIT_MULT = 1.8;

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

export interface Unit {
  id: string;
  side: 'h' | 'e';
  name: string;
  /** Clase del héroe, o el jefe y sus esbirros. */
  kind: ClassId | 'jefe' | 'esbirro';
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
  /** Ataque especial del jefe: lo que falta. */
  special?: number;
  /** De lejos (no se pone delante). */
  ranged?: boolean;
}

export type Order = { step: number; who: string } & (
  | { kind: 'target'; to: string }
  | { kind: 'skill' }
  /** ¡Cubríos! (cualquier héroe): el golpe fuerte del jefe que viene hace mucho menos. */
  | { kind: 'cover' }
);

/** Cuánto antes avisa el jefe de su golpe fuerte (s), y lo que hace si se cubren. */
export const WARN = 2.2;
export const COVERED = 0.3;
/** Sin jugador, la IA se cubre a tiempo esta parte de las veces. */
export const AI_COVER = 0.4;

export type CombatEventKind =
  | 'hit'
  | 'crit'
  | 'skill'
  | 'heal'
  | 'down'
  /** El jefe avisa de su golpe fuerte (`WARN` s antes). */
  | 'warn'
  | 'cover'
  | 'special';

export interface CombatEvent {
  step: number;
  kind: CombatEventKind;
  from: string;
  to?: string;
  amount?: number;
  skill?: AbilityId;
}

export interface CombatSetup {
  seed: string;
  boss: BossKind;
  units: Unit[];
}

export interface CombatResult {
  won: boolean;
  /** Héroes que acabaron en el suelo. */
  downed: string[];
  steps: number;
}

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

/** Cuánto pesa el jefe frente a lo que pide el encargo (calibrado con `tools/calib.ts`). */
export const FOE_TUNE = { hp: 19.6, atk: 0.59, minionHp: 2.4, minionAtk: 0.25 };

/**
 * El jefe y sus esbirros, según lo que pide el encargo: la dificultad media de sus desafíos
 * (`diff`) y cuántos son (`n`). Así un jefe pide lo mismo que pedía la tirada de antes.
 */
export function foeUnits(boss: BossKind, diff: number, n: number): Unit[] {
  const b = BOSSES[boss];
  const k = 0.7 + 0.15 * n;
  const out: Unit[] = [
    {
      id: 'jefe',
      side: 'e',
      name: b.name,
      kind: 'jefe',
      max: Math.round(FOE_TUNE.hp * (diff + 3) * k * (b.minions ? 0.65 : 1)),
      hp: 0,
      atk: FOE_TUNE.atk * diff * (0.85 + 0.1 * n),
      def: 2,
      every: 1.8,
      cool: 1.5,
      special: 8,
    },
  ];
  for (let i = 0; i < b.minions; i++)
    out.push({
      id: `esbirro-${i}`,
      side: 'e',
      name: 'Esbirro',
      kind: 'esbirro',
      max: Math.round(FOE_TUNE.minionHp * (diff + 3)),
      hp: 0,
      atk: FOE_TUNE.minionAtk * diff,
      def: 1,
      every: 1.6,
      cool: 0.8 + i * 0.3,
    });
  return out;
}

/** El jefe de un encargo (el último paso de una historia). */
export function questFoes(boss: BossKind, challenges: readonly { diff: number }[]): Unit[] {
  const n = Math.max(1, challenges.length);
  const diff = challenges.reduce((a, c) => a + c.diff, 0) / n;
  return foeUnits(boss, diff, n);
}

export function setupCombat(
  seed: string,
  boss: BossKind,
  heroes: readonly Unit[],
  foes: readonly Unit[],
): CombatSetup {
  const units = [...heroes, ...foes].map((u) => ({ ...u, hp: u.max }));
  return { seed, boss, units };
}

const alive = (u: Unit) => u.hp > 0;

/** La pelea en marcha: se avanza paso a paso y se le pueden dar órdenes. */
export class Combat {
  step = 0;
  readonly units: Unit[];
  readonly events: CombatEvent[] = [];
  /** Órdenes dadas (para volver a jugarla igual). */
  readonly orders: Order[] = [];
  result: CombatResult | null = null;
  private rng: Rng;
  private pending: Order[];
  /** Se han cubierto para el golpe fuerte que viene. */
  private covered = false;
  /** La IA se cubrirá en este (decidido al avisar). */
  private aiCover = false;
  /** Héroes a los que el jugador ya maneja la habilidad. */
  private manual = new Set<string>();

  /**
   * `orders`: las de una pelea ya jugada (se aplican en su paso). `auto`: las habilidades se
   * usan en cuanto están listas (sin jugador); si no, se lanzan solas al cabo de `AUTO_SKILL`.
   */
  constructor(
    setup: CombatSetup,
    orders: readonly Order[] = [],
    private auto = true,
  ) {
    this.units = setup.units.map((u) => ({ ...u }));
    this.rng = new Rng(setup.seed);
    this.pending = [...orders].sort((a, b) => a.step - b.step);
    for (const u of this.units) u.target = this.defaultTarget(u);
  }

  get t(): number {
    return this.step * STEP;
  }

  unit(id: string): Unit | undefined {
    return this.units.find((u) => u.id === id);
  }

  heroes(): Unit[] {
    return this.units.filter((u) => u.side === 'h');
  }

  foes(): Unit[] {
    return this.units.filter((u) => u.side === 'e');
  }

  /** Orden del jugador para el paso de ahora (se guarda para repetirla). */
  order(
    o: { who: string } & ({ kind: 'target'; to: string } | { kind: 'skill' } | { kind: 'cover' }),
  ): boolean {
    if (this.result) return false;
    const full = { ...o, step: this.step } as Order;
    if (!this.apply(full)) return false;
    this.orders.push(full);
    return true;
  }

  /** Juega hasta el final (sin jugador, o repitiendo órdenes). */
  run(): CombatResult {
    while (!this.result) this.tick();
    return this.result!;
  }

  tick(): void {
    if (this.result) return;
    while (this.pending.length && this.pending[0]!.step <= this.step)
      this.apply(this.pending.shift()!);
    for (const u of this.units) {
      if (!alive(u)) continue;
      if (u.taunt) u.taunt = Math.max(0, u.taunt - STEP);
      // Habilidad.
      if (u.ability !== undefined) {
        if (u.charge! > 0) u.charge = Math.max(0, u.charge! - STEP);
        else {
          u.readyFor = (u.readyFor ?? 0) + STEP;
          if (this.wantsSkill(u)) this.useSkill(u);
        }
      }
      // Especial del jefe: un golpe a todo el grupo.
      if (u.special !== undefined) {
        const before = u.special;
        u.special -= STEP;
        if (before > WARN && u.special <= WARN) {
          this.events.push({ step: this.step, kind: 'warn', from: u.id });
          this.covered = false;
          this.aiCover = this.rng.chance(AI_COVER);
        }
        if (u.special <= 0) {
          u.special = 9;
          // Sin que el jugador diga nada, la IA se cubre a veces.
          const covered =
            this.covered || (!this.orders.some((o) => o.kind === 'cover') && this.aiCover);
          this.events.push({
            step: this.step,
            kind: 'special',
            from: u.id,
            amount: covered ? 1 : 0,
          });
          for (const h of this.heroes().filter(alive))
            this.damage(u, h, u.atk * 1.1 * (covered ? COVERED : 1), false);
          this.covered = false;
        }
      }
      // Golpe normal.
      u.cool -= STEP;
      if (u.cool <= 0) {
        u.cool += u.every;
        const to = this.targetOf(u);
        if (to) {
          const crit = this.rng.chance(CRIT);
          this.damage(u, to, u.atk * (0.85 + this.rng.next() * 0.3) * (crit ? CRIT_MULT : 1), crit);
        }
      }
    }
    this.step++;
    const hs = this.heroes();
    const fs = this.foes();
    const downed = hs.filter((h) => !alive(h)).map((h) => h.id);
    if (!fs.some(alive)) this.result = { won: true, downed, steps: this.step };
    else if (!hs.some(alive) || this.t >= MAX_TIME)
      this.result = { won: false, downed, steps: this.step };
  }

  private apply(o: Order): boolean {
    const u = this.unit(o.who);
    if (!u || u.side !== 'h' || !alive(u)) return false;
    if (o.kind === 'cover') {
      // Solo sirve con el aviso dado: antes de tiempo no se aguanta la guardia.
      const boss = this.foes().find((f) => f.special !== undefined && alive(f));
      if (!boss || boss.special! > WARN || this.covered) return false;
      this.covered = true;
      this.events.push({ step: this.step, kind: 'cover', from: u.id });
      return true;
    }
    if (o.kind === 'target') {
      const to = this.unit(o.to);
      if (!to || to.side !== 'e' || !alive(to)) return false;
      u.target = to.id;
      return true;
    }
    if (u.charge! > 0) return false;
    this.manual.add(u.id);
    this.useSkill(u);
    return true;
  }

  private wantsSkill(u: Unit): boolean {
    // Si el jugador ya la maneja, espera su orden (y si se le olvida, sale sola al rato).
    if (!this.auto && this.manual.has(u.id)) return (u.readyFor ?? 0) >= AUTO_SKILL;
    // Sin jugador: curar solo si hace falta; lo demás, en cuanto se puede.
    if (u.ability === 'curar') return this.heroes().some((h) => alive(h) && h.hp < h.max * 0.6);
    return true;
  }

  private useSkill(u: Unit): void {
    const id = u.ability!;
    u.charge = ABILITIES[id].every;
    u.readyFor = 0;
    this.events.push({ step: this.step, kind: 'skill', from: u.id, skill: id });
    const to = this.targetOf(u);
    if (id === 'provocar') u.taunt = 6;
    else if (id === 'punalada' && to) this.damage(u, to, u.atk * 3, false);
    else if (id === 'andanada' && to) {
      this.damage(u, to, u.atk * 1.1, false);
      if (alive(to)) this.damage(u, to, u.atk * 1.1, false);
    } else if (id === 'bola')
      for (const f of this.foes().filter(alive)) this.damage(u, f, u.atk * 1.4, false);
    else if (id === 'curar') {
      const low = this.heroes()
        .filter(alive)
        .sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
      if (low) {
        const amount = Math.round(low.max * 0.35);
        low.hp = Math.min(low.max, low.hp + amount);
        this.events.push({ step: this.step, kind: 'heal', from: u.id, to: low.id, amount });
      }
    }
  }

  private damage(from: Unit, to: Unit, raw: number, crit: boolean): void {
    const def = to.def + (to.taunt ? 3 : 0);
    const amount = Math.max(1, Math.round(raw - def * 0.5));
    to.hp = Math.max(0, to.hp - amount);
    this.events.push({
      step: this.step,
      kind: crit ? 'crit' : 'hit',
      from: from.id,
      to: to.id,
      amount,
    });
    if (to.hp === 0) {
      this.events.push({ step: this.step, kind: 'down', from: from.id, to: to.id });
      // Los que le pegaban buscan otro blanco.
      for (const u of this.units) if (u.target === to.id) u.target = this.defaultTarget(u);
    }
  }

  /** A quién pega: su blanco si sigue en pie; si no, el de siempre. */
  private targetOf(u: Unit): Unit | undefined {
    if (u.side === 'e') {
      const taunter = this.heroes().find((h) => alive(h) && h.taunt);
      if (taunter) return taunter;
    }
    const t = u.target && this.unit(u.target);
    if (t && alive(t)) return t;
    u.target = this.defaultTarget(u);
    return u.target ? this.unit(u.target) : undefined;
  }

  /**
   * El blanco de siempre: los héroes de cuerpo a cuerpo van a por los esbirros primero; los de
   * lejos, al jefe. Los enemigos, a uno cualquiera (más a los de delante).
   */
  private defaultTarget(u: Unit): string | undefined {
    if (u.side === 'h') {
      const fs = this.foes().filter(alive);
      const boss = fs.find((f) => f.kind === 'jefe');
      const minion = fs.find((f) => f.kind === 'esbirro');
      return (u.ranged ? (boss ?? minion) : (minion ?? boss))?.id;
    }
    const hs = this.heroes().filter(alive);
    if (!hs.length) return undefined;
    return this.rng.weighted(hs.map((h) => [h, h.ranged ? 1 : 2] as const)).id;
  }
}

/** Juega una pelea entera: sin órdenes (se las apañan) o repitiendo las del jugador. */
export function runCombat(setup: CombatSetup, orders?: readonly Order[]): CombatResult {
  return new Combat(setup, orders ?? [], !orders).run();
}

/**
 * La pelea de un grupo contra el jefe de su encargo (o null si no hay jefe). La semilla sale
 * del grupo: la interfaz y el núcleo arman la misma.
 */
export function missionCombat(s: GameState, m: Mission, boss: BossKind): CombatSetup {
  const party = m.heroIds
    .map((id) => s.heroes.find((h) => h.id === id))
    .filter((h) => !!h && h.status !== 'muerto' && h.status !== 'desaparecido');
  const heroes = equip(party as NonNullable<(typeof party)[number]>[], s.fac).map((h) =>
    heroUnit(h),
  );
  return setupCombat(`pelea-${m.id}`, boss, heroes, questFoes(boss, m.quest.challenges));
}
