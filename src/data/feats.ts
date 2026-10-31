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
    rewards: [
      { gold: 40 },
      { gold: 80, rep: 3, unlock: 'roof:pizarra' },
      { gold: 150, item: 1, unlock: 'tint:morado' },
      { gold: 300, item: 2 },
    ],
  },
  {
    id: 'brillantes',
    name: 'Para cantarlo',
    text: 'Consigue {n} éxitos brillantes',
    stat: 'brilliant',
    tiers: [3, 10, 25],
    rewards: [
      { rep: 5, unlock: 'sign:pintado' },
      { gold: 100, item: 1 },
      { gold: 250, item: 2 },
    ],
  },
  {
    id: 'trofeos',
    name: 'Pared de honor',
    text: 'Consigue {n} trofeos',
    stat: 'trophies',
    tiers: [1, 3, 5],
    rewards: [{ gold: 50, unlock: 'walls:piedra' }, { gold: 120, rep: 5 }, { item: 2 }],
  },
  {
    id: 'veterano',
    name: 'Curtidos',
    text: 'Sube un héroe a nivel {n}',
    stat: 'maxLvl',
    tiers: [3, 5, 8],
    rewards: [{ gold: 50 }, { item: 1, unlock: 'roof:verde' }, { item: 2 }],
  },
  {
    id: 'oro',
    name: 'Caja llena',
    text: 'Gana {n} monedas con encargos',
    stat: 'goldEarned',
    tiers: [500, 1500, 4000],
    rewards: [{ rep: 3 }, { gold: 100, unlock: 'tint:ocre' }, { gold: 200, item: 1 }],
  },
  {
    id: 'asaltos',
    name: 'Aquí no se roba',
    text: 'Repele {n} asaltos a la taberna',
    stat: 'raids',
    tiers: [1, 3, 5],
    rewards: [{ gold: 60, unlock: 'sign:hierro' }, { gold: 150, rep: 5 }, { item: 2 }],
  },
  {
    id: 'sinbajas',
    name: 'Todos a casa',
    text: 'Pasa {n} días seguidos sin bajas',
    stat: 'safeDays',
    tiers: [10, 20, 40],
    rewards: [{ gold: 40, unlock: 'boxes' }, { gold: 100, rep: 5 }, { item: 2 }],
  },
];
