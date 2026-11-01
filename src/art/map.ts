import { Rng } from '../core/rng';
import { MAP_H, MAP_W, PLACE_INFO, TAVERN } from '../data/places';
import { P } from './palette';
import { PixelBuffer, bayer, type Color } from './pixel';

/**
 * El mapa de la comarca en pixel art, como un pergamino de cartógrafo: costa con líneas
 * de sondeo y rumbos, dos ríos con puentes, sierras nevadas, bosques de dos clases,
 * marismas, campos de labor, aldeas, caminos reales y senderos, rosa de los vientos, un
 * barco y una ballena. Los marcadores (encargos, grupos) se ponen encima desde la interfaz.
 */

let cached: PixelBuffer | null = null;

type Pt = readonly [number, number];

/** Línea de costa: x del agua para cada fila (el mar queda a la izquierda). */
export function coastAt(y: number): number {
  return 58 + 10 * Math.sin(y * 0.045) + Math.max(0, y - 130) * 0.55 + 3 * Math.sin(y * 0.2);
}

/** Río grande: del norte, por el vado y el molino, hasta el mar junto a las salinas. */
const RIVER: readonly Pt[] = [
  [214, 0],
  [210, 40],
  [204, 94],
  [192, 116],
  [176, 130],
  [162, 144],
  [150, 158],
  [128, 172],
  [96, 178],
];
/** Afluente que baja de la sierra y pasa bajo el puente de los ahorcados. */
const BROOK: readonly Pt[] = [
  [266, 24],
  [250, 54],
  [234, 90],
  [220, 112],
  [204, 115],
  [194, 117],
];

/** Caminos reales desde la taberna (los senderos a cada lugar se trazan aparte). */
const ROADS: readonly (readonly Pt[])[] = [
  [
    [198, 146],
    [230, 156],
    [258, 168],
    [280, 182],
    [294, 192],
    [330, 214],
    [396, 230],
  ],
  [
    [198, 146],
    [240, 140],
    [276, 138],
    [320, 132],
    [396, 126],
  ],
  [
    [198, 146],
    [202, 120],
    [204, 94],
    [212, 60],
    [222, 4],
  ],
  [
    [198, 146],
    [172, 152],
    [150, 158],
    [124, 172],
    [108, 182],
  ],
  [
    [198, 146],
    [192, 170],
    [188, 192],
    [186, 230],
    [190, 276],
  ],
];

/** Recorre una polilínea con un leve vaivén, punto a punto. */
function walk(pts: readonly Pt[], wobble: number, draw: (x: number, y: number, i: number) => void) {
  let i = 0;
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, ay] = pts[s]!;
    const [bx, by] = pts[s + 1]!;
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    for (let k = 0; k <= n; k++, i++) {
      const t = k / n;
      const x = Math.round(ax + (bx - ax) * t + Math.sin((ay + by * t) * 0.35) * wobble);
      const y = Math.round(ay + (by - ay) * t + Math.cos((ax + bx * t) * 0.3) * wobble * 0.5);
      draw(x, y, i);
    }
  }
}

function mountain(b: PixelBuffer, x: number, y: number, h: number, snow: boolean): void {
  for (let k = 0; k < h; k++) {
    const row = y - h + k;
    for (let i = -k; i <= k; i++) {
      // Cara izquierda iluminada, derecha en sombra; nieve en la cima de las grandes.
      let c: string = i < 0 ? P.tan : i === 0 ? P.clay : (i + row) % 3 === 0 ? P.rust : P.clay;
      if (snow && k < h * 0.35) c = i <= 0 ? P.white : P.mist;
      b.set(x + i, row, c);
    }
    b.set(x - k, row, P.rust);
    b.set(x + k, row, P.umber);
  }
  b.hline(x - h + 1, y, 2 * h - 1, P.rust);
}

function hill(b: PixelBuffer, x: number, y: number, w: number): void {
  for (let i = -w; i <= w; i++) {
    const hgt = Math.round(Math.sqrt(Math.max(0, 1 - (i / w) ** 2)) * (w * 0.5));
    b.set(x + i, y - hgt, i < 0 ? P.rust : P.umber);
  }
}

function roundTree(b: PixelBuffer, x: number, y: number): void {
  b.rect(x - 1, y - 3, 3, 3, P.leaf);
  b.set(x, y - 4, P.leaf);
  b.set(x - 1, y - 3, P.lime);
  b.set(x + 1, y - 1, P.forest);
  b.set(x, y, P.bark);
}

