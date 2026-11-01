/**
 * Lo que se ve en una sala mientras dura un incidente (`data/incidents.ts`): la pelea en una
 * nube de polvo con puños y botas, el ladrón encapuchado con su saco, el recaudador con su libro,
 * el noble borracho que se tambalea, las llamas del fuego en la cocina y el charco y el cubo de
 * la gotera. Las ratas son las de las salas rotas (`art/pets.ts`). Todos miran a la derecha.
 */
import { P, R, darker } from './palette';
import { PixelBuffer, toHex } from './pixel';
import { sprite, strip, type Rows, type Strip } from './pets';

// ---------- La pelea ----------

/**
 * Tres fotogramas de la nube de polvo de la pelea: los bultos cambian de sitio y asoman
 * cabezas, puños y botas cada vez en otro lado (cada cosa con su contorno, para que se lea
 * encima de la nube).
 */
export const BRAWL_F = 3;

const BIT = {
  h: P.rust,
  y: P.gold,
  s: P.skin,
  S: P.skinS,
  k: P.black,
  r: P.red,
  l: P.ocean,
  b: P.bark,
};

const HEAD = ['.hhhh.', 'hhssss', 'hssksS', '.ssss.'];
const HEAD2 = HEAD.map((r) => r.replace(/h/g, 'y'));
const FIST = ['rrsss', 'rrssS', '..ss.'];
const BOOT = ['..ll', '..ll', 'bbbl', 'bbb.'];

const flipped = (b: PixelBuffer) => {
  const m = new PixelBuffer(b.w, b.h);
  m.blit(b, 0, 0, true);
  return m;
};

/** Lo que asoma en cada fotograma: dibujo, x, y y si va volteado. */
const BRAWL_BITS: [Rows, number, number, boolean][][] = [
  [
    [HEAD, 9, 0, false],
    [FIST, 25, 7, false],
    [BOOT, 1, 17, true],
  ],
  [
    [HEAD2, 17, 0, true],
    [FIST, 0, 8, true],
    [BOOT, 25, 17, false],
    [HEAD, 4, 3, false],
  ],
  [
    [HEAD, 6, 1, false],
    [HEAD2, 19, 0, true],
    [FIST, 25, 4, false],
    [BOOT, 3, 18, true],
  ],
];

function brawlFrame(f: number): PixelBuffer {
  const b = new PixelBuffer(32, 24);
  // La nube: unos bultos redondos que cambian un poco en cada fotograma.
  const lumps: [number, number, number][] = [
    [9, 14, 7],
    [16, 11, 8],
    [23, 14, 7],
    [12, 18, 5],
    [20, 18, 5],
    [5 + (f % 2), 12, 4],
    [27 - (f % 2), 11, 4],
    [16, 6 + (f === 1 ? 1 : 0), 5],
  ];
  for (const [cx, cy, r] of lumps)
    b.ellipse(cx, cy, r, r * 0.85, (x, y, d) =>
      d > 0.65 && y > cy ? P.fog : d > 0.6 && y < cy - 1 && x < cx ? P.white : P.mist,
    );
  // Las rayas de los golpes, dentro de la nube.
  for (let i = 0; i < 3; i++) {
    const y = 10 + i * 3;
    const x = 8 + ((f * 5 + i * 7) % 12);
    b.hline(x, y, 4, P.fog);
  }
  for (const [rows, x, y, flip] of BRAWL_BITS[f]!) {
    const one = sprite(rows, BIT);
    b.blit(flip ? flipped(one) : one, x - 1, y - 1);
  }
  return b.outlined((n) => darker(toHex(n), 3));
}

export const brawlStrip = (): Strip => strip([0, 1, 2].map(brawlFrame));

/** El taburete volcado: el asiento de canto y las tres patas al aire. */
export function toppledStool(): PixelBuffer {
  return sprite(
    [
      '..o.......',
      '..o..b....',
      '.oO.b..b..',
      '.oObbbb.b.',
      '.oO....bb.',
      '.oO.......',
      '..o.......',
    ],
    { o: P.oak, O: P.rust, b: P.bark },
  );
}

