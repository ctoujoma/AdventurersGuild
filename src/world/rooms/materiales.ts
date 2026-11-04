/**
 * Más paredes de fuera (ver `muros.ts`), cada una de frente y en corte:
 *
 * - **Troncos**: de frente, troncos tumbados con su veta, nudos, grietas, empalmes y el
 *   relleno de barro y musgo entre uno y otro; en corte, la pila de rodajas con sus anillos.
 * - **Ladrillo**: hiladas a soga con una de tizones cada tanto, ladrillos de tono desigual,
 *   alguno quemado o mellado; en corte, el muro de dos ladrillos trabado.
 * - **Tapial**: tierra apisonada en tongadas, con las juntas de los cajones al tresbolillo, los
 *   mechinales de las agujas y alguna piedra; en corte, las tongadas y las agujas que lo cruzan.
 * - **Lajas de pizarra**: lajas finas apiladas en seco, de largo desigual, con musgo abajo; en
 *   corte, lajas a todo lo hondo trabadas de un lado y del otro.
 * - **Encalado**: cal vieja (crema, no blanca) a brochazos, con calvas por donde asoma la piedra
 *   y la humedad que sube; en corte, el mampuesto con su piel de cal.
 *
 * En corte, todo un tono por debajo de la cara (ahí no da el sol).
 */
import { Rng } from '../../core/rng';
import { P } from '../../art/palette';
import type { PixelBuffer } from '../../art/pixel';

/** Ruido fijo por píxel (0–1). */
const hash = (x: number, y: number, s = 0) => {
  let h = Math.imul(x * 374761393 + y * 668265263 + s * 2147483, 1274126177);
  h ^= h >>> 15;
  return ((Math.imul(h, 2246822519) >>> 0) % 1000) / 1000;
};

type Col = (i: number) => number;

/** Ruido suave (0–1): el de `hash` en una rejilla de `cell`, mezclado entre esquinas. */
function smooth(x: number, y: number, cell: number, s: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(gx, gy, s) + (hash(gx + 1, gy, s) - hash(gx, gy, s)) * u;
  const c = hash(gx, gy + 1, s) + (hash(gx + 1, gy + 1, s) - hash(gx, gy + 1, s)) * u;
  return a + (c - a) * v;
}

/**
 * Si la pared llega al suelo (los costados, de varias plantas) y no es un hastial, que acaba en
 * el forjado: solo ahí la lluvia, la humedad y el musgo de abajo.
 */
const grounded = (h: number) => h > 90;

// ---------- Troncos ----------

/** Rampas de los troncos (luz, cuerpo, sombra, panza), de más claro a más curtido. */
const LOGS: readonly (readonly [string, string, string, string])[] = [
  [P.oak, P.rust, P.bark, P.plum],
  [P.cocoa, P.mocha, P.umber, P.plum],
  [P.clay, P.oak, P.rust, P.bark],
];

