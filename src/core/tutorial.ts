/**
 * Tutorial guiado (fase 2a): pasos que hay que cumplir, del primer día al primer pago a Merlo
 * (día 7). Mientras dura, el reloj se para (solo avanza con los saltos) y no hay incidentes ni
 * rumores sueltos: el primero de cada uno llega preparado. Se puede saltar entero.
 */
import { INCIDENTS } from '../data/incidents';
import { GEAR } from '../data/items';
import { DAY_SECONDS, DUSK, SCHEDULE } from './balance';
import type { DawnEvent, GameState, Quest } from './model';
import type { Rng } from './rng';
import { upgradeCostOf } from './rooms';

export type TutorialButton = 'ok' | 'esperar' | 'pago' | 'luego';

export interface TutorialStep {
  id: string;
  /** Lo que dice el tío. */
  text: (s: GameState) => string;
  /** Sala (id) o sitio de la escena al que mirar. */
  focus?: (s: GameState) => string | null;
  /** Hecho: se pasa al siguiente. */
  done?: (s: GameState) => boolean;
  /** Botón de la nota (sin él, solo se avanza haciendo lo que pide). */
  button?: TutorialButton;
  /** Se salta solo si no tiene sentido (nadie herido, nada que equipar…). */
  skip?: (s: GameState) => boolean;
  /** Al llegar a este paso (prepara el incidente, el rumor o el dinero que falta). */
  enter?: (s: GameState) => string | null;
}

/** Estado del tutorial en la partida (sin él, no hay tutorial: partidas viejas o saltado). */
export interface Tutorial {
  step: number;
  /** El encargo a la medida de los dos primeros héroes. */
  quest?: string;
  moved?: boolean;
  named?: boolean;
}

const roomOf = (s: GameState, type: string) => s.building.rooms.find((r) => r.type === type);
const roomId = (type: string) => (s: GameState) => roomOf(s, type)?.id ?? null;
const alive = (s: GameState) =>
  s.heroes.filter((h) => h.status !== 'muerto' && h.status !== 'desaparecido');
const firstPay = SCHEDULE[0]!;

/** Lo que cuesta arreglar la enfermería rota (o 0 si no hace falta). */
const enfCost = (s: GameState) => {
  const r = roomOf(s, 'enfermeria');
  return r && r.level === 0 ? (upgradeCostOf(r) ?? 0) : 0;
};

export const STEPS: readonly TutorialStep[] = [
  {
    id: 'hola',
    text: () =>
      'Sobrino: esta es tu taberna, con sus deudas. Te enseño lo justo para el primer pago a Merlo, el día 7. Si ya sabes cómo va, sáltate las lecciones.',
    focus: roomId('salon'),
    button: 'ok',
  },
  {
    id: 'tablon',
    text: (s) => {
      const q = s.quests.find((x) => x.id === s.tutorial?.quest);
      const names = alive(s).map((h) => h.name.split(' ')[0]);
      return `El tablón de encargos está en el salón: toca la sala y ábrelo. Manda a ${names.join(' y ')} a «${q?.title ?? 'el primer encargo'}», que está a su medida.`;
    },
    focus: roomId('salon'),
    done: (s) => s.missions.length > 0,
  },
  {
    id: 'barra',
    text: () =>
      'Con dos no se llega lejos. En la barra esperan aventureros que buscan trabajo: toca la barra del salón y contrata a uno. Mira la prima y el sueldo, que se pagan.',
    focus: () => 'barra',
    done: (s) => alive(s).length > 2,
  },
  {
    id: 'nombre',
    text: () =>
      'A los tuyos, ponles nombre si quieres: abre la ficha de un héroe (en «Héroes») y toca su nombre para cambiarlo.',
    done: (s) => !!s.tutorial?.named,
    button: 'luego',
  },
  {
    id: 'enfermeria',
    text: () =>
      'Media casa está rota desde que me fui. Empieza por la enfermería, arriba: tócala y arréglala. Los heridos se curan antes en una cama de verdad.',
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
      return `El tío te deja ${gift} monedas para la enfermería: «No me lo agradezcas, devuélvemelo».`;
    },
  },
  {
    id: 'mover',
    text: () =>
      'La gente se cambia de sitio con el dedo: coge a alguien de la casa y suéltalo en otra sala (por ejemplo, a Tobías en la cocina, que hoy hay poco en la barra).',
    focus: roomId('cocina'),
    done: (s) => !!s.tutorial?.moved,
    button: 'luego',
  },
  {
    id: 'esperar',
    text: () =>
      'Ya no queda nada que hacer hasta que vuelva el grupo. No hace falta esperar mirando: salta hasta que vuelvan.',
    done: (s) => s.reports.length > 0,
    button: 'esperar',
  },
  {
    id: 'informe',
    text: () =>
      'Han vuelto. Cada grupo manda su informe: toca el sobre de abajo y léelo, que ahí se ve de qué pasta está hecho cada cual.',
    done: (s) => s.reports.some((r) => r.read),
  },
  {
    id: 'equipo',
    text: (s) =>
      `Han traído ${s.inventory.find((i) => i.kind !== 'tesoro')?.name ?? 'algo de equipo'}. Abre la ficha de un héroe y dáselo: lo que lleva puesto se nota en el encargo.`,
    skip: (s) => !s.inventory.some((i) => i.kind !== 'tesoro'),
    done: (s) => !s.inventory.some((i) => i.kind !== 'tesoro'),
    button: 'luego',
  },
  {
    id: 'herido',
    text: (s) =>
      `${alive(s).find((h) => h.status === 'herido')?.name ?? 'Alguien'} ha vuelto herido. Se cura solo con los días, y más deprisa con la enfermería arreglada. Mientras, no puede salir.`,
    skip: (s) => !s.heroes.some((h) => h.status === 'herido'),
    button: 'ok',
  },
  {
    id: 'ratas',
    text: () =>
      '¡Ratas en la cocina! Toca el aviso hasta espantarlas. Pasan cosas así cada día: una pelea, un ladrón, el recaudador… Si no se atienden a tiempo, salen caras.',
    focus: roomId('cocina'),
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
      'Escucha: en el salón se oye algo (el bocadillo dorado). Tócalo antes de que se pierda: los rumores traen encargos con buen botín.',
    focus: roomId('salon'),
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
      'Ese encargo está en el tablón, marcado «Rumor». Manda al que has contratado, con alguien más si puede ir.',
    skip: (s) => !s.quests.some((q) => q.rumor) && !s.missions.some((m) => m.quest.rumor),
    done: (s) => s.missions.some((m) => m.quest.rumor),
    button: 'luego',
  },
  {
    id: 'objetivos',
    text: () =>
      'En «Gremio» (abajo a la derecha) tienes siempre tres objetivos, que dan oro y cosas para la casa. Y en el Libro, lo que has cumplido.',
    button: 'ok',
  },
  {
    id: 'pago',
    text: () =>
      `El día ${firstPay.day} viene Merlo a cobrar ${firstPay.amount} monedas, más los sueldos: lo tienes arriba, en el pergamino. Salta hasta ese día y paga.`,
    done: (s) => s.paid > 0 || !!s.over,
    button: 'pago',
  },
  {
    id: 'fin',
    text: () =>
      'Merlo se va contando monedas. La taberna sigue siendo tuya… de momento. Desde ahora el tiempo corre solo, también con la taberna cerrada. Ya sabes lo básico: lo demás te lo iré contando.',
    button: 'ok',
  },
];

