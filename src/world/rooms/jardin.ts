/**
 * El arte del jardín de entre el edificio y el anexo (`GardenLook`): el suelo (césped, grava o
 * losas, con un lecho bajo cada pieza), las piezas de cada trozo, el borde de delante y los
 * faroles. Las piezas van detrás de por donde cruza la gente (hasta `WALK_Z`) y el borde,
 * delante del todo y bajo, para no taparla.
 */
import { P, R } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import { Rng } from '../../core/rng';
import type { GardenEdgeId, GardenGroundId, GardenPieceId } from '../../data/custom';
import { stoneWall } from '../paint';
import { oakTree, piece, well } from '../props';

/** Profundidad del pie de las piezas de los trozos (detrás de la gente que cruza). */
export const PIECE_Z = 70;
/** Profundidad del borde de delante. */
export const EDGE_Z = 2;
/** Profundidad de los faroles, entre trozo y trozo. */
export const LAMP_Z = 50;

const W = R.wood;
const STONE = R.stone; // [black, navy, slate, steel, fog, mist]

// ---------- El suelo ----------

/**
 * Pinta sobre el césped (`lawnTex`, de `w` × `d`, a media resolución en el fondo y con la fila 0
 * al fondo) la grava o las losas, si se han elegido, y el lecho de cada pieza. `slots`: el
 * centro de cada trozo, en columnas de la textura. Lo pavimentado no llega al borde sin segar:
 * acaba antes de `lawnD` al fondo y, más allá de `open` (donde ya no hay edificios), también a
 * los lados.
 */
export function paintGround(
  b: PixelBuffer,
  ground: GardenGroundId,
  pieces: (GardenPieceId | null)[],
  slots: number[],
  open: number,
  lawnD: number,
): void {
  const { w, h: d } = b;
  const rowOf = (z: number) => d - z / 2;
  const zOf = (y: number) => (d - y) * 2;
  const rng = new Rng(`suelo-${ground}`);
  if (ground !== 'hierba') {
    const backZ = (x: number) => lawnD - 20 + Math.sin(x * 0.05) * 2;
    const paved = (x: number, y: number) => {
      const z = zOf(y);
      if (z > backZ(x)) return false;
      return z < open || (x >= 12 && x < w - 12);
    };
    for (let y = 0; y < d; y++)
      for (let x = 0; x < w; x++) {
        if (!paved(x, y)) continue;
        const edge = !paved(x - 1, y) || !paved(x + 1, y) || !paved(x, y - 1);
        b.set(x, y, edge ? STONE[2]! : ground === 'grava' ? gravel(y, rng) : flag(x, y, rng));
      }
  }
  // Los lechos: tierra, hierba o piedra bajo cada pieza.
  pieces.forEach((p, i) => {
    const cx = slots[i];
    if (!p || cx === undefined) return;
    const ellipse = (
      rx: number,
      z0: number,
      z1: number,
      fill: (x: number, y: number) => string,
    ) => {
      const cz = (z0 + z1) / 2;
      const rz = (z1 - z0) / 2;
      for (let y = Math.floor(rowOf(z1)); y <= Math.ceil(rowOf(z0)); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const k = ((x - cx) / rx) ** 2 + ((zOf(y) - cz) / rz) ** 2;
          if (k <= 1 && x >= 0 && x < w && y >= 0 && y < d)
            b.set(x, y, k > 0.78 ? fill(-1, -1) : fill(x, y));
        }
    };
    const soil = (x: number, y: number) =>
      x < 0 ? P.bark : (x * 7 + y * 3) % 11 === 0 ? P.bark : (x + y) % 5 === 0 ? P.mocha : P.umber;
    const grass = (x: number, y: number) =>
      x < 0 ? P.deep : (x * 5 + y * 7) % 9 === 0 ? P.leaf : P.forest;
    const stone = (x: number, y: number) =>
      x < 0
        ? STONE[2]!
        : (x + 2 * y) % 7 === 0
          ? STONE[2]!
          : (x * 3 + y) % 5
            ? STONE[3]!
            : STONE[4]!;
    switch (p) {
      case 'arbol':
        // Al pie del árbol, hierba (en la grava o las losas) con su alcorque de tierra.
        if (ground !== 'hierba') ellipse(26, PIECE_Z - 12, PIECE_Z + 22, grass);
        ellipse(9, PIECE_Z - 4, PIECE_Z + 6, soil);
        break;
      case 'huerto': {
        // Bancales: surcos de tierra a lo ancho, con su cerco de tablas.
        const x0 = Math.round(cx - 44);
        const x1 = Math.round(cx + 44);
        const y0 = Math.floor(rowOf(PIECE_Z + 44));
        const y1 = Math.ceil(rowOf(PIECE_Z - 14));
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) {
            if (x < 0 || x >= w || y < 0 || y >= d) continue;
            const rim = x === x0 || x === x1 || y === y0 || y === y1;
            const furrow = (y - y0) % 3 === 0;
            b.set(x, y, rim ? W[4]! : furrow ? P.ebony : soil(x, y));
          }
        break;
      }
      case 'flores':
        ellipse(38, PIECE_Z - 12, PIECE_Z + 26, soil);
        break;
      case 'fuente':
        ellipse(40, PIECE_Z - 14, PIECE_Z + 18, stone);
        break;
      case 'pozo':
        ellipse(28, PIECE_Z - 10, PIECE_Z + 12, stone);
        break;
      case 'estatua':
        ellipse(18, PIECE_Z - 8, PIECE_Z + 8, stone);
        break;
      case 'banco':
        // La hierba pisada delante del banco.
        if (ground === 'hierba') ellipse(22, PIECE_Z - 12, PIECE_Z + 2, soil);
        break;
    }
  });
}

