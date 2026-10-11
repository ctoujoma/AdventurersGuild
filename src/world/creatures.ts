import { P, darker } from '../art/palette';
import { PixelBuffer, toHex } from '../art/pixel';

/** Bichos de la taberna dibujados a mano: el gato Bigotes, el búho, murciélagos y la rata. */

type Frame = readonly string[];

function sprite(rows: Frame, colors: Record<string, string>, outline = true): PixelBuffer {
  const b = new PixelBuffer(rows[0]!.length, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = colors[row[x]!];
      if (c) b.set(x, y, c);
    }
  });
  return outline ? b.outlined((n) => darker(toHex(n), 3)) : b;
}

const CAT = { c: P.orange, C: P.brick, w: P.sand, e: P.lime, k: P.black, p: P.coral, s: P.amber };

export const CAT_FRAMES = {
  sleep: [
    sprite(
      [
        '................',
        '...........c.c..',
        '....sssscc.cccc.',
        '..ccccCccccccCc.',
        '.cccCcccsccckcc.',
        '.ccCccccccccwwcc',
        '.CcccccccccwwCC.',
        'cCCCCCCCCCCCCC..',
        'cc..............',
      ],
      CAT,
    ),
    sprite(
      [
        '................',
        '...........c.c..',
        '....sssscc.cccc.',
        '..ccccCccccccCc.',
        '.cccCcccsccckcc.',
        '.ccCccccccccwwcc',
        '.CcccccccccwwCC.',
        '.CCCCCCCCCCCCC..',
        'cc..............',
      ],
      CAT,
    ),
  ],
  sit: sprite(
    [
      '..........c..c..',
      '..........cccc..',
      '..........cecc..',
      '..........cccpc.',
      '.........ccww...',
      '........cccww...',
      '..c....csccww...',
      '..cc..cCcccww...',
      '...ccccCccCwC...',
      '......CC.CC.....',
    ],
    CAT,
  ),
  walk: [
    sprite(
      [
        '............c.c.',
        '............cccc',
        '.c..........cecp',
        '..c.........ccc.',
        '...ccccccccccw..',
        '...cCcsccsccww..',
        '...cCccccccccc..',
        '....C.c....C.c..',
        '....C.c....C.c..',
      ],
      CAT,
    ),
    sprite(
      [
        '............c.c.',
        '............cccc',
        '..c.........cecp',
        '..c.........ccc.',
        '...ccccccccccw..',
        '...cCcsccsccww..',
        '...cCccccccccc..',
        '.....Cc....cC...',
        '....C..c..C..c..',
      ],
      CAT,
    ),
  ],
};

const OWL = { b: P.oak, B: P.rust, w: P.sand, y: P.gold, k: P.black, o: P.orange };

export const OWL_FRAMES = {
  open: sprite(
    [
      '.b......b.',
      '.bbbbbbbb.',
      'bbyybbyybb',
      'bbykbbkybb',
      '.bbbobbbb.',
      '.bwwwwwwb.',
      'bbwBwwBwbb',
      'bbwwBwwwbb',
      '.bbwwwwbb.',
      '..bbbbbb..',
      '..o.oo.o..',
    ],
    OWL,
  ),
  blink: sprite(
    [
      '.b......b.',
      '.bbbbbbbb.',
      'bbBBbbBBbb',
      'bbbbbbbbbb',
      '.bbbobbbb.',
      '.bwwwwwwb.',
      'bbwBwwBwbb',
      'bbwwBwwwbb',
      '.bbwwwwbb.',
      '..bbbbbb..',
      '..o.oo.o..',
    ],
    OWL,
  ),
  look: sprite(
    [
      '.b......b.',
      '.bbbbbbbb.',
      'byybbyybbb',
      'bkybbkybbb',
      '.bbobbbbb.',
      '.bwwwwwwb.',
      'bbwBwwBwbb',
      'bbwwBwwwbb',
      '.bbwwwwbb.',
      '..bbbbbb..',
      '..o.oo.o..',
    ],
    OWL,
  ),
};

const BAT = { k: P.navy, K: P.slate, r: P.red };

export const BAT_FRAMES = {
  hang: sprite(['K...K', 'kkkkk', 'kKkKk', '.kkk.', '.rkr.', '..k..'], BAT),
  up: sprite(['k.....k', 'kk...kk', '.kkrkk.', '..kkk..'], BAT),
  down: sprite(['..rkr..', '.kkkkk.', 'kk...kk', 'k.....k'], BAT),
};

const RAT = { g: P.steel, G: P.slate, e: P.black, p: P.coral };

export const RAT_FRAMES = [
  sprite(['.....ggg..', 'p..ggggge.', '.pGggggggp', '...g.g.g..'], RAT),
  sprite(['.....ggg..', '.p.ggggge.', 'p.Gggggggp', '....g.g.g.'], RAT),
];

/** Banderín ondeando (dibujado por columnas). */
/** Estandarte del tejado, ondeando con los colores del escudo. */
export function flagFrame(t: number, field: string = P.wine, dark: string = P.plum): PixelBuffer {
  const b = new PixelBuffer(12, 9);
  for (let x = 0; x < 11; x++) {
    const off = Math.round(Math.sin(x * 0.8 - t * 6) * (x / 11) * 1.6);
    const h = 6 - Math.floor(x / 4);
    for (let y = 0; y < h; y++) {
      const c = y === 0 && field === P.wine ? P.red : y === h - 1 ? dark : field;
      b.set(x + 1, 1 + y + off + Math.floor(x / 8), c);
    }
  }
  b.set(4, 3, P.gold);
  b.set(5, 3, P.lemon);
  return b.outlined(() => P.black);
}
