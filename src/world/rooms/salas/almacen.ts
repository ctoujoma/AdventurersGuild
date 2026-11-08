/**
 * Arte del almacén: guarda los materiales que traen los encargos. Cada material tiene su sitio,
 * una tarima con su letrero colgado del techo (el dibujo del material), y encima se va apilando
 * según lo lleno que esté (`look.mats`: de 0 a 1 de su tope): lingotes en pirámide, rollos de
 * cuero, fardos de tela, sacos de hierbas, tablones y una caja de cristales que brillan. Vacío, se
 * ven las tarimas; lleno, las pilas hasta arriba. En la pared, estanterías con cajas que también
 * se llenan con lo que hay. Sin almacén, `cornerPile` pone un rincón de la bodega con lo poco que
 * cabe (los tres básicos).
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import { materialIcon } from '../../../art/materials';
import type { Room } from '../../../core/model';
import { MATERIAL_LIST, type Material } from '../../../core/materials';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import {
  FREE,
  W,
  at,
  bx,
  emits,
  hung,
  spread,
  stretchesOf,
  thick,
  worldW,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { shelf, web } from './piezas';

/** Cuántos de cada cosa caben en una pila llena (lo que se dibuja, no lo que se guarda). */
const MAX: Record<Material, number> = {
  hierro: 10,
  cuero: 9,
  tela: 12,
  hierbas: 6,
  madera: 10,
  cristal: 6,
};

/** Ancho de cada pila (con su tarima). */
const PILE_W = 26;

/** La tarima de madera de debajo de cada pila (3 de alto, en la base). */
function pallet(p: PixelBuffer, w: number) {
  const y = p.h - 3;
  p.hline(0, y, w, W[5]!);
  p.hline(0, y + 1, w, W[3]!);
  for (const x of [1, Math.floor(w / 2) - 1, w - 3]) p.rect(x, y + 1, 2, 2, W[2]!);
}

/** Un lingote de 6 × 3: la cara de arriba clara, la de delante y el canto en sombra. */
function ingot(p: PixelBuffer, x: number, y: number) {
  p.hline(x + 1, y, 4, P.mist);
  p.hline(x, y + 1, 6, P.fog);
  p.hline(x, y + 2, 6, P.steel);
  p.set(x + 5, y + 1, P.steel);
  p.set(x + 1, y, P.white);
}

/** Un rollo de cuero tumbado (8 × 4), con la punta redonda y su espiral, y la cuerda. */
function roll(p: PixelBuffer, x: number, y: number) {
  p.rect(x + 2, y, 6, 4, P.clay);
  p.hline(x + 2, y, 6, P.tan);
  p.hline(x + 2, y + 3, 6, P.rust);
  // La otra punta, redondeada.
  p.clear(x + 7, y);
  p.clear(x + 7, y + 3);
  // La punta de delante: un disco con la espiral.
  p.vline(x, y + 1, 2, P.tan);
  p.vline(x + 1, y, 4, P.sand);
  p.set(x + 1, y + 1, P.rust);
  p.set(x + 1, y + 2, P.umber);
  p.vline(x + 2, y + 1, 2, P.tan);
  p.vline(x + 5, y, 4, P.bark);
}

/** Los colores de los fardos de tela, por turnos. */
const BOLTS: [string, string][] = [
  [P.red, P.wine],
  [P.sky, P.ocean],
  [P.leaf, P.forest],
  [P.sand, P.tan],
  [P.rose, P.grape],
];

/** Un fardo de tela doblada (11 × 2), con el doblez del lado. */
function bolt(p: PixelBuffer, x: number, y: number, k: number) {
  const [l, d] = BOLTS[k % BOLTS.length]!;
  p.hline(x, y, 11, l);
  p.hline(x, y + 1, 11, d);
  p.set(x + 10, y, d);
}

/** Un saco de hierbas (8 × 7), atado, con las hojas que asoman por arriba. */
function herbSack(p: PixelBuffer, x: number, y: number) {
  p.rect(x + 1, y + 2, 6, 5, P.sand);
  p.hline(x, y + 4, 8, P.sand);
  p.hline(x, y + 5, 8, P.sand);
  p.vline(x + 6, y + 2, 5, P.tan);
  p.hline(x + 1, y + 6, 6, P.tan);
  p.hline(x + 2, y + 2, 4, P.clay);
  // Las hojas.
  p.set(x + 2, y + 1, P.leaf);
  p.set(x + 4, y, P.lime);
  p.set(x + 4, y + 1, P.leaf);
  p.set(x + 5, y + 1, P.forest);
}

