/**
 * Lo pequeño que da vida al bosque del visor: rayos de sol entre los árboles (en lo hondo y al
 * alba), pájaros posados en el camino que levantan el vuelo al pasar el grupo, algún conejo que
 * huye por el prado, mariposas de día, luciérnagas de noche y los anillos de la lluvia en los
 * charcos. Todo va en las coordenadas de su capa, así se mueve con su paralaje.
 */
import { PixelBuffer, bayer, rgba } from '../../art/pixel';
import { SPEED, stripLen } from './capas';
import { sunAt } from './cielo';
import type { Ctx } from './ctx';
import { pack, unpack } from './luz';
import { put, tinted } from './pintar';
import { M, clamp01, hash, smooth } from './tonos';

const sprite = (rows: string[], pal: Record<string, string>): PixelBuffer => {
  const b = new PixelBuffer(Math.max(...rows.map((r) => r.length)), rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => pal[ch] && b.set(x, y, pal[ch]!)));
  return b;
};

const BIRD_PAL = { k: '#3e2731', b: '#945a3c', w: '#e8b796', y: '#feae34' };
const BIRD = {
  sit: sprite(['.bb.', 'kbbby', 'bbw.', '.k..'], BIRD_PAL),
  peck: sprite(['....', '.bb..', 'kbbby', '.k.w.'], BIRD_PAL),
  fly1: sprite(['b...b', '.bbb.', '..by.'], BIRD_PAL),
  fly2: sprite(['.....', 'bbbbb', '..by.'], BIRD_PAL),
};
const RABBIT_PAL = { g: '#8b7a6a', G: '#5d4e44', w: '#ead4aa', k: '#181425' };
const RABBIT = {
  sit: sprite(['....g.', '...gg.', '..gggk', 'wgggg.', '.GG.G.'], RABBIT_PAL),
  hop: sprite(['.....g', '....gg', '.ggggk', 'wgggg.', 'G....G'], RABBIT_PAL),
};

/** Todo lo de este archivo, en su sitio del fotograma (tras el suelo, antes de la gente). */
export function drawVida(c: Ctx): void {
  if (c.m.terrain !== 'bosque') return;
  birds(c);
  rabbits(c);
  butterflies(c);
  fireflies(c);
  ripples(c);
}

/** Rayos de sol entre los árboles: en el bosque cerrado y al alba (encima de casi todo). */
export function drawRays(c: Ctx): void {
  if (c.m.terrain !== 'bosque') return;
  const { b, e, l, time, travel, m } = c;
  const day = 1 - l.night;
  const dawn = smooth(5.8, 6.6, l.hour) * (1 - smooth(8.2, 9.6, l.hour));
  const k =
    day *
    (1 - clamp01(l.clima.cloud * 1.2 + l.clima.rain * 2)) *
    Math.max(smooth(0.55, 0.9, m.wild) * 0.9, dawn * smooth(0.15, 0.4, m.wild));
  if (k < 0.05) return;
  const s = sunAt(e, l.hour);
  // Bajan apartándose del sol (de lado si está bajo, casi rectos a mediodía).
  const slant = ((s.x - e.w / 2) / e.w) * -1.2;
  const warm = dawn > 0.3 ? [255, 214, 160] : [250, 244, 206];
  const off = travel * SPEED.cerca;
  const n = Math.max(3, Math.round(e.w / 48));
  const span = e.w + 80;
  const y1 = e.feet + 4;
  // En el bosque abierto (el alba), los rayos salen de entre las copas, no del cielo.
  // Salen de entre las copas: arriba del todo solo si hay copas que cierran (el móvil, en lo
  // hondo); si no, desde la altura de los árboles.
  const canopy = e.ground <= 100 ? smooth(0.6, 0.9, m.wild) : 0;
  const ys = Math.round(e.hor * 0.55 * (1 - canopy));
  for (let r = 0; r < n; r++) {
    const w = 5 + Math.round(hash(r * 7 + c.seed) * 10);
    const x0 = ((((hash(r * 13 + c.seed) * span - off) % span) + span) % span) - 40;
    // Cada rayo respira despacio.
    const a = k * (0.35 + 0.25 * Math.sin(time * 0.4 + r * 1.7)) * (0.6 + hash(r * 3) * 0.4);
    for (let y = ys; y < y1; y++) {
      const fade = a * (0.4 + 0.6 * (1 - y / y1)) * Math.min(1, (y - ys) / 16);
      const xs = x0 + y * slant;
      for (let dx = 0; dx < w; dx++) {
        const x = Math.round(xs + dx);
        if (x < 0 || x >= e.w) continue;
        const edge = Math.min(dx, w - 1 - dx) / (w / 2);
        const q = Math.floor(fade * Math.min(1, edge * 1.5) * 4 + bayer(x, y) * 0.999) / 4;
        if (q <= 0) continue;
        const i = y * b.w + x;
        const [cr, cg, cb] = unpack(b.data[i]!);
        const t = q * 0.55;
        b.data[i] = pack([
          cr + (warm[0]! - cr) * t,
          cg + (warm[1]! - cg) * t,
          cb + (warm[2]! - cb) * t,
        ]);
      }
    }
  }
}

