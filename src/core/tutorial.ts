/**
 * Tutorial guiado (fase 2a): pasos que hay que cumplir, del primer día al primer pago a Merlo
 * (día 7). Mientras dura, el reloj se para (solo avanza con los saltos) y no hay incidentes ni
 * rumores sueltos: el primero de cada uno llega preparado. Se puede saltar entero.
 */
import { INCIDENTS } from '../data/incidents';
import { GEAR } from '../data/items';
import { DAY_SECONDS, DUSK, SCHEDULE } from './balance';
import type { Building, DawnEvent, GameState, Hero, Quest } from './model';
import { SKILLS, skill } from './party';
import type { Rng } from './rng';
import { upgradeCostOf } from './rooms';
import { workerTitleMsg } from './workers';
import { OBRAS, OBRAS_TIPS } from './tutorialObras';
import type { Trade } from '../data/workers';
import { msg, t, tl } from '../textos';

/**
 * El botón de la nota: «Seguir» en las que solo cuentan algo, y los saltos de tiempo. Las que
 * piden hacer algo no tienen botón: se pasan haciéndolo.
 */
export type TutorialButton = 'seguir' | 'esperar' | 'pago';

/** Saltos de tiempo: hasta que vuelva el grupo, una noche o hasta el pago. */
export type TutorialSkip = 'vuelta' | 'noche' | 'pago';

export interface TutorialStep {
  id: string;
  /** Lo que dice la nota del cuaderno del tío. */
  text: (s: GameState) => string;
  /** Sala (id) o sitio de la escena al que mirar al empezar el paso. */
  focus?: (s: GameState) => string | null;
  /** Hecho: se pasa al siguiente. */
  done?: (s: GameState) => boolean;
  button?: TutorialButton;
  /** Se salta solo si no tiene sentido (nadie herido, nada que equipar…). */
  skip?: (s: GameState) => boolean;
  /** Al llegar a este paso (prepara el incidente, el rumor o el dinero que falta). */
  enter?: (s: GameState) => string | null;
  /**
   * Segundos de respiro antes del paso: sin nota ni foco, para mirar y trastear; lo que el paso
   * prepara (el incidente, el rumor) llega después. Ver `tutorialWait`.
   */
  pause?: number;
  /** Paso libre: sin foco, y la nota se puede plegar en una esquina (`short`, su resumen). */
  free?: boolean;
  short?: (s: GameState) => string;
  /** El reloj corre en este paso (lo de fuera pasa solo, como en la partida). */
  clock?: boolean;
  /** Al empezar, la cámara se acerca a la sala (`focus`). */
  zoom?: boolean;
}

/** Estado del tutorial en la partida (sin él, no hay tutorial: partidas viejas o saltado). */
export interface Tutorial {
  step: number;
  /** El encargo a la medida de los dos primeros héroes. */
  quest?: string;
  /** Ya se ha leído la carta del tío (la primera pantalla). */
  letter?: boolean;
  moved?: boolean;
  named?: boolean;
  /** El paso en curso aún no ha empezado: es el respiro de antes (`pause`). */
  wait?: boolean;
  /** Qué tutorial: el primero (sin nada) o el de las obras, al pagar la deuda. */
  track?: 'obras';
  /** Obras: el borrador del modo obras tal como queda (null: el modo obras está cerrado). */
  plan?: Building | null;
}

const roomOf = (s: GameState, type: string) => s.building.rooms.find((r) => r.type === type);
const roomId = (type: string) => (s: GameState) => roomOf(s, type)?.id ?? null;
const alive = (s: GameState) =>
  s.heroes.filter((h) => h.status !== 'muerto' && h.status !== 'desaparecido');
const first = (name: string) => name.split(' ')[0]!;
const firstPay = SCHEDULE[0]!;

/** Sueldos de la semana (como `salaries` en `game.ts`, que importa este módulo). */
const wages = (s: GameState) =>
  alive(s).reduce((a, h) => a + h.salary, 0) + s.workers.reduce((a, w) => a + w.salary, 0);
/** Lo que pide Merlo el primer día de pago: la deuda y los sueldos. */
export const firstDue = (s: GameState) => firstPay.amount + wages(s);
/** Ya hay en la caja para el pago: se puede saltar hasta él sin miedo. */
export const payReady = (s: GameState) => s.gold >= firstDue(s);

