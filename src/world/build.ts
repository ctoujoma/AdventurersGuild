import { Rng } from '../core/rng';
import { heroSprites } from '../art/heroes/hero';
import type { HeroLook } from '../art/heroes/look';
import { P, R } from '../art/palette';
import { PixelBuffer, bayer } from '../art/pixel';
import {
  B,
  CHIMNEY,
  F,
  GROUND,
  ROOF,
  ROOMS,
  WORLD_H,
  WORLD_W,
  layout,
  roofTop,
  roofUnderside,
  type Facilities,
  type Layout,
} from './geometry';
import {
  ambientOcclusion,
  beam,
  cobweb,
  contactShadow,
  planksH,
  planksV,
  plaster,
  post,
  stoneWall,
} from './paint';
import type { TrophyIcon } from '../core/model';
import {
  armory,
  chapel,
  gearBoard,
  mapRoom,
  trophyWall,
  veteranWing,
  type GearView,
} from './annex';
import * as Prop from './props';
import { buildOuter, type Outer } from './yard';

/**
 * Construye las capas fijas del mundo para unas mejoras concretas: el fondo (edificio,
 * exterior), la capa delantera (barra, mesas, arbustos) y la lista de luces y llamas.
 */

export type RGB = readonly [number, number, number];

export interface Light {
  x: number;
  y: number;
  r: number;
  color: RGB;
  intensity: number;
  flicker: number;
}

export interface Shaft {
  /** Rectángulo de la ventana. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Hasta qué y llega el rayo (el suelo). */
  floor: number;
}

export interface Flame {
  x: number;
  y: number;
  kind: 'vela' | 'farol';
}

export interface Glow {
  x: number;
  y: number;
  r: number;
  color: RGB;
}

export interface Ambient {
  poly: readonly (readonly [number, number])[];
  color: RGB;
}

export interface WorldBuild {
  back: PixelBuffer;
  front: PixelBuffer;
  lights: Light[];
  shafts: Shaft[];
  flames: Flame[];
  glows: Glow[];
  ambient: Ambient[];
  layout: Layout;
  /** Patio y camino a la izquierda, terreno a la derecha (búferes de SPAN, origen WORLD_X0). */
  outer: Outer;
  fire: { x: number; y: number; w: number; level: Layout['fire'] };
}

const WARM: RGB = [255, 176, 96];
const CANDLE: RGB = [255, 160, 90];
const LANTERN: RGB = [255, 196, 120];

const rect = (x0: number, y0: number, x1: number, y1: number): Ambient['poly'] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

export const UNCLE: HeroLook = {
  sex: 'm',
  outfit: 'tabernero',
  skin: 1,
  hairStyle: 'calvo',
  hairColor: 5,
  beard: true,
  headgear: null,
  eyes: 0,
  face: 'redonda',
  brow: 'arqueada',
  mouth: 'sonrisa',
  freckles: false,
  scar: false,
};

