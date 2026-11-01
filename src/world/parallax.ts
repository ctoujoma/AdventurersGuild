import { Rng } from '../core/rng';
import { P } from '../art/palette';
import { PixelBuffer, bayer } from '../art/pixel';
import { GROUND, SPAN, WORLD_H, WORLD_X0 } from './geometry';

/**
 * Ancho de las capas lejanas: más que el mundo, porque con el zoom más alejado y el
 * paralaje (se mueven menos que la cámara) tienen que seguir cubriendo la vista.
 */
export const LAYER_W = SPAN + 512;

/**
 * Todas las capas miden LAYER_W de ancho y su píxel 0 está en WORLD_X0 (se pintan desplazadas).
 *
 * Capas lejanas de la noche: cielo, montañas, colinas con aldea y castillo, y una
 * hilera de árboles. Cada una se desplaza a una fracción de la cámara (paralaje).
 */

export interface ParallaxLayer {
  /** De noche (siluetas) y de día (a color, con la misma silueta: se funden una en otra). */
  buf: PixelBuffer;
  day: PixelBuffer;
  /** Fracción del movimiento de cámara (0 = fijo, 1 = como el mundo). */
  fx: number;
  fy: number;
}

export interface Star {
  x: number;
  y: number;
  bright: boolean;
}

const SKY = [P.black, P.navy, P.slate, P.steel];

export function buildSky(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  for (let y = 0; y < WORLD_H; y++) {
    const t = Math.min(1, Math.max(0, (y - 20) / 210));
    const v = t * (SKY.length - 1.3);
    for (let x = 0; x < LAYER_W; x++) {
      const base = Math.floor(v);
      const f = v - base;
      const step = f > 0.7 ? (f - 0.7) / 0.3 > bayer(x, y) : false;
      b.set(x, y, SKY[Math.min(SKY.length - 1, base + (step ? 1 : 0))]!);
    }
  }
  return b;
}

/**
 * La luna con su halo tramado y cráteres, aparte del cielo: se pinta solo de noche, en lo
 * alto de la vista, y se desvanece con la luz del día.
 */
export const MOON_R = 34;
export function buildMoon(): PixelBuffer {
  const b = new PixelBuffer(MOON_R * 2 + 1, MOON_R * 2 + 1);
  const mx = MOON_R;
  const my = MOON_R;
  for (let y = my - 34; y <= my + 34; y++) {
    for (let x = mx - 34; x <= mx + 34; x++) {
      const d = Math.hypot(x - mx, y - my);
      if (d > 15 && d < 34 && bayer(x, y) < ((34 - d) / 19) * 0.35)
        b.set(x, y, d < 22 ? P.steel : P.slate);
    }
  }
  b.ellipse(mx, my, 13, 13, (x, y) => {
    const lit = (x - mx) * -0.5 + (y - my) * -0.4;
    return lit < -5 + bayer(x, y) * 2 ? P.fog : lit > 4 ? P.white : P.mist;
  });
  for (const [cx, cy, r] of [
    [mx - 4, my - 3, 2.6],
    [mx + 4, my + 4, 3.2],
    [mx + 5, my - 6, 1.6],
    [mx - 5, my + 6, 1.4],
  ] as const) {
    b.ellipse(cx, cy, r, r, P.fog);
    b.set(Math.round(cx - r * 0.5), Math.round(cy - r * 0.5), P.mist);
  }
  return b;
}

export function stars(): Star[] {
  const rng = new Rng('estrellas');
  return Array.from({ length: 130 }, () => ({
    x: rng.int(0, LAYER_W - 1),
    y: rng.int(0, 230),
    bright: rng.chance(0.2),
  }));
}

// ---------- Las formas, comunes al día y a la noche ----------

