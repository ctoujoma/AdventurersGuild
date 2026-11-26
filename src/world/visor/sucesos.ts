/**
 * Lo que tiene delante el grupo mientras espera a que elijas (`e.pending`): el cofre, la torre,
 * el santuario, el mercader con su carro, el viajero, el campamento abandonado, el oso, la boca de
 * la cueva o unas ruinas, plantados en el camino. Con un jefe o el guardián a la vista, el grupo se
 * esconde tras unos matorrales y rocas a un lado y el jefe espera al otro.
 *
 * Los dibujos son píxel a píxel: los pequeños, mapas de letras; los grandes (torre, cueva,
 * ruinas), por código con piedras en hiladas, musgo y contorno. Se tiñen con la luz del momento.
 */
import { expFoeArt } from '../../art/expFoes';
import { FEET_Y, generateLook, heroSprites } from '../../art/heroes/hero';
import { PixelBuffer, alpha, rgba } from '../../art/pixel';
import type { ExpEvent } from '../../data/expEvents';
import type { Ctx } from './ctx';
import { heroOf, shadow, GAP } from './gente';
import { put, tinted } from './pintar';
import { hash } from './tonos';

const PAL: Record<string, string> = {
  o: '#1a1210',
  w: '#5a3a22',
  W: '#7a5230',
  L: '#9a6c3e',
  i: '#3c4048',
  I: '#6a7080',
  g: '#e8b83a',
  G: '#fff0a0',
  s: '#44444e',
  S: '#66667a',
  T: '#8e8e9c',
  U: '#b0b0ba',
  m: '#3e5e26',
  M: '#628a34',
  l: '#1e3818',
  f: '#305e22',
  F: '#4e8a2e',
  c: '#c8b890',
  C: '#9a8a68',
  r: '#9a2c40',
  R: '#c84858',
  y: '#fee761',
  Y: '#e88a2a',
  k: '#0c0a0c',
  b: '#6a4a3a',
  B: '#8a6a52',
  a: '#2a2420',
};

/** Un mapa de letras a dibujo (`.` vacío; filas cortas, rellenas por la derecha). */
function sprite(rows: readonly string[]): PixelBuffer {
  const w = Math.max(...rows.map((r) => r.length));
  const b = new PixelBuffer(w, rows.length);
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      const c = PAL[ch];
      if (c) b.set(x, y, c);
    }),
  );
  return b;
}

/** Contorno oscuro alrededor de lo pintado (fuera), como los muñecos. */
function outlined(b: PixelBuffer): PixelBuffer {
  const o = new PixelBuffer(b.w + 2, b.h + 2);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) o.data[(y + 1) * o.w + x + 1] = b.data[y * b.w + x]!;
  const out = o.clone();
  const ink = rgba(PAL.o!);
  for (let y = 0; y < o.h; y++)
    for (let x = 0; x < o.w; x++) {
      if (alpha(o.get(x, y))) continue;
      const near = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => alpha(o.get(x + dx!, y + dy!)));
      if (near) out.data[y * o.w + x] = ink;
    }
  return out;
}

// ---------- Los pequeños, a mano ----------

const COFRE = sprite([
  '..oooooooooooo..',
  '.oWWWWWWWWWWWWo.',
  'oWLLLLLLLLLLLLWo',
  'oWiWWWWWWWWWWiWo',
  'oiIiiiiiiiiiiIio',
  'oWiWWWWgGWWWWiWo',
  'oWiwwwwggwwwwiWo',
  'oWiwwwwwwwwwwiWo',
  'oWiwwwwwwwwwwiWo',
  'oiIiiiiiiiiiiIio',
  'owwwwwwwwwwwwwwo',
  '.oooooooooooooo.',
]);

const SANTUARIO = sprite([
  '.......oo.......',
  '......oTTo......',
  '.....oTUUTo.....',
  '....oTTTTTTo....',
  '...oSSSSSSSSo...',
  '..ooooooooooooo.',
  '...oSkkkkkkSo...',
  '...oSkkyykkSo...',
  '...oSkkYYkkSo...',
  '...oSkcccckSo...',
  '...oSSSSSSSSo...',
  '..oTTTTTTTTTTo..',
  '..oSSSMSSSSSSo..',
  '.oSSSSSSMMSSSSo.',
  '.oooooooooooooo.',
]);

