/**
 * Los animales de la casa, dibujados a mano: el gato Bigotes (el de siempre, de la taberna del
 * tío) y Tizón, el perro guardián. Cada fotograma es una fila de letras (un color por letra) y
 * se le pone su contorno oscuro. Todos miran a la derecha; la escena los voltea.
 */
import { P, darker } from './palette';
import { PixelBuffer, toHex } from './pixel';

type Rows = readonly string[];

/** Un fotograma: las filas cortas se rellenan por la derecha; abajo, el contorno. */
function sprite(rows: Rows, colors: Record<string, string>): PixelBuffer {
  const w = Math.max(...rows.map((r) => r.length));
  const b = new PixelBuffer(w, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = colors[row[x]!];
      if (c) b.set(x, y, c);
    }
  });
  return b.outlined((n) => darker(toHex(n), 3));
}

/** Tira de fotogramas: `n` mirando a la derecha y, detrás, los mismos mirando a la izquierda. */
export interface Strip {
  img: PixelBuffer;
  w: number;
  h: number;
  n: number;
}

/** Pone los fotogramas uno al lado del otro, todos del mismo tamaño y con los pies abajo. */
function strip(frames: PixelBuffer[]): Strip {
  const w = Math.max(...frames.map((f) => f.w));
  const h = Math.max(...frames.map((f) => f.h));
  const n = frames.length;
  const img = new PixelBuffer(w * n * 2, h);
  frames.forEach((f, i) => {
    img.blit(f, i * w, h - f.h);
    img.blit(f, (n + i) * w + w - f.w, h - f.h, true);
  });
  return { img, w, h, n };
}

// ---------- Bigotes ----------

const CAT = { c: P.orange, C: P.brick, w: P.sand, e: P.lime, k: P.black, p: P.coral, s: P.amber };

const CAT_SLEEP = [
  '................',
  '...........c.c..',
  '....sssscc.cccc.',
  '..ccccCccccccCc.',
  '.cccCcccsccckcc.',
  '.ccCccccccccwwcc',
  '.CcccccccccwwCC.',
  'cCCCCCCCCCCCCC..',
  'cc..............',
];

/** Fotogramas del gato, en este orden en la tira. */
export const CAT_F = { sleep: 0, sit: 2, walk: 3, groom: 5 } as const;

export const catStrip = (): Strip =>
  strip([
    sprite(CAT_SLEEP, CAT),
    // Respira: la cola, un pelo más arriba.
    sprite([...CAT_SLEEP.slice(0, 7), '.CCCCCCCCCCCCC..', 'cc..............'], CAT),
    sprite(
      [
        '..........c..c..',
        '..........cccc..',
        '..........cecc..',
        '..........cccpc.',
        '.........ccww...',
        '........cccww...',
        '..c....csccww...',
        '..cc..cCcccww...',
        '...ccccCccCwC...',
        '......CC.CC.....',
      ],
      CAT,
    ),
    sprite(
      [
        '............c.c.',
        '............cccc',
        '.c..........cecp',
        '..c.........ccc.',
        '...ccccccccccw..',
        '...cCcsccsccww..',
        '...cCccccccccc..',
        '....C.c....C.c..',
        '....C.c....C.c..',
      ],
      CAT,
    ),
    sprite(
      [
        '............c.c.',
        '............cccc',
        '..c.........cecp',
        '..c.........ccc.',
        '...ccccccccccw..',
        '...cCcsccsccww..',
        '...cCccccccccc..',
        '.....Cc....cC...',
        '....C..c..C..c..',
      ],
      CAT,
    ),
    // Lavándose: sentado, con la pata en la cara.
    sprite(
      [
        '..........c..c..',
        '..........cccc..',
        '..........ckcc..',
        '.........wwccpc.',
        '.........wcww...',
        '........cccww...',
        '..c....csccww...',
        '..cc..cCcccww...',
        '...ccccCccCwC...',
        '......CC.CC.....',
      ],
      CAT,
    ),
  ]);

