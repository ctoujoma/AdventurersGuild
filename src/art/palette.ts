/**
 * Paleta del juego: Endesga 32 (rampas con cambio de tono, sombras hacia el púrpura y
 * luces hacia el amarillo) más unos pocos tonos de piel y madera añadidos a mano.
 * Todo el pixel art sale de aquí; la Tienda de pociones usará la misma.
 */
export const P = {
  black: '#181425',
  navy: '#262b44',
  slate: '#3a4466',
  steel: '#5a6988',
  fog: '#8b9bb4',
  mist: '#c0cbdc',
  white: '#ffffff',

  plum: '#3e2731',
  rust: '#733e39',
  clay: '#b86f50',
  tan: '#e4a672',
  sand: '#ead4aa',

  brick: '#be4a2f',
  amber: '#d77643',
  skin: '#e8b796',
  skinS: '#c28569',

  wine: '#a22633',
  red: '#e43b44',
  hot: '#ff0044',

  grape: '#68386c',
  rose: '#b55088',
  coral: '#f6757a',

  orange: '#f77622',
  gold: '#feae34',
  lemon: '#fee761',

  deep: '#193c3e',
  forest: '#265c42',
  leaf: '#3e8948',
  lime: '#63c74d',

  ocean: '#124e89',
  sky: '#0099db',
  cyan: '#2ce8f5',

  // Añadidos: madera intermedia y pieles oscuras.
  bark: '#4f2f2d',
  oak: '#945a3c',
  umber: '#5c3a2e',
  cocoa: '#8f5640',
  ebony: '#2e1f27',
  mocha: '#6e4232',
} as const;

export type Ramp = readonly string[];

/** Rampas de material, de la sombra a la luz. */
export const R = {
  wood: [P.black, P.plum, P.bark, P.rust, P.oak, P.clay, P.tan],
  woodDark: [P.black, P.plum, P.bark, P.rust, P.oak],
  stone: [P.black, P.navy, P.slate, P.steel, P.fog, P.mist],
  plaster: [P.rust, P.clay, P.skinS, P.skin, P.sand],
  whitewash: [P.steel, P.fog, P.mist, P.white],
  roof: [P.black, P.plum, P.wine, P.brick, P.amber],
  leaf: [P.black, P.deep, P.forest, P.leaf, P.lime],
  gold: [P.rust, P.brick, P.orange, P.gold, P.lemon, P.white],
  fire: [P.wine, P.red, P.orange, P.gold, P.lemon, P.white],
  metal: [P.black, P.slate, P.steel, P.fog, P.mist, P.white],
  dirt: [P.black, P.ebony, P.plum, P.umber, P.bark],
  cloth: {
    red: [P.plum, P.wine, P.red, P.coral],
    blue: [P.black, P.navy, P.ocean, P.sky],
    purple: [P.black, P.plum, P.grape, P.rose],
    green: [P.black, P.deep, P.forest, P.leaf, P.lime],
    white: [P.slate, P.steel, P.fog, P.mist, P.white],
    cream: [P.rust, P.clay, P.tan, P.sand],
    leather: [P.black, P.plum, P.bark, P.rust, P.oak],
  },
} as const;

/** Tonos de piel (sombra → luz). */
export const SKIN: readonly Ramp[] = [
  [P.rust, P.clay, P.skinS, P.skin, P.sand],
  [P.plum, P.rust, P.clay, P.tan, P.skin],
  [P.ebony, P.umber, P.cocoa, P.clay, P.tan],
  [P.black, P.ebony, P.umber, P.mocha, P.cocoa],
];

/** Colores de pelo (sombra → luz). */
export const HAIR: readonly Ramp[] = [
  [P.black, P.navy, P.slate, P.steel], // negro
  [P.black, P.plum, P.rust, P.oak], // castaño
  [P.plum, P.rust, P.brick, P.amber, P.orange], // pelirrojo
  [P.rust, P.amber, P.gold, P.lemon], // rubio
  [P.slate, P.steel, P.fog, P.mist], // canoso
  [P.steel, P.fog, P.mist, P.white], // blanco
];

export const HAIR_NAMES = ['negro', 'castaño', 'pelirrojo', 'rubio', 'canoso', 'blanco'];

/** Colores de ojos [sombra, base]. */
export const EYES: readonly Ramp[] = [
  [P.plum, P.rust], // marrones
  [P.ocean, P.sky], // azules
  [P.forest, P.leaf], // verdes
  [P.slate, P.fog], // grises
  [P.brick, P.gold], // ámbar
];

/** Un tono más oscuro dentro de su rampa: sirve para contornos selectivos y sombras. */
export const DARKER: Readonly<Record<string, string>> = {
  [P.black]: P.black,
  [P.navy]: P.black,
  [P.slate]: P.navy,
  [P.steel]: P.slate,
  [P.fog]: P.steel,
  [P.mist]: P.fog,
  [P.white]: P.mist,
  [P.plum]: P.black,
  [P.rust]: P.plum,
  [P.clay]: P.rust,
  [P.tan]: P.clay,
  [P.sand]: P.tan,
  [P.brick]: P.rust,
  [P.amber]: P.brick,
  [P.skin]: P.skinS,
  [P.skinS]: P.clay,
  [P.wine]: P.plum,
  [P.red]: P.wine,
  [P.hot]: P.red,
  [P.grape]: P.plum,
  [P.rose]: P.grape,
  [P.coral]: P.rose,
  [P.orange]: P.brick,
  [P.gold]: P.orange,
  [P.lemon]: P.gold,
  [P.deep]: P.black,
  [P.forest]: P.deep,
  [P.leaf]: P.forest,
  [P.lime]: P.leaf,
  [P.ocean]: P.navy,
  [P.sky]: P.ocean,
  [P.cyan]: P.sky,
  [P.bark]: P.plum,
  [P.oak]: P.rust,
  [P.umber]: P.ebony,
  [P.cocoa]: P.umber,
  [P.ebony]: P.black,
  [P.mocha]: P.umber,
};

export function darker(color: string, steps = 1): string {
  let c = color;
  for (let i = 0; i < steps; i++) c = DARKER[c] ?? P.black;
  return c;
}
