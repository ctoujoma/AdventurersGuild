/**
 * Lo que se mueve en el fondo, encima de sus capas lejanas (ver `sky.ts`): de día, bandadas de
 * pájaros, el humo de las chimeneas de la aldea, las aspas del molino y la bandera del castillo;
 * de noche, luciérnagas junto a los árboles y alguna estrella fugaz. Todo sale del reloj de la
 * escena (`t`, en segundos), sin estado: se puede pintar en cualquier momento.
 */
import { P } from '../../art/palette';
import { GROUND } from '../geometry';
import { LAYER_W, flagAt, millHub, villageHouses } from '../parallax';

const hash = (a: number, b: number) => {
  let h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
  h ^= h >>> 13;
  return ((Math.imul(h, 1103515245) >>> 0) % 10000) / 10000;
};

/**
 * Las columnas de pantalla de un punto `lx` de una capa que empieza en `x0`: la capa se repite
 * a lo ancho, una copia derecha y otra en espejo (como en `tile`).
 */
function copies(x0: number, lx: number, vw: number, margin = 24): number[] {
  const w = LAYER_W;
  const out: number[] = [];
  for (let k = Math.floor((-margin - x0) / w) - 1; x0 + k * w < vw + margin; k++) {
    const at = x0 + k * w + (k % 2 === 0 ? lx : w - 1 - lx);
    if (at > -margin && at < vw + margin) out.push(at);
  }
  return out;
}

const chimneys = villageHouses()
  .filter((h) => h.chimney)
  .map((h, i) => ({ x: h.x + h.w - 2, y: h.base - h.h - 7, seed: i }));

const fireflies = Array.from({ length: 34 }, (_, i) => ({
  x: Math.floor(hash(i, 1) * LAYER_W),
  y: GROUND - 4 - Math.floor(hash(i, 2) * 34),
  phase: hash(i, 3) * 10,
  speed: 0.4 + hash(i, 4) * 0.6,
}));

export interface LifeLight {
  /** Cuánto se ve el día (0 noche – 1 día) y lo cerrada que está la noche (0–1). */
  day: number;
  dark: number;
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, c: string, w = 1, h = 1) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** En el cielo, detrás de las montañas: pájaros de día y estrellas fugaces de noche. */
export function skyLife(
  ctx: CanvasRenderingContext2D,
  skyX: number,
  top: number,
  vw: number,
  t: number,
  l: LifeLight,
): void {
  // Una bandada cada rato, que cruza de izquierda a derecha en uve, aleteando.
  const period = 46;
  const n = Math.floor(t / period);
  const u = (t % period) / period;
  if (l.day > 0.3 && hash(n, 7) < 0.8) {
    const span = vw + 160;
    const bx = -80 + u * span * 1.6 + (skyX % 40);
    const by = top + 120 + hash(n, 8) * 70 + Math.sin(t * 0.7) * 4;
    const birds = 3 + Math.floor(hash(n, 9) * 5);
    ctx.globalAlpha = Math.min(1, (l.day - 0.3) * 2);
    for (let i = 0; i < birds; i++) {
      const row = Math.ceil(i / 2);
      const side = i % 2 ? 1 : -1;
      const x = bx - row * 7;
      const y = by + side * row * 4 + Math.sin(t * 3 + i) * 1.2;
      const flap = Math.floor(t * 6 + i * 1.7) % 3;
      const c = P.navy;
      if (flap === 0) {
        px(ctx, x - 2, y - 1, c);
        px(ctx, x + 2, y - 1, c);
        px(ctx, x - 1, y, c);
        px(ctx, x + 1, y, c);
      } else if (flap === 1) px(ctx, x - 2, y, c, 5, 1);
      else {
        px(ctx, x - 2, y + 1, c);
        px(ctx, x + 2, y + 1, c);
        px(ctx, x - 1, y, c, 3, 1);
      }
      px(ctx, x, y, c);
    }
    ctx.globalAlpha = 1;
  }
  // De noche, de tarde en tarde, una estrella fugaz.
  if (l.dark > 0.4) {
    const sp = 19;
    const k = Math.floor(t / sp);
    const age = (t % sp) / 0.9;
    if (age < 1 && hash(k, 11) < 0.7) {
      const sx = hash(k, 12) * vw;
      const sy = top + 30 + hash(k, 13) * 90;
      const len = 14;
      for (let i = 0; i < len; i++) {
        const f = age * 40 - i;
        if (f < 0) continue;
        ctx.globalAlpha = (1 - i / len) * (1 - age) * l.dark;
        px(ctx, sx + f * 1.6, sy + f * 0.6, i < 2 ? P.white : P.mist);
      }
      ctx.globalAlpha = 1;
    }
  }
}