/** Cresta de las montañas: picos marcados (valor absoluto de senos) y algo de detalle. */
export function ridgeAt(x: number): number {
  // Picos agudos (1 − |sen|: punta arriba, valle redondo abajo) y, con la potencia, flancos
  // cóncavos que se abren hacia abajo, como los montes de verdad; de tres tamaños.
  const peak = (f: number, ph: number, p: number) => (1 - Math.abs(Math.sin(x * f + ph))) ** p;
  // Sobre una base común (la sierra no se corta: collados y hombros entre las cumbres).
  const base = 18 + Math.sin(x * 0.004 + 1) * 6;
  const big = peak(0.0105, 0.4, 1.2) * 46;
  const mid = peak(0.027, 2.1, 1.3) * 22 * (0.55 + big / 90);
  const small = peak(0.071, 0.7, 1.2) * 7;
  const h = base + big + mid + small;
  // En lo alto, la cresta mellada: agujas y muescas de roca (más cuanto más alto).
  const i = Math.floor(x / 3);
  const u = x / 3 - i;
  const crag = (a: number) => {
    let v = Math.imul(a * 374761393 + 13, 1274126177);
    v ^= v >>> 13;
    return ((Math.imul(v, 1103515245) >>> 0) % 1000) / 1000 - 0.5;
  };
  const rough = crag(i) + (crag(i + 1) - crag(i)) * u;
  return 244 - h - rough * 5 * Math.min(1, Math.max(0, h - 20) / 40);
}

/** Lomo de las colinas. */
export const hillAt = (x: number) => 252 - Math.sin(x * 0.017 + 0.6) * 16 - Math.sin(x * 0.043) * 6;

export interface House {
  x: number;
  base: number;
  w: number;
  h: number;
  /** Ventanas encendidas de noche y si tiene chimenea (echa humo). */
  lit: [boolean, boolean];
  chimney: boolean;
}

/** Las casas de la aldea de las colinas (las mismas de día y de noche). */
export function villageHouses(): House[] {
  const rng = new Rng('aldea');
  return Array.from({ length: Math.ceil(LAYER_W / 52) }, (_, i) => {
    const x = 30 + i * 52 + rng.int(-10, 10);
    const base = Math.round(hillAt(x + 5)) + 3;
    const w = rng.int(9, 14);
    const h = rng.int(6, 9);
    const lit: [boolean, boolean] = [rng.chance(0.8), rng.chance(0.5)];
    return { x, base, w, h, lit, chimney: rng.chance(0.4) };
  });
}

/** El castillo de la loma y su bandera (que ondea aparte, ver `rooms/life.ts`). */
export const CASTLE_X = 420 - WORLD_X0;
export const castleBase = () => Math.round(hillAt(CASTLE_X)) + 2;
export const flagAt = () => ({ x: CASTLE_X + 2, y: castleBase() - 42 });

/** El molino, en otra loma; sus aspas giran aparte. */
export const MILL_X = 150;
export const millBase = () => Math.round(hillAt(MILL_X)) + 2;
export const millHub = () => ({ x: MILL_X + 4, y: millBase() - 17 });

interface Tree {
  x: number;
  h: number;
  conifer: boolean;
}

function forestTrees(): Tree[] {
  const rng = new Rng('bosque lejano');
  return Array.from({ length: 150 }, () => ({
    x: rng.int(-6, LAYER_W + 6),
    h: rng.int(10, 22),
    conifer: true,
  }));
}

function treelineTrees(): Tree[] {
  const rng = new Rng('arboleda');
  return Array.from({ length: 60 }, () => ({
    x: rng.int(-10, LAYER_W + 10),
    h: rng.int(30, 60),
    conifer: rng.chance(0.55),
  }));
}

function groveTrees(): Tree[] {
  const rng = new Rng('arboleda cercana');
  const out: Tree[] = [];
  for (let g = 0; g < Math.ceil(LAYER_W / 260); g++) {
    const gx = g * 260 + rng.int(0, 120);
    for (let i = 0; i < rng.int(2, 4); i++) {
      const x = gx + rng.int(-30, 30);
      const h = rng.int(55, 95);
      out.push({ x, h, conifer: rng.chance(0.6) });
    }
  }
  return out;
}

// ---------- De noche: siluetas ----------