function pine(b: PixelBuffer, x: number, y: number): void {
  b.set(x, y - 5, P.forest);
  b.hline(x - 1, y - 4, 3, P.forest);
  b.hline(x - 1, y - 3, 3, P.forest);
  b.set(x - 1, y - 3, P.leaf);
  b.hline(x - 2, y - 2, 5, P.forest);
  b.set(x - 2, y - 2, P.leaf);
  b.set(x, y - 1, P.bark);
}

function house(b: PixelBuffer, x: number, y: number, roof: string): void {
  b.rect(x - 1, y - 2, 4, 3, P.sand);
  b.set(x + 1, y, P.bark);
  b.hline(x - 2, y - 3, 6, roof);
  b.hline(x - 1, y - 4, 4, roof);
  b.set(x - 1, y - 2, P.rust);
  b.set(x + 2, y - 2, P.rust);
}

function deadTree(b: PixelBuffer, x: number, y: number): void {
  b.vline(x, y - 4, 5, P.bark);
  b.set(x - 1, y - 3, P.bark);
  b.set(x + 1, y - 2, P.bark);
  b.set(x - 2, y - 4, P.umber);
  b.set(x + 2, y - 3, P.umber);
}

/** Un dibujito de 7 × 7 como mucho, de abajo arriba, con su paleta. */
function icon(b: PixelBuffer, x: number, y: number, rows: string[], pal: Record<string, Color>) {
  const h = rows.length;
  rows.forEach((row, j) => {
    const w = row.length;
    for (let i = 0; i < w; i++) {
      const c = pal[row[i]!];
      if (c) b.set(x - (w >> 1) + i, y - h + 1 + j, c);
    }
  });
}

const STONE = { k: P.bark, s: P.fog, S: P.steel, d: P.black, w: P.mist };

/**
 * El icono de cada lugar, encima de su punto (el marcador de la interfaz queda al pie): la
 * torre, la ermita o el cementerio, la boca de la cueva o de la mina, el molino, el granero…
 */
function placeIcon(b: PixelBuffer, name: string, x: number, y: number, t: string): void {
  const at = y - 3;
  if (/torre/.test(name))
    icon(b, x, at, ['.s.s.', '.sSs.', '.sS..', '.sSs.', '.sdS.', 'kkkkk'], STONE);
  else if (/ermita|priorato|monasterio/.test(name))
    icon(b, x, at, ['...w...', '..www..', '.sssss.', 'kSSSSSk', '.sSdSs.', '.sSdSs.'], {
      ...STONE,
      k: P.rust,
      S: P.brick,
    });
  else if (/cementerio|catacumbas|cripta/.test(name))
    icon(b, x, at, ['.w...w.', 'www.www', '.s...s.', '.s.w.s.', '...s...', 'kkkkkkk'], STONE);
  else if (/mina/.test(name))
    icon(b, x, at, ['ooooooo', 'o.ddd.o', 'o.ddd.o', 'o.ddd.o', 'kkkkkkk'], { ...STONE, o: P.oak });
  else if (/cueva|desfiladero|paso|riscos|loma|Corona|refugio/.test(name))
    icon(b, x, at, ['..sss..', '.ssSSs.', 'ssdddSs', 'sdddddS', 'kkkkkkk'], STONE);
  else if (/molino/.test(name))
    icon(b, x, at, ['w.w.w', '.www.', 'wwSww', '.sSs.', '.sds.'], {
      ...STONE,
      w: P.sand,
      S: P.oak,
    });
  else if (/puente/.test(name))
    icon(b, x, at, ['kkkkk', 'k...k', 'k.r.k', 'k...k'], { k: P.bark, r: P.tan });
  else if (/granero/.test(name))
    icon(b, x, at, ['..rrr..', '.rRRRr.', 'rRRRRRr', '.RwdwR.', '.RRdRR.'], {
      r: P.wine,
      R: P.brick,
      w: P.sand,
      d: P.bark,
    });
  else if (/campamento/.test(name))
    icon(b, x, at, ['...w...', '..wsw..', '.wsdsw.', 'wssdssw'], {
      w: P.sand,
      s: P.tan,
      d: P.bark,
    });
  else if (/salinas/.test(name))
    icon(b, x, at, ['.w..w.', 'www.ww', 'kkkkkk'], { w: P.white, k: P.fog });
  else if (/casa|posada|mesón/.test(name))
    icon(b, x, at, ['..rr..', '.rrrr.', 'rrrrrr', '.sdss.', '.sdss.'], {
      r: P.brick,
      s: P.sand,
      d: P.bark,
    });
  else if (t === 'pantano')
    icon(b, x, at, ['.g.g.', '.g.gg', 'g.g.g', 'ddddd'], { g: P.leaf, d: P.deep });
}

