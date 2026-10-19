/**
 * Arte de la sala de mapas: más encargos en el tablón y, con nivel, el peligro real. En el
 * primer hueco, el mapa grande en la pared (más grande y con más alfileres con el nivel) y el
 * arcón de los rollos debajo; en los demás, el casillero de los mapas enrollados. Bajo la
 * ventana, la mesa con el mapa abierto, el compás y las velas; a su derecha, el catalejo
 * (nivel 3) o la bola del mundo.
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import {
  WALL,
  WIN_HALF,
  W,
  at,
  bx,
  candle,
  cellsOf,
  lampOver,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { candleOn, web } from './piezas';

// ---------- Piezas ----------

/** El mapa de la pared: con nivel, enmarcado, más grande y con más alfileres y caminos. */
function bigMap(level: number): PixelBuffer {
  const base = Prop.wallMap();
  if (level < 2) return base;
  return Prop.piece(base.w + 4, base.h + 4, (p) => {
    p.rect(0, 0, base.w + 4, base.h + 4, W[3]!);
    p.hline(0, 0, base.w + 4, W[5]!);
    p.blit(base, 2, 2);
    // Alfileres y la ruta marcada.
    const pins: [number, number, string][] = [
      [8, 8, P.red],
      [16, 18, P.red],
      [22, 9, P.lemon],
      [12, 14, P.wine],
    ];
    for (const [x, y, c] of pins.slice(0, level + 1)) {
      p.set(x, y, c);
      p.set(x, y + 1, P.black);
    }
    for (let x = 8; x < 22; x += 2) p.set(x, 8 + Math.round((x - 8) * 0.7), P.wine);
    if (level >= 3) {
      // La rosa de los vientos en una esquina.
      p.line(32, 18, 38, 18, P.slate);
      p.line(35, 15, 35, 21, P.slate);
      p.set(35, 15, P.red);
    }
  });
}

/** Casillero de madera con mapas enrollados (más rollos con el nivel). */
function scrollRack(level: number): PixelBuffer {
  return Prop.piece(26, 36, (p) => {
    p.rect(0, 0, 26, 36, W[2]!);
    p.rect(0, 0, 26, 2, W[4]!);
    p.hline(0, 0, 26, W[5]!);
    const rolls = [3, 6, 9][Math.min(2, level - 1)] ?? 3;
    let k = 0;
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 3; c++) {
        const x = 2 + c * 8;
        const y = 3 + r * 8;
        p.rect(x, y, 6, 6, W[1]!);
        if (k++ < rolls + r) {
          p.ellipse(x + 2, y + 3, 1.8, 1.8, (r + c) % 2 ? P.sand : P.tan);
          p.ellipse(x + 4, y + 4, 1.8, 1.8, (r + c) % 2 ? P.tan : P.sand);
          p.set(x + 2, y + 3, P.clay);
        }
      }
  });
}

/** Mesa de los mapas: el mapa abierto sujeto con piedras, el compás y, con nivel, velas. */
function mapTable(level: number): PixelBuffer {
  return Prop.piece(22, 18, (p) => {
    p.rect(0, 8, 22, 3, W[4]!);
    p.hline(0, 8, 22, W[5]!);
    p.hline(0, 10, 22, W[2]!);
    p.rect(2, 11, 3, 7, W[3]!);
    p.rect(17, 11, 3, 7, W[3]!);
    p.hline(5, 15, 12, W[2]!);
    // El mapa abierto, un poco caído por los lados.
    p.rect(3, 6, 16, 2, P.sand);
    p.hline(3, 6, 16, P.white);
    p.vline(2, 7, 3, P.sand);
    p.vline(19, 7, 3, P.tan);
    p.set(8, 7, P.forest);
    p.set(13, 7, P.ocean);
    p.set(11, 6, P.red);
    // Compás.
    p.line(15, 2, 13, 6, P.fog);
    p.line(15, 2, 17, 6, P.fog);
    if (level >= 2) {
      candleOn(p, 1, 6, 4);
      p.rect(0, 6, 4, 1, P.steel);
    }
    if (level >= 3) {
      // Un tintero con su pluma.
      p.rect(6, 4, 2, 2, P.black);
      p.line(7, 3, 9, 0, P.white);
    }
  });
}

