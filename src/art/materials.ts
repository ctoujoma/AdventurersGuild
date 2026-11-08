import type { Material } from '../core/materials';
import type { Slot } from '../core/gear';
import { P, darker } from './palette';
import { PixelBuffer, toHex } from './pixel';

/**
 * Los materiales (hierro, cuero, tela, hierbas, madera buena y cristal) y las siluetas de las
 * ranuras del equipo, en pixel art para la interfaz. Cada material se distingue por su forma (un
 * lingote, un rollo atado, un fardo, un manojo, unos listones y una piedra que brilla), no solo
 * por el color. A 16 × 16 y a 32 × 32 (el de 32 con más detalle, no ampliado).
 *
 * Se dibujan en un espacio de 16 (`u`: lo que mide una unidad) y se contornean como los iconos de
 * los objetos.
 */

export type MatSize = 16 | 32;

const cache = new Map<string, PixelBuffer>();

function make(key: string, size: number, draw: (b: PixelBuffer, u: number) => void, line = 2) {
  const hit = cache.get(key);
  if (hit) return hit;
  // Se dibuja dentro y el contorno añade un píxel por cada lado.
  const inner = new PixelBuffer(size - 2, size - 2);
  draw(inner, (size - 2) / 14);
  const out = inner.outlined((n) => darker(toHex(n), line));
  cache.set(key, out);
  return out;
}

type Pt = [number, number];

/** Rellena un polígono convexo (puntos en unidades de 14) a escala `u`. */
function poly(
  b: PixelBuffer,
  u: number,
  pts: Pt[],
  color: string | ((x: number, y: number) => string),
) {
  const ps = pts.map(([x, y]) => [x * u, y * u] as Pt);
  const y0 = Math.floor(Math.min(...ps.map((p) => p[1])));
  const y1 = Math.ceil(Math.max(...ps.map((p) => p[1])));
  for (let y = y0; y < y1; y++) {
    const cy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < ps.length; i++) {
      const [ax, ay] = ps[i]!;
      const [bx, by] = ps[(i + 1) % ps.length]!;
      if ((ay <= cy && by > cy) || (by <= cy && ay > cy))
        xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
    }
    if (xs.length < 2) continue;
    const xa = Math.round(Math.min(...xs));
    const xb = Math.round(Math.max(...xs));
    for (let x = xa; x < xb; x++) b.set(x, y, typeof color === 'string' ? color : color(x, y));
  }
}

/** Una línea en unidades. */
const ln = (b: PixelBuffer, u: number, x0: number, y0: number, x1: number, y1: number, c: string) =>
  b.line(Math.round(x0 * u), Math.round(y0 * u), Math.round(x1 * u), Math.round(y1 * u), c);

/** Una elipse en unidades. */
const el = (b: PixelBuffer, u: number, cx: number, cy: number, rx: number, ry: number, c: string) =>
  b.ellipse(cx * u - 0.5, cy * u - 0.5, rx * u, ry * u, c);

// ---------- Materiales ----------

/** Hierro: un lingote en forma de tronco de pirámide, la cara de arriba clara y el sello. */
function iron(b: PixelBuffer, u: number) {
  // Cara de delante (inclinada), de arriba (clara) y el costado (en sombra).
  poly(
    b,
    u,
    [
      [1, 11.5],
      [13, 11.5],
      [11.5, 6.5],
      [2.5, 6.5],
    ],
    P.fog,
  );
  poly(
    b,
    u,
    [
      [2.5, 6.5],
      [11.5, 6.5],
      [10, 3.5],
      [4, 3.5],
    ],
    P.mist,
  );
  poly(
    b,
    u,
    [
      [11.5, 6.5],
      [13, 11.5],
      [13.6, 10.5],
      [12.2, 6],
    ],
    P.slate,
  );
  ln(b, u, 2.5, 6.5, 11.5, 6.5, P.white);
  ln(b, u, 1, 11.4, 13, 11.4, P.steel);
  if (u > 1.5) {
    // El sello de la herrería en la cara de arriba y unos golpes de luz.
    el(b, u, 7, 5, 1.1, 0.6, P.steel);
    ln(b, u, 3.2, 7.6, 3.2, 10.5, P.mist);
    ln(b, u, 4, 4, 9.4, 4, P.white);
  } else {
    b.set(Math.round(7 * u), Math.round(5 * u), P.steel);
  }
}