/** Rosa de los vientos de ocho puntas con la N. */
function compass(b: PixelBuffer, cx: number, cy: number, r: number): void {
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4 - Math.PI / 2;
    const len = a % 2 === 0 ? r : r * 0.55;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    for (let k = 0; k <= len; k++) {
      const w = Math.max(0, Math.round((1 - k / len) * (a % 2 === 0 ? 2 : 1)));
      for (let s = -w; s <= w; s++) {
        const x = Math.round(cx + ux * k - uy * s);
        const y = Math.round(cy + uy * k + ux * s);
        b.set(x, y, s < 0 ? (a === 0 ? P.wine : P.rust) : a === 0 ? P.red : P.tan);
      }
    }
  }
  b.ellipse(cx, cy, 2.2, 2.2, P.gold);
  b.set(cx, cy, P.wine);
  // La N.
  const nx = cx - 2;
  const ny = cy - r - 8;
  b.vline(nx, ny, 5, P.bark);
  b.vline(nx + 4, ny, 5, P.bark);
  for (let i = 0; i < 5; i++) b.set(nx + Math.round((i * 4) / 4), ny + i, P.bark);
}

function ship(b: PixelBuffer, x: number, y: number): void {
  // Casco, mástil y vela.
  b.hline(x - 5, y, 11, P.bark);
  b.hline(x - 4, y + 1, 9, P.oak);
  b.hline(x - 3, y + 2, 7, P.bark);
  b.vline(x, y - 9, 9, P.bark);
  for (let k = 0; k < 7; k++) b.hline(x + 1, y - 8 + k, Math.min(k + 1, 5), P.sand);
  b.set(x + 1, y - 9, P.red);
  b.hline(x - 7, y + 3, 3, P.mist);
  b.hline(x + 6, y + 3, 3, P.mist);
}

function whale(b: PixelBuffer, x: number, y: number): void {
  b.hline(x - 4, y, 9, P.navy);
  b.hline(x - 3, y - 1, 6, P.navy);
  b.set(x - 2, y - 1, P.steel);
  b.set(x + 5, y - 1, P.navy);
  b.set(x + 6, y - 2, P.navy);
  b.set(x + 4, y - 2, P.navy);
  // Chorro.
  b.set(x - 1, y - 3, P.mist);
  b.set(x - 2, y - 4, P.mist);
  b.set(x, y - 4, P.mist);
}