/** Grava rastrillada: guijarros grises con las pasadas del rastrillo a lo ancho. */
function gravel(y: number, rng: Rng): string {
  const n = rng.next();
  if (n > 0.97) return STONE[5]!;
  if (n < 0.06) return STONE[2]!;
  if (y % 3 === 0 && n < 0.55) return STONE[3]!;
  return n < 0.5 ? STONE[4]! : STONE[3]!;
}

/** Losas de piedra a hiladas, con la junta oscura y algo de musgo. */
function flag(x: number, y: number, rng: Rng): string {
  const ROW = 4;
  const band = Math.floor(y / ROW);
  // Cada losa, de largo distinto según su hilada.
  const len = 16 + (band % 3) * 4;
  const off = (band * 7) % len;
  const i = Math.floor((x + off) / len);
  const joint = y % ROW === 0 || (x + off) % len === 0;
  const n = rng.next();
  if (joint) return n < 0.18 ? P.forest : STONE[1]!;
  const tone = (band * 31 + i * 17) % 3;
  const base = tone === 0 ? STONE[3]! : tone === 1 ? STONE[4]! : STONE[3]!;
  if (n > 0.94) return STONE[tone === 1 ? 5 : 4]!;
  if (n < 0.05) return STONE[2]!;
  // La luz, en el canto de delante de cada losa.
  return y % ROW === ROW - 1 ? STONE[tone === 1 ? 4 : 2]! : base;
}

// ---------- Las piezas ----------

/** Lo que va en un trozo: las figuras, de delante hacia el fondo, con su `dz` desde `PIECE_Z`. */
export function pieceArt(p: GardenPieceId, seed: string): { img: PixelBuffer; dz: number }[] {
  switch (p) {
    case 'fuente':
      return [{ img: fountain(), dz: 0 }];
    case 'pozo':
      return [{ img: well(), dz: 0 }];
    case 'arbol':
      return [{ img: oakTree(`jardin-${seed}`, 96), dz: 2 }];
    case 'estatua':
      return [{ img: statue(), dz: 0 }];
    case 'banco':
      return [{ img: bench(), dz: 0 }];
    case 'huerto':
      // Una hilera por bancal, de delante hacia el fondo.
      return [-6, 8, 22, 36].map((dz, i) => ({ img: cropRow(76, `${seed}${i}`, i), dz }));
    case 'flores':
      return [0, 12].map((dz, i) => ({ img: flowerRow(i ? 58 : 70, `${seed}${i}`), dz }));
  }
}