/** Cuero: un rollo de piel tumbado, atado con dos cuerdas, con la espiral en la punta. */
function leather(b: PixelBuffer, u: number) {
  // El cuerpo del rollo y su luz de arriba.
  poly(
    b,
    u,
    [
      [3.5, 3.5],
      [12.5, 3.5],
      [12.5, 10.5],
      [3.5, 10.5],
    ],
    P.clay,
  );
  poly(
    b,
    u,
    [
      [3.5, 3.5],
      [12.5, 3.5],
      [12.5, 5.5],
      [3.5, 5.5],
    ],
    P.tan,
  );
  ln(b, u, 3.5, 10.3, 12.5, 10.3, P.rust);
  // La punta: un disco con la espiral.
  el(b, u, 3.5, 7, 2.6, 3.6, P.tan);
  el(b, u, 3.5, 7, 1.7, 2.5, P.clay);
  el(b, u, 3.6, 7, 0.8, 1.3, P.rust);
  // Las dos cuerdas.
  for (const x of [7, 10.5]) {
    ln(b, u, x, 3.2, x, 10.8, P.bark);
    if (u > 1.5) ln(b, u, x + 0.5, 3.2, x + 0.5, 10.8, P.oak);
  }
  if (u > 1.5) {
    // El nudo de la cuerda y un cabo suelto.
    el(b, u, 7.2, 10.8, 0.7, 0.5, P.bark);
    ln(b, u, 7.2, 11, 6.2, 12.6, P.bark);
    ln(b, u, 4.5, 4.5, 11.8, 4.5, P.sand);
  }
}

/** Tela: un fardo de piezas dobladas, una sobre otra, atado con una cinta en cruz. */
function cloth(b: PixelBuffer, u: number) {
  const layers: [number, string, string][] = [
    [9, P.ocean, P.sky],
    [6, P.wine, P.red],
    [3, P.forest, P.leaf],
  ];
  for (const [y, d, l] of layers) {
    poly(
      b,
      u,
      [
        [1.5, y],
        [12.5, y],
        [12.5, y + 3],
        [1.5, y + 3],
      ],
      l,
    );
    ln(b, u, 1.5, y + 2.6, 12.5, y + 2.6, d);
    // El doblez redondeado del lado.
    el(b, u, 12.5, y + 1.5, 0.9, 1.4, d);
  }
  // La cinta en cruz, clara.
  ln(b, u, 7, 2.8, 7, 12, P.sand);
  if (u > 1.5) {
    ln(b, u, 7.5, 2.8, 7.5, 12, P.tan);
    el(b, u, 7.2, 2.6, 1.2, 0.7, P.sand);
    // Una franja bordada en la de en medio.
    for (let x = 2; x < 12; x += 1.5) b.set(Math.round(x * u), Math.round(7.4 * u), P.gold);
  }
}