/** Silueta de montañas: masa oscura, filo iluminado por la luna y nieve en las cumbres. */
export function buildMountains(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  for (let x = 0; x < LAYER_W; x++) {
    const top = Math.round(ridgeAt(x));
    const slope = ridgeAt(x + 1) - ridgeAt(x - 1); // > 0: la cresta baja hacia la derecha (cara a la luna)
    for (let y = top; y < GROUND; y++) {
      const depth = y - top;
      let c: string = P.navy;
      if (depth > 18 && bayer(x, y) < Math.min(1, (depth - 18) / 30)) c = P.black;
      // Filo iluminado (2–4 px) en las caras que miran a la luna.
      if (slope < -0.25 && depth < 2 + Math.min(3, -slope * 2)) c = P.slate;
      if (slope < -0.6 && depth === 0) c = P.steel;
      // Nieve en las cumbres altas.
      if (top < 176 && depth < 7 - Math.floor((top - 150) / 6) && (x + depth) % 4 !== 0)
        c = slope < 0 ? P.mist : P.fog;
      b.set(x, y, c);
    }
  }
  return b;
}

/** Colinas con una aldea dormida, el molino y un castillo con una ventana encendida. */
export function buildHills(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  for (let x = 0; x < LAYER_W; x++) {
    const top = Math.round(hillAt(x));
    for (let y = top; y < GROUND + 4; y++) b.set(x, y, y - top < 1 ? P.forest : P.deep);
  }
  // Casas: tejado, muro y ventanas encendidas.
  for (const o of villageHouses()) {
    const { x, base, w, h } = o;
    b.rect(x, base - h, w, h, P.black);
    b.poly(
      [
        [x - 1, base - h],
        [x + w / 2, base - h - 6],
        [x + w + 1, base - h],
      ],
      P.black,
    );
    if (o.lit[0]) b.set(x + 3, base - h + 3, P.gold);
    if (o.lit[1]) b.set(x + w - 4, base - h + 3, P.lemon);
    if (o.chimney) b.rect(x + w - 3, base - h - 6, 2, 4, P.black);
  }
  castle(b, true);
  mill(b, true);
  return b;
}

/** Bosque lejano: muchos abetos pequeños y apretados, en tonos de niebla. */
export function buildForest(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  for (const t of forestTrees()) {
    const base = GROUND + 1;
    for (let y = 0; y < t.h; y++) {
      const w = Math.floor((y / t.h) * 5) + (y % 4 < 2 ? 1 : 0);
      for (let dx = -w; dx <= w; dx++)
        b.set(t.x + dx, base - t.h + y, dx < 0 && y % 4 !== 3 ? P.steel : P.slate);
    }
  }
  return b;
}

/** Arboleda cercana: pocos árboles grandes y oscuros, con el filo de la copa a la luz de la luna. */
export function buildGrove(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  for (const t of groveTrees()) {
    const base = GROUND + 4;
    if (t.conifer) {
      for (let y = 0; y < t.h; y++) {
        const w = Math.floor((y / t.h) * 15) + (y % 8 < 4 ? 2 : 0);
        for (let dx = -w; dx <= w; dx++) {
          const rim = dx === -w && y % 8 < 4;
          b.set(t.x + dx, base - t.h + y, rim ? P.deep : P.black);
        }
      }
    } else {
      const r = Math.round(t.h * 0.3);
      b.ellipse(t.x, base - t.h + r, r, r * 0.9, (px, py) =>
        px - t.x + (py - (base - t.h + r)) < -r * 1.05 + bayer(px, py) * 3 ? P.deep : P.black,
      );
      b.rect(t.x - 2, base - t.h + r * 1.6, 5, t.h - r * 1.6, P.black);
    }
  }
  return b;
}

/** Hilera de árboles oscuros justo detrás del edificio. */
export function buildTreeline(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  for (const t of treelineTrees()) {
    const base = GROUND + 2;
    if (t.conifer) {
      for (let y = 0; y < t.h; y++) {
        const w = Math.floor((y / t.h) * 9) + (y % 6 < 3 ? 1 : 0);
        b.hline(t.x - w, base - t.h + y, w * 2 + 1, y % 6 === 0 && y > 4 ? P.deep : P.black);
      }
    } else {
      b.ellipse(t.x, base - t.h + 14, 14, 14, (px, py) =>
        px - t.x + (py - (base - t.h + 14)) < -12 + bayer(px, py) * 4 ? P.deep : P.black,
      );
      b.rect(t.x - 1, base - t.h + 24, 3, t.h - 24, P.black);
    }
  }
  return b;
}

