import type { Danger, Facilities, Hero, Outcome } from '../core/model';
import { CRAFT_QUALITY, TRAINING_XP, returnChance, salonAppeal } from '../core/balance';
import type { ClassId, MoraleBand } from '../core/party';
import { t, tl } from '../textos';

/** Textos de la interfaz que dependen de los datos del juego. */

/** «común 45 %, bueno 38 %, raro 17 %»: lo que sale de un taller de ese nivel (con artesano). */
export function qualityText(level: number): string {
  const [c, b, r] = CRAFT_QUALITY[level] ?? CRAFT_QUALITY.at(-1)!;
  const pct = (x: number) => Math.round(100 * x);
  return t('etiquetas.calidad', { c: pct(c), b: pct(b), r: pct(r) });
}

export const CLASS_NAMES: Record<ClassId, { m: string; f: string }> = {
  guerrero: { m: t('etiquetas.clases.guerrero.m'), f: t('etiquetas.clases.guerrero.f') },
  picaro: { m: t('etiquetas.clases.picaro.m'), f: t('etiquetas.clases.picaro.f') },
  mago: { m: t('etiquetas.clases.mago.m'), f: t('etiquetas.clases.mago.f') },
  clerigo: { m: t('etiquetas.clases.clerigo.m'), f: t('etiquetas.clases.clerigo.f') },
  explorador: { m: t('etiquetas.clases.explorador.m'), f: t('etiquetas.clases.explorador.f') },
};

export const DANGER_LABELS = tl('etiquetas.peligro');
export const dangerClass = (d: Danger, hidden?: boolean) =>
  hidden ? 'x' : ['bajo', 'medio', 'alto', 'letal'][d]!;
export const dangerLabel = (d: Danger, hidden?: boolean) =>
  hidden ? t('etiquetas.peligro_oculto') : DANGER_LABELS[d]!.toLowerCase();

/** Estado visible de un héroe (los candidatos no son del gremio todavía). */
export type ViewStatus = Hero['status'] | 'candidato';

export function statusLabel(h: Hero, candidate = false): string {
  if (candidate) return t('etiquetas.estado.candidato');
  return t(`etiquetas.estado.${h.status}`, { sexo: h.sex, dias: h.days });
}

/** El nombre de una habilidad (los ids están en español: «Combate», «Arcano»…). */
export const skillName = (k: string) => t(`etiquetas.habilidades.${k}`);
/** El nombre de un atributo (F, D, M). */
export const attrName = (a: string) => t(`etiquetas.atributos.${a}`);

/** Clave de cada resultado (`etiquetas.resultado.<clave>`, `relatos.cierres.<clave>`…). */
export const OUTCOME_KEY: Record<Outcome, string> = {
  'Éxito brillante': 'brillante',
  Éxito: 'exito',
  'Éxito parcial': 'parcial',
  Fracaso: 'fracaso',
  Desastre: 'desastre',
};
export const outcomeKey = (o: Outcome) => OUTCOME_KEY[o];
/** El resultado, escrito. */
export const outcomeLabel = (o: Outcome) => t(`etiquetas.resultado.${OUTCOME_KEY[o]}`);

export const OUTCOME_CLASS: Record<Outcome, string> = {
  'Éxito brillante': 'win',
  Éxito: 'win',
  'Éxito parcial': 'mid',
  Fracaso: 'lose',
  Desastre: 'lose',
};

export const FACILITY_INFO: Record<
  keyof Facilities,
  { name: string; room: string; levels: readonly string[]; effect: (l: number) => string }