export function logsFace(b: PixelBuffer, x: number, y: number, w: number, h: number, seed: string) {
  const rng = new Rng(`troncos-${seed}`);
  for (let ly = y; ly < y + h;) {
    const d = 7 + rng.int(0, 2);
    // El tronco, por trozos: alguno empalma con otro a lo largo de la pared.
    for (let lx = x; lx < x + w;) {
      const len = Math.min(40 + rng.int(0, 60), x + w - lx);
      const [lt, mid, dk, belly] =
        LOGS[
          rng.weighted([
            [0, 5],
            [1, 2],
            [2, 1.2],
          ] as const)
        ]!;
      for (let j = 0; j < d; j++) {
        const u = j / (d - 1);
        // Cilindro: luz arriba, sombra abajo.
        b.hline(lx, ly + j, len, u < 0.18 ? lt : u < 0.55 ? mid : u < 0.82 ? dk : belly);
      }
      // Veta a lo largo, nudos y alguna grieta de secado.
      for (let k = 0; k < Math.ceil(len / 8); k++) {
        const gx = lx + rng.int(0, Math.max(0, len - 6));
        const gy = ly + 2 + rng.int(0, d - 4);
        b.hline(gx, gy, Math.min(3 + rng.int(0, 8), lx + len - gx), rng.chance(0.5) ? dk : lt);
      }
      if (rng.chance(0.6) && len > 8) {
        const kx = lx + rng.int(3, len - 4);
        const ky = ly + Math.floor(d / 2);
        b.set(kx, ky, P.black);
        b.set(kx + 1, ky, belly);
        b.set(kx, ky - 1, lt);
      }
      if (rng.chance(0.3) && len > 16) {
        const cx = lx + rng.int(4, len - 12);
        b.hline(cx, ly + 3, 6 + rng.int(0, 6), P.black);
      }
      // El empalme: la testa redondeada de los dos troncos.
      if (lx + len < x + w) {
        b.vline(lx + len - 1, ly + 1, d - 2, P.black);
        b.set(lx + len - 2, ly + 1, dk);
        b.set(lx + len - 2, ly + d - 2, dk);
        b.vline(lx + len, ly + 1, d - 2, lt);
      }
      lx += len;
    }
    // El relleno entre tronco y tronco: barro con musgo.
    for (let xx = x; xx < x + w; xx++) {
      const n = hash(xx, ly, 3);
      b.set(xx, ly + d, n < 0.22 ? P.forest : n < 0.3 ? P.leaf : n < 0.7 ? P.black : P.ebony);
    }
    ly += d + 1;
  }
}

export function logsSection(b: PixelBuffer, x: number, y: number, w: number, h: number) {
  b.rect(x, y, w, h, P.black);
  for (let ly = y, k = 0; ly < y + h; k++) {
    const d = 7 + (k % 3 === 1 ? 2 : k % 3 === 2 ? 1 : 0);
    const cx = x + w / 2 - 0.5;
    const cy = ly + d / 2 - 0.5;
    for (let yy = ly; yy < Math.min(y + h, ly + d); yy++)
      for (let xx = x; xx < x + w; xx++) {
        const dx = (xx - cx) / (w / 2);
        const dy = (yy - cy) / (d / 2);
        const q = Math.sqrt(dx * dx + dy * dy);
        if (q > 1) continue;
        // Corteza, albura y anillos (en sombra: un tono por debajo de la madera al sol).
        b.set(
          xx,
          yy,
          q > 0.84 ? P.bark : q > 0.7 ? P.clay : Math.floor(q * 6) % 2 ? P.oak : P.clay,
        );
      }
    b.set(Math.round(cx), Math.round(cy), P.rust);
    // La raja de secado, de la médula hacia fuera.
    b.set(Math.round(cx) + 1, Math.round(cy) - 1, P.rust);
    b.set(Math.round(cx) + 2 + (k % 2), Math.round(cy) - 1, P.rust);
    // Musgo en la junta.
    if (k % 2) b.set(x + 1 + (k % 5), ly + d, P.forest);
    ly += d + 1;
  }
}

// ---------- Ladrillo ----------

const BRICK: readonly (readonly [string, string, string])[] = [
  [P.wine, P.brick, P.amber],
  [P.wine, P.brick, P.clay],
  [P.plum, P.wine, P.brick],
  [P.rust, P.clay, P.tan],
  [P.black, P.plum, P.wine],
];

export function brickFace(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
) {
  const rng = new Rng(`ladrillo-${seed}`);
  b.rect(x, y, w, h, P.skinS);
  for (let row = 0, by = y; by < y + h; row++, by += 5) {
    // Cada seis hiladas, una de tizones (ladrillos de testa, más cortos).
    const header = row % 6 === 5;
    const bw = header ? 6 : 12;
    const off = header ? (row % 12 === 5 ? -3 : 0) : row % 2 ? -6 : 0;
    for (let bx = x + off; bx < x + w; bx += bw) {
      const [dk, mid, lt] =
        BRICK[
          rng.weighted([
            [0, 4],
            [1, 3],
            [2, 1.5],
            [3, 0.6],
            [4, 0.3],
          ] as const)
        ]!;
      const x0 = Math.max(x, bx + 1);
      const x1 = Math.min(x + w, bx + bw);
      const yh = Math.min(4, y + h - by - 1);
      if (x1 <= x0 || yh <= 0) continue;
      b.rect(x0, by + 1, x1 - x0, yh, mid);
      b.hline(x0, by + 1, x1 - x0, lt);
      if (yh === 4) b.hline(x0 + 1, by + 4, x1 - x0 - 1, dk);
      for (let xx = x0; xx < x1; xx++)
        for (let yy = by + 2; yy < by + Math.min(4, yh + 1); yy++)
          if (hash(xx, yy, 1) < 0.12) b.set(xx, yy, dk);
      // Alguno mellado en una esquina.
      if (rng.chance(0.15)) b.set(rng.chance(0.5) ? x0 : x1 - 1, by + 1, P.skinS);
    }
  }
}