// ---------- De día: a color ----------

const hash = (x: number, y: number, s = 0) => {
  let h = Math.imul(x * 374761393 + y * 668265263 + s * 982451653, 1274126177);
  h ^= h >>> 13;
  return ((Math.imul(h, 1103515245) >>> 0) % 10000) / 10000;
};

/**
 * Las cañadas de las montañas, como en la realidad: a cada lado de cada pico nacen varias en la
 * cresta, bajan en diagonal y se juntan en un punto; de ahí sigue un solo barranco, que se
 * pierde en la bruma. Oscuras, con el borde de la izquierda (al sol) más claro.
 */
function gullies(b: PixelBuffer): void {
  const inside = (x: number, y: number) => b.inside(x, y) && b.get(x, y) >>> 24 !== 0;
  /** Oscurece (`k` < 1) o aclara hacia el blanco (`k` > 1) un píxel ya pintado. */
  const tone = (x: number, y: number, k: number) => {
    const c = b.get(x, y);
    const ch = [c & 255, (c >> 8) & 255, (c >> 16) & 255].map((v) =>
      Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1)),
    );
    b.data[y * b.w + x] = ((255 << 24) | (ch[2]! << 16) | (ch[1]! << 8) | ch[0]!) >>> 0;
  };
  const done = new Set<number>();
  const groove = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    wide: boolean,
    fade: number,
    seed: number,
  ) => {
    const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      // En diagonal, algo más derecha arriba, y serpenteando un poco.
      const wob = Math.sin(u * 9 + seed * 7) * 0.9 * Math.sin(u * Math.PI);
      const x = Math.round(x0 + (x1 - x0) * u ** 1.15 + wob);
      const y = Math.round(y0 + (y1 - y0) * u);
      if (!inside(x, y) || y <= Math.round(ridgeAt(x)) + 1) continue;
      // Se desvanece hacia abajo (la bruma se la come) y no entra en el bosque.
      if (bayer(x, y) > 1 - (fade + u * (1 - fade)) * 0.7) continue;
      if (y > forestAt(x) - 1) continue;
      const top = Math.round(ridgeAt(x));
      // En lo alto, la cañada guarda nieve: una franja blanca (como los canales de la foto).
      if (y - top < snowAt(x, top) * 2.4 && u < 0.6) {
        for (let w = 0; w < (wide ? 2 : 1); w++)
          if (inside(x + w, y) && !done.has(y * b.w + x + w)) {
            done.add(y * b.w + x + w);
            tone(x + w, y, 1.55);
          }
        continue;
      }
      for (let w = 0; w < (wide ? 2 : 1); w++) {
        const key = y * b.w + x + w;
        if (done.has(key) || !inside(x + w, y)) continue;
        done.add(key);
        tone(x + w, y, 0.8);
      }
      // El borde de la izquierda, al sol; a la derecha, la sombra del espolón.
      const lx = x - 1;
      if (inside(lx, y) && !done.has(y * b.w + lx)) {
        done.add(y * b.w + lx);
        tone(lx, y, 1.12);
      }
      for (const [dx, k] of [
        [wide ? 2 : 1, 0.9],
        [wide ? 3 : 2, 0.95],
      ] as const) {
        const key = y * b.w + x + dx;
        if (inside(x + dx, y) && !done.has(key)) {
          done.add(key);
          tone(x + dx, y, k);
        }
      }
    }
  };
  // Los picos: donde la cresta es más alta que alrededor.
  for (let x = 6; x < b.w - 6; x++) {
    const top = ridgeAt(x);
    let peak = true;
    for (let d = 1; d <= 8 && peak; d++)
      if (ridgeAt(x - d) < top || ridgeAt(x + d) < top) peak = false;
    if (!peak) continue;
    const tall = GROUND - top;
    if (tall < 30) continue;
    for (const side of [-1, 1]) {
      const r = (i: number) => hash(x * 2 + (side > 0 ? 1 : 0), i, 21);
      // Dónde se juntan (cada pico a su manera), y el barranco que sigue.
      const meet = {
        x: Math.round(x + side * (8 + tall * (0.14 + r(1) * 0.12))),
        y: Math.round(top + tall * (0.32 + r(2) * 0.18)),
      };
      const end = {
        x: meet.x + side * Math.round(tall * (0.08 + r(3) * 0.14)),
        y: Math.round(GROUND - 12 - r(4) * 8),
      };
      groove(meet.x, meet.y, end.x, end.y, true, 0.3, r(5));
      // Las que bajan de la cresta hasta juntarse; alguna llega al barranco más abajo y otra
      // se queda corta (no todas iguales).
      const n = 2 + Math.floor(r(6) * 3);
      let sx = x + side * Math.round(1 + r(7) * 3);
      for (let k = 0; k < n; k++) {
        if (r(10 + k) < 0.2) continue;
        const sy = Math.round(ridgeAt(sx)) + 2;
        const v = k === n - 1 && r(20 + k) < 0.6 ? 0.3 + r(30 + k) * 0.3 : 0;
        groove(
          sx,
          sy,
          Math.round(meet.x + (end.x - meet.x) * v),
          Math.round(meet.y + (end.y - meet.y) * v),
          false,
          0,
          r(40 + k),
        );
        sx += side * Math.round(3 + tall * 0.04 + r(50 + k) * 6);
      }
    }
  }
}

