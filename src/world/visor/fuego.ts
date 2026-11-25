/**
 * El campamento de noche: la hoguera que chisporrotea (llamas, brasas, chispas que suben y, al
 * alba, humo), petates con los que duermen, uno de guardia y, a primera hora, todos sentados en
 * troncos alrededor del fuego con el puchero. La hoguera alumbra con luz cálida que se apaga con la
 * distancia, tramada; lejos, en la oscuridad, ojos que parpadean.
 */
import { FEET_Y, clothOf, heroSprites } from '../../art/heroes/hero';
import { PixelBuffer, bayer, rgba } from '../../art/pixel';
import type { Ctx } from './ctx';
import { heroOf, shadow } from './gente';
import { pack, tintColor, unpack, warmColor, type Luz } from './luz';
import { put, tinted } from './pintar';
import { clamp01, hash, noise2 } from './tonos';

export interface Fire {
  x: number;
  y: number;
  /** Lo fuerte que arde (0 brasas, 1 llama alta). */
  power: number;
}

/** Qué toca a esa hora: velada (sentados), noche (duermen, uno de guardia) o alba. */
const campPhase = (h: number) =>
  h >= 19 && h < 22.5 ? 'velada' : h >= 5 && h < 12 ? 'alba' : 'noche';

export function drawCamp(c: Ctx): Fire {
  const { b, e, m, l, lk, time } = c;
  const fx = Math.round(e.w / 2);
  const fy = e.feet;
  const phase = campPhase(l.hour);
  const power = phase === 'velada' ? 1 : phase === 'noche' ? 0.7 : 0.35;
  const crew = m.crew.map((c) => heroOf(c, m.dress?.[c.id]));
  const n = crew.length;
  // Sitios alrededor del fuego: a un lado y a otro, cada vez más lejos.
  const spot = (i: number) => fx + (i % 2 ? 1 : -1) * (15 + Math.floor(i / 2) * 17);
  const guard = n > 1 ? Math.floor(l.hour / 2) % n : -1;
  const tc = (col: number) => tintColor(col, l);
  // La lona tendida entre dos palos, detrás de todos.
  const reach = 15 + Math.floor((n - 1) / 2) * 17 + 12;
  tarp(b, fx - reach, fx + reach, fy, l);
  // Los de detrás primero (los más apartados).
  const order = crew
    .map((_, i) => i)
    .sort((p, q) => Math.abs(spot(q) - fx) - Math.abs(spot(p) - fx));
  for (const i of order) {
    const h = crew[i]!;
    const spr = heroSprites(h.look, h.marks);
    const x = spot(i);
    const right = x > fx;
    const cloth = clothOf(h.look).field;
    if (phase === 'velada') {
      // Sentados en un tronco, mirando al fuego.
      log(b, x, fy, l);
      put(b, tinted(spr.sit, l, lk), x, fy - 3, 9, spr.sit.h - 1, right);
    } else if (i === guard) {
      // De guardia: de pie, apartado, con la vista en lo oscuro (a ratos se vuelve).
      const far = 15 + Math.ceil(n / 2) * 17 + 4;
      const gx = right ? Math.min(e.w - 10, fx + far) : Math.max(10, fx - far);
      bedroll(b, x, fy, cloth, l);
      shadow(b, gx, fy, 5);
      const blink = Math.floor(time * 3 + i * 5) % 17 === 0;
      const look = Math.floor(time / 3.5) % 3 === 0;
      const img = blink ? spr.blink : look ? spr.walk[0]! : spr.idle[Math.floor(time * 1.5) % 2]!;
      put(b, tinted(img, l, lk), gx, fy, 9, FEET_Y, look ? right : false);
    } else if (phase === 'alba' && i === (guard + 1) % n) {
      // Al alba, uno ya despierto, estirándose junto a su petate.
      bedroll(b, x, fy, cloth, l);
      const up = Math.floor(time / 1.4) % 3;
      const img = up === 0 ? spr.stretch : up === 1 ? spr.yawn : spr.idle[0];
      shadow(b, x, fy, 5);
      put(b, tinted(img, l, lk), x, fy, 9, FEET_Y, false);
    } else {
      // Dormido sentado, arropado con la manta, sobre su petate.
      sleeper(b, x, fy, spr.blink, spr.sit.h, cloth, l, lk, time, i);
    }
  }
  // La hoguera y, en la velada, el puchero en sus trébedes.
  hearth(b, fx, fy, power, time, l, l.clima.wind ?? 0);
  if (phase === 'velada') pot(b, fx, fy, time, tc);
  return { x: fx, y: fy - 3, power };
}

