import type { Reward } from '../core/model';
import { t } from '../textos';

/**
 * Libro de hazañas: logros con niveles. Cada nivel cumplido se cobra solo al amanecer.
 * `stat` es un contador de la partida (ver core/feats.ts).
 */
export interface FeatDef {
  id: string;
  name: string;
  /** Clave del texto de lo que se cuenta (`{n}`: el objetivo). */
  text: string;
  stat: string;
  tiers: readonly number[];
  rewards: readonly Reward[];
}

export const FEATS: readonly FeatDef[] = [
  {
    id: 'encargos',
    name: t('hazanas.hazanas.encargos.nombre'),
    text: 'hazanas.hazanas.encargos.texto',
    stat: 'wins',
    tiers: [5, 10, 25, 50],
    rewards: [
      { gold: 40 },
      { gold: 80, rep: 3, unlock: 'roof:pizarra' },
      { gold: 150, item: 2, unlock: 'tint:morado' },
      { gold: 300, item: 4 },
    ],
  },
  {
    id: 'brillantes',
    name: t('hazanas.hazanas.brillantes.nombre'),
    text: 'hazanas.hazanas.brillantes.texto',
    stat: 'brilliant',
    tiers: [3, 10, 25],
    rewards: [
      { rep: 5, unlock: 'sign:pintado' },
      { gold: 100, item: 2 },
      { gold: 250, item: 4 },
    ],
  },
  {
    id: 'trofeos',
    name: t('hazanas.hazanas.trofeos.nombre'),
    text: 'hazanas.hazanas.trofeos.texto',
    stat: 'trophies',
    tiers: [1, 3, 5],
    rewards: [{ gold: 50, unlock: 'walls:piedra' }, { gold: 120, rep: 5 }, { item: 4 }],
  },
  {
    id: 'veterano',
    name: t('hazanas.hazanas.veterano.nombre'),
    text: 'hazanas.hazanas.veterano.texto',
    stat: 'maxLvl',
    tiers: [3, 5, 8],
    rewards: [{ gold: 50 }, { item: 2, unlock: 'roof:verde' }, { item: 4 }],
  },
  {
    id: 'oro',
    name: t('hazanas.hazanas.oro.nombre'),
    text: 'hazanas.hazanas.oro.texto',
    stat: 'goldEarned',
    tiers: [500, 1500, 4000],
    rewards: [{ rep: 3 }, { gold: 100, unlock: 'tint:ocre' }, { gold: 200, item: 2 }],
  },
  {
    id: 'asaltos',
    name: t('hazanas.hazanas.asaltos.nombre'),
    text: 'hazanas.hazanas.asaltos.texto',
    stat: 'raids',
    tiers: [1, 3, 5],
    rewards: [{ gold: 60, unlock: 'sign:hierro' }, { gold: 150, rep: 5 }, { item: 4 }],
  },
  {
    id: 'sinbajas',
    name: t('hazanas.hazanas.sinbajas.nombre'),
    text: 'hazanas.hazanas.sinbajas.texto',
    stat: 'safeDays',
    tiers: [10, 20, 40],
    rewards: [{ gold: 40, unlock: 'boxes' }, { gold: 100, rep: 5 }, { item: 4 }],
  },
];