/** Lo que cuesta arreglar la enfermería rota (o 0 si no hace falta). */
const enfCost = (s: GameState) => {
  const r = roomOf(s, 'enfermeria');
  return r && r.level === 0 ? (upgradeCostOf(r) ?? 0) : 0;
};

/** El encargo del tutorial que toca mandar ahora: el primero, o el del rumor. */
export const tutorialQuest = (s: GameState): string | null => {
  const st = tutorialStep(s)?.id;
  if (st === 'tablon') return s.tutorial?.quest ?? null;
  if (st === 'mandar') return s.quests.find((q) => q.rumor)?.id ?? null;
  return null;
};

/** Un héroe en casa, para echar una mano (el último contratado). */
const homeHero = (s: GameState) => [...s.heroes].reverse().find((h) => h.status === 'ok');

/** Dónde rinde cada oficio (para decirlo al soltar a un trabajador en la cocina). */
const tradePlace = (tr: Trade) => msg(`tutorial.oficio_sitio.${tr}`);

/**
 * Lo que el tutorial no deja hacer ahora, y por qué (null = adelante). En «mover» se pide un
 * héroe: soltar en la cocina a uno del pueblo lo quitaría de lo suyo.
 */
export function tutorialVeto(s: GameState, who: string, room: string | null): string | null {
  if (tutorialStep(s)?.id !== 'mover' || s.tutorial?.wait) return null;
  const w = s.workers.find((x) => x.id === who);
  const r = room ? s.building.rooms.find((x) => x.id === room) : null;
  if (!w || r?.type !== 'cocina' || w.room === room || w.trade === 'cocina') return null;
  const h = homeHero(s);
  return t('tutorial.veto_cocina', {
    quien: workerTitleMsg(w),
    sitio: tradePlace(w.trade),
    heroe: h ? first(h.name) : '',
    hay: !!h,
  });
}

/** El héroe al que dar el equipo: el primero en casa. */
export const tutorialHero = (s: GameState): string | null =>
  s.heroes.find((h) => h.status === 'ok' || h.status === 'herido')?.id ?? null;

/**
 * La carta que deja el tío: es lo primero que se lee al empezar (en lugar de la carta del día 1).
 */
export const LETTER = {
  head: t('tutorial.carta.cabecera'),
  body: tl('tutorial.carta.cuerpo'),
  sign: t('tutorial.carta.firma'),
};

