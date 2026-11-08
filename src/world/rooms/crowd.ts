/**
 * La gente que se ve en la escena 3D: una figura plana por persona que anda por las salas y las
 * escaleras, se sienta en el salón, duerme en su cama y sale por el recibidor. Cada figura usa
 * un atlas con todos sus fotogramas (de pie, parpadeo, andando, sentada, en la cama y entrenando)
 * y la escena solo cambia cuál se ve y dónde está.
 */
import { Group, PlaneGeometry, Vector3, type Mesh, type ShaderMaterial } from 'three';
import { P } from '../../art/palette';
import { PixelBuffer, alpha } from '../../art/pixel';
import {
  FEET_Y,
  HAND,
  WALK_PX,
  WALK_STEPS,
  fightSprites,
  heroSprites,
  type FightPose,
  type HeroSprites,
} from '../../art/heroes/hero';
import { bunkQuilt } from '../props';
import { HEADROOM } from '../../art/heroes/layers';
import { TINTS, TINT_IDS, type TintId } from '../../data/custom';
import { generateLook, type OutfitId } from '../../art/heroes/look';
import { WEAPONS, type WeaponId } from '../weapons';
import type { SceneHero, SceneVisitors } from '../scene';
import { GROUND } from '../geometry';
import { Look, mesh, texture, type Shared } from './gl';
import { PITCH, STAIR_W, floorY, type RoomsLayout, type Rect } from './layout';
import { CLIMB_Z, STEPS, goesRight, stepAt } from './stairs';
import {
  LANES,
  homes,
  outside,
  route,
  segments,
  spots,
  wander,
  workGoal,
  type Goal,
  type Place,
  type Segments,
  type SeatSpot,
  type Spots,
} from './people';
import { project, scaleAt, type View } from './view3d';
import { FAR_Z, NEAR_Z, type BedSpot } from './people';
import type { PoiKind, TaskPoi } from './salas/kit';
import { STEP_UP, stepladder } from './salas/pintor';
import { STRIPE, stripeOf } from './pintura';

/**
 * Una sala que se está pintando, para el pintor: la pared (x del mundo de un lado al otro y
 * ancho de su dibujo, para las franjas), lo que lleva y si aún va de camino.
 */
export interface PaintSpan {
  room: string;
  painter: string;
  frac: number;
  walking: boolean;
  x0: number;
  x1: number;
  w: number;
}

/** Como mucho, tantas figuras animadas a la vez (y de ellas, tantos visitantes). */
export const MAX_ACTORS = 30;
const MAX_VISITORS = 8;
/** Los visitantes llegan repartidos entre la mañana y poco antes del anochecer y se quedan un rato. */
const ARRIVE_FROM = 0.04;
const ARRIVE_SPAN = 0.68;
const STAY = 0.22;
/** Pinta de cada tipo de visitante. */
const VISITOR_LOOK: Record<string, OutfitId> = {
  campesino: 'campesino',
  mercader: 'mercader',
  noble: 'noble',
  espia: 'forastero',
};
const VISITOR_NAME: Record<string, string> = {
  campesino: 'Campesino',
  mercader: 'Mercader',
  noble: 'Noble',
  espia: 'Forastero callado',
};
const SPEED = 36;
/**
 * Quien se manda a una sala arrastrándolo va corriendo (se le ha mandado algo, no va de paseo);
 * a un incidente, aún más deprisa.
 */
const BRISK = 2.2;
const RUSH = 2.5;
/** Lo deprisa que se va hacia dentro o hacia fuera (más despacio que de lado: se ve en escorzo). */
const Z_SPEED = 14;
/**
 * Lo más al fondo por lo que se anda de un lado a otro de la sala: por delante de todo lo suelto
 * (que empieza en `FREE`, 40). Más al fondo (los muebles de la pared) solo se entra al llegar,
 * dando unos pasos hacia dentro; y al irse, primero se sale hacia fuera. Así nadie atraviesa
 * un barril ni un arcón.
 */
export const WALK_Z = 32;
/** A cuánto del sitio (en x) se empieza a entrar a su profundidad. */
const STEP_IN = 10;
const CLIMB = 30;

/** Fotogramas del atlas (cada uno de CELL × SPRITE de alto). */
const CELL = 24;
const TALL = 28;

/** Las herramientas de los puestos (y el trapo de la barra), en el orden de sus fotogramas. */
const TOOLS = [
  'cucharon',
  'pala',
  'cuenco',
  'jarra',
  'trapo',
  'cuchillo',
  'antorcha',
  'martillo',
  'tenaza',
  'lima',
  'tijera',
  'aguja',
  'cinta',
  'tela',
  'palo',
  'frasco',
  'maja',
  'pluma',
  'atizador',
  'sorbo',
  'brocha',
] as const;

/** Un trabajo: la herramienta y los cuatro tiempos (postura del brazo, giro y duración). */
interface Work {
  tool: number;
  /** Cada tiempo: postura, giro, duración y, si cambia en ese tiempo, otra herramienta. */
  steps: [FightPose, number, number, number?][];
  /** De rodillas (coser el bajo): las piernas dobladas y el cuerpo más abajo. */
  crouch?: boolean;
}

/**
 * Cómo se trabaja en cada sala con puestos: la herramienta y los cuatro tiempos de la vuelta
 * (postura del brazo, giro de la herramienta y lo que dura, en segundos). Siempre con los pies
 * quietos: solo se mueven el brazo y la herramienta.
 */
const WORK = {
  // Remover la olla con el cucharón, dando vueltas.
  cocina: {
    tool: 0,
    // El brazo adelantado y el cucharón en diagonal, metido en la olla hasta el borde, dando
    // vueltas (más adentro y más afuera).
    steps: [
      ['thrust', 112, 0.3],
      ['thrust', 126, 0.28],
      ['thrust', 140, 0.3],
      ['thrust', 126, 0.28],
    ],
  },
  // Remover el mosto con la pala, despacio y con fuerza.
  bodega: {
    tool: 1,
    steps: [
      ['windup', 212, 0.45],
      ['ready', 192, 0.4],
      ['strike', 166, 0.45],
      ['ready', 192, 0.4],
    ],
  },
  // Acercar un cuenco al herido y ayudarle a beber.
  enfermeria: {
    tool: 2,
    steps: [
      ['ready', 0, 1.6],
      ['thrust', 0, 1.1],
      ['thrust', -25, 0.7],
      ['thrust', 0, 0.6],
    ],
  },
  // Limpiar la barra con el trapo: el brazo va y viene por encima del mostrador.
  barra: {
    tool: 4,
    steps: [
      ['thrust', 0, 0.28],
      ['strike', 10, 0.28],
      ['thrust', 0, 0.28],
      ['ready', 0, 0.5],
    ],
  },
  // Servir: la jarra en la mano y, de vez en cuando, inclinándola sobre el vaso.
  salon: {
    tool: 3,
    steps: [
      ['ready', 0, 1.8],
      ['thrust', 30, 0.3],
      ['thrust', 80, 0.9],
      ['thrust', 30, 0.3],
    ],
  },
  // Las tareas de las rutinas (ver `TASKS`): picar en la mesa con el cuchillo…
  picar: {
    tool: 5,
    steps: [
      ['up', 150, 0.18],
      ['strike', 175, 0.16],
      ['up', 150, 0.18],
      ['strike', 175, 0.22],
    ],
  },
  // … probar el guiso con el cucharón…
  probar: {
    tool: 0,
    steps: [
      // Lo saca de la olla y se lo lleva a la boca: casi de frente a la cara, de perfil solo
      // se ve el cazo y un poco del mango (el cucharón en escorzo).
      ['thrust', 130, 0.6],
      ['up', 0, 0.5, 19],
      ['up', -10, 0.9, 19],
      ['thrust', 130, 0.6],
    ],
  },
  // … meter y sacar el pan del horno con la pala…
  hornear: {
    tool: 1,
    // El brazo adelantado y la pala algo hacia arriba: la punta entra por la boca del horno,
    // que está más alta que la mano.
    steps: [
      ['ready', 60, 0.6],
      ['thrust', 70, 0.7],
      ['thrust', 78, 0.5],
      ['thrust', 66, 0.7],
    ],
  },

  // … llenar la jarra en el grifo del barril…
  llenar: {
    tool: 3,
    steps: [
      ['thrust', 0, 1.2],
      ['thrust', 8, 0.9],
      ['ready', 0, 0.5],
      ['thrust', 0, 0.6],
    ],
  },
  // … fregar en la pila con el trapo…
  fregar: {
    tool: 4,
    steps: [
      ['thrust', 0, 0.25],
      ['strike', 15, 0.25],
      ['thrust', 0, 0.25],
      ['strike', 15, 0.3],
    ],
  },
  // La forja: martillar en el yunque (alto, golpe seco y otra vez arriba)…
  martillar: {
    tool: 7,
    steps: [
      ['up', -20, 0.32],
      ['strike', 150, 0.12],
      ['strike', 160, 0.16],
      ['ready', 60, 0.3],
    ],
  },
  // … avivar la fragua con el fuelle (empujar abajo y soltar)…
  avivar: {
    tool: 8,
    steps: [
      ['ready', 90, 0.45],
      ['thrust', 120, 0.35],
      ['thrust', 130, 0.35],
      ['ready', 90, 0.45],
    ],
  },
  // … templar: la pieza al rojo, dentro del agua y fuera…
  templar: {
    tool: 8,
    steps: [
      ['ready', 100, 0.6],
      ['thrust', 165, 0.9],
      ['thrust', 170, 0.7],
      ['up', 60, 0.6],
    ],
  },
  // … y limar en el banco (o desmontar una pieza).
  limar: {
    tool: 9,
    steps: [
      ['thrust', 80, 0.22],
      ['strike', 95, 0.22],
      ['thrust', 80, 0.22],
      ['strike', 95, 0.26],
    ],
  },
  // La sastrería: cortar en la mesa con las tijeras (tres tijeretazos y mirar)…
  cortar: {
    tool: 10,
    steps: [
      ['thrust', 75, 0.2],
      ['thrust', 95, 0.16],
      ['thrust', 75, 0.2],
      ['ready', 40, 0.7],
    ],
  },
  // … medir con la cinta (arriba, abajo y la mano extendida)…
  medir: {
    tool: 12,
    steps: [
      ['up', 0, 0.8],
      ['ready', 0, 0.6],
      ['thrust', 10, 0.9],
      ['ready', 0, 0.6],
    ],
  },
  // … coser en el maniquí (la aguja entra y se tira del hilo hacia arriba)…
  coser: {
    tool: 11,
    steps: [
      ['thrust', 30, 0.4],
      ['thrust', 10, 0.25],
      ['up', -25, 0.35],
      ['thrust', 30, 0.45],
    ],
  },
  // … coser el bajo, de rodillas…
  bajo: {
    tool: 11,
    crouch: true,
    steps: [
      ['thrust', 20, 0.45],
      ['thrust', 5, 0.3],
      ['ready', -20, 0.4],
      ['thrust', 20, 0.4],
    ],
  },
  // … probar la tela por encima (al héroe que se viste)…
  prueba: {
    tool: 13,
    steps: [
      ['up', -10, 1],
      ['thrust', 0, 0.9],
      ['up', -10, 0.7],
      ['ready', 0, 0.6],
    ],
  },
  // … y teñir: remover la tela en la tina con el palo.
  tenir: {
    tool: 14,
    // El palo, con la punta manchada hacia abajo, dentro de la tina (el brazo en alto).
    steps: [
      ['up', -18, 0.5],
      ['up', 0, 0.45],
      ['up', 18, 0.5],
      ['up', 0, 0.45],
    ],
  },
  // La alquimia: remover el caldero con el palo, despacio y en círculo…
  remover: {
    tool: 14,
    steps: [
      ['up', 15, 0.45],
      ['up', 0, 0.45],
      ['up', -15, 0.45],
      ['up', 0, 0.45],
    ],
  },
  // … destilar: mirar el frasco al trasluz y verter gota a gota…
  destilar: {
    tool: 15,
    steps: [
      ['up', 0, 1.1],
      ['thrust', 20, 0.8],
      ['thrust', 70, 0.9],
      ['thrust', 20, 0.6],
    ],
  },
  // … moler las hierbas en el mortero…
  moler: {
    tool: 16,
    steps: [
      ['strike', 170, 0.22],
      ['thrust', 175, 0.22],
      ['strike', 170, 0.22],
      ['thrust', 175, 0.3],
    ],
  },
  // … y apuntar en el libro del atril con la pluma.
  apuntar: {
    tool: 17,
    steps: [
      ['thrust', 80, 0.5],
      ['thrust', 95, 0.3],
      ['thrust', 85, 0.4],
      ['ready', 60, 0.9],
    ],
  },
  // La bodega: dar con el mazo en el tonel, para oír por el sonido cuánto queda…
  golpear: {
    tool: 7,
    steps: [
      ['thrust', 55, 0.35],
      ['thrust', 95, 0.12],
      ['thrust', 60, 0.3],
      ['ready', 20, 0.9],
    ],
  },
  // … y atizar el fuego del hornillo de la caldera, abajo.
  atizar: {
    tool: 18,
    steps: [
      ['ready', 105, 0.5],
      ['ready', 125, 0.35],
      ['ready', 110, 0.4],
      ['ready', 125, 0.35],
    ],
  },
  // El pintor: pintar el cuadro del caballete a pinceladas cortas y mirarlo…
  pintar: {
    tool: 20,
    steps: [
      ['thrust', 20, 0.3],
      ['thrust', 40, 0.25],
      ['thrust', 25, 0.3],
      ['ready', 0, 1],
    ],
  },
  // … remover la pintura en el bote con el palo, abajo…
  mezclar: {
    tool: 14,
    steps: [
      ['ready', 150, 0.45],
      ['ready', 165, 0.4],
      ['ready', 150, 0.45],
      ['ready', 135, 0.4],
    ],
  },
  // … y, en la sala que pinta, la brocha por la pared: de arriba abajo, subido a la escalera…
  brochazo: {
    tool: 20,
    steps: [
      ['up', -10, 0.35],
      ['up', 15, 0.3],
      ['thrust', 0, 0.35],
      ['up', 15, 0.3],
    ],
  },
  // … o de rodillas, por abajo.
  zocalo: {
    tool: 20,
    crouch: true,
    steps: [
      ['thrust', 10, 0.3],
      ['thrust', 40, 0.3],
      ['thrust', 10, 0.3],
      ['ready', 0, 0.6],
    ],
  },
  // … y echar un leño al fuego.
  lena: {
    tool: 6,
    steps: [
      ['ready', 90, 0.7],
      ['thrust', 95, 0.45],
      ['ready', 80, 0.5],
      ['ready', 80, 0.8],
    ],
  },
} satisfies Record<string, Work>;

type WorkId = keyof typeof WORK;
/** Los trabajos, en el orden del atlas (para las pruebas y para verlos sueltos). */
export const WORK_IDS = Object.keys(WORK) as WorkId[];
/** Dónde va cada trabajo en el atlas (cada uno, su tira de 8: 4 a la derecha y 4 a la izquierda). */
const SLOT = Object.fromEntries(Object.keys(WORK).map((k, i) => [k, i])) as Record<WorkId, number>;

/**
 * Las rutinas del servicio en la cocina y la bodega: en cada mueble se hace una de estas cosas,
 * y se va turnando de mueble en mueble con algún rato quieto en medio (ver `taskTurn`).
 */
const TASKS: Record<TaskPoi, WorkId[]> = {
  olla: ['cocina', 'cocina', 'probar'],
  mesa: ['picar'],
  fregar: ['fregar'],
  horno: ['hornear', 'lena'],
  // La cuba es un tonel cerrado con grifo: se llena la jarra o se le da con el mazo.
  cuba: ['llenar', 'golpear'],
  barril: ['llenar'],
  caldera: ['atizar', 'lena'],
  fuelle: ['avivar'],
  yunque: ['martillar', 'martillar'],
  artesa: ['templar'],
  banco: ['limar'],
  corte: ['cortar', 'cortar', 'medir'],
  maniqui: ['coser', 'coser', 'bajo'],
  tinte: ['tenir'],
  caldero: ['remover', 'remover', 'moler'],
  alambique: ['destilar'],
  atril: ['apuntar'],
  caballete: ['pintar'],
  botes: ['mezclar'],
};
const ROUTINE = new Set(['cocina', 'bodega', 'forja', 'sastreria', 'alquimia', 'pintor']);
/** Los talleres: solo trabajan (y con su rutina) mientras hay un trabajo en marcha. */
const WORKSHOP = new Set(['forja', 'sastreria', 'alquimia']);
/** Dónde se desmonta, por orden: el banco de la forja o, si no hay, el mueble de cada taller. */
const UNDO_AT: TaskPoi[] = ['banco', 'yunque', 'corte', 'alambique'];
/** Lo que vestir a un héroe pide a quien cose: medirle, probarle la tela y coserle el bajo. */
const FITTING: WorkId[] = ['medir', 'prueba', 'bajo', 'prueba'];
/** Lo primero al llegar el héroe al probador, por orden: medirle, probarle la tela y coserle. */
const FIRST_FIT: WorkId[] = ['medir', 'prueba', 'bajo'];
/**
 * Los golpes que se notan en la sala (con su efecto y su sonido, ver `hits`): en qué tiempo de
 * la vuelta, qué es y dónde (el mueble de la tarea).
 */
