/**
 * Efectos de la pelea del visor: el destello del impacto, la estela del arma, la flecha y el
 * orbe que vuelan, la sangre y el pelo que saltan, el polvo y el temblor de los grandes. Todo sale
 * del tiempo (`a`, de 0 a 1, lo que lleva cada efecto) y de una semilla: la pelea no guarda
 * estado y así se puede pintar cualquier instante.
 */
import { bayer, rgba, type PixelBuffer } from '../../art/pixel';
import type { Luz } from './luz';
import { pack, tintColor, unpack } from './luz';
import { hash } from './tonos';

export type Fx =
  /** Destello del golpe (por encima de la luz: brilla). */
  | { k: 'impact'; x: number; y: number; a: number; big: boolean; magia?: boolean }
  /** Zarpazo de una bestia: tres rayas que se abren sobre el golpeado. */
  | { k: 'claw'; x: number; y: number; dir: number; a: number }
  /** Embestida: estelas de velocidad detrás de quien carga (`back`: su lado de atrás, ±1). */
  | { k: 'rush'; x: number; top: number; bottom: number; back: number; a: number; seed: number }
  /** El mago carga el orbe en la punta del bastón: chispas que se juntan. */
  | { k: 'charge'; x: number; y: number; a: number }
  /** Estela del arma al dar un tajo (arco delante de quien golpea). */
  | { k: 'slash'; x: number; y: number; dir: number; a: number; big: boolean }
  /** Lo que vuela de uno a otro: flecha, orbe del mago, luz del clérigo. */
  | { k: 'bolt'; what: 'flecha' | 'orbe' | 'luz'; x0: number; x1: number; y: number; a: number }
  /** Sangre y pelo que saltan del golpeado y caen al suelo. */
  | {
      k: 'bits';
      x: number;
      y: number;
      floor: number;
      dir: number;
      a: number;
      seed: number;
      cols: number[];
      n: number;
    }
  /** Polvo del suelo (un pisotón, un golpe contra el suelo, uno que cae). */
  | { k: 'dust'; x: number; y: number; a: number; w: number };

const WHITE = rgba('#ffffff');
const YELLOW = rgba('#fee761');
const AMBER = rgba('#f77622');
const CYAN = rgba('#8be9ff');
const BLUE = rgba('#2ce8f5');
const GOLD = rgba('#feae34');
const WOOD = rgba('#8a4836');
const STEEL = rgba('#c0cbdc');
const SHADE = rgba('#8b9bb4');
/** La sangre de las bestias (oscura, que no chille). */
export const BLOOD = [rgba('#a22633'), rgba('#6b1a26')];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function dot(b: PixelBuffer, x: number, y: number, c: number): void {
  b.set(Math.round(x), Math.round(y), c);
}

/** Mezcla con lo que hay debajo (para el polvo, que se transparenta). */
function blend(b: PixelBuffer, x: number, y: number, c: number, k: number): void {
  x = Math.round(x);
  y = Math.round(y);
  if (!b.inside(x, y)) return;
  const i = y * b.w + x;
  const d = unpack(b.data[i]!);
  const s = unpack(c);
  b.data[i] = pack([d[0] + (s[0] - d[0]) * k, d[1] + (s[1] - d[1]) * k, d[2] + (s[2] - d[2]) * k]);
}

/** Lo que va con la escena (y su luz): sangre, pelo y polvo. */
export function drawFxScene(b: PixelBuffer, fx: Fx[], l: Luz): void {
  for (const f of fx) {
    if (f.k === 'bits') bits(b, f, l);
    else if (f.k === 'dust') dust(b, f, l);
  }
}

/** Lo que brilla (por encima de la luz): destellos, estelas, flechas y orbes. */
export function drawFxGlow(b: PixelBuffer, fx: Fx[], l: Luz): void {
  for (const f of fx) {
    if (f.k === 'impact') impact(b, f);
    else if (f.k === 'claw') claw(b, f);
    else if (f.k === 'charge') charge(b, f);
    else if (f.k === 'rush') rush(b, f);
    else if (f.k === 'slash') slash(b, f);
    else if (f.k === 'bolt') bolt(b, f, l);
  }
}

