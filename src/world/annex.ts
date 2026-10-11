import { P, R } from '../art/palette';
import { PixelBuffer, bayer } from '../art/pixel';
import type { Ambient, Flame, Glow, Light, RGB } from './build';
import { F, GROUND, ROOMS } from './geometry';
import { ambientOcclusion, stoneWall } from './paint';
import { armorStand, floorSlab, piece } from './props';

/**
 * Las instalaciones que hacen crecer el edificio: la sala de mapas del desván, la armería
 * de la bodega y la capilla, un anexo de piedra pegado a la derecha de la casa.
 */

type Put = (p: PixelBuffer, x: number, y: number, flip?: boolean) => void;

const W = R.wood; // [black, plum, bark, rust, oak, clay, tan]
const CANDLE: RGB = [255, 160, 90];

/** Dónde está la capilla (muros exteriores) y su tejado. */
export const CHAPEL = { x0: 436, x1: 500, top: 238, apexX: 468, apexY: 208 } as const;
/** Rincón de la bodega reservado a la armería. */
export const ARMORY_X = 284;

// ---------- Piezas ----------

function routeMap(): PixelBuffer {
  return piece(28, 18, (b) => {
    b.rect(0, 0, 28, 18, P.sand);
    for (let y = 0; y < 18; y++)
      for (let x = 0; x < 28; x++) if (bayer(x, y) < 0.15) b.set(x, y, P.tan);
    // Caminos punteados entre ciudades.
    const towns = [
      [4, 4],
      [13, 11],
      [23, 5],
      [20, 14],
    ] as const;
    for (let i = 0; i < towns.length - 1; i++) {
      const [ax, ay] = towns[i]!;
      const [bx, by] = towns[i + 1]!;
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let k = 0; k <= n; k += 2)
        b.set(Math.round(ax + ((bx - ax) * k) / n), Math.round(ay + ((by - ay) * k) / n), P.clay);
    }
    for (const [x, y] of towns) b.rect(x - 1, y - 1, 2, 2, P.rust);
    b.rect(0, 17, 28, 1, P.clay);
  });
}

function mapBasket(): PixelBuffer {
  return piece(12, 18, (b) => {
    // Rollos de mapas asomando.
    for (const [x, h, c] of [
      [2, 10, P.sand],
      [5, 12, P.tan],
      [8, 9, P.sand],
    ] as const) {
      b.rect(x, 0 + (12 - h), 2, h, c);
      b.set(x, 12 - h, P.white);
    }
    b.rect(0, 9, 12, 9, W[3]!);
    for (let y = 10; y < 18; y += 2) b.hline(0, y, 12, W[4]!);
    b.vline(3, 9, 9, W[2]!);
    b.vline(8, 9, 9, W[2]!);
  });
}

function telescope(): PixelBuffer {
  return piece(22, 30, (b) => {
    // Trípode.
    b.line(10, 14, 3, 29, W[3]!);
    b.line(11, 14, 18, 29, W[3]!);
    b.line(10, 14, 11, 29, W[2]!);
    // Tubo mirando a la ventana redonda.
    b.line(2, 18, 20, 4, P.gold);
    b.line(2, 19, 20, 5, P.amber);
    b.line(3, 19, 19, 6, W[4]!);
    b.rect(18, 2, 3, 4, P.gold);
    b.set(20, 2, P.lemon);
    b.rect(1, 18, 3, 3, W[2]!);
  });
}

function globe(): PixelBuffer {
  return piece(11, 14, (b) => {
    b.ellipse(5, 5, 4.5, 4.5, (x, y) => ((x * 3 + y * 5) % 7 < 3 ? P.leaf : P.ocean));
    b.set(3, 3, P.sky);
    b.set(4, 2, P.cyan);
    b.line(1, 9, 9, 1, P.gold);
    b.vline(5, 10, 2, W[3]!);
    b.rect(2, 12, 7, 2, W[3]!);
  });
}

function weaponRack(): PixelBuffer {
  return piece(24, 32, (b) => {
    b.rect(0, 10, 2, 22, W[3]!);
    b.rect(22, 10, 2, 22, W[3]!);
    b.rect(0, 14, 24, 2, W[4]!);
    b.rect(0, 28, 24, 2, W[4]!);
    // Lanza, dos espadas y un hacha.
    b.vline(4, 0, 30, W[4]!);
    b.rect(3, 0, 3, 3, P.mist);
    b.set(4, 0, P.white);
    for (const x of [9, 14]) {
      b.vline(x, 8, 18, P.mist);
      b.vline(x + 1, 8, 18, P.fog);
      b.set(x, 7, P.white);
      b.rect(x - 1, 25, 4, 1, P.gold);
      b.rect(x, 26, 2, 3, W[2]!);
    }
    b.vline(19, 6, 24, W[3]!);
    b.rect(17, 6, 5, 5, P.steel);
    b.rect(17, 6, 2, 5, P.fog);
  });
}