export function buildWorld(
  fac: Facilities,
  loot: number,
  quests: number,
  fallen = 0,
  extra: { gear?: readonly GearView[]; trophies?: readonly TrophyIcon[] } = {},
): WorldBuild {
  const L = layout(fac);
  const back = new PixelBuffer(WORLD_W, WORLD_H);
  const front = new PixelBuffer(WORLD_W, WORLD_H);
  const lights: Light[] = [];
  const shafts: Shaft[] = [];
  const flames: Flame[] = [];
  const glows: Glow[] = [];
  const put = (p: PixelBuffer, x: number, y: number, flip = false) => back.blit(p, x, y, flip);
  const putFront = (p: PixelBuffer, x: number, y: number, flip = false) =>
    front.blit(p, x, y, flip);

  // ================= Exterior lejano: el roble detrás de la casa =================
  tree(back, 470);

  // ================= Suelo =================
  ground(back);

  // ================= Muros y cimientos =================
  stoneWall(back, B.left, ROOF.eaveY, B.right - B.left, 364 - ROOF.eaveY, 'muros', { moss: 10 });
  stoneWall(back, B.left, F.cellar.top, B.right - B.left, 64, 'cimientos', {
    ramp: [P.black, P.navy, P.slate, P.steel, P.fog],
    moss: 0,
  });

  // ================= Bodega =================
  cellar(back, put, loot, lights);
  armory(back, put, fac.arm);
  gearBoard(back, put, extra.gear ?? [], glows, lights, flames);

  // ================= Sala común =================
  hall(back, front, put, putFront, L, fac, quests, lights, flames, glows, shafts);

  // ================= Piso de arriba =================
  trophyWall(put, extra.trophies ?? []);
  upper(back, put, L, fac, lights, flames, glows, shafts);

  // ================= Desván =================
  attic(back, put, lights, flames, shafts);
  mapRoom(back, put, fac.mapas, flames, lights);

  // ================= Forjados =================
  Prop.floorSlab(back, B.left, F.attic.floor, B.right - B.left, 'forjado-desvan');
  back.rect(370, F.attic.floor, 10, 8, P.black);
  Prop.floorSlab(back, B.left, F.upper.floor, 376 - B.left, 'forjado-alto');
  back.rect(376, F.upper.floor, B.inR - 376, 8, P.black);
  back.hline(376, F.upper.floor + 7, B.inR - 376, P.plum);
  Prop.floorSlab(back, B.left, F.hall.floor, B.right - B.left, 'forjado-sala');
  // Trampilla de la bodega bajo la escalera.
  back.rect(398, F.hall.floor, 12, 8, P.black);
  back.hline(398, F.hall.floor, 12, P.rust);

  // ================= Tejado y chimenea =================
  roof(back);

  // ================= Exterior cercano =================
  yard(back, front, put, putFront, glows, fac.cap > 0);

  // Luz ambiente por habitación (se multiplica sobre la escena).
  const ambient: Ambient[] = [
    {
      poly: rect(ROOMS.hall.x0, ROOMS.hall.y0, ROOMS.hall.x1, ROOMS.hall.y1),
      color: fac.tab >= 4 ? [112, 92, 136] : fac.tab ? [96, 80, 128] : [64, 58, 100],
    },
    {
      poly: rect(ROOMS.dorm.x0, ROOMS.dorm.y0, ROOMS.dorm.x1 + 4, ROOMS.dorm.y1),
      color: fac.dorm ? [86, 76, 124] : [60, 56, 98],
    },
    {
      poly: rect(ROOMS.enf.x0, ROOMS.enf.y0, ROOMS.enf.x1 + 4, ROOMS.enf.y1),
      color: fac.enf ? [92, 84, 130] : [46, 42, 80],
    },
    {
      poly: rect(ROOMS.landing.x0, ROOMS.landing.y0, ROOMS.landing.x1, ROOMS.landing.y1),
      color: [84, 74, 120],
    },
    {
      poly: rect(ROOMS.cellar.x0, ROOMS.cellar.y0, ROOMS.cellar.x1, ROOMS.cellar.y1),
      color: [54, 50, 92],
    },
    {
      poly: [
        [B.inL, roofUnderside(B.inL)],
        [ROOF.apexX, roofUnderside(ROOF.apexX)],
        [B.inR, roofUnderside(B.inR)],
        [B.inR, F.attic.floor],
        [B.inL, F.attic.floor],
      ],
      color: [72, 64, 110],
    },
  ];

  // ================= Capilla (anexo a la derecha) =================
  veteranWing(back, fac.vet ?? 0, lights, glows);
  chapel(back, put, fac.cap, fallen, lights, flames, glows, ambient);

  const outer = buildOuter(glows, fac, lights, flames);

  return {
    back,
    front,
    outer,
    lights,
    shafts,
    flames,
    glows,
    ambient,
    layout: L,
    fire: { x: 330, y: 288, w: 30, level: L.fire },
  };
}

// ---------------------------------------------------------------------------

function ground(b: PixelBuffer): void {
  const rng = new Rng('suelo');
  for (let y = GROUND; y < WORLD_H; y++) {
    const depth = y - GROUND;
    for (let x = 0; x < WORLD_W; x++) {
      const band = depth < 6 ? 3 : depth < 18 ? 2 : depth < 40 ? 1 : 1;
      const wobble = Math.sin(x * 0.11) * 2 + Math.sin(x * 0.037) * 3;
      const t = depth + wobble;
      const idx = t < 5 ? 3 : t < 16 + bayer(x, y) * 3 ? 2 : 1;
      b.set(x, y, R.dirt[Math.min(band, idx) + 0]!);
    }
  }
  // Piedras y raíces.
  for (let i = 0; i < 70; i++) {
    const x = rng.int(0, WORLD_W - 4);
    const y = rng.int(GROUND + 8, WORLD_H - 4);
    const w = rng.int(2, 5);
    b.ellipse(x, y, w, w * 0.6, P.slate);
    b.set(x - 1, y - 1, P.steel);
  }
  for (let i = 0; i < 40; i++)
    b.set(rng.int(0, WORLD_W - 1), rng.int(GROUND + 4, WORLD_H - 1), P.umber);
  for (let r = 0; r < 6; r++) {
    let x = 470 + rng.int(-6, 6);
    let y = GROUND + 2;
    for (let s = 0; s < 22; s++) {
      b.set(x, y, P.bark);
      b.set(x + 1, y, P.plum);
      x += rng.int(-1, 1) + (r % 2 ? 1 : -1) * (s % 3 === 0 ? 1 : 0);
      y += rng.chance(0.7) ? 1 : 0;
    }
  }
  // Hierba con matojos y flores.
  for (let x = 0; x < WORLD_W; x++) {
    b.set(x, GROUND, P.leaf);
    b.set(x, GROUND + 1, P.forest);
    b.set(x, GROUND + 2, bayer(x, 0) > 0.5 ? P.forest : P.deep);
    const h = Math.floor((Math.sin(x * 0.9) + Math.sin(x * 0.31) + 2) * 1.2);
    for (let k = 1; k <= h; k++) b.set(x, GROUND - k, k === h ? P.lime : P.leaf);
  }
  for (let i = 0; i < 26; i++) {
    const x = rng.int(0, WORLD_W - 1);
    if (x > B.left - 2 && x < B.right + 2) continue;
    b.set(x, GROUND - 3, rng.pick([P.coral, P.lemon, P.white, P.rose]));
    b.set(x, GROUND - 2, P.leaf);
  }
  // Camino de losas hasta la puerta.
  for (let x = 4; x < B.left; x += 9) {
    b.ellipse(x + 3, GROUND + 1, 4, 1.6, P.fog);
    b.hline(x + 1, GROUND, 4, P.mist);
  }
}