/**
 * La lona: dos palos con su cuerda y la tela que cae hacia atrás (se ve su cara de dentro, en
 * sombra, y el borde de delante combado), con los vientos clavados al suelo.
 */
function tarp(b: PixelBuffer, x0: number, x1: number, y: number, l: Luz) {
  const tc = (c: string) => tintColor(rgba(c), l);
  const pole = [tc('#3e2731'), tc('#5f463a')];
  // Lona de tela cruda: la cara de dentro, en sombra; el borde de delante, claro.
  const cloth = [tc('#5a4c38'), tc('#76664a'), tc('#958260'), tc('#b8a47c'), tc('#d8c49a')];
  const H = 26;
  const top = y - 4 - H;
  const w = x1 - x0;
  const back = y - 14;
  for (let x = x0 - 6; x <= x1 + 6; x++) {
    const inside = x >= x0 && x <= x1;
    const u = clamp01((x - x0) / w);
    // Por fuera de los palos, la tela baja en diagonal hasta el suelo de atrás (los costados).
    const out = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
    const ridge = Math.round(top + Math.sin(u * Math.PI) * 3 + out * 2.2);
    const bottom = back - (out ? 0 : Math.round(Math.sin(u * Math.PI) * 1));
    if (ridge > bottom) continue;
    for (let yy = ridge; yy <= bottom; yy++) {
      const v = (yy - ridge) / Math.max(1, bottom - ridge);
      let c = inside ? (v < 0.12 ? 3 : v < 0.45 ? 2 : 1) : 1;
      // Pliegues verticales que cuelgan de la cuerda.
      if (inside && v > 0.15 && Math.round((x - x0) / 5) % 2 === 0) c -= 1;
      if (yy === ridge) c = inside ? 4 : 2;
      b.set(x, yy, cloth[Math.max(0, c)]!);
    }
    // El borde de abajo, a festones.
    if (inside && (x - x0) % 5 < 3) b.set(x, bottom + 1, cloth[0]!);
  }
  // Los palos (asoman por arriba) y los vientos hasta las estacas.
  for (const px of [x0, x1]) {
    for (let yy = top - 3; yy <= y - 4; yy++) {
      b.set(px, yy, pole[1]!);
      b.set(px + 1, yy, pole[0]!);
    }
    const dir = px === x0 ? -1 : 1;
    for (let k = 0; k <= 12; k++)
      b.set(px + dir * (k + 6), top + 1 + Math.round((k / 12) * (H - 2)), pole[0]!);
  }
}

/** El tronco donde se sientan. */
function log(b: PixelBuffer, x: number, y: number, l: Luz) {
  const bark = [
    tintColor(rgba('#4f2f2d'), l),
    tintColor(rgba('#733e39'), l),
    tintColor(rgba('#945a3c'), l),
  ];
  for (let dx = -6; dx <= 6; dx++) {
    b.set(x + dx, y - 3, bark[2]!);
    b.set(x + dx, y - 2, bark[1]!);
    b.set(x + dx, y - 1, bark[0]!);
  }
  b.set(x - 7, y - 2, bark[1]!);
  b.set(x + 7, y - 2, tintColor(rgba('#d49268'), l));
}

const shades = (cloth: string, l: Luz) => {
  const [r, g, bl] = unpack(rgba(cloth));
  return {
    lite: tintColor(pack([r * 1.15 + 12, g * 1.15 + 12, bl * 1.15 + 12]), l),
    mid: tintColor(rgba(cloth), l),
    dark: tintColor(pack([r * 0.62, g * 0.62, bl * 0.72]), l),
    edge: tintColor(rgba('#181425'), l),
  };
};