function shield(emblem: string): PixelBuffer {
  return piece(13, 13, (b) => {
    b.ellipse(6, 6, 6, 6, P.steel);
    b.ellipse(6, 6, 5, 5, (x, y) => ((x + y) % 5 === 0 ? W[2]! : W[3]!));
    b.rect(5, 1, 3, 11, emblem);
    b.rect(1, 5, 11, 3, emblem);
    b.ellipse(6, 6, 1.6, 1.6, P.mist);
  });
}

function anvil(): PixelBuffer {
  return piece(18, 14, (b) => {
    b.rect(5, 8, 8, 6, W[3]!);
    b.hline(5, 8, 8, W[4]!);
    b.rect(2, 2, 14, 3, P.slate);
    b.hline(2, 2, 14, P.fog);
    b.rect(0, 2, 3, 2, P.slate);
    b.rect(6, 5, 6, 3, P.navy);
  });
}

function bell(): PixelBuffer {
  return piece(9, 9, (b) => {
    b.rect(3, 0, 3, 2, P.amber);
    b.rect(2, 2, 5, 4, P.gold);
    b.rect(1, 6, 7, 2, P.gold);
    b.vline(2, 2, 5, P.lemon);
    b.rect(4, 8, 1, 1, P.amber);
  });
}

function pew(): PixelBuffer {
  return piece(16, 10, (b) => {
    b.rect(0, 4, 16, 2, W[4]!);
    b.hline(0, 4, 16, W[5]!);
    b.rect(0, 0, 2, 10, W[3]!);
    b.rect(14, 6, 2, 4, W[3]!);
    b.rect(1, 6, 2, 4, W[3]!);
  });
}

// ---------- Sala de mapas (desván) ----------

export function mapRoom(
  b: PixelBuffer,
  put: Put,
  level: number,
  flames: Flame[],
  lights: Light[],
): void {
  if (level <= 0) return;
  const floor = F.attic.floor;
  put(routeMap(), 250, 90);
  put(mapBasket(), 362, floor - 18);
  // Hilo rojo entre los alfileres del mapa grande y el pequeño.
  b.line(214, 106, 227, 110, P.red);
  b.line(227, 110, 254, 95, P.red);
  if (level >= 2) {
    b.line(223, 102, 263, 101, P.red);
    put(telescope(), 222, floor - 30);
    put(globe(), 262, floor - 37);
    b.rect(352, floor - 26, 2, 4, P.white);
    flames.push({ x: 352, y: floor - 27, kind: 'vela' });
    lights.push({ x: 353, y: floor - 25, r: 36, color: CANDLE, intensity: 0.8, flicker: 0.14 });
  }
}

// ---------- Armería (bodega) ----------

export function armory(b: PixelBuffer, put: Put, level: number): void {
  if (level <= 0) return;
  const { y0, y1 } = ROOMS.cellar;
  put(weaponRack(), ARMORY_X, y1 - 32);
  put(shield(P.wine), ARMORY_X + 28, y0 + 22);
  put(shield(P.ocean), ARMORY_X + 40, y0 + 26);
  if (level >= 2) {
    put(armorStand(), ARMORY_X + 26, y1 - 30);
    put(anvil(), ARMORY_X + 40, y1 - 14);
    b.hline(ARMORY_X + 24, y1, 34, P.black);
  }
}

// ---------- Capilla (anexo) ----------

