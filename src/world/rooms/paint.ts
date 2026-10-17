/**
 * Pinta el gremio por salas: el corte del edificio con cada sala como una caja en
 * perspectiva, las escaleras, el tejado que se adapta a lo construido, la torre, el patio y
 * la roca de debajo. Arte provisional (muebles de la taberna de siempre); el definitivo
 * llega sala por sala.
 */
import { P, R, type Ramp } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import { Rng } from '../../core/rng';
import type { Room } from '../../core/model';
import type { Ambient, Flame, Glow, Light, RGB } from '../build';
import { GROUND } from '../geometry';
import {
  ambientOcclusion,
  beam,
  cobweb,
  planksH,
  planksV,
  plaster,
  post,
  stoneWall,
} from '../paint';
import * as Prop from '../props';
import {
  CELL_W,
  PATIO_W,
  ROOF_H,
  SLAB,
  STAIR_W,
  TOWER_H,
  WALL,
  colX,
  floorTop,
  floorY,
  stairX,
  type Rect,
  type RoomsLayout,
} from './layout';

export interface RoomsBuild {
  /** Esquina del búfer en el mundo. */
  ox: number;
  oy: number;
  back: PixelBuffer;
  lights: Light[];
  flames: Flame[];
  glows: Glow[];
  ambient: Ambient[];
}

export interface PaintOpts {
  crest: { field: string; dark: string; symbol: string };
  yard: { establo: number; patio: number; empal: number };
}

type Theme = 'madera' | 'yeso' | 'piedra' | 'cueva';
const themeOf = (f: number): Theme =>
  f >= 1 ? 'madera' : f === 0 ? 'yeso' : f === -1 ? 'piedra' : 'cueva';

/** Fondo de la caja: cuánto se mete la pared del fondo por los lados, arriba y abajo. */
const DX = 10;
const DT = 6;
const DB = 10;

const WOOD: Ramp = [P.plum, P.bark, P.rust, P.oak];
const WOOD_DARK: Ramp = [P.black, P.plum, P.bark, P.rust];
const PLASTER: Ramp = R.plaster;
const STONE: Ramp = [P.black, P.navy, P.slate, P.steel, P.fog];
const ROCK: Ramp = [P.black, P.ebony, P.plum, P.umber, P.bark];
const WARM: RGB = [255, 176, 96];
const LANTERN: RGB = [255, 196, 120];
const FORGE: RGB = [255, 120, 50];