/** El petate: la estera tendida en el suelo con la manta enrollada a la cabecera. */
function bedroll(b: PixelBuffer, x: number, y: number, cloth: string, l: Luz) {
  const c = shades(cloth, l);
  const mat = tintColor(rgba('#945a3c'), l);
  const matD = tintColor(rgba('#5c3a2e'), l);
  for (let dx = -9; dx <= 9; dx++) {
    b.set(x + dx, y, matD);
    b.set(x + dx, y - 1, mat);
  }
  // El rollo: un cilindro con sus vueltas.
  for (let j = 0; j < 4; j++)
    for (let dx = 0; dx < 5; dx++) {
      const X = x + 9 + dx;
      const Y = y - j;
      b.set(X, Y, j === 3 ? c.lite : j === 0 ? c.dark : dx === 4 ? c.dark : c.mid);
    }
  b.set(x + 13, y - 2, c.edge);
  b.set(x + 14, y - 1, c.edge);
}

/** Dormido sentado sobre el petate, arropado hasta los hombros, con sus «z» que suben. */
function sleeper(
  b: PixelBuffer,
  x: number,
  y: number,
  closed: PixelBuffer,
  rows: number,
  cloth: string,
  l: Luz,
  lk: string,
  time: number,
  i: number,
) {
  const c = shades(cloth, l);
  const mat = tintColor(rgba('#945a3c'), l);
  const matD = tintColor(rgba('#5c3a2e'), l);
  for (let dx = -10; dx <= 10; dx++) {
    b.set(x + dx, y, matD);
    b.set(x + dx, y - 1, mat);
  }
  // Da una cabezada de vez en cuando.
  const nod = Math.floor(time * 0.7 + i * 1.3) % 5 === 0 ? 1 : 0;
  const top = closed.crop(0, 0, closed.w, rows);
  put(b, tinted(top, l, lk), x, y - 4 + nod, 9, rows - 1, i % 2 === 1);
  // La manta: un bulto que le tapa hasta los hombros (más ancho abajo).
  const H = 10;
  for (let j = 0; j < H; j++) {
    const u = j / (H - 1);
    const half = Math.round(5 + u * 3 + (j === 0 ? -1 : 0));
    const Y = y - 2 - (H - 1 - j);
    for (let dx = -half; dx <= half; dx++) {
      const edge = Math.abs(dx) === half;
      const col = edge
        ? c.edge
        : j === 0
          ? c.lite
          : dx < -half / 3
            ? c.lite
            : dx > half / 2
              ? c.dark
              : c.mid;
      b.set(x + dx, Y, col);
    }
    // Un pliegue que baja en diagonal.
    if (j > 2 && j < H - 1) b.set(x + Math.round((j - 5) * 0.5), Y, c.dark);
  }
  for (let dx = -8; dx <= 8; dx++) b.set(x + dx, y - 2, c.dark);
  // Las zetas que suben.
  const u = (time * 0.4 + i * 0.37) % 1;
  if (u < 0.85) {
    const zx = Math.round(x + 4 + u * 6);
    const zy = Math.round(y - rows - 4 - u * 12);
    const z = tintColor(rgba('#c0cbdc'), { ...l, night: Math.min(l.night, 0.4) });
    const w = u > 0.4 ? 3 : 2;
    for (let k = 0; k < w; k++) {
      b.set(zx + k, zy, z);
      b.set(zx + k, zy + w, z);
      b.set(zx + w - 1 - k, zy + k, z);
    }
  }
}

