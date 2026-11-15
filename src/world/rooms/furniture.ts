/**
 * Muebles de cada sala para la vista 3D: qué figura plana va, a qué distancia del plano de
 * corte y qué da luz. Todo en coordenadas de la sala (x desde la pared de la izquierda, z hacia
 * el fondo, y desde el suelo hacia arriba); la escena los coloca en el mundo. El salón se monta
 * aquí; las demás salas ponen sus muebles desde su fichero de `salas/`.
 */
import { P } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import type { Building, Room } from '../../core/model';
import * as Prop from '../props';
import { ruinThings } from './ruina';
import { PITCH, ROOM_H, SLAB } from './layout';
import { BACK, scaleAt } from './view3d';
import { ART } from './salas';
import { bedsOf } from './salas/camas';
import { cotsOf } from './salas/enfermeria';
import { cloth } from './salas/tintes';
import { salonTint } from './salas/acabados';
import { galleryOf, galleryThings } from './galeria';

/** Los manteles del salón, granates (o del tema de la sala). */
const VINO = [P.plum, P.wine, P.red, P.coral] as const;
import {
  CANDLE,
  FIRE,
  LANTERN,
  FRONT,
  MID,
  WALL,
  WARM,
  ceilingGlow,
  chandelier,
  at,
  fire,
  hung,
  thick,
  wallLight,
  type Bed,
  type Glow,
  type Thing,
} from './salas/kit';
import {
  HEARTH_RIGHT,
  HEARTH_Z,
  NO_LOOK,
  HEARTH_SCONCES,
  HEARTH_SCONCE_Y,
  bar,
  crystalChandelier,
  nook,
  hearth as salonHearth,
  larder,
  logPile,
  salonSconces,
  seat,
  stage,
  tableSet,
  type SalonLook,
} from './salon';

export type { Bed, Glow, RGB, Thing } from './salas/kit';
export { LANTERN } from './salas/kit';

/**
 * Dónde se guarda el equipo sin dueño: en la armería (colgado si está en uso, en arcones si
 * está por reparar o en obras) y, si no hay armería, en arcones en la cámara del tesoro.
 */
export function gearRoom(b: Building): string | null {
  const arm = b.rooms.filter((r) => r.type === 'armeria');
  const r = arm.find(inUse) ?? arm[0] ?? b.rooms.find((x) => x.type === 'tesoro');
  return r?.id ?? null;
}

