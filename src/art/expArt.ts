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
): void {
  if (style === 'color') {
    const shade = Object.fromEntries(Object.keys(pal).map((k) => [k, P.clay]));
    stamp(b, x + 2, y + 1, rows, shade, null);
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
      '...s.s.s',
      '...sssss',
      '..sSSSST',
      '..sSdSST',
      '..sSSSST',
      '.sSSdSST',
      '.sSSSSTT',
      '.sSSSSTT',
      'sSSdSSTT',
      'cccccccccc',
      '.mmmmmmm..',
    ],
    { ...STONE, c: P.mist, m: P.sky },
    line,
  );
  b.hline(x - 9, y + 2, 3, P.mist);
  b.hline(x + 7, y + 2, 4, P.mist);
  b.hline(x - 6, y + 4, 3, P.sky);
}

/** La ciudad perdida de las ruinas: el templo escalonado, la muralla rota y la cabeza caída. */
function lostCity(b: PixelBuffer, x: number, y: number, line: Color, style: MapStyle): void {
  // La muralla, a trozos alrededor.
  const wall = (x0: number, y0: number, w: number) => {
    for (let k = 0; k < w; k += 1) {
      if (hash2(x0 + k, y0, 501) < 0.22) continue;
      piece(b, x0 + k, y0, ['s', 'S', 'T'], STONE, line, style);
    }
  };
  wall(x - 24, y - 16, 48);
  wall(x - 24, y + 10, 48);
  for (let k = -14; k <= 8; k += 4) {
    if (hash2(x, k, 502) < 0.3) continue;
    piece(b, x - 25, y + k, ['s', 'S', 'S', 'T'], STONE, line, style);
    piece(b, x + 24, y + k, ['s', 'S', 'S', 'T'], STONE, line, style);
  }
  // El templo escalonado.
  piece(
    b,
    x,
    y + 4,
    [
      '.......ss.......',
      '......sddS......',
      '.....sSSSSS.....',
      '....sSSSSSST....',
      '...sSSSddSSTT...',
      '..sSSSSddSSSTT..',
      '.sSSSSSddSSSSTT.',
      'sSSSSSSddSSSSSTT',
      'TTTTTTTTTTTTTTTT',
    ],
    STONE,
    line,
    style,
  );
  // Columnas delante y la cabeza de piedra caída.
  for (const dx of [-17, -12, 12, 17]) piece(b, x + dx, y + 7, PIECES.columna!, STONE, line, style);
  piece(
    b,
    x + 6,
    y + 18,
    ['..ssss..', '.sSSSSS.', 'sSdSSdST', 'sSSSSSST', 'sSSddSST', '.TTTTTT.'],
    STONE,
    line,
    style,
  );
  piece(b, x - 10, y + 17, PIECES.caida!, STONE, line, style);
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
        if (hash2(gx, gy, 505) > (wl - 0.35) * 0.5) continue;
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