export function paintRooms(L: RoomsLayout, opts: PaintOpts): RoomsBuild {
  const ox = L.x0;
  const oy = L.y0;
  const back = new PixelBuffer(L.x1 - L.x0, L.y1 - L.y0);
  const lights: Light[] = [];
  const flames: Flame[] = [];
  const glows: Glow[] = [];
  const ambient: Ambient[] = [];
  /** Pasa de coordenadas del mundo a las del búfer. */
  const at = (r: Rect): Rect => ({ x: r.x - ox, y: r.y - oy, w: r.w, h: r.h });
  const put = (img: PixelBuffer, x: number, baseY: number) =>
    back.blit(img, Math.round(x - ox), Math.round(baseY - oy - img.h));
  const b = L.b;

  // ---------- Tierra y roca ----------
  ambient.push({
    poly: poly({ x: L.x0, y: GROUND + SLAB, w: L.x1 - L.x0, h: L.y1 - GROUND }),
    color: [58, 52, 94],
  });
  const g = GROUND + SLAB - oy;
  earth(back, 0, g, back.w, back.h - g);
  // Césped y camino por encima del suelo, fuera del edificio.
  for (let x = 0; x < back.w; x++) {
    const wx = x + ox;
    if (wx >= L.left && wx < L.right) continue;
    const road = wx < -PATIO_W + 20;
    back.vline(x, g - SLAB, SLAB, road ? P.umber : wx < 0 ? P.bark : P.forest);
    back.set(x, g - SLAB, road ? P.cocoa : wx < 0 ? P.rust : P.leaf);
    if (!road && wx >= 0 && (x * 7) % 5 === 0) back.set(x, g - SLAB - 1, P.leaf);
  }
  // Bajo el edificio: roca maciza y, encima, los huecos excavados que siguen vacíos.
  stoneWall(back, L.left - ox, g, L.right - L.left, back.h - g, 'roca', {
    ramp: [P.black, P.navy, P.slate, P.steel],
    bw: 20,
    bh: 12,
  });
  for (let f = -1; f >= L.deepest; f--) {
    for (let c = 0; c < b.cols; c++) {
      if (!b.dug.includes(`${c},${f}`)) continue;
      const r = at({ x: colX(b, c), y: floorTop(f), w: CELL_W, h: floorY(f) - floorTop(f) });
      stoneWall(back, r.x, r.y, r.w, r.h, `cueva${c}${f}`, { ramp: ROCK, bw: 16, bh: 9 });
      back.rect(r.x + 4, r.y + 4, r.w - 8, r.h - 6, P.ebony);
      ambientOcclusion(back, r.x + 4, r.y + 4, r.w - 8, r.h - 6, 8);
    }
  }
  // Lo más hondo, más oscuro.
  for (let y = floorY(Math.max(L.deepest - 1, -6)) - oy; y < back.h; y++)
    for (let x = L.left - ox; x < L.right - ox; x++) if ((x + y) % 3 === 0) back.set(x, y, P.black);

  // ---------- Patio ----------
  patio(back, put, L, opts, lights, glows, ox, oy);

  // ---------- Escaleras ----------
  for (const s of b.stairs) {
    const x = stairX(b, s);
    for (let f = L.deepest; f <= L.top; f++)
      stairs(back, at({ x, y: floorTop(f), w: STAIR_W, h: floorY(f) - floorTop(f) }), f);
    // Forjados y el hueco de la escalera de arriba abajo.
    for (let f = L.deepest; f <= L.top; f++)
      slab(back, at({ x, y: floorY(f), w: STAIR_W, h: SLAB }), f);
    slab(back, at({ x, y: floorTop(L.top) - SLAB, w: STAIR_W, h: SLAB }), L.top);
    ambient.push({
      poly: poly({ x, y: floorTop(L.top), w: STAIR_W, h: floorY(L.deepest) - floorTop(L.top) }),
      color: [78, 70, 116],
    });
  }

  // ---------- Salas ----------
  for (const { room, rect } of L.rooms) {
    if (room.type === 'torre') continue;
    const r = at(rect);
    const lit = room.level > 0 && !room.works;
    box(back, r, room, themeOf(room.floor));
    furnish(put, rect, room, lights, flames, glows);
    if (room.works) scaffold(back, r);
    // Forjado de arriba y de abajo y muros donde la sala da al exterior.
    slab(back, { ...r, y: r.y - SLAB, h: SLAB }, room.floor + room.h - 1);
    slab(back, { ...r, y: r.y + r.h, h: SLAB }, room.floor);
    for (const side of [-1, 1] as const) {
      const nx = side < 0 ? rect.x - 1 : rect.x + rect.w;
      if (
        !L.rooms.some(
          (o) =>
            o.rect.x <= nx &&
            o.rect.x + o.rect.w > nx &&
            o.rect.y < rect.y + rect.h &&
            o.rect.y + o.rect.h > rect.y,
        ) &&
        !L.stairs.some((x) => x <= nx && x + STAIR_W > nx)
      )
        outerWall(back, side < 0 ? r.x - WALL : r.x + r.w, r.y - SLAB, r.h + 2 * SLAB, room.floor);
    }
    ambient.push({
      poly: poly(rect),
      color: !lit ? [52, 48, 88] : room.floor < -1 ? [70, 62, 108] : [96, 82, 128],
    });
    if (lit) {
      const cx = rect.x + rect.w / 2;
      lights.push({
        x: cx,
        y: rect.y + 14,
        r: Math.max(40, Math.round(rect.w * 0.55)),
        color: LANTERN,
        intensity: 0.75,
        flicker: 0.12,
      });
      glows.push({ x: cx, y: rect.y + 10, r: 6, color: LANTERN });
      lantern(back, Math.round(cx - ox), r.y + 2);
    }
  }

  // ---------- Tejados y torre ----------
  const runs = roofs(back, L, ox, oy);
  const tower = L.rooms.find((x) => x.room.type === 'torre');
  if (tower) {
    // La torre arranca del caballete del tejado que tiene debajo.
    const cx = tower.rect.x + tower.rect.w / 2;
    const run = runs.find((u) => cx > u.x0 && cx < u.x1 && u.base === floorY(tower.room.floor));
    const lift = run
      ? Math.round(run.h * (1 - Math.abs(cx - (run.x0 + run.x1) / 2) / ((run.x1 - run.x0) / 2))) - 2
      : 0;
    watchtower(
      back,
      at({ ...tower.rect, h: tower.rect.h - lift }),
      tower.room.level,
      opts.crest,
      lights,
      ox,
      oy,
    );
  }

  return { ox, oy, back, lights, flames, glows, ambient };
}

