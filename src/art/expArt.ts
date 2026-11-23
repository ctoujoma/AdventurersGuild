/**
 * Lo que se dibuja encima del terreno del mapa de rumbos (`expTerrain.ts`), en los dos estilos:
 * las piedras de las ruinas, los árboles muertos de las marismas, los accidentes de cada rumbo
 * (el pico, el árbol viejo, la torre hundida, la ciudad perdida) y los del mar (el faro, el
 * remolino, el pecio, más barcos y bichos). Son dibujitos como los de `mapIcons.ts`: el mismo
 * color en los dos estilos y el contorno en tinta (pergamino) o negro (color).
 */
import type { MapStyle } from './map';
import { placeIcon, serpent, ship, stamp, whale } from './mapIcons';
import { mount } from './mapInk';
import { from, hash2, type Ruin, type Terrain } from './mapTerrain';
import { P } from './palette';
import type { Color, PixelBuffer } from './pixel';

const STONE = { s: P.mist, S: P.fog, T: P.steel, d: P.slate };

/** Las piedras sueltas de las ruinas, por su nombre. */
const PIECES: Record<string, string[]> = {
  muro: ['s.....', 'ss.s..', 'sSsSs.', 'SSSSTT'],
  muroL: ['s.....', 'sS....', 'sS..s.', 'sSsSST', 'SSTTTT'],
  columna: ['sss', '.S.', '.S.', '.S.', '.T.', 'sST'],
  columnas: ['sssss.', '.S..S.', '.S..S.', '.S..T.', 'sST.T.'],
  caida: ['.sSSSTs', 'sSSSTTT', '.TTTTT.'],
  arco: ['.sss.', 'sSSSs', 'S...T', 'S...T', 'T...T'],
  basa: ['s.S..', 'STT.s', '...ST'],
};

/** Una pieza con su sombra (a color, la arena se oscurece abajo a la derecha). */
function piece(
  b: PixelBuffer,
  x: number,
  y: number,
  rows: readonly string[],
  pal: Record<string, Color>,
  line: Color,
  style: MapStyle,
  bold = false,
): void {
  // A color, sin contorno (salvo lo grande, `bold`): la piedra sobre la arena, con su sombra (como el relieve del mapa).
  if (style === 'color') {
    const shade = Object.fromEntries(Object.keys(pal).map((k) => [k, P.clay]));
    stamp(b, x + 1, y + 1, rows, shade, null);
    stamp(b, x, y, rows, { ...pal, T: P.slate }, bold ? line : null);
    return;
  }
  stamp(b, x, y, rows, pal, line);
}

/** El árbol viejo del bosque: copa enorme a lóbulos, tronco grueso y raíces. */
function bigTree(b: PixelBuffer, x: number, y: number, line: Color): void {
  stamp(
    b,
    x,
    y,
    [
      '....hhl.hl.....',
      '..hhllllllll...',
      '.hllllLlllllf..',
      'hlllLllllllfff.',
      'hllllllllLlfffd',
      '.lllLlllllffffd',
      'hlllllllfffffdd',
      '.llllffffffdddd',
      '..lfffffkkfddd.',
      '....ffdkkkdd...',
      '......kkKk.....',
      '......kkKk.....',
      '.....kkkKkk....',
      '...kk.k..k.kk..',
    ],
    { h: P.lime, l: P.leaf, L: P.lime, f: P.forest, d: P.deep, k: P.bark, K: P.oak },
    line,
  );
}