const HITS: Partial<Record<WorkId, Hit['kind']>> = {
  martillar: 'martillo',
  templar: 'temple',
  cortar: 'tijera',
  tenir: 'tinte',
  remover: 'remover',
  destilar: 'gota',
};
export interface Hit {
  x: number;
  y: number;
  z: number;
  kind: 'martillo' | 'temple' | 'tijera' | 'tinte' | 'remover' | 'gota';
}
const LEISURE = new Set<PoiKind>(['read', 'warm', 'pray']);

/** Cuántos fotogramas tiene cada cosa, en el orden del atlas. */
const SIZES = {
  idle: 2,
  blink: 1,
  /** Andando: los 8 tiempos del paso (`WALK_STEPS`), a la derecha y a la izquierda. */
  walk: WALK_STEPS,
  walkL: WALK_STEPS,
  sit: 1,
  sleep: 4,
  cot: 1,
  mat: 1,
  down: 1,
  downL: 1,
  /** Entrenando: golpes (preparado, impulso, golpe), el arco (bajado, apuntando) y leyendo. */
  drill: 3,
  drillL: 3,
  /** Más golpes: el arma en alto (para el tajo de arriba abajo) y la estocada. */
  drill2: 2,
  drill2L: 2,
  aim: 2,
  aimL: 2,
  read: 2,
  /** Incorporado en la cama (al acostarse y al levantarse): litera de cada nivel, catre y jergón. */
  up: 6,
  /** Con la herramienta de su puesto: cada trabajo × (4 tiempos a la derecha y 4 a la izquierda). */
  tool: Object.keys(WORK).length * 8,
  /** Calentándose las manos (a la derecha y a la izquierda). */
  warm: 2,
  /** Con la jarra en la barra: abajo y bebiendo, a la derecha y a la izquierda. */
  drink: 4,
  /** De perfil, quieto (charlando), a la derecha y a la izquierda. */
  talk: 2,
  /** En la litera, acostado e incorporado, con la manta de cada tema de color (`TINT_IDS`). */
  sleepT: TINT_IDS.length,
  upT: TINT_IDS.length,
  /** De frente: celebrando (brazos en alto), estirándose y bostezando. */
  cheer: 1,
  stretch: 1,
  yawn: 1,
  /** Brindando con la jarra en alto, a la derecha y a la izquierda. */
  toast: 2,
  /** Sentado con los ojos cerrados (el de guardia que cabecea de madrugada). */
  sitZ: 1,
} as const;

/** Dónde empieza cada cosa en el atlas. */
export const F = (() => {
  let at = 0;
  const out = {} as Record<keyof typeof SIZES, number>;
  for (const k of Object.keys(SIZES) as (keyof typeof SIZES)[]) {
    out[k] = at;
    at += SIZES[k];
  }
  return out;
})();
const FRAMES = Object.values(SIZES).reduce((a, n) => a + n, 0);
/**
 * El atlas va en `ROWS` filas (se dibuja en una tira y se pliega, ver `fold`): su ancho no puede
 * pasar de lo que aguanta una textura en cualquier móvil (4096).
 */
const ROWS = 2;
const COLS = Math.ceil(FRAMES / ROWS);
export const ATLAS_W = CELL * COLS;
/** Filas que baja el dibujo en los fotogramas de incorporado (para que quepa la cabeza). */
const UP_DROP = 8;

/** Lo que dicen al hablar (icono del bocadillo). */
export type Talk =
  | 'puntos'
  | 'exclama'
  | 'pregunta'
  | 'jarra'
  | 'moneda'
  | 'corazon'
  | 'nota'
  | 'espada'
  | 'pan'
  | 'risa';
const CHAT: Talk[] = [
  'puntos',
  'exclama',
  'pregunta',
  'jarra',
  'moneda',
  'nota',
  'espada',
  'risa',
  'corazon',
];
/** Los de guardia, jugando: lo que apuestan, lo que ríen y lo que protestan. */
const GAME: Talk[] = ['moneda', 'risa', 'exclama', 'moneda', 'pregunta'];
/** Los visitantes, sentados, piden y comentan. */
const ORDER: Talk[] = ['jarra', 'pan', 'moneda', 'puntos', 'risa'];
/** Lo que dura cada frase de una charla (s). */
const TURN = 1.6;

/** Un sitio de una sala al que se va a hacer algo (ver `setPois`). */
export interface Poi extends Place {
  kind: PoiKind;
  /** Profundidad del mueble (para ponerse delante de él). */
  z?: number;
  /** Medio ancho de lo que hay allí (para ponerse a un lado si hay que mirarlo de lado). */
  half: number;
}

/** El arma con la que practica cada uno en la sala de armas (en la de tiro, todos con arco). */
const DRILL_WEAPON: Record<OutfitId, WeaponId> = {
  guerrero: 'espada',
  picaro: 'daga',
  mago: 'baston',
  clerigo: 'maza',
  explorador: 'espada',
  tabernero: 'garrote',
  herrero: 'garrote',
  sastre: 'garrote',
  alquimista: 'baston',
  pintor: 'garrote',
  campesino: 'garrote',
  mercader: 'daga',
  noble: 'espada',
  forastero: 'daga',
};

/**
 * El golpe que da cada uno en una pelea (asalto o ladrón): tajo con la espada, estocada rápida
 * con la daga, mazazo de arriba abajo, disparo con el arco y conjuro con el bastón. `grito`: el
 * arma en alto (Provocar, o el clérigo que cura).
 */
export type Blow = 'tajo' | 'estocada' | 'maza' | 'tiro' | 'conjuro' | 'grito';
const BLOW: Partial<Record<OutfitId, Blow>> = {
  guerrero: 'tajo',
  noble: 'tajo',
  picaro: 'estocada',
  mercader: 'estocada',
  forastero: 'estocada',
  mago: 'conjuro',
  alquimista: 'conjuro',
  clerigo: 'maza',
  explorador: 'tiro',
};
export const blowOf = (outfit: OutfitId): Blow => BLOW[outfit] ?? 'maza';

/** Cómo se entrena en cada sala: golpes al aire, tiro con arco o leer. */
type Drill = 'armas' | 'tiro' | 'biblioteca';
const DRILLS: Record<string, Drill> = { armas: 'armas', tiro: 'tiro', biblioteca: 'biblioteca' };
/** Duración de cada vuelta de la animación, en segundos. */
const DRILL_CYCLE: Record<Drill, number> = { armas: 1.8, tiro: 3, biblioteca: 5 };
/** En la sala de tiro: cuándo sale la flecha y cuánto tarda en cruzar (dentro de la vuelta). */
const LOOSE_AT = 2.2;
const ARROW_TIME = 0.35;
/** Se entrena mirando a la izquierda, donde las salas tienen el muñeco y las dianas. */
const DRILL_DIR = -1;

type Tint = readonly [number, number, number];

interface Actor {
  hero: SceneHero;
  /** La sala de trabajo a la que ya se ha dicho que ha llegado (`onArrive`) y cuándo. */
  told?: string;
  toldAt?: number;
  /** Ya no es de la casa (despedido, o candidato que se va): sale por la puerta y desaparece. */
  quit?: boolean;
  /** Sus fotogramas (para tocarle solo donde se le ve). */
  img: PixelBuffer;
  mat: ShaderMaterial;
  mesh: Mesh;
  x: number;
  /** Altura de los pies en el mundo (y hacia abajo) y planta en la que está o a la que va. */
  y: number;
  floor: number;
  lane: number;
  /** La de siempre (su carril) y hacia dónde va ahora (cambia poco a poco al andar). */
  home: number;
  laneTo?: number;
  path: Place[];
  goal: Goal | null;
  pose: 'stand' | 'walk' | 'sit' | 'bed' | 'down';
  wait: number;
  dir: 1 | -1;
  dist: number;
  blinkAt: number;
  seat: SeatSpot | null;
  /** Saliendo de misión: al llegar al patio desaparece. */
  leaving: boolean;
  /** Trabajador del pueblo: de camino a casa al anochecer y ya fuera (no se ve). */
  homeward: boolean;
  gone: boolean;
  /** Segundos que lleva sentado (los visitantes no se van sin haber comido algo). */
  sat: number;
  /** Cogido con el dedo: dónde se le lleva (pies, en el mundo), colgando bajo el dedo. */
  held?: { x: number; y: number } | null;
  /** En un asalto: corre más (o menos) para llegar a su hora, y el golpe que está dando (0–1). */
  run?: number;
  swing?: number;
  /** Qué golpe es (ver `Blow`). */
  blow?: Blow;
  /** En guardia (peleando): hasta cuándo (reloj de la escena). */
  guard?: number;
  /** Encajando un golpe: lo que le queda (s) y hacia dónde le echa. */
  hurt?: { t: number; push: 1 | -1 };
  /** Cayendo por un golpe: cuánto lleva (s) y hacia dónde le echa. */
  fall?: { t: number; push: 1 | -1 };
  /** Acostándose o levantándose: un momento incorporado en la cama (`out`: luego se va). */
  edge?: { bed: BedSpot; t: number; out: boolean } | null;
  /** Haciendo algo en un sitio de la sala (leer el tablón, calentarse…) y hacia dónde mira. */
  poi?: { kind: Poi['kind']; dir: 1 | -1 } | null;
  /** En la rutina de su oficio: el mueble (`at`, su x), lo que hace y hacia dónde mira. */
  task?: { at: number; work: WorkId; face: 1 | -1 } | null;
  /** Vistiendo a un héroe: cuántas tareas lleva con él desde que llegó (ver `FIRST_FIT`). */
  fit?: number;
  /** Pintando subido a la escalera de tijera (la figura va `STEP_UP` más arriba). */
  ladder?: boolean;
  /** La última vuelta en que sonó su golpe (ver `hits`). */
  hitAt?: number;
  /** De charla con alguien: con quién, cuándo empezó (al llegar) y cuándo acaba. */
  chat?: { with: string; from: number; until: number } | null;
  /** Sentándose o levantándose del taburete: lo que falta (en segundos) y hacia dónde. */
  seatMove?: { t: number; up: boolean } | null;
  /** Dándose la vuelta al andar: un momento de frente. */
  turn?: number;
  /** Celebrando (al volver con éxito): hasta cuándo da saltos con los brazos en alto. */
  cheer?: number;
  /**
   * Subiendo o bajando un tramo: la planta de abajo, la columna (x de su hueco), si sube y por
   * dónde va (0 = abajo, 1 = arriba).
   */
  climb?: { lower: number; sx: number; up: boolean; u: number } | null;
}

/** La caída: lo que dura, lo que echa hacia atrás y la parte en que aún se tambalea de pie. */
const FALL_TIME = 0.45;
/** Los de guardia: cada cuánto planta uno la carta (de día) y cada cuánto cabecea (de noche). */
const GAME_CYCLE = 3.4;
const NOD_CYCLE = 4.6;
/** Lo que dura el gesto de encajar un golpe. */
const HURT_TIME = 0.25;
const FALL_PUSH = 6;
const STAGGER = 0.3;
/** Lo que tarda en sentarse o levantarse, y lo que dura la vuelta al cambiar de sentido. */
const SEAT_TIME = 0.24;
/** En cada peldaño, la parte del tiempo que se tarda en subirlo (el resto, quieto en él). */
const LIFT = 0.45;
const smoothstep = (x: number) => x * x * (3 - 2 * x);
const TURN_TIME = 0.1;

const hash = (s: string) => {
  let h = 0;
  for (const ch of s) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
};

/** Pinta un arma girada `deg` grados con su agarre en (hx, hy), como la pelea pero en píxeles. */
function stampWeapon(b: PixelBuffer, id: WeaponId, hx: number, hy: number, deg: number): void {
  const w = WEAPONS[id];
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const R = Math.ceil(Math.hypot(w.img.w, w.img.h));
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      // Cada píxel de destino mira de qué píxel del arma viene (giro inverso): sin agujeros.
      const sx = Math.round(c * x + s * y) + w.px;
      const sy = Math.round(-s * x + c * y) + w.py;
      if (sx < 0 || sy < 0 || sx >= w.img.w || sy >= w.img.h) continue;
      const col = w.img.get(sx, sy);
      const dx = hx + x;
      const dy = hy + y;
      if (alpha(col) && dx >= 0 && dy >= 0 && dx < b.w && dy < b.h) b.set(dx, dy, col);
    }
}

/** Un fotograma de pelea (mirando a la derecha) con su arma en la mano. */
function drillCell(
  pose: Record<FightPose, PixelBuffer>,
  p: FightPose,
  id: WeaponId,
  deg: number,
): PixelBuffer {
  const b = new PixelBuffer(CELL, TALL);
  b.blit(pose[p], 3, 0);
  stampWeapon(b, id, 3 + HAND[p].x, HAND[p].y, deg);
  return b;
}

/**
 * De rodillas: el cuerpo baja y las piernas se doblan (se queda con una de cada dos filas de
 * las piernas, apretadas abajo).
 */
function crouchCell(src: PixelBuffer): PixelBuffer {
  const b = new PixelBuffer(CELL, TALL);
  const hip = HEADROOM + 17;
  const legs = TALL - hip;
  const drop = Math.floor(legs / 2);
  for (let y = 0; y < hip; y++)
    for (let x = 0; x < CELL; x++) {
      const c = src.get(x, y);
      if (c) b.set(x, y + drop, c);
    }
  for (let k = 0; k < legs - drop; k++)
    for (let x = 0; x < CELL; x++) {
      const c = src.get(x, hip + k * 2 + 1) || src.get(x, hip + k * 2);
      if (c) b.set(x, hip + drop + k, c);
    }
  return b;
}

/** De frente con un libro abierto en las manos (con la hoja a medio pasar, si `turn`). */
function readCell(front: PixelBuffer, turn: boolean): PixelBuffer {
  const b = new PixelBuffer(CELL, TALL);
  b.blit(front, 3, 0);
  const x = 8;
  const y = 16;
  b.rect(x, y, 8, 5, P.wine);
  b.rect(x + 1, y, 3, 4, P.sand);
  b.rect(x + 4, y, 3, 4, P.white);
  b.vline(x + 4, y, 4, P.tan);
  for (const ry of [y + 1, y + 2]) {
    b.hline(x + 1, ry, 2, P.clay);
    b.hline(x + 5, ry, 2, P.mist);
  }
  if (turn) {
    // La hoja de la derecha, levantada hacia la izquierda.
    b.rect(x + 4, y - 2, 2, 3, P.white);
    b.set(x + 4, y - 2, P.mist);
  }
  return b;
}

/**
 * Sentado con los ojos cerrados: lo que cambia del fotograma quieto al de parpadear (los ojos),
 * puesto en el de sentado, con el párpado alargado en una rayita. La cabeza del sentado no está a la misma altura: se busca cuántas
 * filas se mueve comparando la cabeza (las filas de arriba) y se ponen ahí.
 */
function dozing(spr: HeroSprites): PixelBuffer {
  const { sit, blink } = spr;
  const idle = spr.idle[0];
  const out = sit.clone();
  const w = Math.min(idle.w, sit.w, blink.w);
  const HEAD = 12;
  let best = 0;
  let shift = 0;
  for (let dy = -8; dy <= 8; dy++) {
    let same = 0;
    for (let y = 0; y < HEAD; y++)
      for (let x = 0; x < w; x++) {
        const c = idle.get(x, y);
        if (alpha(c) && y + dy >= 0 && y + dy < sit.h && sit.get(x, y + dy) === c) same++;
      }
    if (same > best) {
      best = same;
      shift = dy;
    }
  }
  for (let y = 0; y < Math.min(idle.h, blink.h); y++)
    for (let x = 0; x < w; x++) {
      const a = idle.get(x, y);
      const b = blink.get(x, y);
      const sy = y + shift;
      if (a !== b && sy >= 0 && sy < sit.h && sit.get(x, sy) === a) {
        out.set(x, sy, b);
        // El párpado: el ojo de abajo se alarga hacia fuera en una rayita (– –), que a esta
        // escala un punto solo sigue pareciendo un ojo abierto.
        const ox = x < w / 2 ? x - 1 : x + 1;
        if (sy + 1 < sit.h && sit.get(ox, sy + 1) === b) out.set(ox, sy + 1, a);
      }
    }
  return out;
}