/** Cuatro tiempos: estalla en blanco, se abre en anillo, se rompe en chispas y quedan puntos. */
function impact(b: PixelBuffer, f: Extract<Fx, { k: 'impact' }>): void {
  const { x, y, a, big } = f;
  if (a < 0 || a >= 1) return;
  const R = big ? 1.4 : 1;
  // La magia estalla en azul; el resto, en amarillo.
  const LEMON = f.magia ? CYAN : YELLOW;
  const ORANGE = f.magia ? BLUE : AMBER;
  const st = Math.floor(a * 4);
  if (st === 0) {
    // Estallido: núcleo blanco y cuatro rayos.
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if (dx * dx + dy * dy <= 4 * R) dot(b, x + dx, y + dy, WHITE);
    const r = Math.round(5 * R);
    for (let d = 3; d <= r; d++) {
      const c = d > r - 1 ? LEMON : WHITE;
      dot(b, x + d, y, c);
      dot(b, x - d, y, c);
      dot(b, x, y + d, c);
      dot(b, x, y - d, c);
    }
  } else if (st === 1) {
    // Anillo que se abre, con rayos en diagonal.
    const r = 4 * R;
    for (let k = 0; k < 20; k++) {
      const an = (k / 20) * Math.PI * 2;
      dot(b, x + Math.cos(an) * r, y + Math.sin(an) * r, k % 2 ? LEMON : WHITE);
    }
    for (const [sx, sy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      dot(b, x + sx * 2, y + sy * 2, WHITE);
      dot(b, x + sx * 3, y + sy * 3, LEMON);
    }
  } else {
    // Chispas que se van (y se apagan de amarillo a naranja).
    const u = (a - 0.5) * 2;
    for (let k = 0; k < 8; k++) {
      if (st === 3 && k % 2) continue;
      const an = (k / 8) * Math.PI * 2 + 0.4;
      const r = (5 + u * 4) * R;
      dot(b, x + Math.cos(an) * r, y + Math.sin(an) * r, st === 2 ? LEMON : ORANGE);
    }
  }
}

/** Media luna blanca delante de quien da el tajo: gruesa en el filo y afilada en la cola. */
function slash(b: PixelBuffer, f: Extract<Fx, { k: 'slash' }>): void {
  const { x, y, dir, a, big } = f;
  if (a < 0 || a >= 1) return;
  const r = big ? 12 : 10;
  // El filo barre de arriba (-75°) a abajo (+75°) en la primera mitad; luego la estela se apaga.
  const head = -75 + 150 * clamp01(a * 2);
  const len = 120 * (a < 0.5 ? 1 : 1 - (a - 0.5) * 2);
  const tail = head - len;
  for (let deg = Math.max(-75, tail); deg <= head; deg += 2) {
    const an = (deg * Math.PI) / 180;
    const u = (deg - tail) / (head - tail || 1);
    // Grosor: 3 px en el filo, 1 en la cola.
    const th = u > 0.7 ? 3 : u > 0.35 ? 2 : 1;
    for (let k = 0; k < th; k++) {
      const rr = r - k;
      const px = x + dir * Math.cos(an) * rr;
      const py = y + Math.sin(an) * rr;
      const c = k === 0 && u > 0.5 ? WHITE : u > 0.6 ? STEEL : SHADE;
      if (u < 0.3 && (Math.round(px) + Math.round(py)) % 2) continue;
      dot(b, px, py, c);
    }
  }
}

function bolt(b: PixelBuffer, f: Extract<Fx, { k: 'bolt' }>, l: Luz): void {
  const { what, x0, x1, y, a } = f;
  if (a < 0 || a >= 1) return;
  const dir = Math.sign(x1 - x0) || 1;
  const x = x0 + (x1 - x0) * a;
  if (what === 'flecha') {
    // Un poco de parábola: sube y baja (y la flecha se inclina con ella).
    const yy = y - Math.sin(a * Math.PI) * 4;
    const slope = -Math.cos(a * Math.PI) * 0.35;
    const at = (d: number) => [x - dir * d, yy - slope * d] as const;
    // Rastro: un par de puntos que se quedan atrás.
    for (const d of [11, 14]) {
      const [px, py] = at(d);
      if ((d + Math.floor(a * 16)) % 2 === 0) dot(b, px, py, SHADE);
    }
    for (let d = 1; d < 8; d++) {
      const [px, py] = at(d);
      dot(b, px, py, tintColor(d < 2 ? STEEL : WOOD, l));
    }
    const [hx, hy] = at(0);
    dot(b, hx, hy, WHITE);
    dot(b, hx + dir, hy, STEEL);
    const [fx, fy] = at(8);
    dot(b, fx, fy - 1, WHITE);
    dot(b, fx, fy + 1, WHITE);
    dot(b, fx - dir, fy - 1, WHITE);
    dot(b, fx - dir, fy + 1, WHITE);
    return;
  }
  const core = what === 'orbe' ? WHITE : WHITE;
  const halo = what === 'orbe' ? CYAN : YELLOW;
  const tailC = what === 'orbe' ? BLUE : GOLD;
  const yy = y + Math.sin(a * Math.PI * 4) * (what === 'orbe' ? 1 : 0);
  // Estela de puntos que se apagan.
  for (let d = 2; d <= 9; d++) {
    const wob = Math.round(Math.sin(d * 1.3 + a * 20) * (d / 6));
    if ((d + Math.floor(a * 20)) % 2 === 0)
      dot(b, x - dir * d * 1.5, yy + wob, d < 5 ? halo : tailC);
  }
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      const r = dx * dx + dy * dy;
      if (r <= 2) dot(b, x + dx, yy + dy, core);
      else if (r <= 5) dot(b, x + dx, yy + dy, halo);
      else if (r <= 9 && (dx + dy + Math.floor(a * 12)) % 2 === 0) dot(b, x + dx, yy + dy, tailC);
    }
}