function tree(b: PixelBuffer, cx: number): void {
  const rng = new Rng('roble');
  // Tronco con corteza.
  for (let y = 180; y < GROUND + 2; y++) {
    const w = 7 + Math.floor(Math.max(0, y - 270) / 5);
    for (let x = cx - w; x <= cx + w; x++) {
      const e = (x - (cx - w)) / (2 * w);
      const c = e < 0.25 ? P.rust : e < 0.6 ? P.bark : P.plum;
      b.set(x, y, (x * 3 + Math.floor(y / 4)) % 7 === 0 ? P.plum : c);
    }
  }
  // Ramas.
  for (const [dx, dy, len] of [
    [-1, -1, 26],
    [1, -1, 24],
    [-1, -0.4, 20],
  ] as const) {
    for (let i = 0; i < len; i++) {
      const x = Math.round(cx + dx * i);
      const y = Math.round(210 + dy * i);
      b.rect(x - 1, y, 3, 2, P.bark);
    }
  }
  // Copa: racimos con luz de luna arriba a la izquierda.
  const clusters: [number, number, number][] = [];
  for (let i = 0; i < 26; i++)
    clusters.push([cx + rng.int(-52, 46), rng.int(108, 214), rng.int(10, 18)]);
  clusters.sort((a, b2) => a[1] - b2[1]);
  for (const [x0, y0, r] of clusters) {
    b.ellipse(x0, y0, r, r * 0.85, (x, y, t) => {
      const lx = (x - x0) / r;
      const ly = (y - y0) / r;
      const lit = -lx * 0.6 - ly * 0.8;
      if (t > 0.85) return P.black;
      if (lit > 0.45 + bayer(x, y) * 0.2) return P.forest;
      if (lit < -0.3 - bayer(x, y) * 0.2) return P.black;
      return P.deep;
    });
    for (let k = 0; k < 6; k++) {
      const a = rng.next() * Math.PI;
      const px = Math.round(x0 - Math.cos(a) * r * 0.6);
      const py = Math.round(y0 - Math.sin(a) * r * 0.6);
      b.set(px, py, P.leaf);
      b.set(px + 1, py, P.forest);
    }
  }
}

function roof(b: PixelBuffer): void {
  const { apexX, apexY, eaveY, eaveL, eaveR, thick } = ROOF;
  // Chimenea (detrás de las tejas).
  stoneWall(b, CHIMNEY.x, CHIMNEY.top, CHIMNEY.w, 40, 'chimenea', { bw: 7, bh: 5 });
  b.rect(CHIMNEY.x - 2, CHIMNEY.top - 3, CHIMNEY.w + 4, 4, P.fog);
  b.hline(CHIMNEY.x - 2, CHIMNEY.top - 3, CHIMNEY.w + 4, P.mist);
  b.hline(CHIMNEY.x - 2, CHIMNEY.top, CHIMNEY.w + 4, P.slate);
  b.rect(CHIMNEY.x + 3, CHIMNEY.top - 4, CHIMNEY.w - 6, 1, P.black);
  // Tejas en hileras festoneadas.
  for (let y = apexY; y <= eaveY; y++) {
    for (let x = eaveL; x <= eaveR; x++) {
      const top = roofTop(x);
      if (y < top || y > top + thick) continue;
      const rowY = y - apexY;
      const row = Math.floor(rowY / 5);
      const inRow = rowY % 5;
      const off = row % 2 ? 3 : 0;
      const tileX = (x + off) % 6;
      let c: string = R.roof[3]!;
      if (inRow === 0) c = R.roof[4]!;
      if (inRow === 4) c = R.roof[1]!;
      if (inRow === 3 && (tileX === 0 || tileX === 5)) c = R.roof[1]!;
      if (inRow >= 1 && inRow <= 3 && tileX === 0) c = R.roof[2]!;
      if (inRow === 2 && tileX === 2) c = R.roof[4]!;
      if (y > top + thick - 3) c = P.plum;
      b.set(x, y, c);
    }
  }
  // Musgo en las tejas bajas.
  const rng = new Rng('musgo');
  for (let i = 0; i < 40; i++) {
    const x = rng.int(eaveL + 4, eaveR - 4);
    const y = Math.round(roofTop(x)) + rng.int(2, 6);
    if (Math.abs(x - apexX) < 120) continue;
    b.set(x, y, P.forest);
    b.set(x + 1, y, P.leaf);
  }
  // Tablas de alero, cumbrera y alero.
  for (let x = eaveL; x <= eaveR; x++) {
    const top = Math.round(roofTop(x));
    b.set(x, top - 1, P.black);
    b.set(x, top, P.oak);
    b.set(x, top + 1, P.rust);
  }
  for (let x = apexX - 6; x <= apexX + 6; x++) b.rect(x, Math.round(roofTop(x)) - 2, 1, 3, P.brick);
  b.rect(eaveL - 2, eaveY, 6, 4, P.rust);
  b.rect(eaveR - 3, eaveY, 6, 4, P.rust);
  // Mástil de la veleta en la cumbrera.
  b.rect(apexX, apexY - 18, 1, 18, P.slate);
  b.set(apexX, apexY - 19, P.gold);
}

