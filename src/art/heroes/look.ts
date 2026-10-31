import type { GarmentId, TintId } from '../../data/custom';
import type { GearMark } from './gear';
import { Rng } from '../../core/rng';
import { EYES, HAIR, SKIN } from '../palette';

export type Sex = 'm' | 'f';
export type OutfitId =
  | 'guerrero'
  | 'picaro'
  | 'mago'
  | 'clerigo'
  | 'explorador'
  | 'tabernero'
  // La gente de fuera que viene al salón (no son héroes ni se contratan).
  | 'campesino'
  | 'mercader'
  | 'noble'
  | 'forastero';
export type HairStyle = 'corto' | 'largo' | 'coleta' | 'punta' | 'mono' | 'calvo';
export type HeadgearId = 'casco' | 'capucha' | 'sombrero' | 'gorra' | 'paja' | 'boina' | 'pluma';
export type FaceShape = 'redonda' | 'cuadrada' | 'alargada';
export type Brow = 'recta' | 'arqueada' | 'fruncida';
export type Mouth = 'neutra' | 'sonrisa' | 'mueca' | 'seria';

/** Aspecto completo de un héroe. Se genera una vez con su semilla y se guarda con la partida. */
export interface HeroLook {
  sex: Sex;
  outfit: OutfitId;
  skin: number;
  hairStyle: HairStyle;
  hairColor: number;
  beard: boolean;
  headgear: HeadgearId | null;
  eyes: number;
  face: FaceShape;
  brow: Brow;
  mouth: Mouth;
  freckles: boolean;
  scar: boolean;
  /** De la sastrería: tinte de la ropa y prenda encima del traje. */
  dye?: TintId;
  garment?: GarmentId;
}

/** Marcas que dependen del estado, no del aspecto. */
export interface HeroMarks {
  injured?: boolean;
  eyepatch?: boolean;
  scar?: boolean;
  /** Equipo que lleva puesto (se ve en el sprite y en el retrato). */
  gear?: GearMark;
}

const HEADGEAR: Record<OutfitId, [HeadgearId, number] | null> = {
  guerrero: ['casco', 0.45],
  picaro: ['capucha', 0.5],
  mago: ['sombrero', 0.75],
  explorador: ['gorra', 0.55],
  clerigo: null,
  tabernero: null,
  campesino: ['paja', 0.75],
  mercader: ['boina', 0.85],
  noble: ['pluma', 0.8],
  forastero: ['capucha', 1],
};

export function generateLook(seed: string, outfit: OutfitId, sex: Sex): HeroLook {
  const rng = new Rng(`look:${seed}`);
  const skin = rng.int(0, SKIN.length - 1);
  const hairColor = rng.weighted([
    [0, 3],
    [1, 4],
    [2, 2],
    [3, 2],
    [4, 1],
    [5, 0.5],
  ] as const);
  const hairStyle =
    sex === 'f'
      ? rng.weighted<HairStyle>([
          ['largo', 4],
          ['coleta', 3],
          ['mono', 2],
          ['corto', 1],
        ])
      : rng.weighted<HairStyle>([
          ['corto', 4],
          ['punta', 2],
          ['calvo', 1.5],
          ['largo', 1],
          ['coleta', 0.5],
        ]);
  const beard = sex === 'm' && rng.chance(0.4);
  const hg = HEADGEAR[outfit];
  const headgear = hg && rng.chance(hg[1]) ? hg[0] : null;
  return {
    sex,
    outfit,
    skin,
    hairStyle,
    hairColor: Math.min(hairColor, HAIR.length - 1),
    beard,
    headgear,
    eyes: rng.int(0, EYES.length - 1),
    face: rng.pick(['redonda', 'cuadrada', 'alargada'] as const),
    brow: rng.weighted<Brow>([
      ['recta', 3],
      ['arqueada', 2],
      ['fruncida', 2],
    ]),
    mouth: rng.weighted<Mouth>([
      ['neutra', 3],
      ['sonrisa', 3],
      ['mueca', 2],
      ['seria', 2],
    ]),
    freckles: rng.chance(0.25),
    scar: rng.chance(0.12),
  };
}