/** Hierbas: un manojo de tallos atados abajo, abiertos en abanico, con hojitas y flores. */
function herbs(b: PixelBuffer, u: number) {
  const base: Pt = [7, 13];
  const tips: Pt[] = [
    [2, 3.5],
    [4.5, 1.5],
    [7, 1],
    [9.5, 1.5],
    [12, 3.5],
  ];
  // Los tallos (a 32, de dos píxeles).
  for (const [x, y] of tips) {
    ln(b, u, base[0], base[1], x, y, P.forest);
    if (u > 1.5) ln(b, u, base[0] + 0.4, base[1], x + 0.4, y, P.forest);
  }
  // Las hojas, a lo largo de cada tallo y a un lado y al otro.
  tips.forEach(([x, y], k) => {
    for (const t of [0.5, 0.72, 0.94]) {
      const px = base[0] + (x - base[0]) * t;
      const py = base[1] + (y - base[1]) * t;
      const side = (k + Math.round(t * 10)) % 2 ? 1 : -1;
      el(b, u, px + side * 0.9, py + 0.2, 0.95, 0.55, P.leaf);
      if (u > 1.5) el(b, u, px + side * 0.9 - 0.2, py, 0.4, 0.25, P.lime);
    }
  });
  // Unas flores en las puntas.
  for (const [x, y] of [tips[1]!, tips[3]!])
    if (u > 1.5) el(b, u, x, y, 0.6, 0.6, P.rose);
    else b.set(Math.round(x * u), Math.round(y * u), P.rose);
  // La atadura de cordel y el pie de los tallos.
  poly(
    b,
    u,
    [
      [5.8, 9.6],
      [8.4, 9.6],
      [8.4, 11],
      [5.8, 11],
    ],
    P.tan,
  );
  if (u > 1.5) {
    ln(b, u, 5.8, 10.9, 8.4, 10.9, P.clay);
    b.set(Math.round(12 * u), Math.round(3.5 * u), P.coral);
  }
}

/** Madera buena: tres listones cepillados apilados en diagonal, con la veta y las testas. */
function wood(b: PixelBuffer, u: number) {
  const planks: [number, string, string][] = [
    [8.5, P.oak, P.tan],
    [5.5, P.clay, P.sand],
    [2.5, P.oak, P.tan],
  ];
  for (const [y, base, light] of planks) {
    poly(
      b,
      u,
      [
        [1, y + 3],
        [3, y + 1],
        [13, y + 1],
        [11, y + 3],
      ],
      base,
    );
    ln(b, u, 3, y + 1, 13, y + 1, light);
    // La testa, más oscura, con los anillos.
    poly(
      b,
      u,
      [
        [11, y + 3],
        [13, y + 1],
        [13.4, y + 2],
        [11.4, y + 4],
      ],
      P.bark,
    );
    if (u > 1.5) {
      // La veta.
      ln(b, u, 3.5, y + 2, 9, y + 2, P.umber);
      ln(b, u, 6, y + 2.4, 10.5, y + 2.4, P.umber);
    }
  }
}

/** Cristal: una piedra de facetas que brilla, con unas puntas más pequeñas y el destello. */
function crystal(b: PixelBuffer, u: number) {
  // La punta grande: facetas de luz y de sombra.
  poly(
    b,
    u,
    [
      [7, 1],
      [10, 5],
      [8.5, 12.5],
      [5.5, 12.5],
      [4, 5],
    ],
    P.sky,
  );
  poly(
    b,
    u,
    [
      [7, 1],
      [7, 12.5],
      [5.5, 12.5],
      [4, 5],
    ],
    P.cyan,
  );
  poly(
    b,
    u,
    [
      [7, 1],
      [10, 5],
      [7, 5.5],
    ],
    P.white,
  );
  // Dos más pequeñas a los lados.
  poly(
    b,
    u,
    [
      [2.5, 7],
      [4.5, 9],
      [4, 12.5],
      [2, 12.5],
      [1.5, 9],
    ],
    P.ocean,
  );
  poly(
    b,
    u,
    [
      [11.5, 6.5],
      [13, 9],
      [12.5, 12.5],
      [10, 12.5],
      [10, 9],
    ],
    P.ocean,
  );
  ln(b, u, 2.5, 7.4, 2.5, 12, P.sky);
  ln(b, u, 11.5, 7, 11.5, 12, P.sky);
  // La base de roca.
  poly(
    b,
    u,
    [
      [1, 12.5],
      [13, 12.5],
      [12, 13.8],
      [2, 13.8],
    ],
    P.steel,
  );
  // El destello.
  const sx = Math.round(10.5 * u);
  const sy = Math.round(2.2 * u);
  b.set(sx, sy, P.white);
  if (u > 1.5) {
    b.hline(sx - 2, sy, 5, P.white);
    b.vline(sx, sy - 2, 5, P.white);
    ln(b, u, 6, 3, 5.2, 9, P.white);
  }
}