/** Polígono de un rectángulo del mundo (la luz ambiente va en coordenadas del mundo). */
const poly = (r: Rect): Ambient['poly'] => [
  [r.x, r.y],
  [r.x + r.w, r.y],
  [r.x + r.w, r.y + r.h],
  [r.x, r.y + r.h],
];

// ---------- Tierra ----------

function earth(b: PixelBuffer, x: number, y: number, w: number, h: number) {
  const rng = new Rng('tierra');
  for (let j = 0; j < h; j++) {
    const depth = j / Math.max(1, h);
    const band = Math.floor((j + Math.sin(j * 0.05) * 6) / 22) % 3;
    const base = depth > 0.6 ? P.black : band === 0 ? P.ebony : band === 1 ? P.plum : P.ebony;
    b.hline(x, y + j, w, base);
  }
  for (let k = 0; k < (w * h) / 60; k++) {
    const px = x + rng.int(0, w - 3);
    const py = y + rng.int(2, h - 2);
    b.hline(px, py, rng.int(1, 3), rng.chance(0.5) ? P.umber : P.navy);
    if (rng.chance(0.2)) b.set(px, py - 1, P.bark);
  }
}

// ---------- Patio, calle y fachada ----------

function patio(
  b: PixelBuffer,
  put: (img: PixelBuffer, x: number, baseY: number) => void,
  L: RoomsLayout,
  opts: PaintOpts,
  lights: Light[],
  glows: Glow[],
  ox: number,
  oy: number,
) {
  const g = GROUND;
  // Establo al fondo del patio, junto a la entrada.
  if (opts.yard.establo > 0) {
    const sx = -PATIO_W + 70;
    const sy = g - 46 - oy;
    planksV(b, sx - ox, sy, 70, 46, 'establo', WOOD_DARK, 6);
    b.poly(
      [
        [sx - 6 - ox, sy],
        [sx + 35 - ox, sy - 18],
        [sx + 76 - ox, sy],
      ],
      P.wine,
    );
    b.rect(sx + 22 - ox, sy + 16, 26, 30, P.black);
    if (opts.yard.establo > 1) b.rect(sx + 50 - ox, sy + 30, 14, 10, P.oak);
  }
  put(Prop.well(), -PATIO_W + 8, g);
  put(Prop.bush('patio1'), -24, g);
  // Muñecos de entrenamiento.
  for (let i = 0; i < Math.min(2, opts.yard.patio); i++) dummy(b, -110 + i * 26 - ox, g - oy);
  // Empalizada a lo largo del camino.
  if (opts.yard.empal > 0) {
    const tall = opts.yard.empal > 1 ? 30 : 22;
    for (let x = -PATIO_W - 36; x < -PATIO_W + 4; x += 6) {
      post(b, x - ox, g - tall - oy, 5, tall, WOOD_DARK);
      b.set(x + 2 - ox, g - tall - 1 - oy, P.oak);
    }
  }
  // Puerta del recibidor y escudo encima.
  const door = L.rooms.find((x) => x.room.type === 'recibidor');
  if (door) {
    const dx = door.rect.x - WALL - ox;
    put(
      Prop.crestBoard(opts.crest.field, opts.crest.dark, opts.crest.symbol),
      door.rect.x - 30,
      door.rect.y + 26,
    );
    b.rect(dx - 1, g - 44 - oy, WALL + 2, 44, P.black);
    b.blit(Prop.doorLeaf(), dx - 13, g - 48 - oy);
    lights.push({
      x: door.rect.x - 14,
      y: g - 40,
      r: 34,
      color: LANTERN,
      intensity: 0.7,
      flicker: 0.1,
    });
    glows.push({ x: door.rect.x - 14, y: g - 40, r: 5, color: LANTERN });
    b.blit(Prop.lanternBody(), door.rect.x - 18 - ox, g - 46 - oy);
  }
}

