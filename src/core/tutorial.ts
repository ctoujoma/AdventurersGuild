/**
 * Tutorial guiado (fase 2a): pasos que hay que cumplir, del primer día al primer pago a Merlo
 * (día 7). Mientras dura, el reloj se para (solo avanza con los saltos) y no hay incidentes ni
 * rumores sueltos: el primero de cada uno llega preparado. Se puede saltar entero.
 */
import { INCIDENTS } from '../data/incidents';
import { GEAR } from '../data/items';
import { DAY_SECONDS, DUSK, SCHEDULE } from './balance';
import type { DawnEvent, GameState, Hero, Quest } from './model';
import { SKILLS, skill } from './party';
import type { Rng } from './rng';
import { upgradeCostOf } from './rooms';

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

/** El héroe al que dar el equipo: el primero en casa. */
export const tutorialHero = (s: GameState): string | null =>
  s.heroes.find((h) => h.status === 'ok' || h.status === 'herido')?.id ?? null;

/**
 * La carta que deja el tío: es lo primero que se lee al empezar (en lugar de la carta del día 1).
 */
export const LETTER = {
  head: 'Hondovado, a la entrada del invierno',
  body: [
    'Sobrino:',
    'Si te llega esta carta, es que ya no estoy y El Jarro Partido es tuyo. Con la taberna te dejo dos aventureros que no cobran mucho, al gato y mil monedas de deuda con Merlo, el prestamista, que cobra cada siete días y no perdona ni una.',
    'Debajo de la barra tienes mi cuaderno. Lo fui escribiendo para quien viniera detrás: léelo con calma y haz lo que pone, que a mí me costó años aprenderlo.',
  ],
  sign: 'Fausto',
};

