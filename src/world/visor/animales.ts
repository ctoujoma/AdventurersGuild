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
import { biomaIdOf, type BiomaId } from './bioma';

export type Where = 'cielo' | 'sierra' | 'colinas' | 'medio' | 'cerca';

export function drawAnimals(c: Ctx, where: Where): void {
  const bio = biomaIdOf(c.m.terrain);
  if (where === 'cielo') {
    if (bio === 'bosque') crows(c);
    else if (bio === 'marismas') crows(c, GARZA_FLY, 0.5);
    else if (bio === 'sierra') {
      // Un águila, chovas en bandada que juegan con el viento y, arriba del todo, el quebrantahuesos.
      soar(c, 1, AGUILA);
      crows(c, CHOVA, 1.5, 0.95);
      if (c.m.wild > 0.55) quebranta(c);
    } else soar(c, 3, BUITRE);
  } else if (where === 'medio') deer(c, HERD[bio]);
  else if (where === 'cerca') {
    if (bio === 'marismas') wisps(c);
    else wolves(c, bio === 'ruinas' ? JACKAL : WOLF);
    if (bio === 'sierra') marmots(c);
  }
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

interface Herd {
  male: Record<string, PixelBuffer>;
  female: Record<string, PixelBuffer>;
}
/** Otros pelajes con el mismo dibujo: cabras (ruinas). */
function herdOf(pal: Record<string, string>, horns: (r: string) => string): Herd {
  const male: Record<string, PixelBuffer> = {};
  const female: Record<string, PixelBuffer> = {};
  for (const [k, rows] of Object.entries(DEER_ROWS)) {
    male[k] = sprite(rows.map(horns), pal);
    female[k] = sprite(rows.map(horns), pal);
  }
  return { male, female };
}
// Cuernos cortos en gancho (la fila de arriba fuera; la segunda, los ganchos).
const hooks = (r: string) => r.replace(/a\.a/g, '.a.').replace(/^\.{10}a\.\.$/, '.........a..');

// El rebeco, con su dibujo: más pequeño y recio que el ciervo, pardo con la raya del lomo
// oscura, la cara clara con el antifaz negro y los cuernos en gancho (mirando a la derecha).
const REBECO_PAL = {
  o: '#7a5236',
  O: '#4f3324',
  t: '#a07048',
  w: '#e8d8b8',
  k: '#181425',
  a: '#181425',
};
const REBECO_ROWS: Record<string, string[]> = {
  graze: [
    '...........',
    '...........',
    '...........',
    '...........',
    'kOOOOOOOO..',
    'ooooooooooa',
    '.ottttttowk',
    '.k.k...kkw.',
    '.k.k...k...',
  ],
  look: [
    '........a..',
    '........aa.',
    '.......wkw.',
    '.......wwkk',
    'kOOOOOOOw..',
    'ooooooooo..',
    '.otttttto..',
    '.k.k...k.k.',
    '.k.k...k.k.',
  ],
  run1: [
    '.........a.',
    '.........aa',
    '........wkw',
    'k.......wwk',
    'OOOOOOOOo..',
    'ooooooooo..',
    '.ottttto...',
    'k.......k..',
    '.........k.',
  ],
  run2: [
    '...........',
    '.........a.',
    '.........aa',
    '........wkw',
    'kOOOOOOOwwk',
    'ooooooooo..',
    '.ottttto...',
    '..kk..kk...',
    '..k....k...',
  ],
};
const REBECO: Herd = { male: {}, female: {} };
for (const [k, rows] of Object.entries(REBECO_ROWS)) {
  REBECO.male[k] = sprite(rows, REBECO_PAL);
  // La hembra, con los cuernos más finos (un gancho de un píxel).
  REBECO.female[k] = sprite(
    rows.map((r) => r.replace('aa', 'a.')),
    REBECO_PAL,
  );
}
const CABRA = herdOf(
  {
    o: '#b8946a',
    O: '#86603c',
    t: '#d4b48a',
    w: '#ece0c8',
    k: '#3e2731',
    a: '#5a4636',
    e: '#181425',
  },
  hooks,
);
const HERD: Record<BiomaId, Herd | null> = {
  bosque: { male: DEER, female: DOE },
  sierra: REBECO,
  marismas: null,
  ruinas: CABRA,
};

// Rapaces que planean en círculos (alas abiertas, alguna batida).
const RAPTOR_ROWS = [
  ['k.........k', '.kk.....kk.', '..kkkhkkk..', '....kyk....'],
  ['...........', 'kkk.....kkk', '..kkkhkkk..', '....kyk....'],
];
const AGUILA = RAPTOR_ROWS.map((r) => sprite(r, { k: '#3e2731', h: '#c28569', y: '#feae34' }));
const BUITRE = RAPTOR_ROWS.map((r) =>
  sprite(
    r.map((x) => x.replace(/h/g, 'w')),
    { k: '#2e211d', w: '#ead4aa', y: '#c28569' },
  ),
);
const GARZA_FLY = [
  sprite(['w.......', '.ww..ww.', '..wwwwwy', '..g.....'], {
    w: '#dfe6ee',
    g: '#8b9bb4',
    y: '#feae34',
  }),
  sprite(['........', '..wwww..', 'gwwwwwwy', '........'], {
    w: '#dfe6ee',
    g: '#8b9bb4',
    y: '#feae34',
  }),
  sprite(['........', '...ww...', '.gwwwwwy', 'ww....ww'], {
    w: '#dfe6ee',
    g: '#8b9bb4',
    y: '#feae34',
  }),
];

// Chovas: negras, con el pico amarillo y las patas rojas.
const CHOVA_PAL = { k: '#181425', n: '#262b44', y: '#fee761', r: '#e43b44' };
const CHOVA = [
  sprite(['k....k', '.k..k.', '..kkky', '...r..'], CHOVA_PAL),
  sprite(['......', '..kk..', 'kkkkky', '...r..'], CHOVA_PAL),
  sprite(['......', '...k..', '.kkkky', 'kk..kk'], CHOVA_PAL),
];

// El quebrantahuesos: alas largas y estrechas, la cola en cuña y el pecho rojizo.
const QUEBRANTA_PAL = { k: '#2e211d', K: '#4f3324', w: '#ead4aa', h: '#c28569' };
const QUEBRANTA = [
  sprite(
    [
      'kk.............kk',
      '.kkKk.......kKkk.',
      '...kkKkkhwkKkk...',
      '......khhhk......',
      '.......kKk.......',
      '........k........',
    ],
    QUEBRANTA_PAL,
  ),
  sprite(
    [
      '.................',
      'kkkKk.......kKkkk',
      '...kkKkkhwkKkk...',
      '......khhhk......',
      '.......kKk.......',
      '........k........',
    ],
    QUEBRANTA_PAL,
  ),
];

/** El quebrantahuesos: planea muy alto, despacio y en línea, casi sin batir. */
function quebranta(c: Ctx): void {
  const { b, e, l, lk, time } = c;
  if (l.night > 0.5 || (l.clima.storm ?? 0) > 0.5) return;
  // Pasa de tarde en tarde: cada 40 s, a veces.
  const cyc = Math.floor(time / 40);
  if (hash(cyc * 13 + c.seed + 7) > 0.6) return;
  const u = (time % 40) / 40;
  const ltr = hash(cyc * 5 + 1) < 0.5;
  const x = ltr ? -20 + u * (e.w + 40) : e.w + 20 - u * (e.w + 40);
  const y = e.hor * (0.18 + hash(cyc * 3) * 0.12) + Math.sin(time * 0.4) * 3;
  const flap = Math.floor(time * 4) % 31 < 2 ? 1 : 0;
  put(b, tinted(QUEBRANTA[flap]!, l, lk), x, y, 8, 3, !ltr);
}

// La marmota: sentada en alto junto a su madriguera (con el montón de tierra), asomando o metida.
const MARMOTA_PAL = {
  g: '#9a7448',
  G: '#5f4630',
  l: '#d8b98a',
  k: '#181425',
  m: '#7a5a40',
  d: '#3e2c22',
};
const MARMOTA: Record<string, PixelBuffer> = {
  up: sprite(
    ['..gG..', '.ggkl.', '..gll.', '..ggl.', '.gggl.', '.gGgl.', 'mmGGmm', 'dmmmmd'],
    MARMOTA_PAL,
  ),
  // Silbando: la boca abierta y la cabeza algo alta.
  silba: sprite(
    ['..gG..', '.ggkl.', '..gkl.', '..ggl.', '.gggl.', '.gGgl.', 'mmGGmm', 'dmmmmd'],
    MARMOTA_PAL,
  ),
  peek: sprite(
    ['......', '......', '......', '......', '..gG..', '.ggkl.', 'mmggmm', 'dmmmmd'],
    MARMOTA_PAL,
  ),
  hole: sprite(
    ['......', '......', '......', '......', '......', '......', '.mddm.', 'dmmmmd'],
    MARMOTA_PAL,
  ),
};

/**
 * Marmotas en los pastos altos: asoman, se sientan a mirar y, si el grupo se acerca, silban (la
 * alarma) y se meten en la madriguera hasta que ha pasado.
 */
function marmots(c: Ctx): void {
  const { b, e, l, lk, time, travel, m } = c;
  const p = smooth(0.3, 0.5, m.wild) * (1 - smooth(0.92, 1, m.wild));
  if (p <= 0 || l.night > 0.4 || (l.clima.snow ?? 0) > 0.3) return;
  const L = stripLen(e.w);
  const off = travel * SPEED.cerca;
  const groups = Math.round(L / 90);
  for (let g = 0; g < groups; g++) {
    if (hash(g * 41 + c.seed + 3) > p * 0.8) continue;
    const wx = (g + 0.2 + hash(g * 43) * 0.6) * (L / groups);
    const n = 1 + Math.floor(hash(g * 47) * 2.4);
    for (let k = 0; k < n; k++) {
      let x = ((Math.round(wx + k * 9 - off) % L) + L) % L;
      if (x > e.w + 8) x -= L;
      if (x < -8 || x > e.w + 8) continue;
      const near = Math.abs(x - e.w / 2);
      let pose: string;
      if (c.walking && near < 34) pose = 'hole';
      else if (c.walking && near < 80) pose = Math.floor(time * 3 + k) % 4 === 0 ? 'up' : 'silba';
      else {
        const per = 7 + hash(g * 5 + k) * 5;
        const u = (time / per + hash(g * 7 + k)) % 1;
        pose = u < 0.25 ? 'hole' : u < 0.35 || u > 0.92 ? 'peek' : 'up';
        if (pose === 'up' && Math.floor(time * 0.8 + k * 3) % 11 === 0) pose = 'silba';
      }
      const img = tinted(MARMOTA[pose]!, l, lk);
      put(b, img, x, e.ground + 3 + (k % 2) * 2, 3, img.h - 1, hash(g * 9 + k) < 0.5);
    }
  }
}

function soar(c: Ctx, n: number, frames: PixelBuffer[]): void {
  const { b, e, l, lk, time } = c;
  if (l.night > 0.5 || (l.clima.storm ?? 0) > 0.5) return;
  for (let i = 0; i < n; i++) {
    const r = e.w * (0.12 + hash(i * 3 + c.seed) * 0.08);
    const cx = e.w * (0.55 + hash(i * 5 + c.seed) * 0.3) + Math.sin(time * 0.05) * 20;
    const cy = e.hor * (0.3 + hash(i * 7) * 0.15);
    const a = time * (0.35 + hash(i * 11) * 0.1) + i * 2.1;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.25;
    const flap = Math.floor(time * 5 + i) % 23 < 2 ? 1 : 0;
    put(b, tinted(frames[flap]!, l, lk), x, y, 5, 2, Math.sin(a) > 0);
  }
}

/** Fuegos fatuos: luces verdosas que flotan sobre el agua de noche. */
function wisps(c: Ctx): void {
  const { b, e, l, time, travel, m } = c;
  const p = l.night * smooth(0.3, 0.8, m.wild);
  if (p <= 0.1) return;
  const L = stripLen(e.w);
  const off = travel * SPEED.cerca;
  const core = rgba('#d8f8c8');
  const halo = rgba('#5ac88a');
  for (let i = 0; i < 6; i++) {
    if (hash(i * 31 + c.seed) > p) continue;
    const x = ((Math.round(hash(i * 7) * L - off + Math.sin(time * 0.4 + i) * 8) % L) + L) % L;
    if (x > e.w + 4) continue;
    const y = Math.round(e.ground - 2 - hash(i * 3) * 10 + Math.sin(time * 1.3 + i * 2) * 3);
    if (Math.floor(time * 2 + i * 1.7) % 7 === 0) continue;
    b.set(x, y, core);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      b.set(x + dx, y + dy, halo);
  }
}

const WOLF_PAL = { g: '#727e95', G: '#3e4458', l: '#a9b4c4', k: '#181425' };
const JACKAL_PAL = { g: '#b08a5a', G: '#6e5236', l: '#dcc49a', k: '#181425' };
// Sentado de perfil (mirando a la derecha) y aullando con el hocico al cielo.
const WOLF_SIT = [
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
];
const WOLF_HOWL = [
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
];
const WOLF = {
  sit: sprite(WOLF_SIT, WOLF_PAL),
  howl: sprite(WOLF_HOWL, WOLF_PAL),
};
const JACKAL = {
  sit: sprite(WOLF_SIT, JACKAL_PAL),
  howl: sprite(WOLF_HOWL, JACKAL_PAL),
};

// ---------- Cuervos ----------

function crows(c: Ctx, frames: PixelBuffer[] = CROW, flap = 1, often = 0.75): void {
  const { b, e, l, lk, time } = c;
  if (l.night > 0.6) return;
  // Cada 16 s puede pasar una bandada (de 2 a 4), de un lado a otro.
  const cyc = Math.floor(time / 16);
  if (hash(cyc * 7 + c.seed) > often) return;
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
    const f = Math.floor(time * 7 * flap + i * 2) % 4;
    const img = frames[f === 3 ? 1 : f]!;
    put(b, tinted(img, l, lk), x, y, img.w >> 1, img.h - 1, !ltr);
  }
}