function cellar(
  b: PixelBuffer,
  put: (p: PixelBuffer, x: number, y: number, flip?: boolean) => void,
  loot: number,
  lights: Light[],
): void {
  const { x0, x1, y0, y1 } = ROOMS.cellar;
  stoneWall(b, x0, y0, x1 - x0, y1 - y0, 'bodega', {
    ramp: [P.black, P.black, P.navy, P.slate, P.steel],
    bw: 9,
    bh: 5,
  });
  // Bóvedas: arcos entre pilares, con dovelas claras y el hueco en sombra.
  for (let px = x0; px < x1; px += 80) {
    const cx = px + 40;
    for (let x = px; x < px + 80; x++) {
      const dx = (x - cx) / 40;
      const ay = Math.round(y0 + 4 + (1 - Math.sqrt(Math.max(0, 1 - dx * dx))) * 14);
      for (let y = y0; y < ay; y++) b.set(x, y, (x + y) % 2 ? P.black : P.navy);
      b.set(x, ay, P.steel);
      b.set(x, ay + 1, P.slate);
      if ((x - px) % 6 === 0) b.vline(x, ay - 2, 2, P.navy);
    }
    b.rect(px, y0, 4, y1 - y0, P.slate);
    b.vline(px, y0, y1 - y0, P.steel);
  }
  // Suelo de tierra batida.
  for (let x = x0; x < x1; x++) {
    b.set(x, y1, P.umber);
    b.set(x, y1 + 1, (x * 7) % 5 ? P.ebony : P.umber);
    b.set(x, y1 + 2, P.ebony);
    b.set(x, y1 + 3, P.black);
  }
  put(Prop.wineRack(), 110, y1 - 33);
  put(Prop.cask(), 156, y1 - 31);
  put(Prop.cask(), 188, y1 - 31);
  // Arcones del botín: tres en el suelo y el resto apilados encima.
  for (let i = 0; i < Math.min(loot, 6); i++)
    put(Prop.chest(), i < 3 ? 226 + i * 18 : 235 + (i - 3) * 18, i < 3 ? y1 - 13 : y1 - 26);
  put(Prop.cheeseShelf(), 340, y1 - 25);
  put(Prop.sack(), 372, y1 - 12);
  put(Prop.sack(), 382, y1 - 11);
  put(Prop.crate(), 358, y1 - 13);
  put(Prop.ladder(62), 398, F.hall.floor - 2);
  // Agujero de la rata.
  b.ellipse(419, y1 - 2, 3, 3.5, P.black);
  // Charco bajo la gotera y grieta.
  b.ellipse(282, y1, 5, 1, P.navy);
  b.hline(280, y1, 3, P.steel);
  b.vline(282, y0, 3, P.black);
  // Farol colgado.
  b.vline(300, y0, 4, P.slate);
  put(Prop.lanternBody(), 296, y0 + 4);
  lights.push({ x: 300, y: y0 + 10, r: 56, color: LANTERN, intensity: 0.9, flicker: 0.08 });
  cobweb(b, x0, y0, 7, 1);
  cobweb(b, x1 - 1, y0, 6, -1);
  ambientOcclusion(b, x0, y0, x1 - x0, y1 - y0, 7);
}