/** Atlas de una persona: todos sus fotogramas uno al lado del otro. */
export function atlas(spr: HeroSprites, h: SceneHero): PixelBuffer {
  const b = new PixelBuffer(CELL * FRAMES, TALL);
  const put = (img: PixelBuffer, i: number, dx = 3, flip = false) =>
    b.blit(img, i * CELL + dx, 0, flip);
  put(spr.idle[0], F.idle);
  put(spr.idle[1], F.idle + 1);
  put(spr.blink, F.blink);
  spr.walk.forEach((w, i) => {
    put(w, F.walk + i);
    put(w, F.walkL + i, 3, true);
  });
  put(spr.sit, F.sit);
  put(dozing(spr), F.sitZ);
  // Entrenando: los fotogramas de mirar a la izquierda son los mismos, volteados.
  const pose = fightSprites(h.look, h.marks);
  // Trabajando, charlando o junto al fuego: los pies quietos.
  const still = fightSprites(h.look, h.marks, true);
  const melee = DRILL_WEAPON[h.look.outfit];
  const swing = h.look.outfit === 'mago' ? [0, -40, 110] : [30, -45, 125];
  (['ready', 'windup', 'strike'] as const).forEach((p, i) => {
    const img = drillCell(pose, p, melee, swing[i]!);
    put(img, F.drill + i, 0);
    put(img, F.drillL + i, 0, true);
  });
  (['up', 'thrust'] as const).forEach((p, i) => {
    const img = drillCell(pose, p, melee, i ? 90 : -15);
    put(img, F.drill2 + i, 0);
    put(img, F.drill2L + i, 0, true);
  });
  (['ready', 'thrust'] as const).forEach((p, i) => {
    const img = drillCell(pose, p, 'arco', i ? 0 : 35);
    put(img, F.aim + i, 0);
    put(img, F.aimL + i, 0, true);
  });
  put(readCell(spr.idle[0], false), F.read, 0);
  put(readCell(spr.idle[0], true), F.read + 1, 0);
  // En la cama: la cabeza en la almohada y la manta por encima de los hombros. Las literas
  // tienen la manta del color del nivel; el catre, sábana blanca.
  // (El fotograma empieza 2 píxeles a la izquierda de la litera y 4 del catre.)
  const quilts = [0, 1, 2, 3].map((lvl) => ({
    i: F.sleep + lvl,
    up: F.up + lvl,
    q: bunkQuilt(lvl),
  }));
  TINT_IDS.forEach((id, k) => quilts.push({ i: F.sleepT + k, up: F.upT + k, q: TINTS[id].ramp }));
  for (const { i, q } of quilts) {
    const x = i * CELL;
    // El herido, con su venda (aunque no quepa en un catre y duerma en una litera).
    b.blit(h.marks.injured ? spr.bed : spr.sleep, x, 0);
    b.rect(x + 2, 12, 21, 6, q[2]!);
    b.hline(x + 2, 12, 21, q[3]!);
    b.hline(x + 2, 17, 21, q[1]!);
  }
  const x = F.cot * CELL;
  b.blit(spr.bed, x, 0);
  b.rect(x + 4, 14, 20, 4, P.white);
  b.hline(x + 4, 17, 20, P.mist);
  // En el jergón del servicio: una manta parda de lana.
  const m = F.mat * CELL;
  b.blit(h.marks.injured ? spr.bed : spr.sleep, m, 0);
  b.rect(m + 4, 14, 20, 4, P.clay);
  b.hline(m + 4, 14, 20, P.tan);
  b.hline(m + 4, 17, 20, P.rust);
  // Incorporado en la cama: lo mismo que acostado pero sentado (de cintura para arriba) con la
  // manta por las piernas. Todo va `UP_DROP` filas más abajo para que quepa la cabeza.
  const sitUp = (i: number, sx: number, blanket: (x: number, y: number) => void, top: number) => {
    const x0 = i * CELL;
    b.blit(spr.sit, x0 + sx, top + UP_DROP + 5 - spr.sit.h);
    blanket(x0, UP_DROP);
  };
  for (const { up, q } of quilts) {
    sitUp(
      up,
      0,
      (x, d) => {
        b.rect(x + 2, 12 + d, 21, 6, q[2]!);
        b.hline(x + 2, 12 + d, 21, q[3]!);
        b.hline(x + 2, 17 + d, 21, q[1]!);
      },
      12,
    );
  }
  sitUp(
    F.up + 4,
    2,
    (x, d) => {
      b.rect(x + 4, 14 + d, 20, 4, P.white);
      b.hline(x + 4, 17 + d, 20, P.mist);
    },
    14,
  );
  sitUp(
    F.up + 5,
    2,
    (x, d) => {
      b.rect(x + 4, 14 + d, 20, 4, P.clay);
      b.hline(x + 4, 14 + d, 20, P.tan);
      b.hline(x + 4, 17 + d, 20, P.rust);
    },
    14,
  );
  // En su puesto, con la herramienta (los de la izquierda, volteados).
  Object.values(WORK).forEach((w: Work, slot) =>
    w.steps.forEach(([p, deg, , tool], i) => {
      const cell = drillCell(still, p, TOOLS[tool ?? w.tool]!, deg);
      const img = w.crouch ? crouchCell(cell) : cell;
      put(img, F.tool + slot * 8 + i, 0);
      put(img, F.tool + slot * 8 + 4 + i, 0, true);
    }),
  );
  // Las manos hacia el fuego.
  const warm = new PixelBuffer(CELL, TALL);
  warm.blit(still.thrust, 3, 0);
  put(warm, F.warm, 0);
  put(warm, F.warm + 1, 0, true);
  // De perfil, quieto: para las charlas.
  put(still.ready, F.talk, 3);
  put(still.ready, F.talk + 1, 3, true);
  // En la barra, con la jarra: abajo y a la boca.
  const mug = drillCell(still, 'ready', 'jarra', 0);
  const sip = drillCell(still, 'up', 'jarra', -70);
  put(mug, F.drink, 0);
  put(sip, F.drink + 1, 0);
  put(mug, F.drink + 2, 0, true);
  put(sip, F.drink + 3, 0, true);
  // Brindando: la jarra bien alta.
  const toast = new PixelBuffer(CELL, TALL);
  toast.blit(still.up, 3, 0);
  stampWeapon(toast, 'jarra', 3 + HAND.up.x + 1, HAND.up.y - 4, 10);
  put(toast, F.toast, 0);
  put(toast, F.toast + 1, 0, true);
  // De frente: celebrando, estirándose y bostezando.
  put(spr.cheer, F.cheer);
  put(spr.stretch, F.stretch);
  put(spr.yawn, F.yawn);
  // En el suelo, caído: la figura de pie tumbada de lado (la cabeza a un lado o al otro).
  const src = spr.idle[0];
  for (const [i, left] of [
    [F.down, true],
    [F.downL, false],
  ] as const)
    for (let y = 2; y < Math.min(src.h, CELL + 2); y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + x]!;
        if (!c) continue;
        const dx = left ? y - 2 : CELL + 1 - y;
        const dy = TALL - 2 - src.w + x;
        if (dy >= 0 && dy < TALL) b.data[dy * b.w + i * CELL + dx] = c;
      }
  return fold(b);
}

/**
 * Pliega la tira de fotogramas (una fila, como se dibuja) en la rejilla del atlas: `ROWS` filas
 * de `COLS` celdas. Así cabe en una textura de cualquier móvil aunque crezca.
 */
function fold(strip: PixelBuffer): PixelBuffer {
  const out = new PixelBuffer(CELL * COLS, TALL * ROWS);
  for (let i = 0; i < FRAMES; i++) {
    const cx = (i % COLS) * CELL;
    const cy = Math.floor(i / COLS) * TALL;
    for (let y = 0; y < TALL; y++)
      for (let x = 0; x < CELL; x++)
        out.data[(cy + y) * out.w + cx + x] = strip.data[y * strip.w + i * CELL + x]!;
  }
  return out;
}

/** Esquina de arriba a la izquierda del fotograma `f` en el atlas, en píxeles. */
export const cellOf = (f: number): [number, number] => [
  (f % COLS) * CELL,
  Math.floor(f / COLS) * TALL,
];

/** Dónde cae el fotograma `f` en el atlas, en coordenadas de textura (abajo a la izquierda). */
function uvOf(f: number): [number, number] {
  const col = f % COLS;
  const row = Math.floor(f / COLS);
  // La textura va al revés en vertical (la fila 0 del dibujo, arriba del todo).
  return [col / COLS, (ROWS - 1 - row) / ROWS];
}

/** Fotograma y sitio de alguien acostado: la figura encima del mueble, alineada con su dibujo. */
function bedFrame(
  bed: BedSpot,
  k: number,
  z: number,
  tint?: TintId,
): { frame: number; left: number; bottom: number; z: number } {
  const ground = floorY(bed.floor);
  if (bed.kind === 'litera') {
    const left = bed.x - 14 / k;
    const top = ground - 40 / k + (bed.top - 12) / k;
    const frame = tint ? F.sleepT + TINT_IDS.indexOf(tint) : F.sleep + bed.level;
    return { frame, left, bottom: top + TALL / k, z };
  }
  if (bed.kind === 'jergon') {
    // En el suelo, con la cabeza en un extremo del jergón.
    const left = bed.x - 15 / k;
    const top = ground - 5 / k - 12 / k + 1 / k;
    return { frame: F.mat, left, bottom: top + TALL / k, z };
  }
  const left = bed.x - 18 / k;
  const top = ground - 14 / k - 12 / k + 1 / k;
  return { frame: F.cot, left, bottom: top + TALL / k, z };
}

/** Lo que decide el dibujo de alguien (si cambia, hay que rehacer su atlas). */
const skinOf = (h: SceneHero) => JSON.stringify([h.look, h.marks]);

/** Punto 3D a partir de una x y una y del mundo 2D (y hacia abajo) y una profundidad. */
const at = (x: number, y: number, depth: number) => new Vector3(x, GROUND - y, -depth);

export class Crowd {
  readonly group = new Group();
  private look: Look;
  private geo = new PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
  private actors = new Map<string, Actor>();
  private L: RoomsLayout | null = null;
  private S: Spots | null = null;
  private segs: Segments = new Map();
  private homes = new Map<string, Goal>();
  private tints: Readonly<Record<string, TintId>> = {};
  /** Los que se han ido de misión por la puerta: al volver entran desde el patio. */
  private away = new Set<string>();
  /** De día cada uno va a lo suyo; al atardecer, andando a su cama; de noche, acostados. */
  private time: 'day' | 'dusk' | 'night' = 'day';
  /** Para no repetir decisiones iguales: un generador sencillo con semilla. */
  private seed = 1;
  /** Los visitantes de hoy. */
  private visitors: SceneVisitors = { day: 0, kinds: [] };
  /** Durante un asalto nadie decide por su cuenta: la escena dice a dónde va cada uno. */
  private scripted = false;
  /** La hora de la escena en el último fotograma (para saber qué dibujo tiene cada uno). */
  private now = 0;
  /** Sitios de las salas a los que se va a hacer algo (el tablón, la chimenea, el altar…). */
  private pois: Poi[] = [];
  /** El de guardia que cabecea ahora a la hora de la siesta (lo dice la escena con `napping`). */
  napper: string | null = null;
  /** Ya se ha puesto a la gente una vez: quien aparece después, llega andando. */
  private ready = false;
  /**
   * Alguien ha llegado andando a la sala de su tarea (una vez por tarea): así lo que depende de
   * que esté allí (vestirle en la sastrería) empieza cuando se le ve llegar y no antes.
   */
  onArrive?: (id: string, room: string) => void;

  constructor(
    shared: Shared,
    private tint: (x: number, floor: number) => { ambient: Tint; sun: number },
  ) {
    this.look = new Look(shared);
  }

  private rnd = () => {
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0;
    return (this.seed >>> 8) / 16777216;
  };

  /** El edificio ha cambiado: sitios nuevos y cada uno se recoloca si se ha quedado en el aire. */
  setLayout(L: RoomsLayout): void {
    this.L = L;
    this.S = spots(L);
    this.segs = segments(L);
    this.rehome();
    for (const a of this.actors.values()) {
      a.poi = null;
      a.chat = null;
      if (this.stays(a)) continue;
      a.path = [];
      a.goal = null;
      a.seat = null;
      a.wait = this.rnd() * 2;
      if (!route(L, { x: a.x, floor: a.floor }, this.S.door, this.segs))
        this.put(a, this.rescue(a));
      if (a.pose === 'sit' || a.pose === 'bed') a.pose = 'stand';
    }
  }

  /**
   * Tras una obra, quien se ha quedado sin camino (en una sala que ya no está) aparece en el
   * sitio con camino más cercano de su planta; si no hay ninguno, en la puerta.
   */
  private rescue(a: Actor): Place {
    let best: Place | null = null;
    for (const [x0, x1] of this.segs.get(a.floor) ?? []) {
      const p = { x: Math.max(x0 + 8, Math.min(x1 - 8, a.x)), floor: a.floor };
      if (best && Math.abs(p.x - a.x) >= Math.abs(best.x - a.x)) continue;
      if (route(this.L!, p, this.S!.door, this.segs)) best = p;
    }
    return best ?? this.S!.door;
  }

  /**
   * Tras cambiar el edificio, quien está acostado o sentado sigue igual si su cama o su taburete
   * siguen en el mismo sitio (la obra ha sido en otra sala).
   */
  private stays(a: Actor): boolean {
    const g = a.goal;
    if (!g || a.path.length || !this.S) return false;
    if (a.pose === 'bed') {
      const home = this.homes.get(a.hero.id);
      if (!home?.bed || home.place.x !== g.place.x || home.place.floor !== g.place.floor)
        return false;
      a.goal = home;
      return true;
    }
    if (a.pose === 'sit') {
      // El de guardia, en su taburete del recibidor (no es un sitio del salón).
      const home = this.homes.get(a.hero.id);
      if (
        home?.pose === 'sit' &&
        home.place.x === g.place.x &&
        home.place.floor === g.place.floor
      ) {
        a.goal = home;
        return true;
      }
      const seat = this.S.seats.find((s) => s.x === g.place.x && s.floor === g.place.floor);
      if (!seat || seat.z !== g.z) return false;
      a.seat = seat;
      return true;
    }
    return false;
  }