/**
 * Montañas de día: la misma silueta de la noche, aclarada con la luz azulada del día (como un
 * `screen` con el azul del cielo) y con bruma que sube del horizonte: lo lejano, pálido.
 */
export function dayMountains(): PixelBuffer {
  const b = buildMountains();
  // Primero, en los colores de la noche: la nieve a manchas y el bosque del pie.
  for (let x = 0; x < b.w; x++) {
    const top = Math.round(ridgeAt(x));
    const slope = ridgeAt(x + 1) - ridgeAt(x - 1);
    const snow = snowAt(x, top);
    const wood = forestAt(x);
    for (let y = top; y < GROUND; y++) {
      const depth = y - top;
      let c: string = depth > 18 && bayer(x, y) < Math.min(1, (depth - 18) / 30) ? P.black : P.navy;
      // La nieve: más en lo alto, con calvas de roca.
      if (depth < snow && hash(x >> 1, (y >> 1) + 3, 13) > 0.22 - depth * 0.02)
        c = slope < 0.2 ? P.white : P.mist;
      // El filo de la cresta, a la luz.
      else if (slope < -0.25 && depth < 2) c = P.slate;
      // El bosque, con las copas en el borde.
      if (y > wood - ((x >> 1) % 2)) c = (x + y) % 3 === 0 ? P.forest : P.deep;
      b.set(x, y, c);
    }
  }
  // La luz azulada del día y la bruma.
  const sky = [207, 233, 242];
  const tint = [70, 105, 120];
  for (let y = 0; y < b.h; y++) {
    // La bruma: algo en todo el monte y más cuanto más cerca del horizonte.
    const haze = 0.14 + 0.3 * Math.max(0, Math.min(1, (y - (GROUND - 70)) / 70));
    for (let x = 0; x < b.w; x++) {
      const c = b.data[y * b.w + x]!;
      if (!(c >>> 24)) continue;
      const ch = [c & 255, (c >> 8) & 255, (c >> 16) & 255].map((v, i) => {
        const lit = 255 - ((255 - v) * (255 - tint[i]!)) / 255;
        return Math.round(lit + (sky[i]! - lit) * haze);
      });
      b.data[y * b.w + x] = ((255 << 24) | (ch[2]! << 16) | (ch[1]! << 8) | ch[0]!) >>> 0;
    }
  }
  gullies(b);
  return b;
}