function hall(
  b: PixelBuffer,
  front: PixelBuffer,
  put: (p: PixelBuffer, x: number, y: number, flip?: boolean) => void,
  putFront: (p: PixelBuffer, x: number, y: number, flip?: boolean) => void,
  L: Layout,
  fac: Facilities,
  quests: number,
  lights: Light[],
  flames: Flame[],
  glows: Glow[],
  shafts: Shaft[],
): void {
  const { x0, x1, y0, y1 } = ROOMS.hall;
  const ruined = fac.tab === 0;
  // Pared: yeso arriba, zócalo de tablones abajo, entramado de vigas.
  plaster(
    b,
    x0,
    y0,
    x1 - x0,
    42,
    'sala',
    ruined ? [P.plum, P.rust, P.clay, P.skinS] : R.plaster,
    ruined,
  );
  planksV(b, x0, y0 + 42, x1 - x0, y1 - y0 - 42, 'zocalo');
  beam(b, x0, y0 + 40, x1 - x0, 4);
  for (const px of [194, 262, 312]) post(b, px, y0, 4, 40);
  // Puerta abierta en el muro izquierdo.
  b.rect(B.left, 244, B.inL - B.left, 48, P.black);
  b.rect(B.left, 244, B.inL - B.left, 2, P.rust);
  b.vline(B.left, 244, 48, P.bark);
  // Estanterías de la barra.
  put(Prop.shelf(84, Math.ceil(L.bottles / 2), 'estante1'), 106, 222);
  put(Prop.shelf(84, Math.floor(L.bottles / 2), 'estante2'), 106, 238);
  if (L.mugs) put(Prop.shelf(60, L.mugs, 'jarras', true), 118, 252);
  if (L.kegs) put(Prop.kegStand(Math.min(2, L.kegs)), 104, F.hall.floor - 42);
  // Ristras colgadas del techo.
  for (let i = 0; i < L.hangings; i++) put(Prop.hanging(i), 132 + i * 10, y0 + 1);
  // Farol sobre la barra.
  if (!ruined) {
    b.vline(160, y0, 6, P.slate);
    put(Prop.lanternBody(), 156, y0 + 6);
    lights.push({ x: 160, y: y0 + 12, r: 60, color: LANTERN, intensity: 0.95, flicker: 0.06 });
    glows.push({ x: 160, y: y0 + 12, r: 8, color: LANTERN });
  }
  // Ventana con luz de luna.
  put(Prop.windowFrame(14, 18, { broken: ruined }), 196, 228);
  if (!ruined) shafts.push({ x: 198, y: 230, w: 14, h: 18, floor: F.hall.floor });
  // Tablón, diana y laúd.
  put(Prop.noticeBoard(quests, fac.tab >= 1), 220, 228);
  if (L.lute) put(Prop.lute(), 264, 230);
  if (L.dartboard) put(Prop.dartboard(), 282, 236);
  // Apliques.
  for (const sx of L.sconces) {
    put(Prop.sconce(), sx - 3, 234);
    flames.push({ x: sx, y: 234, kind: 'vela' });
    lights.push({ x: sx, y: 236, r: 44, color: CANDLE, intensity: 0.85, flicker: 0.12 });
  }
  // Chimenea, trofeo, velas y leña.
  put(Prop.fireplace(L.fire === 'apagado' ? 0 : L.fire === 'grande' ? 2 : 1), 318, 238);
  if (L.trophy) put(Prop.antlers(), 334, 226);
  if (fac.tab >= 2) {
    for (const cx of [322, 368]) {
      b.rect(cx, 244, 2, 4, P.white);
      b.set(cx + 1, 244, P.mist);
      flames.push({ x: cx, y: 243, kind: 'vela' });
    }
  }
  if (!ruined) put(Prop.firewood(), 298, F.hall.floor - 15);
  if (L.fire !== 'apagado')
    lights.push({
      x: 346,
      y: 274,
      r: L.fire === 'grande' ? 100 : 84,
      color: WARM,
      intensity: 1,
      flicker: 0.16,
    });
  // Alfombras.
  if (L.gala) {
    // Gran salón: alfombra roja de la puerta a la chimenea.
    put(Prop.rug(176, [P.plum, P.wine, P.red, P.gold]), 198, F.hall.floor - 2);
  } else if (L.rugs) {
    put(Prop.rug(54, [P.plum, P.wine, P.red, P.coral]), 320, F.hall.floor - 2);
    put(Prop.rug(70, [P.navy, P.ocean, P.sky, P.mist]), 228, F.hall.floor - 2);
  }
  // Mesas: taburetes al fondo, tablero delante de quien se sienta.
  for (const tx of L.tables) {
    for (const s of L.seats.filter((st) => Math.abs(st.x - tx) < 20))
      put(Prop.stool(), s.x - 5, F.hall.floor - 11);
    putFront(Prop.roundTable(L.tablecloths), tx - 14, F.hall.floor - 15);
    contactShadow(b, tx, F.hall.floor - 1, 9);
    // Vela en botella.
    front.rect(tx + 3, F.hall.floor - 20, 3, 5, P.deep);
    front.set(tx + 4, F.hall.floor - 22, P.white);
    front.set(tx + 4, F.hall.floor - 21, P.white);
    front.set(tx + 3, F.hall.floor - 19, P.leaf);
    flames.push({ x: tx + 4, y: F.hall.floor - 24, kind: 'vela' });
    lights.push({
      x: tx + 4,
      y: F.hall.floor - 23,
      r: 34,
      color: CANDLE,
      intensity: 0.8,
      flicker: 0.14,
    });
    if (fac.tab >= 2) {
      front.rect(tx - 7, F.hall.floor - 19, 4, 4, P.oak);
      front.hline(tx - 7, F.hall.floor - 19, 4, P.sand);
    }
  }
  if (ruined) {
    put(Prop.brokenChair(), 240, F.hall.floor - 13);
    put(Prop.crate(), 280, F.hall.floor - 13);
    cobweb(b, x0, y0 + 2, 9, 1);
    cobweb(b, 311, y0 + 2, 8, -1);
  }
  if (L.chandelier) {
    put(Prop.chandelier(), 273, y0 - 2);
    for (const cx of [276, 282, 288, 294, 300]) flames.push({ x: cx, y: y0 + 4, kind: 'vela' });
    lights.push({ x: 288, y: y0 + 12, r: 70, color: CANDLE, intensity: 0.9, flicker: 0.1 });
  }
  if (L.gala) {
    put(Prop.chandelier(), 221, y0 - 2);
    for (const cx of [224, 230, 236, 242, 248]) flames.push({ x: cx, y: y0 + 4, kind: 'vela' });
    lights.push({ x: 236, y: y0 + 12, r: 70, color: CANDLE, intensity: 0.9, flicker: 0.1 });
  }
  // Escalera con barandilla.
  stairs(b, front);
  // La barra va delante del tabernero.
  putFront(Prop.counter(fac.tab), 125, F.hall.floor - 20);
  for (let i = 0; i < Math.min(3, L.mugs); i++) {
    front.rect(132 + i * 14, 268, 4, 5, P.oak);
    front.hline(132 + i * 14, 268, 4, P.sand);
    front.vline(136 + i * 14, 269, 2, P.oak);
  }
  ambientOcclusion(b, x0, y0, x1 - x0, y1 - y0, 6, {
    top: true,
    bottom: true,
    left: false,
    right: true,
  });
}