const TIENDA = sprite([
  '............oo............',
  '...........oWWo...........',
  '..........occCCo..........',
  '.........occcCCCo.........',
  '........occccCCCCo........',
  '.......occcccCCCCCo.......',
  '......occccckkCCCCCo......',
  '.....occcccckkkCCCCCo.....',
  '....occcccckkkkkCCCCCo....',
  '...occcccckkkkkkkCCCCCo...',
  '..occcccckkkkkkkkkCCCCCo..',
  '.occcccckkkkkkkkkkkCCCCCo.',
  'oooooooooooooooooooooooooo',
]);

const CARRO = sprite([
  '.......oooooooooooo.......',
  '.....ooccccccccccCCoo.....',
  '....occcccccccccccCCCo....',
  '...occCcccCccccCcccCCCo...',
  '...occCcccCccccCcccCCCo...',
  '...oCCCCCCCCCCCCCCCCCCo...',
  '..oWWWWWWWWWWWWWWWWWWWWo..',
  '..oLLLLLLLLLLLLLLLLLLLLoooo',
  '..oWwwwwWwwwwwWwwwwwWwwWWWo',
  '..oooooooooooooooooooooooo.',
  '....ooooo........ooooo.....',
  '...oiWiWio......oiWiWio....',
  '...oWWiWWo......oWWiWWo....',
  '...oiWiWio......oiWiWio....',
  '....ooooo........ooooo.....',
]);

const LENA = sprite(['..oo.oo..', '.owwowwo.', 'oaaWaWaao', '.ooooooo.']);

// ---------- Los grandes, por código ----------

/** Pintor de piedra: hiladas con juntas desplazadas, luz por la izquierda y musgo abajo. */
function piedra(
  b: PixelBuffer,
  x0: number,
  y0: number,
  w: number,
  h: number,
  seed: number,
  inside: (x: number, y: number) => boolean = () => true,
): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const row = Math.floor(y / 4);
      const off = row % 2 ? 3 : 0;
      const joint = y % 4 === 3 || (x + off) % 6 === 5;
      const lit = x < w * 0.35 ? 1 : x > w * 0.75 ? -1 : 0;
      const n = hash(seed + row * 31 + Math.floor((x + off) / 6) * 7);
      let c = joint ? 's' : n < 0.25 ? 'T' : 'S';
      if (!joint && lit > 0 && n > 0.4) c = n > 0.85 ? 'U' : 'T';
      if (!joint && lit < 0) c = n < 0.5 ? 's' : 'S';
      const moss = y > h - 6 + hash(seed + x * 3) * 3 || hash(seed + x * 13 + y * 7) < 0.04;
      if (moss && !joint) c = hash(seed + x + y * 5) < 0.5 ? 'm' : 'M';
      b.set(x0 + x, y0 + y, PAL[c]!);
    }
}

/** La torre vieja: almenas mordidas, saeteras, puerta en arco y hiedra. */
function torre(): PixelBuffer {
  const W = 22;
  const H = 52;
  const b = new PixelBuffer(W, H);
  // Cuerpo algo más ancho abajo.
  const half = (y: number) => 8 + Math.round((y / H) * 2);
  piedra(b, 0, 6, W, H - 6, 11, (x, y) => Math.abs(x - W / 2 + 0.5) <= half(y + 6));
  // Almenas (una rota).
  for (let k = 0; k < 4; k++) {
    if (k === 2) continue;
    const cx = 2 + k * 5;
    const hgt = k === 3 ? 3 : 6;
    piedra(b, cx, 6 - hgt, 3, hgt, 40 + k);
  }
  // Saeteras y ventana.
  for (const [x, y, h] of [
    [10, 14, 5],
    [10, 27, 4],
  ] as const)
    for (let j = 0; j < h; j++) {
      b.set(x, y + j, PAL.k!);
      b.set(x + 1, y + j, PAL.k!);
    }
  // Puerta en arco.
  for (let y = 0; y < 11; y++)
    for (let x = -3; x <= 3; x++) {
      const yy = H - 11 + y;
      if (y < 3 && Math.abs(x) > y + 1) continue;
      b.set(10 + x, yy, PAL[Math.abs(x) === 3 || y === 0 ? 'w' : 'k']!);
    }
  // Hiedra por la derecha.
  for (let y = 18; y < H - 2; y++)
    for (let x = 14; x < W; x++)
      if (alpha(b.get(x, y)) && hash(x * 7 + y * 3) < 0.28 + (y - 18) / 90)
        b.set(x, y, PAL[hash(x + y * 9) < 0.5 ? 'f' : 'F']!);
  return outlined(b);
}

