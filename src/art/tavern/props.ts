import { C } from '../palette';
import { createPixels, outline, stamp, type ColorMap, type Grid, type Pixels } from '../sprite';

/** Objetos pequeños de la taberna, dibujados a mano y contorneados automáticamente. */

const PROP_COLORS: ColorMap = {
  k: C.outline,
  d: C.wood0,
  w: C.wood1,
  W: C.wood2,
  v: C.wood3,
  V: C.wood4,
  z: C.stone0,
  s: C.stone1,
  S: C.stone2,
  t: C.stone3,
  y: C.gold1,
  Y: C.gold2,
  r: C.red1,
  R: C.red0,
  q: C.green1,
  g: C.green2,
  G: C.green3,
  n: C.cloth1,
  N: C.cloth2,
  c: C.cloth0,
};

export const PROP_GRIDS = {
  barril: [
    '..wWWWWw..',
    '.wWWvvWWw.',
    'SSSSSSSSSS',
    'wWWvvvWWWw',
    'wWWvvvWWWw',
    'wWWvvvWWWw',
    'wWWvvvWWWw',
    'SSSSSSSSSS',
    '.wWWvvWWw.',
    '..wWWWWw..',
  ],
  cofre: [
    '.wwwwwwww.',
    'wWWWWWWWWw',
    'yyyyyyyyyy',
    'wWWWyYWWWw',
    'wWWWyyWWWw',
    'wWWWWWWWWw',
    'wwwwwwwwww',
  ],
  jarra: ['NNN.', 'vVvw', 'vVvw', 'vvv.'],
  hierbas: ['.w.', '.q.', 'qGq', 'qgq', 'gqg', '.g.'],
  saco: ['..cc..', '.cnnc.', 'cnnnnc', 'cnnnnc', 'cnnnnc', '.cccc.'],
  trofeo: [
    '....dd..dd....',
    '...dWWddWWd...',
    '...dWWWWWWd...',
    '..dWWkWWkWWd..',
    '..dWWWWWWWWd..',
    '..dWvvvvvvWd..',
    '..NdvkvvkvdN..',
    '..N.dvvvvd.N..',
    '.....dddd.....',
    '...yyyyyyyy...',
    '...ywwwwwwy...',
    '...yyyyyyyy...',
  ],
  letrero: [
    'wwwwwwwwwwww',
    'wWWWWWWWWWWw',
    'wWWNNNNWWWWw',
    'wWWYYkYwWWWw',
    'wWWYYYkWwWWw',
    'wWWYYkYwWWWw',
    'wWWYkYYWWWWw',
    'wWWYYYYWWWWw',
    'wWWWWWWWWWWw',
    'wwwwwwwwwwww',
  ],
  telarana: ['tttttt', 'tt..t.', 't.t.t.', 't..tt.', 'tttt..', 't.....'],
  cruz: ['nnnnnnn', 'nnnrnnn', 'nnnrnnn', 'nrrrrrn', 'nnnrnnn', 'nnnrnnn', 'nnnnnnn'],
  estandarte: [
    'wwwwwwwwww',
    '.rrrrrrrr.',
    '.rRrrrrRr.',
    '.rrryyrrr.',
    '.rryYYyrr.',
    '.rrryyrrr.',
    '.rrrrrrrr.',
    '.rRrrrrRr.',
    '.rrrrrrrr.',
    '.rrr..rrr.',
    '.rr....rr.',
  ],
} satisfies Record<string, Grid>;

export type PropId = keyof typeof PROP_GRIDS;

const BOTTLE: Grid = ['.w.', '.x.', 'xxx', 'xXx', 'xXx', 'xxx'];
const BOTTLE_COLORS: readonly [string, string][] = [
  [C.green1, C.green3],
  [C.red1, C.red2],
  [C.blue1, C.blue3],
  [C.gold0, C.gold2],
  [C.purple1, C.purple2],
];

function build(grid: Grid, colors: ColorMap, withOutline: boolean): Pixels {
  const p = createPixels(grid[0]!.length, grid.length);
  stamp(p, grid, colors);
  return withOutline ? outline(p, C.outline) : p;
}

const cache = new Map<string, Pixels>();

export function prop(id: PropId): Pixels {
  let p = cache.get(id);
  if (!p) {
    // Telarañas sin contorno: tienen que verse finas.
    p = build(PROP_GRIDS[id], PROP_COLORS, id !== 'telarana');
    cache.set(id, p);
  }
  return p;
}

export function bottle(variant: number): Pixels {
  const key = `botella:${variant % BOTTLE_COLORS.length}`;
  let p = cache.get(key);
  if (!p) {
    const [x, X] = BOTTLE_COLORS[variant % BOTTLE_COLORS.length]!;
    p = build(BOTTLE, { ...PROP_COLORS, x, X }, true);
    cache.set(key, p);
  }
  return p;
}

export { PROP_COLORS };