  /** La gente de la casa: altas, bajas y cambios (sale de misión, vuelve, se hiere…). */
  setPeople(heroes: readonly SceneHero[]): void {
    const order = (h: SceneHero) =>
      h.guard ? 0 : h.status === 'herido' ? 1 : h.status === 'ok' ? 2 : 3;
    const home = heroes.filter((h) => h.status !== 'mision').sort((a, b) => order(a) - order(b));
    const shown = new Set(home.slice(0, MAX_ACTORS).map((h) => h.id));
    // Los que se van de la casa (despedidos, o candidatos que se cansan de esperar) salen
    // andando por la puerta; si se van muchos a la vez (otra partida), se quitan sin más.
    const lost = [...this.actors.values()].filter(
      (a) => !a.hero.visitor && !a.hero.bandit && !heroes.some((x) => x.id === a.hero.id),
    );
    const walkOut = lost.length <= 2;
    const redo: Actor[] = [];
    for (const [id, a] of this.actors) {
      if (a.hero.visitor) continue;
      const h = heroes.find((x) => x.id === id);
      if (!h && a.quit) continue;
      if (!h && walkOut && !a.gone && !a.held && this.S) {
        a.quit = true;
        a.leaving = true;
        a.goal = null;
        a.seat = null;
        a.task = null;
        this.go(a, { place: outside(), pose: 'stand' });
        continue;
      }
      // El que acaba de salir de misión sigue hasta la puerta aunque ya no esté en casa.
      const going = h?.status === 'mision' && (a.leaving || a.hero.status === 'ok');
      if (!h || (!shown.has(id) && !going)) {
        this.remove(id);
        continue;
      }
      const was = a.hero.status;
      const work = a.hero.work;
      const guard = a.hero.guard;
      const goTo = a.hero.goTo;
      // Si ha cambiado su dibujo (equipo nuevo, herido o curado, u otra partida con los mismos
      // ids), se le rehace: si no, seguía con el de antes hasta que salía y volvía a entrar.
      const reskin = skinOf(a.hero) !== skinOf(h);
      a.hero = h;
      if (reskin) this.reskin(a);
      // Tarea nueva (o de guardia): va ya, sin acabar antes el paseo que llevaba.
      if ((work !== h.work || goTo !== h.goTo || !guard !== !h.guard) && !a.gone && !a.leaving) {
        a.wait = 0;
        // (Decide cuando ya se sabe su sitio nuevo: el de guardia, la puerta; ver abajo.)
        if (was === h.status && !a.climb && !a.held && !this.scripted) redo.push(a);
      }
      if (was === h.status) continue;
      a.goal = null;
      a.path = [];
      a.seat = null;
      if (h.status === 'mision') {
        // Coge sus cosas y sale por el recibidor hasta perderse en el patio.
        a.leaving = true;
        this.go(a, { place: outside(), pose: 'stand' });
      } else if (was === 'candidato') {
        // Contratado: da un salto de alegría en la barra y de ahí va andando a lo suyo.
        a.cheer = this.now + 1.4;
        a.wait = 1.4;
        a.pose = 'stand';
        this.hired.push(id);
      } else if (was === 'mision') {
        this.put(a, outside());
        a.wait = 0;
      }
    }
    // Quien llega nuevo con la partida en marcha (un candidato, alguien que se une) entra por la
    // puerta; si llegan muchos a la vez (al cargar otra partida), ya están en su sitio.
    const fresh = home.filter((h) => shown.has(h.id) && !this.actors.has(h.id));
    const walkIn = this.ready && fresh.length <= 3;
    for (const h of fresh) this.add(h, walkIn);
    if (this.S) this.ready = true;
    this.rehome();
    for (const a of redo) this.decide(a);
    // Quien ya tiene cama en el servicio deja de irse al pueblo (si es de noche, viene mañana).
    for (const a of this.actors.values()) {
      if (!a.gone || this.village(a) || this.time === 'night') continue;
      a.gone = false;
      a.mesh.visible = true;
      this.put(a, outside());
      a.wait = 0;
    }
  }

  /** Los visitantes de hoy: si cambia el día, los de ayer se van. */
  /**
   * Los que vuelven con éxito lo celebran: van a la barra (si no tienen otra cosa) y dan
   * saltitos con los brazos en alto un rato.
   */
  celebrate(ids: readonly string[]): void {
    for (const id of ids) {
      const a = this.actors.get(id);
      if (!a || a.gone || a.hero.visitor) continue;
      a.cheer = this.now + 7;
      a.wait = 9;
      const bar = this.S?.bar ?? [];
      const b = bar[hash(id) % Math.max(1, bar.length)];
      if (b && !this.scripted && a.pose !== 'bed') this.go(a, { place: b, pose: 'stand' });
    }
  }

  /**
   * Gestos de quien está de pie sin hacer nada, de vez en cuando (cada uno a su hora): unos se
   * estiran y otros bostezan. Si no le toca, -1.
   */
  private gesture(a: Actor, t: number): number {
    const h = hash(a.hero.id);
    const g = (t + (h % 53) / 3) % 17;
    if (g >= 1.5) return -1;
    return h % 2 ? F.stretch : F.yawn;
  }

  /**
   * Dónde está la cabeza de cada herido acostado (en el mundo 2D), para que la escena le ponga
   * encima, de vez en cuando, una cruz roja: así se ve quién está herido, también en una cama
   * del dormitorio.
   */
  injured(): { x: number; y: number; z: number }[] {
    const out: { x: number; y: number; z: number }[] = [];
    for (const a of this.actors.values()) {
      if (a.gone || a.hero.status !== 'herido' || a.pose !== 'bed' || a.edge) continue;
      const f = this.frame(a, this.now);
      const k = scaleAt(f.z);
      out.push({ x: f.left + 10 / k, y: f.bottom - TALL / k + 8 / k, z: f.z });
    }
    return out;
  }

  /** Temas de color de las salas: la manta de quien duerme en una litera es la de su sala. */
  setTints(t: Readonly<Record<string, TintId>>): void {
    this.tints = t;
  }

  /** Las salas que se pintan, por pintor (la escena las da en cada fotograma). */
  private paints = new Map<string, PaintSpan>();
  /** La escalera de tijera de cada pintor que está pintando (se ve cuando se sube). */
  private ladders = new Map<string, Mesh>();

  setPaints(list: readonly PaintSpan[]): void {
    const was = this.paints;
    this.paints = new Map(list.map((p) => [p.painter, p]));
    // Encargo nuevo: el pintor sale ya hacia la sala, aunque fuera de camino a otra cosa (la tarea
    // nueva le llega antes que el encargo, y andando no vuelve a pensar hasta llegar).
    for (const [id, p] of this.paints) {
      if (was.get(id)?.room === p.room) continue;
      const a = this.actors.get(id);
      if (!a || a.gone || a.held || a.climb || a.leaving || a.homeward || this.scripted) continue;
      a.path = [];
      this.paintTurn(a);
    }
    for (const [id, m] of this.ladders)
      if (!this.paints.has(id)) {
        this.group.remove(m);
        (m.material as ShaderMaterial).dispose();
        this.ladders.delete(id);
      }
  }

  /**
   * El pintor que tiene una sala que pintar: va a ella y, cuando empieza, se pone en la franja
   * que toca, mirando hacia lo que falta. Por arriba, subido a la escalera; por el medio, de
   * pie; y lo de abajo, de rodillas. Se queda hasta que cambia de franja.
   */
  private paintTurn(a: Actor): boolean {
    const p = this.paints.get(a.hero.id);
    a.ladder = false;
    if (!p || !this.L || this.time !== 'day' || a.hero.status !== 'ok') return false;
    const r = this.L.rooms.find((x) => x.room.id === p.room);
    if (!r) return false;
    const s = stripeOf(p.walking ? 0 : p.frac, p.w);
    const u = Math.min(p.w, (s.full + 0.5) * STRIPE) / p.w;
    // Un poco a la izquierda de la franja (por lo ya pintado), mirando a la derecha.
    const x = Math.max(p.x0 + 6, Math.min(p.x1 - 10, p.x0 + u * (p.x1 - p.x0) - 5));
    const place = { x, floor: r.room.floor };
    // Casi siempre subido a la escalera, por lo de arriba; de vez en cuando (una franja de cada
    // cuatro, cuando va por abajo), de rodillas por el zócalo.
    const low = s.full % 4 === 3 && s.part > 0.5;
    const work: WorkId = low ? 'zocalo' : 'brochazo';
    // De camino aún no pinta: al llegar se queda mirando la pared hasta que empieza.
    a.task = p.walking ? null : { at: x, work, face: 1 };
    a.wait = 2;
    // No se baja a cada franja: corre la escalera cuando la franja ya le queda lejos.
    const near = a.floor === place.floor && this.inRoom(a, p.room) && Math.abs(a.x - x) < 9;
    if (near && !p.walking) {
      if (a.task) a.task.at = a.x;
      a.ladder = !low;
      return true;
    }
    if (near) return true;
    if (!route(this.L, { x: a.x, floor: a.floor }, place, this.segs)) return false;
    // Por delante de lo suelto (camas, arcones), que se le vea trabajar. Si aún no está en la
    // sala, va deprisa: el trabajo no se ve empezar hasta que llega.
    this.go(a, { place, pose: 'stand', stand: WALK_Z - 4 });
    if (!this.inRoom(a, p.room)) a.run = Math.max(a.run ?? 1, BRISK);
    return true;
  }

  setVisitors(v: SceneVisitors): void {
    if (v.day === this.visitors.day && v.kinds.length === this.visitors.kinds.length) return;
    if (v.day !== this.visitors.day)
      for (const a of [...this.actors.values()]) if (a.hero.visitor) this.remove(a.hero.id);
    this.visitors = v;
  }

  /** La hora del día: entran los visitantes que tocan y se van los que ya han estado un rato. */
  setClock(tod: number): void {
    if (!this.S || !this.L) return;
    const { day, kinds } = this.visitors;
    const n = kinds.length;
    let present = [...this.actors.values()].filter((a) => a.hero.visitor && !a.leaving).length;
    for (let i = 0; i < n; i++) {
      const id = `vis-${day}-${i}`;
      const at = ARRIVE_FROM + (i / Math.max(1, n)) * ARRIVE_SPAN;
      const a = this.actors.get(id);
      const due = tod >= at && tod < at + STAY && this.time === 'day';
      // Con el reloj rápido, que al menos se siente un rato antes de irse.
      const done = this.time !== 'day' || tod >= at + STAY * 2 || (a?.sat ?? 0) >= 6;
      if (due && !a && present < MAX_VISITORS && this.actors.size < MAX_ACTORS) {
        this.addVisitor(id, kinds[i]!, i);
        present++;
      } else if (!due && a && !a.leaving && (tod < at || done)) {
        // Ya ha comido y bebido: se va por donde vino.
        a.leaving = true;
        a.goal = null;
        this.go(a, { place: outside(), pose: 'stand' });
        present--;
      }
    }
  }

  private addVisitor(id: string, kind: string, i: number): void {
    const look = generateLook(
      `${id}-${kind}`,
      VISITOR_LOOK[kind] ?? 'explorador',
      i % 2 ? 'f' : 'm',
    );
    this.add({
      id,
      name: VISITOR_NAME[kind] ?? 'Visitante',
      status: 'ok',
      look,
      marks: {},
      visitor: true,
    });
    const a = this.actors.get(id)!;
    this.put(a, outside());
    // A una mesa libre o, si no queda ninguna, de pie en la barra.
    const free = this.S!.seats.filter((x) => !this.taken().has(x));
    const seat = free[Math.floor(this.rnd() * free.length)];
    const goal: Goal = seat
      ? { place: { x: seat.x, floor: seat.floor }, pose: 'sit', z: seat.z }
      : {
          place: this.S!.bar[Math.floor(this.rnd() * this.S!.bar.length)] ?? this.S!.door,
          pose: 'stand',
        };
    this.go(a, goal);
    a.wait = 999;
  }

  /** Cambia la hora: al atardecer van a la cama andando y de noche ya están acostados. */
  setNight(time: 'day' | 'dusk' | 'night'): void {
    if (time === this.time) return;
    this.time = time;
    if (time === 'day') {
      // Los del pueblo llegan por la mañana, cada uno a su hora.
      for (const a of this.actors.values()) {
        a.homeward = false;
        if (a.gone) {
          a.gone = false;
          a.mesh.visible = true;
          a.path = [];
          a.pose = 'stand';
          this.put(a, outside());
        }
      }
    }
    if (time !== 'night') {
      for (const a of this.actors.values()) a.wait = this.rnd() * 3;
      return;
    }
    // Cae la noche: nadie aparece en su cama. Quien no está acostado va corriendo; los visitantes
    // y los del pueblo salen por la puerta. Si al quedar a oscuras alguien no ha llegado, se le
    // acuesta entonces (`lightsOut`), sin que se vea.
    if (this.scripted) return;
    for (const a of [...this.actors.values()]) {
      if (a.gone || (a.leaving && !a.hero.visitor)) continue;
      if (a.hero.visitor || this.village(a)) {
        if (a.hero.visitor) a.leaving = true;
        else a.homeward = true;
        a.goal = null;
        this.go(a, { place: outside(), pose: 'stand' });
        a.run = RUSH;
        continue;
      }
      const g = this.homes.get(a.hero.id);
      if (!g || (a.pose === 'bed' && !a.path.length)) continue;
      this.go(a, g);
      a.run = RUSH;
    }
  }

  /**
   * Ya está todo a oscuras: quien aún no ha llegado a su cama se acuesta y quien salía ya se ha
   * ido. Sin asalto la pantalla está a negro, así que no se ve; con asalto no se llama (cada uno
   * sigue su camino hasta que el asalto le mueve).
   */
  lightsOut(): void {
    if (this.scripted) return;
    for (const a of [...this.actors.values()]) {
      if (a.gone) continue;
      if (a.leaving) {
        if (!a.hero.visitor && !a.quit) this.away.add(a.hero.id);
        this.remove(a.hero.id);
        continue;
      }
      if (a.homeward) {
        this.hide(a);
        continue;
      }
      const g = this.homes.get(a.hero.id);
      if (!g || (a.pose === 'bed' && !a.path.length)) continue;
      this.standUp(a);
      a.path = [];
      a.run = undefined;
      this.seatFree(a);
      this.put(a, g.place);
      this.arrive(a, g);
    }
  }

  update(dt: number, t: number): void {
    this.now = t;
    for (const a of this.actors.values()) {
      if (a.gone) continue;
      if (a.held) {
        this.place(a, t);
        continue;
      }
      // Cayendo: el golpe le echa unos píxeles hacia atrás.
      if (a.fall) {
        const t0 = Math.min(1, a.fall.t / FALL_TIME);
        a.fall.t += dt;
        const t1 = Math.min(1, a.fall.t / FALL_TIME);
        const ease = (u: number) => 1 - (1 - u) ** 2;
        a.x += a.fall.push * FALL_PUSH * (ease(t1) - ease(t0));
        if (t1 >= 1) a.fall = undefined;
      }
      if (a.hurt) {
        a.hurt.t -= dt;
        if (a.hurt.t <= 0) a.hurt = undefined;
      }
      // El golpe que está dando (el grito y la cura se sostienen más).
      if (a.swing) a.swing = Math.max(0, a.swing - dt * (a.blow === 'grito' ? 1.4 : 3));
      if (this.scripted) {
        if (a.path.length) this.walk(a, dt);
        else if ((a.leaving || a.homeward) && !a.hero.bandit) {
          // Salía por la puerta antes del asalto: ya se ha ido.
          if (a.leaving) this.remove(a.hero.id);
          else this.hide(a);
          continue;
        }
        this.place(a, t);
        continue;
      }
      if (a.pose === 'sit') a.sat += dt;
      if (a.turn) a.turn = Math.max(0, a.turn - dt);
      // Sentándose o levantándose: al levantarse no echa a andar hasta acabar.
      if (a.seatMove) {
        a.seatMove.t -= dt;
        const up = a.seatMove.up;
        if (a.seatMove.t <= 0) a.seatMove = null;
        else if (up) {
          this.place(a, t);
          continue;
        }
      }
      // Incorporado en la cama un momento: al levantarse no echa a andar hasta acabar.
      if (a.edge) {
        a.edge.t -= dt;
        const out = a.edge.out;
        if (a.edge.t <= 0) a.edge = null;
        else if (out) {
          this.place(a, t);
          continue;
        }
      }
      if (a.chat && !a.path.length) this.talk(a, t);
      if (a.path.length || (a.pose === 'walk' && this.sliding(a))) this.walk(a, dt);
      else if (a.leaving) {
        if (!a.hero.visitor && !a.quit) this.away.add(a.hero.id);
        this.remove(a.hero.id);
        continue;
      } else if (a.homeward) {
        this.hide(a);
        continue;
      } else if ((a.wait -= dt) <= 0) this.decide(a);
      this.tell(a);
      this.place(a, t);
    }
  }

  /**
   * Si está parado dentro de la sala de su tarea y aún no se ha dicho, lo dice. Si sale de ella
   * (a dormir, a cenar), se olvida: al volver lo dirá otra vez.
   */
  private tell(a: Actor): void {
    // La sala a la que corre (un incidente) o, si no, la de su tarea.
    const w = a.hero.goTo ?? a.hero.work;
    if (!w || !this.inRoom(a, w)) {
      a.told = undefined;
      return;
    }
    if (a.path.length || a.pose === 'walk') return;
    // Ya dicho; si el núcleo aún le espera (otro día, sin haber salido de la sala), se repite.
    if (a.told === w && !(a.hero.due && this.now - (a.toldAt ?? 0) > 2)) return;
    a.told = w;
    a.toldAt = this.now;
    this.onArrive?.(a.hero.id, w);
  }

  /** Si alguien está dentro de una sala (en su planta de abajo, entre sus paredes). */
  private inRoom(a: Actor, room: string): boolean {
    const r = this.L?.rooms.find((x) => x.room.id === room);
    return !!r && a.floor === r.room.floor && a.x >= r.rect.x && a.x <= r.rect.x + r.rect.w;
  }