/** Pájaros posados en el camino; al acercarse el grupo, levantan el vuelo. */
function birds(c: Ctx): void {
  const { b, e, l, lk, time, travel, m } = c;
  if (l.night > 0.6 || l.clima.rain > 0.3) return;
  const L = stripLen(e.w);
  const dir = m.home ? -1 : 1;
  const lead = e.w / 2 + dir * 18;
  const groups = Math.round(L / 140);
  for (let g = 0; g < groups; g++) {
    if (hash(g * 41 + c.seed) > 0.7) continue;
    const n = 1 + Math.floor(hash(g * 43) * 3);
    for (let k = 0; k < n; k++) {
      let x = (((((g + 0.4) * L) / groups + k * 5 - travel) % L) + L) % L;
      if (x > e.w + 30) x -= L;
      const ahead = (x - lead) * dir;
      let y = e.feet - 1 + (k % 2) * 2;
      let img = Math.floor(time * 2 + k * 3 + g) % 5 === 0 ? BIRD.peck : BIRD.sit;
      let left = hash(g * 7 + k) < 0.5;
      // Se espantan: suben y se van por delante.
      if (c.walking && ahead < 26 && ahead > -80) {
        const u = (26 - ahead) / 26;
        x += dir * u * 30 + (k - 1) * u * 6;
        y -= u * u * 34 + k * u * 4;
        img = Math.floor(time * 14 + k) % 2 ? BIRD.fly1 : BIRD.fly2;
        left = dir < 0;
      }
      if (x < -6 || x > e.w + 6 || y < -6) continue;
      put(b, tinted(img, l, lk), x, y, 2, img.h - 1, left);
    }
  }
}

/** Un conejo en el prado de delante: sentado, y si el grupo se acerca, a saltos lejos. */
function rabbits(c: Ctx): void {
  const { b, e, l, lk, time, travel, m } = c;
  const p = smooth(0.05, 0.25, m.wild) * (1 - smooth(0.7, 0.9, m.wild));
  if (p <= 0 || l.night > 0.7) return;
  const L = stripLen(e.w);
  const dir = m.home ? -1 : 1;
  const lead = e.w / 2;
  for (let g = 0; g < 2; g++) {
    if (hash(g * 51 + c.seed) > p) continue;
    let x = (((((g + 0.7) * L) / 2 - travel) % L) + L) % L;
    if (x > e.w + 30) x -= L;
    const y0 = e.feet + 6 + Math.round(hash(g * 53) * Math.max(2, e.h - e.feet - 14));
    const ahead = (x - lead) * dir;
    let img = RABBIT.sit;
    let y = y0;
    if (c.walking && ahead < 50 && ahead > -60) {
      const u = (50 - ahead) / 50;
      x += dir * u * 70;
      const hop = Math.abs(Math.sin(time * 9));
      y -= hop * 3;
      img = hop > 0.3 ? RABBIT.hop : RABBIT.sit;
    } else if (Math.floor(time / 3 + g) % 2) y -= 0;
    if (x < -8 || x > e.w + 8) continue;
    put(b, tinted(img, l, lk), x, y, 3, img.h - 1, c.walking ? dir < 0 : hash(g) < 0.5);
  }
}

