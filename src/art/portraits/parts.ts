/**
 * Piezas de retrato dibujadas a mano, píxel a píxel, en una rejilla de 40×48.
 * Vista de tres cuartos mirando a la izquierda; luz desde arriba a la izquierda.
 *
 * Cada pieza es una lista de tramos [fila, columna inicial, patrón]; '.' no pinta.
 * Las filas cuentan desde la coronilla (fila 6); por encima quedan TOP filas libres
 * para cascos, sombreros y plumas, que usan filas negativas.
 * Huecos de color (se resuelven por retrato):
 *   piel   S s t u v   (S la línea más oscura, v el brillo)
 *   pelo   h i j l     (h oscuro … l brillo)
 *   ropa   a b c d     (principal)  ·  A B C D (secundario: ribetes, cuero, oro)
 *   metal  m n o p     ·  ojos w x y  ·  W blanco · r labios · k contorno · R rojo · K L cuero oscuro
 */

export const W = 40;
export const H = 48;
/** Filas por encima de la fila 0, reservadas para lo que se lleva en la cabeza. */
export const TOP = 8;

export type Span = readonly [number, number, string];
export type Part = readonly Span[];

/** Convierte tramos en H filas de W caracteres (lanza si algo se sale). */
export function toGrid(part: Part): string[] {
  const rows = Array.from({ length: H }, () => '.'.repeat(W));
  for (const [row, x0, p] of part) {
    const y = row + TOP;
    if (y < 0 || y >= H || x0 < 0 || x0 + p.length > W)
      throw new Error(`Tramo fuera de la rejilla: ${row},${x0},${p}`);
    const r = rows[y]!;
    let out = r.slice(0, x0);
    for (let i = 0; i < p.length; i++) out += p[i] === '.' ? r[x0 + i] : p[i];
    rows[y] = out + r.slice(x0 + p.length);
  }
  return rows;
}

// ---------- Cabezas ----------

const HEAD_TOP: Part = [
  [6, 15, 'vvvvuuuutt'],
  [7, 13, 'vvvvvuuuuuuttt'],
  [8, 12, 'vvvvvvuuuuuutttt'],
  [9, 11, 'uvvvvvuuuuuuuttttt'],
  [10, 11, 'uvvvvvuuuuuuuttttt'],
  [11, 10, 'uvvvvvuuuuuuuuttttt'],
  [12, 10, 'uvvvvuuuuuuuuuttttts'],
  [13, 10, 'uvvvvuuuuuuuuuttttts'],
  [14, 10, 'uvvvuuuuuuuuuuttttts'],
  [15, 10, 'uvvuuuuuuuuuuuttttts'],
  [16, 10, 'uttttvuttttttuttttts'],
  [17, 10, 'uuuuuvutuuuuuuttttsut'],
  [18, 10, 'uuuuuvttuuuuutttttstut'],
  [19, 10, 'uvvvuvttuvuuttttttstst'],
  [20, 10, 'uvvuuuttuuuttttttstst'],
  [21, 10, 'uuuuvSstuuttttttsstt'],
];

export const HEADS = {
  m: [
    ...HEAD_TOP,
    [22, 11, 'uuutttuuuttttttsts'],
    [23, 11, 'uuuutttuutttttttss'],
    [24, 11, 'uuuuuuuuutttttss'],
    [25, 12, 'uuuvvuuttttttss'],
    [26, 12, 'tuuvvuuuttttss'],
    [27, 13, 'tuuuuuttttsss'],
    [28, 14, 'ttuutttssss'],
    [29, 16, 'tttssssstt'],
    [30, 18, 'tsssstts'],
    [31, 18, 'uuttttts'],
    [32, 17, 'uuuuttttts'],
    [33, 17, 'uuuuttttts'],
    [34, 17, 'uuuuttttts'],
  ],
  f: [
    ...HEAD_TOP,
    [22, 11, 'uuutttuuutttttsts'],
    [23, 11, 'uuuutttuuttttts'],
    [24, 12, 'uuuuuuuutttttss'],
    [25, 12, 'uuuvvuuttttss'],
    [26, 13, 'uuvvuutttsss'],
    [27, 14, 'tuuuuttsss'],
    [28, 15, 'ttttsss'],
    [29, 18, 'ssssstt'],
    [30, 18, 'tssstts'],
    [31, 18, 'uuttttt'],
    [32, 18, 'uuutttt'],
    [33, 18, 'uuutttt'],
    [34, 18, 'uuutttt'],
  ],
} satisfies Record<string, Part>;

