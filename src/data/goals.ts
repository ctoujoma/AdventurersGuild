/**
 * Objetivos siempre activos: metas cortas de gestión. Siempre hay tres; al cumplir uno se cobra
 * y sale otro. Los de contar se repiten (cada vez piden más); los de salas y los de llegar a algo
 * salen una vez y algunos van en serie (la cocina a 2, luego a 3). Las reglas, en
 * `core/goals.ts`.
 */
import type { QuestType, Reward } from '../core/model';
import type { RoomType } from './rooms';

export type GoalDef =
  | {
      id: string;
      /** Texto con {n} para la cifra. */
      text: string;
      /** Contar: un contador de la partida (ver `statValue`), desde que sale el objetivo. */
      stat: string;
      n: number;
      /** Cuánto más pide cada vez que se repite. */
      step: number;
      reward: Reward;
    }
  | {
      id: string;
      text: string;
      /** Mejorar una sala de este tipo hasta el nivel. */
      room: RoomType;
      level: number;
      reward: Reward;
    }
  | {
      id: string;
      text: string;
      /** Llegar a tener: jarras, raciones, trabajadores, héroes o reputación. */
      have: 'beer' | 'food' | 'workers' | 'heroes' | 'rep';
      n: number;
      reward: Reward;
      /** Sale después de cumplir este otro (en serie). */
      after?: string;
    };

const byType = (t: QuestType, text: string, n: number, reward: Reward): GoalDef => ({
  id: `tipo-${t}`,
  text,
  stat: `byType:${t}`,
  n,
  step: 1,
  reward,
});

/** Salas que se mejoran con objetivo, y sus premios por nivel (algunos con algo que se ve). */
const ROOM_GOALS: [RoomType, number, Reward][] = [
  ['cocina', 2, { gold: 40 }],
  ['cocina', 3, { gold: 80, unlock: 'roof:tablilla' }],
  ['salon', 2, { gold: 50, unlock: 'walls:entramado' }],
  ['salon', 3, { gold: 100, rep: 3 }],
  ['bodega', 2, { gold: 40 }],
  ['bodega', 3, { gold: 80 }],
  ['despensa', 2, { gold: 40 }],
  ['dormitorio', 2, { gold: 40, unlock: 'tint:mar' }],
  ['dormitorio', 3, { gold: 80 }],
  ['enfermeria', 2, { gold: 50 }],
  ['recibidor', 2, { gold: 50, rep: 2 }],
  ['tesoro', 2, { gold: 60 }],
  ['armas', 2, { gold: 40, item: 0 }],
  ['tiro', 2, { gold: 40, item: 0 }],
  ['biblioteca', 2, { gold: 40, item: 0 }],
  ['capilla', 2, { gold: 50, rep: 2 }],
];

export const GOALS: readonly GoalDef[] = [
  {
    id: 'encargos',
    text: 'Cumple {n} encargos',
    stat: 'wins',
    n: 3,
    step: 2,
    reward: { gold: 40 },
  },
  {
    id: 'brillantes',
    text: 'Logra {n} éxitos brillantes',
    stat: 'brilliant',
    n: 1,
    step: 1,
    reward: { rep: 3 },
  },
  {
    id: 'oro',
    text: 'Gana {n} monedas con encargos',
    stat: 'goldEarned',
    n: 200,
    step: 150,
    reward: { rep: 2, item: 0 },
  },
  {
    id: 'incidentes',
    text: 'Resuelve {n} incidentes en la taberna',
    stat: 'incidents',
    n: 2,
    step: 2,
    reward: { gold: 30 },
  },
  byType('Cazar', 'Cumple {n} encargos de caza', 2, { gold: 50 }),
  byType('Explorar', 'Cumple {n} exploraciones', 2, { gold: 50 }),
  byType('Escoltar', 'Cumple {n} escoltas', 2, { gold: 50 }),
  ...ROOM_GOALS.map(([room, level, reward]): GoalDef => ({
    id: `${room}-${level}`,
    text: `{sala} a nivel ${level}`,
    room,
    level,
    reward,
  })),
  {
    id: 'jarras',
    text: 'Junta {n} jarras en la bodega',
    have: 'beer',
    n: 30,
    reward: { gold: 30 },
  },
  {
    id: 'raciones',
    text: 'Junta {n} raciones de comida',
    have: 'food',
    n: 40,
    reward: { gold: 30 },
  },
  {
    id: 'personal-4',
    text: 'Ten {n} trabajadores en la casa',
    have: 'workers',
    n: 4,
    reward: { gold: 40 },
  },
  {
    id: 'personal-7',
    after: 'personal-4',
    text: 'Ten {n} trabajadores en la casa',
    have: 'workers',
    n: 7,
    reward: { gold: 80 },
  },
  { id: 'heroes-5', text: 'Ten {n} héroes en el gremio', have: 'heroes', n: 5, reward: { rep: 2 } },
  {
    id: 'heroes-8',
    after: 'heroes-5',
    text: 'Ten {n} héroes en el gremio',
    have: 'heroes',
    n: 8,
    reward: { gold: 80, item: 1 },
  },
  {
    id: 'hierro',
    text: 'Llega al rango de hierro ({n} de reputación)',
    have: 'rep',
    n: 40,
    reward: { gold: 60, unlock: 'roof:paja' },
  },
  {
    id: 'plata',
    after: 'hierro',
    text: 'Llega al rango de plata ({n} de reputación)',
    have: 'rep',
    n: 100,
    reward: { gold: 120, unlock: 'tint:ceniza' },
  },
];

/** Objetivos activos a la vez. */
export const GOAL_SLOTS = 3;
/** Cumplidos que guarda el Libro. */
export const GOAL_LOG = 60;