/** La torre hundida de las marismas: torcida, medio en el agua, con sus ondas. */
function sunkTower(b: PixelBuffer, x: number, y: number, line: Color): void {
  stamp(
    b,
    x,
    y,
    [
      '.....s.s.s..',
      '.....sssss..',
      '....sSSSSST.',
      '....sSdSSST.',
      '...sSSSSSTT.',
      '...sSSSSSTT.',
      '...sSSdSSTT.',
      '..sSSSSSSTT.',
      '..sSSSSSSTT.',
      '..sSSSSSTTT.',
      '.sSSdSSSSTT.',
      '.sSSSSSSTTT.',
      'cccccccccccc',
      '.mmmmmmmmm..',
    ],
    { ...STONE, c: P.mist, m: P.sky },
    line,
  );
  b.hline(x - 11, y + 2, 4, P.mist);
  b.hline(x + 8, y + 2, 4, P.mist);
  b.hline(x - 8, y + 4, 3, P.sky);
  b.hline(x + 5, y + 4, 3, P.sky);
}

/**
 * Unos cimientos vistos desde lo alto: un rectángulo de muro roto (la cara de arriba clara y la
 * de delante en sombra), como letras para `stamp`. `seed` decide los huecos.
 */
function foundation(w: number, h: number, seed: number, gaps = 0.22): string[] {
  const g: string[][] = Array.from({ length: h + 1 }, () => Array<string>(w).fill('.'));
  const broken = (k: number) => hash2(k, seed, 507) < gaps;
  for (let x = 0; x < w; x++) {
    if (!broken(x)) {
      g[0]![x] = 's';
      g[1]![x] = g[1]![x] === '.' ? 'T' : g[1]![x]!;
    }
    if (!broken(x + 100)) {
      g[h - 1]![x] = 's';
      g[h]![x] = 'T';
    }
  }
  for (let y = 1; y < h - 1; y++) {
    if (!broken(y + 200)) g[y]![0] = 'S';
    if (!broken(y + 300)) g[y]![w - 1] = 'S';
    // Algún tabique por dentro.
    if (w > 9 && !broken(y + 400) && hash2(seed, 1, 508) < 0.6) g[y]![w >> 1] = 'S';
  }
  return g.map((r) => r.join(''));
}

/** Un corro de ruinas: cimientos rotos, alguna columna en pie y otra caída. */
function site(b: PixelBuffer, x: number, y: number, line: Color, style: MapStyle): void {
  const seed = Math.floor(hash2(x, y, 509) * 9999);
  const w = 8 + Math.floor(hash2(seed, 2, 510) * 9);
  const h = 5 + Math.floor(hash2(seed, 3, 510) * 5);
  piece(b, x, y, foundation(w, h, seed), STONE, line, style);
  const n = Math.floor(hash2(seed, 4, 510) * 3);
  for (let k = 0; k < n; k++) {
    const cx = x - (w >> 1) + 1 + Math.floor(hash2(seed, 10 + k, 510) * (w - 2));
    piece(b, cx, y - h - 1, PIECES.columna!, STONE, line, style);
  }
  if (hash2(seed, 5, 510) < 0.6)
    piece(b, x + (w >> 1) + 4, y + 2, PIECES.caida!, STONE, line, style);
}

/** La ciudad perdida de las ruinas: la muralla rota con sus torres, el templo escalonado, la
 * avenida de columnas y la cabeza de piedra caída. */
function lostCity(b: PixelBuffer, x: number, y: number, line: Color, style: MapStyle): void {
  // Cimientos de casas dentro de la muralla.
  for (const [dx, dy, s] of [
    [-20, -8, 1],
    [20, -9, 2],
    [-21, 12, 3],
    [22, 13, 4],
  ] as const)
    piece(b, x + dx, y + dy, foundation(9, 6, s, 0.3), STONE, line, style);
  // La muralla, rota, y las torres de las esquinas.
  piece(b, x, y + 20, foundation(64, 40, 77, 0.2), STONE, line, style);
  const tower = ['ssss', 'sSST', 'sSST', 'TTTT'];
  for (const [dx, dy] of [
    [-31, -18],
    [31, -18],
    [-31, 21],
    [31, 21],
  ] as const)
    piece(b, x + dx, y + dy, tower, STONE, line, style, true);
  // La avenida de columnas hasta el templo.
  for (const dy of [6, 12, 18])
    for (const dx of [-5, 5]) piece(b, x + dx, y + dy, PIECES.columna!, STONE, line, style);
  // El templo escalonado.
  piece(
    b,
    x,
    y,
    [
      '........ss........',
      '.......sddS.......',
      '......sSSSST......',
      '.....sSSSSSST.....',
      '....sSSSddSSSTT...',
      '...sSSSSddSSSSTT..',
      '..sSSSSSddSSSSSTT.',
      '.sSSSSSSddSSSSSSTT',
      'sSSSSSSSddSSSSSSTT',
      'TTTTTTTTTTTTTTTTTT',
    ],
    STONE,
    line,
    style,
    true,
  );
  // La cabeza de piedra caída, fuera de la muralla.
  piece(
    b,
    x + 40,
    y + 26,
    ['..sssss..', '.sSSSSSS.', 'sSdSSSdST', 'sSSSSSSST', 'sSSSddSST', '.sSSSSST.', '..TTTTT..'],
    STONE,
    line,
    style,
    true,
  );
}