export function brickSection(b: PixelBuffer, x: number, y: number, w: number, h: number) {
  b.rect(x, y, w, h, P.rust);
  // Muro de dos ladrillos: una hilada a soga (de cara a cara) y otra a tizón (dos testas).
  for (let row = 0, by = y; by < y + h; row++, by += 5) {
    const half = Math.floor(w / 2);
    const parts: [number, number][] =
      row % 2
        ? [[0, w]]
        : [
            [0, half],
            [half, w - half],
          ];
    const yh = Math.min(4, y + h - by - 1);
    if (yh <= 0) continue;
    for (const [a, bw] of parts) {
      b.rect(x + a + 1, by + 1, bw - 1, yh, P.wine);
      b.hline(x + a + 1, by + 1, bw - 1, P.brick);
      if (yh === 4) b.hline(x + a + 1, by + 4, bw - 1, P.plum);
    }
  }
}

// ---------- Tapial ----------

/** Las tierras del tapial, de la más corriente a la más rara (un tono por debajo del barro claro). */
const EARTH: readonly (readonly [string, number])[] = [
  [P.oak, 4],
  [P.clay, 3],
  [P.cocoa, 2],
  [P.rust, 1.5],
  [P.tan, 0.6],
];

export function rammedFace(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
) {
  const rng = new Rng(`tapial-${seed}`);
  const pick = () => rng.weighted(EARTH);
  // Las tongadas: capas finas de tierra, de 2 a 4 de alto, cada una con su tono.
  const layer: string[] = [];
  while (layer.length < h) {
    const t = pick();
    for (let k = 2 + rng.int(0, 2); k > 0; k--) layer.push(t);
  }
  for (let yy = y; yy < y + h; yy++) {
    const base = layer[yy - y]!;
    for (let xx = x; xx < x + w; xx++) {
      // La tongada no es recta: ondula y se mezcla con la de al lado.
      const wob = smooth(xx, yy, 9, 13) > 0.62 ? layer[Math.min(h - 1, yy - y + 1)]! : base;
      const n = hash(xx, yy, 4);
      b.set(xx, yy, n < 0.06 ? P.bark : n > 0.985 ? P.tan : wob);
    }
  }
  // Alguna piedra metida en la tierra.
  for (let k = 0; k < (w * h) / 350; k++) {
    const px = x + rng.int(0, w - 3);
    const py = y + rng.int(0, h - 2);
    b.hline(px, py, 2, P.tan);
    b.hline(px, py + 1, 2, P.rust);
  }
  // Los cajones del encofrado, hilada a hilada: cada una de su alto y cada cajón de su largo,
  // al tresbolillo; los mechinales de las agujas, a distancias desiguales.
  for (let cy = y; cy < y + h;) {
    const ch = 16 + rng.int(0, 5);
    const jy = cy + ch - 1;
    if (jy < y + h) {
      b.hline(x, jy, w, P.bark);
      if (jy + 1 < y + h) b.hline(x, jy + 1, w, P.clay);
    }
    for (let cx = x + rng.int(8, 40); cx < x + w; cx += 34 + rng.int(0, 26)) {
      b.vline(cx, cy, Math.min(ch - 1, y + h - cy), P.bark);
      // Un remiendo de barro más oscuro junto a alguna junta.
      if (rng.chance(0.25)) {
        const rw = 3 + rng.int(0, 5);
        const rh = 2 + rng.int(0, 3);
        const ry = cy + rng.int(2, Math.max(2, ch - rh - 2));
        b.rect(cx + 1, ry, Math.min(rw, x + w - cx - 1), Math.min(rh, y + h - ry), P.rust);
      }
    }
    for (let mx = x + rng.int(4, 16); mx < x + w - 3 && jy < y + h; mx += 16 + rng.int(0, 18)) {
      b.rect(mx, jy - 3, 3, 2, P.plum);
      b.hline(mx, jy - 1, 3, P.bark);
      // El churrete que deja la lluvia bajo el mechinal.
      if (rng.chance(0.4))
        b.vline(mx + 1, jy + 2, Math.min(2 + rng.int(0, 5), y + h - jy - 2), P.rust);
    }
    cy += ch;
  }
  // Abajo, la lluvia que salpica la deja más oscura y comida.
  for (let yy = grounded(h) ? Math.max(y, y + h - 8) : y + h; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++)
      if (hash(xx, yy, 6) < (yy - (y + h - 8)) / 12) b.set(xx, yy, P.bark);
}