function dummy(b: PixelBuffer, x: number, base: number) {
  post(b, x + 4, base - 30, 3, 30, WOOD_DARK);
  b.rect(x, base - 26, 11, 4, P.oak);
  b.ellipse(x + 5.5, base - 29, 4, 4, P.sand);
  b.ellipse(x + 5.5, base - 18, 5, 7, P.tan);
  b.hline(x + 1, base - 18, 9, P.rust);
}

// ---------- Estructura ----------

function slab(b: PixelBuffer, r: Rect, f: number) {
  if (f >= 0) {
    beam(b, r.x, r.y, r.w, r.h, [P.black, P.plum, P.bark, P.rust]);
    for (let x = r.x + 3; x < r.x + r.w; x += 24) b.set(x, r.y + 3, P.black);
  } else stoneWall(b, r.x, r.y, r.w, r.h, `forjado${r.x}${r.y}`, { ramp: STONE, bw: 12, bh: 4 });
}

function outerWall(b: PixelBuffer, x: number, y: number, h: number, f: number) {
  if (f >= 0) post(b, x, y, WALL, h, [P.black, P.plum, P.bark, P.rust]);
  else stoneWall(b, x, y, WALL, h, `muro${x}${y}`, { ramp: STONE, bw: 6, bh: 6 });
}

function lantern(b: PixelBuffer, x: number, y: number) {
  b.vline(x, y, 4, P.black);
  b.rect(x - 2, y + 4, 5, 5, P.black);
  b.rect(x - 1, y + 5, 3, 3, P.gold);
  b.set(x, y + 6, P.lemon);
}