/** Un tablón cepillado (24 × 2) con la veta y la testa. */
function plank(p: PixelBuffer, x: number, y: number, k: number) {
  p.hline(x, y, 24, k % 2 ? P.tan : P.sand);
  p.hline(x, y + 1, 24, k % 2 ? P.oak : P.clay);
  p.set(x + 23, y, P.bark);
  p.set(x + 23, y + 1, P.bark);
  p.hline(x + 4 + ((k * 5) % 9), y, 4, P.oak);
}

/** Un cristal (3 × 5) de pie en la caja, con su luz. */
function gem(p: PixelBuffer, x: number, y: number, k: number) {
  p.vline(x + 1, y, 5, P.cyan);
  p.vline(x, y + 1, 4, P.sky);
  p.vline(x + 2, y + 1, 4, P.ocean);
  p.set(x + 1, y, P.white);
  if (k % 2) p.set(x + 1, y + 2, P.white);
}

/** Dónde va cada unidad de una pila, de abajo arriba (x, y desde la base, sin la tarima). */
function slots(m: Material): [number, number][] {
  switch (m) {
    case 'hierro': {
      const out: [number, number][] = [];
      [4, 3, 2, 1].forEach((n, r) => {
        for (let i = 0; i < n; i++) out.push([1 + r * 3 + i * 6, r * 3]);
      });
      return out;
    }
    case 'cuero':
      return [
        [1, 0],
        [9, 0],
        [17, 0],
        [1, 4],
        [9, 4],
        [17, 4],
        [5, 8],
        [13, 8],
        [9, 12],
      ];
    case 'tela':
      return Array.from({ length: 12 }, (_, i) => [i % 2 ? 14 : 1, Math.floor(i / 2) * 2]);
    case 'hierbas':
      return [
        [1, 0],
        [9, 0],
        [17, 0],
        [5, 6],
        [13, 6],
        [9, 12],
      ];
    case 'madera':
      return Array.from({ length: 10 }, (_, i) => [1 + (i % 2), i * 2]);
    case 'cristal':
      return [
        [5, 0],
        [9, 0],
        [13, 0],
        [17, 0],
        [7, 3],
        [15, 3],
      ];
  }
}

/** Unidades que se dibujan con lo lleno que está (`fill` de 0 a 1): al menos una si hay algo. */
export const unitsOf = (m: Material, fill: number) =>
  fill <= 0 ? 0 : Math.max(1, Math.min(MAX[m], Math.round(fill * MAX[m])));

/** La pila de un material con `n` unidades, sobre su tarima (los cristales, en su caja). */
export function pile(m: Material, n: number, w = PILE_W): PixelBuffer {
  const h = 27;
  return Prop.piece(w, h, (p) => {
    pallet(p, w);
    const base = h - 3;
    const ss = slots(m);
    if (m === 'cristal') {
      // La caja abierta, con los cristales asomando.
      for (let i = 0; i < n; i++) {
        const [x, y] = ss[i]!;
        gem(p, x, base - 9 - y, i);
      }
      p.rect(3, base - 6, w - 6, 6, W[4]!);
      p.hline(3, base - 6, w - 6, W[5]!);
      p.hline(3, base - 3, w - 6, W[2]!);
      p.vline(3, base - 6, 6, W[2]!);
      p.vline(w - 4, base - 6, 6, W[2]!);
      return;
    }
    for (let i = 0; i < n; i++) {
      const [x, y] = ss[i]!;
      if (m === 'hierro') ingot(p, x, base - 3 - y);
      else if (m === 'cuero') roll(p, x, base - 4 - y);
      else if (m === 'tela') bolt(p, x, base - 2 - y, i);
      else if (m === 'hierbas') herbSack(p, x, base - 7 - y);
      else plank(p, x, base - 2 - y, i);
    }
  });
}

/**
 * El letrero colgado del techo con el dibujo del material (y las cadenas). Con dos materiales
 * (las salas estrechas, que los ponen en dos filas), uno encima del otro: el de atrás arriba.
 */
