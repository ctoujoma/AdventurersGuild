import { Rng } from '../../core/rng';
import { C, HAIR_COLORS, SKIN_TONES } from '../palette';
import { createPixels, outline, stamp, type ColorMap, type Pixels } from '../sprite';
import {
  BASE,
  BEARD,
  BODY_H,
  BODY_W,
  HAIR,
  HATS,
  HEADROOM,
  HELMS,
  OUTFITS,
  OVERLAYS,
  WEAPONS,
  type HairStyle,
  type HeadgearId,
  type OutfitId,
} from './layers';

export type Sex = 'm' | 'f';

/** Aspecto de un héroe. Se genera una vez con su semilla y se guarda con la partida. */
export interface HeroLook {
  outfit: OutfitId;
  skin: number;
  hairStyle: HairStyle;
  hairColor: number;
  beard: boolean;
  headgear: HeadgearId | null;
}

export interface HeroMarks {
  /** Herido: venda en la cabeza (y se quita el casco). */
  injured?: boolean;
  /** Secuela «Tuerto». */
  eyepatch?: boolean;
}

/** Tamaño final del sprite: cuerpo + margen para sombreros + 1 px de contorno a cada lado. */
export const SPRITE_W = BODY_W + 2;
export const SPRITE_H = BODY_H + HEADROOM + 2;

const CLASS_COLORS: Record<OutfitId, ColorMap> = {
  guerrero: { c: C.red1, C: C.red0, a: C.gold1, A: C.gold0, o: C.wood1, O: C.wood0 },
  picaro: { c: C.purple1, C: C.purple0, a: C.wood2, A: C.wood1, o: C.wood0, O: C.ink },
  mago: { c: C.blue1, C: C.blue0, a: C.gold2, A: C.gold1, o: C.wood1, O: C.wood0 },
  clerigo: { c: C.cloth1, C: C.cloth0, a: C.gold1, A: C.gold0, o: C.wood1, O: C.wood0 },
  explorador: { c: C.green1, C: C.green0, a: C.wood2, A: C.wood1, o: C.wood1, O: C.wood0 },
  tabernero: { c: C.cloth1, C: C.cloth0, a: C.plaster2, A: C.wood2, o: C.wood1, O: C.wood0 },
};

const SHARED: ColorMap = {
  m: C.stone2,
  M: C.stone3,
  e: C.outline,
  k: C.outline,
  n: C.cloth2,
  r: C.red1,
  v: C.wood2,
  V: C.wood3,
  g: C.blue3,
  G: C.cloth2,
  y: C.gold2,
  Y: C.gold1,
  w: C.cloth2,
};

const HEADGEAR_CHANCE: Record<OutfitId, [HeadgearId, number] | null> = {
  guerrero: ['casco', 0.45],
  picaro: ['capucha', 0.5],
  mago: ['sombrero', 0.75],
  explorador: ['gorra', 0.6],
  clerigo: null,
  tabernero: null,
};

export function generateLook(seed: string, outfit: OutfitId, sex: Sex): HeroLook {
  const rng = new Rng(`look:${seed}`);
  const skin = rng.int(0, SKIN_TONES.length - 1);
  const hairColor = rng.weighted([
    [0, 3],
    [1, 4],
    [2, 2],
    [3, 2],
    [4, 1],
    [5, 0.5],
  ] as const);
  const hairStyle: HairStyle =
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
  const beard = sex === 'm' && rng.chance(0.35);
  const hg = HEADGEAR_CHANCE[outfit];
  const headgear = hg && rng.chance(hg[1]) ? hg[0] : null;
  return { outfit, skin, hairStyle, hairColor, beard, headgear };
}

export function renderHero(look: HeroLook, marks: HeroMarks = {}): Pixels {
  const [skin, skinShade] = SKIN_TONES[look.skin] ?? SKIN_TONES[0]!;
  const [hair, hairShade] = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0]!;
  const colors: ColorMap = {
    ...SHARED,
    ...CLASS_COLORS[look.outfit],
    x: skin,
    X: skinShade,
    h: hair,
    H: hairShade,
  };

  const p = createPixels(BODY_W, BODY_H + HEADROOM);
  const body = (grid: readonly string[], fromRow = 0) =>
    stamp(p, grid.slice(fromRow), colors, 0, HEADROOM + fromRow);

  // Con venda no se lleva casco: la herida manda.
  const headgear = marks.injured && look.headgear === 'casco' ? null : look.headgear;

  body(BASE);
  body(OUTFITS[look.outfit]);
  if (look.beard && headgear !== 'capucha') body(BEARD);
  if (headgear === 'capucha') {
    body(HELMS.capucha);
  } else if (headgear === 'casco') {
    body(HAIR[look.hairStyle], 5); // solo asoma el pelo largo por debajo
    body(HELMS.casco);
  } else {
    body(HAIR[look.hairStyle]);
    if (headgear) stamp(p, HATS[headgear], colors, 0, 0);
  }
  if (marks.eyepatch) body(OVERLAYS.parche);
  if (marks.injured && headgear !== 'sombrero' && headgear !== 'gorra') body(OVERLAYS.venda);
  body(WEAPONS[look.outfit]);

  return outline(p, C.outline);
}