export function chapel(
  b: PixelBuffer,
  put: Put,
  level: number,
  fallen: number,
  lights: Light[],
  flames: Flame[],
  glows: Glow[],
  ambient: Ambient[],
): void {
  if (level <= 0) return;
  const { x0, x1, top, apexX, apexY } = CHAPEL;
  const floor = F.hall.floor;
  const slope = (top - apexY) / (apexX - x0 + 6);
  const underside = (x: number) => apexY + 7 + Math.abs(x - apexX) * slope;

  // Muros, cimientos e interior de piedra clara.
  stoneWall(b, x0, top - 4, x1 - x0, GROUND - top + 10, 'capilla', { moss: 8 });
  for (let x = x0 + 4; x < x1 - 4; x++) {
    const yTop = Math.ceil(underside(x));
    for (let y = yTop; y < floor; y++) {
      const brick = ((y >> 2) + ((x + ((y >> 2) % 2) * 4) >> 3)) % 2;
      b.set(x, y, bayer(x, y) < 0.12 ? P.slate : brick ? P.steel : P.fog);
      if (y % 4 === 0 && bayer(x, y) < 0.6) b.set(x, y, P.slate);
    }
  }
  // Hornacina tras el altar.
  for (let y = 250; y < floor; y++) {
    const half = y < 258 ? Math.round(Math.sqrt(Math.max(0, 64 - (258 - y) ** 2))) : 8;
    for (let x = apexX - half; x <= apexX + half; x++) b.set(x, y, (x + y) % 2 ? P.navy : P.slate);
  }
  // Sol dorado, símbolo del templo.
  b.ellipse(apexX, 262, 4, 4, P.gold);
  b.ellipse(apexX - 1, 261, 1.6, 1.6, P.lemon);
  for (const [dx, dy] of [
    [0, -7],
    [0, 7],
    [-7, 0],
    [7, 0],
    [-5, -5],
    [5, -5],
    [-5, 5],
    [5, 5],
  ] as const)
    b.set(apexX + dx, 262 + dy, P.gold);
  glows.push({ x: apexX, y: 262, r: 10, color: [254, 200, 90] });

  // Altar con mantel.
  b.rect(apexX - 10, floor - 11, 20, 11, P.steel);
  b.hline(apexX - 10, floor - 11, 20, P.fog);
  b.rect(apexX - 11, floor - 13, 22, 3, P.white);
  b.rect(apexX - 6, floor - 10, 12, 6, P.mist);
  b.hline(apexX - 6, floor - 5, 12, P.gold);
  b.rect(apexX - 1, floor - 10, 2, 6, P.gold);

  // Una vela por cada caído, en la repisa y sobre el altar.
  const spots = [-8, -4, 4, 8, -15, 15, -19, 19, -12, 12];
  const n = Math.min(fallen, spots.length);
  b.rect(x0 + 6, floor - 6, x1 - x0 - 12, 2, P.slate);
  b.hline(x0 + 6, floor - 6, x1 - x0 - 12, P.fog);
  for (let i = 0; i < n; i++) {
    const dx = spots[i]!;
    const onAltar = Math.abs(dx) <= 8;
    const cy = onAltar ? floor - 16 : floor - 9;
    const h = 2 + ((i * 7) % 3);
    b.rect(apexX + dx, cy - h + 3, 1, h, P.white);
    flames.push({ x: apexX + dx, y: cy - h + 2, kind: 'vela' });
  }
  if (n)
    lights.push({
      x: apexX,
      y: floor - 18,
      r: 30 + Math.min(n, 8) * 3,
      color: CANDLE,
      intensity: 0.75 + Math.min(n, 8) * 0.03,
      flicker: 0.12,
    });

  if (level >= 2) {
    // Vidriera redonda que brilla de noche, y bancos.
    const vy = top - 8;
    b.ellipse(apexX, vy, 6.5, 6.5, P.slate);
    b.ellipse(apexX, vy, 5, 5, (x, y) => {
      const a = Math.atan2(y - vy, x - apexX);
      const k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 6) % 6;
      return [P.wine, P.gold, P.ocean, P.leaf, P.rose, P.sky][k]!;
    });
    b.ellipse(apexX, vy, 1.5, 1.5, P.lemon);
    glows.push({ x: apexX, y: vy, r: 12, color: [200, 140, 220] });
    put(pew(), x0 + 6, floor - 10);
    put(pew(), x1 - 22, floor - 10, true);
  }

  // Suelo, sombra en los rincones y luz ambiente.
  floorSlab(b, x0, floor, x1 - x0, 'capilla');
  ambientOcclusion(b, x0 + 4, apexY + 7, x1 - x0 - 8, floor - apexY - 7, 6);
  ambient.push({
    poly: [
      [x0 + 4, underside(x0 + 4)],
      [apexX, apexY + 7],
      [x1 - 4, underside(x1 - 4)],
      [x1 - 4, floor],
      [x0 + 4, floor],
    ],
    color: [92, 84, 132],
  });

  // Tejado de tejas a dos aguas.
  for (let y = apexY; y <= top; y++) {
    const half = Math.round((y - apexY) / slope);
    for (let x = apexX - half - 2; x <= apexX + half + 2; x++) {
      if (y > apexY + 6 && x > apexX - half + 5 && x < apexX + half - 5) continue;
      const row = Math.floor((y - apexY) / 3);
      const edge = x <= apexX - half || x >= apexX + half;
      b.set(x, y, edge ? P.plum : row % 2 ? P.brick : (x + row) % 4 === 0 ? P.rust : P.amber);
    }
  }
  b.hline(
    apexX - Math.round((top - apexY) / slope) - 2,
    top + 1,
    2 * Math.round((top - apexY) / slope) + 5,
    P.plum,
  );
  // Espadaña con campana a nivel 2; cruz de remate siempre.
  if (level >= 2) {
    const by = apexY - 14;
    b.rect(apexX - 6, by, 2, 14, P.steel);
    b.rect(apexX + 4, by, 2, 14, P.steel);
    b.rect(apexX - 7, by - 2, 14, 2, P.brick);
    b.hline(apexX - 7, by - 3, 14, P.amber);
    put(bell(), apexX - 4, by + 2);
    b.vline(apexX, by - 8, 5, P.gold);
    b.hline(apexX - 2, by - 6, 5, P.gold);
  } else {
    b.vline(apexX, apexY - 7, 7, P.gold);
    b.hline(apexX - 2, apexY - 5, 5, P.gold);
  }
}
