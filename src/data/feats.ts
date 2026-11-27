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
    tiers: [5, 10, 25, 50, 100, 200, 400],
    rewards: [
      { gold: 40 },
      { gold: 80, rep: 3, unlock: 'roof:pizarra' },
      { gold: 150, item: 2, unlock: 'tint:morado' },
      { gold: 300, item: 4 },
      { gold: 600, rep: 8, item: 4 },
      { gold: 1200, rep: 12, item: 4 },
      { gold: 2500, rep: 20, item: 4 },
    ],
  },
  {
    id: 'brillantes',
    name: t('hazanas.hazanas.brillantes.nombre'),
    text: 'hazanas.hazanas.brillantes.texto',
    stat: 'brilliant',
    tiers: [3, 10, 25, 50, 100],
    rewards: [
      { rep: 5, unlock: 'sign:pintado' },
      { gold: 100, item: 2 },
      { gold: 250, item: 4 },
      { gold: 500, rep: 8, item: 4 },
      { gold: 1000, rep: 12, item: 4 },
    ],
  },
  {
    id: 'trofeos',
    name: t('hazanas.hazanas.trofeos.nombre'),
    text: 'hazanas.hazanas.trofeos.texto',
    stat: 'trophies',
    tiers: [1, 3, 5, 8, 10],
    rewards: [
      { gold: 50, unlock: 'walls:piedra' },
      { gold: 120, rep: 5 },
      { item: 4 },
      { gold: 600, rep: 10 },
      { gold: 1200, item: 4 },
    ],
  },
  {
    id: 'veterano',
    name: t('hazanas.hazanas.veterano.nombre'),
    text: 'hazanas.hazanas.veterano.texto',
    stat: 'maxLvl',
    tiers: [3, 5, 8, 12, 15],
    rewards: [
      { gold: 50 },
      { item: 2, unlock: 'roof:verde' },
      { item: 4 },
      { gold: 500, item: 4 },
      { gold: 1500, rep: 15, item: 4 },
    ],
  },
  {
    id: 'oro',
    name: t('hazanas.hazanas.oro.nombre'),
    text: 'hazanas.hazanas.oro.texto',
    stat: 'goldEarned',
    tiers: [500, 1500, 4000, 10000, 25000, 60000],
    rewards: [
      { rep: 3 },
      { gold: 100, unlock: 'tint:ocre' },
      { gold: 200, item: 2 },
      { gold: 400, item: 3 },
      { gold: 1000, item: 4 },
      { gold: 2500, rep: 15, item: 4 },
    ],
  },
  {
    id: 'asaltos',
    name: t('hazanas.hazanas.asaltos.nombre'),
    text: 'hazanas.hazanas.asaltos.texto',
    stat: 'raids',
    tiers: [1, 3, 5, 10, 20],
    rewards: [
      { gold: 60, unlock: 'sign:hierro' },
      { gold: 150, rep: 5 },
      { item: 4 },
      { gold: 400, rep: 8 },
      { gold: 1000, item: 4 },
    ],
  },
  {
    id: 'sinbajas',
    name: t('hazanas.hazanas.sinbajas.nombre'),
    text: 'hazanas.hazanas.sinbajas.texto',
    stat: 'safeDays',
    tiers: [10, 20, 40, 60, 100],
    rewards: [
      { gold: 40, unlock: 'boxes' },
      { gold: 100, rep: 5 },
      { item: 4 },
      { gold: 400, rep: 8 },
      { gold: 1000, item: 4 },
    ],
  },
  // Las del juego largo (27 de noviembre): lo demás que se hace, con niveles hasta muy arriba.
  ...(
    [
      [
        'historias',
        'chains',
        [1, 3, 6, 10],
        [
          { gold: 100, rep: 3 },
          { gold: 300, item: 3 },
          { gold: 700, rep: 10, item: 4 },
          { gold: 1500, rep: 20, item: 4 },
        ],
      ],
      [
        'jefes',
        'bosses',
        [1, 5, 15, 40],
        [
          { gold: 80 },
          { gold: 250, rep: 5 },
          { gold: 700, item: 4 },
          { gold: 1800, rep: 15, item: 4 },
        ],
      ],
      [
        'expediciones',
        'expeditions',
        [1, 5, 15, 40],
        [
          { gold: 60 },
          { gold: 200, rep: 4 },
          { gold: 600, item: 3 },
          { gold: 1500, rep: 12, item: 4 },
        ],
      ],
      [
        'talleres',
        'crafted',
        [5, 20, 60, 150],
        [{ gold: 60 }, { gold: 200 }, { gold: 500, item: 3 }, { gold: 1200, item: 4 }],
      ],
      [
        'incidentes',
        'incidents',
        [5, 25, 75, 200],
        [{ gold: 50 }, { gold: 150, rep: 3 }, { gold: 400, item: 3 }, { gold: 1000, rep: 10 }],
      ],
      [
        'curados',
        'healed',
        [3, 15, 50, 120],
        [{ gold: 50 }, { gold: 150 }, { gold: 400, rep: 5 }, { gold: 900, item: 4 }],
      ],
      [
        'jarras',
        'beerServed',
        [100, 500, 2000, 6000],
        [{ gold: 50 }, { gold: 150 }, { gold: 400 }, { gold: 1000, rep: 8 }],
      ],
      [
        'entrenar',
        'trained',
        [10, 50, 150, 400],
        [{ gold: 50 }, { gold: 150, item: 2 }, { gold: 400, item: 3 }, { gold: 1000, item: 4 }],
      ],
    ] as const
  ).map(([id, stat, tiers, rewards]): FeatDef => ({
    id,
    name: t(`hazanas.hazanas.${id}.nombre`),
    text: `hazanas.hazanas.${id}.texto`,
    stat,
    tiers,
    rewards: rewards as readonly Reward[],
  })),
];
