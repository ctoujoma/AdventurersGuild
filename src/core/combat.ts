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
import {
  Fight,
  STEP,
  alive,
  heroUnit,
  type AbilityId,
  type FightEvent,
  type FightOrder,
  type OrderInput,
  type Unit,
} from './fight';
import { equip } from './resolve';
import type { GameState, Mission } from './model';
import { Rng } from './rng';

export {
  ABILITIES,
  AI_COVER,
  AI_CRIT,
  AUTO_SKILL,
  COVERED,
  CRIT,
  CRIT_MULT,
  CRIT_OPEN,
  STEP,
  WARN,
  heroUnit,
  type AbilityId,
  type Unit,
} from './fight';

/** Si nadie ha caído del todo en este tiempo, el grupo se retira (cuenta como perder). */
export const MAX_TIME = 90;

/** Las órdenes de la pelea contra un jefe (las comunes menos la de mover: no hay salas). */
export type Order = Exclude<FightOrder, { kind: 'move' }>;

export type CombatEventKind =
  | 'hit'
  | 'crit'
  | 'skill'
  | 'heal'
  | 'down'
  /** El jefe avisa de su golpe fuerte (`WARN` s antes). */
  | 'warn'
  | 'cover'
  /** Se abre la ocasión de crítico de un héroe (hasta su siguiente golpe). */
  | 'chance'
  | 'special';

export interface CombatEvent {
  step: number;
  kind: CombatEventKind;
  from: string;
  to?: string;
  amount?: number;
  skill?: AbilityId;
}

/** Un suceso común como lo lee la escena de la arena (`world/battle.ts` y `BossFight`). */
export function combatEvent(step: number, e: FightEvent): CombatEvent {
  switch (e.kind) {
    case 'hit':
      return { step, kind: e.crit ? 'crit' : 'hit', from: e.from, to: e.to, amount: e.amount };
    case 'heal':
      return { step, kind: 'heal', from: e.from, to: e.to, amount: e.amount };
    case 'down':
      return { step, kind: 'down', from: e.from, to: e.to };
    case 'skill':
      return { step, kind: 'skill', from: e.from, skill: e.skill };
    case 'special':
      return { step, kind: 'special', from: e.from, amount: e.covered ? 1 : 0 };
    default:
      return { step, kind: e.kind, from: e.from };
  }
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

/** Cuánto pesa el jefe frente a lo que pide el encargo (calibrado con `tools/calib.ts`). */
export const FOE_TUNE = { hp: 18.4, atk: 0.555, minionHp: 2.26, minionAtk: 0.235 };

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

/**
 * La pelea en marcha: se avanza paso a paso y se le pueden dar órdenes. Todos en el mismo sitio:
 * cada uno tiene delante a todos los del otro bando.
 */
export class Combat extends Fight<Unit, Order, CombatResult> {
  readonly events: CombatEvent[] = [];

  /**
   * `orders`: las de una pelea ya jugada (se aplican en su paso). `auto`: las habilidades se
   * usan en cuanto están listas (sin jugador); si no, se lanzan solas al cabo de `AUTO_SKILL`.
   */
  constructor(setup: CombatSetup, orders: readonly Order[] = [], auto = true) {
    super(
      setup.units.map((u) => ({ ...u })),
      new Rng(setup.seed),
      orders,
      auto,
    );
    for (const u of this.units) u.target = this.defaultTarget(u);
  }

  get t(): number {
    return this.step * STEP;
  }

  heroes(): Unit[] {
    return this.units.filter((u) => u.side === 'h');
  }

  foes(): Unit[] {
    return this.units.filter((u) => u.side === 'e');
  }

  /** Orden del jugador para el paso de ahora (se guarda para repetirla). */
  override order(o: OrderInput<Order>): boolean {
    return super.order(o);
  }

  tick(): void {
    if (this.result) return;
    this.playOrders();
    for (const u of this.units) if (alive(u)) this.act(u);
    this.step++;
    const hs = this.heroes();
    const fs = this.foes();
    const downed = hs.filter((h) => !alive(h)).map((h) => h.id);
    if (!fs.some(alive)) this.result = { won: true, downed, steps: this.step };
    else if (!hs.some(alive) || this.t >= MAX_TIME)
      this.result = { won: false, downed, steps: this.step };
  }

  protected foesOf(u: Unit): Unit[] {
    return this.units.filter((f) => f.side !== u.side && alive(f));
  }

  protected alliesOf(u: Unit): Unit[] {
    return this.units.filter((f) => f.side === u.side && alive(f));
  }

  /**
   * El blanco de siempre de un héroe: los de cuerpo a cuerpo van a por los esbirros primero; los
   * de lejos, al jefe.
   */
  protected heroPick(u: Unit, foes: Unit[]): Unit {
    const boss = foes.find((f) => f.kind === 'jefe');
    const minion = foes.find((f) => f.kind === 'esbirro');
    return (u.ranged ? (boss ?? minion) : (minion ?? boss)) ?? foes[0]!;
  }

  protected emit(e: FightEvent): void {
    this.events.push(combatEvent(this.step, e));
  }

  protected override downed(from: Unit, to: Unit): void {
    super.downed(from, to);
    // Los que le pegaban buscan otro blanco.
    for (const u of this.units) if (u.target === to.id) u.target = this.defaultTarget(u);
  }

  private defaultTarget(u: Unit): string | undefined {
    const foes = this.foesOf(u);
    return foes.length ? this.pick(u, foes).id : undefined;
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
