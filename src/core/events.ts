/**
 * La comarca se mueve: la amenaza regional (crece si se ignoran o se fallan las historias)
 * y los sucesos de la taberna en los que hay que elegir.
 */
import { GEAR } from '../data/items';
import { QUIET_AFTER } from './balance';
import { activeChain, chainDef } from './chains';
import type { DawnEvent, GameState, Hero, PendingEvent, Rarity } from './model';
import type { Rng } from './rng';
import { type Msg, type Txt, msg, t } from '../textos';

// ---------- Amenaza regional ----------

export const THREAT_CARAVAN = 40;
export const THREAT_SCARED = 60;
export const THREAT_RAIDS = 80;

export const threatOf = (s: GameState) => s.threat ?? 0;

export function addThreat(s: GameState, d: number): void {
  s.threat = Math.max(0, Math.min(100, threatOf(s) + d));
}

/**
 * Cada noche: si hay una historia en marcha y su paso espera en el tablón sin que nadie
 * vaya, la amenaza crece; también si pasan días sin que nadie salga de encargo. Si no, se calma.
 * Devuelve los ingresos perdidos.
 */
export function stepThreat(
  s: GameState,
  rng: Rng,
  events: DawnEvent[],
  income: number,
  /** Nadie sale de encargo desde hace días: la comarca se revuelve. */
  idle = false,
): number {
  const cs = activeChain(s);
  const waiting = cs && s.quests.some((q) => q.chain?.id === cs.id);
  addThreat(s, waiting ? 2 : idle ? 1 : -1);
  const t = threatOf(s);
  if (t >= THREAT_CARAVAN && income > 0 && rng.chance(0.2)) {
    events.push({ t: msg('sucesos.amenaza.caravana'), k: 'bad' });
    return income;
  }
  if (t >= THREAT_SCARED && rng.chance(0.15))
    events.push({ t: msg('sucesos.amenaza.miedo'), k: 'warn' });
  return 0;
}

/**
 * Hacia dónde va la amenaza esta noche y por qué (lo mismo que decide `stepThreat`), para
 * explicarla donde sale: sube 2 si el paso de una historia espera en el tablón, 1 si hace días
 * que no sale nadie de encargo; si no, baja 1.
 */
export function threatTrend(s: GameState): { d: number; why: string } {
  const cs = activeChain(s);
  if (cs && s.quests.some((q) => q.chain?.id === cs.id))
    return { d: 2, why: t('sucesos.amenaza.por_historia', { historia: chainDef(cs.id).name }) };
  if (!s.missions.length && (s.quiet ?? 0) + 1 > QUIET_AFTER)
    return { d: 1, why: t('sucesos.amenaza.por_quietud') };
  return {
    d: -1,
    why: t(s.missions.length ? 'sucesos.amenaza.en_camino' : 'sucesos.amenaza.en_calma'),
  };
}

/** Lo que pasa con cada tramo de amenaza, de menos a más. */
export const THREAT_STEPS = [
  { at: THREAT_CARAVAN, text: t('sucesos.amenaza.tramo_caravanas') },
  { at: THREAT_SCARED, text: t('sucesos.amenaza.tramo_encargos') },
  { at: THREAT_RAIDS, text: t('sucesos.amenaza.tramo_asaltos') },
] as const;

/** Encargos de menos en el tablón cuando la amenaza asusta a los clientes. */
export const scaredClients = (s: GameState) => (threatOf(s) >= THREAT_SCARED ? 1 : 0);

// ---------- Sucesos con elección ----------

/**
 * Una opción: su texto está en `sucesos.<id>.opciones.<n>` (`etiqueta` y `pista`); `apply`
 * aplica la elección y devuelve lo que pasó (un texto de `sucesos.<id>.…`).
 */
interface Option {
  apply: (s: GameState, rng: Rng, who: Hero[]) => Txt;
}

interface EventDef {
  id: string;
  /** Héroes en casa que hacen falta (los primeros, por orden). */
  needs?: number;
  when?: (s: GameState) => boolean;
  /** Los huecos del texto (`sucesos.<id>.texto`): por defecto, ninguno. */
  text?: (who: Hero[]) => Record<string, string>;
  options: Option[];
}

/** Un texto de un suceso. */
const say = (id: string, key: string, p?: Record<string, string | Txt>): Msg =>
  msg(`sucesos.${id}.${key}`, p);

const home = (s: GameState) => s.heroes.filter((h) => h.status === 'ok');
const gearOf = (rarity: Rarity) => GEAR.filter((g) => g.rarity === rarity);