/** La caja de una sala: pared del fondo, techo, suelo y paredes de los lados en perspectiva. */
function box(b: PixelBuffer, r: Rect, room: Room, theme: Theme) {
  const ruin = room.level === 0 && !room.works;
  const bare = room.works?.kind === 'build';
  const seed = `${room.id}${room.type}`;
  const x0 = r.x;
  const x1 = r.x + r.w;
  const y0 = r.y;
  const y1 = r.y + r.h;
  const bx0 = x0 + DX;
  const bx1 = x1 - DX;
  const by0 = y0 + DT;
  const by1 = y1 - DB;
  // Pared del fondo.
  if (bare)
    plaster(b, bx0, by0, bx1 - bx0, by1 - by0, seed, [P.plum, P.rust, P.clay, P.tan, P.sand]);
  else if (theme === 'madera')
    planksH(b, bx0, by0, bx1 - bx0, by1 - by0, seed, ruin ? WOOD_DARK : WOOD, 6);
  else if (theme === 'yeso') {
    plaster(
      b,
      bx0,
      by0,
      bx1 - bx0,
      by1 - by0,
      seed,
      ruin ? [P.plum, P.rust, P.clay, P.tan, P.sand] : PLASTER,
      ruin,
    );
    for (let x = bx0; x < bx1; x += 32) post(b, x, by0, 4, by1 - by0, WOOD_DARK);
    beam(b, bx0, by0 + Math.round((by1 - by0) * 0.55), bx1 - bx0, 3, WOOD_DARK);
  } else if (theme === 'piedra')
    stoneWall(b, bx0, by0, bx1 - bx0, by1 - by0, seed, { ramp: STONE, moss: ruin ? 12 : 0 });
  else stoneWall(b, bx0, by0, bx1 - bx0, by1 - by0, seed, { ramp: ROCK, bw: 14, bh: 8 });
  // Techo.
  const ceil = theme === 'madera' || theme === 'yeso' ? P.plum : P.black;
  b.poly(
    [
      [x0, y0],
      [x1, y0],
      [bx1, by0],
      [bx0, by0],
    ],
    ceil,
  );
  if (theme === 'madera' || theme === 'yeso')
    for (let x = bx0 + 8; x < bx1; x += 24)
      b.poly(
        [
          [x - 2 - (x - (x0 + x1) / 2) * 0.12, y0],
          [x + 2 - (x - (x0 + x1) / 2) * 0.12, y0],
          [x + 1, by0],
          [x - 1, by0],
        ],
        P.bark,
      );
  // Suelo.
  const floorRamp = theme === 'cueva' ? ROCK : theme === 'piedra' ? STONE : WOOD;
  b.poly(
    [
      [bx0, by1],
      [bx1, by1],
      [x1, y1],
      [x0, y1],
    ],
    floorRamp[1]!,
  );
  for (let j = 1; j < DB; j += theme === 'madera' || theme === 'yeso' ? 3 : 4) {
    const t = j / DB;
    b.hline(Math.round(bx0 - DX * t), by1 + j, Math.round(bx1 - bx0 + 2 * DX * t), floorRamp[2]!);
  }
  b.hline(bx0, by1, bx1 - bx0, floorRamp[0]!);
  // Paredes de los lados, más oscuras.
  const side = theme === 'cueva' ? P.ebony : theme === 'piedra' ? P.navy : P.bark;
  b.poly(
    [
      [x0, y0],
      [bx0, by0],
      [bx0, by1],
      [x0, y1],
    ],
    side,
  );
  b.poly(
    [
      [x1, y0],
      [bx1, by0],
      [bx1, by1],
      [x1, y1],
    ],
    side,
  );
  b.vline(bx0, by0, by1 - by0, P.black);
  b.vline(bx1 - 1, by0, by1 - by0, P.black);
  ambientOcclusion(b, bx0, by0, bx1 - bx0, by1 - by0, 5, {
    top: true,
    bottom: false,
    left: true,
    right: true,
  });
  if (ruin) {
    cobweb(b, bx0 + 1, by0 + 1, 8, 1);
    cobweb(b, bx1 - 2, by0 + 1, 6, -1);
    const rng = new Rng(seed);
    for (let k = 0; k < 3; k++) {
      const px = bx0 + rng.int(4, Math.max(5, bx1 - bx0 - 30));
      const py = by0 + rng.int(6, Math.max(7, by1 - by0 - 10));
      b.line(px, py, px + rng.int(16, 28), py + rng.int(-4, 4), P.oak);
      b.line(px, py + 1, px + rng.int(16, 28), py + rng.int(-3, 5), P.rust);
    }
  }
}

/** Andamio delante de una sala en obras. */
function scaffold(b: PixelBuffer, r: Rect) {
  for (let x = r.x + 6; x < r.x + r.w - 2; x += 22) b.vline(x, r.y + 2, r.h - 2, P.tan);
  for (let y = r.y + 14; y < r.y + r.h; y += 20) {
    b.hline(r.x + 4, y, r.w - 8, P.oak);
    b.hline(r.x + 4, y + 1, r.w - 8, P.rust);
  }
  for (let x = r.x + 6; x + 22 < r.x + r.w; x += 44)
    b.line(x, r.y + r.h - 2, x + 22, r.y + 14, P.clay);
}

/** Tramo de escalera de una planta, en zigzag según la planta. */
function stairs(b: PixelBuffer, r: Rect, f: number) {
  const theme = themeOf(f);
  if (theme === 'madera' || theme === 'yeso')
    planksV(b, r.x, r.y, r.w, r.h, `esc${r.y}`, WOOD_DARK, 8);
  else
    stoneWall(b, r.x, r.y, r.w, r.h, `esc${r.y}`, {
      ramp: theme === 'cueva' ? ROCK : STONE,
      bw: 8,
      bh: 6,
    });
  const steps = 8;
  const up = f % 2 === 0;
  for (let i = 0; i < steps; i++) {
    const sx = up ? r.x + 2 + i * 3 : r.x + r.w - 6 - i * 3;
    const sy = r.y + r.h - 4 - i * Math.floor((r.h - 6) / steps);
    b.rect(sx, sy, 5, 3, P.oak);
    b.hline(sx, sy, 5, P.clay);
    b.hline(sx, sy + 2, 5, P.plum);
  }
  b.line(
    up ? r.x + 2 : r.x + r.w - 2,
    r.y + r.h - 14,
    up ? r.x + r.w - 2 : r.x + 2,
    r.y + 2,
    P.tan,
  );
}