// ---------- El ladrón ----------

const THIEF = {
  c: P.leaf,
  C: P.forest,
  h: P.lime,
  f: P.skinS,
  e: P.white,
  s: P.tan,
  S: P.clay,
  g: P.gold,
  k: P.black,
  b: P.bark,
};

const THIEF_TOP: Rows = [
  '.......hhh....',
  '......hcccc...',
  '.....hccCCcc..',
  '.....hcCfefc..',
  '.....ccCfff...',
  '..gs.ccCCf....',
  '.sssscccccc...',
  'ssSsscccccccf.',
  'sSSsscccccc.f.',
  'sSSsscCcccc...',
  '.sSs.cCcccc...',
  '..s..cCccccc..',
];

/** Dos pasos de puntillas, encogido, con el saco al hombro. */
export const thiefStrip = (): Strip =>
  strip([
    sprite([...THIEF_TOP, '......cc.cc...', '.....bb...bb..', '.....k.....k..'], THIEF),
    sprite([...THIEF_TOP, '......ccccc...', '.......bbb....', '.......kk.....'], THIEF),
  ]);

// ---------- El recaudador ----------

const TAXMAN = {
  k: P.black,
  K: P.navy,
  n: P.slate,
  N: P.navy,
  s: P.skin,
  S: P.skinS,
  m: P.umber,
  w: P.white,
  g: P.gold,
  b: P.wine,
  p: P.sand,
  q: P.fog,
};

const TAXMAN_TOP: Rows = [
  '....KKKKK.....',
  '....KKKKK.....',
  '....KgggK.....',
  '...KKKKKKK....',
  '....SssssS....',
  '....sssks.....',
  '....Ssmmm.....',
  '.....sss......',
  '....wwwww.....',
  '...nnnwnnn....',
  '..nnnnwnnnn...',
  '..nNnngnnnspp.',
  '..nNnnnnnbppp.',
  '..nNnngnnbpqp.',
  '..nNnnnnnbbbb.',
  '...nnnnnnn....',
  '...nnnnnnn....',
  '...nnnnnnnn...',
  '....N...N.....',
];

/** De pie, con el sombrero alto y el libro abierto, dando golpecitos con el pie. */
export const taxmanStrip = (): Strip =>
  strip([
    sprite([...TAXMAN_TOP, '....N...N.....', '...kk...kk....'], TAXMAN),
    sprite([...TAXMAN_TOP, '....N...Nkk...', '...kk.........'], TAXMAN),
  ]);

// ---------- El noble borracho ----------

const NOBLE = {
  r: P.lemon,
  v: P.red,
  V: P.wine,
  g: P.gold,
  w: P.white,
  W: P.mist,
  s: P.skin,
  S: P.skinS,
  k: P.black,
  n: P.coral,
  j: P.oak,
  J: P.rust,
  f: P.sand,
  l: P.mist,
  b: P.bark,
};

const NOBLE_ROWS: Rows = [
  '.......rr.....',
  '......rr......',
  '....vvvvv.....',
  '...gggggggg...',
  '....SssssS....',
  '....sssks.....',
  '....ssssnn....',
  '.....sss......',
  '...wWwWwWw....',
  '..vvvvgvvvv.ff',
  '.vvVvvgvvvvjjf',
  '.vVvvvgvvvsjJj',
  '.vVvvvgvvv.jjj',
  '..Vvvvgvvv....',
  '..gvvvvvvg....',
  '...vvvvvvv....',
  '...ll..ll.....',
  '...ll..ll.....',
  '..bbb.bbb.....',
];

/** Corre cada fila de arriba hacia un lado (de pie, inclinado), con los pies quietos. */
function lean(rows: Rows, by: number): Rows {
  const h = rows.length;
  return rows.map((row, y) => {
    const d = Math.round(((h - 1 - y) / (h - 1)) * by);
    const pad = '..' + row;
    return d >= 0 ? '.'.repeat(d) + pad : pad.slice(-d);
  });
}