/** La fuente: el pilón de piedra con el agua, la columna con su taza y los chorros que caen. */
export function fountain(): PixelBuffer {
  return piece(58, 44, (b) => {
    // El pilón: el frente de sillares y el borde de arriba, más claro.
    stoneWall(b, 2, 32, 54, 12, 'pilon', { ramp: STONE, bw: 9, bh: 4, moss: 4 });
    b.ellipse(29, 32, 27, 4, STONE[4]!);
    b.ellipse(29, 32, 24, 2.6, P.ocean);
    b.ellipse(26, 31.5, 14, 1.2, P.sky);
    b.hline(5, 36, 48, STONE[1]!);
    // La columna y la taza de arriba.
    b.rect(26, 14, 6, 18, STONE[3]!);
    b.vline(26, 14, 18, STONE[4]!);
    b.vline(31, 14, 18, STONE[2]!);
    b.ellipse(29, 13, 11, 3, STONE[4]!);
    b.ellipse(29, 12.5, 9, 1.6, P.sky);
    b.rect(27, 7, 4, 5, STONE[3]!);
    b.ellipse(29, 6, 3, 2, STONE[4]!);
    // El caño de arriba y los chorros que caen de la taza al pilón.
    b.vline(29, 1, 5, P.cyan);
    b.set(29, 0, P.white);
    for (const side of [-1, 1]) {
      for (let t = 0; t <= 1; t += 0.06) {
        const x = 29 + side * (10 + 9 * t);
        const y = 13 + t * t * 18;
        b.set(Math.round(x), Math.round(y), t < 0.2 ? P.white : P.cyan);
      }
    }
    // Las salpicaduras en el agua del pilón.
    for (const x of [10, 11, 47, 48]) b.set(x, 31, P.white);
  });
}

/** La estatua: un caballero de piedra apoyado en la espada, sobre su pedestal. */
export function statue(): PixelBuffer {
  return piece(24, 58, (b) => {
    // El pedestal.
    stoneWall(b, 3, 42, 18, 16, 'pedestal', { ramp: STONE, bw: 6, bh: 4, moss: 4 });
    b.rect(1, 40, 22, 3, STONE[4]!);
    b.hline(1, 40, 22, STONE[5]!);
    // El caballero: cabeza con yelmo, capa, cuerpo y la espada delante, punta abajo.
    const s = [STONE[2]!, STONE[3]!, STONE[4]!, STONE[5]!] as const;
    b.ellipse(12, 6, 3.5, 4, s[2]);
    b.rect(10, 6, 5, 1, s[0]);
    b.rect(7, 10, 10, 4, s[2]); // hombros
    b.poly(
      [
        [6, 11],
        [18, 11],
        [19, 40],
        [5, 40],
      ],
      s[1],
    ); // la capa
    b.rect(9, 13, 6, 16, s[2]); // el cuerpo
    b.vline(9, 13, 16, s[3]);
    b.rect(9, 29, 2, 11, s[2]); // las piernas
    b.rect(13, 29, 2, 11, s[1]);
    // La espada, con las manos en el pomo.
    b.rect(11, 18, 3, 2, s[3]);
    b.hline(8, 21, 9, s[3]);
    b.rect(11, 22, 3, 17, s[3]);
    b.vline(13, 22, 17, s[1]);
    // Musgo y verdín en los pliegues.
    for (const [x, y] of [
      [6, 36],
      [18, 33],
      [10, 30],
      [7, 39],
    ] as const)
      b.set(x, y, P.forest);
  });
}

/** Banco de jardín: tablas sobre dos patas de piedra, con respaldo. */
export function bench(): PixelBuffer {
  return piece(36, 18, (b) => {
    // El respaldo.
    b.rect(4, 0, 2, 10, W[3]!);
    b.rect(30, 0, 2, 10, W[3]!);
    b.rect(3, 1, 30, 3, W[4]!);
    b.hline(3, 1, 30, W[5]!);
    b.rect(3, 5, 30, 2, W[3]!);
    // El asiento.
    b.rect(1, 9, 34, 3, W[4]!);
    b.hline(1, 9, 34, W[6]!);
    b.hline(1, 11, 34, W[2]!);
    // Las patas de piedra.
    for (const x of [3, 27]) {
      b.rect(x, 12, 6, 6, STONE[3]!);
      b.vline(x, 12, 6, STONE[4]!);
      b.hline(x, 17, 6, STONE[1]!);
    }
  });
}