export function rammedSection(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  col: Col,
) {
  for (let yy = y; yy < y + h; yy++)
    for (let i = 0; i < w; i++) {
      const xx = col(i);
      const n = hash(xx, yy, 8);
      const layer = Math.floor((yy - y) / 3) % 2;
      b.set(xx, yy, n < 0.1 ? P.bark : layer ? P.rust : P.clay);
    }
  // Las agujas de madera que cruzan el muro, a la altura de los mechinales.
  for (let jy = y + 14; jy + 2 < y + h; jy += 18) {
    b.rect(x, jy, w, 2, P.bark);
    b.hline(x, jy, w, P.oak);
    b.hline(x, jy + 3, w, P.rust);
  }
}

// ---------- Lajas de pizarra ----------

export function slateFace(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
) {
  const rng = new Rng(`lajas-${seed}`);
  b.rect(x, y, w, h, P.black);
  for (let ly = y; ly < y + h;) {
    const lh = Math.min(2 + rng.int(0, 2), y + h - ly);
    for (let lx = x - rng.int(0, 12); lx < x + w;) {
      // Alguna laja grande y más clara (de las que atan el muro).
      const big = rng.chance(0.06);
      const lw = big ? 18 + rng.int(0, 10) : 7 + rng.int(0, 16);
      const tone = big
        ? P.steel
        : rng.weighted([
            [P.slate, 5],
            [P.navy, 2],
            [P.steel, 1.5],
          ] as const);
      const x0 = Math.max(x, lx + 1);
      const x1 = Math.min(x + w, lx + lw);
      if (x1 > x0) {
        b.rect(x0, ly, x1 - x0, lh, tone);
        b.hline(x0, ly, x1 - x0, tone === P.steel ? P.fog : P.steel);
        // La punta de la laja, más fina.
        if (lh > 2) b.set(x1 - 1, ly + lh - 1, P.black);
      }
      lx += lw;
    }
    ly += lh + 1;
  }
  // Musgo en las juntas de abajo.
  for (let xx = x; xx < x + w && grounded(h); xx++)
    for (let yy = Math.max(y, y + h - 10); yy < y + h; yy++)
      if (hash(xx, yy, 4) < 0.05 + (yy - (y + h - 10)) * 0.02)
        b.set(xx, yy, hash(xx, yy, 5) < 0.6 ? P.forest : P.leaf);
}

export function slateSection(b: PixelBuffer, x: number, y: number, w: number, h: number) {
  b.rect(x, y, w, h, P.black);
  for (let ly = y, k = 0; ly < y + h; k++) {
    const lh = Math.min(2 + (k % 3 === 0 ? 1 : 0), y + h - ly);
    // Lajas a todo lo hondo, unas desde un lado y otras desde el otro (se traban).
    const short = Math.round(w * 0.25);
    const a = k % 2 ? 0 : short;
    b.rect(x + a, ly, w - short, lh, k % 3 ? P.navy : P.slate);
    b.hline(x + a, ly, w - short, P.slate);
    ly += lh + 1;
  }
}