/** Cadena de la que cuelga la lámpara grande. */
function chain(h: number): PixelBuffer {
  return Prop.piece(
    3,
    h,
    (b) => {
      for (let y = 0; y < h; y++) b.set(1, y, y % 3 === 2 ? P.steel : P.slate);
    },
    'none',
  );
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

const slot = (w: number, i: number, n: number) => 10 + ((i + 0.5) * (w - 20)) / n;

/** Si la sala está en uso (ni rota ni en obras): solo entonces tiene sus muebles. */
const inUse = (room: Room) => room.level > 0 && !(room.works && room.works.kind !== 'extend');

/** Fondo de la fila de mesas del salón (las de atrás, 6 más). */
const TABLE_Z = 5;

/** Mesas del salón: dónde va cada una y sus dos taburetes. */
function tables(room: Room, w: number): { x: number; z: number }[] {
  const n = Math.max(1, room.w * 2 - 1);
  return Array.from({ length: n }, (_, i) => ({
    x: 92 + ((i + 0.5) * (w - 150)) / n,
    // Muy delante, como lo de la puerta: la gente pasa por detrás, entre las mesas y lo de la
    // pared (la barra, la chimenea o la escalera de la galería). Al tresbolillo, pero poco.
    z: i % 2 ? TABLE_Z + 6 : TABLE_Z,
  }));
}

/** Un sitio donde sentarse: el taburete (centro en x y profundidad; `up`, plantas por encima). */
export interface Seat {
  x: number;
  z: number;
  up?: number;
}

export function seats(room: Room, w: number): Seat[] {
  if (room.type !== 'salon' || !inUse(room)) return [];
  const gal = galleryOf(room, w);
  return [
    ...tables(room, w).flatMap((t) => [
      { x: t.x - 18, z: t.z - 2 },
      { x: t.x + 18, z: t.z + 2 },
    ]),
    // Los de la galería, en la planta de arriba.
    ...(gal?.seats.map((s) => ({ ...s, up: 1 })) ?? []),
  ];
}

export function beds(room: Room, w: number): Bed[] {
  if (!inUse(room)) return [];
  if (room.type === 'dormitorio' || room.type === 'veteranos' || room.type === 'servicio')
    return bedsOf(room, w);
  if (room.type === 'enfermeria') return cotsOf(room, w);
  return [];
}

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
  const art = ART[room.type];
  if (room.level === 0) {
    // Encima de lo que deja cada sala, el daño (viga caída, escombro, agujero del techo).
    const damage = room.type === 'torre' ? [] : ruinThings(room, w);
    // (Las salas con su arte guardan ellas mismas el equipo en arcones.)
    if (art?.ruin) return [...t, ...art.ruin(room, w, look), ...damage];
    if (gear.length) chestPile(add, gear.length, 20, 1);
    add(Prop.brokenChair(), slot3(0, 3), FRONT);
    add(Prop.rolledCarpet(), slot3(1, 3), MID);
    add(Prop.crate(), slot3(2, 3), WALL);
    return [...t, ...damage];
  }
  const lvl = room.level;
  // Farol del techo en cada sala que se usa (salvo las que ponen sus propias luces).
  // (En las salas con su arte, en el nivel 3, la araña de hierro, igual de alta.)
  // (El salón pone las suyas: farol, araña de hierro, dos de latón o la de cristal.)
  if (!art?.ownLamp && room.type !== 'salon')
    t.push({
      img: art && lvl >= 3 ? chandelier(9, lvl >= 4) : lamp(),
      x: w / 2,
      z: MID,
      y: 0,
      hang: true,
      light: ceilingGlow(w, art ? lvl : 1, 4),
    });
  if (art?.things) return [...t, ...art.things(room, w, look)];
  switch (room.type) {
    case 'salon': {
      const decor = look.decor;
      // Fuego grande desde el nivel 3; la chimenea grande (decoración) lo aviva más.
      const big = decor.includes('chimenea') || lvl >= 3;
      // En el de dos alturas y tres huecos, la galería al fondo (con la barra debajo).
      const gal = galleryOf(room, w);
      const ceiling = room.h * PITCH - SLAB;
      if (gal) t.push(...galleryThings(room, gal, lvl, ceiling));
      add(bar(lvl, decor.includes('barril')), 44, WALL - 16);
      t.at(-1)!.act = 'candidatos';
      if (gal) t.at(-1)!.dim = 0.7;
      // Junto a la puerta de la izquierda, lo de cada nivel (ver `nook`): bien delante y con
      // poco fondo, para que la gente pase por detrás.
      t.push(thick(at(nook(lvl), 17, 5), 5, 'madera'));
      // En el de dos alturas, el tiro de la chimenea sube hasta el techo.
      const rise = Math.round((room.h - 1) * PITCH * scaleAt(HEARTH_Z));
      const hx = w - HEARTH_RIGHT;
      t.push({
        img: salonHearth(lvl, look.crest, big, rise),
        x: hx,
        z: HEARTH_Z,
        y: 0,
        light: fire(
          10,
          (lvl >= 3 ? 120 : lvl >= 2 ? 90 : 70) + (decor.includes('chimenea') ? 25 : 0),
          FIRE,
          big,
        ),
        box: true,
        poi: 'warm',
      });
      // La luz de los apliques de la chimenea (van pintados en ella).
      if (lvl === 2 || lvl === 3)
        for (const px of HEARTH_SCONCES)
          add(new PixelBuffer(1, 1), hx + (px - 28) / scaleAt(HEARTH_Z), HEARTH_Z - 2, 0, {
            dy: HEARTH_SCONCE_Y / scaleAt(HEARTH_Z),
            r: 40,
            color: CANDLE,
            power: 0.5,
            flicker: 0.1,
          });
      // Y la de los de la pared.
      const bh = Math.round((room.h * PITCH - (PITCH - ROOM_H)) * BACK);
      const low = bh - Math.round(ROOM_H * BACK);
      for (const x of salonSconces(room, Math.round(w * BACK)))
        t.push(wallLight(room, x, low + 23));
      add(logPile(), w - 13, WALL - 12);
      // (Con galería, la tarima va debajo: donde iba está la escalera.)
      if (decor.includes('tarima')) {
        add(stage(), gal ? gal.x1 - 30 : w - 94, WALL - 2);
        if (gal) t.at(-1)!.dim = 0.7;
      }
      // Las ristras y el jamón, en el salón sencillo (del 3 en adelante, no): de la viga del
      // techo o, con galería, de las de debajo de su suelo.
      if (lvl <= 2)
        t.push({
          img: larder(),
          x: 84,
          z: WALL - 8,
          y: gal ? ceiling - (PITCH - 8) : 0,
          hang: true,
          dim: gal ? 0.7 : undefined,
        });
      const linen = cloth(room, VINO);
      // Los cojines, del color de la pared del nivel (o del que haya elegido el pintor).
      const cushion = salonTint(room).slice(0, 3);
      tables(room, w).forEach(({ x: tx, z }, i) => {
        const cards = i === 0 && decor.includes('naipes');
        const candle = lvl >= 2 && !cards;
        add(
          tableSet(`${room.id}-${i}`, lvl >= 3 ? linen : undefined, candle, cards, lvl),
          tx,
          z,
          0,
          candle ? { dy: 18, r: 34, color: CANDLE, power: 0.45, flicker: 0.12 } : undefined,
        );
        add(seat(lvl, cushion), tx - 18, z - 2);
        add(seat(lvl, cushion), tx + 18, z + 2);
      });
      // La luz del techo, una sola: el farol (1–2), la araña de hierro (3), la de latón (4) o la
      // lámpara de araña de cristal (5).
      if (lvl <= 2)
        t.push(hung(lamp(), w / 2, MID, 0, { ...ceilingGlow(w, 1, 4), color: LANTERN }));
      else if (lvl <= 4)
        t.push(hung(chandelier(9, lvl === 4), w / 2, MID, 0, ceilingGlow(w, lvl, 4)));
      else
        t.push(
          hung(crystalChandelier(8), w / 2, MID, 0, {
            ...ceilingGlow(w, 4, 10),
            r: Math.round(ceilingGlow(w, 4, 10).r * 1.2),
            power: 1.7,
          }),
        );
      if (room.h > 1 || decor.includes('lampara')) {
        // En el de dos alturas, colgada de una cadena larga hasta media sala.
        const drop = (room.h - 1) * (PITCH - 24);
        // Con galería, por delante de la escalera (donde no da con nada); si no, a un lado de la
        // lámpara del nivel.
        const lx = gal ? gal.lamp : w / 2 + (lvl >= 3 ? 34 : 20);
        if (drop)
          t.push({
            img: chain(Math.round(drop * scaleAt(MID))),
            x: lx,
            z: MID,
            y: 0,
            hang: true,
          });
        t.push({
          img: Prop.chandelier(),
          x: lx,
          z: MID,
          y: drop,
          hang: true,
          light: { dy: 4, r: 120, color: WARM, power: 0.9, flicker: 0.06 },
        });
      }
      break;
    }
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