// ---------- Rasgos ----------

export const EYES = {
  normal: [
    [17, 12, 'kkk'],
    [18, 12, 'yxw'],
    [17, 18, 'kkkk'],
    [18, 18, 'wyxw'],
  ],
  grande: [
    [17, 11, 'kkkk'],
    [18, 12, 'yyw'],
    [19, 12, 'xxt'],
    [17, 18, 'kkkkk'],
    [18, 18, 'wyWw'],
    [19, 18, 'txxt'],
  ],
  entornado: [
    [17, 12, 'ttt'],
    [18, 12, 'kyk'],
    [17, 18, 'tttt'],
    [18, 18, 'kyyk'],
  ],
  cerrado: [
    [18, 12, 'sss'],
    [18, 18, 'ssss'],
  ],
} satisfies Record<string, Part>;

export const BROWS = {
  recta: [
    [15, 11, 'hhh'],
    [15, 17, 'hhhhh'],
  ],
  gruesa: [
    [14, 12, 'hh'],
    [15, 11, 'hhhh'],
    [14, 18, 'hhh'],
    [15, 17, 'hhhhh'],
  ],
  arqueada: [
    [15, 11, 'h'],
    [14, 12, 'hh'],
    [15, 14, 'h'],
    [15, 17, 'h'],
    [14, 18, 'hhh'],
    [15, 21, 'h'],
  ],
  fruncida: [
    [14, 11, 'hh'],
    [15, 13, 'hh'],
    [15, 17, 'hh'],
    [14, 19, 'hhh'],
  ],
} satisfies Record<string, Part>;

export const MOUTHS = {
  neutra: [[24, 14, 'sSSSs']],
  sonrisa: [
    [23, 14, 'S...S'],
    [24, 15, 'SSS'],
    [25, 15, 'uu'],
  ],
  mueca: [
    [23, 18, 'S'],
    [24, 14, 'sSSs'],
  ],
  seria: [
    [24, 14, 'SSSSS'],
    [25, 15, 'ttt'],
  ],
  abierta: [
    [24, 14, 'SWWWS'],
    [25, 15, 'SSS'],
  ],
} satisfies Record<string, Part>;

/** Labios marcados (se pintan encima de la boca). */
export const LIPS: Part = [
  [24, 15, 'rr'],
  [25, 15, 'rrr'],
];

export const NOSE_BIG: Part = [
  [20, 13, 'u'],
  [21, 13, 'vu'],
  [22, 13, 'tt'],
];

export const FRECKLES: Part = [
  [20, 12, 's.s'],
  [21, 19, 's.s'],
  [20, 20, 's'],
];

export const SCAR: Part = [
  [13, 20, 'v'],
  [14, 20, 's'],
  [15, 20, 'v'],
  [16, 20, 's'],
  [17, 21, 'v'],
];

export const BLUSH: Part = [
  [20, 11, 'rr'],
  [20, 20, 'rr'],
];

export const EYEPATCH: Part = [
  [12, 28, 'k'],
  [13, 26, 'kk'],
  [14, 24, 'kk'],
  [15, 22, 'kk'],
  [16, 17, 'kkkkkk'],
  [17, 17, 'kKKKkk'],
  [18, 17, 'kKLKk'],
  [19, 18, 'kkk'],
  [14, 10, 'kk'],
  [15, 12, 'kkk'],
  [16, 15, 'kk'],
];

