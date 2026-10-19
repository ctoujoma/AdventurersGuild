/**
 * Muebles de cada sala para la vista 3D: qué figura plana va, a qué distancia del plano de
 * corte y qué da luz. Todo en coordenadas de la sala (x desde la pared de la izquierda, z hacia
 * el fondo, y desde el suelo hacia arriba); la escena los coloca en el mundo. Arte provisional
 * (los muebles de la taberna de siempre); el definitivo llega sala por sala.
 */
import { P } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import type { Building, Room } from '../../core/model';
import { itemIcon } from '../../art/items';
import type { GearView } from '../annex';
import { stoneWall } from '../paint';
import * as Prop from '../props';
import { DEPTH } from './layout';
import {
  NO_LOOK,
  bar,
  barrels,
  hearth as salonHearth,
  larder,
  logPile,
  stage,
  tableSet,
  type SalonLook,
} from './salon';

export type RGB = [number, number, number];

export interface Glow {
  /** Altura sobre la base de la figura y alcance de la luz, en píxeles del mundo. */
  dy: number;
  r: number;
  color: RGB;
  /** Fuerza (1 = farol) y cuánto tiembla (0 quieta, 0,3 fuego). */
  power: number;
  flicker: number;
  /** Llamas que se ven bailar (fuego de chimenea, fogón o velas). */
  flames?: { dx: number; dy: number; size: number }[];
}

export interface Thing {
  img: PixelBuffer;
  /** Centro en x, profundidad y altura de la base sobre el suelo. */
  x: number;
  z: number;
  y: number;
  /** Colgado del techo (y se cuenta desde el techo hacia abajo hasta su parte de arriba). */
  hang?: boolean;
  light?: Glow;
}

export const LANTERN: RGB = [255, 196, 120];
const WARM: RGB = [255, 168, 92];
const FIRE: RGB = [255, 132, 60];
const FORGE: RGB = [255, 110, 44];
const CANDLE: RGB = [255, 210, 140];
const GOLD: RGB = [254, 200, 80];

/**
 * Dónde se guarda el equipo sin dueño: en la armería (colgado si está en uso, en arcones si
 * está por reparar o en obras) y, si no hay armería, en arcones en la cámara del tesoro.
 */
export function gearRoom(b: Building): string | null {
  const arm = b.rooms.filter((r) => r.type === 'armeria');
  const r = arm.find(inUse) ?? arm[0] ?? b.rooms.find((x) => x.type === 'tesoro');
  return r?.id ?? null;
}

/** Huecos para colgar equipo en cada estante de la armería, por nivel. */
const RACK_SLOTS = [0, 4, 8, 8];

/** Estante de pared con el equipo colgado (con su rareza) y clavijas en los huecos libres. */
function gearRack(items: readonly GearView[], slots: number): PixelBuffer {
  const cols = 4;
  const rows = Math.ceil(slots / cols);
  const w = cols * 14 + 4;
  const h = rows * 15 + 3;
  return Prop.piece(w, h, (b) => {
    b.rect(0, 0, w, h, P.bark);
    b.rect(1, 1, w - 2, h - 2, P.rust);
    for (let r = 0; r < rows; r++) b.hline(1, 2 + r * 15 + 13, w - 2, P.oak);
    for (let i = 0; i < slots; i++) {
      const x = 2 + (i % cols) * 14;
      const y = 2 + Math.floor(i / cols) * 15;
      const it = items[i];
      if (it) b.blit(itemIcon(it.icon, it.rarity), x, y);
      else b.rect(x + 5, y + 5, 2, 2, P.oak);
    }
  });
}

/** Arcones apilados con el equipo que no cabe (o no se puede colgar): uno por cada tres. */
function chestPile(
  add: (img: PixelBuffer, x: number, z: number, y?: number) => void,
  n: number,
  x0: number,
  dir: 1 | -1,
) {
  const count = Math.min(6, Math.ceil(n / 3));
  for (let i = 0; i < count; i++) {
    const row = i < 3 ? 0 : 1;
    const k = row ? i - 3 : i;
    add(Prop.chest(), x0 + dir * (k * 18 + row * 9), MID, row * 11);
  }
}

/** Contra la pared del fondo, a media sala y delante. */
const WALL = DEPTH - 6;
const MID = DEPTH / 2;
const FRONT = 12;

const fire = (dy: number, r: number, color: RGB, big: boolean): Glow => ({
  dy,
  r,
  color,
  power: 0.85,
  flicker: 0.3,
  flames: big
    ? [
        { dx: -4, dy: 0, size: 1 },
        { dx: 3, dy: 1, size: 0.8 },
      ]
    : [{ dx: 0, dy: 0, size: 0.6 }],
});

const slot = (w: number, i: number, n: number) => 10 + ((i + 0.5) * (w - 20)) / n;