/** El faro en su islote: torre a franjas y la luz. */
function lighthouse(b: PixelBuffer, x: number, y: number, line: Color): void {
  for (const [dx, dy] of [
    [-5, -14],
    [-7, -15],
    [5, -14],
    [7, -15],
    [-6, -12],
    [6, -12],
  ] as const)
    b.set(x + dx, y + dy, P.lemon);
  stamp(
    b,
    x,
    y,
    ['..y..', '.rrr.', '.wwW.', '.rrR.', '.wwW.', '.rrR.', '.wwW.', 'sSSST'],
    { y: P.lemon, r: P.red, R: P.wine, w: P.white, W: P.mist, s: P.mist, S: P.fog, T: P.steel },
    line,
  );
}

/** El remolino: espiral de espuma. */
function whirl(b: PixelBuffer, cx: number, cy: number, style: MapStyle): void {
  for (let a = 0; a < Math.PI * 6; a += 0.08) {
    const r = 1.5 + a * 1.1;
    const x = Math.round(cx + Math.cos(a) * r * 1.4);
    const y = Math.round(cy + Math.sin(a) * r * 0.8);
    const c = style === 'color' ? (a > 12 ? P.sky : P.white) : a > 12 ? P.fog : P.steel;
    b.set(x, y, c);
  }
  b.set(cx, cy, style === 'color' ? P.black : P.slate);
}

/** El pecio en las rocas: el casco roto y el mástil caído. */
function wreck(b: PixelBuffer, x: number, y: number, line: Color): void {
  stamp(
    b,
    x,
    y,
    ['.k......', '..k.....', '...k.oo.', 'o..kOOo.', 'OooOOOOs', '.sSSOSST'],
    { k: P.bark, o: P.oak, O: P.rust, s: P.mist, S: P.fog, T: P.steel },
    line,
  );
}

/** El mojón del paso de la sierra: piedras apiladas con un banderín. */
function cairn(b: PixelBuffer, x: number, y: number, line: Color): void {
  stamp(
    b,
    x,
    y,
    ['.kr', '.kr', '.k.', '.s.', 'sSs', 'SST'],
    { ...STONE, k: P.bark, r: P.red },
    line,
  );
}

