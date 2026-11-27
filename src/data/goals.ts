/**
 * Objetivos siempre activos: metas cortas de gestión. Siempre hay tres; al cumplir uno se cobra
 * y sale otro. Los de contar se repiten (cada vez piden más); los de salas y los de llegar a algo
 * salen una vez y algunos van en serie (la cocina a 2, luego a 3). Las reglas, en
 * `core/goals.ts`.
 */
import type { QuestType, Reward } from '../core/model';
import type { RoomType } from './rooms';
import { INCIDENT_FROM_DAY, RAID_FROM, RUMOR_FROM_DAY } from '../core/balance';

export type GoalDef =
  | {
      id: string;
      /** Clave del texto (`objetivos.…`; `{n}`: la cifra, `{sala}` y `{nivel}`). */
      text: string;
      /** Contar: un contador de la partida (ver `statValue`), desde que sale el objetivo. */
      stat: string;
      n: number;
      /** Cuánto más pide cada vez que se repite. */
      step: number;
      reward: Reward;
      /** No sale antes de este día (los asaltos, desde `RAID_FROM`). */
      fromDay?: number;
      /** Solo sale con alguna de estas salas en uso (los talleres, el pintor…). */
      needs?: readonly RoomType[];
      /** Solo con las expediciones abiertas. */
      exp?: boolean;
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
      /**
       * Llegar a tener: jarras, raciones, trabajadores, héroes, reputación, un héroe de ese nivel
       * (`level`), días seguidos sin bajas (`safe`) o días de lejanía en una expedición (`far`).
       */
      have: 'beer' | 'food' | 'workers' | 'heroes' | 'rep' | 'level' | 'safe' | 'far';
      n: number;
      reward: Reward;
      /** Sale después de cumplir este otro (en serie). */
      after?: string;
      /** Solo con las expediciones abiertas. */
      exp?: boolean;
    };