const EVENTS: readonly EventDef[] = [
  {
    id: 'buhonero',
    when: (s) => s.gold >= 60,
    options: [
      {
        apply: (s, rng) => {
          s.gold -= 60;
          if (rng.chance(0.65)) {
            const g = rng.pick(gearOf(2));
            s.inventory.push({ ...g, id: `i${s.uid++}` });
            return say('buhonero', 'bueno', { objeto: g.name });
          }
          const g = rng.pick(gearOf(0));
          s.inventory.push({ ...g, id: `i${s.uid++}` });
          return say('buhonero', 'malo', { objeto: g.name });
        },
      },
      { apply: () => say('buhonero', 'no') },
    ],
  },
  {
    id: 'pelea',
    needs: 2,
    text: (w) => ({ a: w[0]!.name, b: w[1]!.name }),
    options: [
      {
        apply: (s, _r, w) => {
          s.gold = Math.max(0, s.gold - 10);
          for (const h of w) h.morale = Math.min(100, h.morale + 6);
          return say('pelea', 'ronda', { a: w[0]!.name, b: w[1]!.name });
        },
      },
      {
        apply: (_s, rng, w) => {
          const [a, b] = rng.chance(0.5) ? [w[0]!, w[1]!] : [w[1]!, w[0]!];
          a.morale = Math.min(100, a.morale + 5);
          b.morale = Math.max(0, b.morale - 10);
          return say('pelea', 'solos', { a: a.name, b: b.name });
        },
      },
    ],
  },
  {
    id: 'bardo',
    needs: 1,
    options: [
      {
        apply: (s) => {
          s.gold = Math.max(0, s.gold - 5);
          for (const h of home(s)) h.morale = Math.min(100, h.morale + 6);
          return say('bardo', 'canta');
        },
      },
      { apply: () => say('bardo', 'no') },
    ],
  },
  {
    id: 'noble',
    when: (s) => s.gold >= 100,
    options: [
      {
        apply: (s, rng) => {
          s.gold -= 100;
          const g = rng.pick(gearOf(rng.chance(0.1) ? 4 : rng.chance(0.2) ? 3 : 2));
          s.inventory.push({ ...g, id: `i${s.uid++}`, value: Math.max(g.value, 150) });
          return say('noble', 'si', { objeto: g.name });
        },
      },
      { apply: () => say('noble', 'no') },
    ],
  },
  {
    id: 'lobos',
    needs: 1,
    options: [
      {
        apply: (s, rng, w) => {
          s.rep += 6;
          if (rng.chance(0.25)) {
            w[0]!.status = 'herido';
            w[0]!.days = 2;
            return say('lobos', 'mordisco', { heroe: w[0]!.name });
          }
          return say('lobos', 'ayuda', { heroe: w[0]!.name });
        },
      },
      {
        apply: (s) => {
          s.rep = Math.max(0, s.rep - 2);
          return say('lobos', 'no');
        },
      },
    ],
  },
  {
    id: 'apuesta',
    when: (s) => s.gold >= 30,
    options: [
      {
        apply: (s, rng) => {
          if (rng.chance(0.5)) {
            s.gold += 30;
            return say('apuesta', 'gana');
          }
          s.gold -= 30;
          return say('apuesta', 'pierde');
        },
      },
      { apply: () => say('apuesta', 'no') },
    ],
  },
];

/** A veces, al amanecer, pasa algo en la taberna que pide una decisión. */
export function maybeEvent(s: GameState, rng: Rng): void {
  if (s.event || s.day < 3 || s.over || !rng.chance(0.18)) return;
  const at = home(s);
  const pool = EVENTS.filter((e) => (e.needs ?? 0) <= at.length && (e.when?.(s) ?? true));
  if (!pool.length) return;
  const e = rng.pick(pool);
  const who = at.slice(0, e.needs ?? 0);
  s.event = {
    id: e.id,
    who: who.map((h) => h.id),
    text: say(e.id, 'texto', e.text?.(who)),
    options: e.options.map((_, i) => ({
      label: say(e.id, `opciones.${i}.etiqueta`),
      hint: say(e.id, `opciones.${i}.pista`),
    })),
  };
}

/** Aplica la elección del jugador. */
export function choose(s: GameState, rng: Rng, index: number): void {
  const pe = s.event as PendingEvent | undefined;
  if (!pe) return;
  const def = EVENTS.find((e) => e.id === pe.id);
  const who = pe.who.map((id) => s.heroes.find((h) => h.id === id)).filter((h): h is Hero => !!h);
  const opt = def?.options[index];
  s.event = null;
  s.lastChoice = opt ? opt.apply(s, rng, who) : null;
}
