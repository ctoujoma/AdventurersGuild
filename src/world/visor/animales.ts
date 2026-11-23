/**
 * Los animales del visor: cuervos que cruzan el cielo, ciervos pastando a media distancia (que
 * levantan la cabeza y huyen si el grupo pasa cerca) y, lejos de casa al anochecer, lobos en lo
 * alto de las colinas (sentados, uno aullando). Van en las coordenadas de su capa, así se mueven
 * con su paralaje.
 */
import { PixelBuffer, rgba } from '../../art/pixel';
import { SPEED, stripLen } from './capas';
import type { Ctx } from './ctx';
import { put, tinted } from './pintar';
import { hash, smooth } from './tonos';

export type Where = 'cielo' | 'sierra' | 'colinas' | 'medio' | 'cerca';

export function drawAnimals(c: Ctx, where: Where): void {
  if (where === 'cielo') crows(c);
  else if (where === 'medio') deer(c);
  else if (where === 'cerca') wolves(c);
}

// ---------- Dibujos ----------

const sprite = (rows: string[], pal: Record<string, string>): PixelBuffer => {
  const b = new PixelBuffer(Math.max(...rows.map((r) => r.length)), rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => pal[ch] && b.set(x, y, pal[ch]!)));
  return b;
};

const CROW_PAL = { k: '#181425', n: '#262b44', s: '#3a4466', y: '#feae34' };
const CROW = [
  sprite(['k.....k', '.kk.kk.', '..kkkky', '...n...'], CROW_PAL),
  sprite(['.......', '..knk..', 'kkkkkky', 'k..n..k'], CROW_PAL),
  sprite(['.......', '...nk..', '.kkkkky', 'kk...kk'], CROW_PAL),
];

const DEER_PAL = {
  o: '#945a3c',
  O: '#733e39',
  t: '#b86f50',
  w: '#ead4aa',
  k: '#3e2731',
  a: '#c28569',
  e: '#181425',
};
// Mirando a la derecha. Pastando, con la cabeza alta, y corriendo (dos tiempos).
const DEER_ROWS: Record<string, string[]> = {
  graze: [
    '.............',
    '.............',
    '.............',
    'w............',
    'wooooooo.....',
    'oottttooO....',
    '.oooooooOo...',
    '.o.o...oOok..',
    '.o.o...o..ok.',
    '.k.k...k.....',
  ],
  look: [
    '.........a.a.',
    '..........a..',
    '.........ooo.',
    'w........oeok',
    'wooooooooo...',
    'oottttooo....',
    '.oooooooo....',
    '.o.o...o.o...',
    '.o.o...o.o...',
    '.k.k...k.k...',
  ],
  run1: [
    '.........a.a.',
    '..........a..',
    '.........ooo.',
    'ww.......oeok',
    '.woooooooo...',
    '.ottttoooo...',
    'oooooooooo...',
    'o.......oo...',
    'k.........o..',
    '...........k.',
  ],
  run2: [
    '.............',
    '.........a.a.',
    '..........a..',
    'w........ooo.',
    'wooooooooeok.',
    'oottttooo....',
    '.oooooooo....',
    '..oo...oo....',
    '..k.o..k.o...',
    '.....k....k..',
  ],
};
const DEER: Record<string, PixelBuffer> = {};
const DOE: Record<string, PixelBuffer> = {};
for (const [k, rows] of Object.entries(DEER_ROWS)) {
  DEER[k] = sprite(rows, DEER_PAL);
  // La cierva, sin cuernas.
  DOE[k] = sprite(
    rows.map((r) => r.replace(/a/g, '.')),
    DEER_PAL,
  );
}

const WOLF_PAL = { g: '#727e95', G: '#3e4458', l: '#a9b4c4', k: '#181425' };
// Sentado de perfil (mirando a la derecha) y aullando con el hocico al cielo.
const WOLF = {
  sit: sprite(
    [
      '..........g.g.',
      '..........ggg.',
      '.........gglgk',
      '.........gggg.',
      '........gggl..',
      '.......ggggl..',
      '..g...gggggg..',
      '.gg..gggggGg..',
      'gg..ggggGgGg..',
      '.ggggGGG.G.G..',
    ],
    WOLF_PAL,
  ),
  howl: sprite(
    [
      '............k',
      '...........gg',
      '..........gg.',
      '.........ggl.',
      '........ggggl',
      '.......ggggl.',
      '..g...gggggg.',
      '.gg..gggggGg.',
      'gg..ggggGgGg.',
      '.ggggGGG.G.G.',
    ],
    WOLF_PAL,
  ),
};

// ---------- Cuervos ----------