  /** Un sitio en medio de una sala, para ir a ella. */
  private roomPlace(room: string): Place | null {
    const r = this.L?.rooms.find((x) => x.room.id === room);
    if (!r) return null;
    const x = r.rect.x + r.rect.w / 2 + (this.rnd() - 0.5) * Math.min(30, r.rect.w / 3);
    return { x, floor: r.room.floor };
  }

  /** Si el pintor está ya en la sala que pinta (o no se le ve): entonces se ve avanzar la pared. */
  painterIn(id: string, room: string): boolean {
    const a = this.actors.get(id);
    return !a || a.gone || (!a.path.length && this.inRoom(a, room));
  }

  /** Si alguien ya ha llegado a una sala y está parado en ella (para quitar la marca). */
  arrived(id: string, room: string): boolean {
    const a = this.actors.get(id);
    if (!a || a.gone) return true;
    return !a.held && !a.path.length && a.pose !== 'walk' && this.inRoom(a, room);
  }

  /**
   * Quien ha pillado al ladrón le persigue un trecho (hasta `to`) y luego vuelve a lo suyo: el
   * héroe que está en la sala más cerca de `x`.
   */
  chase(x: number, floor: number, to: Place): void {
    let best: Actor | null = null;
    for (const a of this.actors.values()) {
      if (a.gone || a.held || a.leaving || a.hero.visitor || a.hero.bandit || a.hero.staff)
        continue;
      if (a.hero.status !== 'ok' || a.floor !== floor || Math.abs(a.x - x) > 80) continue;
      if (!best || Math.abs(a.x - x) < Math.abs(best.x - x)) best = a;
    }
    if (!best || this.scripted) return;
    this.go(best, { place: to, pose: 'stand' });
    best.run = RUSH;
    best.wait = 2.5;
  }

  /**
   * La persona que hay en un punto de la vista (en píxeles de la vista): la de delante entre las
   * que se ven justo ahí; si el dedo cae en el hueco de todas, la de delante de su recuadro.
   */
  hit(v: View, x: number, y: number): string | null {
    let best: { id: string; z: number; solid: boolean } | null = null;
    for (const a of this.actors.values()) {
      if (a.gone || a.quit) continue;
      const r = this.rectOf(a, v);
      if (!r || x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
      const z = this.depth(a);
      const solid = this.solidAt(a, v, x, y);
      if (!best || (solid && !best.solid) || (solid === best.solid && z < best.z))
        best = { id: a.hero.id, z, solid };
    }
    return best?.id ?? null;
  }

  /** Si en ese punto se ve algo de su dibujo (con un píxel de margen, que el dedo no es fino). */
  private solidAt(a: Actor, v: View, x: number, y: number): boolean {
    const f = this.frame(a, this.now);
    const k = scaleAt(f.z);
    const p0 = project(v, f.left, f.bottom - TALL / k, f.z);
    const p1 = project(v, f.left + CELL / k, f.bottom, f.z);
    const px = Math.floor(((x - p0.x) / (p1.x - p0.x)) * CELL);
    const py = Math.floor(((y - p0.y) / (p1.y - p0.y)) * TALL);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const qx = px + dx;
        const qy = py + dy;
        if (qx < 0 || qx >= CELL || qy < 0 || qy >= TALL) continue;
        const [cx, cy] = cellOf(f.frame);
        if (alpha(a.img.get(cx + qx, cy + qy))) return true;
      }
    return false;
  }

  /** Recuadro en pantalla (en píxeles de la vista) de lo que se ve de alguien. */
  screenRect(id: string, v: View): Rect | null {
    const a = this.actors.get(id);
    return a && !a.gone ? this.rectOf(a, v) : null;
  }

  /** Coge a alguien con el dedo: queda colgando bajo ese punto de la vista (en píxeles de la vista). */
  hold(id: string, v: View, sx: number, sy: number): void {
    const a = this.actors.get(id);
    if (!a || a.gone) return;
    if (!a.held) {
      this.seatFree(a);
      a.path = [];
      a.pose = 'stand';
      a.goal = null;
      a.edge = null;
      a.poi = null;
      this.endChat(a);
    }
    // A una profundidad fija la perspectiva es lineal: se deshace con dos puntos.
    const z = this.depth(a);
    const p0 = project(v, 0, 0, z);
    const p1 = project(v, 100, 100, z);
    const k = scaleAt(z);
    a.held = {
      x: ((sx - p0.x) * 100) / (p1.x - p0.x),
      y: ((sy - p0.y) * 100) / (p1.y - p0.y) + 16 / k,
    };
  }

  /** Lo suelta: en ese sitio (y de ahí va a lo suyo) o, si no vale, vuelve a donde estaba. */
  drop(id: string, p: Place | null): void {
    const a = this.actors.get(id);
    if (!a?.held) return;
    a.held = null;
    a.wait = 0;
    if (!p) return;
    // No aparece allí: sale de donde estaba y va a paso ligero (le llega su tarea por el camino).
    this.go(a, { place: p, pose: 'stand' });
    a.run = BRISK;
    a.wait = 0.5;
  }

  /** Quien está a la vista ahora mismo (ni fuera, ni en el pueblo, ni cogido con el dedo). */
  visible(): SceneHero[] {
    return [...this.actors.values()]
      .filter((a) => !a.gone && !a.held && !a.homeward)
      .map((a) => a.hero);
  }

  // ---------- Asalto: la escena lleva a cada uno ----------

  /** Empieza o acaba un asalto. Al acabar, los bandidos se van y cada uno vuelve a lo suyo. */
  setScripted(on: boolean): void {
    if (on === this.scripted) return;
    this.scripted = on;
    for (const a of this.actors.values()) {
      a.edge = null;
      a.poi = null;
      a.chat = null;
    }
    if (on) return;
    for (const a of [...this.actors.values()]) {
      if (a.hero.bandit) {
        this.remove(a.hero.id);
        continue;
      }
      a.run = undefined;
      a.swing = undefined;
      a.path = [];
      if (a.gone) continue;
      const g = this.homes.get(a.hero.id);
      if (this.time === 'night' && g) {
        // Acabado el asalto, cada uno vuelve andando a la cama.
        a.pose = 'stand';
        this.go(a, g);
      } else {
        a.pose = 'stand';
        a.goal = null;
        a.wait = this.rnd() * 2;
      }
    }
  }

  /** Un bandido que aparece en un sitio. */
  addBandit(id: string, look: SceneHero['look'], marks: SceneHero['marks'], p: Place): void {
    if (this.actors.has(id)) return;
    this.add({ id, name: 'Bandido', status: 'ok', look, marks, bandit: true });
    const a = this.actors.get(id)!;
    this.put(a, p);
    a.pose = 'stand';
  }

  /** Echa a correr hasta un sitio para llegar en `dur` segundos (si le da tiempo). */
  runTo(id: string, p: Place, dur: number): void {
    const a = this.actors.get(id);
    if (!a || a.gone || a.pose === 'down' || !this.L) return;
    this.standUp(a);
    const path = this.pathTo(a, p) ?? [p];
    let len = 0;
    let x = a.x;
    let f = a.floor;
    for (const q of path) {
      len +=
        q.floor !== f ? (Math.abs(floorY(q.floor) - floorY(f)) * SPEED) / CLIMB : Math.abs(q.x - x);
      x = q.x;
      f = q.floor;
    }
    a.run = Math.max(0.6, Math.min(4, len / Math.max(0.3, dur) / SPEED));
    a.path = path;
    a.goal = { place: p, pose: 'stand' };
    a.pose = 'walk';
  }

  /** Aparece directamente en un sitio (al saltarse el asalto). */
  warp(id: string, p: Place): void {
    const a = this.actors.get(id);
    if (!a || a.gone) return;
    this.standUp(a);
    a.path = [];
    this.put(a, p);
    if (a.pose === 'walk') a.pose = 'stand';
  }

  /**
   * Han ganado (un asalto): los que siguen en pie dan saltos con los brazos en alto donde están
   * y luego cada uno va a lo suyo andando.
   */
  cheerHere(ids: readonly string[]): void {
    for (const id of ids) {
      const a = this.actors.get(id);
      if (!a || a.gone || a.pose === 'down' || a.hero.bandit) continue;
      a.path = [];
      a.goal = null;
      a.pose = 'stand';
      a.cheer = this.now + 4;
      a.wait = 4 + this.rnd();
    }
  }

  /** Se levanta de la cama (o de la silla) de un salto. */
  wake(id: string): void {
    const a = this.actors.get(id);
    if (a) this.standUp(a);
  }

  /**
   * Cae al suelo. Con `push` (hacia dónde le echa el golpe), con su gesto: se tambalea hacia
   * atrás, se va al suelo de espaldas con un rebote y se queda tendido.
   */
  knock(id: string, push?: 1 | -1): void {
    const a = this.actors.get(id);
    if (!a) return;
    if (push && a.pose !== 'down') {
      a.fall = { t: 0, push };
      a.dir = push > 0 ? -1 : 1;
    }
    // En la escalera, cae al rellano más cercano.
    const c = a.climb;
    if (c) this.put(a, { x: a.x, floor: c.lower + (c.u > 0.5 ? 1 : 0) });
    a.path = [];
    a.goal = null;
    a.swing = 0;
    a.pose = 'down';
  }

  /** Da un golpe hacia un lado (el de su clase si no se dice cuál). */
  strike(id: string, dir: 1 | -1, blow?: Blow): void {
    const a = this.actors.get(id);
    if (!a || a.pose === 'down') return;
    a.dir = dir;
    a.swing = 1;
    a.blow = blow ?? blowOf(a.hero.look.outfit);
  }

  /** En guardia, de perfil hacia `dir` con el arma lista, durante `dur` segundos. */
  guardUp(id: string, dir: 1 | -1, dur = 0.3): void {
    const a = this.actors.get(id);
    if (!a || a.pose !== 'stand') return;
    a.guard = this.now + dur;
    if (!a.swing && !a.hurt) a.dir = dir;
  }

  /** Encaja un golpe: recula un poco, de perfil y echado hacia atrás (`dur` segundos). */
  flinch(id: string, push: 1 | -1, dur = HURT_TIME): void {
    const a = this.actors.get(id);
    if (!a || a.pose === 'down' || a.pose === 'bed' || a.pose === 'sit') return;
    a.hurt = { t: dur, push };
    a.dir = push > 0 ? -1 : 1;
  }

  /** El traje de alguien (para saber cómo pelea). */
  outfit(id: string): OutfitId | null {
    return this.actors.get(id)?.hero.look.outfit ?? null;
  }

  /** Se acerca un poco (para ponerse cara a cara con quien pelea). */
  nudge(id: string, dx: number): void {
    const a = this.actors.get(id);
    if (!a || a.path.length || a.pose === 'down') return;
    a.x += dx;
    a.dir = dx > 0 ? 1 : -1;
    a.dist += Math.abs(dx);
  }

  /** Dónde está alguien (los pies) y si va andando. */
  where(id: string): (Place & { y: number; moving: boolean; down: boolean }) | null {
    const a = this.actors.get(id);
    if (!a || a.gone) return null;
    return { x: a.x, floor: a.floor, y: a.y, moving: a.path.length > 0, down: a.pose === 'down' };
  }

  /**
   * Lo que le queda por andar a alguien: desde sus pies (donde está ahora, también a media
   * escalera) por cada punto de su camino. Null si no se le ve o ya no va a ningún sitio.
   */
  pathOf(id: string): { x: number; y: number }[] | null {
    const a = this.actors.get(id);
    if (!a || a.gone || a.held || !a.path.length) return null;
    return [{ x: a.x, y: a.y }, ...a.path.map((q) => ({ x: q.x, y: floorY(q.floor) }))];
  }

  /** Tendido en el suelo: hacia qué lado tiene la cabeza (y si ya ha acabado de caer). */
  lying(id: string): { head: 1 | -1; landed: boolean } | null {
    const a = this.actors.get(id);
    if (!a || a.gone || a.pose !== 'down') return null;
    return { head: a.dir > 0 ? -1 : 1, landed: !a.fall };
  }

  /**
   * Cómo se le ve ahora: de frente (quieto, parpadeando, celebrando…) o de perfil (andando,
   * golpeando, charlando), y hacia dónde mira el dibujo. Para poner lo que lleva en la mano.
   */
  pose(id: string): { front: boolean; dir: 1 | -1 } | null {
    const a = this.actors.get(id);
    if (!a || a.gone || a.pose === 'down' || a.pose === 'bed' || a.pose === 'sit') return null;
    const f = this.frame(a, this.now).frame;
    const front =
      f === F.idle ||
      f === F.idle + 1 ||
      f === F.blink ||
      f === F.cheer ||
      f === F.stretch ||
      f === F.yawn ||
      f === F.read ||
      f === F.read + 1;
    return { front, dir: a.dir };
  }

  /**
   * El de guardia sentado en su puesto: de día, si está plantando la carta (`slam`, un momento
   * de cada `GAME_CYCLE`); de noche, cuánto se ha hundido cabeceando (`nod`, en píxeles) y si
   * está dormido (`dozing`). Null si no está sentado en su taburete.
   */
  private guardBeat(
    a: Actor,
  ): { night: boolean; slam: boolean; nod: number; dozing: boolean } | null {
    if (!a.hero.guard || a.pose !== 'sit' || a.path.length || a.seatMove || !this.S) return null;
    if (!this.S.guard.some((p) => p.x === a.goal?.place.x && p.floor === a.goal.place.floor))
      return null;
    const off = (hash(a.hero.id) % 97) / 13;
    // A la hora de la siesta, el que cabecea (el núcleo deja que se le cuele el ladrón) se pinta
    // como de madrugada.
    if (this.time === 'day' && this.napper !== a.hero.id) {
      const p = (this.now + off) % GAME_CYCLE;
      return { night: false, slam: p < 0.22, nod: 0, dozing: false };
    }
    const p = ((this.now + off) % NOD_CYCLE) / NOD_CYCLE;
    return {
      night: true,
      slam: false,
      nod: p < 0.85 ? Math.floor((p / 0.85) * 3) : 0,
      dozing: p < 0.85,
    };
  }

  /**
   * Los de guardia sentados en su puesto (la escena pinta los dados que ruedan cuando plantan la
   * carta y las «zzz» de quien cabecea de madrugada): dónde, y qué está pasando.
   */
  guards(): {
    id: string;
    x: number;
    y: number;
    z: number;
    night: boolean;
    slam: boolean;
    dozing: boolean;
  }[] {
    const out = [];
    for (const a of this.actors.values()) {
      if (a.gone) continue;
      const g = this.guardBeat(a);
      if (g)
        out.push({
          id: a.hero.id,
          x: a.x,
          y: a.y,
          z: a.lane,
          night: g.night,
          slam: g.slam,
          dozing: g.dozing,
        });
    }
    return out;
  }

  /** Si alguien está delante (más cerca que `z`) de un punto del mundo y lo tapa. */
  /** La x de quien esté más cerca de `x` en la planta `floor` (a menos de `r`), o null. */
  near(x: number, floor: number, r: number): number | null {
    let best: number | null = null;
    for (const a of this.actors.values()) {
      if (a.gone || a.floor !== floor || a.pose === 'bed') continue;
      const d = Math.abs(a.x - x);
      if (d < r && (best === null || d < Math.abs(best - x))) best = a.x;
    }
    return best;
  }

  covers(x: number, y: number, z: number): boolean {
    for (const a of this.actors.values())
      if (!a.gone && a.lane < z && Math.abs(a.x - x) < 7 && y <= a.y && y >= a.y - 26) return true;
    return false;
  }

  /** Desaparece de la escena (un bandido que se pierde por el camino). */
  vanish(id: string): void {
    this.remove(id);
  }

  private standUp(a: Actor): void {
    a.edge = null;
    a.poi = null;
    this.endChat(a);
    if (a.pose !== 'bed' && a.pose !== 'sit') return;
    this.seatFree(a);
    a.goal = null;
    a.pose = 'stand';
  }

  /** Los trabajos de taller en marcha, por sala (la escena los da en cada fotograma). */
  private crafts = new Map<
    string,
    { undo: boolean; stalled: boolean; hero?: string; walking?: boolean }
  >();
  /** Los héroes a los que están vistiendo, y en qué sala. */
  private dressing = new Map<string, string>();
  /** Golpes que han sonado este fotograma (martillazo en el yunque, temple en la artesa). */
  hits: Hit[] = [];
  /** Los que acaban de contratarse (la escena les pone el destello y las monedas). */
  hired: string[] = [];