> = {
  dorm: {
    name: t('etiquetas.mejoras.dorm.nombre'),
    room: 'dormitorios',
    levels: tl('etiquetas.mejoras.dorm.niveles'),
    // Por hueco: el tope de héroes es la suma de las camas de todos los dormitorios (y veteranos).
    effect: (l) => t('etiquetas.mejoras.dorm.efecto', { camas: Math.min(l + 1, 4), lujo: l >= 4 }),
  },
  enf: {
    name: t('etiquetas.mejoras.enf.nombre'),
    room: 'enfermeria',
    levels: tl('etiquetas.mejoras.enf.niveles'),
    effect: (l) =>
      l === 0
        ? t('etiquetas.mejoras.enf.efecto_0')
        : t('etiquetas.mejoras.enf.efecto', { veces: l + 1 }),
  },
  tab: {
    name: t('etiquetas.mejoras.tab.nombre'),
    room: 'sala',
    levels: tl('etiquetas.mejoras.tab.niveles'),
    effect: (l) =>
      l === 0
        ? t('etiquetas.mejoras.tab.efecto_0')
        : t('etiquetas.mejoras.tab.efecto', {
            atractivo: salonAppeal(l),
            encargos: l <= 2,
            candidatos: l >= 2,
          }),
  },
  mapas: {
    name: t('etiquetas.mejoras.mapas.nombre'),
    room: 'despacho',
    levels: tl('etiquetas.mejoras.mapas.niveles'),
    effect: (l) =>
      l === 0
        ? t('etiquetas.sin_efecto')
        : t('etiquetas.mejoras.mapas.efecto', { n: l, todos: l >= 2 }),
  },
  arm: {
    name: t('etiquetas.mejoras.arm.nombre'),
    room: 'armeria',
    levels: tl('etiquetas.mejoras.arm.niveles'),
    effect: (l) => tl('etiquetas.mejoras.arm.efecto')[Math.min(l, 3)]!,
  },
  cap: {
    name: t('etiquetas.mejoras.cap.nombre'),
    room: 'capilla',
    levels: tl('etiquetas.mejoras.cap.niveles'),
    effect: (l) =>
      l === 0
        ? t('etiquetas.sin_efecto')
        : t('etiquetas.mejoras.cap.efecto', {
            moral: 2 * l,
            vuelve: Math.round(100 * returnChance(l)),
            sin: Math.round(100 * returnChance(0)),
            mitad: l >= 2,
          }),
  },
  forja: {
    name: t('etiquetas.mejoras.forja.nombre'),
    room: 'forja',
    levels: tl('etiquetas.mejoras.forja.niveles'),
    effect: (l) =>
      l === 0
        ? t('etiquetas.sin_efecto')
        : t('etiquetas.mejoras.forja.efecto', { calidad: qualityText(l) }),
  },
  establo: {
    name: t('etiquetas.mejoras.establo.nombre'),
    room: 'establo',
    levels: tl('etiquetas.mejoras.establo.niveles'),
    effect: (l) =>
      l === 0
        ? t('etiquetas.sin_efecto')
        : t('etiquetas.mejoras.establo.efecto', { carro: l >= 2 }),
  },
  patio: {
    name: t('etiquetas.mejoras.patio.nombre'),
    room: 'patio-entreno',
    levels: tl('etiquetas.mejoras.patio.niveles'),
    effect: (l) =>
      l === 0
        ? t('etiquetas.sin_efecto')
        : t('etiquetas.mejoras.patio.efecto', { xp: TRAINING_XP[l] }),
  },
  empal: {
    name: t('etiquetas.mejoras.empal.nombre'),
    room: 'empalizada',
    levels: tl('etiquetas.mejoras.empal.niveles'),
    effect: (l) =>
      l === 0
        ? t('etiquetas.sin_efecto')
        : t('etiquetas.mejoras.empal.efecto', { defensa: [0, 5, 10][l] }),
  },
  torre: {
    name: t('etiquetas.mejoras.torre.nombre'),
    room: 'torre',
    levels: tl('etiquetas.mejoras.torre.niveles'),
    effect: (l) =>
      l === 0
        ? t('etiquetas.sin_efecto')
        : t('etiquetas.mejoras.torre.efecto', { campana: l >= 2, almenara: l >= 3 }),
  },
  vet: {
    name: t('etiquetas.mejoras.vet.nombre'),
    room: 'veteranos',
    levels: tl('etiquetas.mejoras.vet.niveles'),
    effect: (l) =>
      l === 0
        ? t('etiquetas.sin_efecto')
        : t('etiquetas.mejoras.vet.efecto', {
            camas: 2 * Math.min(l, 2),
            moral: [0, 4, 8, 12][l],
            balcon: l >= 2,
          }),
  },
};

/** Cómo se enseña cada tramo de moral. */
export const MORALE_INFO: Record<
  MoraleBand,
  { label: { m: string; f: string }; short: string; desc: string }
> = {
  animado: {
    label: {
      m: t('etiquetas.moral.animado.etiqueta.m'),
      f: t('etiquetas.moral.animado.etiqueta.f'),
    },
    short: t('etiquetas.moral.animado.corto'),
    desc: t('etiquetas.moral.animado.desc'),
  },
  normal: {
    label: { m: t('etiquetas.moral.normal.etiqueta.m'), f: t('etiquetas.moral.normal.etiqueta.f') },
    short: '',
    desc: t('etiquetas.moral.normal.desc'),
  },
  desanimado: {
    label: {
      m: t('etiquetas.moral.desanimado.etiqueta.m'),
      f: t('etiquetas.moral.desanimado.etiqueta.f'),
    },
    short: t('etiquetas.moral.desanimado.corto'),
    desc: t('etiquetas.moral.desanimado.desc'),
  },
  harto: {
    label: { m: t('etiquetas.moral.harto.etiqueta.m'), f: t('etiquetas.moral.harto.etiqueta.f') },
    short: t('etiquetas.moral.harto.corto'),
    desc: t('etiquetas.moral.harto.desc'),
  },
};