/** Hasta dónde baja la nieve desde la cresta (en lo bajo, nada). */
function snowAt(x: number, top: number): number {
  if (top > 190) return 0;
  return Math.round((190 - top) / 3 + hash(x >> 2, 5, 14) * 4);
}

/** Dónde empieza el bosque del pie de los montes (sube y baja, mellado). */
function forestAt(x: number): number {
  return Math.round(
    GROUND - 66 - Math.sin(x * 0.031 + 1) * 9 - Math.sin(x * 0.11) * 3 - hash(x >> 2, 6, 15) * 4,
  );
}

/**
 * Colinas de día: verdes con la luz por la izquierda, campos en franjas con sus setos, la aldea
 * de tejados rojos (las mismas casas que de noche), el molino y el castillo de piedra.
 */
export function dayHills(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  for (let x = 0; x < LAYER_W; x++) {
    const top = Math.round(hillAt(x));
    const slope = hillAt(x + 1) - hillAt(x - 1);
    for (let y = top; y < GROUND + 4; y++) {
      const depth = y - top;
      let c: string = P.leaf;
      if (depth === 0) c = slope < 0.1 ? P.lime : P.leaf;
      else if (slope > 0.3 && bayer(x, y) < 0.5) c = P.forest;
      else if (slope < -0.3 && depth < 6 && bayer(x, y) < 0.4) c = P.lime;
      // Campos: parcelas en franjas (trigo, verde, arado) con setos entre ellas.
      const cx = Math.floor((x + depth * 1.5) / 22);
      const cy = Math.floor(depth / 7);
      const kind = hash(cx, cy, 7);
      const edge = (x + Math.round(depth * 1.5)) % 22 === 0 || depth % 7 === 0;
      if (depth > 2 && kind < 0.45) {
        if (edge) c = (x + y) % 2 ? P.forest : P.leaf;
        else {
          const stripe = (y + (kind < 0.15 ? x : 0)) % 2 === 0;
          c =
            kind < 0.15
              ? stripe
                ? P.gold
                : P.lemon
              : kind < 0.3
                ? stripe
                  ? P.lime
                  : P.leaf
                : stripe
                  ? P.cocoa
                  : P.oak;
        }
      }
      // Lo de más abajo, en la sombra de lo de delante.
      if (y > GROUND - 3 && bayer(x, y) < 0.5) c = P.forest;
      b.set(x, y, c);
    }
  }
  // Setos y arbolitos sueltos por la ladera.
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash(i, 9, 8) * LAYER_W);
    const y = Math.round(hillAt(x)) + 2 + Math.floor(hash(i, 10, 8) * 10);
    b.ellipse(x, y, 2.5, 2, (_px, py) => (py < y ? P.leaf : P.forest));
    b.set(x - 1, y - 1, P.lime);
  }
  // Las casas: muro claro, tejado rojo con su sombra, puerta, ventana y chimenea.
  for (const o of villageHouses()) {
    const { x, base, w, h } = o;
    b.rect(x, base - h, w, h, P.sand);
    b.rect(x + w - 2, base - h, 2, h, P.tan);
    b.poly(
      [
        [x - 1, base - h],
        [x + w / 2, base - h - 6],
        [x + w + 1, base - h],
      ],
      (px) => (px < x + w / 2 ? P.brick : P.wine),
    );
    b.hline(x - 1, base - h, w + 2, P.rust);
    b.rect(x + 2, base - 3, 2, 3, P.bark);
    b.set(x + w - 4, base - h + 3, P.navy);
    b.set(x + 3, base - h + 2, P.navy);
    if (o.chimney) {
      b.rect(x + w - 3, base - h - 6, 2, 4, P.brick);
      b.set(x + w - 3, base - h - 6, P.rust);
    }
  }
  castle(b, false);
  mill(b, false);
  return b;
}