  setCrafts(
    list: readonly {
      room: string;
      undo: boolean;
      stalled: boolean;
      hero?: string;
      walking?: boolean;
    }[],
  ): void {
    this.crafts.clear();
    this.dressing.clear();
    // Con dos a la vez en la sala: se desmonta si los dos son desmontar, parado si los dos lo
    // están, y se viste si se viste a alguien.
    for (const c of list) {
      const was = this.crafts.get(c.room);
      this.crafts.set(c.room, {
        undo: c.undo && (was?.undo ?? true),
        stalled: c.stalled && (was?.stalled ?? true),
        hero: was?.hero ?? c.hero,
        walking: was?.hero ? was.walking : c.walking,
      });
      if (c.hero) this.dressing.set(c.hero, c.room);
    }
  }

  /** Los sitios de las salas a los que la gente va a hacer algo (los da la escena al montarse). */
  setPois(list: Poi[]): void {
    if (JSON.stringify(list) === JSON.stringify(this.pois)) return;
    this.pois = list;
    for (const a of this.actors.values()) a.poi = null;
  }

  /**
   * Los bocadillos que se ven ahora: quien habla en cada charla (por turnos) y, de vez en cuando,
   * los visitantes sentados que piden algo o los héroes que brindan.
   */
  bubbles(): { id: string; talk: Talk }[] {
    const out: { id: string; talk: Talk }[] = [];
    if (this.time !== 'day' || this.scripted) return out;
    const t = this.now;
    for (const a of this.actors.values()) {
      if (a.gone || a.held) continue;
      const c = a.chat;
      if (c && c.from && t >= c.from && t < c.until) {
        const turn = Math.floor((t - c.from) / TURN);
        // Habla uno y luego el otro; entre frase y frase, un respiro.
        const speaker =
          turn % 2 === 0 ? (a.hero.id < c.with ? a : null) : a.hero.id > c.with ? a : null;
        if (speaker && (t - c.from) % TURN < TURN * 0.8)
          out.push({
            id: a.hero.id,
            talk: CHAT[(hash(a.hero.id + c.with) + turn * 7) % CHAT.length]!,
          });
        continue;
      }
      if (a.pose !== 'sit') continue;
      // Sentados: cada uno a su ritmo, un momento cada poco.
      const k = (t + (hash(a.hero.id) % 50)) % 11;
      if (k < 1.4) {
        const list = a.hero.visitor
          ? ORDER
          : a.hero.guard
            ? GAME
            : (['jarra', 'risa', 'nota'] as Talk[]);
        out.push({
          id: a.hero.id,
          talk: list[(hash(a.hero.id) + Math.floor(t / 11)) % list.length]!,
        });
      }
    }
    return out;
  }

  nameOf(id: string): string {
    return this.actors.get(id)?.hero.name ?? '';
  }

  /** Lo que se lee al pasar el ratón: el nombre y, en otra línea, quién es. */
  hoverOf(id: string): string {
    const h = this.actors.get(id)?.hero;
    if (!h) return '';
    const sub = h.title ?? (h.visitor ? 'De visita en el salón' : '');
    return sub ? `${h.name}\n${sub}` : h.name;
  }

  dispose(): void {
    this.group.clear();
    this.look.dispose();
    this.geo.dispose();
    this.actors.clear();
    this.ladders.clear();
  }

  // ---------- Por dentro ----------

  private add(h: SceneHero, walkIn = false): void {
    const spr = heroSprites(h.look, h.marks);
    const k = scaleAt(LANES[0]);
    const img = atlas(spr, h);
    const mat = this.look.surface(img, [at(0, 0, 0), at(1, 0, 0), at(1, -1, 0), at(0, -1, 0)], {
      ambient: [0.44, 0.38, 0.46],
      sun: 0,
      wrap: 0.6,
      dither: 0.03,
      halo: 0.3,
      noWeather: true,
    });
    // Un fotograma de la rejilla: 1/COLS de ancho y 1/ROWS de alto.
    mat.uniforms.uUvScale!.value.set(1 / COLS, 1 / ROWS);
    // Delante de lo que esté a su misma profundidad (el taburete, la cama).
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -4;
    const m = mesh(this.geo, mat);
    m.scale.set(CELL / k, TALL / k, 1);
    this.group.add(m);
    const start = this.homes.get(h.id)?.place ?? this.S?.door ?? { x: 12, floor: 0 };
    const a: Actor = {
      hero: h,
      img,
      mat,
      mesh: m,
      x: start.x,
      y: floorY(start.floor),
      floor: start.floor,
      lane: LANES[hash(h.id) % LANES.length]!,
      home: LANES[hash(h.id) % LANES.length]!,
      path: [],
      goal: null,
      pose: 'stand',
      wait: this.rnd() * 2,
      dir: 1,
      dist: 0,
      blinkAt: this.rnd() * 4,
      seat: null,
      leaving: false,
      homeward: false,
      gone: false,
      sat: 0,
    };
    this.actors.set(h.id, a);
    if (h.visitor || h.bandit) return;
    if (walkIn && this.S && !this.away.has(h.id)) {
      // Llega de fuera: de día entra por el patio; de noche, viene por la mañana.
      if (this.time === 'night') this.hide(a);
      else {
        this.put(a, outside());
        a.wait = 0;
      }
      return;
    }
    if (this.village(a) && this.time !== 'day') {
      // De noche, los del pueblo están en su casa.
      this.hide(a);
      return;
    }
    if (this.away.delete(h.id) && this.S) {
      // Vuelve de misión: entra por la puerta desde el patio.
      this.put(a, outside());
      a.wait = 0;
      return;
    }
    // Al aparecer de día ya está en algún sitio de la casa; de noche, en su cama.
    if (this.S && h.status === 'ok' && !h.guard && this.time === 'day') {
      const g = this.workOf(a) ?? wander(this.S, this.taken(), this.rnd);
      if (g && route(this.L!, start, g.place, this.segs)) {
        this.put(a, g.place);
        this.arrive(a, g);
      }
    } else {
      const g = this.homes.get(h.id);
      if (g) this.arrive(a, g);
    }
  }

  /** Le pone su dibujo de nuevo (el atlas entero), en el mismo material. */
  private reskin(a: Actor): void {
    a.img = atlas(heroSprites(a.hero.look, a.hero.marks), a.hero);
    const u = a.mat.uniforms.map!;
    (u.value as { dispose(): void }).dispose();
    u.value = texture(a.img);
  }

  private remove(id: string): void {
    const a = this.actors.get(id);
    if (!a) return;
    this.group.remove(a.mesh);
    a.mat.dispose();
    (a.mat.uniforms.map!.value as { dispose(): void }).dispose();
    this.actors.delete(id);
  }

  private rehome(): void {
    if (!this.S) return;
    const people = [...this.actors.values()]
      .filter((a) => !a.hero.visitor)
      .map((a) => ({
        id: a.hero.id,
        status: a.hero.status,
        guard: a.hero.guard,
        staff: a.hero.staff,
      }));
    this.homes = homes(people, this.S);
  }

  private taken(): Set<SeatSpot> {
    const out = new Set<SeatSpot>();
    for (const a of this.actors.values()) if (a.seat) out.add(a.seat);
    return out;
  }

  private seatFree(a: Actor): void {
    a.seat = null;
  }

  /** Del pueblo y sin cama en el servicio: duerme en su casa. */
  private village(a: Actor): boolean {
    return a.hero.staff === 'pueblo' || (a.hero.staff === 'casa' && !this.homes.has(a.hero.id));
  }

  /**
   * Si alguien está trabajando en su puesto ahora mismo (de día, parado en su sala): con qué
   * herramienta, en qué tiempo de la vuelta y hacia dónde mira.
   */
  private jobAnim(a: Actor): { slot: number; pose: number; dir: 1 | -1 } | null {
    const h = a.hero;
    if (!h.work || h.status !== 'ok' || h.guard || this.time !== 'day' || this.scripted)
      return null;
    if (a.path.length || a.held || a.leaving || a.pose !== 'stand' || a.edge) return null;
    const job = this.S?.jobs.get(h.work);
    // En la cocina y la bodega, lo que toque de su rutina (o nada, en el rato quieto); el
    // pintor, también en la sala que pinta.
    if ((job && ROUTINE.has(job.room.type)) || this.paints.has(h.id)) {
      const tk = a.task;
      if (!tk || Math.abs(a.x - tk.at) > 16) return null;
      const w: Work = WORK[tk.work];
      const cycle = w.steps.reduce((s, x) => s + x[2], 0);
      const tt = this.now + (hash(h.id) % 89) / 11;
      let p = tt % cycle;
      let pose = 0;
      while (pose < w.steps.length - 1 && p >= w.steps[pose]![2]) p -= w.steps[pose++]![2];
      // El golpe en el yunque o la pieza en el agua: una vez por vuelta (chispas, vapor y sonido).
      const turn = Math.floor(tt / cycle);
      const hit = HITS[tk.work];
      if (pose === 1 && hit && a.hitAt !== turn) {
        a.hitAt = turn;
        this.hits.push({ x: tk.at, y: floorY(a.floor), z: a.lane, kind: hit });
      }
      return { slot: SLOT[tk.work], pose, dir: tk.face };
    }
    // En el salón, junto a la barra, con el trapo.
    const wiping =
      job?.room.type === 'salon' &&
      this.S!.bar.some((b) => b.floor === a.floor && Math.abs(b.x - a.x) < 6);
    const key = (wiping ? 'barra' : job?.room.type) as WorkId | undefined;
    const w: Work | undefined = key && key in WORK ? WORK[key] : undefined;
    if (!job || !w || a.floor !== job.room.floor || a.x < job.x0 - 8 || a.x > job.x1 + 8)
      return null;
    const cycle = w.steps.reduce((a, s) => a + s[2], 0);
    let p = (this.now + (hash(h.id) % 89) / 11) % cycle;
    let pose = 0;
    while (pose < w.steps.length - 1 && p >= w.steps[pose]![2]) p -= w.steps[pose++]![2];
    // En el salón, hacia la mesa más cercana; en las demás, hacia el centro de la sala.
    let to = (job.x0 + job.x1) / 2;
    if (wiping) to = a.x + 1;
    else if (job.room.type === 'salon') {
      let best = Infinity;
      for (const s of this.S!.seats)
        if (s.floor === a.floor && Math.abs(s.x - a.x) < best) {
          best = Math.abs(s.x - a.x);
          to = s.x;
        }
    }
    return { slot: SLOT[key!], pose, dir: to >= a.x ? 1 : -1 };
  }

  /** De pie en la barra del salón (y sin otra cosa que hacer): con su jarra. */
  private atBar(a: Actor): boolean {
    if (!this.S || a.hero.visitor || a.chat) return false;
    return this.S.bar.some((b) => b.floor === a.floor && Math.abs(b.x - a.x) < 7);
  }

  /**
   * La rutina del servicio en la cocina y la bodega: de mueble en mueble (la olla, la mesa, el
   * horno, la cuba, el barril…), haciendo en cada uno lo suyo un rato y, a veces, un rato quieto
   * en medio. Devuelve si se ha encargado (si no, el puesto de siempre).
   */
  private taskTurn(a: Actor): boolean {
    const j = this.S?.jobs.get(a.hero.work!);
    if (!j || !ROUTINE.has(j.room.type) || !this.L) return false;
    const craft = this.crafts.get(j.room.id);
    if (WORKSHOP.has(j.room.type) && !craft) {
      a.task = null;
      a.wait = 4 + this.rnd() * 4;
      return true;
    }
    const inRoom = (p: Poi) => p.floor === j.room.floor && p.x >= j.x0 - 24 && p.x <= j.x1 + 24;
    const here = this.pois.filter(
      (p) => !LEISURE.has(p.kind) && p.kind !== 'probador' && inRoom(p),
    );
    // Vistiendo a un héroe: él, de pie en el probador (junto al maniquí o al espejo); quien
    // cose, a su lado, trabajando sobre él (le mide, le prueba la tela, le cose el bajo).
    const fit = this.pois.find((p) => p.kind === 'probador' && inRoom(p));
    if (this.dressing.get(a.hero.id) === j.room.id) {
      if (!fit) return false;
      if (Math.abs(a.x - fit.x) > 2 || a.floor !== fit.floor) {
        const place = { x: fit.x, floor: fit.floor };
        if (!route(this.L, { x: a.x, floor: a.floor }, place, this.segs)) return false;
        this.go(a, { place, pose: 'stand', stand: fit.z !== undefined ? fit.z - 10 : undefined });
      }
      a.task = null;
      a.wait = 5;
      return true;
    }
    const who = craft?.hero ? this.actors.get(craft.hero) : undefined;
    const ready =
      !!fit &&
      !!who &&
      !who.gone &&
      !who.path.length &&
      who.floor === fit.floor &&
      Math.abs(who.x - fit.x) < 4;
    // El héroe aún va de camino: quien cose le espera junto al probador, mirando por donde
    // llega y preparando la cinta (no cose hasta que está aquí).
    if (fit && craft?.hero && !ready && (craft.walking || (who && !who.gone))) {
      a.fit = 0;
      if (this.awaitFitting(a, fit, who)) return true;
    }
    if (fit && ready && (a.fit! < FIRST_FIT.length || this.rnd() < 0.85)) {
      // Al llegar: primero le mide, luego le prueba la tela y le cose el bajo; después, a ratos
      // cualquiera de las tres (y alguna vez, a la mesa o al maniquí).
      const n = a.fit ?? 0;
      const work =
        n < FIRST_FIT.length ? FIRST_FIT[n]! : FITTING[Math.floor(this.rnd() * FITTING.length)]!;
      const side = n > 0 && a.task?.at === who!.x ? -a.task.face : this.rnd() < 0.5 ? -1 : 1;
      const place = { x: who!.x + side * 11, floor: fit.floor };
      if (route(this.L, { x: a.x, floor: a.floor }, place, this.segs)) {
        this.go(a, { place, pose: 'stand', stand: fit.z !== undefined ? fit.z - 10 : undefined });
        a.task = { at: who!.x, work, face: side > 0 ? -1 : 1 };
        a.fit = n + 1;
        a.wait = n < FIRST_FIT.length ? 5 + this.rnd() * 2 : 5 + this.rnd() * 5;
        return true;
      }
    }
    if (!craft?.hero) a.fit = 0;
    // Desmontando, al banco (donde no lo hay, al yunque, la mesa de cortar o el alambique);
    // creando, a todo lo demás.
    const undoAt = UNDO_AT.find((k) => here.some((p) => p.kind === k));
    const spots = here.filter(
      (p) => !WORKSHOP.has(j.room.type) || (craft!.undo ? p.kind === undoAt : p.kind !== 'banco'),
    );
    if (!spots.length) return false;
    // Un rato quieto entre tarea y tarea: se seca la frente, mira alrededor.
    if (a.task && this.rnd() < 0.3) {
      a.task = null;
      a.wait = 2 + this.rnd() * 3;
      return true;
    }
    const busy = new Set(
      [...this.actors.values()].filter((x) => x !== a && x.task).map((x) => Math.round(x.task!.at)),
    );
    const free = spots.filter((p) => !busy.has(Math.round(p.x)) && p.x !== a.task?.at);
    const pool = free.length ? free : spots;
    const p = pool[Math.floor(this.rnd() * pool.length)]!;
    const works = TASKS[p.kind as TaskPoi];
    const work = works[Math.floor(this.rnd() * works.length)]!;
    // A un lado del mueble, mirándolo (al yunque, de costado, para que se vea el golpe).
    const side = this.rnd() < 0.5 ? -1 : 1;
    const off = p.kind === 'yunque' ? p.half + 3 : Math.min(p.half * 0.45, 9);
    const x = p.x + side * off + (this.rnd() - 0.5) * 2;
    const place = { x, floor: p.floor };
    if (!route(this.L, { x: a.x, floor: a.floor }, place, this.segs)) return false;
    this.go(a, { place, pose: 'stand', stand: p.z !== undefined ? p.z - 10 : undefined });
    a.task = { at: p.x, work, face: side > 0 ? -1 : 1 };
    a.wait = 6 + this.rnd() * 8;
    return true;
  }