/** Si la sala está en uso (ni rota ni en obras): solo entonces tiene sus muebles. */
const inUse = (room: Room) => room.level > 0 && !(room.works && room.works.kind !== 'extend');

/** Mesas del salón: dónde va cada una y sus dos taburetes. */
function tables(room: Room, w: number): { x: number; z: number }[] {
  const n = Math.max(1, room.w * 2 - 1);
  return Array.from({ length: n }, (_, i) => ({
    x: 92 + ((i + 0.5) * (w - 150)) / n,
    z: i % 2 ? MID - 4 : FRONT + 6,
  }));
}

/** Un sitio donde sentarse: el taburete (centro en x y profundidad). */
export interface Seat {
  x: number;
  z: number;
}

export function seats(room: Room, w: number): Seat[] {
  if (room.type !== 'salon' || !inUse(room)) return [];
  return tables(room, w).flatMap((t) => [
    { x: t.x - 18, z: t.z - 2 },
    { x: t.x + 18, z: t.z + 2 },
  ]);
}

/**
 * Una cama: la litera (dos camas, `row` 0 arriba y 1 abajo) o el catre de la enfermería, con
 * el centro del mueble en x, su profundidad y la fila de la almohada dentro de su dibujo.
 */
export interface Bed {
  kind: 'litera' | 'catre' | 'jergon';
  x: number;
  z: number;
  /** Fila (desde arriba del dibujo) donde empieza el colchón. */
  top: number;
  level: number;
}

/** Literas de una litera: el colchón de arriba y el de abajo, en filas del dibujo. */
export const BUNK_ROWS = [6, 26] as const;

export function beds(room: Room, w: number): Bed[] {
  if (!inUse(room)) return [];
  if (room.type === 'servicio' && room.level < 2) {
    // Jergones de paja en el suelo, uno por cama.
    const n = bunkCount(room, w);
    return Array.from({ length: n }, (_, i) => ({
      kind: 'jergon' as const,
      x: slot(w, i, n),
      z: WALL,
      top: 0,
      level: room.level,
    }));
  }
  if (room.type === 'dormitorio' || room.type === 'veteranos' || room.type === 'servicio') {
    const n = bunkCount(room, w);
    const level = room.type === 'veteranos' ? 3 : room.level;
    return Array.from({ length: n }, (_, i) =>
      BUNK_ROWS.map((top) => ({ kind: 'litera' as const, x: slot(w, i, n), z: WALL, top, level })),
    ).flat();
  }
  if (room.type === 'enfermeria') {
    const n = cotCount(room);
    return Array.from({ length: n }, (_, i) => ({
      kind: 'catre' as const,
      x: slot(w, i, n),
      z: i % 2 ? MID : FRONT + 4,
      top: 3,
      level: room.level,
    }));
  }
  return [];
}

/**
 * Literas (o jergones) de un dormitorio. El del servicio tiene dos camas por hueco y nivel:
 * dos jergones por hueco al principio y, desde el nivel 2, tantas literas como el nivel.
 */
const bunkCount = (room: Room, w: number) =>
  Math.min(
    room.type === 'servicio'
      ? room.w * (room.level < 2 ? 2 : room.level)
      : room.w * (room.level >= 2 ? 2 : 1),
    Math.floor(w / 30),
  );
const cotCount = (room: Room) => Math.min(3, room.level + room.w - 1);