/** El castillo: muro con almenas, dos torres y ventanas; de noche, en silueta. */
function castle(b: PixelBuffer, night: boolean) {
  const cx = CASTLE_X;
  const cb = castleBase();
  const wall = night ? P.black : P.sand;
  const shade = night ? P.black : P.tan;
  b.rect(cx, cb - 22, 26, 22, wall);
  if (!night) {
    // Hiladas de sillares y la sombra bajo las almenas.
    for (let y = cb - 19; y < cb; y += 3)
      for (let x = cx; x < cx + 26; x++) if ((x + (y % 2) * 3) % 6 !== 0) b.set(x, y, P.tan);
    b.hline(cx, cb - 22, 26, P.clay);
  }
  for (const tx of [cx - 4, cx + 24]) {
    b.rect(tx, cb - 32, 7, 32, wall);
    b.rect(tx + 5, cb - 32, 2, 32, shade);
    for (let k = 0; k < 7; k += 2) b.rect(tx + k, cb - 34, 1, 2, wall);
    if (!night) {
      b.poly(
        [
          [tx - 1, cb - 34],
          [tx + 3.5, cb - 44],
          [tx + 8, cb - 34],
        ],
        (px) => (px < tx + 3.5 ? P.steel : P.slate),
      );
      b.rect(tx + 2, cb - 27, 2, 3, P.black);
      b.set(tx + 2, cb - 27, P.navy);
    }
  }
  for (let k = 0; k < 26; k += 3) b.rect(cx + k, cb - 24, 2, 2, wall);
  // La puerta: arco de madera.
  b.rect(cx + 10, cb - 8, 6, 8, night ? P.black : P.bark);
  if (!night) {
    b.hline(cx + 11, cb - 9, 4, P.bark);
    b.vline(cx + 13, cb - 8, 8, P.umber);
  }
  if (night) {
    b.set(cx + 27, cb - 26, P.gold);
    b.set(cx + 12, cb - 14, P.lemon);
  } else {
    b.rect(cx + 5, cb - 16, 1, 2, P.navy);
    b.rect(cx + 20, cb - 16, 1, 2, P.navy);
  }
  // El mástil (la bandera la pone `rooms/life.ts`).
  b.vline(cx + 1, cb - 42, 10, night ? P.black : P.bark);
}

/** El molino: torre redonda con su caperuza; las aspas giran aparte. */
function mill(b: PixelBuffer, night: boolean) {
  const x = MILL_X;
  const base = millBase();
  for (let y = 0; y < 16; y++) {
    const w = 4 + Math.floor(y / 5);
    for (let dx = -w; dx <= w; dx++)
      b.set(x + 4 + dx, base - 16 + y, night ? P.black : dx > w - 3 ? P.tan : P.sand);
  }
  b.poly(
    [
      [x - 1, base - 16],
      [x + 4, base - 22],
      [x + 9, base - 16],
    ],
    night ? P.black : (px: number) => (px < x + 4 ? P.brick : P.wine),
  );
  if (!night) {
    b.rect(x + 3, base - 4, 3, 4, P.bark);
    b.set(x + 4, base - 11, P.navy);
  } else b.set(x + 4, base - 11, P.gold);
}

/** Bosque lejano de día: abetos con la luz por la izquierda y algo de bruma. */
export function dayForest(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  for (const t of forestTrees()) {
    const base = GROUND + 1;
    for (let y = 0; y < t.h; y++) {
      const w = Math.floor((y / t.h) * 5) + (y % 4 < 2 ? 1 : 0);
      for (let dx = -w; dx <= w; dx++) {
        let c: string = dx < 0 ? P.leaf : P.forest;
        if (y % 4 === 3) c = P.forest;
        if (dx === -w && y % 4 < 2) c = P.lime;
        // La bruma de lo lejano.
        if (bayer(t.x + dx, y) < 0.18) c = P.steel;
        b.set(t.x + dx, base - t.h + y, c);
      }
    }
  }
  return b;
}