  /**
   * Esperando al héroe que viene a vestirse: a un lado del probador, el que da a por donde llega
   * (hacia él si está en la planta; si no, hacia la escalera de su camino), mirando hacia allí; a
   * ratos estira la cinta de medir y a ratos solo mira. Vuelve a mirar cada poco (por si llega).
   */
  private awaitFitting(a: Actor, fit: Poi, who: Actor | undefined): boolean {
    if (!this.L) return false;
    let toward = a.x;
    if (who && !who.gone) {
      if (who.floor === fit.floor) toward = who.x;
      else {
        const way = route(this.L, { x: fit.x, floor: fit.floor }, who, this.segs);
        toward = way?.find((q) => Math.abs(q.x - fit.x) > 2)?.x ?? who.x;
      }
    }
    const side: 1 | -1 = toward >= fit.x ? 1 : -1;
    const place = { x: fit.x + side * 11, floor: fit.floor };
    if (a.floor !== fit.floor || Math.abs(a.x - place.x) > 2) {
      if (!route(this.L, { x: a.x, floor: a.floor }, place, this.segs)) return false;
      this.go(a, { place, pose: 'stand', stand: fit.z !== undefined ? fit.z - 10 : undefined });
      a.task = null;
      a.wait = 0.3;
      return true;
    }
    a.dir = side;
    a.task = this.rnd() < 0.5 ? { at: a.x, work: 'medir', face: side } : null;
    a.wait = 1.5 + this.rnd() * 1.5;
    return true;
  }

  /** Va a hacer algo a un sitio de una sala que nadie está usando (si hay). */
  private goPoi(a: Actor): boolean {
    const used = new Set(
      [...this.actors.values()].filter((x) => x.poi && x !== a).map((x) => Math.round(x.x)),
    );
    const free = this.pois.filter(
      (p) => LEISURE.has(p.kind) && ![-12, 0, 12].some((d) => used.has(Math.round(p.x + d))),
    );
    const p = free[Math.floor(this.rnd() * free.length)];
    if (!p) return false;
    // Para calentarse, a un lado del fuego, mirándolo; para leer o rezar, delante.
    const side = this.rnd() < 0.5 ? -1 : 1;
    const x = p.kind === 'warm' ? p.x + side * Math.min(p.half, 14) : p.x + (this.rnd() - 0.5) * 6;
    const place = { x, floor: p.floor };
    if (!this.L || !route(this.L, { x: a.x, floor: a.floor }, place, this.segs)) return false;
    this.go(a, { place, pose: 'stand', stand: p.z !== undefined ? p.z - 10 : undefined });
    a.poi = { kind: p.kind, dir: side > 0 ? -1 : 1 };
    a.wait = 7 + this.rnd() * 8;
    return true;
  }

  /** Busca a alguien con quien charlar en su misma planta y se acerca a su lado. */
  private chatWith(a: Actor): boolean {
    const free = (x: Actor) =>
      x !== a &&
      !x.gone &&
      !x.held &&
      !x.leaving &&
      !x.homeward &&
      !x.chat &&
      !x.edge &&
      !x.path.length &&
      !x.hero.bandit &&
      (x.pose === 'stand' || x.pose === 'sit') &&
      x.floor === a.floor &&
      Math.abs(x.x - a.x) < 220 &&
      !this.jobAnim(x) &&
      !this.drillOf(x);
    const list = [...this.actors.values()].filter(free);
    const b = list[Math.floor(this.rnd() * list.length)];
    if (!b || !this.L) return false;
    const side = a.x < b.x ? -1 : 1;
    const place = { x: b.x + side * 15, floor: b.floor };
    if (!route(this.L, { x: a.x, floor: a.floor }, place, this.segs)) return false;
    this.go(a, { place, pose: 'stand', stand: b.lane + (this.rnd() - 0.5) * 3 });
    a.chat = { with: b.hero.id, from: 0, until: this.now + 20 };
    // El otro espera: que no se vaya mientras llega.
    b.wait = Math.max(b.wait, 12);
    b.chat = { with: a.hero.id, from: 0, until: this.now + 20 };
    a.wait = 30;
    return true;
  }

  /** Charlando: al llegar empieza la conversación; al acabar, cada uno sigue a lo suyo. */
  private talk(a: Actor, t: number): void {
    const c = a.chat!;
    const b = this.actors.get(c.with);
    if (!b || b.gone || b.held || b.leaving || b.chat?.with !== a.hero.id || t > c.until) {
      this.endChat(a);
      return;
    }
    if (!c.from) {
      // Quien va hacia el otro empieza al llegar; el que espera, a la vez.
      if (b.path.length) return;
      const len = 5 + this.rnd() * 5;
      c.from = b.chat!.from = t;
      b.poi = null;
      c.until = b.chat!.until = t + len;
      a.wait = Math.max(a.wait, len + 0.5);
      b.wait = Math.max(b.wait, len + 0.5);
    }
    if (a.pose === 'stand') a.dir = b.x >= a.x ? 1 : -1;
  }

  /** Acaba la charla de alguien (y la del otro). */
  private endChat(a: Actor): void {
    const c = a.chat;
    if (!c) return;
    a.chat = null;
    const b = this.actors.get(c.with);
    if (b?.chat?.with === a.hero.id) {
      b.chat = null;
      b.wait = Math.min(b.wait, 1 + this.rnd() * 2);
    }
    a.wait = Math.min(a.wait, 1 + this.rnd() * 2);
  }

  /**
   * Si alguien está entrenando ahora mismo (de día, parado en su sala de entrenamiento): cómo y
   * por dónde va de la vuelta de su animación (cada uno con su desfase, para que no vayan a la par).
   */
  private drillOf(a: Actor): { kind: Drill; p: number; n: number } | null {
    const h = a.hero;
    if (!h.work || h.status !== 'ok' || h.guard || this.time !== 'day' || this.scripted)
      return null;
    if (a.path.length || a.held || a.leaving || a.pose !== 'stand') return null;
    const job = this.S?.jobs.get(h.work);
    const kind = job ? DRILLS[job.room.type] : undefined;
    if (!job || !kind || a.floor !== job.room.floor || a.x < job.x0 - 8 || a.x > job.x1 + 8)
      return null;
    const t = this.now + (hash(h.id) % 97) / 13;
    // Cada vuelta, uno de los ejercicios (en la sala de armas: tajo, de arriba abajo o estocada).
    const n = Math.floor(t / DRILL_CYCLE[kind]) + hash(h.id);
    return { kind, p: t % DRILL_CYCLE[kind], n };
  }

  /** Las flechas en el aire de la sala de tiro (en píxeles de la vista): la punta y hacia dónde va. */
  arrows(v: View): { x: number; y: number; dir: 1 | -1; k: number }[] {
    const out: { x: number; y: number; dir: 1 | -1; k: number }[] = [];
    for (const a of this.actors.values()) {
      if (a.gone) continue;
      const d = this.drillOf(a);
      if (d?.kind !== 'tiro' || d.p < LOOSE_AT || d.p >= LOOSE_AT + ARROW_TIME) continue;
      const job = this.S!.jobs.get(a.hero.work!)!;
      const dir = DRILL_DIR;
      const f = this.frame(a, this.now);
      const k = scaleAt(f.z);
      // Sale de la mano que apunta y llega casi a la pared del otro lado.
      const cx = 3 + HAND.thrust.x;
      const hx = f.left + (dir > 0 ? cx : CELL - 1 - cx) / k;
      const hy = f.bottom - (TALL - HAND.thrust.y) / k;
      // Hasta las dianas, en el primer tramo de la pared.
      const end = dir > 0 ? job.x1 - 10 : job.x0 + 10;
      const t = (d.p - LOOSE_AT) / ARROW_TIME;
      const p = project(v, hx + (end - hx) * t, hy, f.z);
      out.push({ x: p.x, y: p.y, dir, k: scaleAt(f.z) });
    }
    return out;
  }

  /** Si hay alguien entrenando a la vista (la capa de encima tiene que repintarse). */
  drilling(): boolean {
    for (const a of this.actors.values()) if (!a.gone && this.drillOf(a)) return true;
    return false;
  }

  /** Ya se ha ido a su casa del pueblo: no se ve hasta mañana. */
  private hide(a: Actor): void {
    a.poi = null;
    this.endChat(a);
    a.homeward = false;
    a.gone = true;
    a.path = [];
    a.goal = null;
    a.mesh.visible = false;
    this.seatFree(a);
  }

  /** A qué puesto va alguien que trabaja en una sala (si es de día y está en casa). */
  private workOf(a: Actor): Goal | null {
    const h = a.hero;
    if (!this.S || !h.work || this.time !== 'day' || h.status !== 'ok' || h.guard) return null;
    const mates = [...this.actors.values()].filter((x) => x.hero.work === h.work);
    const g = workGoal(this.S, h.work, mates.indexOf(a), mates.length, this.rnd);
    const job = this.S.jobs.get(h.work);
    // En la sala de tiro se apunta desde la mitad de la derecha, lejos de las dianas.
    if (g && job?.room.type === 'tiro')
      g.place.x = job.x0 + (job.x1 - job.x0) * 0.5 + (g.place.x - job.x0) * 0.5;
    return g;
  }

  /** Qué hace ahora alguien que está parado. */
  private decide(a: Actor): void {
    if (!this.S) return;
    const h = a.hero;
    if (h.visitor) {
      a.wait = 999;
      return;
    }
    if (this.time !== 'day' && this.village(a)) {
      // Se acabó el día: vuelve al pueblo por el patio.
      a.homeward = true;
      this.go(a, { place: outside(), pose: 'stand' });
      return;
    }
    // A arreglar algo: corriendo a esa sala y allí se queda hasta que se arregla.
    const to = h.goTo ? this.roomPlace(h.goTo) : null;
    if (to && h.status === 'ok') {
      a.task = null;
      a.wait = 2;
      if (this.inRoom(a, h.goTo!)) return;
      this.go(a, { place: to, pose: 'stand' });
      a.run = Math.max(a.run ?? 1, RUSH);
      return;
    }
    // El pintor que tiene una sala que pintar, a ella.
    if (this.paintTurn(a)) return;
    const home = this.homes.get(h.id);
    const job = this.workOf(a);
    if (!job) a.task = null;
    if (job && this.taskTurn(a)) return;
    if (job) {
      // En el salón van de mesa en mesa; en las demás salas, cada uno a lo suyo.
      a.wait = 4 + this.rnd() * 8;
      if (Math.abs(job.place.x - a.x) < 4 && job.place.floor === a.floor) return;
      this.go(a, job);
      return;
    }
    const free = h.status === 'ok' && !h.guard && this.time === 'day';
    // Los libres, a veces, van a charlar con alguien o a hacer algo en un sitio de una sala.
    if (free && !h.visitor) {
      const r = this.rnd();
      if (r < 0.22 && this.chatWith(a)) return;
      if (r < 0.45 && this.goPoi(a)) return;
    }
    const g = free ? wander(this.S, this.taken(), this.rnd) : home;
    // Paseando, a cualquier profundidad de la sala (por delante de los muebles).
    if (free && g && g.pose === 'stand') g.stand = NEAR_Z + this.rnd() * 18;
    a.wait = free ? 5 + this.rnd() * 9 : 3 + this.rnd() * 3;
    if (!g) return;
    // Si ya está ahí, se queda.
    if (Math.abs(g.place.x - a.x) < 4 && g.place.floor === a.floor && g.pose === a.pose) return;
    this.go(a, g);
  }

  private go(a: Actor, g: Goal, keep = false): void {
    // Si estaba acostado, primero se incorpora un momento.
    if (a.pose === 'bed' && a.goal?.bed && !this.scripted && !a.held)
      a.edge = { bed: a.goal.bed, t: 0.9, out: true };
    // Si estaba sentado, primero se levanta (el taburete se suelta al empezar).
    if (a.pose === 'sit' && !this.scripted && !a.held) a.seatMove = { t: SEAT_TIME, up: true };
    if (!keep) {
      a.poi = null;
      this.endChat(a);
    }
    this.seatFree(a);
    const path = this.pathTo(a, g.place);
    if (!path) {
      // No hay camino (se ha quedado en una sala que ya no está): aparece en su sitio.
      this.put(a, g.place);
      this.arrive(a, g);
      return;
    }
    a.goal = g;
    a.path = path;
    a.pose = 'walk';
    // De pie, a la profundidad que pida el destino o, si no pide ninguna, a la suya de siempre.
    a.laneTo =
      g.pose === 'stand' ? Math.max(NEAR_Z, Math.min(FAR_Z, g.stand ?? a.home)) : undefined;
    if (g.pose === 'sit' && this.S) a.seat = this.S.seats.find((s) => s.x === g.place.x) ?? null;
  }

  /** Camino hasta `p`; a media escalera, acaba antes el tramo en el que está. */
  private pathTo(a: Actor, p: Place): Place[] | null {
    if (!this.L) return null;
    const c = a.climb;
    const mid = c ? { x: c.sx + STAIR_W / 2, floor: c.up ? c.lower + 1 : c.lower } : null;
    const rest = route(this.L, mid ?? { x: a.x, floor: a.floor }, p, this.segs);
    return mid && rest ? [mid, ...rest] : rest;
  }

  private arrive(a: Actor, g: Goal): void {
    if (g.pose === 'sit' && a.pose !== 'sit' && !this.scripted)
      a.seatMove = { t: SEAT_TIME, up: false };
    a.pose = g.pose;
    a.goal = g;
    if (g.pose === 'sit' && this.S)
      a.seat = this.S.seats.find((s) => s.x === g.place.x && s.floor === g.place.floor) ?? null;
  }

  private put(a: Actor, p: Place): void {
    a.x = p.x;
    a.floor = p.floor;
    a.y = floorY(p.floor);
    a.climb = null;
  }

  private walk(a: Actor, dt: number): void {
    this.slide(a, dt);
    if (!a.path.length) {
      // Ya en su x: le queda ponerse a su profundidad (da unos pasos hacia dentro o fuera).
      if (!this.sliding(a)) this.reach(a);
      return;
    }
    const next = a.path[0]!;
    const run = a.run ?? 1;
    if (next.floor !== a.floor) {
      // Escalera: primero al pie del tramo (o arriba, si baja) y luego peldaño a peldaño.
      const up = next.floor > a.floor;
      const lower = Math.min(a.floor, next.floor);
      const sx = next.x - STAIR_W / 2;
      if (!a.climb) {
        const start = stepAt(sx, lower, up ? 0 : STEPS);
        const dx = start.x - a.x;
        const step = SPEED * run * dt;
        a.dist += step;
        if (Math.abs(dx) > step) {
          a.x += Math.sign(dx) * step;
          a.dir = dx > 0 ? 1 : -1;
        } else {
          a.x = start.x;
          a.climb = { lower, sx, up, u: up ? 0 : 1 };
        }
      }
      const c = a.climb;
      if (c) {
        const step = CLIMB * run * dt;
        a.dist += step;
        c.u = Math.max(0, Math.min(1, c.u + ((up ? 1 : -1) * step) / PITCH));
        // Mira hacia donde va el tramo (al bajar, al revés que al subir).
        a.dir = goesRight(lower) === up ? 1 : -1;
        const s = c.u * STEPS;
        const i = Math.min(STEPS - 1, Math.floor(s));
        const p0 = stepAt(sx, lower, i);
        const p1 = stepAt(sx, lower, i + 1);
        // Cada peldaño: un impulso rápido y un momento quieto en él.
        const f = smoothstep(Math.min(1, (s - i) / LIFT));
        a.x = p0.x + (p1.x - p0.x) * f;
        a.y = p0.y + (p1.y - p0.y) * f;
        if (c.u === (up ? 1 : 0)) {
          a.climb = null;
          a.floor = next.floor;
          a.y = floorY(next.floor);
          a.path.shift();
        }
      }
    } else {
      // Desde un mueble de la pared: primero sale hacia fuera (sin moverse de lado).
      if (!this.scripted && !a.climb && a.lane > WALK_Z + 0.5 && this.crossing(a)) {
        a.dist += Z_SPEED * run * dt;
        return;
      }
      const dx = next.x - a.x;
      const step = SPEED * run * dt;
      a.dist += step;
      if (Math.abs(dx) > 0.5) {
        const dir = dx > 0 ? 1 : -1;
        // Al cambiar de sentido, un momento de frente (no en las prisas de un asalto).
        if (dir !== a.dir && !this.scripted) a.turn = TURN_TIME;
        a.dir = dir;
      }
      if (Math.abs(dx) <= step) {
        a.x = next.x;
        a.path.shift();
      } else a.x += Math.sign(dx) * step;
    }
    if (!a.path.length && !this.sliding(a)) this.reach(a);
  }

  /** Ha llegado (en x y en profundidad): se pone como pide su destino. */
  private reach(a: Actor): void {
    if (!this.scripted) a.run = undefined;
    if (a.goal && !a.leaving) {
      this.arrive(a, a.goal);
      // Se mete en la cama: primero incorporado y luego se tumba.
      if (a.goal.pose === 'bed' && a.goal.bed && !this.scripted)
        a.edge = { bed: a.goal.bed, t: 0.8, out: false };
    } else a.pose = 'stand';
  }