/** Muebles de una sala de ancho `w` (interior). */
export function furnish(room: Room, w: number, look: SalonLook = NO_LOOK): Thing[] {
  const t: Thing[] = [];
  const add = (img: PixelBuffer, x: number, z: number, y = 0, light?: Glow) =>
    t.push({ img, x, z, y, light });
  const slot3 = (i: number, n: number) => slot(w, i, n);
  if (room.works && room.works.kind !== 'extend') {
    if (look.gearRoom === room.id && look.gear.length) chestPile(add, look.gear.length, 20, 1);
    // Obra: herramientas y material por el suelo.
    add(Prop.crate(), slot3(0, 3), MID);
    add(Prop.sack(), slot3(2, 3), FRONT);
    add(planks(), slot3(1, 3), WALL);
    return t;
  }
  // El equipo sin dueño, en arcones si la sala donde se guarda no está para colgarlo.
  const gear = look.gearRoom === room.id ? look.gear : [];
  if (room.level === 0) {
    if (gear.length) chestPile(add, gear.length, 20, 1);
    add(Prop.brokenChair(), slot3(0, 3), FRONT);
    add(Prop.rolledCarpet(), slot3(1, 3), MID);
    add(Prop.crate(), slot3(2, 3), WALL);
    return t;
  }
  const cells = room.w;
  const lvl = room.level;
  // Farol del techo en cada sala que se usa.
  t.push({
    img: lamp(),
    x: w / 2,
    z: MID,
    y: 0,
    hang: true,
    light: { dy: 4, r: Math.max(80, Math.round(w * 0.7)), color: LANTERN, power: 1, flicker: 0.08 },
  });
  switch (room.type) {
    case 'recibidor':
      add(bench(), 24, WALL - 4);
      add(Prop.armorStand(), w - 18, WALL);
      add(Prop.barrel(), 14, FRONT);
      break;
    case 'salon': {
      const decor = look.decor;
      const big = decor.includes('chimenea');
      add(bar(lvl, decor.includes('barril')), 44, WALL - 16);
      add(barrels(), 17, FRONT + 4);
      add(
        salonHearth(lvl, look.crest, big),
        w - 40,
        WALL + 2,
        0,
        fire(10, big ? 120 : 90, FIRE, true),
      );
      add(logPile(), w - 13, WALL - 12);
      if (look.dog) add(Prop.dog(false), w - 46, FRONT + 6);
      if (decor.includes('tarima')) add(stage(), w - 94, WALL - 2);
      t.push({ img: larder(), x: 84, z: WALL - 8, y: 0, hang: true });
      tables(room, w).forEach(({ x: tx, z }, i) => {
        const cards = i === 0 && decor.includes('naipes');
        const candle = lvl >= 2 && !cards;
        add(
          tableSet(`${room.id}-${i}`, lvl >= 3, candle, cards),
          tx,
          z,
          0,
          candle ? { dy: 18, r: 34, color: CANDLE, power: 0.45, flicker: 0.12 } : undefined,
        );
        add(Prop.stool(), tx - 18, z - 2);
        add(Prop.stool(), tx + 18, z + 2);
      });
      if (room.h > 1 || lvl >= 3 || decor.includes('lampara'))
        t.push({
          img: Prop.chandelier(),
          x: w / 2 + 20,
          z: MID,
          y: 0,
          hang: true,
          light: { dy: 4, r: 120, color: WARM, power: 0.9, flicker: 0.06 },
        });
      break;
    }
    case 'cocina':
      add(oven(), 26, WALL + 2, 0, fire(12, 70, FIRE, false));
      add(Prop.smallTable(), w / 2 + 6, MID);
      add(Prop.sack(), w - 26, WALL);
      add(Prop.barrel(), w - 12, WALL - 6);
      add(Prop.crate(), w - 30, FRONT);
      break;
    case 'bodega': {
      const n = Math.min(3, cells * 2);
      for (let i = 0; i < n; i++) add(Prop.cask(), slot(w, i, n), WALL);
      if (lvl >= 2) add(Prop.wineRack(), w - 30, WALL - 14);
      add(Prop.barrel(), w - 16, FRONT);
      break;
    }
    case 'tesoro': {
      const n = Math.min(4, lvl + cells);
      for (let i = 0; i < n; i++) add(Prop.chest(i % 2 === 1), slot(w, i, n), i % 2 ? MID : FRONT);
      // Sin armería, el equipo sin dueño también se guarda aquí.
      if (gear.length) chestPile(add, gear.length, w - 24, -1);
      add(Prop.sack(), 14, WALL, 0, {
        dy: 4,
        r: 50,
        color: GOLD,
        power: 0.5,
        flicker: 0.05,
      });
      break;
    }
    case 'dormitorio':
    case 'veteranos':
    case 'servicio': {
      const n = bunkCount(room, w);
      for (let i = 0; i < n; i++) {
        const straw = room.type === 'servicio' && lvl < 2;
        add(
          straw ? Prop.strawMat() : Prop.bunk(room.type === 'veteranos' ? 3 : lvl),
          slot(w, i, n),
          WALL,
        );
        if (!straw && i % 2 === 0) add(Prop.trunk(), slot(w, i, n), FRONT + 4);
      }
      break;
    }
    case 'enfermeria': {
      const n = cotCount(room);
      for (let i = 0; i < n; i++) add(Prop.cot(), slot(w, i, n), i % 2 ? MID : FRONT + 4);
      add(Prop.cabinet(lvl >= 3), w - 18, WALL);
      add(Prop.washbasin(), 12, WALL);
      break;
    }
    case 'capilla': {
      add(Prop.smallTable(), w / 2, WALL);
      add(candles(), w / 2, WALL - 1, 14, {
        dy: 8,
        r: 60,
        color: CANDLE,
        power: 0.8,
        flicker: 0.15,
        flames: [-5, 0, 5].map((dx) => ({ dx, dy: 1, size: 0.3 })),
      });
      const n = Math.min(3, cells + 1);
      for (let i = 0; i < n; i++) add(bench(), slot(w, i, n), FRONT + 2);
      break;
    }
    case 'mapas':
      add(Prop.desk(), w / 2 + 10, MID);
      add(Prop.chair(), w / 2 + 40, MID - 6);
      add(Prop.trunk(), 18, WALL);
      break;
    case 'armeria': {
      add(Prop.armorStand(), 14, WALL);
      if (lvl >= 2) add(Prop.armorStand(), w - 14, WALL);
      // Un estante por hueco con el equipo colgado; lo que no cabe, en arcones.
      const per = RACK_SLOTS[Math.min(lvl, 3)]!;
      for (let c = 0; c < cells; c++)
        add(gearRack(gear.slice(c * per, (c + 1) * per), per), slot(w, c, cells), WALL, 22);
      const extra = gear.length - per * cells;
      if (extra > 0) chestPile(add, extra, w - 24, -1);
      else add(Prop.crate(), w / 2, FRONT);
      break;
    }
    case 'forja':
      add(hearth(true), 20, WALL + 2, 0, fire(10, 70, FORGE, false));
      add(anvil(), w / 2 + 6, MID);
      add(Prop.barrel(), w - 14, FRONT);
      break;
    case 'despensa':
      add(Prop.cheeseShelf(), 20, WALL);
      add(Prop.sack(), w / 2, MID);
      add(Prop.crate(), w - 16, FRONT);
      break;
    case 'armas':
      add(Prop.armorStand(), 14, WALL);
      add(dummy(), w / 2 + 10, MID);
      break;
    case 'tiro':
      add(Prop.crate(), w - 18, WALL);
      add(dummy(), w - 40, WALL - 8);
      break;
    case 'biblioteca':
      add(Prop.bookshelf(), 18, WALL);
      add(Prop.bookshelf(), w - 18, WALL);
      add(Prop.desk(), w / 2, MID);
      break;
    case 'torre':
      break;
  }
  return t;
}