/** Piedras, troncos cruzados, llamas, brasas, chispas y (si arde poco) humo. */
function hearth(
  b: PixelBuffer,
  x: number,
  y: number,
  power: number,
  time: number,
  l: Luz,
  wind = 0,
) {
  const stone = [tintColor(rgba('#3e4458'), l), tintColor(rgba('#727e95'), l)];
  const wood = [tintColor(rgba('#2e211d'), l), tintColor(rgba('#5f463a'), l)];
  // Los troncos cruzados.
  for (let k = -4; k <= 4; k++) {
    b.set(x + k, y - 1 - (k > 0 ? 1 : 0) + (k < -2 ? 1 : 0), wood[1]!);
    b.set(x + k, y - (k > 0 ? 1 : 0) + (k < -2 ? 1 : 0), wood[0]!);
  }
  // El cerco de piedras.
  for (const [dx, dy] of [
    [-6, 0],
    [-5, -1],
    [5, -1],
    [6, 0],
    [-3, 1],
    [3, 1],
    [0, 1],
  ] as const) {
    b.set(x + dx, y + dy, stone[0]!);
    b.set(x + dx, y + dy - 1, stone[1]!);
  }
  const fire = ['#a22633', '#e43b44', '#f77622', '#feae34', '#fee761', '#ffffff'].map((c) =>
    rgba(c),
  );
  // Brasas bajo la llama (palpitan).
  for (let k = -3; k <= 3; k++) {
    const hot = noise2(k * 0.8, time * 3, 5) > 0.5;
    b.set(x + k, y - 1, fire[hot ? 2 : 1]!);
  }
  // Las llamas: lenguas que suben y se mecen.
  const H = Math.round(4 + 7 * power);
  for (let j = 0; j < H; j++) {
    const v = j / H;
    for (let i = -4; i <= 4; i++) {
      const fl = noise2(i * 0.7 + 10, j * 0.45 - time * 9, 2);
      const sway = Math.sin(time * 5 + j * 0.6) * v * 1.4;
      const lim = (1 - v) * (3.4 + power) * (0.55 + fl * 0.75);
      const d = Math.abs(i - sway);
      if (d > lim) continue;
      const hot = (lim - d) / Math.max(0.2, lim) - v * 0.5;
      const idx = hot > 0.75 ? 4 : hot > 0.45 ? 3 : hot > 0.15 ? 2 : 1;
      b.set(x + i, y - 2 - j, fire[j < 2 && hot > 0.6 ? 5 - (j & 1) : idx]!);
    }
  }
  // Chispas que saltan y suben haciendo eses.
  for (let k = 0; k < 7; k++) {
    const sp = 0.6 + hash(k * 7) * 0.7;
    const u = (time * sp + hash(k)) % 1;
    if (u > 0.4 + power * 0.5) continue;
    const sx = Math.round(x + (hash(k * 3) - 0.5) * 6 + Math.sin(time * 4 + k * 2) * 3 * u);
    const sy = Math.round(y - 4 - u * (14 + power * 18));
    b.set(sx, sy, fire[u < 0.25 ? 4 : u < 0.5 ? 3 : 2]!);
  }
  // Humo: bocanadas grises que suben, se deshacen y se las lleva el viento (más espeso al alba,
  // cuando arde poco; tenue con la llama alta).
  {
    const thick = power < 0.6 ? 0.75 : 0.4;
    const smoke = [tintColor(rgba('#8b9bb4'), l), tintColor(rgba('#c0cbdc'), l)];
    const drift = 10 + wind * 40;
    for (let k = 0; k < 7; k++) {
      const u = (time * 0.16 + k / 7) % 1;
      const cx = x + Math.sin(u * 5 + k) * 2 + u * u * drift + u * 4;
      const cy = y - 10 - power * 6 - u * (34 - wind * 14);
      const r = 1.2 + u * 3.2;
      for (let yy = Math.floor(cy - r); yy <= cy + r; yy++)
        for (let xx = Math.floor(cx - r); xx <= cx + r; xx++) {
          if (Math.hypot(xx - cx, yy - cy) > r) continue;
          if ((1 - u) * thick > bayer(xx, yy)) b.set(xx, yy, smoke[(xx - yy) & 1 ? 0 : 1]!);
        }
    }
  }
}