export const STEPS: readonly TutorialStep[] = [
  {
    id: 'casa',
    text: () =>
      'Esto es El Jarro Partido, de arriba abajo. Cada hueco es una sala y cada sala hace lo suyo: en el salón se sirve, la cocina saca las raciones, la bodega da la cerveza y los héroes duermen en los dormitorios. Arrastra para mirarla entera.',
    focus: roomId('salon'),
    button: 'seguir',
  },
  {
    id: 'dinero',
    text: () =>
      'El dinero entra por dos puertas. Una es la caja del salón: lo que gastan los clientes va llegando durante el día, y más si hay raciones y cerveza. La otra son los encargos del tablón, que pagan mucho más pero piden héroes y días fuera. Con las dos se paga a Merlo.',
    focus: roomId('salon'),
    button: 'seguir',
  },
  {
    id: 'tablon',
    text: (s) => {
      const q = s.quests.find((x) => x.id === s.tutorial?.quest);
      const names = alive(s).map((h) => first(h.name));
      return `Lo primero, el tablón. De los encargos come esta casa. Hay uno fácil, «${q?.title ?? 'el primero'}»: manda a ${names.join(' y ')}, que saben hacerlo.`;
    },
    focus: roomId('salon'),
    done: (s) => s.missions.length > 0,
  },
  {
    id: 'barra',
    text: () =>
      'Con dos espadas no se llega lejos. En la barra siempre hay alguien buscando trabajo: contrata a uno. La prima se paga una vez; el sueldo, cada semana.',
    focus: () => 'barra',
    // Antes, ver salir al grupo por la puerta.
    pause: 4,
    done: (s) => alive(s).length > 2,
    enter: (s) => {
      const fee = Math.min(...s.candidates.map((c) => c.fee));
      if (!Number.isFinite(fee) || s.gold >= fee) return null;
      const gift = fee - s.gold;
      s.gold += gift;
      return `En la caja de puros de la barra había ${gift} monedas: «Para la primera prima».`;
    },
  },
  {
    id: 'nombre',
    text: () =>
      'Los aventureros llegan con el nombre que les puso su madre, y a veces no les pega. Abre la ficha del nuevo y toca su nombre: déjalo o cámbialo, pero que sea de la casa.',
    done: (s) => !!s.tutorial?.named,
  },
  {
    id: 'enfermeria',
    text: () =>
      'La enfermería se vino abajo el invierno pasado. Arréglala antes de que alguien vuelva con una flecha en el muslo: en una cama de verdad se cura el doble de rápido.',
    focus: roomId('enfermeria'),
    done: (s) => {
      const r = roomOf(s, 'enfermeria');
      return !r || r.level > 0 || !!r.works;
    },
    enter: (s) => {
      const cost = enfCost(s);
      if (!cost || s.gold >= cost) return null;
      const gift = cost - s.gold;
      s.gold += gift;
      return `Entre las hojas del cuaderno había ${gift} monedas, con una nota: «Para la enfermería. No te las bebas».`;
    },
  },
  {
    id: 'mover',
    text: () =>
      'Cada cual rinde donde lo pones. Coge con el dedo a alguien de la casa y suéltalo en la cocina: con dos en los fogones, más comida.',
    focus: roomId('cocina'),
    pause: 3,
    done: (s) => !!s.tutorial?.moved,
  },
  {
    id: 'esperar',
    text: () =>
      'Con el grupo en el camino no hay más que hacer. No te quedes mirando la puerta: vuelven antes si no se les espera.',
    done: (s) => s.reports.length > 0,
    button: 'esperar',
  },
  {
    id: 'informe',
    text: () =>
      'Cada grupo que vuelve trae su informe. Léelo entero: ahí se ve de qué pasta está hecho cada cual.',
    done: (s) => s.reports.some((r) => r.read),
  },
  {
    id: 'equipo',
    text: (s) => {
      const it = s.inventory.find((i) => i.kind !== 'tesoro');
      const h = s.heroes.find((x) => x.id === tutorialHero(s));
      return `Lo que traen, mejor puesto que en un arcón. Dale ${it ? `«${it.name}»` : 'el equipo'} a ${h ? first(h.name) : 'alguien'}: ficha, «Equipo».`;
    },
    skip: (s) => !s.inventory.some((i) => i.kind !== 'tesoro') || !tutorialHero(s),
    done: (s) => !s.inventory.some((i) => i.kind !== 'tesoro'),
  },
  {
    id: 'herido',
    text: (s) =>
      `${first(alive(s).find((h) => h.status === 'herido')?.name ?? 'Alguien')} ha vuelto herido. No puede salir hasta que se cure: se cura solo con los días, antes con la enfermería.`,
    skip: (s) => !s.heroes.some((h) => h.status === 'herido'),
    button: 'seguir',
  },
  {
    id: 'ratas',
    text: () =>
      'Si oyes rascar en la cocina, son ratas. Espántalas antes de que se coman las raciones. Cada día pasa algo así: atiéndelo a tiempo, que luego sale caro.',
    focus: roomId('cocina'),
    // Un rato de calma antes de que salten las ratas.
    pause: 8,
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
    text: () =>
      'En la barra se habla más de la cuenta. Cuando oigas algo que brilla, apúntalo antes de que se pierda: de ahí salen los mejores encargos.',
    focus: roomId('salon'),
    pause: 6,
    done: (s) => !s.rumor,
    enter: (s) => {
      if (!roomOf(s, 'salon')) return null;
      const c = s.clock ?? 0;
      s.rumor = {
        id: `ru${s.uid++}`,
        text: 'Un arriero jura que en {place} algo brilla bajo las piedras.',
        from: c,
        until: c + DAY_SECONDS,
      };
      return null;
    },
  },
  {
    id: 'mandar',
    text: () =>
      'Ese rumor ya es un encargo, y paga en especie. Manda a quien tengas en casa, aunque vaya solo.',
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
    text: () =>
      'En el Gremio llevo la cuenta de lo que queda por hacer en la casa: siempre tres cosas. Cumplirlas da oro y lustre.',
    pause: 4,
    button: 'seguir',
  },
  {
    id: 'pago',
    text: (s) => {
      const head = `El día ${firstPay.day} viene Merlo: ${firstPay.amount} monedas, más ${wages(s)} de sueldos.`;
      if (payReady(s)) return `${head} Ya tienes la caja lista: no le hagas esperar.`;
      const left = firstPay.day - s.day;
      return `${head} Te faltan ${firstDue(s) - s.gold}, y quedan ${left} ${left === 1 ? 'noche' : 'noches'}. La caja del salón deja algo cada noche y el tablón tiene más encargos: ve pasando las noches hasta juntarlo.`;
    },
    done: (s) => s.paid > 0 || !!s.over,
    button: 'pago',
  },
  {
    id: 'fin',
    text: () =>
      'Si has llegado hasta aquí, la taberna sigue siendo tuya. El resto del cuaderno son recetas y cuentas pendientes: lo irás leyendo cuando toque.',
    button: 'seguir',
  },
];

/** Si el tutorial está en marcha (y en qué paso). */
export const tutorialStep = (s: GameState): TutorialStep | null =>
  s.tutorial && !s.over ? (STEPS[s.tutorial.step] ?? null) : null;
export const tutorialOn = (s: GameState) => !!tutorialStep(s);

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
  s.tutorial = { ...(s.tutorial ?? { step: 0 }), step: STEPS.length };
  s.tips = [...new Set([...(s.tips ?? []), ...TUTORIAL_TIPS])];
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
          t: `El tío pone ${due - t.gold} monedas para que llegues al pago: «Ya me lo devolverás».`,
          k: 'good',
        });
        t.gold = due;
      }
    }
    s = night(t);
    const many = s.day - start > 1 || i > 0;
    if (many) events.push({ t: `Día ${s.day}`, head: true });
    events.push(...s.dawn);
    if (s.over) break;
    if (until === 'vuelta' && !s.missions.length) break;
    if (until === 'noche' || (until === 'pago' && s.paid > 0)) break;
  }
  // Con más de un día, el primero también lleva su encabezado.
  if (events.some((e) => e.head) && !events[0]?.head)
    events.unshift({ t: `Día ${start + 1}`, head: true });
  return { ...s, dawn: events };
}
