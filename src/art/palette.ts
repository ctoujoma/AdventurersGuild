/**
 * Paleta única del juego. Todo el pixel art (héroes, taberna, iconos) sale de aquí,
 * así el mundo se ve coherente y se comparte con la Tienda de pociones.
 */
export const C = {
  outline: '#1b1424',
  ink: '#2b2233',

  wood0: '#3d2617',
  wood1: '#5e3b22',
  wood2: '#84552f',
  wood3: '#ad7a46',
  wood4: '#d3a467',

  stone0: '#2c2f3b',
  stone1: '#464a5a',
  stone2: '#6a6f80',
  stone3: '#959aa8',

  plaster0: '#7c6450',
  plaster1: '#a48a6c',
  plaster2: '#c9b08a',

  fire0: '#8c2d1c',
  fire1: '#d2562a',
  fire2: '#f19a38',
  fire3: '#ffd772',
  fire4: '#fff4c2',

  red0: '#6e1f25',
  red1: '#a8333a',
  red2: '#d65a4e',

  blue0: '#1c2a4a',
  blue1: '#2e4c80',
  blue2: '#4f7fc0',
  blue3: '#8fb8e8',

  green0: '#1f3a26',
  green1: '#3a6334',
  green2: '#64944a',
  green3: '#9cc46a',

  purple0: '#2e2140',
  purple1: '#4d3a6b',
  purple2: '#7a62a0',

  cloth0: '#c7bfae',
  cloth1: '#ece5d3',
  cloth2: '#fffaf0',

  gold0: '#8a6418',
  gold1: '#c99a2e',
  gold2: '#f0cd5c',

  sky0: '#141a33',
  sky1: '#1a2244',
  sky2: '#20294f',
  star: '#ffeec0',

  dirt0: '#2a1e18',
  dirt1: '#3a2a20',
  dirt2: '#4e382a',
} as const;

export type ColorName = keyof typeof C;

/** Tonos de piel: [base, sombra]. */
export const SKIN_TONES: readonly (readonly [string, string])[] = [
  ['#f3cfa6', '#d9a57a'],
  ['#e0a878', '#bb7d50'],
  ['#b07446', '#8a5532'],
  ['#7a4a2c', '#5a341e'],
];

/** Colores de pelo: [base, sombra]. */
export const HAIR_COLORS: readonly (readonly [string, string])[] = [
  ['#2a2230', '#16111c'], // negro
  ['#5e3b22', '#3d2617'], // castaño
  ['#a8462a', '#6e2a1a'], // pelirrojo
  ['#e0b85a', '#b08a34'], // rubio
  ['#9a9aa4', '#6a6a74'], // canoso
  ['#e8e4dc', '#b8b2a8'], // blanco
];