/** La boca de la cueva en un montón de roca, con matas arriba. */
function cueva(): PixelBuffer {
  const W = 40;
  const H = 26;
  const b = new PixelBuffer(W, H);
  const top = (x: number) =>
    Math.round(4 + 6 * Math.pow(Math.abs(x - W / 2) / (W / 2), 1.6) + hash(x * 3) * 2);
  piedra(b, 0, 0, W, H, 23, (x, y) => y >= top(x));
  // La boca: oscura, más negra al fondo.
  for (let y = 9; y < H; y++)
    for (let x = 12; x < 28; x++) {
      const dx = (x - 19.5) / 8;
      const dy = (H - y) / 16;
      if (dx * dx + dy * dy * 0.9 > 1) continue;
      const deep = dx * dx + dy * dy < 0.45;
      b.set(x, y, PAL[deep ? 'k' : 'a']!);
    }
  // Matas encima.
  for (let x = 6; x < W - 6; x++) {
    const t = top(x);
    if (hash(x * 5) < 0.55) b.set(x, t - 1, PAL[hash(x) < 0.5 ? 'f' : 'F']!);
    if (hash(x * 9) < 0.25) b.set(x, t - 2, PAL.F!);
  }
  return outlined(b);
}

/** Unas ruinas: un muro roto con un arco caído y una columna. */
function ruinas(): PixelBuffer {
  const W = 40;
  const H = 30;
  const b = new PixelBuffer(W, H);
  // Muro roto: alto irregular.
  const top = (x: number) =>
    Math.round(8 + Math.abs(Math.sin(x * 0.35)) * 6 + hash(x * 11) * 3 + (x > 26 ? 6 : 0));
  piedra(b, 0, 0, 30, H, 31, (x, y) => y >= top(x));
  // Hueco de un arco.
  for (let y = 14; y < H; y++)
    for (let x = 8; x < 18; x++) {
      const dx = (x - 12.5) / 5;
      const dy = Math.max(0, 19 - y) / 5;
      if (dx * dx + dy * dy <= 1) b.data[y * W + x] = 0;
    }
  // Columna suelta y su capitel.
  piedra(b, 33, 6, 5, H - 6, 77);
  piedra(b, 32, 4, 7, 2, 78);
  return outlined(b);
}

const big = new Map<string, PixelBuffer>();
const bigOf = (k: 'torre' | 'cueva' | 'ruinas') => {
  let s = big.get(k);
  if (!s) {
    s = k === 'torre' ? torre() : k === 'cueva' ? cueva() : ruinas();
    big.set(k, s);
  }
  return s;
};

/** Un dibujo plantado en el suelo por el centro de su base. */
function plant(c: Ctx, img: PixelBuffer, x: number, feet: number, left = false): void {
  put(c.b, tinted(img, c.l, c.lk), x, feet, Math.floor(img.w / 2), img.h - 1, left);
}

/** Un brillo que parpadea (el oro del cofre, la vela). */
function glint(c: Ctx, x: number, y: number, k: number): void {
  const t = (c.time * 1.3 + k) % 3;
  if (t > 0.5) return;
  const col = rgba('#fff6c8');
  const r = t < 0.25 ? 1 : 2;
  for (let d = -r; d <= r; d++) {
    if (c.b.inside(x + d, y)) c.b.set(x + d, y, col);
    if (c.b.inside(x, y + d)) c.b.set(x, y + d, col);
  }
}