export const BANDAGE: Part = [
  [10, 10, 'WWWWWWWWWWWWWWWWWWWW'],
  [11, 9, 'pWWWWWWWWWWWWRRWWWWWp'],
  [12, 9, 'ppWWWWWWWWWWRRRWWWWpp'],
  [13, 10, 'pppppppppppppppppppp'],
  [12, 30, 'Wp'],
  [13, 30, 'WWp'],
  [14, 31, 'Wp'],
  [15, 31, 'pp'],
];

// ---------- Pelo ----------

export const HAIR_FRONT = {
  corto: [
    [3, 16, 'ijjjjjii'],
    [4, 14, 'ijjlljjjjjii'],
    [5, 12, 'ijjllljjjjjjiii'],
    [6, 11, 'ijllljjjjhjjjiiii'],
    [7, 10, 'ijjlljjjjhjjjjiiiii'],
    [8, 10, 'jjlljjjjhjjjjjiiihi'],
    [9, 9, 'ijjljjjhjjjjjjiiihhhh'],
    [10, 9, 'jjljjjhjjjjjiijiihhhh'],
    [11, 9, 'hjjjjhjjjhjjiiijihhhh'],
    [12, 10, 'hj..jjh..ijh..iihhhh'],
    [13, 10, 'h...jh....i.....hhhh'],
    [14, 26, 'hhhh'],
    [15, 26, 'hiih'],
    [16, 26, 'hih'],
    [17, 26, 'hh'],
  ],
  largo: [
    [3, 15, 'ijjjjjjii'],
    [4, 13, 'ijjlljjjjjii'],
    [5, 11, 'ijjllljjjjjiiii'],
    [6, 10, 'ijllljjjjjhjjiiii'],
    [7, 9, 'ijjlljjjjjjhjjjiiii'],
    [8, 9, 'jjllljjjjjhjjjjiiihi'],
    [9, 8, 'ijjlljjjjhjjjjjjiiihhi'],
    [10, 8, 'jjljjjjhjjjjjjjjiiihhi'],
    [11, 8, 'jlj.jjjjjhjjjiijjiihhi'],
    [12, 8, 'jlj..hjjjjhjjiijjiihhi'],
    [13, 8, 'jlj...hjjj.ijii.jiihhi'],
    [14, 8, 'jlj.......h...i..jihhi'],
    ...Array.from({ length: 8 }, (_, i): Span => [15 + i, 7, i < 2 ? 'jlji' : 'jlli']),
    ...Array.from({ length: 5 }, (_, i): Span => [23 + i, 8, i < 3 ? 'lji' : 'jji']),
    [28, 8, 'ji'],
    [29, 9, 'i'],
    ...Array.from({ length: 18 }, (_, i): Span => [
      15 + i,
      26,
      i < 3 ? 'jiihh' : i % 6 === 2 ? 'jlihh' : 'jjihh',
    ]),
    [33, 27, 'jih'],
    [34, 28, 'ih'],
  ],
  coleta: [
    [4, 15, 'ijjjjjjii'],
    [5, 13, 'ijllljjjjjii'],
    [6, 11, 'ijlllljjjjjjii'],
    [7, 10, 'ijllljjjjjjjiiii'],
    [8, 10, 'jjlljjjjhjjjjiiii'],
    [9, 10, 'jljjjjhjjjjjjiiihh'],
    [10, 10, 'hjjjjhjjjjjiiiihhh'],
    [11, 11, 'hh.hh....iiiiihhhh'],
    [12, 24, 'iiihhh'],
    [13, 26, 'hihh'],
    [14, 27, 'hh'],
  ],
  punta: [
    [1, 13, 'i'],
    [1, 19, 'j'],
    [1, 24, 'i'],
    [2, 13, 'ij...jl...ji'],
    [3, 12, 'ijj.jll..jjii'],
    [4, 12, 'ijjljllj.jjjii'],
    [5, 11, 'ijjlljjjjjjjiii'],
    [6, 10, 'iijllljjjhjjjiiii'],
    [7, 9, 'ijjjlljjjjhjjjiiiii'],
    [8, 9, 'jjjlljjjjhjjjjjiiihi'],
    [9, 9, 'ijjljjjhjjjjjjiiihhhh'],
    [10, 8, 'ijjljjjhjjjjjiijiihhhh'],
    [11, 9, 'hjjhjhjjjhjjiiijihhhh'],
    [12, 9, 'h.j.jjh.hij...iihhhh'],
    [13, 10, '...jh.....i....hhhh'],
    [14, 26, 'hhhh'],
    [15, 26, 'hiih'],
    [16, 26, 'hih'],
  ],
  mono: [
    [0, 21, 'ijji'],
    [1, 20, 'ijllji'],
    [2, 20, 'jllljih'],
    [3, 16, 'iijjjjljjih'],
    [4, 13, 'ijjllljjjjiih'],
    [5, 11, 'ijlllljjjjjjii'],
    [6, 10, 'ijllljjjjjjjiiii'],
    [7, 10, 'jjlljjjjhjjjjiiii'],
    [8, 10, 'jljjjjhjjjjjjiiihh'],
    [9, 10, 'hjjjjhjjjjjiiiihhh'],
    [10, 11, 'hhjhh...iiiiihhhh'],
    [11, 12, 'h.....h..iiihhhh'],
    [12, 25, 'ihhh'],
    [13, 26, 'hhh'],
    [14, 27, 'hh'],
  ],
  calvo: [],
} satisfies Record<string, Part>;