  /** Si aún le falta ponerse a su profundidad. */
  private sliding(a: Actor): boolean {
    return a.laneTo !== undefined && !a.climb && Math.abs(a.lane - a.laneTo) > 0.4;
  }

  /** Si aún le queda camino de lado a lado (y no solo unos pasos hasta su sitio). */
  private crossing(a: Actor): boolean {
    const next = a.path[0];
    if (!next) return false;
    return a.path.length > 1 || next.floor !== a.floor || Math.abs(next.x - a.x) > STEP_IN;
  }

  /**
   * Mientras anda, se va acercando a la profundidad de su destino (en diagonal), pero sin pasar
   * de `WALK_Z` hasta que está cerca de su sitio.
   */
  private slide(a: Actor, dt: number): void {
    if (a.climb || this.scripted) return;
    // (Sin profundidad que pedir, como al ir a sentarse, se queda en la suya; pero de lado a
    // lado, tampoco más al fondo de `WALK_Z`.)
    const goal = a.laneTo ?? a.lane;
    const to = this.crossing(a) ? Math.min(goal, WALK_Z) : goal;
    const dz = to - a.lane;
    if (!dz) return;
    const step = Z_SPEED * (a.run ?? 1) * dt;
    if (Math.abs(dz) <= step) a.lane = to;
    else a.lane += Math.sign(dz) * step;
    // Andando solo hacia dentro o fuera, el paso sigue (si no, patinaría).
    if (!a.path.length) a.dist += Math.min(step, Math.abs(dz));
  }

  private depth(a: Actor): number {
    if (a.edge) return a.edge.bed.z;
    if (a.climb) {
      // Del carril al tramo en el primer peldaño, y de vuelta en el último.
      const s = a.climb.u * STEPS;
      const w = Math.min(1, s, STEPS - s);
      return a.lane + (CLIMB_Z - a.lane) * w;
    }
    if ((a.pose === 'sit' || a.pose === 'bed') && a.goal?.z !== undefined) return a.goal.z;
    return a.lane;
  }

  /** Fotograma, tamaño y esquina de abajo a la izquierda (en el mundo 2D) de alguien. */
  private frame(a: Actor, t: number): { frame: number; left: number; bottom: number; z: number } {
    const z = this.depth(a);
    const k = scaleAt(z);
    if (a.edge) {
      // Incorporado: el fotograma de acostado, con el dibujo `UP_DROP` filas más abajo.
      const bed = a.edge.bed;
      const tint = this.tints[bed.roomId];
      const f = bedFrame(bed, k, z, tint);
      const up =
        bed.kind !== 'litera'
          ? F.up + (bed.kind === 'catre' ? 4 : 5)
          : tint
            ? F.upT + TINT_IDS.indexOf(tint)
            : F.up + bed.level;
      // El dibujo baja UP_DROP filas en su fotograma, así que el fotograma sube otro tanto.
      return { ...f, frame: up, bottom: f.bottom - UP_DROP / k };
    }
    const bed = a.pose === 'bed' ? a.goal?.bed : undefined;
    if (bed) return bedFrame(bed, k, z, this.tints[bed.roomId]);
    if (a.held) {
      // Colgando del dedo, pataleando un poco.
      const step = Math.floor(t * 12) % WALK_STEPS;
      return {
        frame: F.walk + step,
        left: a.held.x - CELL / 2 / k,
        bottom: a.held.y - FEET_Y / k + TALL / k,
        z,
      };
    }
    if (a.pose === 'sit' && a.seatMove) {
      // Sentándose o levantándose: de pie, doblando las rodillas (baja un par de píxeles).
      const top = a.y - FEET_Y / k + 2 / k;
      return { frame: F.idle, left: a.x - CELL / 2 / k, bottom: top + TALL / k, z };
    }
    if (a.pose === 'sit') {
      // Sentado en el taburete: la cintura sobre el asiento. El de guardia, de día, da un
      // respingo al plantar la carta; de noche, cabecea (se va hundiendo y se despierta de golpe).
      const top = a.y - (10 - 2 + 23) / k;
      const g = this.guardBeat(a);
      const dy = g ? (g.night ? g.nod : g.slam ? -1 : 0) : 0;
      const frame = g?.dozing ? F.sitZ : F.sit;
      return { frame, left: a.x - CELL / 2 / k, bottom: top + (TALL + dy) / k, z };
    }
    const top = a.y - FEET_Y / k;
    let frame: number;
    if (a.pose === 'down') {
      const p = a.fall ? a.fall.t / FALL_TIME : 1;
      if (p < STAGGER)
        // Se tambalea: de pie, echado hacia atrás (con los ojos cerrados).
        return {
          frame: F.blink,
          left: a.x - CELL / 2 / k,
          bottom: top + (TALL + Math.round(p * 4)) / k,
          z,
        };
      // Al suelo, con un rebote al tocarlo.
      const hop = p < 1 ? Math.round(Math.sin(((p - STAGGER) / (1 - STAGGER)) * Math.PI) * 3) : 0;
      return {
        frame: a.dir > 0 ? F.down : F.downL,
        left: a.x - CELL / 2 / k,
        bottom: top + (TALL - hop) / k,
        z,
      };
    }
    if (a.hurt && !a.path.length && !a.swing) {
      // Encajando un golpe: de perfil, echado hacia atrás (más al principio).
      const back = (a.hurt.push * Math.min(1, a.hurt.t / HURT_TIME) * 2) / k;
      return {
        frame: a.dir > 0 ? F.talk : F.talk + 1,
        left: a.x - CELL / 2 / k + back,
        bottom: top + TALL / k,
        z,
      };
    }
    if (a.swing && a.blow && !a.path.length) {
      const b = this.blowFrame(a.blow, 1 - a.swing, a.dir);
      return { frame: b.frame, left: a.x - CELL / 2 / k + b.lunge / k, bottom: top + TALL / k, z };
    }
    if ((a.guard ?? 0) > this.now && !a.path.length && a.pose === 'stand')
      // En guardia: el arma lista, de perfil hacia quien pelea.
      return {
        frame: a.dir > 0 ? F.drill : F.drillL,
        left: a.x - CELL / 2 / k,
        bottom: top + TALL / k,
        z,
      };
    const d = this.drillOf(a);
    if (d) {
      // Entrenando en su sala, mirando hacia donde tiene más sitio.
      const dir = DRILL_DIR;
      let lunge = 0;
      if (d.kind === 'armas') {
        const combo = d.n % 3;
        const hit = d.p >= 1.1 && d.p < 1.5;
        if (combo === 1) {
          // De arriba abajo: el arma en alto y el golpe.
          const up = d.p >= 0.5 && d.p < 1.1;
          frame = up
            ? dir > 0
              ? F.drill2
              : F.drill2L
            : (dir > 0 ? F.drill : F.drillL) + (hit ? 2 : 0);
        } else if (combo === 2) {
          // Estocada: preparado y a fondo, con el paso largo.
          const i = d.p >= 0.8 && d.p < 1.4 ? 1 : 0;
          frame = i ? (dir > 0 ? F.drill2 : F.drill2L) + 1 : dir > 0 ? F.drill : F.drillL;
          if (i) lunge = (dir * 3) / k;
        } else {
          const i = d.p < 0.7 ? 0 : d.p < 1.1 ? 1 : hit ? 2 : 0;
          frame = (dir > 0 ? F.drill : F.drillL) + i;
        }
        if (hit && combo !== 2) lunge = (dir * 2) / k;
      } else if (d.kind === 'tiro') frame = (dir > 0 ? F.aim : F.aimL) + (d.p < 1.2 ? 0 : 1);
      else frame = F.read + (d.p > 4.4 ? 1 : 0);
      return { frame, left: a.x - CELL / 2 / k + lunge, bottom: top + TALL / k, z };
    }
    if ((a.cheer ?? 0) > this.now && a.pose === 'stand' && !a.path.length) {
      // Celebrando: saltitos con los brazos en alto.
      const hop = Math.abs(Math.sin((t + (hash(a.hero.id) % 7) / 10) * Math.PI * 1.8));
      return { frame: F.cheer, left: a.x - CELL / 2 / k, bottom: top + (TALL - hop * 4) / k, z };
    }
    const job = this.jobAnim(a);
    if (job) {
      const i = F.tool + job.slot * 8 + (job.dir > 0 ? 0 : 4) + job.pose;
      // Subido a la escalera de tijera: los pies en su tabla.
      const up = a.ladder ? STEP_UP / k : 0;
      return { frame: i, left: a.x - CELL / 2 / k, bottom: top + TALL / k - up, z };
    }
    if (a.pose === 'stand' && !a.path.length && this.time === 'day' && !this.scripted) {
      const p = (t + (hash(a.hero.id) % 37) / 7) % 6;
      if (a.poi?.kind === 'warm') frame = a.poi.dir > 0 ? F.warm : F.warm + 1;
      else if (a.poi)
        // Leyendo el tablón o el mapa, o rezando: de frente con el papel o el libro.
        frame = F.read + (p > 5.2 ? 1 : 0);
      else if (this.atBar(a))
        // En la barra, un trago de vez en cuando y, alguna vez, un brindis con la jarra en alto.
        frame =
          p > 2 && p < 2.7 && hash(a.hero.id) % 3 === 0
            ? F.toast + (a.dir > 0 ? 0 : 1)
            : F.drink + (p > 4.8 ? 1 : 0) + (a.dir > 0 ? 0 : 2);
      else frame = this.gesture(a, t);
      if (frame >= 0) return { frame, left: a.x - CELL / 2 / k, bottom: top + TALL / k, z };
    }
    if (a.chat?.from && !a.path.length && a.pose === 'stand') {
      // De charla: de perfil, mirando al otro, y con las manos por delante cuando le toca hablar.
      const speaking = this.bubbles().some((b) => b.id === a.hero.id);
      const gesture = speaking && (t * 2.5 + hash(a.hero.id)) % 2 < 1;
      const base = gesture ? F.warm : F.talk;
      return {
        frame: base + (a.dir > 0 ? 0 : 1),
        left: a.x - CELL / 2 / k,
        bottom: top + TALL / k,
        z,
      };
    }
    if (a.climb) {
      // En la escalera: la pierna sube en el impulso y se apoya en el peldaño (alternando).
      const s = a.climb.u * STEPS;
      const i = Math.floor(s);
      const lifting = s - i < LIFT;
      frame = (a.dir > 0 ? F.walk : F.walkL) + (i % 2 ? 4 : 0) + (lifting ? 3 : 0);
    } else if (a.pose === 'walk' && a.turn) frame = F.idle;
    else if (a.pose === 'walk') {
      // Un tiempo del paso cada `WALK_PX` píxeles: el pie apoyado no patina.
      const step = Math.floor((a.dist * k) / WALK_PX) % WALK_STEPS;
      frame = (a.dir > 0 ? F.walk : F.walkL) + step;
    } else if (this.time === 'dusk' && a.pose === 'stand' && !this.scripted) {
      // Al atardecer, alguno bosteza.
      const g = (t + (hash(a.hero.id) % 41) / 3) % 11;
      frame = g < 1.4 ? F.yawn : F.idle + (Math.floor((t + a.blinkAt) * 1.2) % 2);
    } else {
      const blink = (t + a.blinkAt) % 4 < 0.15;
      frame = blink ? F.blink : F.idle + (Math.floor((t + a.blinkAt) * 1.2) % 2);
    }
    return { frame, left: a.x - CELL / 2 / k, bottom: top + TALL / k, z };
  }

  /** El fotograma de un golpe según por dónde va (`p`, de 0 a 1) y el paso hacia delante. */
  private blowFrame(blow: Blow, p: number, dir: 1 | -1): { frame: number; lunge: number } {
    const drill = dir > 0 ? F.drill : F.drillL;
    const up = dir > 0 ? F.drill2 : F.drill2L;
    const aim = dir > 0 ? F.aim : F.aimL;
    const step = (n: number, from: number) =>
      dir * n * Math.sin(Math.min(1, Math.max(0, (p - from) / (1 - from))) * Math.PI);
    switch (blow) {
      case 'tajo':
        // El arma en alto, el tajo con el paso largo y de vuelta en guardia.
        return p < 0.3
          ? { frame: up, lunge: -dir }
          : { frame: drill + (p < 0.8 ? 2 : 0), lunge: step(3, 0.3) };
      case 'maza':
        // Más despacio arriba y el golpe seco, sin tanto paso.
        return p < 0.45
          ? { frame: up, lunge: -dir }
          : { frame: drill + (p < 0.85 ? 2 : 1), lunge: step(2, 0.45) };
      case 'estocada':
        // Recogido un instante y a fondo, con el paso más largo.
        return p < 0.15
          ? { frame: drill, lunge: -dir }
          : { frame: p < 0.75 ? up + 1 : drill, lunge: step(4, 0.15) };
      case 'tiro':
        // Apuntando, suelta y baja el arco; un poco hacia atrás por el tirón.
        return { frame: aim + (p < 0.65 ? 1 : 0), lunge: p < 0.3 ? -dir : 0 };
      case 'conjuro':
        // El bastón en alto y hacia delante (sale el hechizo).
        return { frame: p < 0.4 ? up : up + 1, lunge: p < 0.4 ? 0 : step(1, 0.4) };
      case 'grito':
        return { frame: up, lunge: 0 };
    }
  }

  private place(a: Actor, t: number): void {
    const f = this.frame(a, t);
    const k = scaleAt(f.z);
    const w = CELL / k;
    const h = TALL / k;
    const origin = at(f.left, f.bottom, f.z);
    a.mesh.position.copy(origin);
    a.mesh.scale.set(w, h, 1);
    const u = a.mat.uniforms;
    u.uOrigin!.value.copy(origin);
    u.uAxisU!.value.set(w, 0, 0);
    u.uAxisV!.value.set(0, h, 0);
    u.uUvOffset!.value.set(...uvOf(f.frame));
    const look = this.tint(a.x, a.floor);
    u.uAmbient!.value.set(...look.ambient);
    u.uSun!.value = look.sun;
    this.placeLadder(a, f.z, look);
  }

  /** La escalera de tijera bajo el pintor subido a ella (detrás de él); si no, escondida. */
  private placeLadder(a: Actor, z: number, look: { ambient: Tint; sun: number }): void {
    let m = this.ladders.get(a.hero.id);
    const on = !!a.ladder && !a.path.length && !a.gone && !!this.jobAnim(a);
    if (!on) {
      if (m) m.visible = false;
      return;
    }
    if (!m) {
      const img = stepladder();
      const mat = this.look.surface(img, [at(0, 0, 0), at(1, 0, 0), at(1, -1, 0), at(0, -1, 0)], {
        ambient: [0.44, 0.38, 0.46],
        sun: 0,
        wrap: 0.6,
        dither: 0.03,
        halo: 0.3,
        noWeather: true,
      });
      m = mesh(this.geo, mat);
      m.userData.w = img.w;
      m.userData.h = img.h;
      this.group.add(m);
      this.ladders.set(a.hero.id, m);
    }
    const lz = z + 1.5;
    const k = scaleAt(lz);
    const w = m.userData.w / k;
    const h = m.userData.h / k;
    const origin = at(a.x - w / 2, a.y, lz);
    m.visible = true;
    m.position.copy(origin);
    m.scale.set(w, h, 1);
    const u = (m.material as ShaderMaterial).uniforms;
    u.uOrigin!.value.copy(origin);
    u.uAxisU!.value.set(w, 0, 0);
    u.uAxisV!.value.set(0, h, 0);
    u.uAmbient!.value.set(...look.ambient);
    u.uSun!.value = look.sun;
  }

  private rectOf(a: Actor, v: View): Rect | null {
    if (!this.L) return null;
    const f = this.frame(a, 0);
    const k = scaleAt(f.z);
    const bed = a.pose === 'bed';
    // Solo lo dibujado: el cuerpo de pie (18 de ancho) o la cabeza en la almohada.
    const x0 = f.left + (bed ? 0 : 3 / k);
    const x1 = f.left + (bed ? 16 / k : 21 / k);
    const y0 = f.bottom - TALL / k;
    const y1 = bed ? y0 + 16 / k : f.bottom;
    const p0 = project(v, x0, y0, f.z);
    const p1 = project(v, x1, y1, f.z);
    return { x: p0.x, y: p0.y, w: p1.x - p0.x, h: p1.y - p0.y };
  }
}