export const STEPS: readonly TutorialStep[] = [
  {
    id: 'casa',
    text: () => t('tutorial.casa.texto'),
    focus: roomId('salon'),
    button: 'seguir',
  },
  {
    id: 'dinero',
    text: () => t('tutorial.dinero.texto'),
    focus: roomId('salon'),
    button: 'seguir',
  },
  {
    id: 'tablon',
    text: (s) => {
      const q = s.quests.find((x) => x.id === s.tutorial?.quest);
      const names = alive(s).map((h) => first(h.name));
      return t('tutorial.tablon.texto', {
        titulo: q?.title ?? msg('tutorial.tablon.el_primero'),
        quien: names,
      });
    },
    focus: roomId('salon'),
    done: (s) => s.missions.length > 0,
  },
  {
    id: 'barra',
    text: () => t('tutorial.barra.texto'),
    focus: () => 'barra',
    // Antes, ver salir al grupo por la puerta.
    pause: 10,
    done: (s) => alive(s).length > 2,
    enter: (s) => {
      const fee = Math.min(...s.candidates.map((c) => c.fee));
      if (!Number.isFinite(fee) || s.gold >= fee) return null;
      const gift = fee - s.gold;
      s.gold += gift;
      return t('tutorial.barra.regalo', { n: gift });
    },
  },
  {
    id: 'nombre',
    text: () => t('tutorial.nombre.texto'),
    done: (s) => !!s.tutorial?.named,
  },
  {
    id: 'enfermeria',
    text: () => t('tutorial.enfermeria.texto'),
    focus: roomId('enfermeria'),
    pause: 6,
    done: (s) => {
      const r = roomOf(s, 'enfermeria');
      return !r || r.level > 0 || !!r.works;
    },
    enter: (s) => {
      const cost = enfCost(s);
      if (!cost || s.gold >= cost) return null;
      const gift = cost - s.gold;
      s.gold += gift;
      return t('tutorial.enfermeria.regalo', { n: gift });
    },
  },
  {
    id: 'mover',
    text: (s) => {
      const h = homeHero(s);
      return t('tutorial.mover.texto', {
        heroe: h ? first(h.name) : msg('tutorial.mover.un_heroe'),
        sexo: h?.sex ?? 'm',
      });
    },
    focus: roomId('cocina'),
    pause: 8,
    done: (s) => {
      const r = roomOf(s, 'cocina');
      return !r || s.heroes.some((h) => h.job === r.id);
    },
    skip: (s) => !homeHero(s),
  },
  {
    id: 'esperar',
    text: () => t('tutorial.esperar.texto'),
    short: () => t('tutorial.esperar.corto'),
    done: (s) => s.reports.length > 0,
    button: 'esperar',
    pause: 6,
    free: true,
    clock: true,
  },
  {
    id: 'informe',
    text: () => t('tutorial.informe.texto'),
    done: (s) => s.reports.some((r) => r.read),
  },
  {
    id: 'equipo',
    text: (s) => {
      const it = s.inventory.find((i) => i.kind !== 'tesoro');
      const h = s.heroes.find((x) => x.id === tutorialHero(s));
      return t('tutorial.equipo.texto', {
        objeto: it?.name ?? '',
        hay: !!it,
        heroe: h ? first(h.name) : msg('tutorial.equipo.alguien'),
      });
    },
    skip: (s) => !s.inventory.some((i) => i.kind !== 'tesoro') || !tutorialHero(s),
    done: (s) => !s.inventory.some((i) => i.kind !== 'tesoro'),
  },
  {
    id: 'herido',
    text: (s) => {
      const h = alive(s).find((x) => x.status === 'herido');
      return t('tutorial.herido.texto', {
        heroe: h ? first(h.name) : msg('tutorial.herido.alguien'),
        sexo: h?.sex ?? 'm',
      });
    },
    skip: (s) => !s.heroes.some((h) => h.status === 'herido'),
    button: 'seguir',
  },
  {
    id: 'ratas',
    text: () => t('tutorial.ratas.texto'),
    focus: roomId('cocina'),
    // Un rato de calma antes de que salten las ratas.
    pause: 15,
    zoom: true,
    done: (s) => !(s.incidents ?? []).length,
    enter: (s) => {
      const r = roomOf(s, 'cocina');
      if (!r) return null;
      const c = s.clock ?? 0;
      s.incidents = [
        {
          id: `inc${s.uid++}`,
          kind: 'ratas',
          room: r.id,
          from: c,
          until: c + DAY_SECONDS,
          taps: INCIDENTS.ratas.taps,
        },
      ];
      return null;
    },
  },
  {
    id: 'rumor',
    text: () => t('tutorial.rumor.texto'),
    focus: roomId('salon'),
    pause: 15,
    done: (s) => !s.rumor,
    enter: (s) => {
      if (!roomOf(s, 'salon')) return null;
      const c = s.clock ?? 0;
      s.rumor = {
        id: `ru${s.uid++}`,
        text: msg('rumores.rumores.0'),
        from: c,
        until: c + DAY_SECONDS,
      };
      return null;
    },
  },
  {
    id: 'mandar',
    text: () => t('tutorial.mandar.texto'),
    skip: (s) => !s.quests.some((q) => q.rumor) || !s.heroes.some((h) => h.status === 'ok'),
    done: (s) => s.missions.some((m) => m.quest.rumor),
    enter: (s) => {
      // El del tutorial sale casi siempre, aunque vaya uno solo (el que esté en casa y peor).
      const q = s.quests.find((x) => x.rumor);
      const home = s.heroes.filter((h) => h.status === 'ok');
      if (!q || !home.length) return null;
      const weakest = home.map((h) => [h]).sort((a, b) => topPower(a) - topPower(b))[0]!;
      q.challenges = sureChallenge(weakest);
      q.danger = 0;
      q.dangerHidden = undefined;
      q.twist = undefined;
      return null;
    },
  },
  {
    id: 'objetivos',
    text: () => t('tutorial.objetivos.texto'),
    pause: 10,
    button: 'seguir',
  },
  {
    id: 'pago',
    text: (s) => {
      const head = msg('tutorial.pago.cabeza', {
        dia: firstPay.day,
        cuota: firstPay.amount,
        sueldos: wages(s),
      });
      if (payReady(s)) return t('tutorial.pago.listo', { cabeza: head });
      return t('tutorial.pago.falta', {
        cabeza: head,
        n: firstDue(s) - s.gold,
        noches: firstPay.day - s.day,
      });
    },
    short: (s) =>
      payReady(s)
        ? t('tutorial.pago.corto_listo', { dia: firstPay.day })
        : t('tutorial.pago.corto_falta', { dia: firstPay.day, n: firstDue(s) - s.gold }),
    pause: 8,
    free: true,
    done: (s) => s.paid > 0 || !!s.over,
    button: 'pago',
  },
  {
    id: 'fin',
    text: () => t('tutorial.fin.texto'),
    button: 'seguir',
  },
];