/** Catalejo en su trípode, apuntando a la ventana. */
function telescope(): PixelBuffer {
  return Prop.piece(12, 30, (p) => {
    p.line(6, 12, 1, 29, W[3]!);
    p.line(6, 12, 11, 29, W[3]!);
    p.line(6, 12, 6, 29, W[2]!);
    p.line(10, 4, 1, 10, P.gold);
    p.line(10, 5, 1, 11, P.orange);
    p.line(9, 6, 2, 11, P.rust);
    p.rect(0, 9, 3, 3, P.gold);
    p.set(11, 4, P.lemon);
  });
}

/** Bola del mundo pequeña en su pie. */
function smallGlobe(): PixelBuffer {
  return Prop.piece(10, 16, (p) => {
    p.rect(2, 14, 6, 2, W[3]!);
    p.vline(5, 10, 4, W[3]!);
    p.ellipse(5, 5.5, 4.8, 4.8, P.gold);
    p.ellipse(5, 5.5, 4, 4, P.ocean);
    p.rect(3, 3, 3, 3, P.leaf);
    p.set(7, 7, P.leaf);
  });
}

/** Arcón con rollos asomando. */
function scrollChest(): PixelBuffer {
  return Prop.piece(22, 18, (p) => {
    p.blit(Prop.trunk(), 0, 4);
    for (const [x, y] of [
      [5, 0],
      [9, 1],
      [14, 0],
    ]) {
      p.rect(x!, y!, 2, 5, P.sand);
      p.set(x!, y!, P.tan);
    }
  });
}

// ---------- Pared y sala ----------

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  const c0 = cells[0]!;
  const winL = bx(c0.win - WIN_HALF);
  if (ruin) {
    // El mapa viejo, roto y descolgado de una esquina.
    const m = Prop.wallMap();
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) if (x + y > 40 && (x * 7 + y) % 3) m.clear(x, y);
    web(m, 1, 1, 1);
    b.blit(m, Math.round((winL - m.w) / 2), 16);
    return;
  }
  const map = bigMap(room.level);
  b.blit(map, Math.round((winL - map.w) / 2), 12);
  for (const c of cells) {
    // Sin ventana: la rosa de los vientos pintada donde iría.
    if (!c.glass) {
      const x = bx(c.win);
      b.ellipse(x, 22, 8, 8, P.sand);
      b.ellipse(x, 22, 7, 7, P.tan);
      b.line(x, 14, x, 30, P.wine);
      b.line(x - 8, 22, x + 8, 22, P.rust);
      b.set(x, 14, P.red);
    }
  }
}

function things(room: Room, w: number): Thing[] {
  const lvl = room.level;
  const cells = cellsOf(room, w);
  const t: Thing[] = [lampOver(cells, w)];
  for (const c of cells) {
    t.push(at(c.i === 0 ? scrollChest() : scrollRack(lvl), c.x0 + 33, WALL));
    t.push(at(mapTable(lvl), c.win, WALL, 0, lvl >= 2 ? candle(14) : undefined));
    const rx = Math.min(c.win + WIN_HALF + 8, c.x1 - 8.5);
    if (lvl >= 3 && c.i === 0) t.push(at(telescope(), rx, WALL));
    else if (lvl >= 2) t.push(at(smallGlobe(), rx, WALL));
  }
  return t;
}

function ruin(room: Room, w: number): Thing[] {
  return cellsOf(room, w).flatMap((c) => [
    at(Prop.trunk(), c.x0 + 33, WALL),
    at(Prop.brokenChair(), c.win, WALL - 4),
  ]);
}

export const mapas: RoomArt = { wall, things, ruin, ownLamp: true };