const DRAW: Record<Material, (b: PixelBuffer, u: number) => void> = {
  hierro: iron,
  cuero: leather,
  tela: cloth,
  hierbas: herbs,
  madera: wood,
  cristal: crystal,
};

/** El dibujo de un material, a 16 o a 32 de lado. */
export const materialIcon = (m: Material, size: MatSize = 16): PixelBuffer =>
  make(`m:${m}:${size}`, size, DRAW[m]);

// ---------- Ranuras ----------

/** Color de las siluetas: apagadas, como un hueco vacío en el muñeco. */
const DIM = P.slate;
const DIM_LIGHT = P.steel;

/** Arma: una espada en diagonal, con su guarda. */
function slotWeapon(b: PixelBuffer, u: number) {
  poly(
    b,
    u,
    [
      [11.5, 1],
      [13, 1],
      [13, 2.5],
      [5, 10.5],
      [3.5, 9],
    ],
    DIM_LIGHT,
  );
  ln(b, u, 12.3, 1.7, 4.2, 9.8, DIM);
  // La guarda, el puño y el pomo.
  poly(
    b,
    u,
    [
      [2, 8.5],
      [3, 7.5],
      [6.5, 11],
      [5.5, 12],
    ],
    DIM_LIGHT,
  );
  poly(
    b,
    u,
    [
      [3, 10.5],
      [4, 11.5],
      [2, 13.5],
      [1, 12.5],
    ],
    DIM,
  );
  el(b, u, 1.2, 13, 0.9, 0.9, DIM_LIGHT);
}

/** Cuerpo: un jubón o una coraza, con los hombros y el cuello. */
function slotBody(b: PixelBuffer, u: number) {
  poly(
    b,
    u,
    [
      [2, 3],
      [5, 1.5],
      [9, 1.5],
      [12, 3],
      [12.5, 7],
      [10.5, 7],
      [10.5, 13],
      [3.5, 13],
      [3.5, 7],
      [1.5, 7],
    ],
    DIM_LIGHT,
  );
  // El cuello y la línea del medio.
  poly(
    b,
    u,
    [
      [5.5, 1.5],
      [8.5, 1.5],
      [7, 4],
    ],
    DIM,
  );
  ln(b, u, 7, 4, 7, 12.6, DIM);
  ln(b, u, 3.6, 9, 10.4, 9, DIM);
}

/** Complemento: un amuleto colgado de su cadena (vale por botas, capas, anillos…). */
function slotTrinket(b: PixelBuffer, u: number) {
  // La cadena, en uve.
  ln(b, u, 2, 1.5, 6.4, 7.2, DIM_LIGHT);
  ln(b, u, 12, 1.5, 7.6, 7.2, DIM_LIGHT);
  // La joya: un rombo con su engaste.
  poly(
    b,
    u,
    [
      [7, 6.5],
      [10.5, 9.8],
      [7, 13.5],
      [3.5, 9.8],
    ],
    DIM_LIGHT,
  );
  poly(
    b,
    u,
    [
      [7, 8],
      [9, 9.8],
      [7, 12],
      [5, 9.8],
    ],
    DIM,
  );
}

const SLOT_DRAW: Record<Slot, (b: PixelBuffer, u: number) => void> = {
  arma: slotWeapon,
  cuerpo: slotBody,
  complemento: slotTrinket,
};

/** La silueta apagada de una ranura vacía, a 16 o a 32 de lado. */
export const slotIcon = (s: Slot, size: MatSize = 16): PixelBuffer =>
  make(`s:${s}:${size}`, size, SLOT_DRAW[s], 1);