// ---------- Ciervos ----------

function deer(c: Ctx, herd: Herd | null): void {
  if (!herd) return;
  const { b, e, l, lk, time, travel, m } = c;
  // Salen a media lejanía: ni junto a las casas ni en lo más hondo del bosque.
  const w = m.wild;
  const p =
    herd === REBECO ? smooth(0.2, 0.4, w) : smooth(0.1, 0.3, w) * (1 - smooth(0.75, 0.95, w));
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
      const set = k === 0 && hash(g * 17) < 0.6 ? herd.male : herd.female;
      const img = tinted(set[pose]!, l, lk);
      const facing = scared ? dir < 0 : hash(g * 19 + k) < 0.5;
      put(b, img, x, e.ground + 1 + (k % 2), 6, img.h - 1, facing);
    }
  }
}

// ---------- Lobos ----------

function wolves(c: Ctx, W: typeof WOLF = WOLF): void {
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
      // De noche cerrada, de los lobos solo se ven los ojos (que parpadean).
      if (l.night > 0.6) {
        if (Math.floor(time * 1.3 + k * 2.7 + g) % 6 === 0) continue;
        const ey = e.ground - 3 + (k % 2) - k;
        b.set(x, ey, eye);
        b.set(x + 2, ey, eye);
        continue;
      }
      // Uno aúlla a ratos (la cabeza al cielo); los otros, sentados, miran.
      const howl = k === 0 && (time / 5 + g) % 2 < 0.8;
      const img = tinted(howl ? W.howl : W.sit, l, lk);
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