/** Pelo que cae detrás de la cabeza y los hombros. */
export const HAIR_BACK = {
  largo: [
    ...Array.from({ length: 22 }, (_, i): Span => [
      12 + i,
      7,
      i % 5 === 4 ? 'hiihiiiiiiiiiiiiiiiiiiihi' : 'iiiiiihiiiiiiiiiiiihiiiii',
    ]),
    [34, 8, 'hiiiihiiiiiiiiiiiiihiih'],
    [35, 9, 'hhiiiihhhhhhhhhiiiihh'],
  ],
  coleta: [
    [10, 28, 'jjih'],
    [11, 28, 'jljih'],
    [12, 29, 'jjihh'],
    [13, 29, 'ljjih'],
    [14, 30, 'jjih'],
    [15, 30, 'ljih'],
    [16, 30, 'jjih'],
    [17, 31, 'jih'],
    [18, 31, 'ljh'],
    [19, 31, 'jih'],
    [20, 31, 'jih'],
    [21, 31, 'jhh'],
    [22, 31, 'ih'],
    [23, 31, 'ih'],
    [9, 27, 'RR'],
    [10, 27, 'R'],
  ],
} satisfies Record<string, Part>;

export const BEARDS = {
  barba: [
    [19, 27, 'h'],
    [20, 26, 'hi'],
    [21, 25, 'hii'],
    [22, 11, 'i'],
    [22, 23, 'iijih'],
    [23, 11, 'ii.jjjjjji.iiijiih'],
    [24, 11, 'iiji...ijjiiiijih'],
    [25, 11, 'ijjjj..jjjjjiiihh'],
    [26, 12, 'ijjljjjjjjiiihh'],
    [27, 12, 'iijlljjjjjiiih'],
    [28, 13, 'ijlljjjjiiihh'],
    [29, 14, 'ijjjjjiiihh'],
    [30, 15, 'hijjiiihh'],
    [31, 17, 'hhihh'],
  ],
  perilla: [
    [23, 13, 'ijjjjji'],
    [24, 12, 'h..........'],
    [25, 14, 'h...h'],
    [26, 14, 'ijjji'],
    [27, 14, 'ijlji'],
    [28, 15, 'ijjh'],
    [29, 16, 'hih'],
  ],
} satisfies Record<string, Part>;

// ---------- Sombreros ----------

