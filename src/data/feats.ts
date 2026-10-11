import type { Reward } from '../core/model';

/**
 * Libro de hazañas: logros con niveles. Cada nivel cumplido se cobra solo al amanecer.
 * `stat` es un contador de la partida (ver core/feats.ts).
 */
export interface FeatDef {
  id: string;
  name: string;
  /** Qué se cuenta, con {n} para el objetivo. */
  text: string;
  stat: string;
  tiers: readonly number[];
  rewards: readonly Reward[];
}

export const FEATS: readonly FeatDef[] = [
  {
    id: 'encargos',
    name: 'Trabajo es trabajo',
    text: 'Cumple {n} encargos con éxito',
    stat: 'wins',
    tiers: [5, 10, 25, 50],
    rewards: [{ gold: 40 }, { gold: 80, rep: 3 }, { gold: 150, item: 1 }, { gold: 300, item: 2 }],
  },
  {
    id: 'brillantes',
    name: 'Para cantarlo',
    text: 'Consigue {n} éxitos brillantes',
    stat: 'brilliant',
    tiers: [3, 10, 25],
    rewards: [{ rep: 5 }, { gold: 100, item: 1 }, { gold: 250, item: 2 }],
  },
  {
    id: 'trofeos',
    name: 'Pared de honor',
    text: 'Consigue {n} trofeos',
    stat: 'trophies',
    tiers: [1, 3, 5],
    rewards: [{ gold: 50 }, { gold: 120, rep: 5 }, { item: 2 }],
  },
  {
    id: 'veterano',
    name: 'Curtidos',
    text: 'Sube un héroe a nivel {n}',
    stat: 'maxLvl',
    tiers: [3, 5, 8],
    rewards: [{ gold: 50 }, { item: 1 }, { item: 2 }],
  },
  {
    id: 'oro',
    name: 'Caja llena',
    text: 'Gana {n} monedas con encargos',
    stat: 'goldEarned',
    tiers: [500, 1500, 4000],
    rewards: [{ rep: 3 }, { gold: 100 }, { gold: 200, item: 1 }],
  },
  {
    id: 'sinbajas',
    name: 'Todos a casa',
    text: 'Pasa {n} días seguidos sin bajas',
    stat: 'safeDays',
    tiers: [10, 20, 40],
    rewards: [{ gold: 40 }, { gold: 100, rep: 5 }, { item: 2 }],
  },
];

/** Plantillas de desafíos del mes (modo libre): objetivo y premio. */
export const MONTH_POOL: readonly {
  id: string;
  text: string;
  stat: string;
  target: number;
  reward: Reward;
}[] = [
  { id: 'm-encargos', text: 'Cumple 8 encargos', stat: 'wins', target: 8, reward: { gold: 120 } },
  {
    id: 'm-brillantes',
    text: 'Logra 3 éxitos brillantes',
    stat: 'brilliant',
    target: 3,
    reward: { gold: 80, rep: 5 },
  },
  {
    id: 'm-caza',
    text: 'Cumple 3 encargos de caza',
    stat: 'byType:Cazar',
    target: 3,
    reward: { item: 1 },
  },
  {
    id: 'm-explorar',
    text: 'Cumple 3 exploraciones',
    stat: 'byType:Explorar',
    target: 3,
    reward: { item: 1 },
  },
  {
    id: 'm-escolta',
    text: 'Cumple 3 escoltas',
    stat: 'byType:Escoltar',
    target: 3,
    reward: { gold: 100 },
  },
  {
    id: 'm-oro',
    text: 'Gana 800 monedas con encargos',
    stat: 'goldEarned',
    target: 800,
    reward: { rep: 8 },
  },
  {
    id: 'm-trofeo',
    text: 'Consigue un trofeo',
    stat: 'trophies',
    target: 1,
    reward: { item: 2 },
  },
];