/** Lo de encima del mapa de rumbos, para el estilo que toque (dibuja en coordenadas de la comarca). */
export function expDeco(t: Terrain, style: MapStyle): (b: PixelBuffer) => void {
  const line = style === 'color' ? P.black : P.bark;
  return (b) => {
    const { at, inside } = t;
    const x0 = t.x0;
    const y0 = t.y0;
    const x1 = x0 + t.W;
    const y1 = y0 + t.H;
    // Árboles muertos en lo hondo de las marismas.
    for (let gy = from(y0, 5); gy < y1; gy += 5)
      for (let gx = from(x0, 6); gx < x1; gx += 6) {
        const x = gx + Math.floor(hash2(gx, gy, 503) * 4);
        const y = gy + Math.floor(hash2(gx, gy, 504) * 3);
        if (!inside(x, y)) continue;
        const i = at(x, y);
        if (!t.marsh[i] || t.water[i] || t.road[i] || t.forest[i]) continue;
        const wl = t.wild ? t.wild[i]! / 255 : 0;
        if (hash2(gx, gy, 505) > (wl - 0.45) * 0.28) continue;
        if (style === 'color')
          stamp(
            b,
            x,
            y,
            ['k.k', 'kk.', '.k.', '.k.'],
            { k: hash2(x, y, 506) < 0.5 ? P.ebony : P.bark },
            null,
          );
        else stamp(b, x, y, ['k.k', '.k.', '.k.'], { k: P.bark }, null);
      }
    // Más mar: barcos, la ballena y la sierpe.
    ship(b, -150, 310, line);
    ship(b, -280, 40, line);
    whale(b, -240, 210, line);
    serpent(b, -310, -150, line);
    // Las piedras y los accidentes, de arriba abajo.
    for (const r of t.ruins ?? []) draw(b, r, line, style);
  };
}

function draw(b: PixelBuffer, r: Ruin, line: Color, style: MapStyle): void {
  const rows = PIECES[r.kind];
  if (rows) {
    piece(b, r.x, r.y, rows, STONE, line, style);
    return;
  }
  switch (r.kind) {
    case 'pico':
      if (style === 'pergamino') mount(b, r.x, r.y + 14, 30, 0.5);
      cairn(b, r.x + 2, r.y - 15, line);
      break;
    case 'paso':
      cairn(b, r.x, r.y, line);
      break;
    case 'arbol':
      bigTree(b, r.x, r.y + 4, line);
      break;
    case 'torre_hundida':
      sunkTower(b, r.x, r.y + 3, line);
      break;
    case 'sitio':
      site(b, r.x, r.y, line, style);
      break;
    case 'ciudad':
      lostCity(b, r.x, r.y, line, style);
      break;
    case 'faro':
      lighthouse(b, r.x, r.y, line);
      break;
    case 'remolino':
      whirl(b, r.x, r.y, style);
      break;
    case 'naufragio':
      wreck(b, r.x, r.y, line);
      break;
  }
}

type Mark = { rows: string[]; pal: Record<string, Color> };
const from_ = (name: string, terrain = ''): Mark => placeIcon(name, terrain)!;

/** Las marcas de parajes y fardos del mapa de rumbos (las de la comarca, si ya hay). */
export const MARKS: Record<string, Mark> = {
  cofre: {
    rows: ['.ooooo.', 'oOOyOOo', 'kkkykkk', 'oOOOOOo', 'oOOOOOo'],
    pal: { o: P.oak, O: P.rust, k: P.bark, y: P.gold },
  },
  cueva: from_('cueva'),
  mina: from_('mina'),
  torre: from_('torre'),
  ruinas: from_('', 'ruina'),
  campamento: from_('campamento'),
  santuario: {
    rows: ['...y...', '..rrR..', '.rrrRR.', '..wdS..', '..wdS..', '.sSSST.'],
    pal: {
      y: P.gold,
      r: P.brick,
      R: P.wine,
      w: P.sand,
      S: P.tan,
      d: P.bark,
      s: P.mist,
      T: P.steel,
    },
  },
  mercader: {
    rows: ['.rwrwr.', 'rwrwrwr', '.o...o.', 'oOOOOOo', '.k...k.'],
    pal: { r: P.red, w: P.sand, o: P.oak, O: P.rust, k: P.bark },
  },
  viajero: {
    rows: ['..h.k', '.hhhk', '.hfhk', '.ccck', '.ccck', '.c.ck'],
    pal: { h: P.forest, f: P.skin, c: P.leaf, k: P.oak },
  },
  fardo: {
    rows: ['..k..', '.tkt.', 'ttTtt', 'tTTyt', '.ttt.'],
    pal: { t: P.tan, T: P.clay, k: P.bark, y: P.gold },
  },
};
