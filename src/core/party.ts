/**
 * Reglas de grupo: habilidades de cada héroe y estimación de riesgo de un encargo.
 * TS puro, sin DOM: lo usan la interfaz, los tests y (en la fase 1) la resolución.
 */

export type ClassId = 'guerrero' | 'picaro' | 'mago' | 'clerigo' | 'explorador';
export type SkillId = 'Combate' | 'Trampas' | 'Arcano' | 'Supervivencia';
export type AttrId = 'F' | 'D' | 'M';
export type TraitId =
  | 'valiente'
  | 'cobarde'
  | 'codicioso'
  | 'afortunado'
  | 'gafe'
  | 'bebedor'
  | 'leal'
  | 'arrogante'
  | 'supersticioso'
  | 'tuerto'
  | 'cojo'
  | 'cortado'
  | 'curtido';

export type Attrs = Record<AttrId, number>;

export interface Trait {
  id: TraitId;
  /** Rasgo oculto: no cuenta en la estimación hasta que se descubre. */
  hidden?: boolean;
}

export interface Member {
  cls: ClassId;
  lvl: number;
  attrs: Attrs;
  traits: readonly Trait[];
  /** Moral 0–100: animado rinde más, desanimado rinde menos. */
  morale?: number;
  /** Equipo de la armería: suma a cada habilidad. */
  gear?: Partial<Record<SkillId, number>>;
  /** Efecto del objeto equipado (ver Item['perk']). */
  perk?: string;
}

export interface Challenge {
  skill: SkillId;
  diff: number;
}

export const SKILLS: readonly SkillId[] = ['Combate', 'Trampas', 'Arcano', 'Supervivencia'];

/** Peso de [Fuerza, Destreza, Mente] en cada habilidad, por clase. */
const WEIGHTS: Record<ClassId, Record<SkillId, readonly [number, number, number]>> = {
  guerrero: {
    Combate: [2, 1, 0],
    Trampas: [0, 1, 0],
    Arcano: [0, 0, 0.5],
    Supervivencia: [1, 0.5, 0],
  },
  picaro: {
    Combate: [1, 1, 0],
    Trampas: [0, 2, 1],
    Arcano: [0, 0, 0.5],
    Supervivencia: [0, 1, 0.5],
  },
  mago: { Combate: [0, 0, 1], Trampas: [0, 0, 1], Arcano: [0, 0, 2], Supervivencia: [0, 0, 0.5] },
  clerigo: {
    Combate: [1, 0, 0.5],
    Trampas: [0, 0, 0.5],
    Arcano: [0, 0, 1.5],
    Supervivencia: [0.5, 0, 0.5],
  },
  explorador: {
    Combate: [1, 1, 0],
    Trampas: [0, 1, 0],
    Arcano: [0, 0, 0.5],
    Supervivencia: [1, 1, 1],
  },
};

/** Lo que cada rasgo suma o resta a atributos y habilidades. */
const TRAIT_EFFECTS: Partial<
  Record<TraitId, { attrs?: Partial<Attrs>; skills?: Partial<Record<SkillId, number>> }>
> = {
  valiente: { skills: { Combate: 2 } },
  cobarde: { skills: { Combate: -2 } },
  bebedor: { attrs: { D: -1 } },
  supersticioso: { skills: { Arcano: -2 } },
  tuerto: { attrs: { D: -1 }, skills: { Combate: 1 } },
  cojo: { skills: { Supervivencia: -2 } },
  cortado: { skills: { Combate: 1 } },
  curtido: { skills: { Supervivencia: 2 } },
};

export type MoraleBand = 'animado' | 'normal' | 'desanimado' | 'harto';

/** Umbrales de moral: por encima de ANIMADO rinde +1, por debajo de DESANIMADO −1. */
export const MORALE_HIGH = 75;
export const MORALE_LOW = 35;
export const MORALE_QUIT = 15;

export function moraleBand(morale: number): MoraleBand {
  if (morale >= MORALE_HIGH) return 'animado';
  if (morale >= MORALE_LOW) return 'normal';
  if (morale >= MORALE_QUIT) return 'desanimado';
  return 'harto';
}

/** Lo que la moral suma o resta a cada habilidad. */
export function moraleMod(m: Member): number {
  if (m.morale === undefined) return 0;
  return m.morale >= MORALE_HIGH ? 1 : m.morale < MORALE_LOW ? -1 : 0;
}

/** El gafe empeora todas las tiradas del grupo. */
const JINX = 0.05;

export const RISK_LABELS = ['Pan comido', 'Probable', 'Arriesgado', 'Suicida'] as const;
export type RiskLevel = 0 | 1 | 2 | 3;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const known = (m: Member, all: boolean) => m.traits.filter((t) => all || !t.hidden);

/** Atributo con los rasgos aplicados. Por defecto solo cuentan los rasgos conocidos. */
export function attr(m: Member, k: AttrId, includeHidden = false): number {
  let v = m.attrs[k];
  for (const t of known(m, includeHidden)) v += TRAIT_EFFECTS[t.id]?.attrs?.[k] ?? 0;
  return Math.max(0, v);
}

/** Valor de una habilidad: atributos ponderados por clase, más nivel y rasgos. */
export function skill(m: Member, s: SkillId, includeHidden = false): number {
  const [wf, wd, wm] = WEIGHTS[m.cls][s];
  let v =
    Math.round(
      (wf * attr(m, 'F', includeHidden) +
        wd * attr(m, 'D', includeHidden) +
        wm * attr(m, 'M', includeHidden)) /
        2,
    ) +
    (m.lvl - 1) +
    moraleMod(m) +
    (m.gear?.[s] ?? 0);
  for (const t of known(m, includeHidden)) v += TRAIT_EFFECTS[t.id]?.skills?.[s] ?? 0;
  return Math.max(0, v);
}

/** Probabilidad de superar un desafío con la fuerza sumada del grupo. */
export function chance(power: number, diff: number): number {
  return clamp(0.5 + (power - diff) * 0.09, 0.05, 0.95);
}

export interface EstimateRow extends Challenge {
  power: number;
  p: number;
}

export interface Estimate {
  rows: EstimateRow[];
  /** Probabilidad de superar todos los desafíos. */
  total: number;
  level: RiskLevel;
}

/** Lo que el jugador puede saber antes de enviar: fuerza por desafío y riesgo global. */
export function estimate(challenges: readonly Challenge[], party: readonly Member[]): Estimate {
  const jinxed = party.some((m) => m.traits.some((t) => t.id === 'gafe' && !t.hidden));
  const jinx = jinxed && !party.some((m) => m.perk === 'ward') ? JINX : 0;
  const rows = challenges.map((c) => {
    const power = party.reduce((sum, m) => sum + skill(m, c.skill), 0);
    const p = party.length ? clamp(chance(power, c.diff) - jinx, 0.03, 0.95) : 0;
    return { ...c, power, p };
  });
  const total = party.length ? rows.reduce((acc, r) => acc * r.p, 1) : 0;
  const level: RiskLevel = total >= 0.75 ? 0 : total >= 0.5 ? 1 : total >= 0.25 ? 2 : 3;
  return { rows, total, level };
}