/** Una hilera del huerto: coles, lechugas, zanahorias o judías en su tutor, según `kind`. */
export function cropRow(w: number, seed: string, kind: number): PixelBuffer {
  const tall = kind % 4 === 3;
  return piece(w, tall ? 18 : 9, (b) => {
    const rng = new Rng(`huerto-${seed}`);
    const h = b.h;
    for (let x = 4; x < w - 4; x += tall ? 9 : 7) {
      const px = x + rng.int(-1, 1);
      switch (kind % 4) {
        case 0: // coles
          b.ellipse(px, h - 4, 3.5, 3, (xx, yy) => (yy < h - 5 && xx < px ? P.lime : P.leaf));
          b.set(px, h - 4, P.forest);
          break;
        case 1: // lechugas
          b.ellipse(px, h - 3, 3, 2.5, (xx) => (xx % 2 ? P.lime : P.leaf));
          break;
        case 2: // zanahorias: matas de hoja fina y el hombro naranja
          for (let k = -2; k <= 2; k++) b.line(px, h - 2, px + k, h - 7 + Math.abs(k), P.leaf);
          b.set(px, h - 1, P.orange);
          break;
        default: // judías trepando por su tutor
          b.vline(px, 1, h - 1, W[4]!);
          for (let y = 2; y < h - 1; y += 2) {
            b.set(px + (y % 4 ? 1 : -1), y, P.leaf);
            if (rng.chance(0.3)) b.set(px + (y % 4 ? 2 : -2), y + 1, P.lime);
          }
      }
    }
  });
}

const BLOOM = [
  [P.red, P.coral],
  [P.lemon, P.gold],
  [P.white, P.mist],
  [P.rose, P.grape],
  [P.sky, P.ocean],
] as const;

/** Un macizo de flores: un lomo de hojas cuajado de flores de varios colores. */
export function flowerRow(w: number, seed: string, h = 11): PixelBuffer {
  return piece(w, h, (b) => {
    const rng = new Rng(`macizo-${seed}`);
    const h = b.h;
    for (let x = 2; x < w - 2; x++) {
      const top = Math.round(
        h * 0.36 + (Math.abs(x - w / 2) / (w / 2)) * h * 0.27 + rng.int(-1, 1),
      );
      for (let y = top; y < h; y++)
        b.set(x, y, y < top + 2 ? P.leaf : y > h - 3 ? P.deep : P.forest);
    }
    for (let i = 0; i < w * 0.7; i++) {
      const x = rng.int(3, w - 4);
      const y = rng.int(1, h - 4);
      if (!b.get(x, y + 1) && !b.get(x, y + 2)) continue;
      const [a, c] = BLOOM[rng.int(0, BLOOM.length - 1)]!;
      b.set(x, y, a);
      b.set(x + 1, y, c);
      b.set(x, y + 1, c);
    }
  });
}

// ---------- El borde de delante ----------

/** El borde de delante, de `w` de largo: seto recortado, flores o verja de hierro. */
export function edgeArt(e: GardenEdgeId, w: number): PixelBuffer {
  switch (e) {
    case 'seto':
      // Un seto bajo, recortado: el lomo de arriba a la luz y alguna ramita que se escapa.
      return piece(w, 7, (b) => {
        const rng = new Rng('seto');
        for (let x = 0; x < w; x++)
          for (let y = 1; y < 7; y++) {
            const n = rng.next();
            const c =
              y === 1 ? (n < 0.5 ? P.lime : P.leaf) : y < 3 ? P.leaf : n < 0.3 ? P.deep : P.forest;
            b.set(x, y, c);
          }
        for (let x = 3; x < w; x += rng.int(5, 9)) b.set(x, 0, P.leaf);
      });
    case 'flores':
      return flowerRow(w, 'borde', 8);
    case 'verja':
      return piece(
        w,
        11,
        (b) => {
          // Barrotes con punta de lanza entre dos travesaños, y pilares de piedra.
          for (let x = 2; x < w - 2; x += 6) {
            b.vline(x, 2, 9, P.navy);
            b.set(x, 1, P.slate);
            b.set(x, 0, P.steel);
          }
          b.hline(0, 3, w, P.slate);
          b.hline(0, 8, w, P.slate);
          b.hline(0, 9, w, P.navy);
          for (let x = 0; x < w; x += 62) {
            const px = Math.min(x, w - 6);
            stoneWall(b, px, 3, 6, 8, `pilar${x}`, { ramp: STONE, bw: 6, bh: 4 });
            b.rect(px - 1, 2, 8, 2, STONE[4]!);
          }
        },
        'none',
      );
  }
}
