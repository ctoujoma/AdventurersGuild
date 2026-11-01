/**
 * Lo que comparten las versiones del mapa: los iconos de los lugares (con su contorno, para que
 * se lean sobre cualquier fondo), las casas, la rosa de los vientos, el barco y la sierpe.
 */
import { PLACE_INFO } from '../data/places';
import { P } from './palette';
import { PixelBuffer, type Color } from './pixel';

/**
 * Estampa un dibujito por el centro de su base (`x`, `y`), con contorno `line` (o sin él). Las
 * letras de `rows` se buscan en `pal`; el punto es transparente.
 */
export function stamp(
  b: PixelBuffer,
  x: number,
  y: number,
  rows: readonly string[],
  pal: Record<string, Color>,
  line: Color | null,
): void {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const x0 = x - (w >> 1);
  const y0 = y - h + 1;
  const on = (i: number, j: number) => {
    const c = rows[j]?.[i];
    return !!c && c !== '.' && !!pal[c];
  };
  if (line !== null)
    for (let j = -1; j <= h; j++)
      for (let i = -1; i <= w; i++) {
        if (on(i, j)) continue;
        if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))
          if (b.inside(x0 + i, y0 + j)) b.set(x0 + i, y0 + j, line);
      }
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) if (on(i, j)) b.set(x0 + i, y0 + j, pal[rows[j]![i]!]!);
}

const STONE = { s: P.mist, S: P.fog, T: P.steel, d: P.black, g: P.leaf };

type Icon = { rows: string[]; pal: Record<string, Color> };

/** El icono de un lugar, por su nombre o, si no, por su terreno (o nada). */
export function placeIcon(name: string, terrain: string): Icon | null {
  if (/torre|islote/.test(name))
    return {
      rows: ['.s.s..', '.sSs..', '.sST..', '.sdT.s', '.sST.S', 'sSSTTS'],
      pal: STONE,
    };
  if (/ermita|priorato|monasterio/.test(name))
    return {
      rows: [
        '...y...',
        '..yyy..',
        '...y...',
        '..rrR..',
        '.rrrRR.',
        'rrrrRRR',
        '.wwdwS.',
        '.wwdwS.',
      ],
      pal: { y: P.gold, r: P.brick, R: P.wine, w: P.sand, S: P.tan, d: P.bark },
    };
  if (/cementerio/.test(name))
    return {
      rows: ['.s.....', 'sss..s.', '.s..sSs', '.S..sSs', '.S..sST', 'ggggggg'],
      pal: STONE,
    };
  if (/catacumbas|cripta/.test(name))
    return {
      rows: ['...s...', '..sss..', '.sssss.', 'sSSSSST', 'sSdddST', 'sSdddST', 'TTTTTTT'],
      pal: STONE,
    };
  if (/mina/.test(name))
    return {
      rows: ['ooooooo', '.o...o.', '.odddo.', '.odddo.', 'sSdddTs'],
      pal: { ...STONE, o: P.oak },
    };
  if (/Corona/.test(name))
    return {
      rows: ['.rrr', '.rrR', '.rR.', '.k..', '.k..', 'kkk.'],
      pal: { r: P.red, R: P.wine, k: P.bark },
    };
  if (/refugio/.test(name))
    return {
      rows: ['..TT..', '.TTTT.', 'TTTTTT', '.odoo.', '.odoo.'],
      pal: { T: P.steel, o: P.oak, d: P.bark },
    };
  if (/cueva|desfiladero|paso|riscos|loma|Hondogrís/.test(name))
    return {
      rows: ['..sss..', '.sSSsS.', 'sSdddST', 'sdddddT', 'SdddddT'],
      pal: STONE,
    };
  if (/molino/.test(name))
    return {
      rows: ['s...s', '.s.s.', '..o..', '.s.s.', 's.o.s', '.oro.', '.odo.'],
      pal: { s: P.sand, o: P.oak, r: P.brick, d: P.bark },
    };
  if (/puente/.test(name))
    return {
      rows: ['kkkkk', 'k..r.', 'k..r.', 'k....', 'k....', 'kk...'],
      pal: { k: P.bark, r: P.tan },
    };
  if (/granero/.test(name))
    return {
      rows: ['...r...', '..rrR..', '.rrrRR.', 'rrrrRRR', '.RwdwR.', '.RRdRR.'],
      pal: { r: P.brick, R: P.wine, w: P.sand, d: P.bark },
    };
  if (/campamento/.test(name))
    return {
      rows: ['..w.....', '.wsw..w.', 'wssdwwsw', 'wssdwsdw', '....fy..'],
      pal: { w: P.sand, s: P.tan, d: P.bark, f: P.red, y: P.gold },
    };
  if (/salinas/.test(name))
    return {
      rows: ['.w....w.', 'www..www', 'sssssSSS', 'cccCcccC'],
      pal: { w: P.white, s: P.mist, S: P.fog, c: P.sky, C: P.cyan },
    };
  if (/Juncal/.test(name))
    return {
      rows: ['...k...', '..kw...', '.kww...', 'oooooo.', '.oooo..'],
      pal: { k: P.bark, w: P.sand, o: P.oak },
    };
  if (/casa|posada|mesón/.test(name))
    return {
      rows: ['..rrR...', '.rrrRR.y', 'rrrrRRRy', '.wwdwS.k', '.wwdwS.k'],
      pal: { r: P.brick, R: P.wine, w: P.sand, S: P.tan, d: P.bark, y: P.gold, k: P.bark },
    };
  if (/ranas/.test(name))
    return {
      rows: ['.g...g.', 'gGg.gGg', '.ggggg.', 'gGGGGGg', '.g...g.'],
      pal: { g: P.lime, G: P.leaf },
    };
  if (terrain === 'ruina') return { rows: ['s...s', 's.s.S', 'S.S.S', 'SsSsT'], pal: STONE };
  return null;
}