/** Copa redonda de día: racimos de hojas con luz arriba a la izquierda y sombra abajo. */
function canopy(b: PixelBuffer, cx: number, cy: number, r: number, seed: number) {
  b.ellipse(cx, cy, r, r * 0.9, (px, py) => {
    const u = (px - cx) / r + (py - cy) / r;
    return u < -0.6 ? P.lime : u > 0.7 ? P.deep : u > 0.1 ? P.forest : P.leaf;
  });
  // Racimos: bultos de hojas por el borde y por dentro.
  const n = Math.round(r * 1.6);
  for (let i = 0; i < n; i++) {
    const a = hash(i, seed, 11) * Math.PI * 2;
    const d = r * (0.45 + hash(i, seed, 12) * 0.45);
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d * 0.9);
    const lit = Math.cos(a) + Math.sin(a) < -0.2;
    const k = Math.max(2, Math.round(r * 0.28));
    b.ellipse(x, y, k, k * 0.8, (px, py) =>
      py < y && px < x ? (lit ? P.lime : P.leaf) : lit ? P.leaf : P.forest,
    );
  }
}

/** Hilera de árboles de día: abetos con su luz y robles de copa redonda. */
export function dayTreeline(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  for (const t of treelineTrees()) {
    const base = GROUND + 2;
    if (t.conifer) {
      for (let y = 0; y < t.h; y++) {
        const w = Math.floor((y / t.h) * 9) + (y % 6 < 3 ? 1 : 0);
        for (let dx = -w; dx <= w; dx++) {
          let c: string = dx < -w / 3 ? P.leaf : dx < w / 2 ? P.forest : P.deep;
          if (y % 6 === 0 && y > 4) c = P.deep;
          if (dx === -w && y % 6 < 3) c = P.lime;
          b.set(t.x + dx, base - t.h + y, c);
        }
      }
      b.rect(t.x - 1, base - 3, 2, 3, P.bark);
    } else {
      b.rect(t.x - 1, base - t.h + 22, 3, t.h - 22, P.bark);
      b.vline(t.x - 1, base - t.h + 22, t.h - 22, P.oak);
      canopy(b, t.x, base - t.h + 14, 14, t.x);
    }
  }
  return b;
}

/** Arboleda cercana de día: árboles grandes, con su tronco y la copa en racimos. */
export function dayGrove(): PixelBuffer {
  const b = new PixelBuffer(LAYER_W, WORLD_H);
  for (const t of groveTrees()) {
    const base = GROUND + 4;
    if (t.conifer) {
      b.rect(t.x - 2, base - 8, 5, 8, P.bark);
      for (let y = 0; y < t.h; y++) {
        const w = Math.floor((y / t.h) * 15) + (y % 8 < 4 ? 2 : 0);
        for (let dx = -w; dx <= w; dx++) {
          let c: string = dx < -w / 3 ? P.leaf : dx < w / 2 ? P.forest : P.deep;
          if (y % 8 === 0 && y > 4) c = P.deep;
          if (dx === -w && y % 8 < 4) c = P.lime;
          if (dx < 0 && y % 8 === 2 && (dx + y) % 3 === 0) c = P.lime;
          b.set(t.x + dx, base - t.h + y, c);
        }
      }
    } else {
      const r = Math.round(t.h * 0.3);
      b.rect(t.x - 2, base - t.h + r * 1.6, 5, t.h - r * 1.6, P.bark);
      b.vline(t.x - 2, base - t.h + r * 1.6, t.h - r * 1.6, P.oak);
      canopy(b, t.x, base - t.h + r, r, t.x);
    }
  }
  return b;
}

/**
 * Las capas del fondo, de la más lejana (la que menos se mueve) a la más cercana. Todas están
 * detrás del final del terreno 3D, que con la perspectiva se mueve a algo más de la mitad que la
 * cámara (`scaleAt(YARD_D)`): si una capa fuese más deprisa, los árboles de detrás adelantarían
 * a los que hay plantados delante (ver parallax.test.ts).
 */
export function parallaxLayers(): ParallaxLayer[] {
  return [
    { buf: buildMountains(), day: dayMountains(), fx: 0.2, fy: 0.5 },
    { buf: buildHills(), day: dayHills(), fx: 0.27, fy: 0.65 },
    { buf: buildForest(), day: dayForest(), fx: 0.35, fy: 0.78 },
    { buf: buildTreeline(), day: dayTreeline(), fx: 0.42, fy: 0.88 },
    { buf: buildGrove(), day: dayGrove(), fx: 0.48, fy: 0.95 },
  ];
}