const byType = (t: QuestType, n: number, reward: Reward): GoalDef => ({
  id: `tipo-${t}`,
  text: `objetivos.por_tipo.${t}`,
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
  ['almacen', 1, { gold: 30 }],
  ['almacen', 2, { gold: 60 }],
  ['forja', 2, { gold: 60 }],
  ['sastreria', 2, { gold: 80 }],
  ['alquimia', 2, { gold: 80 }],
  ['pintor', 2, { gold: 60 }],
  ['mapas', 2, { gold: 50, rep: 2 }],
  ['armeria', 2, { gold: 50, item: 2 }],
];

export const GOALS: readonly GoalDef[] = [
  {
    id: 'encargos',
    text: 'objetivos.objetivos.encargos.texto',
    stat: 'wins',
    n: 3,
    step: 2,
    reward: { gold: 40 },
  },
  {
    id: 'brillantes',
    text: 'objetivos.objetivos.brillantes.texto',
    stat: 'brilliant',
    n: 1,
    step: 1,
    reward: { rep: 3 },
  },
  {
    id: 'oro',
    text: 'objetivos.objetivos.oro.texto',
    stat: 'goldEarned',
    n: 200,
    step: 150,
    reward: { rep: 2, item: 0 },
  },
  {
    id: 'incidentes',
    text: 'objetivos.objetivos.incidentes.texto',
    stat: 'incidents',
    n: 2,
    step: 2,
    reward: { gold: 30 },
  },
  {
    id: 'asalto-limpio',
    text: 'objetivos.objetivos.asalto-limpio.texto',
    stat: 'cleanRaids',
    n: 1,
    step: 1,
    reward: { gold: 60, rep: 3 },
    fromDay: RAID_FROM,
  },
  {
    id: 'ladrones',
    text: 'objetivos.objetivos.ladrones.texto',
    stat: 'thieves',
    n: 1,
    step: 1,
    reward: { gold: 50 },
    fromDay: INCIDENT_FROM_DAY,
  },
  {
    id: 'rumores',
    text: 'objetivos.objetivos.rumores.texto',
    stat: 'rumors',
    n: 2,
    step: 1,
    reward: { gold: 40 },
    fromDay: RUMOR_FROM_DAY,
  },
  {
    id: 'historias',
    text: 'objetivos.objetivos.historias.texto',
    stat: 'chains',
    n: 1,
    step: 1,
    reward: { gold: 80, rep: 3 },
  },
  // Los de lo de cada día (27 de noviembre): servir, recoger, curar, pociones y mejorar.
  {
    id: 'jarras-servidas',
    text: 'objetivos.objetivos.jarras-servidas.texto',
    stat: 'beerServed',
    n: 30,
    step: 20,
    reward: { gold: 40 },
  },
  {
    id: 'caja',
    text: 'objetivos.objetivos.caja.texto',
    stat: 'tills',
    n: 3,
    step: 2,
    reward: { gold: 30 },
  },
  {
    id: 'recoger',
    text: 'objetivos.objetivos.recoger.texto',
    stat: 'gathered',
    n: 20,
    step: 15,
    reward: { gold: 30 },
  },
  {
    id: 'curados',
    text: 'objetivos.objetivos.curados.texto',
    stat: 'healed',
    n: 2,
    step: 2,
    reward: { gold: 40, rep: 1 },
    needs: ['enfermeria'],
  },
  {
    id: 'pociones',
    text: 'objetivos.objetivos.pociones.texto',
    stat: 'potions',
    n: 2,
    step: 2,
    reward: { gold: 50 },
    needs: ['alquimia'],
  },
  {
    id: 'mejorar',
    text: 'objetivos.objetivos.mejorar.texto',
    stat: 'tempered',
    n: 1,
    step: 1,
    reward: { gold: 60 },
    needs: ['forja', 'sastreria', 'alquimia'],
  },
  {
    id: 'talleres',
    text: 'objetivos.objetivos.talleres.texto',
    stat: 'crafted',
    n: 2,
    step: 2,
    reward: { gold: 50 },
    needs: ['forja', 'sastreria', 'alquimia'],
  },
  {
    id: 'vestir',
    text: 'objetivos.objetivos.vestir.texto',
    stat: 'dressed',
    n: 1,
    step: 1,
    reward: { rep: 2 },
    needs: ['sastreria'],
  },
  {
    id: 'pintar',
    text: 'objetivos.objetivos.pintar.texto',
    stat: 'painted',
    n: 1,
    step: 1,
    reward: { gold: 40 },
    needs: ['pintor'],
  },
  {
    id: 'entrenar',
    text: 'objetivos.objetivos.entrenar.texto',
    stat: 'trained',
    n: 2,
    step: 2,
    reward: { gold: 40 },
    needs: ['armas', 'tiro', 'biblioteca'],
  },
  // Expediciones (bloque 3): volver de unas cuantas, ver parajes y llegar lejos (en serie).
  {
    id: 'expediciones',
    text: 'expediciones.objetivos.expediciones',
    stat: 'expeditions',
    n: 1,
    step: 1,
    reward: { gold: 50 },
    exp: true,
  },
  {
    id: 'parajes',
    text: 'expediciones.objetivos.parajes',
    stat: 'expSites',
    n: 2,
    step: 2,
    reward: { gold: 60, rep: 1 },
    exp: true,
  },
  {
    id: 'lejos-3',
    text: 'expediciones.objetivos.lejos',
    have: 'far',
    n: 3,
    reward: { gold: 60 },
    exp: true,
  },
  {
    id: 'lejos-5',
    after: 'lejos-3',
    text: 'expediciones.objetivos.lejos',
    have: 'far',
    n: 5,
    reward: { gold: 100, rep: 2 },
    exp: true,
  },
  {
    id: 'lejos-8',
    after: 'lejos-5',
    text: 'expediciones.objetivos.lejos',
    have: 'far',
    n: 8,
    reward: { rep: 4, item: 3 },
    exp: true,
  },
  byType('Cazar', 2, { gold: 50 }),
  byType('Explorar', 2, { gold: 50 }),
  byType('Escoltar', 2, { gold: 50 }),
  byType('Recuperar', 2, { gold: 50 }),
  byType('Investigar', 2, { gold: 50 }),
  byType('Limpiar', 2, { gold: 50 }),
  ...ROOM_GOALS.map(([room, level, reward]): GoalDef => ({
    id: `${room}-${level}`,
    text: level === 1 ? 'objetivos.construye' : 'objetivos.sala_nivel',
    room,
    level,
    reward,
  })),
  {
    id: 'jarras',
    text: 'objetivos.objetivos.jarras.texto',
    have: 'beer',
    n: 30,
    reward: { gold: 30 },
  },
  {
    id: 'raciones',
    text: 'objetivos.objetivos.raciones.texto',
    have: 'food',
    n: 40,
    reward: { gold: 30 },
  },
  {
    id: 'personal-4',
    text: 'objetivos.objetivos.personal-4.texto',
    have: 'workers',
    n: 4,
    reward: { gold: 40 },
  },
  {
    id: 'personal-7',
    after: 'personal-4',
    text: 'objetivos.objetivos.personal-7.texto',
    have: 'workers',
    n: 7,
    reward: { gold: 80 },
  },
  {
    id: 'heroes-5',
    text: 'objetivos.objetivos.heroes-5.texto',
    have: 'heroes',
    n: 5,
    reward: { rep: 2 },
  },
  {
    id: 'heroes-8',
    after: 'heroes-5',
    text: 'objetivos.objetivos.heroes-8.texto',
    have: 'heroes',
    n: 8,
    reward: { gold: 80, item: 2 },
  },
  {
    id: 'nivel-5',
    text: 'objetivos.objetivos.nivel-5.texto',
    have: 'level',
    n: 5,
    reward: { gold: 60 },
  },
  {
    id: 'nivel-8',
    after: 'nivel-5',
    text: 'objetivos.objetivos.nivel-8.texto',
    have: 'level',
    n: 8,
    reward: { gold: 120, item: 4 },
  },
  {
    id: 'sin-bajas',
    text: 'objetivos.objetivos.sin-bajas.texto',
    have: 'safe',
    n: 15,
    reward: { gold: 60, rep: 2 },
  },
  {
    id: 'sin-bajas-30',
    after: 'sin-bajas',
    text: 'objetivos.objetivos.sin-bajas-30.texto',
    have: 'safe',
    n: 30,
    reward: { gold: 120, rep: 4 },
  },
  {
    id: 'hierro',
    text: 'objetivos.objetivos.hierro.texto',
    have: 'rep',
    n: 40,
    reward: { gold: 60, unlock: 'roof:paja' },
  },
  {
    id: 'plata',
    after: 'hierro',
    text: 'objetivos.objetivos.plata.texto',
    have: 'rep',
    n: 100,
    reward: { gold: 120, unlock: 'tint:ceniza' },
  },
];

/** Objetivos activos a la vez. */
export const GOAL_SLOTS = 3;
/** Cumplidos que guarda el Libro. */
export const GOAL_LOG = 60;