function crows(c: Ctx): void {
  const { b, e, l, lk, time } = c;
  if (l.night > 0.6) return;
  // Cada 16 s puede pasar una bandada (de 2 a 4), de un lado a otro.
  const cyc = Math.floor(time / 16);
  if (hash(cyc * 7 + c.seed) > 0.75) return;
  const u = (time % 16) / 9;
  if (u > 1) return;
  const ltr = hash(cyc * 3) < 0.5;
  const n = 2 + Math.floor(hash(cyc * 5) * 3);
  const y0 = e.hor * (0.25 + hash(cyc * 11) * 0.45);
  for (let i = 0; i < n; i++) {
    const lag = i * 0.06 + hash(cyc + i) * 0.03;
    const v = u - lag;
    if (v < 0) continue;
    const x = ltr ? -10 + v * (e.w + 20) : e.w + 10 - v * (e.w + 20);
    const y = y0 + i * 3 + Math.sin(time * 2 + i) * 2 - (i % 2) * 4;
    const f = Math.floor(time * 7 + i * 2) % 4;
    const img = CROW[f === 3 ? 1 : f]!;
    put(b, tinted(img, l, lk), x, y, 3, 3, !ltr);
  }
}

// ---------- Ciervos ----------

function deer(c: Ctx): void {
  const { b, e, l, lk, time, travel, m } = c;
  // Salen a media lejanía: ni junto a las casas ni en lo más hondo del bosque.
  const w = m.wild;
  const p = smooth(0.1, 0.3, w) * (1 - smooth(0.75, 0.95, w));
  if (p <= 0 || l.night > 0.8) return;
  const L = stripLen(e.w);
  const off = travel * SPEED.medio;
  const dir = m.home ? -1 : 1;
  const lead = e.w / 2 + dir * 20;
  const groups = Math.round(L / 110);
  for (let g = 0; g < groups; g++) {
    if (hash(g * 13 + c.seed) > p) continue;
    const wx = (g + 0.3 + hash(g * 7) * 0.4) * (L / groups);
    const n = 1 + Math.floor(hash(g * 3 + 1) * 3);
    for (let k = 0; k < n; k++) {
      let x = (((wx + k * 11 - off) % L) + L) % L;
      if (x > e.w + 20) x -= L;
      // Se asustan cuando el grupo se les acerca: corren por delante hasta salir del cuadro.
      const ahead = (x - lead) * dir;
      const scared = c.walking && ahead < 46 && ahead > -60;
      let pose = 'graze';
      if (scared) {
        const run = 46 - ahead;
        x += dir * run * 2.2;
        pose = Math.floor(time * 10 + k) % 2 ? 'run1' : 'run2';
      } else {
        // Pastan; a ratos alzan la cabeza.
        const t = (time / 2.3 + hash(g * 5 + k) * 7) % 3;
        pose = t < 0.8 ? 'look' : 'graze';
      }
      if (x < -16 || x > e.w + 16) continue;
      const set = k === 0 && hash(g * 17) < 0.6 ? DEER : DOE;
      const img = tinted(set[pose]!, l, lk);
      const facing = scared ? dir < 0 : hash(g * 19 + k) < 0.5;
      put(b, img, x, e.ground + 1 + (k % 2), 6, img.h - 1, facing);
    }
  }
}

// ---------- Lobos ----------

function wolves(c: Ctx): void {
  const { b, e, l, lk, time, travel, m } = c;
  const dusk = smooth(17, 18.5, l.hour) + (l.hour < 5 ? 1 : 0);
  const p = smooth(0.45, 0.8, m.wild) * Math.min(1, dusk);
  if (p <= 0) return;
  // En la linde del bosque, al pie de los árboles (se mueven con ellos).
  const L = stripLen(e.w);
  const off = travel * SPEED.cerca;
  const groups = Math.max(1, Math.round(L / 180));
  const eye = rgba('#feae34');
  for (let g = 0; g < groups; g++) {
    if (hash(g * 23 + c.seed + 5) > p) continue;
    const wx = (g + 0.62) * (L / groups);
    const n = 1 + Math.floor(hash(g * 29) * 3);
    for (let k = 0; k < n; k++) {
      let x = ((Math.round(wx + k * 15 - off) % L) + L) % L;
      if (x > e.w + 10) x -= L;
      if (x < -10 || x > e.w + 10) continue;
      // Uno aúlla a ratos (la cabeza al cielo); los otros, sentados, miran.
      const howl = k === 0 && (time / 5 + g) % 2 < 0.8;
      const img = tinted(howl ? WOLF.howl : WOLF.sit, l, lk);
      const left = x > e.w / 2;
      const y = e.ground + 2 + (k % 2);
      put(b, img, x, y, 6, img.h - 1, left);
      // Los ojos, que brillan con la última luz.
      if (!howl && l.night > 0.25 && Math.floor(time * 1.7 + k * 3) % 9) {
        const ex = left ? x - 5 : x + 5;
        b.set(ex, y - img.h + 3, eye);
      }
    }
  }
}