/** Tres rayas en diagonal que se rasgan una tras otra (blanco en el centro, sangre al borde). */
function claw(b: PixelBuffer, f: Extract<Fx, { k: 'claw' }>): void {
  const { x, y, dir, a } = f;
  if (a < 0 || a >= 1) return;
  for (let i = 0; i < 3; i++) {
    const u = clamp01((a - i * 0.08) / 0.25);
    if (u <= 0) continue;
    const len = Math.round(9 * u);
    const ox = x + dir * (i * 3 - 3);
    const oy = y - 5 + i;
    for (let d = 0; d < len; d++) {
      const px = ox - dir * Math.round(d * 0.6);
      const py = oy + d;
      // Se borra en tramado al final.
      if (a > 0.6 && bayer(Math.round(px), Math.round(py)) < (a - 0.6) / 0.4) continue;
      const mid = d > 1 && d < len - 1;
      dot(b, px, py, mid && a < 0.5 ? WHITE : BLOOD[0]!);
      if (mid) dot(b, px + dir, py, BLOOD[1]!);
    }
  }
}

/** Rayas horizontales que salen de la grupa y se quedan atrás, cada vez más largas y finas. */
function rush(b: PixelBuffer, f: Extract<Fx, { k: 'rush' }>): void {
  const { x, top, bottom, back, a, seed } = f;
  if (a < 0 || a >= 1) return;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const h = hash(seed * 13 + i * 29);
    const y = Math.round(top + ((bottom - top) * (i + 0.5)) / n + (h - 0.5) * 2);
    // Cada raya arranca a su tiempo y se aleja hacia atrás.
    const u = clamp01((a - h * 0.25) / 0.75);
    if (u <= 0 || u >= 1) continue;
    // Pegadas a la grupa (un poco metidas: salen del cuerpo).
    const start = x + back * (u * 3 + h * 2 - 2);
    const len = Math.round(5 + u * 12 + h * 6);
    for (let d = 0; d < len; d++) {
      const v = d / len;
      // La cola, en tramado; al final se apagan.
      if (v > 0.5 && (d + y) % 2) continue;
      if (u > 0.6 && hash(i * 7 + d) < (u - 0.6) / 0.4) continue;
      dot(b, start + back * d, y, v < 0.3 && u < 0.5 ? WHITE : v < 0.6 ? STEEL : SHADE);
    }
  }
}