/** El puchero colgado de sus trébedes, con vapor. */
function pot(b: PixelBuffer, x: number, y: number, time: number, tc: (c: number) => number) {
  const wood = tc(rgba('#5f463a'));
  for (let k = 0; k < 13; k++) {
    b.set(x - 6 + Math.round(k / 2), y - k, wood);
    b.set(x + 6 - Math.round(k / 2), y - k, wood);
  }
  const iron = [tc(rgba('#181425')), tc(rgba('#3a4466')), tc(rgba('#5a6988'))];
  b.set(x, y - 12, iron[1]!);
  b.set(x, y - 11, iron[1]!);
  for (let j = 0; j < 4; j++)
    for (let i = -3 + (j === 3 ? 1 : 0); i <= 3 - (j === 3 ? 1 : 0); i++)
      b.set(x + i, y - 10 + j, i < -1 ? iron[2]! : i > 1 ? iron[0]! : iron[1]!);
  const steam = tc(rgba('#c0cbdc'));
  for (let k = 0; k < 3; k++) {
    const u = (time * 0.5 + k / 3) % 1;
    b.set(Math.round(x - 1 + k + Math.sin(u * 6 + k) * 1.5), Math.round(y - 12 - u * 9), steam);
  }
}

/**
 * La luz de la hoguera: calienta lo que hay alrededor, menos cuanto más lejos y con su temblor;
 * en escalones tramados (no un degradado liso). Lejos, en lo oscuro, ojos que parpadean.
 */
export function fireLight(c: Ctx, f: Fire): void {
  const { b, e, l, time, m } = c;
  const strength = clamp01(l.night * 1.2 + 0.15) * (0.6 + f.power * 0.4);
  const R = (e.w > 200 ? 92 : 66) * (0.72 + f.power * 0.28);
  const flick =
    Math.sin(time * 13) * 1.6 + Math.sin(time * 7.3 + 1) * 1.2 + Math.sin(time * 23) * 0.6;
  const cache = new Map<number, number>();
  const y0 = Math.max(0, Math.floor(f.y - R * 0.75));
  const y1 = Math.min(e.h, Math.ceil(f.y + R * 0.6));
  for (let y = y0; y < y1; y++)
    for (let x = Math.max(0, Math.floor(f.x - R)); x < Math.min(e.w, f.x + R); x++) {
      const dx = x - f.x;
      const dy = (y - f.y) * 1.45;
      const d = Math.sqrt(dx * dx + dy * dy);
      const v = 1 - d / (R + flick);
      if (v <= 0) continue;
      // Escalones: 4 niveles, tramados en el paso de uno a otro.
      const q = Math.min(4, Math.floor(v * 4.6 + bayer(x, y) * 0.9));
      if (q <= 0) continue;
      const i = y * b.w + x;
      const col = b.data[i]!;
      const key = (col ^ (q * 0x9e3779b1)) >>> 0;
      let out = cache.get(key);
      if (out === undefined) {
        out = warmColor(col, l, (q / 4) * strength);
        cache.set(key, out);
      }
      b.data[i] = out;
    }
  // Ojos en la oscuridad (más cuanto más lejos de casa).
  if (l.night < 0.5) return;
  const n = Math.round(1 + m.wild * 4);
  const gold = rgba('#feae34');
  const red = rgba('#e43b44');
  for (let k = 0; k < n; k++) {
    const cyc = Math.floor(time / 6 + hash(k * 3) * 6);
    if (hash(cyc * 13 + k) < 0.3) continue;
    // Abren y cierran: un parpadeo cada poco, y al final del ciclo se van.
    const u = (time / 6 + hash(k * 3) * 6) % 1;
    if (u < 0.08 || u > 0.92 || Math.floor(time * 2.3 + k * 1.7) % 7 === 0) continue;
    const side = hash(cyc * 7 + k) < 0.5 ? -1 : 1;
    const ex = Math.round(f.x + side * (R + 6 + hash(cyc * 5 + k) * (e.w / 2 - R - 12)));
    const ey = Math.round(e.ground - 2 + hash(cyc * 11 + k) * (e.feet - e.ground - 4));
    if (ex < 2 || ex > e.w - 4) continue;
    const col = m.wild > 0.6 && k % 3 === 0 ? red : gold;
    b.set(ex, ey, col);
    b.set(ex + 3, ey, col);
  }
}

/** Qué toca en el campamento a esa hora (velada, noche o alba). */
export const campPhaseAt = campPhase;