/** Tambaleándose: inclinado a un lado, derecho y al otro (con la jarra en la mano). */
export const NOBLE_F = { left: 0, up: 1, right: 2 } as const;

export const nobleStrip = (): Strip =>
  strip([
    sprite(lean(NOBLE_ROWS, -2), NOBLE),
    sprite(lean(NOBLE_ROWS, 0), NOBLE),
    sprite(lean(NOBLE_ROWS, 2), NOBLE),
  ]);

// ---------- El fuego ----------

export const BLAZE_W = 22;
export const BLAZE_H = 22;
export const BLAZE_F = 4;

/**
 * Las llamas del fuego de la cocina: varias lenguas que suben y bajan, blancas y amarillas en el
 * centro, rojas en las puntas. Una tira de `BLAZE_F` fotogramas (brilla sola, sin contorno).
 */
export function blazeStrip(): PixelBuffer {
  const b = new PixelBuffer(BLAZE_W * BLAZE_F, BLAZE_H);
  const F = R.fire; // [wine, red, orange, gold, lemon, white]
  for (let f = 0; f < BLAZE_F; f++) {
    const ox = f * BLAZE_W;
    for (let x = 0; x < BLAZE_W; x++) {
      // La silueta: más alta en el centro, con lenguas que cambian en cada fotograma.
      const u = (x + 0.5) / BLAZE_W;
      const body = Math.sin(u * Math.PI) ** 0.8;
      const tongue = 0.55 + 0.45 * Math.abs(Math.sin(x * 0.9 + f * 1.7) * Math.cos(x * 0.37 - f));
      const top = Math.round(BLAZE_H * (1 - body * tongue));
      for (let y = Math.max(0, top); y < BLAZE_H; y++) {
        const t = (y - top) / Math.max(1, BLAZE_H - top);
        const core = body * t;
        const c =
          t < 0.12 ? F[1]! : core < 0.25 ? F[2]! : core < 0.5 ? F[3]! : core < 0.75 ? F[4]! : F[5]!;
        b.set(ox + x, y, c);
      }
      // Alguna lengua suelta encima.
      if ((x + f * 3) % 7 === 0 && top > 3) b.set(ox + x, top - 3, F[1]!);
    }
  }
  return b;
}

// ---------- La gotera ----------

/** El charco del suelo, visto de lado: una mancha ancha y baja, con un brillo (dos fotogramas). */
export function puddleStrip(): Strip {
  const frame = (f: number) => {
    const b = new PixelBuffer(30, 4);
    b.ellipse(15, 2, 14.5, 2, (_x, _y, d) => (d > 0.6 ? P.ocean : P.sky));
    // Las ondas: un brillo que se abre desde donde cae la gota.
    const r = 2 + f * 4;
    b.hline(15 - r, 1, 2, P.cyan);
    b.hline(14 + r, 1, 2, P.cyan);
    b.set(15, 2, P.white);
    return b;
  };
  return strip([frame(0), frame(1)]);
}

/** Un cubo de madera con aros de hierro y el agua casi hasta arriba. */
export function bucket(): PixelBuffer {
  return sprite(
    [
      '.qqqqqqq.',
      'oyyyyyyyo',
      'OoooooooO',
      'mmmmmmmmm',
      'OoooooooO',
      '.Ooooooo.',
      '.mmmmmmm.',
      '.OoooooO.',
    ],
    { q: P.cyan, y: P.sky, o: P.oak, O: P.rust, m: P.steel },
  );
}

/** La mancha de humedad del techo, de donde caen las gotas. */
export function dampStain(): PixelBuffer {
  const b = new PixelBuffer(14, 4);
  b.ellipse(7, 0, 6.5, 3.5, (x, y) => ((x + y) % 2 ? P.slate : P.steel));
  b.ellipse(7, 0, 3, 2, P.navy);
  b.set(7, 2, P.sky);
  b.set(7, 3, P.sky);
  return b;
}