// ---------- Tejados ----------

/** Tejados de dos aguas sobre cada tramo de salas que tiene el cielo encima. */
function roofs(b: PixelBuffer, L: RoomsLayout, ox: number, oy: number) {
  const runs: { x0: number; x1: number; base: number; h: number }[] = [];
  const segs: { x: number; w: number; top: number }[] = [];
  const topOf = (x: number, w: number) =>
    Math.max(
      -99,
      ...L.rooms
        .filter((o) => o.room.type !== 'torre' && o.rect.x < x + w && o.rect.x + o.rect.w > x)
        .map((o) => o.room.floor + o.room.h - 1),
    );
  for (let c = 0; c < L.b.cols; c++)
    segs.push({ x: colX(L.b, c), w: CELL_W, top: topOf(colX(L.b, c), CELL_W) });
  for (const s of L.stairs) segs.push({ x: s, w: STAIR_W, top: L.top });
  segs.sort((a, c) => a.x - c.x);
  let i = 0;
  while (i < segs.length) {
    let j = i;
    while (
      j + 1 < segs.length &&
      segs[j + 1]!.top === segs[i]!.top &&
      segs[j + 1]!.x === segs[j]!.x + segs[j]!.w
    )
      j++;
    const top = segs[i]!.top;
    if (top >= 0) {
      const x0 = segs[i]!.x - WALL - 6;
      const x1 = segs[j]!.x + segs[j]!.w + WALL + 6;
      const base = floorTop(top) - SLAB;
      const h = Math.min(ROOF_H, Math.round((x1 - x0) / 3));
      gable(b, x0 - ox, x1 - ox, base - oy, h);
      runs.push({ x0, x1, base, h });
    }
    i = j + 1;
  }
  return runs;
}

function gable(b: PixelBuffer, x0: number, x1: number, base: number, h: number) {
  const mid = (x0 + x1) / 2;
  const half = (x1 - x0) / 2;
  b.poly(
    [
      [x0, base + 2],
      [mid, base - h],
      [x1, base + 2],
    ],
    (x, y) => {
      const row = Math.floor((y - (base - h)) / 4);
      const off = row % 2 ? 3 : 0;
      const edge = (x + off) % 7 === 0;
      const shade = y > base - 3 ? P.plum : edge ? P.wine : row % 3 === 0 ? P.amber : P.brick;
      return Math.abs(x - mid) / half > 1 - (base + 2 - y) / (h + 2) - 0.04 ? P.plum : shade;
    },
  );
  b.line(x0, base + 2, Math.round(mid), base - h, P.black);
  b.line(Math.round(mid), base - h, x1, base + 2, P.black);
}

/** La torre del vigía: sin levantar es un solar con estacas; luego, de madera y más alta. */
function watchtower(
  b: PixelBuffer,
  r: Rect,
  level: number,
  crest: PaintOpts['crest'],
  lights: Light[],
  ox: number,
  oy: number,
) {
  const base = r.y + r.h;
  const cx = r.x + Math.round(r.w / 2);
  if (level === 0) {
    for (const dx of [-16, -6, 6, 16]) post(b, cx + dx, base - 10, 3, 10, WOOD_DARK);
    b.hline(cx - 16, base - 8, 35, P.tan);
    return;
  }
  const h = TOWER_H - (level > 1 ? 0 : 18);
  const top = base - h;
  post(b, cx - 18, top + 12, 4, h - 12, WOOD_DARK);
  post(b, cx + 14, top + 12, 4, h - 12, WOOD_DARK);
  for (let y = top + 20; y < base; y += 14) {
    b.line(cx - 15, y, cx + 15, y + 10, P.bark);
    b.line(cx + 15, y, cx - 15, y + 10, P.bark);
  }
  planksH(b, cx - 22, top + 8, 44, 6, 'torre', WOOD, 3);
  b.poly(
    [
      [cx - 24, top + 8],
      [cx, top - 10],
      [cx + 24, top + 8],
    ],
    P.wine,
  );
  b.line(cx - 24, top + 8, cx, top - 10, P.black);
  b.line(cx, top - 10, cx + 24, top + 8, P.black);
  if (level > 1) {
    b.vline(cx, top - 22, 12, P.black);
    b.rect(cx + 1, top - 22, 9, 6, crest.field);
    b.hline(cx + 1, top - 17, 9, crest.dark);
    b.ellipse(cx, top + 2, 3, 3, P.gold);
  }
  lights.push({ x: cx + ox, y: top + 4 + oy, r: 30, color: WARM, intensity: 0.6, flicker: 0.2 });
}