/** Humo fino que sube de las brasas del campamento. */
function smoke(c: Ctx, x: number, y: number): void {
  for (let i = 0; i < 7; i++) {
    const u = (((c.time * 0.35 + i / 7) % 1) + 1) % 1;
    const sx = Math.round(x + Math.sin(u * 6 + i) * 2 + u * 4);
    const sy = Math.round(y - u * 18);
    if ((sx + sy) % 2 === 0 && c.b.inside(sx, sy)) {
      const p = c.b.data[sy * c.b.w + sx]!;
      const r = (p & 255) * 0.6 + 0.4 * 170;
      const g = ((p >> 8) & 255) * 0.6 + 0.4 * 170;
      const bl = ((p >> 16) & 255) * 0.6 + 0.4 * 175;
      c.b.data[sy * c.b.w + sx] =
        (255 << 24) | (Math.round(bl) << 16) | (Math.round(g) << 8) | Math.round(r);
    }
  }
}

/** Alguien del camino (el mercader, el viajero): una figura como las del grupo, de cara. */
function stranger(
  c: Ctx,
  seed: string,
  cls: 'picaro' | 'clerigo' | 'explorador',
  x: number,
  faceLeft: boolean,
) {
  const look = generateLook(seed, cls, hash(seed.length * 7) < 0.5 ? 'm' : 'f');
  const spr = heroSprites(look, {});
  const img = spr.idle[Math.floor(c.time * 2) % 2]!;
  shadow(c.b, x, c.e.feet, 5);
  put(c.b, tinted(img, c.l, c.lk), x, c.e.feet, 9, FEET_Y, faceLeft);
}

/** Dónde se planta lo que hay delante: unos pasos por delante del grupo. */
function ahead(c: Ctx, by: number): number {
  const n = c.m.crew.length;
  const dir = c.m.home ? -1 : 1;
  const lead = Math.round(c.e.w / 2 + (dir * (n - 1) * GAP) / 2);
  return lead + dir * by;
}

/** Lo de detrás del grupo (se pinta antes que ellos). */
export function drawSuceso(c: Ctx): void {
  const ev = c.m.event;
  if (!ev || c.m.mode !== 'wait') return;
  const left = !!c.m.home;
  const f = c.e.feet;
  switch (ev.kind) {
    case 'cofre': {
      const x = ahead(c, 20);
      shadow(c.b, x, f, 8);
      plant(c, COFRE, x, f);
      glint(c, x + 1, f - 7, 0);
      break;
    }
    case 'santuario': {
      const x = ahead(c, 24);
      plant(c, SANTUARIO, x, f - 2);
      glint(c, x, f - 10, 1.2);
      break;
    }
    case 'torre': {
      // Algo apartada del camino, más arriba (detrás), que se vea entera.
      const x = ahead(c, 36);
      plant(c, bigOf('torre'), x, f - 6, left);
      break;
    }
    case 'cueva':
      plant(c, bigOf('cueva'), ahead(c, 34), f - 4, left);
      break;
    case 'ruinas':
      plant(c, bigOf('ruinas'), ahead(c, 34), f - 4, left);
      break;
    case 'campamento': {
      const x = ahead(c, 30);
      plant(c, TIENDA, x + (left ? -6 : 6), f - 3, left);
      plant(c, LENA, x - (left ? -10 : 10), f + 1);
      smoke(c, x - (left ? -10 : 10), f - 3);
      break;
    }
    case 'mercader': {
      const x = ahead(c, 46);
      shadow(c.b, x, f, 11);
      plant(c, CARRO, x, f, !left);
      stranger(c, 'mercader-camino', 'picaro', ahead(c, 24), !left);
      break;
    }
    case 'viajero':
      stranger(c, `viajero-${c.m.seed}`, 'explorador', ahead(c, 20), !left);
      break;
    case 'oso': {
      const { art } = expFoeArt('bosque', 2);
      const x = ahead(c, 30);
      shadow(c.b, x, f, 10);
      put(
        c.b,
        tinted(art.poses[Math.floor(c.time * 1.5) % 2 ? 'idle2' : 'idle'], c.l, c.lk),
        x,
        f,
        art.foot,
        art.poses.idle.h - 1,
        !left,
      );
      break;
    }
    case 'jefe':
    case 'guardian':
      // El jefe, al otro lado; el grupo y sus matorrales, en `drawEscondite`.
      boss(c, ev.kind === 'guardian' ? 3 : (ev.foe ?? 3));
      break;
  }
}