// ---------- Tizón ----------

/**
 * Tizón: gris ceniza claro con el hocico y las patas crema. (Oscuro o pardo, en el salón no se
 * le veía la cara: se perdía en la madera y en el fuego.)
 */
const DOG = {
  b: P.fog,
  d: P.steel,
  m: P.slate,
  l: P.sand,
  k: P.black,
  t: P.coral,
};

/** Fotogramas del perro, en este orden en la tira. */
export const DOG_F = { sleep: 0, rest: 2, bark: 4 } as const;

export const dogStrip = (): Strip =>
  strip([
    // Dormido: tumbado, la cabeza sobre las patas, la oreja caída y los ojos cerrados.
    sprite(
      [
        '',
        '',
        '',
        '................dd',
        '.......bbbbbbb.ddbb',
        '.....bbbbbbbbbbbdbbbb',
        '....bbbbbbbbbbbbbbbdbll',
        '...bbbbbbbbbbbbbbbbblllk',
        '.ddbbbbbbbbbbbbbbbllllll',
        'd..mmmmmmmmmmmmmlllllll',
      ],
      DOG,
    ),
    // Respira: el lomo, un pelo más alto.
    sprite(
      [
        '',
        '',
        '',
        '........bbbbb...dd',
        '......bbbbbbbb.ddbb',
        '.....bbbbbbbbbbbdbbbb',
        '....bbbbbbbbbbbbbbbdbll',
        '...bbbbbbbbbbbbbbbbblllk',
        '.ddbbbbbbbbbbbbbbbllllll',
        'd..mmmmmmmmmmmmmlllllll',
      ],
      DOG,
    ),
    // Despierto: la cabeza alta, la oreja tiesa y el rabo arriba.
    sprite(
      [
        '.................d',
        '................dd',
        '...............bbbb',
        '...............bkbbll',
        '.d.............bbbbllk',
        '..d............bbbll',
        '...d...bbbbbbbbbbbl',
        '....dbbbbbbbbbbbbbl',
        '....bbbbbbbbbbbbbbl',
        '...bbbbbbbbbbbbbllllll',
        '...mmmmmmmmmmmmmlllllll',
      ],
      DOG,
    ),
    // Despierto, con el rabo abajo (lo mueve).
    sprite(
      [
        '.................d',
        '................dd',
        '...............bbbb',
        '...............bkbbll',
        '...............bbbbllk',
        '...............bbbll',
        '.......bbbbbbbbbbbl',
        '....dbbbbbbbbbbbbbl',
        '...dbbbbbbbbbbbbbbl',
        '..d.bbbbbbbbbbbbllllll',
        '.d.mmmmmmmmmmmmmlllllll',
      ],
      DOG,
    ),
    // Sentado, ladrando: la boca cerrada…
    sprite(
      [
        '...............d',
        '..............dd',
        '.............bbbb',
        '.............bkbbll',
        '.............bbbbllk',
        '.............bbbll',
        '............bbbbl',
        '...........bbbbbl',
        '..........bbbbbbl',
        '.........bbbbbbll',
        '........bbbbbbbll',
        '........bbbbbbbll',
        '.dd.....bbbbbbbll',
        '...ddddmmmmmmm.ll',
      ],
      DOG,
    ),
    // …y abierta, con la lengua.
    sprite(
      [
        '...............d',
        '..............dd',
        '.............bbbb',
        '.............bkbblll',
        '.............bbbb..k',
        '.............bbbtl',
        '............bbbbl',
        '...........bbbbbl',
        '..........bbbbbbl',
        '.........bbbbbbll',
        '........bbbbbbbll',
        '...d....bbbbbbbll',
        '..d.....bbbbbbbll',
        '...ddddmmmmmmm.ll',
      ],
      DOG,
    ),
  ]);