function stairs(b: PixelBuffer, front: PixelBuffer): void {
  const bottom = F.hall.floor;
  for (let i = 0; i < 12; i++) {
    const sx = B.inR - 4 * (i + 1);
    const sy = bottom - 6 * (i + 1);
    // Zanca (hacia abajo) y peldaño.
    b.rect(sx, sy + 3, 8, 6, P.bark);
    b.rect(sx, sy, 8, 3, P.oak);
    b.hline(sx, sy, 8, P.clay);
    b.hline(sx, sy + 3, 8, P.plum);
  }
  // Barandilla delante.
  for (let i = 0; i < 12; i += 2) {
    const sx = B.inR - 4 * (i + 1) + 3;
    const sy = bottom - 6 * (i + 1);
    front.rect(sx, sy - 12, 1, 12, P.rust);
  }
  for (let i = 0; i < 48; i++) {
    const x = B.inR - i;
    const y = Math.round(bottom - 14 - i * 1.5);
    front.set(x, y, P.oak);
    front.set(x, y + 1, P.bark);
  }
  front.rect(B.inR - 3, bottom - 22, 3, 22, P.rust);
  front.set(B.inR - 2, bottom - 23, P.clay);
}

function upper(
  b: PixelBuffer,
  put: (p: PixelBuffer, x: number, y: number, flip?: boolean) => void,
  L: Layout,
  fac: Facilities,
  lights: Light[],
  flames: Flame[],
  glows: Glow[],
  shafts: Shaft[],
): void {
  const { y0, y1 } = ROOMS.dorm;
  // ----- Dormitorio -----
  const d = ROOMS.dorm;
  const dormRuined = fac.dorm === 0;
  planksH(
    b,
    d.x0,
    y0,
    d.x1 - d.x0,
    y1 - y0,
    'dorm',
    dormRuined ? [P.black, P.plum, P.bark, P.rust] : [P.plum, P.bark, P.rust, P.oak],
    6,
  );
  beam(b, d.x0, y0, d.x1 - d.x0, 3);
  put(Prop.windowFrame(16, 16, { broken: dormRuined, curtains: L.curtains }), 158, 153);
  if (!dormRuined) shafts.push({ x: 160, y: 155, w: 16, h: 16, floor: y1 });
  if (dormRuined) {
    put(Prop.strawMat(), 112, y1 - 6);
    put(Prop.strawMat(), 150, y1 - 6);
    b.ellipse(204, 186, 9, 6, P.black);
    for (let r = 0; r < 10; r += 3) b.hline(197, 182 + r, 14, P.plum);
    cobweb(b, d.x0, y0 + 3, 8, 1);
    cobweb(b, d.x1 - 1, y0 + 3, 7, -1);
    put(Prop.crate(), 180, y1 - 13);
  }
  const bunk = Prop.bunk(fac.dorm);
  for (const x of L.bunks) put(bunk, x - 1, y1 - 42);
  if (fac.dorm === 1) {
    put(Prop.stool(), 208, y1 - 11);
    b.rect(211, y1 - 15, 2, 4, P.white);
    flames.push({ x: 211, y: y1 - 16, kind: 'vela' });
    lights.push({ x: 212, y: y1 - 15, r: 36, color: CANDLE, intensity: 0.8, flicker: 0.14 });
  }
  if (fac.dorm >= 2 && L.bunks.length < 4) put(Prop.washbasin(), 218, y1 - 18);
  if (fac.dorm >= 3) {
    put(Prop.pennants(118), 110, y0 + 3);
    b.vline(132, y0, 6, P.slate);
    put(Prop.lanternBody(), 128, y0 + 6);
    lights.push({ x: 132, y: y0 + 12, r: 54, color: LANTERN, intensity: 0.9, flicker: 0.06 });
    glows.push({ x: 132, y: y0 + 12, r: 7, color: LANTERN });
  } else if (fac.dorm === 2) {
    lights.push({ x: 120, y: y0 + 30, r: 30, color: CANDLE, intensity: 0.6, flicker: 0.12 });
    b.rect(118, y1 - 30, 2, 4, P.white);
    flames.push({ x: 118, y: y1 - 31, kind: 'vela' });
  }
  ambientOcclusion(b, d.x0, y0, d.x1 - d.x0, y1 - y0, 6);

  // Tabique con puerta.
  partition(b, 236, fac.enf === 0);

  // ----- Enfermería -----
  const e = ROOMS.enf;
  const enfClosed = fac.enf === 0;
  plaster(
    b,
    e.x0,
    y0,
    e.x1 - e.x0,
    y1 - y0,
    'enf',
    enfClosed ? [P.black, P.plum, P.rust, P.clay] : R.whitewash,
    enfClosed,
  );
  beam(b, e.x0, y0, e.x1 - e.x0, 3);
  stoneWall(b, 338, y0, 20, y1 - y0, 'tiro-alto', { bw: 7, bh: 5 });
  put(
    Prop.windowFrame(14, 16, {
      broken: enfClosed,
      curtains: fac.enf >= 2,
      color: [P.navy, P.ocean, P.sky, P.mist],
    }),
    258,
    153,
  );
  if (!enfClosed) shafts.push({ x: 260, y: 155, w: 14, h: 16, floor: y1 });
  if (enfClosed) {
    put(Prop.crate(), 262, y1 - 13);
    put(Prop.crate(), 274, y1 - 25);
    put(Prop.sack(), 290, y1 - 12);
    put(Prop.barrel(), 306, y1 - 16);
    cobweb(b, e.x0, y0 + 3, 8, 1);
    cobweb(b, 337, y0 + 3, 7, -1);
  } else {
    // Cruz roja de la enfermería.
    b.rect(294, 156, 9, 9, P.white);
    b.rect(297, 157, 3, 7, P.red);
    b.rect(295, 159, 7, 3, P.red);
    const cot = Prop.cot();
    for (const x of L.cots) put(cot, x - 1, y1 - 16);
    if (fac.enf === 1) {
      put(Prop.smallTable(), 314, y1 - 13);
      b.rect(319, y1 - 17, 2, 4, P.white);
      flames.push({ x: 319, y: y1 - 18, kind: 'vela' });
      lights.push({ x: 320, y: y1 - 17, r: 40, color: CANDLE, intensity: 0.85, flicker: 0.14 });
    }
    if (L.herbs) {
      for (const hx of [300, 310, 320]) put(Prop.hanging(2), hx, y0 + 2);
      b.vline(302, y0, 3, P.tan);
      b.vline(312, y0, 3, P.tan);
    }
    if (fac.enf >= 2) {
      b.vline(276, y0, 6, P.slate);
      put(Prop.lanternBody(), 272, y0 + 6);
      lights.push({ x: 276, y: y0 + 12, r: 52, color: LANTERN, intensity: 0.9, flicker: 0.06 });
      glows.push({ x: 276, y: y0 + 12, r: 7, color: LANTERN });
    }
    if (L.potions) {
      put(Prop.cabinet(true), 314, y1 - 32);
      for (const [gx, gy, c] of [
        [320, 188, [120, 255, 140]],
        [326, 197, [220, 120, 255]],
        [330, 188, [90, 220, 255]],
      ] as const)
        glows.push({ x: gx, y: gy, r: 6, color: c });
      lights.push({ x: 326, y: 192, r: 30, color: [140, 230, 200], intensity: 0.6, flicker: 0.05 });
    }
  }
  ambientOcclusion(b, e.x0, y0, e.x1 - e.x0, y1 - y0, 6);

  partition(b, 364, false);

  // ----- Rellano -----
  const r = ROOMS.landing;
  plaster(b, r.x0, y0, r.x1 - r.x0, y1 - y0, 'rellano', R.plaster);
  beam(b, r.x0, y0, r.x1 - r.x0, 3);
  const uncle = heroSprites(UNCLE).idle[0].crop(1, 3, 18, 22);
  put(Prop.uncleFrame(uncle), 390, 152);
  put(Prop.sconce(), 382, 162);
  flames.push({ x: 385, y: 162, kind: 'vela' });
  lights.push({ x: 385, y: 164, r: 40, color: CANDLE, intensity: 0.85, flicker: 0.12 });
  put(Prop.ladder(F.upper.floor - F.attic.floor + 2), 370, F.attic.floor);
  // Barandilla del hueco de la escalera.
  for (let x = 382; x < B.inR; x += 5) b.rect(x, y1 - 12, 1, 12, P.rust);
  b.rect(380, y1 - 13, B.inR - 380, 2, P.oak);
  b.hline(380, y1 - 13, B.inR - 380, P.clay);
  ambientOcclusion(b, r.x0, y0, r.x1 - r.x0, y1 - y0, 5);
}