/** El jefe a la vista, al fondo del otro lado, quieto y mirando. */
function boss(c: Ctx, idx: number): void {
  const { art } = expFoeArt('bosque', idx);
  const dir = c.m.home ? -1 : 1;
  const x = Math.round(c.e.w / 2 + dir * c.e.w * 0.3);
  const img = art.poses[Math.floor(c.time * 1.2) % 2 ? 'idle2' : 'idle'];
  shadow(c.b, x, c.e.feet, art.big ? 10 : 6);
  put(c.b, tinted(img, c.l, c.lk), x, c.e.feet, art.foot, img.h - 1, dir > 0);
}

/** Con un jefe a la vista, el grupo se esconde: ¿toca esconderse? */
export const hiding = (c: Ctx) =>
  c.m.mode === 'wait' && (c.m.event?.kind === 'jefe' || c.m.event?.kind === 'guardian');

/** Dónde se agazapa el grupo cuando se esconde (a un lado). */
export function hideX(c: Ctx, i: number): number {
  const dir = c.m.home ? -1 : 1;
  const back = Math.round(c.e.w / 2 - dir * c.e.w * 0.28);
  return back - dir * i * (GAP - 4);
}

const MATA = (() => {
  const W = 26;
  const H = 15;
  const b = new PixelBuffer(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // Tres bolas de hojas.
      const blobs = [
        [6, 9, 6.5],
        [13, 6, 7.5],
        [20, 9, 6],
      ] as const;
      let inside = false;
      let lit = 0;
      for (const [cx, cy, r] of blobs) {
        const d = Math.hypot(x - cx, (y - cy) * 1.15);
        if (d <= r + (hash(x * 13 + y * 7) - 0.5) * 1.6) {
          inside = true;
          lit = Math.max(lit, (cx - x + (cy - y)) / r);
        }
      }
      if (!inside) continue;
      const n = hash(x * 5 + y * 11);
      const ch = lit > 0.5 && n > 0.3 ? 'F' : lit > -0.2 && n > 0.25 ? 'f' : 'l';
      b.set(x, y, PAL[ch]!);
    }
  return outlined(b);
})();

const ROCA = (() => {
  const W = 14;
  const H = 9;
  const b = new PixelBuffer(W, H);
  piedra(b, 0, 0, W, H, 91, (x, y) => {
    const dx = (x - W / 2 + 0.5) / (W / 2);
    const dy = (H - y) / H;
    return dx * dx + dy * dy * 1.1 <= 1;
  });
  return outlined(b);
})();

/** Los matorrales y las rocas delante del grupo escondido (se pintan encima de ellos). */
export function drawEscondite(c: Ctx): void {
  if (!hiding(c)) return;
  const dir = c.m.home ? -1 : 1;
  const n = c.m.crew.length;
  const f = c.e.feet;
  const front = hideX(c, 0) + dir * 9;
  const mid = hideX(c, Math.max(0, n - 1) / 2);
  plant(c, MATA, mid + dir * 3, f + 3);
  plant(c, ROCA, front, f + 2);
  plant(c, MATA, hideX(c, n - 1) - dir * 4, f + 3, true);
}

/** El grupo agazapado detrás de los matorrales (en lugar de andar). */
export function drawEscondidos(c: Ctx): void {
  const dir = c.m.home ? -1 : 1;
  const crew = c.m.crew.map((x) => heroOf(x, c.m.dress?.[x.id]));
  for (let i = crew.length - 1; i >= 0; i--) {
    const h = crew[i]!;
    const spr = heroSprites(h.look, h.marks);
    const x = hideX(c, i);
    // Se asoman por turnos (uno se levanta un poco a mirar).
    const peek = Math.floor(c.time / 2.5) % crew.length === i ? 0 : 2;
    const img = spr.idle[Math.abs(Math.floor(c.time * 2 + i)) % 2]!;
    put(c.b, tinted(img, c.l, c.lk), x, c.e.feet + peek, 9, FEET_Y, dir < 0);
  }
}

export type { ExpEvent };
