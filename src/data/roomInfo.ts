/**
 * Qué da cada nivel de cada sala, en una línea: la ficha lo enseña como «Ahora: …» y «Mejora: …».
 * Las cifras salen de las mismas constantes y reglas del núcleo (core/balance.ts, rooms.ts,
 * workers.ts…), para que no se desfasen. Un test (`roomInfo.test.ts`) comprueba que todas las
 * salas tienen texto para cada nivel y que mejorar siempre dice algo nuevo.
 */
import {
  BOARD_SIZE,
  CELLAR_STORE,
  CRAFT_SLOTS,
  DOOR_TIME,
  DORM_REST,
  KITCHEN_STORE,
  LOCK_TIME,
  PAINT_SLOTS,
  PANTRY_STORE,
  STORE_CAP,
  TRAIN_CAP,
  UNDO_CHANCE,
  VAULT_STORE,
  VET_CAP,
  VET_LEVEL,
  VET_REST,
  restCap,
  restMorale,
} from '../core/balance';
import { bedsPerCell } from '../core/rooms';
import { listNames, plural } from '../core/text';
import { ATTR_NAMES } from '../core/training';
import { VILLAGE_COUNT } from '../core/workers';
import { decorSlots } from './custom';
import { FACILITY_INFO, qualityText } from './labels';
import { TRAINS, type RoomType } from './rooms';

/** Lo que da una sala de ese nivel y con esos huecos. */
type Effect = (level: number, cells: number) => string;

/** Lo que rinden los que trabajan o entrenan en la sala, según su nivel (`workAt`, `trainRate`). */
const pace = (l: number) => `${Math.round(100 * (0.75 + 0.25 * l))} %`;

/** El valor de una tabla por nivel (los de más arriba, el último). */
const at = <T>(t: readonly T[], l: number): T => t[Math.min(l, t.length - 1)]!;

/** Un taller (forja, sastrería, alquimia): trabajos a la vez, ritmo, calidad y recetas. */
const workshop: Effect = (l) => {
  if (l === 0) return 'No crea nada';
  const n = at(CRAFT_SLOTS, l);
  return `${n} ${plural(n, 'trabajo', 'trabajos')} a la vez, al ${pace(l)} de ritmo; sale: ${qualityText(l)}; al desmontar, ${Math.round(100 * at(UNDO_CHANCE, l))} % de sacar la receta`;
};

/** Una sala de entrenamiento: hasta dónde y a qué ritmo. */
const training =
  (t: RoomType): Effect =>
  (l) =>
    l === 0
      ? 'No se entrena'
      : `${ATTR_NAMES[TRAINS[t]!]} hasta ${at(TRAIN_CAP, l)}, al ${pace(l)} de ritmo`;

/** Las instalaciones de antes que ya dicen bien lo que dan. */
const fac =
  (k: keyof typeof FACILITY_INFO): Effect =>
  (l) =>
    FACILITY_INFO[k].effect(l);

/** Candidatos que llegan a la barra según el salón (`generateHero`). */
const recruits = (l: number) =>
  l >= 4
    ? 'candidatos de aún más nivel y más fuertes'
    : l >= 3
      ? 'candidatos de más nivel y más fuertes'
      : l >= 2
        ? 'candidatos de más nivel'
        : null;

export const ROOM_INFO: Record<RoomType, Effect> = {
  recibidor: (l) => `La puerta aguanta ${at(DOOR_TIME, l)} s a los bandidos`,
  salon: (l) => {
    if (l === 0) return 'No viene nadie: no deja dinero';
    const more = BOARD_SIZE(l) - BOARD_SIZE(0);
    return listNames(
      [
        `+${2 * l} de Atractivo`,
        `+${more} ${plural(more, 'encargo', 'encargos')} en el tablón`,
        `+${restMorale(l)} de moral por noche al descansar (hasta ${restCap(l)})`,
        `${decorSlots(l)} huecos de decoración`,
        recruits(l),
      ].filter((x): x is string => !!x),
    );
  },
  cocina: (l, n) =>
    l === 0
      ? 'No cocina ni guarda nada'
      : `Los cocineros rinden al ${pace(l)} y caben ${KITCHEN_STORE * l * n} raciones`,
  bodega: (l, n) =>
    l === 0
      ? 'No hace ni guarda cerveza'
      : `Los cerveceros rinden al ${pace(l)} y caben ${CELLAR_STORE * l * n} jarras`,
  despensa: (l, n) => (l === 0 ? 'No guarda nada' : `Caben ${PANTRY_STORE * l * n} raciones`),
  tesoro: (l, n) =>
    `Caben ${Math.max(VAULT_STORE[0], at(VAULT_STORE, l) * (l ? n : 1))} monedas${l ? '' : ' (bajo el colchón)'} y la cerradura aguanta ${at(LOCK_TIME, l)} s`,
  dormitorio: (l, n) => {
    if (l === 0) return 'Sin camas: paja en el suelo';
    const b = bedsPerCell('dormitorio', l) * n;
    const rest = at(DORM_REST, l);
    return `${b} ${plural(b, 'cama', 'camas')} para héroes${rest ? `; +${rest} de moral por noche a los de casa` : ''}`;
  },
  veteranos: (l, n) => {
    if (l === 0) return 'Sin efecto';
    const b = bedsPerCell('veteranos', l) * n;
    return `${b} ${plural(b, 'cama', 'camas')}; los héroes de nivel ${VET_LEVEL} o más: +${at(VET_REST, l)} de moral por noche y tope +${at(VET_CAP, l)}${l >= 2 ? '; nunca desertan' : ''}`;
  },
  enfermeria: fac('enf'),
  capilla: fac('cap'),
  mapas: fac('mapas'),
  armeria: fac('arm'),
  torre: fac('torre'),
  forja: workshop,
  sastreria: workshop,
  alquimia: workshop,
  servicio: (l, n) => {
    if (l === 0) return `Sin camas: solo trabajan los ${VILLAGE_COUNT} del pueblo`;
    const b = 2 * l * n;
    return `${b} ${plural(b, 'cama', 'camas')} para trabajadores`;
  },
  armas: training('armas'),
  tiro: training('tiro'),
  biblioteca: training('biblioteca'),
  pintor: (l) => {
    if (l === 0) return 'No pinta nada';
    const n = at(PAINT_SLOTS, l);
    return `${n} ${plural(n, 'pintor', 'pintores')} a la vez, al ${pace(l)} de ritmo`;
  },
  almacen: (l, n) =>
    l === 0
      ? 'No guarda nada'
      : `Caben ${at(STORE_CAP, l) * n} más de cada material${l >= 2 ? ', y lo delicado (hierbas, madera buena y cristal)' : ' básico'}`,
};

/** Lo que da una sala de ese tipo con ese nivel y esos huecos, para «Ahora: …» y «Mejora: …». */
export const roomEffect = (type: RoomType, level: number, cells = 1) =>
  ROOM_INFO[type](level, cells);