/** Encima de las colinas: humo de las chimeneas, las aspas del molino y la bandera. */
export function hillLife(
  ctx: CanvasRenderingContext2D,
  x0: number,
  top: number,
  vw: number,
  t: number,
  l: LifeLight,
): void {
  const night = l.day < 0.5;
  // El humo: bocanadas que suben, crecen, se las lleva el viento y se deshacen.
  const life = 7;
  for (const c of chimneys)
    for (const sx of copies(x0, c.x, vw)) {
      for (let i = 0; i < 6; i++) {
        const age = ((t + c.seed * 1.3 + (i * life) / 6) % life) / life;
        const size = 1 + Math.floor(age * 3);
        const x = sx + age * 9 + Math.sin(t * 1.3 + i + c.seed) * 1.2;
        const y = top + c.y - age * 16;
        ctx.globalAlpha = (1 - age) * (night ? 0.5 : 0.8);
        px(
          ctx,
          x - size / 2,
          y - size / 2,
          night ? P.slate : age < 0.3 ? P.white : P.mist,
          size,
          size,
        );
      }
    }
  ctx.globalAlpha = 1;
  // Las aspas del molino: cuatro, con su vela, girando despacio.
  const hub = millHub();
  for (const hx of copies(x0, hub.x, vw)) {
    const a0 = t * 0.9;
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k * Math.PI) / 2;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      for (let r = 1; r <= 9; r++) {
        px(ctx, hx + ux * r, top + hub.y + uy * r, night ? P.black : P.bark);
        // La vela: una tira al lado del brazo, de la mitad a la punta.
        if (r > 3 && !night)
          px(ctx, hx + ux * r - uy * 1.5, top + hub.y + uy * r + ux * 1.5, P.sand);
      }
    }
    px(ctx, hx - 1, top + hub.y - 1, night ? P.black : P.oak, 2, 2);
  }
  // La bandera del castillo, ondeando.
  const f = flagAt();
  const wave = Math.floor(t * 4) % 3;
  const rows = [
    ['rrrr..', 'rrRRrr', 'rrrr..'],
    ['rrr...', 'rrRrrr', 'rrrrr.'],
    ['rrrrr.', 'rrRRr.', 'rrr...'],
  ][wave]!;
  for (const fx of copies(x0, f.x, vw))
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        px(
          ctx,
          fx + i,
          top + f.y + j,
          night ? (ch === 'R' ? P.black : P.plum) : ch === 'R' ? P.wine : P.red,
        );
      }
    });
}

/** Junto a los árboles, de noche: luciérnagas que se encienden y se apagan, a la deriva. */
export function treeLife(
  ctx: CanvasRenderingContext2D,
  x0: number,
  top: number,
  vw: number,
  t: number,
  l: LifeLight,
): void {
  const k = Math.max(0, 1 - l.day * 1.6);
  if (k <= 0) return;
  for (const f of fireflies) {
    const glow = Math.max(0, Math.sin(t * f.speed * 2 + f.phase)) ** 3;
    if (glow < 0.05) continue;
    const dx = Math.sin(t * 0.3 * f.speed + f.phase) * 6;
    const dy = Math.cos(t * 0.4 * f.speed + f.phase * 2) * 3;
    for (const x of copies(x0, f.x, vw)) {
      ctx.globalAlpha = glow * k * 0.35;
      px(ctx, x + dx - 1, top + f.y + dy - 1, P.lime, 3, 3);
      ctx.globalAlpha = glow * k;
      px(ctx, x + dx, top + f.y + dy, glow > 0.6 ? P.lemon : P.lime);
    }
  }
  ctx.globalAlpha = 1;
}