/** Mariposas de día, cerca de casa y en los claros. */
function butterflies(c: Ctx): void {
  const { b, e, l, time, travel, m } = c;
  if (l.night > 0.3 || l.clima.rain > 0.05 || l.clima.fog > 0.5 || m.wild > 0.7) return;
  const L = stripLen(e.w);
  const cols = ['#fee761', '#ffffff', '#f6757a', '#8fd3ff'];
  const n = Math.round(e.w / 50);
  for (let i = 0; i < n; i++) {
    const hx = (hash(i * 61 + c.seed) * L - travel) % L;
    let x = ((hx % L) + L) % L;
    if (x > e.w + 10) x -= L;
    x += Math.sin(time * 1.3 + i * 2) * 10;
    const y = e.ground + 6 + hash(i * 63) * (e.h - e.ground - 12) + Math.sin(time * 2.2 + i) * 4;
    if (x < 0 || x >= e.w) continue;
    const col = rgba(cols[i % cols.length]!);
    const open = Math.floor(time * 10 + i) % 2;
    const X = Math.round(x);
    const Y = Math.round(y);
    b.set(X, Y, rgba('#3e2731'));
    if (open) {
      b.set(X - 1, Y - 1, col);
      b.set(X + 1, Y - 1, col);
      b.set(X - 1, Y, col);
      b.set(X + 1, Y, col);
    } else {
      b.set(X, Y - 1, col);
    }
  }
}

/** Luciérnagas de noche: puntos que se encienden y se apagan a ras de hierba. */
function fireflies(c: Ctx): void {
  const { b, e, l, time, travel, m } = c;
  const k = smooth(0.4, 0.8, l.night) * smooth(0.15, 0.4, m.wild) * (l.clima.rain > 0.1 ? 0 : 1);
  if (k <= 0) return;
  const L = stripLen(e.w);
  const n = Math.round((e.w / 14) * k);
  const core = rgba('#f4ffa0');
  const halo = rgba('#6a9c3a');
  for (let i = 0; i < n; i++) {
    const ph = time * 0.7 + hash(i * 71) * 9;
    if (Math.sin(ph * 2.3) < 0.2) continue;
    let x = (((hash(i * 73 + c.seed) * L - travel * SPEED.cerca) % L) + L) % L;
    if (x > e.w + 4) x -= L;
    x += Math.sin(ph * 0.8) * 6;
    const y = e.ground - 6 + hash(i * 79) * (e.feet - e.ground + 16) + Math.sin(ph * 1.1) * 3;
    const X = Math.round(x);
    const Y = Math.round(y);
    b.set(X, Y, core);
    if (Math.sin(ph * 2.3) > 0.7) {
      b.set(X + 1, Y, halo);
      b.set(X - 1, Y, halo);
      b.set(X, Y + 1, halo);
      b.set(X, Y - 1, halo);
    }
  }
}

/** Anillos de lluvia en los charcos (los busca en la tira del suelo). */
function ripples(c: Ctx): void {
  const { b, e, l, time, travel, capas } = c;
  const r = l.clima.rain;
  if (r < 0.1) return;
  const s = capas.find((x) => x.id === 'suelo');
  if (!s) return;
  const t = s.t;
  const off = travel * s.speed;
  const lite = pack(
    [180, 196, 220].map((v, i) => v * (0.5 + 0.5 * l.tint[i]!)) as [number, number, number],
  );
  const n = Math.round(e.w * 0.6 * r);
  for (let i = 0; i < n; i++) {
    const cyc = Math.floor(time * 3 + hash(i * 3));
    const u = (time * 3 + hash(i * 3)) % 1;
    const x = Math.floor(hash(cyc * 31 + i) * e.w);
    const y = Math.floor(hash(cyc * 17 + i) * (e.h - s.y));
    const tx = ((Math.round(x + off) % t.w) + t.w) % t.w;
    if (t.d[y * t.w + tx]! >> 4 !== M.agua) continue;
    const Y = s.y + y;
    const rad = Math.round(u * 2.5);
    if (rad === 0) b.set(x, Y, lite);
    else {
      b.set(x - rad, Y, lite);
      b.set(x + rad, Y, lite);
      if (rad > 1) {
        b.set(x, Y - 1, lite);
        b.set(x, Y + 1, lite);
      }
    }
  }
}