/** Si el tutorial está en marcha (y en qué paso). */
export const tutorialStep = (s: GameState): TutorialStep | null =>
  s.tutorial && !s.over ? (STEPS[s.tutorial.step] ?? null) : null;
export const tutorialOn = (s: GameState) => !!tutorialStep(s);

/** Las notas del tío que el tutorial ya ha contado (no se repiten al acabar). */
export const TUTORIAL_TIPS = ['tablon', 'noche', 'carta', 'barra', 'pago', 'trabajo', 'gremio'];

/**
 * Avanza el tutorial mientras el paso actual esté hecho (o no tenga sentido), y prepara el
 * siguiente. Muta `s` (una copia). Devuelve lo que haya que avisar.
 */
export function advanceTutorial(s: GameState, ack = false): string[] {
  const out: string[] = [];
  let first = true;
  for (let guard = 0; guard < STEPS.length + 1; guard++) {
    const st = tutorialStep(s);
    if (!st) break;
    const isDone = (first && ack) || st.skip?.(s) || st.done?.(s);
    first = false;
    if (!isDone) break;
    s.tutorial = { ...s.tutorial!, step: s.tutorial!.step + 1 };
    const next = tutorialStep(s);
    if (!next) {
      finishTutorial(s);
      break;
    }
    if (!next.skip?.(s)) {
      const msg = next.enter?.(s);
      if (msg) out.push(msg);
    }
  }
  return out;
}

/** Acaba el tutorial (o se salta): fuera el paso y las notas del tío que ya ha contado. */
export function finishTutorial(s: GameState): void {
  s.tutorial = { ...(s.tutorial ?? { step: 0 }), step: STEPS.length };
  s.tips = [...new Set([...(s.tips ?? []), ...TUTORIAL_TIPS])];
}

/** El encargo del primer día, a la medida de los dos héroes: corto, sin peligro y con equipo. */
export function easyQuest(q: Quest, rng: Rng): Quest {
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
    challenges: q.challenges.slice(0, 1).map((c) => ({ ...c, diff: 4 })),
    item: { id: q.item?.id ?? `${q.id}-i`, ...base },
  };
}

/**
 * Saltar el tiempo desde el tutorial: noche tras noche hasta que vuelva el grupo o hasta el
 * pago. Si la caja no llega al pago, el tío pone lo que falta (el tutorial no acaba en derrota).
 * Junta la carta del amanecer por días, como la de «Mientras no estabas».
 */
export function skipTime(
  s0: GameState,
  until: 'vuelta' | 'pago',
  night: (s: GameState) => GameState,
  salaries: (s: GameState) => number,
): GameState {
  let s = s0;
  const events: DawnEvent[] = [];
  const start = s.day;
  for (let i = 0; i < 10; i++) {
    const t = structuredClone(s);
    t.clock = DUSK * DAY_SECONDS;
    if (t.day + 1 === firstPay.day && until === 'pago') {
      const due = firstPay.amount + salaries(t);
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
    if (until === 'pago' && s.paid > 0) break;
  }
  // Con más de un día, el primero también lleva su encabezado.
  if (events.some((e) => e.head) && !events[0]?.head)
    events.unshift({ t: `Día ${start + 1}`, head: true });
  return { ...s, dawn: events };
}