// ---------- Encalado ----------

/** Cal vieja: crema y no blanca, con la luz de los brochazos y la sombra de los bordes. */
const LIME = { mid: P.sand, dk: P.skin, deep: P.skinS, edge: P.clay };

export function limeFace(b: PixelBuffer, x: number, y: number, w: number, h: number, seed: string) {
  const rng = new Rng(`cal-${seed}`);
  // Debajo, el mampuesto: piedras desiguales en su mortero.
  b.rect(x, y, w, h, P.plum);
  for (let sy = y; sy < y + h; sy += 5)
    for (let sx = x - rng.int(0, 6); sx < x + w;) {
      const sw = 5 + rng.int(0, 6);
      const x0 = Math.max(x, sx + 1);
      const x1 = Math.min(x + w, sx + sw);
      const yh = Math.min(4, y + h - sy - 1);
      if (x1 > x0 && yh > 0) {
        b.rect(x0, sy + 1, x1 - x0, yh, rng.chance(0.5) ? P.steel : P.slate);
        b.hline(x0, sy + 1, x1 - x0, P.fog);
      }
      sx += sw;
    }
  // Las calvas: manchas de borde roto sacadas de un ruido suave (dos escalas), pocas arriba y
  // más hacia abajo, donde roza y moja. Nada de círculos.
  const off = rng.int(0, 999);
  const bald = (xx: number, yy: number) => {
    const n = smooth(xx + off, yy * 1.6, 16, 11) * 0.86 + smooth(xx + off, yy, 4, 12) * 0.14;
    const low = (yy - y) / h;
    return n > 0.84 - low * 0.14;
  };
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      if (bald(xx, yy)) continue;
      // El canto de la cal: el grueso se ve abajo y a la derecha de la calva (sombra) y arriba
      // a la izquierda queda el borde roto, un tono más tostado.
      if (bald(xx, yy - 1) || bald(xx - 1, yy)) {
        b.set(xx, yy, LIME.edge);
        continue;
      }
      if (bald(xx, yy + 1) || bald(xx + 1, yy)) {
        b.set(xx, yy, LIME.deep);
        continue;
      }
      // Brochazos largos y tendidos, apenas un tono más tostados (nada de blanco: parece nieve).
      const st = hash(Math.floor((xx - x) / 9), yy - y, 7);
      b.set(xx, yy, st > 0.78 ? LIME.dk : st < 0.04 ? LIME.deep : LIME.mid);
    }
  // La humedad que sube: un zócalo más oscuro, tramado hacia arriba.
  for (let yy = grounded(h) ? Math.max(y, y + h - 12) : y + h; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      const k = (yy - (y + h - 12)) / 12;
      if (bald(xx, yy)) continue;
      if (((xx * 3 + yy * 5) & 7) / 8 < k) b.set(xx, yy, k > 0.6 ? LIME.deep : LIME.dk);
    }
  // Churretes bajo lo alto.
  for (let k = 0; k < Math.ceil(w / 30); k++) {
    const cx = x + rng.int(0, w - 1);
    b.vline(cx, y, 2 + rng.int(0, 5), LIME.dk);
  }
}

export function limeSection(b: PixelBuffer, x: number, y: number, w: number, h: number, col: Col) {
  b.rect(x, y, w, h, P.navy);
  for (let yy = y; yy < y + h; yy += 2)
    for (let i = 2; i < w - 2; i += 2) {
      const xx = col(i);
      if (hash(xx, yy, 9) < 0.55) {
        b.set(xx, yy, P.slate);
        b.set(xx + 1, yy, hash(xx, yy, 1) < 0.5 ? P.slate : P.steel);
      }
    }
  // La piel de cal, por las dos caras (más gruesa por fuera).
  for (let yy = y; yy < y + h; yy++) {
    b.set(col(0), yy, P.skin);
    b.set(col(1), yy, P.skinS);
    b.set(col(w - 1), yy, P.skinS);
  }
}