export const HEADGEAR = {
  // Casco de bandas con nasal y carrilleras: cúpula alta con nervio central y remaches.
  casco: [
    [-2, 18, 'pn'],
    [-1, 16, 'oppnnm'],
    [0, 15, 'opppnnnmm'],
    [1, 13, 'ooppopnnnnmm'],
    [2, 12, 'ooppopnnnnnnmm'],
    [3, 11, 'ooppoopnnnnnnnmm'],
    [4, 11, 'oppooopnnnnnnnmmm'],
    [5, 10, 'oopoooopnnnnnnnmmm'],
    [6, 10, 'oooooopnnnnnnnnnmmm'],
    [7, 9, 'noooooopnnnnnnnnnmmm'],
    [8, 9, 'noooooopnnnnnnnnnnmmm'],
    [9, 8, 'nnoooooopnnnnnnnnnnmmm'],
    [10, 8, 'mnnnnnnnonnnnnnnnnnnmmm'],
    [11, 8, 'mmmmmmmmmmmmmmmmmmmmmmm'],
    [12, 7, 'oooopoooopoooopoooopooonm'],
    [13, 7, 'mnnnnnnnnnnnnnnnnnnnnnmmm'],
    [14, 14, 'mpm'],
    [15, 14, 'mom'],
    [16, 14, 'mom'],
    [17, 14, 'mom'],
    [18, 15, 'mm'],
    [14, 25, 'mnonm'],
    [15, 25, 'mnonm'],
    [16, 25, 'mnonm'],
    [17, 26, 'mnnm'],
    [18, 26, 'mnm'],
    [19, 27, 'mm'],
  ],
  capucha: [
    [1, 15, 'abbbbbba'],
    [2, 12, 'abccccbbbbba'],
    [3, 10, 'abcdddcccbbbba'],
    [4, 9, 'abcddcccccbbbbba'],
    [5, 8, 'abcdcccccccbbbbbaa'],
    [6, 7, 'abcdccccccccbbbbbbaa'],
    [7, 7, 'bcdcccbbbbbbbbbbbbbaa'],
    [8, 6, 'abcdcba.........abbbba'],
    [9, 6, 'abcdca...........abbba'],
    [10, 6, 'abccba............abba'],
    [11, 6, 'abcca.............abba'],
    ...Array.from({ length: 12 }, (_, i): Span => [12 + i, 6, i < 8 ? 'abcca' : 'abcbba']),
    ...Array.from({ length: 13 }, (_, i): Span => [12 + i, 28, i < 9 ? 'bbba' : 'abbbaa']),
    [24, 6, 'abcbbba'],
    [25, 5, 'abcbbbba'],
    [26, 5, 'abccbbbba'],
    [27, 4, 'abcccbbbbaa'],
    [25, 27, 'abbbbba'],
    [26, 26, 'abbbbbbaa'],
    [27, 25, 'abbbbbbbbaa'],
    [28, 4, 'abcccbbbbaaa'],
    [28, 24, 'aabbbbbbbbbaa'],
  ],
  // Sombrero de mago: cono alto que se curva hacia atrás, cinta dorada, estrella y ala ancha.
  sombrero: [
    [-7, 31, 'ba'],
    [-6, 29, 'dcba'],
    [-5, 28, 'dcba'],
    [-4, 26, 'dccbba'],
    [-3, 25, 'dccbba'],
    [-2, 24, 'dccbbba'],
    [-1, 23, 'dcccbba'],
    [0, 22, 'dcccbbba'],
    [1, 21, 'dccccbbba'],
    [2, 20, 'dccccbbba'],
    [3, 19, 'dcccccbbba'],
    [4, 18, 'dcccccbbbaa'],
    [5, 17, 'dccccccbbaa'],
    [6, 16, 'dccccccbbbaa'],
    [7, 15, 'DDCCCCCCCBBBA'],
    [8, 14, 'DCCCCCCCCBBBA'],
    [9, 5, 'abcccccc'],
    [9, 13, 'DCCCCCCCCBBBBA'],
    [9, 27, 'bbbbbbba'],
    [2, 24, 'D'],
    [3, 23, 'DWD'],
    [4, 24, 'D'],
    [-2, 27, 'D'],
    [10, 3, 'dddccccccccccccccccbbbbbbbbbbbbaaa'],
    [11, 2, 'cccbbbbbbbbbbbbbbbbbbbbbbbbbbbaaaaaa'],
    [12, 4, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
  ],
  // Gorro de cazador con visera hacia delante y pluma larga.
  gorra: [
    [0, 15, 'dccba'],
    [1, 13, 'dcccccbba'],
    [2, 12, 'dcccccbbbbba'],
    [3, 11, 'dccccccbbbbbbaa'],
    [4, 10, 'dccccccbbbbbbbbaa'],
    [5, 10, 'dcccccbbbbbbbbbbaa'],
    [6, 9, 'dcccccbbbbbbbbbbbbaa'],
    [7, 9, 'DCCCCCBBBBBBBBBBBBAA'],
    [8, 6, 'dddcccccbbbbbbbbbbbbbbaa'],
    [9, 4, 'cccccbbbbbbbbbbbbbbbbbbaaa'],
    [10, 6, 'aaaaaaaaaaaaaaaaaa'],
    [-6, 34, 'R'],
    [-5, 33, 'RK'],
    [-4, 33, 'RWK'],
    [-3, 32, 'RWK'],
    [-2, 32, 'RWK'],
    [-1, 31, 'RRWK'],
    [0, 31, 'RWK'],
    [1, 30, 'RRWK'],
    [2, 30, 'RWK'],
    [3, 29, 'RRWK'],
    [4, 29, 'RWK'],
    [5, 28, 'RWK'],
    [6, 28, 'WK'],
    [7, 28, 'W'],
  ],
} satisfies Record<string, Part>;

// ---------- Bustos por clase ----------

const SHOULDERS: Part = [
  [32, 12, 'bbbcccccccccccbbbb'],
  [33, 8, 'bbcccccccccccccccbbbbbbb'],
  [34, 5, 'bccccccccccccccccccccbbbbbbbb'],
  [35, 3, 'bcccdccccccccccccccccccbbbbbbbbb'],
  [36, 2, 'bccddccccccccccccccccccccbbbbbbbbb'],
  [37, 1, 'bccddcccccccccccccccccccccbbbbbbbbbb'],
  [38, 0, 'bccddccccccccccccccccccccccbbbbbbbbbbb'],
  [39, 0, 'bccddcccccccccccccccccccccccbbbbbbbbbb'],
];

export const OUTFITS = {
  guerrero: [
    ...SHOULDERS,
    [33, 15, 'nononononon'],
    [34, 13, 'onononononono'],
    [35, 14, 'ncccccccccn'],
    [36, 14, 'nCcccccccCn'],
    [37, 14, 'nCcccDDccCn'],
    [38, 14, 'nCcccDDccCn'],
    [39, 14, 'nCcccccccCn'],
    // Hombreras.
    [32, 3, 'mnooom'],
    [33, 1, 'mnoppoonm'],
    [34, 0, 'mnopppoonnm'],
    [35, 0, 'nopppooonnm'],
    [36, 0, 'mmmmmmmmmmmm'],
    [37, 0, 'nooooonnnnm'],
    [38, 0, 'mnnnnnnmmm'],
    [32, 28, 'moooonm'],
    [33, 27, 'mnoooonnnm'],
    [34, 27, 'nooooonnnnmm'],
    [35, 27, 'noooonnnnnmm'],
    [36, 27, 'mmmmmmmmmmmmm'],
    [37, 28, 'nnnnnnnmmmm'],
    [38, 29, 'mnnnnmmmm'],
    [32, 17, 'mnoooonm'],
  ],
  picaro: [
    ...SHOULDERS,
    [30, 16, 'abbbbbbbba'],
    [31, 15, 'abccccbbbbba'],
    [32, 14, 'abcddccbbbbbba'],
    [33, 15, 'abccccbbbbba'],
    [34, 27, 'BB'],
    [35, 25, 'BCB'],
    [36, 22, 'BCCB'],
    [37, 19, 'BCCB'],
    [38, 16, 'BDDCB'],
    [39, 13, 'BCCB'],
    [37, 20, 'DD'],
  ],
  mago: [
    ...SHOULDERS,
    [29, 11, 'aB'],
    [30, 11, 'abB'],
    [31, 11, 'abcB'],
    [32, 11, 'abccB'],
    [33, 12, 'abccB'],
    [34, 13, 'abcB'],
    [35, 14, 'aBB'],
    [29, 27, 'Ba'],
    [30, 26, 'Bba'],
    [31, 25, 'Bbba'],
    [32, 24, 'Bbbba'],
    [33, 24, 'Bbbba'],
    [34, 24, 'Bbba'],
    [35, 24, 'BBa'],
    [36, 17, 'BB.BB'],
    [37, 18, 'BWDB'],
    [38, 18, 'BDDB'],
    [39, 19, 'BB'],
  ],
  clerigo: [
    ...SHOULDERS,
    [32, 15, 'bbcccccbb'],
    [33, 13, 'bbbcccccbbb'],
    [33, 13, 'AB'],
    [34, 13, 'ABB'],
    [35, 13, 'ACB'],
    [36, 13, 'ACB'],
    [37, 13, 'ACB'],
    [38, 13, 'ACB'],
    [39, 13, 'ACB'],
    [33, 24, 'BA'],
    [34, 23, 'BBA'],
    [35, 23, 'BCA'],
    [36, 23, 'BCA'],
    [37, 23, 'BCA'],
    [38, 23, 'BCA'],
    [39, 23, 'BCA'],
    [35, 18, 'DWD'],
    [36, 17, 'DWWWD'],
    [37, 18, 'DWD'],
  ],
  explorador: [
    ...SHOULDERS,
    [33, 10, 'AAA'],
    [34, 8, 'ABBBA'],
    [35, 6, 'ABBCCBA'],
    [36, 5, 'ABBCCCBBA'],
    [37, 4, 'ABCCCCBBBA'],
    [38, 3, 'ABCCCDCBBBA'],
    [39, 3, 'ABCCCCCBBBA'],
    [33, 26, 'AAAA'],
    [34, 25, 'ABBBBA'],
    [35, 25, 'ABBBBBA'],
    [36, 25, 'ABBBBBBBA'],
    [37, 26, 'ABBBBBBBBA'],
    [38, 27, 'ABBBBBBBBA'],
    [39, 27, 'ABBBBBBBBA'],
    [35, 11, 'DD'],
    [36, 11, 'DW'],
    [32, 28, 'hhW'],
    [31, 29, 'RW'],
    [30, 30, 'RR'],
  ],
  tabernero: [
    ...SHOULDERS,
    [32, 17, 'ttuuttt'],
    [33, 18, 'uuuut'],
    [34, 19, 'uut'],
    [35, 20, 't'],
    [33, 14, 'BB'],
    [34, 14, 'BC'],
    [35, 14, 'BC'],
    [36, 14, 'BCAAAAAAAAAAB'],
    [37, 14, 'BCCCCCCCCCCCB'],
    [38, 14, 'BCCDCCCCCCCCB'],
    [39, 14, 'BCCCCCCCCCCCB'],
    [33, 25, 'BB'],
    [34, 25, 'CB'],
    [35, 25, 'CB'],
    [31, 29, 'WWW'],
    [32, 29, 'WWWWp'],
    [33, 29, 'RRRRp'],
    [34, 30, 'WWWp'],
    [35, 30, 'WWpp'],
    [36, 31, 'Wpp'],
  ],
} satisfies Record<string, Part>;