/** Los pasos del tutorial en marcha: el primero o el de las obras. */
const stepsOf = (s: GameState): readonly TutorialStep[] =>
  s.tutorial?.track === 'obras' ? OBRAS : STEPS;

/** Si el tutorial está en marcha (y en qué paso). */
export const tutorialStep = (s: GameState): TutorialStep | null =>
  s.tutorial && !s.over ? (stepsOf(s)[s.tutorial.step] ?? null) : null;
/** El tutorial de obras está en marcha. */
export const obrasOn = (s: GameState) => s.tutorial?.track === 'obras' && tutorialOn(s);

/**
 * Al pagar la deuda empieza el tutorial de obras, si se jugó con el primero (aunque se saltara)
 * y no se han apagado los consejos. Va después de la carta de la apertura (con su respiro).
 */
export function startObras(s: GameState): void {
  if (!s.tutorial || s.tutorial.track || s.tips?.includes('*')) return;
  s.tutorial = { step: 0, track: 'obras', letter: true, wait: true };
}
export const tutorialOn = (s: GameState) => !!tutorialStep(s);
/** El reloj está parado por el tutorial (en los pasos con `clock` corre, salvo en el respiro). */
export const tutorialFrozen = (s: GameState) => {
  const st = tutorialStep(s);
  return !!st && (!st.clock || !!s.tutorial?.wait);
};

/** Las notas del tío que el tutorial ya ha contado (no se repiten al acabar). */
export const TUTORIAL_TIPS = [
  'tablon',
  'noche',
  'carta',
  'barra',
  'pago',
  'trabajo',
  'gremio',
  'equipo',
];

/**
 * Avanza el tutorial mientras el paso actual esté hecho (o no tenga sentido), y prepara el
 * siguiente. Muta `s` (una copia). Devuelve lo que haya que avisar.
 */
export function advanceTutorial(s: GameState, ack = false): string[] {
  if (s.tutorial?.track === 'obras') return advanceObras(s, ack);
  const out: string[] = [];
  let first = true;
  for (let guard = 0; guard < STEPS.length + 1; guard++) {
    const st = tutorialStep(s);
    // En el respiro de antes del paso, el paso aún no cuenta.
    if (!st || s.tutorial!.wait) break;
    const isDone = (first && ack) || st.skip?.(s) || st.done?.(s);
    first = false;
    if (!isDone) break;
    s.tutorial = { ...s.tutorial!, step: s.tutorial!.step + 1 };
    const next = tutorialStep(s);
    if (!next) {
      finishTutorial(s);
      break;
    }
    if (next.skip?.(s)) continue;
    if (next.pause) {
      s.tutorial = { ...s.tutorial, wait: true };
      break;
    }
    const msg = next.enter?.(s);
    if (msg) out.push(msg);
  }
  return out;
}

/**
 * Obras: el paso en curso es el primero sin hacer (se vuelve atrás si se deshace una obra o se
 * sale del modo obras sin pagar). El último solo se pasa con su botón.
 */
function advanceObras(s: GameState, ack: boolean): string[] {
  const t = s.tutorial!;
  if (t.wait || s.over) return [];
  const last = OBRAS.length - 1;
  if (ack && t.step === last) {
    finishTutorial(s);
    return [];
  }
  const i = OBRAS.findIndex((st, k) => k === last || !st.done?.(s));
  if (i !== t.step) s.tutorial = { ...t, step: i };
  return [];
}

