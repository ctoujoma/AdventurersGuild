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
  DOOR_GUARDS,
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
  salonAppeal,
} from '../core/balance';
import { bedsPerCell } from '../core/rooms';
import { listNames } from '../core/text';
import { t, tl } from '../textos';
import { ATTR_NAMES } from '../core/training';
import { VILLAGE_COUNT } from '../core/workers';
import { decorSlots } from './custom';
import { FACILITY_INFO, qualityText } from './labels';
import { TRAINS, type RoomType } from './rooms';

/** Lo que da una sala de ese nivel y con esos huecos. */
type Effect = (level: number, cells: number) => string;

/** Lo que rinden los que trabajan o entrenan en la sala, según su nivel (`workAt`, `trainRate`), en %. */
const pace = (l: number) => Math.round(100 * (0.75 + 0.25 * l));

/** El valor de una tabla por nivel (los de más arriba, el último). */
const at = <T>(t: readonly T[], l: number): T => t[Math.min(l, t.length - 1)]!;

/** Un taller (forja, sastrería, alquimia): trabajos a la vez, ritmo, calidad y recetas. */
const workshop: Effect = (l) => {
  if (l === 0) return t('salas.efecto.taller_0');
  return t('salas.efecto.taller', {
    n: at(CRAFT_SLOTS, l),
    ritmo: pace(l),
    calidad: qualityText(l),
    receta: Math.round(100 * at(UNDO_CHANCE, l)),
  });
};

/** Una sala de entrenamiento: hasta dónde y a qué ritmo. */
const training =
  (r: RoomType): Effect =>
  (l) =>
    l === 0
      ? t('salas.efecto.entreno_0')
      : t('salas.efecto.entreno', {
          atributo: ATTR_NAMES[TRAINS[r]!],
          tope: at(TRAIN_CAP, l),
          ritmo: pace(l),
        });

/** Las instalaciones de antes que ya dicen bien lo que dan. */
const fac =
  (k: keyof typeof FACILITY_INFO): Effect =>
  (l) =>
    FACILITY_INFO[k].effect(l);

/** Candidatos que llegan a la barra según el salón (`generateHero`). */
const recruits = (l: number) =>
  l >= 2 ? tl('salas.efecto.candidatos')[Math.min(l, 4) - 2]! : null;

export const ROOM_INFO: Record<RoomType, Effect> = {
  recibidor: (l) =>
    t('salas.efecto.recibidor', {
      s: at(DOOR_TIME, l),
      n: DOOR_GUARDS[l] ?? DOOR_GUARDS.at(-1)!,
    }),
  salon: (l) => {
    if (l === 0) return t('salas.efecto.salon_0');
    return listNames(
      [
        t('salas.efecto.salon_atractivo', { n: salonAppeal(l) }),
        t('salas.efecto.salon_encargos', { n: BOARD_SIZE(l) - BOARD_SIZE(0) }),
        t('salas.efecto.salon_moral', { moral: restMorale(l), tope: restCap(l) }),
        t('salas.efecto.salon_adornos', { n: decorSlots(l) }),
        recruits(l),
      ].filter((x): x is string => !!x),
    );
  },
  cocina: (l, n) =>
    l === 0
      ? t('salas.efecto.cocina_0')
      : t('salas.efecto.cocina', { ritmo: pace(l), n: KITCHEN_STORE * l * n }),
  bodega: (l, n) =>
    l === 0
      ? t('salas.efecto.bodega_0')
      : t('salas.efecto.bodega', { ritmo: pace(l), n: CELLAR_STORE * l * n }),
  despensa: (l, n) =>
    l === 0
      ? t('salas.efecto.despensa_0')
      : t('salas.efecto.despensa', { n: PANTRY_STORE * l * n }),
  tesoro: (l, n) =>
    t('salas.efecto.tesoro', {
      n: Math.max(VAULT_STORE[0], at(VAULT_STORE, l) * (l ? n : 1)),
      colchon: !l,
      s: at(LOCK_TIME, l),
    }),
  dormitorio: (l, n) => {
    if (l === 0) return t('salas.efecto.dormitorio_0');
    return t('salas.efecto.dormitorio', {
      camas: bedsPerCell('dormitorio', l) * n,
      moral: at(DORM_REST, l),
    });
  },
  veteranos: (l, n) => {
    if (l === 0) return t('etiquetas.sin_efecto');
    return t('salas.efecto.veteranos', {
      camas: bedsPerCell('veteranos', l) * n,
      nivel: VET_LEVEL,
      moral: at(VET_REST, l),
      tope: at(VET_CAP, l),
      balcon: l >= 2,
    });
  },
  enfermeria: fac('enf'),
  capilla: fac('cap'),
  mapas: fac('mapas'),
  armeria: fac('arm'),
  torre: fac('torre'),
  forja: workshop,
  sastreria: workshop,
  alquimia: workshop,
  servicio: (l, n) =>
    l === 0
      ? t('salas.efecto.servicio_0', { n: VILLAGE_COUNT })
      : t('salas.efecto.servicio', { camas: 2 * l * n }),
  armas: training('armas'),
  tiro: training('tiro'),
  biblioteca: training('biblioteca'),
  pintor: (l) =>
    l === 0
      ? t('salas.efecto.pintor_0')
      : t('salas.efecto.pintor', { n: at(PAINT_SLOTS, l), ritmo: pace(l) }),
  almacen: (l, n) =>
    l === 0
      ? t('salas.efecto.almacen_0')
      : t('salas.efecto.almacen', { n: at(STORE_CAP, l) * n, delicado: l >= 2 }),
};

/** Lo que da una sala de ese tipo con ese nivel y esos huecos, para «Ahora: …» y «Mejora: …». */
export const roomEffect = (type: RoomType, level: number, cells = 1) =>
  ROOM_INFO[type](level, cells);