function partition(b: PixelBuffer, x: number, boarded: boolean): void {
  const { y0, y1 } = ROOMS.dorm;
  post(b, x, y0, 4, y1 - y0);
  // Hueco de puerta abajo.
  b.rect(x, y1 - 28, 4, 28, P.black);
  b.rect(x - 1, y1 - 30, 6, 2, P.rust);
  if (boarded) {
    for (let i = 0; i < 4; i++) b.rect(x - 2, y1 - 26 + i * 7, 8, 2, P.oak);
  }
}

function attic(
  b: PixelBuffer,
  put: (p: PixelBuffer, x: number, y: number, flip?: boolean) => void,
  lights: Light[],
  flames: Flame[],
  shafts: Shaft[],
): void {
  const floor = F.attic.floor;
  // Pared del hastial: tablones verticales oscuros bajo el tejado.
  for (let x = B.inL; x < B.inR; x++) {
    const top = Math.ceil(roofUnderside(x));
    if (top >= floor) continue;
    const plankIdx = Math.floor((x - B.inL) / 8);
    for (let y = top; y < floor; y++) {
      let c: string = plankIdx % 2 ? P.bark : P.rust;
      if ((x - B.inL) % 8 === 0) c = P.plum;
      if ((x * 5 + y * 3) % 23 === 0) c = P.plum;
      b.set(x, y, c);
    }
  }
  // Cabezas de cabios bajo el tejado y viga de atado con pendolón.
  for (let x = B.inL + 8; x < B.inR - 6; x += 16) {
    const y = Math.round(roofUnderside(x));
    b.rect(x, y, 5, 4, P.oak);
    b.hline(x, y, 5, P.clay);
    b.vline(x + 4, y + 1, 3, P.plum);
  }
  const collarY = 88;
  const cxL = ROOF.apexX - (collarY - (ROOF.apexY + ROOF.thick)) * 2;
  const cxR = ROOF.apexX + (collarY - (ROOF.apexY + ROOF.thick)) * 2;
  beam(b, cxL, collarY, cxR - cxL, 4, [P.black, P.plum, P.rust, P.oak]);
  post(b, ROOF.apexX - 2, ROOF.apexY + ROOF.thick, 4, collarY - ROOF.apexY - ROOF.thick, [
    P.black,
    P.plum,
    P.rust,
    P.oak,
  ]);
  // Ventana redonda del hastial.
  b.ellipse(ROOF.apexX, 72, 8.5, 8.5, P.oak);
  b.ellipse(ROOF.apexX, 72, 7, 7, (x, y) => (y < 72 + (bayer(x, y) - 0.5) * 4 ? P.slate : P.navy));
  b.rect(ROOF.apexX, 65, 1, 14, P.oak);
  b.rect(ROOF.apexX - 7, 72, 14, 1, P.oak);
  b.set(ROOF.apexX - 4, 68, P.fog);
  b.set(ROOF.apexX - 3, 67, P.mist);
  shafts.push({ x: ROOF.apexX - 6, y: 66, w: 12, h: 12, floor });
  // Despacho: mapa, escritorio, silla, librería, baúl, espada y armadura.
  put(Prop.wallMap(), 204, 97);
  put(Prop.bookshelf(), 172, floor - 40);
  put(Prop.desk(), 243, floor - 24);
  put(Prop.chair(), 292, floor - 24);
  b.rect(284, floor - 27, 2, 4, P.white);
  flames.push({ x: 284, y: floor - 28, kind: 'vela' });
  lights.push({ x: 285, y: floor - 26, r: 44, color: CANDLE, intensity: 0.9, flicker: 0.12 });
  put(Prop.trunk(), 310, floor - 16);
  put(Prop.sword(), 306, 106);
  put(Prop.armorStand(), 338, floor - 32);
  b.vline(300, collarY + 4, 6, P.slate);
  put(Prop.lanternBody(), 296, collarY + 10);
  lights.push({ x: 300, y: collarY + 16, r: 50, color: LANTERN, intensity: 0.8, flicker: 0.06 });
  // Trastos en los rincones bajos.
  put(Prop.rolledCarpet(), 110, floor - 9);
  put(Prop.crate(), 140, floor - 14);
  put(Prop.brokenChair(), 154, floor - 14);
  put(Prop.crate(), 382, floor - 14);
  put(Prop.barrel(), 398, floor - 17);
  cobweb(b, B.inL + 2, Math.ceil(roofUnderside(B.inL + 2)), 6, 1);
  cobweb(b, 214, Math.ceil(roofUnderside(214)) + 1, 6, 1);
  cobweb(b, 330, Math.ceil(roofUnderside(330)) + 1, 6, -1);
  // Sombra bajo el tejado.
  for (let x = B.inL; x < B.inR; x++) {
    const top = Math.ceil(roofUnderside(x));
    for (let k = 0; k < 4; k++) if (bayer(x, top + k) < 0.7 - k * 0.18) b.set(x, top + k, P.black);
  }
  ambientOcclusion(b, B.inL, floor - 8, B.inR - B.inL, 8, 6, {
    top: false,
    bottom: true,
    left: false,
    right: false,
  });
}