/** Todos los lugares con su icono, encima de su punto (el marcador de la interfaz, al pie). */
export function placeIcons(b: PixelBuffer, line: Color | null, pal?: (c: Color) => Color): void {
  for (const [name, p] of Object.entries(PLACE_INFO)) {
    const ic = placeIcon(name, p.terrain);
    if (!ic) continue;
    const colors = pal
      ? Object.fromEntries(Object.entries(ic.pal).map(([k, c]) => [k, pal(c)]))
      : ic.pal;
    stamp(b, p.x, p.y - 3, ic.rows, colors, line);
  }
}

const ROOFS = [
  { r: P.brick, R: P.wine },
  { r: P.steel, R: P.slate },
];

/** Una casa (5 × 5), con tejado rojo o de pizarra. */
export function house(b: PixelBuffer, x: number, y: number, roof: number, line: Color | null) {
  const c = ROOFS[roof] ?? ROOFS[0]!;
  stamp(
    b,
    x,
    y,
    ['.rrR.', 'rrrRR', '.wdS.', '.wwS.'],
    { ...c, w: P.sand, S: P.tan, d: P.bark },
    line,
  );
}

/** Rosa de los vientos de dieciséis puntas, con su aro y la flor de lis al norte. */
export function compass(b: PixelBuffer, cx: number, cy: number, r: number, ink: Color): void {
  // El aro.
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    for (const rr of [r - 3, r - 1]) {
      const x = Math.round(cx + Math.cos(t) * rr);
      const y = Math.round(cy + Math.sin(t) * rr);
      b.set(x, y, rr === r - 1 ? ink : P.gold);
    }
    if (a % 22 === 0)
      b.set(Math.round(cx + Math.cos(t) * (r + 1)), Math.round(cy + Math.sin(t) * (r + 1)), ink);
  }
  // Las puntas: largas las cardinales, medias las de en medio, cortas el resto.
  for (let k = 0; k < 16; k++) {
    const ang = (k * Math.PI) / 8 - Math.PI / 2;
    const len = k % 4 === 0 ? r + 4 : k % 2 === 0 ? r * 0.7 : r * 0.45;
    const wide = k % 4 === 0 ? 2.6 : k % 2 === 0 ? 1.8 : 1.1;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    for (let s = 0; s <= len; s += 0.5) {
      const w = (1 - s / len) * wide;
      for (let q = -w; q <= w; q += 0.5) {
        const x = Math.round(cx + ux * s - uy * q);
        const y = Math.round(cy + uy * s + ux * q);
        const lit = q < 0;
        const main = k % 4 === 0;
        b.set(
          x,
          y,
          k === 0 ? (lit ? P.red : P.wine) : main ? (lit ? P.sand : P.tan) : lit ? P.gold : P.amber,
        );
      }
    }
  }
  b.ellipse(cx, cy, 1.6, 1.6, P.gold);
  b.set(cx, cy, P.wine);
  // La flor de lis, encima del norte.
  const ny = cy - r - 9;
  stamp(b, cx, ny, ['..r..', 'r.r.r', 'rrrrr', '.rrr.', '..r..'], { r: P.wine }, null);
}

export function ship(b: PixelBuffer, x: number, y: number, line: Color): void {
  stamp(
    b,
    x,
    y,
    [
      '....r.....',
      '....k.....',
      '...wk.w...',
      '..wwkwww..',
      '.wwwkwwww.',
      '..wwkwww..',
      '....k.....',
      'oooooooooo',
      '.OOOOOOOO.',
      '..OOOOOO..',
    ],
    { r: P.red, k: P.bark, w: P.sand, o: P.oak, O: P.rust },
    line,
  );
  b.hline(x - 8, y + 1, 3, P.mist);
  b.hline(x + 6, y + 1, 3, P.mist);
}

/** La sierpe de mar: tres jorobas y la cabeza. */
export function serpent(b: PixelBuffer, x: number, y: number, line: Color): void {
  const body = { g: P.leaf, G: P.forest, y: P.lemon, r: P.red };
  stamp(b, x, y, ['.gg.', 'gGGg', 'G..G'], body, line);
  stamp(b, x + 7, y, ['.gg.', 'gGGg', 'G..G'], body, line);
  stamp(b, x + 14, y, ['..ggg', '.gGyg', 'gG.gr', 'G....'], body, line);
  stamp(b, x - 6, y, ['g..', '.g.', '.gg'], body, line);
}

/** La ballena, soplando. */
export function whale(b: PixelBuffer, x: number, y: number, line: Color): void {
  stamp(
    b,
    x,
    y,
    ['..w.w....', '...w.....', '.NNNNN..N', 'NNSNNNNNN', '.NNNNNN.N'],
    { N: P.slate, S: P.mist, w: P.white },
    line,
  );
}