// ---------- Figuras que no están en la taberna de siempre ----------

export function lamp(): PixelBuffer {
  return Prop.piece(
    7,
    16,
    (p) => {
      p.vline(3, 0, 8, P.black);
      p.rect(1, 8, 5, 7, P.black);
      p.rect(2, 9, 3, 5, P.gold);
      p.set(3, 10, P.lemon);
      p.hline(0, 15, 7, P.black);
    },
    'none',
  );
}

function bench(): PixelBuffer {
  return Prop.piece(28, 9, (p) => {
    p.rect(0, 0, 28, 3, P.oak);
    p.hline(0, 0, 28, P.clay);
    p.rect(2, 3, 3, 6, P.bark);
    p.rect(23, 3, 3, 6, P.bark);
  });
}

function oven(): PixelBuffer {
  return Prop.piece(34, 40, (p) => {
    stoneWall(p, 0, 6, 34, 34, 'horno', {
      ramp: [P.black, P.navy, P.slate, P.steel, P.fog],
      bw: 6,
      bh: 5,
    });
    p.rect(4, 0, 26, 6, P.slate);
    p.ellipse(17, 26, 9, 8, P.black);
    p.rect(9, 26, 16, 10, P.black);
    p.rect(11, 29, 12, 6, P.orange);
    p.hline(12, 28, 10, P.gold);
    p.set(14, 30, P.lemon);
  });
}

function hearth(forge: boolean): PixelBuffer {
  return Prop.piece(30, 32, (p) => {
    stoneWall(p, 0, 0, 30, 32, forge ? 'fragua' : 'fogon', {
      ramp: [P.black, P.navy, P.slate, P.steel, P.fog],
      bw: 6,
      bh: 4,
    });
    p.rect(6, 14, 18, 14, P.black);
    p.rect(8, 21, 14, 6, forge ? P.orange : P.red);
    p.hline(9, 20, 12, P.gold);
  });
}

function anvil(): PixelBuffer {
  return Prop.piece(18, 12, (p) => {
    p.rect(2, 0, 14, 4, P.slate);
    p.hline(2, 0, 14, P.fog);
    p.rect(6, 4, 6, 4, P.navy);
    p.rect(3, 8, 12, 4, P.bark);
  });
}

function candles(): PixelBuffer {
  return Prop.piece(
    13,
    6,
    (p) => {
      for (const x of [1, 6, 11]) p.vline(x, 1, 5, P.sand);
    },
    'none',
  );
}

export function dummy(): PixelBuffer {
  return Prop.piece(12, 32, (p) => {
    p.rect(5, 2, 3, 30, P.bark);
    p.rect(0, 8, 12, 3, P.oak);
    p.ellipse(6, 4, 4, 4, P.sand);
    p.ellipse(6, 15, 5, 7, P.tan);
    p.hline(1, 15, 10, P.rust);
  });
}

function planks(): PixelBuffer {
  return Prop.piece(30, 8, (p) => {
    for (let i = 0; i < 3; i++) {
      p.rect(i * 2, i * 3, 26, 2, i % 2 ? P.oak : P.clay);
      p.hline(i * 2, i * 3, 26, P.tan);
    }
  });
}