function yard(
  b: PixelBuffer,
  front: PixelBuffer,
  put: (p: PixelBuffer, x: number, y: number, flip?: boolean) => void,
  putFront: (p: PixelBuffer, x: number, y: number, flip?: boolean) => void,
  glows: Glow[],
  chapel: boolean,
): void {
  put(Prop.well(), 6, GROUND - 56);
  put(Prop.barrel(), 62, GROUND - 17);
  put(Prop.crate(), 50, GROUND - 13);
  put(Prop.doorLeaf(), 85, 245);
  // Farol de la puerta.
  b.hline(86, 238, 10, P.slate);
  b.set(86, 239, P.slate);
  b.vline(88, 239, 3, P.slate);
  put(Prop.lanternBody(), 84, 241);
  glows.push({ x: 89, y: 247, r: 18, color: LANTERN });
  // Brazo del letrero (el letrero se balancea en la escena).
  b.rect(58, 166, B.left - 58, 2, P.slate);
  b.hline(58, 165, B.left - 58, P.steel);
  b.line(B.left - 1, 172, B.left - 12, 167, P.slate);
  // Arbustos y valla delante.
  putFront(Prop.bush('b', 20, 12), 0, GROUND - 11);
  // Con capilla, la valla y el arbusto de la derecha dejan sitio al anexo.
  if (chapel) {
    putFront(Prop.bush('a', 12, 10), WORLD_W - 12, GROUND - 9);
    return;
  }
  putFront(Prop.bush('a', 26, 14), 434, GROUND - 13);
  for (let x = 484; x < WORLD_W; x += 9) {
    putFront(
      Prop.piece(3, 18, (p) => {
        p.rect(0, 0, 3, 18, P.rust);
        p.vline(0, 0, 18, P.oak);
      }),
      x,
      GROUND - 17,
    );
  }
  for (let x = 482; x < WORLD_W; x++) {
    front.set(x, GROUND - 13, P.oak);
    front.set(x, GROUND - 7, P.rust);
  }
}
