/**
 * Generadores con semilla: candidatos y encargos escalados por el rango del gremio.
 */
import { CLIENTS, ITEMS, PLACES, SHADY_CLIENTS, TEMPLATES, TWISTS } from '../data/quests';
import { FIRST_NAMES, QUOTES, SURNAMES } from '../data/names';
import { REWARD_PER_POINT } from './balance';
import type { Danger, Hero, Item, Quest, QuestType, Sex } from './model';
import type { AttrId, Attrs, Challenge, ClassId, SkillId, Trait, TraitId } from './party';
import type { Rng } from './rng';

export const CLASSES: readonly ClassId[] = ['guerrero', 'picaro', 'mago', 'clerigo', 'explorador'];
const QUEST_TYPES = Object.keys(TEMPLATES) as QuestType[];

/** Atributo principal y secundario de cada clase. */
const FOCUS: Record<ClassId, [AttrId, AttrId]> = {
  guerrero: ['F', 'D'],
  picaro: ['D', 'M'],
  mago: ['M', 'D'],
  clerigo: ['M', 'F'],
  explorador: ['D', 'F'],
};

/** Rasgos con los que se puede llegar (las secuelas se ganan en misiones). */
const BORN_TRAITS: readonly TraitId[] = [
  'valiente',
  'cobarde',
  'codicioso',
  'afortunado',
  'gafe',
  'bebedor',
  'leal',
  'arrogante',
  'supersticioso',
];
const CLASHES: readonly [TraitId, TraitId][] = [['valiente', 'cobarde']];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) => {
    const v = vars[key] ?? vars[key.toLowerCase()];
    if (v === undefined) return m;
    return key[0] === key[0]!.toUpperCase() ? cap(v) : v;
  });
}

function pickTraits(rng: Rng): Trait[] {
  const a = rng.pick(BORN_TRAITS);
  let b = rng.pick(BORN_TRAITS);
  while (b === a || CLASHES.some(([x, y]) => (x === a && y === b) || (x === b && y === a)))
    b = rng.pick(BORN_TRAITS);
  return [{ id: a }, { id: b, hidden: true }];
}

export interface HeroOptions {
  rank: number;
  /** Nivel de la taberna: mejores candidatos. */
  tab: number;
  cls?: ClassId;
  usedNames?: readonly string[];
}

export function generateHero(rng: Rng, id: string, opts: HeroOptions): Hero {
  const cls = opts.cls ?? rng.pick(CLASSES);
  const sex: Sex = rng.chance(0.5) ? 'm' : 'f';
  let name = '';
  for (let tries = 0; tries < 20; tries++) {
    name = rng.pick(FIRST_NAMES[sex]);
    if (rng.chance(0.45)) name += ` ${rng.pick(SURNAMES)}`;
    if (!opts.usedNames?.some((n) => n.split(' ')[0] === name.split(' ')[0])) break;
  }
  const maxExtra = Math.min(2, opts.rank + (opts.tab >= 2 ? 1 : 0));
  const lvl = 1 + (maxExtra > 0 ? rng.int(0, maxExtra) : 0);
  const [main, second] = FOCUS[cls];
  const bonus = opts.tab >= 3 ? 1 : 0;
  const attrs: Attrs = { F: rng.int(2, 4), D: rng.int(2, 4), M: rng.int(2, 4) };
  attrs[main] += rng.int(3, 4) + bonus + (lvl - 1);
  attrs[second] += rng.int(1, 2);
  for (const k of ['F', 'D', 'M'] as const) attrs[k] = clamp(attrs[k], 1, 10);
  const quality = attrs.F + attrs.D + attrs.M;
  return {
    id,
    seed: `${id}-${name}`,
    name,
    sex,
    cls,
    lvl,
    xp: 0,
    attrs,
    traits: pickTraits(rng),
    morale: rng.int(60, 75),
    salary: 6 + lvl * 4 + Math.max(0, quality - 15),
    fee: 15 + lvl * 15 + Math.max(0, quality - 14) * 3,
    status: 'ok',
    days: 0,
    quote: rng.pick(QUOTES[cls]),
    history: [],
  };
}

/** Fuerza típica de un héroe en su habilidad fuerte, según el rango. */
const perHero = (rank: number) => 4.4 + rank * 1.7;

export function generateQuest(rng: Rng, id: string, rank: number, uidItem: string): Quest {
  const type = rng.pick(QUEST_TYPES);
  const tpl = TEMPLATES[type];
  const shady = rng.chance(0.12);
  const client = shady ? rng.pick(SHADY_CLIENTS) : rng.pick(CLIENTS);
  const place = rng.pick(PLACES);
  const threat = rng.pick(tpl.threats);
  const vars = { place, threat, client };

  const slots = rng.weighted<number>([
    [1, 3],
    [2, 4],
    [3, 2 + rank],
    [4, rank],
  ]);
  const mainDiff = Math.round(perHero(rank) * slots + rng.int(-2, 2));
  const challenges: Challenge[] = [{ skill: tpl.main, diff: Math.max(4, mainDiff) }];
  const extras = slots >= 3 ? 2 : slots === 2 ? 1 : rng.chance(0.3) ? 1 : 0;
  const pool = [...tpl.extra];
  for (let i = 0; i < extras && pool.length; i++) {
    const skill = pool.splice(rng.int(0, pool.length - 1), 1)[0] as SkillId;
    challenges.push({
      skill,
      diff: Math.max(3, Math.round(mainDiff * (0.55 - i * 0.1) + rng.int(-1, 2))),
    });
  }

  const tough = mainDiff / (perHero(rank) * slots);
  let danger = clamp(
    Math.round((slots - 1) / 1.5 + (tough - 1) * 3 + rng.int(-1, 1) * 0.5),
    0,
    3,
  ) as Danger;
  if (danger === 3 && rank < 2 && !shady) danger = 2;
  const days = clamp(1 + Math.floor((slots - 1) / 2) + rng.int(0, 1), 1, 4);
  const sum = challenges.reduce((a, c) => a + c.diff, 0);
  const reward =
    Math.round(
      (sum * REWARD_PER_POINT * (1 - 0.08 * rank) * (1 + 0.22 * danger) * (0.85 + 0.12 * days)) / 5,
    ) * 5;

  let item: Item | undefined;
  if (rng.chance(0.15 + danger * 0.08)) {
    const base = rng.pick(ITEMS);
    item = { id: uidItem, ...base, value: Math.round(base.value * (1 + rank * 0.4)) };
  }
  const twist = rng.chance(shady ? 0.6 : 0.12) ? rng.pick(TWISTS) : undefined;

  return {
    id,
    title: cap(fill(rng.pick(tpl.titles), vars)),
    client,
    type,
    text: fill(rng.pick(tpl.texts), vars),
    place,
    challenges,
    slots,
    days,
    reward: shady ? Math.round((reward * 1.3) / 5) * 5 : reward,
    danger: shady && danger < 2 ? 2 : danger,
    dangerHidden: shady || undefined,
    expires: rng.int(2, 5),
    item,
    twist,
    fresh: true,
  };
}
