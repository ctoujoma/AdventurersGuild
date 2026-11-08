import { P } from './palette';
import { GRIDS } from './itemGrids';

/**
 * Los legendarios con dibujo propio (rejillas de 14 × 14 con su paleta), por el nombre del
 * objeto. Un legendario que no esté aquí usa el icono de su tipo en oro (ver `items.ts`): así se
 * pueden añadir legendarios genéricos sin dibujar nada, y uno nuevo con dibujo es solo su rejilla.
 * `legendFrame` da cada fotograma de su animación (rayos, brasas, gotas, aleteo…).
 */

export interface Legend {
  rows: readonly string[];
  pal: Record<string, string>;
}

const g = (name: keyof typeof GRIDS) => [...GRIDS[name]];
const edit = (rows: readonly string[], cells: [number, number, string][]) => {
  const a = rows.map((r) => [...r]);
  for (const [x, y, c] of cells) a[y]![x] = c;
  return a.map((r) => r.join(''));
};

export const LEGENDS: Record<string, Legend> = {
  'Hoja de Vadoverde': {
    rows: [
      '..........w..3',
      '............31',
      '...........321',
      '..........321w',
      '.........321..',
      '.GL.....321...',
      '.GgL...321....',
      '..GgL.321.....',
      '....T321......',
      '.....T........',
      '....b.TL......',
      '...b...gL.....',
      '..a....GgL....',
      '.A......GG....',
    ],
    pal: {
      '1': P.steel,
      '2': P.mist,
      '3': P.white,
      w: P.cyan,
      g: P.forest,
      G: P.leaf,
      L: P.lime,
      T: P.gold,
      b: P.bark,
      a: P.lime,
      A: P.leaf,
    },
  },
  'Capa élfica': {
    rows: edit(g('capa'), [
      [6, 2, 'L'],
      [7, 2, 'w'],
      [6, 3, 'G'],
      [7, 3, 'L'],
      [3, 6, 'w'],
      [10, 9, 'w'],
      [5, 10, 'w'],
      ...[1, 3, 5, 8, 10, 12].map((x) => [x, 12, 'L'] as [number, number, string]),
    ]),
    pal: { c: P.deep, C: P.forest, k: P.leaf, T: P.mist, L: P.lime, G: P.leaf, w: P.mist },
  },
  'Varita de la Abuela Tormenta': {
    rows: [
      '........SSS...',
      '......SSkkkS..',
      '.....SkkkkkkS.',
      '.....SkkkykkS.',
      '......SSyySS..',
      '.......o.y..c.',
      '......ob.y....',
      '.....ob..c....',
      '.....Kb.......',
      '....ob......c.',
      '...ob.........',
      '...ob.........',
      '..ob..........',
      '.ob...........',
    ],
    pal: { S: P.steel, k: P.fog, y: P.lemon, o: P.mocha, b: P.bark, K: P.cocoa, c: P.cyan },
  },
  'Botas de siete leguas': {
    rows: (() => {
      const wing = [
        '....',
        'ww..',
        'wwww',
        '.mww',
        '..mw',
        '...m',
        '....',
        '....',
        '....',
        '....',
        '....',
        '....',
        '....',
        '....',
      ];
      return edit(
        g('botas').map((r, y) => wing[y]! + r.slice(2, 12)),
        [
          [7, 6, 'a'],
          [8, 6, 'a'],
        ],
      );
    })(),
    pal: {
      L: P.tan,
      r: P.clay,
      l: P.rust,
      T: P.lemon,
      t: P.gold,
      '0': P.amber,
      '1': P.gold,
      '2': P.lemon,
      '3': P.white,
      x: P.black,
      m: P.fog,
      w: P.white,
      a: P.red,
    },
  },
  'Corona del Rey Ahogado': {
    rows: [
      '..............',
      '..............',
      '..............',
      '.a....aa....a.',
      '.3....32....1.',
      '.32..3321..21.',
      '.332332221221.',
      '.2g2a2gg1a1g1.',
      '.222222111111.',
      '.000000000000.',
      '..e..e....e...',
      '..e.......e...',
      '..............',
      '..............',
    ],
    pal: {
      '0': P.rust,
      '1': P.amber,
      '2': P.gold,
      '3': P.lemon,
      g: P.leaf,
      a: P.mist,
      e: P.forest,
    },
  },
  'Coraza de escamas de sierpe': {
    rows: g('coraza').map((r, y) =>
      [...r]
        .map((c, x) => {
          if (y < 4 || y > 11 || y === 9 || !'0123'.includes(c)) return c;
          const off = Math.floor((y - 4) / 2) % 2 ? 2 : 0;
          const k = (x + off) % 4;
          return (y - 4) % 2 === 0 ? ['s', 'h', 'S', 'S'][k]! : ['s', 'S', 'S', 'm'][k]!;
        })
        .join(''),
    ),
    pal: {
      '0': P.amber,
      '1': P.gold,
      '2': P.gold,
      '3': P.lemon,
      s: P.deep,
      S: P.leaf,
      h: P.lime,
      m: P.forest,
      t: P.amber,
      T: P.lemon,
      x: P.black,
    },
  },
  'Capa de piel de ceniza': {
    rows: edit(g('capa'), [
      ...[5, 6, 7, 8].map((x) => [x, 0, 'F'] as [number, number, string]),
      ...[4, 5, 6, 7, 8, 9].map((x) => [x, 1, x % 2 ? 'F' : 'f'] as [number, number, string]),
      ...[3, 4, 5, 6, 7, 8, 9, 10].map(
        (x) => [x, 2, x % 2 ? 'f' : 'F'] as [number, number, string],
      ),
      [3, 3, 'F'],
      [5, 3, 'F'],
      [8, 3, 'F'],
      [10, 3, 'F'],
      [6, 3, 'C'],
      [7, 3, 'C'],
      [4, 6, 'e'],
      [9, 8, 'e'],
      [6, 10, 'e'],
      ...Array.from(
        { length: 14 },
        (_, x) => [x, 12, x % 2 ? 'F' : 'f'] as [number, number, string],
      ),
      ...[0, 2, 4, 6, 8, 10, 12].map((x) => [x, 13, 'f'] as [number, number, string]),
    ]),
    pal: { c: P.slate, C: P.steel, k: P.fog, F: P.mist, f: P.fog, e: P.orange },
  },
  'Cetro de la Reina': {
    rows: [
      '.........3c3..',
      '........3cCc3.',
      '........2cCc2.',
      '.........222..',
      '........21....',
      '.......21.....',
      '......21......',
      '.....a1.......',
      '....21........',
      '...21.........',
      '..21..........',
      '.21...........',
      '3.............',
      '..............',
    ],
    pal: { '1': P.fog, '2': P.mist, '3': P.white, c: P.sky, C: P.cyan, a: P.cyan },
  },
  'Escudo de escama blanca': {
    rows: [
      '....mmmddd....',
      '...mwwmmmfd...',
      '..mwccccccfd..',
      '.mwcwmmmmfcfd.',
      '.mwcwmmmmfcfd.',
      'mwcwwmmmmffcfd',
      '.mwcwmmmmfcfd.',
      '..mwcmmmmcfd..',
      '..mwcmmmmcfd..',
      '...mwcmmcfd...',
      '....mmccmd....',
      '.....mmmd.....',
      '......md......',
      '......md......',
    ],
    pal: { w: P.white, m: P.mist, f: P.fog, d: P.steel, c: P.cyan },
  },
};