function sign(m: Material, below?: Material): PixelBuffer {
  const h = below ? 44 : 26;
  return Prop.piece(
    20,
    h,
    (p) => {
      p.vline(4, 0, 6, P.steel);
      p.vline(15, 0, 6, P.steel);
      p.rect(1, 6, 18, h - 7, W[3]!);
      p.rect(2, 7, 16, h - 9, W[5]!);
      p.hline(1, 6, 18, W[4]!);
      p.blit(materialIcon(m, 16), 2, 7);
      if (!below) return;
      p.hline(2, 24, 16, W[3]!);
      p.blit(materialIcon(below, 16), 2, 25);
    },
    'black',
  );
}

/** Los materiales que caben en el almacén (los raros, solo si hay sitio para ellos), en orden. */
const kept = (look: SalonLook) => MATERIAL_LIST.filter((m) => look.mats.fill[m] !== undefined);

/** Alto del estante de carga de la fila de atrás (para que asome por encima de la de delante). */
const RACK = 20;

/** Una pila subida a un estante de carga: dos postes y una tabla gruesa. */
function onRack(top: PixelBuffer): PixelBuffer {
  return Prop.piece(
    top.w,
    top.h + RACK,
    (p) => {
      p.blit(top, 0, 0);
      const y = top.h;
      for (const x of [1, top.w - 4]) {
        p.rect(x, y, 3, RACK, W[2]!);
        p.vline(x, y, RACK, W[4]!);
      }
      p.rect(0, y - 1, top.w, 3, W[3]!);
      p.hline(0, y - 1, top.w, W[5]!);
      p.hline(4, y + RACK - 8, top.w - 8, W[2]!);
    },
    'none',
  );
}

/** Profundidad de las pilas: la fila única (o la de atrás) y la de delante. */
const BACK = FREE + 2;
const FRONT_ROW = FREE - 6;

interface Zone {
  m: Material;
  x: number;
  z: number;
  part: 0 | 1 | null;
  /** El material de la pila de delante en la misma columna (solo en las de atrás, con dos filas). */
  ahead?: Material;
}

/**
 * Dónde va cada pila en la sala (centros en x del interior), repartidas de lado a lado. Si sobra
 * sitio (las anchas), cada material tiene dos tarimas: se llena la primera y luego la segunda. Si
 * no caben en fila (una sala estrecha con los raros), en dos filas, una delante de la otra.
 */
function zones(look: SalonLook, w: number): Zone[] {
  const list = kept(look);
  const pw = worldW(pile('hierro', 0), BACK);
  const two = list.length > 0 && (w - 8) / list.length >= pw * 2 + 6;
  if (!two && list.length * pw > w - 8) {
    const cols = Math.ceil(list.length / 2);
    const xs = spread(
      4,
      w - 4,
      Array.from({ length: cols }, () => pw),
    );
    return list.map((m, i) => {
      const back = i < cols;
      const c = back ? i : i - cols;
      return {
        m,
        x: xs[c]!,
        z: back ? BACK : FRONT_ROW,
        part: null,
        ahead: back ? list[i + cols] : undefined,
      };
    });
  }
  const parts: (0 | 1 | null)[] = two ? [0, 1] : [null];
  const items = list.flatMap((m) => parts.map((part) => ({ m, part, z: BACK })));
  const xs = spread(
    4,
    w - 4,
    items.map(() => pw),
  );
  return items.map((it, i) => ({ ...it, x: xs[i]! }));
}

/** Lo lleno de una tarima: la única, o la primera mitad y luego la segunda. */
const partFill = (f: number, part: 0 | 1 | null) =>
  part === null ? f : Math.max(0, Math.min(1, f * 2 - part));

/** La pared: estanterías con cajas que se van llenando con lo que hay guardado. */
function wall(b: PixelBuffer, room: Room, look: SalonLook, { cells, ruin, top }: WallCtx): void {
  if (ruin) return;
  const w = cells.at(-1)!.x1;
  const fills = kept(look).map((m) => look.mats.fill[m] ?? 0);
  const all = fills.length ? fills.reduce((a, f) => a + f, 0) / fills.length : 0;
  for (const s of stretchesOf(room, w)) {
    const x0 = bx(s.x0) + 3;
    const x1 = bx(s.x1) - 3;
    if (x1 - x0 < 14) continue;
    // Dos tablas (tres con nivel) y cajas en ellas, más cuanto más lleno.
    const rows = room.level >= 2 ? 3 : 2;
    for (let r = 0; r < rows; r++) {
      const y = top - 4 - r * 11;
      shelf(b, x0, y, x1 - x0);
      const room_ = Math.floor((x1 - x0 - 2) / 7);
      const n = Math.round(room_ * Math.min(1, all * rows - r));
      for (let k = 0; k < n; k++) {
        const cx = x0 + 2 + k * 7;
        const tall = (k + r) % 3 === 0;
        b.rect(cx, y - (tall ? 7 : 5), 6, tall ? 7 : 5, W[4]!);
        b.hline(cx, y - (tall ? 7 : 5), 6, W[5]!);
        b.vline(cx + 5, y - (tall ? 7 : 5), tall ? 7 : 5, W[2]!);
        b.set(cx + 2, y - (tall ? 4 : 3), W[2]!);
      }
    }
  }
}