// ---------- Muebles provisionales ----------

function furnish(
  put: (img: PixelBuffer, x: number, baseY: number) => void,
  rect: Rect,
  room: Room,
  lights: Light[],
  flames: Flame[],
  glows: Glow[],
) {
  if (room.works?.kind === 'build') return;
  const wall = rect.y + rect.h - DB + 1;
  const front = rect.y + rect.h - 3;
  const x0 = rect.x + DX + 4;
  const w = rect.w - 2 * DX - 8;
  const slot = (i: number, n: number) => x0 + Math.round(((i + 0.5) * w) / n);
  const lvl = room.level;
  if (lvl === 0) {
    put(Prop.brokenChair(), slot(0, 3) - 8, front);
    put(Prop.rolledCarpet(), slot(1, 3) - 14, front);
    put(Prop.crate(), slot(2, 3) - 8, wall);
    return;
  }
  const cells = room.w;
  switch (room.type) {
    case 'recibidor':
      put(bench(), x0 + 4, front);
      put(Prop.armorStand(), x0 + w - 20, wall);
      put(Prop.sconce(), slot(0, 2) - 4, wall - 26);
      break;
    case 'salon': {
      put(Prop.counter(Math.min(4, lvl)), x0, wall);
      put(Prop.shelf(26, 3, `salon${room.id}`, true), x0 + 20, wall - 28);
      put(Prop.noticeBoard(3, false), x0 + w - 44, wall - 14);
      const tables = Math.max(1, cells * 2 - 1);
      for (let i = 0; i < tables; i++) {
        const tx = x0 + 80 + Math.round((i * (w - 100)) / Math.max(1, tables));
        if (tx + 28 > x0 + w) break;
        put(Prop.roundTable(lvl >= 3), tx, front);
        put(Prop.stool(), tx - 9, front);
      }
      if (room.h > 1 || lvl >= 3) put(Prop.chandelier(), slot(0, 1) - 16, rect.y + 24);
      lights.push({ x: x0 + 34, y: wall - 10, r: 46, color: WARM, intensity: 0.7, flicker: 0.1 });
      break;
    }
    case 'cocina':
      hearth(put, x0 + 2, wall, lights, glows);
      put(Prop.smallTable(), slot(1, 2) - 7, front);
      put(Prop.shelf(26, 3, `cocina${room.id}`), slot(1, 2) - 13, wall - 26);
      put(Prop.sack(), x0 + w - 16, front);
      break;
    case 'bodega':
      for (let i = 0; i < Math.min(3, cells * 2); i++)
        put(Prop.cask(), slot(i, Math.min(3, cells * 2)) - 15, wall);
      put(Prop.barrel(), x0 + w - 14, front);
      break;
    case 'tesoro':
      for (let i = 0; i < Math.min(4, lvl + cells); i++)
        put(Prop.chest(i % 2 === 1), slot(i, Math.min(4, lvl + cells)) - 9, front);
      put(Prop.sack(), x0 + 2, wall);
      glows.push({ x: slot(0, 2), y: front - 8, r: 8, color: [254, 200, 80] });
      break;
    case 'dormitorio':
    case 'veteranos':
    case 'servicio': {
      const beds = cells * (room.type === 'servicio' ? 2 : 1) * (lvl >= 2 ? 2 : 1);
      const n = Math.min(beds, Math.floor(w / 28));
      for (let i = 0; i < n; i++)
        put(
          room.type === 'servicio' && lvl < 2
            ? Prop.strawMat()
            : Prop.bunk(room.type === 'veteranos' ? 3 : lvl),
          slot(i, n) - 13,
          wall + 2,
        );
      if (room.type === 'veteranos') put(Prop.antlers(), slot(0, 1) - 13, wall - 30);
      break;
    }
    case 'enfermeria':
      for (let i = 0; i < Math.min(3, lvl + cells - 1); i++)
        put(Prop.cot(), slot(i, 3) - 15, front);
      put(Prop.cabinet(lvl >= 3), x0 + w - 24, wall);
      if (lvl >= 3) glows.push({ x: x0 + w - 12, y: wall - 18, r: 6, color: [140, 230, 200] });
      break;
    case 'capilla': {
      const ax = slot(0, 1) - 7;
      put(Prop.smallTable(), ax, wall);
      put(candles(), ax + 1, wall - 14);
      for (const dx of [2, 7, 12]) flames.push({ x: ax + dx, y: wall - 21, kind: 'vela' });
      for (let i = 0; i < Math.min(3, cells + 1); i++)
        put(bench(), slot(i, Math.min(3, cells + 1)) - 12, front);
      break;
    }
    case 'mapas':
      put(Prop.wallMap(), slot(0, 2) - 21, wall - 18);
      put(Prop.desk(), slot(1, 2) - 25, front);
      put(Prop.chair(), slot(1, 2) + 20, front);
      break;
    case 'armeria':
      put(Prop.armorStand(), x0 + 4, wall);
      for (let i = 0; i < 3; i++) put(Prop.sword(), x0 + 30, wall - 12 - i * 9);
      if (lvl >= 2) put(Prop.armorStand(), x0 + w - 22, wall);
      break;
    case 'forja':
      hearth(put, x0 + 2, wall, lights, glows, true);
      anvil(put, slot(1, 2), front);
      put(Prop.barrel(), x0 + w - 14, front);
      break;
    case 'despensa':
      put(Prop.cheeseShelf(), x0 + 2, wall);
      put(Prop.sack(), slot(1, 2), front);
      put(Prop.crate(), x0 + w - 18, front);
      break;
    case 'armas':
      put(Prop.armorStand(), x0 + 4, wall);
      put(Prop.dartboard(), slot(1, 2) - 7, wall - 20);
      break;
    case 'tiro':
      put(Prop.dartboard(), x0 + w - 18, wall - 20);
      put(Prop.dartboard(), x0 + w - 40, wall - 24);
      break;
    case 'biblioteca':
      put(Prop.bookshelf(), x0 + 2, wall);
      put(Prop.bookshelf(), x0 + w - 30, wall);
      put(Prop.desk(), slot(0, 1) - 25, front);
      break;
    case 'torre':
      break;
  }
}