export function mapBuffer(): PixelBuffer {
  if (cached) return cached;
  const b = new PixelBuffer(MAP_W, MAP_H);
  const rng = new Rng('mapa');
  const water = new Uint8Array(MAP_W * MAP_H);
  const wet = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && water[y * MAP_W + x] === 1;

  // Pergamino: manchas, fibras, puntos de óxido y bordes tostados.
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
      const stain =
        Math.sin(x * 0.05) * Math.cos(y * 0.07) +
        Math.sin((x + y) * 0.023) +
        Math.sin(x * 0.011 - y * 0.017) * 0.6;
      let c: string = P.sand;
      // Manchas de humedad: tramadas y suaves, que no parezcan regiones.
      if (stain > 1.7 && bayer(x, y) < Math.min(0.15, (stain - 1.7) * 0.5)) c = P.tan;
      if ((x * 7 + y * 13) % 97 === 0) c = P.tan;
      if (edge < 7 && bayer(x, y) < (7 - edge) / 7) c = edge < 3 ? P.clay : P.tan;
      b.set(x, y, c);
    }
  for (let i = 0; i < 40; i++) {
    const x = rng.int(8, MAP_W - 9);
    const y = rng.int(8, MAP_H - 9);
    if (rng.chance(0.4)) b.set(x, y, P.tan);
  }

  // Mar al poniente y al suroeste, con franja clara junto a la orilla.
  for (let y = 0; y < MAP_H; y++) {
    const cx = coastAt(y);
    for (let x = 0; x < MAP_W && x < cx + 1; x++) {
      if (x >= cx) continue;
      water[y * MAP_W + x] = 1;
      const d = cx - x;
      let c: string = d < 3 ? P.sky : P.ocean;
      if (d >= 3 && d < 5 && bayer(x, y) < 0.5) c = P.sky;
      if (d > 8 && (x * 3 + y * 5) % 23 === 0) c = P.sky;
      b.set(x, y, c);
    }
  }
  // Rumbos que salen de la rosa de los vientos (solo sobre el agua).
  const rose: Pt = [52, 250];
  for (let a = 0; a < 16; a++) {
    const ang = (a * Math.PI) / 8;
    for (let k = 20; k < 150; k += 3) {
      const x = Math.round(rose[0] + Math.cos(ang) * k);
      const y = Math.round(rose[1] + Math.sin(ang) * k);
      if (wet(x, y) && wet(x + 1, y) && b.inside(x, y)) b.set(x, y, P.sky);
    }
  }
  // Líneas de sondeo paralelas a la costa y la orilla perfilada.
  for (let y = 0; y < MAP_H; y++) {
    const cx = Math.floor(coastAt(y));
    for (const off of [5, 9])
      if ((y + off) % 2 === 0 && wet(cx - off, y)) b.set(cx - off, y, P.sky);
    if (b.inside(cx, y)) b.set(cx, y, P.rust);
    if (b.inside(cx + 1, y) && bayer(cx + 1, y) < 0.6) b.set(cx + 1, y, P.gold);
  }
  // Islas.
  for (const [x, y, r] of [
    [22, 128, 4],
    [70, 262, 5],
    [36, 58, 3],
  ] as const) {
    b.ellipse(x, y, r + 1, r * 0.7 + 1, P.rust);
    b.ellipse(x, y, r, r * 0.7, P.sand);
    b.set(x - 1, y - 1, P.gold);
    roundTree(b, x, y + 1);
  }
  ship(b, 38, 198);
  whale(b, 20, 108);

  // Sierras: la Parda al norte, la de la Niebla al noroeste y lomas al este.
  const peaks: [number, number, number][] = [];
  for (let x = 110; x < 392; x += rng.int(9, 15)) peaks.push([x, rng.int(22, 44), rng.int(7, 12)]);
  for (let x = 116; x < 392; x += rng.int(12, 20))
    peaks.push([x + rng.int(-4, 4), rng.int(50, 72), rng.int(5, 8)]);
  for (let i = 0; i < 9; i++) peaks.push([rng.int(64, 110), rng.int(24, 64), rng.int(6, 10)]);
  for (let i = 0; i < 8; i++) peaks.push([rng.int(352, 390), rng.int(80, 200), rng.int(4, 7)]);
  peaks.sort((a, c) => a[1] - c[1]);
  // Las faldas: una mancha tramada bajo cada pico que une la sierra (relieve).
  for (const [x, y, h] of peaks)
    b.ellipse(x + 1, y + 1, h * 1.5, h * 0.55, (px, py) => {
      const lit = px < x;
      if (wet(px, py) || py < y - 1 || bayer(px, py) >= (lit ? 0.12 : 0.3)) return b.get(px, py);
      return lit ? P.tan : P.clay;
    });
  for (const [x, y, h] of peaks) mountain(b, x, y, h, h >= 9);
  // Lomas sueltas por la comarca.
  for (let i = 0; i < 22; i++) {
    const x = rng.int(140, 360);
    const y = rng.int(96, 250);
    if (Math.hypot(x - TAVERN.x, y - TAVERN.y) > 14) hill(b, x, y, rng.int(3, 5));
  }

  // Bosques: Sotomuro (frondoso), el del este y pinares al pie de la sierra.
  const grove = (
    cx: number,
    cy: number,
    r: number,
    n: number,
    kind: 'round' | 'pine' | 'mix' | 'burnt',
  ) => {
    const trees: [number, number, boolean][] = [];
    for (let i = 0; i < n; i++) {
      const a = rng.next() * Math.PI * 2;
      const d = Math.sqrt(rng.next()) * r;
      const x = Math.round(cx + Math.cos(a) * d * 1.3);
      const y = Math.round(cy + Math.sin(a) * d);
      if (wet(x, y)) continue;
      trees.push([x, y, kind === 'pine' || (kind === 'mix' && rng.chance(0.4))]);
    }
    // El suelo del bosque: una mancha que los une, con el borde más oscuro.
    const floor = new Set<number>();
    for (const [x, y] of trees)
      for (let dy = -4; dy <= 1; dy++)
        for (let dx = -3; dx <= 3; dx++)
          if (Math.abs(dx) + Math.abs(dy + 1) < 5 && !wet(x + dx, y + dy))
            floor.add((y + dy) * MAP_W + x + dx);
    const burnt = kind === 'burnt';
    for (const k of floor) {
      const x = k % MAP_W;
      const y = Math.floor(k / MAP_W);
      const edge = [1, -1, MAP_W, -MAP_W].some((o) => !floor.has(k + o));
      if (!b.inside(x, y)) continue;
      if (edge) b.set(x, y, burnt ? P.umber : P.forest);
      else if (bayer(x, y) < 0.5) b.set(x, y, burnt ? P.mocha : P.leaf);
    }
    trees.sort((a, c) => a[1] - c[1]);
    for (const [x, y, p] of trees)
      if (burnt) deadTree(b, x, y);
      else if (p) pine(b, x, y);
      else roundTree(b, x, y);
  };
  grove(124, 122, 22, 90, 'round');
  grove(338, 156, 28, 110, 'mix');
  grove(286, 70, 18, 40, 'pine');
  grove(140, 74, 12, 22, 'pine');
  grove(300, 236, 12, 20, 'round');
  grove(80, 80, 9, 14, 'burnt');

  // Marismas y el pantano de las ranas: charcos y juncos.
  for (let i = 0; i < 80; i++) {
    const x = rng.int(104, 176);
    const y = rng.int(196, 248);
    if (x < coastAt(y) + 2) continue;
    b.hline(x, y, rng.int(2, 4), rng.chance(0.3) ? P.ocean : P.sky);
    if (i % 2) {
      b.vline(x + 4, y - 3, 3, P.forest);
      b.set(x + 4, y - 4, P.oak);
    }
  }

  // Campos de labor: parcelas en franjas junto a Valdeloro, el granero y los llanos.
  const fields = (x0: number, y0: number, cols: number, rows: number) => {
    const tones = [P.gold, P.lime, P.tan, P.lemon] as const;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const tone = tones[(r * 3 + c * 2 + rng.int(0, 1)) % tones.length]!;
        const px = x0 + c * 9 + r * 2;
        const py = y0 + r * 7;
        for (let y = 0; y < 6; y++)
          for (let x = 0; x < 8; x++)
            if ((y + (c % 2 ? x : 0)) % 2 === 0) b.set(px + x, py + y, tone);
      }
  };
  fields(240, 172, 4, 3);
  fields(214, 206, 4, 3);
  fields(258, 236, 6, 3);

  // Ríos (el grande se ensancha hacia el mar) y lagos; luego, la orilla perfilada.
  const wetDisk = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (dx * dx + dy * dy <= r * r + r && b.inside(x + dx, y + dy)) {
          water[(y + dy) * MAP_W + x + dx] = 1;
          b.set(x + dx, y + dy, P.sky);
        }
  };
  walk(RIVER, 1.2, (x, y) => wetDisk(x, y, y > 150 ? 2 : 1));
  walk(BROOK, 1, (x, y) => {
    b.set(x, y, P.sky);
    water[y * MAP_W + x] = 1;
  });
  const lake = (cx: number, cy: number, rx: number, ry: number, c: string) =>
    b.ellipse(cx, cy, rx, ry, (x, y) => {
      water[y * MAP_W + x] = 1;
      return c;
    });
  lake(358, 40, 11, 5, P.mist);
  lake(128, 248, 9, 5, P.ocean);
  lake(148, 259, 7, 4, P.sky);
  // La orilla: donde el agua toca tierra, más oscura; brillos sueltos en el agua.
  for (let y = 1; y < MAP_H - 1; y++)
    for (let x = Math.ceil(coastAt(y)) + 2; x < MAP_W - 1; x++) {
      if (!wet(x, y)) continue;
      const shore = !wet(x - 1, y) || !wet(x + 1, y) || !wet(x, y - 1) || !wet(x, y + 1);
      if (shore) b.set(x, y, P.ocean);
      else if ((x * 5 + y * 3) % 13 === 0) b.set(x, y, P.mist);
    }
  // El lago Helado, con el hielo agrietado.
  b.ellipse(358, 40, 9, 3.5, P.mist);
  b.hline(352, 39, 4, P.white);
  b.hline(359, 41, 5, P.fog);

  // Caminos reales: tierra a doble trazo y puentes donde cruzan el agua.
  const roadAt: Pt[] = [];
  for (const road of ROADS)
    walk(road, 0.8, (x, y, i) => {
      if (!b.inside(x, y)) return;
      if (wet(x, y)) {
        b.set(x, y, P.bark);
        b.set(x, y - 1, P.oak);
        b.set(x, y + 1, P.oak);
        return;
      }
      b.set(x, y, P.oak);
      if (!wet(x, y + 1)) b.set(x, y + 1, i % 3 ? P.cocoa : P.oak);
      roadAt.push([x, y]);
    });
  // Senderos: de cada lugar al camino real más cercano, a trazos.
  for (const p of Object.values(PLACE_INFO)) {
    let best: Pt = [TAVERN.x, TAVERN.y];
    let d = Math.hypot(p.x - best[0], p.y - best[1]);
    for (const q of roadAt) {
      const e = Math.hypot(p.x - q[0], p.y - q[1]);
      if (e < d) [best, d] = [q, e];
    }
    if (d < 6) continue;
    walk([best, [p.x, p.y]], 0.6, (x, y, i) => {
      if (i % 3 !== 2 && b.inside(x, y) && !wet(x, y)) b.set(x, y, P.cocoa);
    });
  }

  // Aldeas: casitas con tejado rojo o pizarra según el lugar.
  const village = (cx: number, cy: number, n: number, roof: string) => {
    for (let i = 0; i < n; i++)
      house(b, cx + ((i * 7) % 15) - 7, cy + Math.floor(i / 2) * 5 - 4, roof);
  };
  for (const p of Object.values(PLACE_INFO))
    if (p.terrain === 'pueblo') village(p.x + 6, p.y + 2, 4, P.brick);
  village(TAVERN.x - 10, TAVERN.y + 8, 2, P.brick);
  village(326, 124, 3, P.slate);
  village(186, 262, 3, P.brick);

  for (const [name, p] of Object.entries(PLACE_INFO)) placeIcon(b, name, p.x, p.y, p.terrain);

  compass(b, rose[0], rose[1], 14);

  // Escala en leguas, abajo a la derecha.
  for (let i = 0; i < 4; i++) b.rect(330 + i * 12, 262, 12, 3, i % 2 ? P.sand : P.bark);
  b.hline(330, 261, 48, P.bark);
  b.hline(330, 265, 48, P.bark);

  // Doble marco con esquinas.
  for (let x = 3; x < MAP_W - 3; x++) {
    b.set(x, 3, P.bark);
    b.set(x, MAP_H - 4, P.bark);
    if (x > 5 && x < MAP_W - 6) {
      b.set(x, 6, P.rust);
      b.set(x, MAP_H - 7, P.rust);
    }
  }
  for (let y = 3; y < MAP_H - 3; y++) {
    b.set(3, y, P.bark);
    b.set(MAP_W - 4, y, P.bark);
    if (y > 5 && y < MAP_H - 6) {
      b.set(6, y, P.rust);
      b.set(MAP_W - 7, y, P.rust);
    }
  }
  for (const [x, y] of [
    [4, 4],
    [MAP_W - 5, 4],
    [4, MAP_H - 5],
    [MAP_W - 5, MAP_H - 5],
  ] as const) {
    b.rect(x - 2, y - 2, 5, 5, P.bark);
    b.rect(x - 1, y - 1, 3, 3, P.gold);
    b.set(x, y, P.wine);
  }

  cached = b;
  return b;
}

/**
 * Niebla sobre lo que no se conoce: trama oscura de pergamino lejos de los puntos
 * conocidos. `known` son centros con su radio.
 */
export function fogBuffer(known: readonly { x: number; y: number; r: number }[]): PixelBuffer {
  const b = new PixelBuffer(MAP_W, MAP_H);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      let best = Infinity;
      for (const k of known) best = Math.min(best, Math.hypot(x - k.x, y - k.y) - k.r);
      if (best <= 0) continue;
      // Velo de pergamino: deja adivinar lo que hay debajo, como tierra sin cartografiar.
      const f = Math.min(1, best / 18) * 0.8;
      if (bayer(x, y) < f) b.set(x, y, (x * 3 + y) % 11 === 0 ? P.clay : P.tan);
    }
  return b;
}