/** Chispas que giran y se juntan en la punta del bastón (luego sale el orbe). */
function charge(b: PixelBuffer, f: Extract<Fx, { k: 'charge' }>): void {
  const { x, y, a } = f;
  if (a < 0 || a >= 1) return;
  const r = 7 * (1 - a);
  for (let i = 0; i < 5; i++) {
    const an = i * ((Math.PI * 2) / 5) + a * 7;
    dot(b, x + Math.cos(an) * r, y + Math.sin(an) * r, i % 2 ? CYAN : WHITE);
  }
  if (a > 0.5) {
    dot(b, x, y, WHITE);
    dot(b, x + 1, y, CYAN);
    dot(b, x - 1, y, CYAN);
    dot(b, x, y + 1, CYAN);
    dot(b, x, y - 1, CYAN);
  }
}

/** Gotas y mechones con su parábola: salen hacia atrás, caen y se quedan en el suelo un rato. */
function bits(b: PixelBuffer, f: Extract<Fx, { k: 'bits' }>, l: Luz): void {
  const { x, y, floor, dir, a, seed, cols, n } = f;
  if (a < 0 || a >= 1) return;
  for (let i = 0; i < n; i++) {
    const h1 = hash(seed * 31 + i * 7);
    const h2 = hash(seed * 17 + i * 13 + 5);
    const vx = dir * (8 + h1 * 22) * (i % 3 === 0 ? -0.4 : 1);
    const vy = -(10 + h2 * 24);
    const t = a * 1.1;
    let px = x + vx * t;
    let py = y + vy * t + 70 * t * t;
    if (py >= floor) {
      // En el suelo: quieto donde cayó (el tiempo que tardó en llegar).
      const tl = (-vy + Math.sqrt(vy * vy + 280 * (floor - y))) / 140;
      px = x + vx * tl;
      py = floor;
      // Se va borrando en tramado al final.
      if (a > 0.7 && bayer(Math.round(px), i) < (a - 0.7) / 0.3) continue;
    }
    const c = tintColor(cols[i % cols.length]!, l);
    dot(b, px, py, c);
    // Las gotas gordas, de dos (en el aire, alargadas por la caída; en el suelo, un charquito).
    if (i % 2 === 0) {
      if (py < floor) dot(b, px, py - 1, c);
      else dot(b, px + 1, py, c);
    }
  }
}

/** Bocanadas de polvo que salen a los lados, suben un poco y se deshacen. */
function dust(b: PixelBuffer, f: Extract<Fx, { k: 'dust' }>, l: Luz): void {
  const { x, y, a, w } = f;
  if (a < 0 || a >= 1) return;
  const c = tintColor(rgba('#d9c8a6'), l);
  const ease = 1 - (1 - a) ** 2;
  const n = Math.max(2, Math.round(w / 4));
  for (let side = -1; side <= 1; side += 2)
    for (let i = 0; i < n; i++) {
      const out = (i + 1) / n;
      const cx = x + side * (2 + out * w * ease);
      const cy = y - 1 - ease * (1.5 + (1 - out) * 2.5);
      const r = (1.2 + (1 - out) * 1.6) * (0.7 + ease * 0.6);
      const R = Math.ceil(r);
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > r * r) continue;
          const X = Math.round(cx + dx);
          const Y = Math.round(cy + dy);
          if (Y > y) continue;
          // Al final se deshace en tramado (de fuera adentro).
          if (a > 0.55 && bayer(X, Y) < (a - 0.55) / 0.45 + (d2 / (r * r)) * 0.3) continue;
          blend(b, X, Y, c, (d2 < r * r * 0.4 ? 0.6 : 0.35) * (1 - a * 0.5));
        }
    }
}

/** El color de pelo de un dibujo (un píxel de en medio del cuerpo, no del borde). */
export function furOf(img: PixelBuffer): number[] {
  const out: number[] = [];
  for (const [u, v] of [
    [0.5, 0.55],
    [0.4, 0.5],
    [0.6, 0.6],
  ] as const) {
    const c = img.get(Math.round(img.w * u), Math.round(img.h * v));
    if (c >>> 24) out.push(c);
  }
  return out.length ? out : [rgba('#6b4a3a')];
}