/** Fogón pequeño contra la pared (cocina) o fragua (forja). */
function hearth(
  put: (img: PixelBuffer, x: number, baseY: number) => void,
  x: number,
  base: number,
  lights: Light[],
  glows: Glow[],
  forge = false,
) {
  const img = Prop.piece(26, 28, (p) => {
    stoneWall(p, 0, 0, 26, 28, forge ? 'fragua' : 'fogon', { ramp: STONE, bw: 6, bh: 4 });
    p.rect(5, 12, 16, 12, P.black);
    p.rect(7, 18, 12, 5, forge ? P.orange : P.red);
    p.hline(8, 17, 10, P.gold);
  });
  put(img, x, base);
  lights.push({
    x: x + 13,
    y: base - 8,
    r: 34,
    color: forge ? FORGE : WARM,
    intensity: 0.8,
    flicker: 0.3,
  });
  glows.push({ x: x + 13, y: base - 8, r: 8, color: forge ? FORGE : WARM });
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

function bench(): PixelBuffer {
  return Prop.piece(24, 8, (p) => {
    p.rect(0, 0, 24, 3, P.oak);
    p.hline(0, 0, 24, P.clay);
    p.rect(2, 3, 3, 5, P.bark);
    p.rect(19, 3, 3, 5, P.bark);
  });
}

function anvil(put: (img: PixelBuffer, x: number, baseY: number) => void, x: number, base: number) {
  const img = Prop.piece(18, 12, (p) => {
    p.rect(2, 0, 14, 4, P.slate);
    p.hline(2, 0, 14, P.fog);
    p.rect(6, 4, 6, 4, P.navy);
    p.rect(3, 8, 12, 4, P.bark);
  });
  put(img, x - 9, base);
}