/** Segundos de respiro que quedan antes del paso en curso (0: ya ha empezado). */
export const tutorialWait = (s: GameState): number =>
  s.tutorial?.wait ? (tutorialStep(s)?.pause ?? 0) : 0;

/** Acaba el respiro: empieza el paso (con lo que prepara) y, si ya está hecho, se pasa. */
export function startStep(s: GameState): string[] {
  if (!s.tutorial?.wait) return [];
  s.tutorial = { ...s.tutorial, wait: undefined };
  const msg = tutorialStep(s)?.enter?.(s);
  return [...(msg ? [msg] : []), ...advanceTutorial(s)];
}

/** Acaba el tutorial (o se salta): fuera el paso y las notas del tío que ya ha contado. */
export function finishTutorial(s: GameState): void {
  const obras = s.tutorial?.track === 'obras';
  s.tutorial = { ...(s.tutorial ?? { step: 0 }), step: stepsOf(s).length, plan: undefined };
  s.tips = [...new Set([...(s.tips ?? []), ...(obras ? OBRAS_TIPS : TUTORIAL_TIPS)])];
}

/** El encargo del primer día, a la medida de los dos héroes: corto, sin peligro y con equipo. */
/** Fuerza de un grupo en lo que mejor se le da. */
const powerIn = (heroes: readonly Hero[], k: (typeof SKILLS)[number]) =>
  heroes.reduce((a, h) => a + skill(h, k), 0);
const topPower = (heroes: readonly Hero[]) => Math.max(...SKILLS.map((k) => powerIn(heroes, k)));

/** Un solo desafío, en lo que mejor se le da al grupo, que casi siempre sale (≈ 86 %). */
function sureChallenge(heroes: readonly Hero[]): Quest['challenges'] {
  const best = [...SKILLS].sort((a, b) => powerIn(heroes, b) - powerIn(heroes, a))[0]!;
  return [{ skill: best, diff: Math.max(1, Math.min(4, powerIn(heroes, best) - 4)) }];
}

export function easyQuest(q: Quest, rng: Rng, heroes: readonly Hero[]): Quest {
  const base = rng.pick(GEAR.filter((g) => g.rarity === 0));
  return {
    ...q,
    slots: 2,
    days: 1,
    danger: 0,
    dangerHidden: undefined,
    twist: undefined,
    expires: 5,
    reward: 60,
    challenges: sureChallenge(heroes),
    item: { id: q.item?.id ?? `${q.id}-i`, ...base },
  };
}

/**
 * Saltar el tiempo desde el tutorial: noche tras noche hasta que vuelva el grupo, una noche o
 * hasta el pago (este, solo con la caja lista). Si la noche del pago la caja no llega, el tío
 * pone lo que falta (el tutorial no acaba en derrota). Junta la carta del amanecer por días,
 * como la de «Mientras no estabas».
 */
export function skipTime(
  s0: GameState,
  until: TutorialSkip,
  night: (s: GameState) => GameState,
): GameState {
  if (until === 'pago' && !payReady(s0)) return s0;
  let s = s0;
  const events: DawnEvent[] = [];
  const start = s.day;
  for (let i = 0; i < 10; i++) {
    const t = structuredClone(s);
    t.clock = DUSK * DAY_SECONDS;
    if (t.day + 1 === firstPay.day && tutorialStep(t)?.id === 'pago') {
      const due = firstDue(t);
      if (t.gold < due) {
        events.push({
          t: msg('tutorial.pago.tio', { n: due - t.gold }),
          k: 'good',
        });
        t.gold = due;
      }
    }
    s = night(t);
    const many = s.day - start > 1 || i > 0;
    if (many) events.push({ t: msg('ausencia.dia', { dia: s.day }), head: true });
    events.push(...s.dawn);
    if (s.over) break;
    if (until === 'vuelta' && !s.missions.length) break;
    if (until === 'noche' || (until === 'pago' && s.paid > 0)) break;
  }
  // Con más de un día, el primero también lleva su encabezado.
  if (events.some((e) => e.head) && !events[0]?.head)
    events.unshift({ t: msg('ausencia.dia', { dia: start + 1 }), head: true });
  return { ...s, dawn: events };
}