/** Fotogramas de cada animación (el efecto va en los primeros; el resto, quieto). */
export const FRAMES = 12;

/** Las filas y la paleta de un legendario en el fotograma `f` (sin los brillos que se pintan encima). */
export function legendFrame(name: string, f: number): Legend {
  const L = LEGENDS[name]!;
  let rows = L.rows;
  const pal = { ...L.pal };
  switch (name) {
    case 'Varita de la Abuela Tormenta':
      // El rayo: dos destellos seguidos.
      if (f === 3 || f === 5) Object.assign(pal, { k: P.white, y: P.white, S: P.mist });
      if (f === 4) pal.y = P.white;
      break;
    case 'Capa de piel de ceniza':
      pal.e = [P.rust, P.orange, P.gold, P.lemon, P.gold, P.orange][Math.min(5, f >> 1)]!;
      break;
    case 'Corona del Rey Ahogado': {
      // Una gota que cae de las algas.
      const y = 11 + Math.floor(f / 3);
      if (y <= 13) rows = rows.map((r, i) => (i === y ? r.slice(0, 10) + 'e' + r.slice(11) : r));
      break;
    }
    case 'Cetro de la Reina':
      if (f >= 2 && f <= 5) Object.assign(pal, { C: P.white, c: P.cyan });
      break;
    case 'Botas de siete leguas':
      // El ala sube y baja.
      if (f % 4 >= 2 && f < 8)
        rows = rows.map((r, i) =>
          i >= 1 && i <= 5 ? (L.rows[i + 1]?.slice(0, 4) ?? '....') + r.slice(4) : r,
        );
      break;
  }
  return { rows, pal };
}

/** Qué brillo se pinta encima: uno que cruza (`sweep`), estrellas (`twinkle`) o ninguno. */
export function legendShine(name: string): 'sweep' | 'twinkle' | null {
  if (
    ['Hoja de Vadoverde', 'Coraza de escamas de sierpe', 'Escudo de escama blanca'].includes(name)
  )
    return 'sweep';
  return name === 'Capa élfica' ? 'twinkle' : null;
}