/** Las pilas de cada material, cada una con su letrero colgado (uno por material). */
function things(_room: Room, w: number, look: SalonLook): Thing[] {
  const t: Thing[] = [];
  const zs = zones(look, w);
  for (const { m, x, z, part, ahead } of zs) {
    const n = unitsOf(m, partFill(look.mats.fill[m] ?? 0, part));
    const img = ahead ? onRack(pile(m, n)) : pile(m, n);
    const it = thick(at(img, x, z), 8, 'madera');
    t.push(
      m === 'cristal' && n > 0 ? emits(it, { kind: 'glint', rate: 0.8, at: [5, 10, 21, 20] }) : it,
    );
    // El letrero, entre sus dos tarimas (o sobre la única); con dos filas, uno por columna.
    if (part === 1 || z === FRONT_ROW) continue;
    const pair = part === 0 ? zs.find((o) => o.m === m && o.part === 1) : undefined;
    t.push(hung(sign(m, ahead), pair ? (x + pair.x) / 2 : x, FREE + 6, 2));
  }
  return t;
}

/** Por reparar: tarimas rotas, una caja tirada y telarañas. */
function ruin(_room: Room, w: number): Thing[] {
  const broken = Prop.piece(PILE_W, 27, (p) => {
    pallet(p, PILE_W);
    web(p, 2, 10, 1);
  });
  return [at(broken, w * 0.3, FREE), at(Prop.crate(), w * 0.7, FREE)];
}

export const almacen: RoomArt = { wall, things, ruin };

/**
 * Sin almacén: el rincón de la bodega donde se amontona lo poco que cabe (los tres básicos, hasta
 * su tope de 10): tres columnas estrechas pegadas a la pared, de lingotes, de rollos de cuero y de
 * fardos de tela, que crecen hacia arriba. Null si no hay nada.
 */
export function cornerPile(look: SalonLook): PixelBuffer | null {
  if (look.mats.store) return null;
  const n = (['hierro', 'cuero', 'tela'] as Material[]).map((m) =>
    Math.round(Math.max(0, Math.min(1, look.mats.fill[m] ?? 0)) * 10),
  );
  if (n.every((k) => k === 0)) return null;
  const h = 36;
  const cw = 8;
  return Prop.piece(cw * 3 + 2, h, (p) => {
    pallet(p, cw * 3 + 2);
    const base = h - 3;
    // Lingotes, de pie unos sobre otros.
    for (let i = 0; i < n[0]!; i++) {
      const y = base - 3 - i * 3;
      p.hline(1, y, cw - 2, P.mist);
      p.hline(0, y + 1, cw, P.fog);
      p.hline(0, y + 2, cw, P.steel);
      p.set(cw - 1, y + 1, P.steel);
      p.set(1, y, P.white);
    }
    // Rollos de cuero, con su punta y la cuerda.
    const x1 = cw + 1;
    for (let i = 0; i < n[1]!; i++) {
      const y = base - 3 - i * 3;
      p.hline(x1, y, cw, P.tan);
      p.hline(x1, y + 1, cw, P.clay);
      p.hline(x1, y + 2, cw, P.rust);
      p.vline(x1, y, 3, P.sand);
      p.set(x1, y + 1, P.rust);
      p.vline(x1 + 5, y, 3, P.bark);
    }
    // Fardos de tela, de colores.
    const x2 = cw * 2 + 2;
    for (let i = 0; i < n[2]!; i++) {
      const [l, d] = BOLTS[i % BOLTS.length]!;
      const y = base - 3 - i * 3;
      p.hline(x2, y, cw, l);
      p.hline(x2, y + 1, cw, l);
      p.hline(x2, y + 2, cw, d);
      p.set(x2 + cw - 1, y, d);
    }
  });
}
