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
import type { BedSpot } from './people';
import type { PoiKind, TaskPoi } from './salas/kit';

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
const CLIMB = 30;

/** Fotogramas del atlas (cada uno de CELL × SPRITE de alto). */
const CELL = 24;
const TALL = 28;

/** Las herramientas de los puestos (y el trapo de la barra), en el orden de sus fotogramas. */
const TOOLS = ['cucharon', 'pala', 'cuenco', 'jarra', 'trapo', 'cuchillo', 'antorcha'] as const;

/** Un trabajo: la herramienta y los cuatro tiempos (postura del brazo, giro y duración). */
interface Work {
  tool: number;
  steps: [FightPose, number, number][];
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
    steps: [
      ['ready', 205, 0.26],
      ['ready', 182, 0.26],
      ['strike', 160, 0.26],
      ['ready', 182, 0.26],
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
      ['ready', 200, 0.6],
      ['up', -40, 0.5],
      ['up', -55, 0.9],
      ['ready', 200, 0.6],
    ],
  },
  // … meter y sacar el pan del horno con la pala…
  hornear: {
    tool: 1,
    steps: [
      ['ready', 70, 0.6],
      ['thrust', 85, 0.7],
      ['thrust', 95, 0.5],
      ['ready', 70, 0.7],
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
  cuba: ['bodega'],
  barril: ['llenar'],
  caldera: ['bodega', 'lena'],
};
const ROUTINE = new Set(['cocina', 'bodega']);
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
 * Ancho del atlas en píxeles: va en una sola fila, así que no puede pasar de lo que aguanta una
 * textura en cualquier móvil (4096). Si se pasa, hay que partirlo en dos filas.
 */
export const ATLAS_W = CELL * FRAMES;
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
/** Los visitantes, sentados, piden y comentan. */
const ORDER: Talk[] = ['jarra', 'pan', 'moneda', 'puntos', 'risa'];
/** Lo que dura cada frase de una charla (s). */
const TURN = 1.6;

/** Un sitio de una sala al que se va a hacer algo (ver `setPois`). */
export interface Poi extends Place {
  kind: PoiKind;
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
  campesino: 'garrote',
  mercader: 'daga',
  noble: 'espada',
  forastero: 'daga',
};

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
  /** Sus fotogramas (para tocarle solo donde se le ve). */
  img: PixelBuffer;
  mat: ShaderMaterial;
  mesh: Mesh;
  x: number;
  /** Altura de los pies en el mundo (y hacia abajo) y planta en la que está o a la que va. */
  y: number;
  floor: number;
  lane: number;
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
  /** Acostándose o levantándose: un momento incorporado en la cama (`out`: luego se va). */
  edge?: { bed: BedSpot; t: number; out: boolean } | null;
  /** Haciendo algo en un sitio de la sala (leer el tablón, calentarse…) y hacia dónde mira. */
  poi?: { kind: Poi['kind']; dir: 1 | -1 } | null;
  /** En la rutina de su oficio: el mueble (`at`, su x), lo que hace y hacia dónde mira. */
  task?: { at: number; work: WorkId; face: 1 | -1 } | null;
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
    w.steps.forEach(([p, deg], i) => {
      const img = drillCell(still, p, TOOLS[w.tool]!, deg);
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
  return b;
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
      if (!route(L, { x: a.x, floor: a.floor }, this.S.door, this.segs)) this.put(a, this.S.door);
      if (a.pose === 'sit' || a.pose === 'bed') a.pose = 'stand';
    }
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
    for (const [id, a] of this.actors) {
      if (a.hero.visitor) continue;
      const h = heroes.find((x) => x.id === id);
      // El que acaba de salir de misión sigue hasta la puerta aunque ya no esté en casa.
      const going = h?.status === 'mision' && (a.leaving || a.hero.status === 'ok');
      if (!h || (!shown.has(id) && !going)) {
        this.remove(id);
        continue;
      }
      const was = a.hero.status;
      const work = a.hero.work;
      // Si ha cambiado su dibujo (equipo nuevo, herido o curado, u otra partida con los mismos
      // ids), se le rehace: si no, seguía con el de antes hasta que salía y volvía a entrar.
      const reskin = skinOf(a.hero) !== skinOf(h);
      a.hero = h;
      if (reskin) this.reskin(a);
      if (work !== h.work && !a.gone && !a.leaving) a.wait = 0;
      if (was === h.status) continue;
      a.goal = null;
      a.path = [];
      a.seat = null;
      if (h.status === 'mision') {
        // Coge sus cosas y sale por el recibidor hasta perderse en el patio.
        a.leaving = true;
        this.go(a, { place: outside(), pose: 'stand' });
      } else if (was === 'mision' || was === 'candidato') {
        if (was === 'mision') this.put(a, outside());
        a.wait = 0;
      }
    }
    for (const h of home) {
      if (!shown.has(h.id) || this.actors.has(h.id)) continue;
      this.add(h);
    }
    this.rehome();
    // Quien ya tiene cama en el servicio deja de irse al pueblo.
    for (const a of this.actors.values()) {
      if (!a.gone || this.village(a)) continue;
      a.gone = false;
      a.mesh.visible = true;
      const g = this.homes.get(a.hero.id);
      if (this.time === 'night' && g) {
        this.put(a, g.place);
        this.arrive(a, g);
      } else {
        this.put(a, outside());
        a.wait = 0;
      }
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
    for (const a of [...this.actors.values()]) {
      if (a.hero.visitor) {
        this.remove(a.hero.id);
        continue;
      }
      if (a.leaving || a.gone) continue;
      if (this.village(a)) {
        this.hide(a);
        continue;
      }
      const g = this.homes.get(a.hero.id);
      if (!g) continue;
      a.path = [];
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
      if (this.scripted) {
        if (a.path.length) this.walk(a, dt);
        if (a.swing) a.swing = Math.max(0, a.swing - dt * 3);
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
      if (a.path.length) this.walk(a, dt);
      else if (a.leaving) {
        if (!a.hero.visitor) this.away.add(a.hero.id);
        this.remove(a.hero.id);
        continue;
      } else if (a.homeward) {
        this.hide(a);
        continue;
      } else if ((a.wait -= dt) <= 0) this.decide(a);
      this.place(a, t);
    }
  }

  /**
   * La persona que hay en un punto de la vista (en píxeles de la vista): la de delante entre las
   * que se ven justo ahí; si el dedo cae en el hueco de todas, la de delante de su recuadro.
   */
  hit(v: View, x: number, y: number): string | null {
    let best: { id: string; z: number; solid: boolean } | null = null;
    for (const a of this.actors.values()) {
      if (a.gone) continue;
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
        if (alpha(a.img.get(f.frame * CELL + qx, qy))) return true;
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
    // Donde cae se queda un momento (le llega su tarea nueva) y luego va a lo suyo.
    if (p) this.put(a, p);
    a.wait = p ? 0.8 : 0;
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
        this.put(a, g.place);
        this.arrive(a, g);
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

  /** Se levanta de la cama (o de la silla) de un salto. */
  wake(id: string): void {
    const a = this.actors.get(id);
    if (a) this.standUp(a);
  }

  /** Cae al suelo. */
  knock(id: string): void {
    const a = this.actors.get(id);
    if (!a) return;
    // En la escalera, cae al rellano más cercano.
    const c = a.climb;
    if (c) this.put(a, { x: a.x, floor: c.lower + (c.u > 0.5 ? 1 : 0) });
    a.path = [];
    a.goal = null;
    a.swing = 0;
    a.pose = 'down';
  }

  /** Da un golpe hacia un lado. */
  strike(id: string, dir: 1 | -1): void {
    const a = this.actors.get(id);
    if (!a || a.pose === 'down') return;
    a.dir = dir;
    a.swing = 1;
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
        const list = a.hero.visitor ? ORDER : (['jarra', 'risa', 'nota'] as Talk[]);
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
  }

  // ---------- Por dentro ----------

  private add(h: SceneHero): void {
    const spr = heroSprites(h.look, h.marks);
    const k = scaleAt(LANES[0]);
    const img = atlas(spr, h);
    const mat = this.look.surface(img, [at(0, 0, 0), at(1, 0, 0), at(1, -1, 0), at(0, -1, 0)], {
      ambient: [0.44, 0.38, 0.46],
      sun: 0,
      wrap: 0.6,
      dither: 0.03,
      halo: 0.3,
      frames: FRAMES,
    });
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
    // En la cocina y la bodega, lo que toque de su rutina (o nada, en el rato quieto).
    if (job && ROUTINE.has(job.room.type)) {
      const tk = a.task;
      if (!tk || Math.abs(a.x - tk.at) > 16) return null;
      const w: Work = WORK[tk.work];
      const cycle = w.steps.reduce((s, x) => s + x[2], 0);
      let p = (this.now + (hash(h.id) % 89) / 11) % cycle;
      let pose = 0;
      while (pose < w.steps.length - 1 && p >= w.steps[pose]![2]) p -= w.steps[pose++]![2];
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
    const spots = this.pois.filter(
      (p) =>
        !LEISURE.has(p.kind) && p.floor === j.room.floor && p.x >= j.x0 - 24 && p.x <= j.x1 + 24,
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
    // A un lado del mueble, mirándolo.
    const side = this.rnd() < 0.5 ? -1 : 1;
    const x = p.x + side * Math.min(p.half * 0.45, 9) + (this.rnd() - 0.5) * 2;
    const place = { x, floor: p.floor };
    if (!route(this.L, { x: a.x, floor: a.floor }, place, this.segs)) return false;
    this.go(a, { place, pose: 'stand' });
    a.task = { at: p.x, work, face: side > 0 ? -1 : 1 };
    a.wait = 6 + this.rnd() * 8;
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
    this.go(a, { place, pose: 'stand' });
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
    this.go(a, { place, pose: 'stand' });
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
    if (!a.path.length) {
      if (a.goal && !a.leaving) {
        this.arrive(a, a.goal);
        // Se mete en la cama: primero incorporado y luego se tumba.
        if (a.goal.pose === 'bed' && a.goal.bed && !this.scripted)
          a.edge = { bed: a.goal.bed, t: 0.8, out: false };
      } else a.pose = 'stand';
    }
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
      // Sentado en el taburete: la cintura sobre el asiento.
      const top = a.y - (10 - 2 + 23) / k;
      return { frame: F.sit, left: a.x - CELL / 2 / k, bottom: top + TALL / k, z };
    }
    const top = a.y - FEET_Y / k;
    let frame: number;
    if (a.pose === 'down') {
      return {
        frame: a.dir > 0 ? F.down : F.downL,
        left: a.x - CELL / 2 / k,
        bottom: top + TALL / k,
        z,
      };
    }
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
      return { frame: i, left: a.x - CELL / 2 / k, bottom: top + TALL / k, z };
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
    if (a.swing) {
      // Golpe: el paso largo de andar, echándose hacia delante.
      const lunge = (a.dir * 3 * Math.sin(a.swing * Math.PI)) / k;
      frame = (a.dir > 0 ? F.walk : F.walkL) + 2;
      return { frame, left: a.x - CELL / 2 / k + lunge, bottom: top + TALL / k, z };
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
    u.uUvOffset!.value.set(f.frame / FRAMES, 0);
    const look = this.tint(a.x, a.floor);
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
