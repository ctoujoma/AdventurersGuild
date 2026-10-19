/**
 * Arte de la armería: el equipo para los que salen de misión. En cada hueco, a la izquierda de
 * la ventana, el estante con el equipo sin dueño colgado (tres huecos por fila: una fila por
 * nivel) y debajo los arcones con lo que no cabe; bajo la ventana, el barril de armas y, desde
 * el nivel 2, la armadura en su soporte; a la derecha, un escudo colgado y la muela de afilar.
 * Por reparar, todo el equipo va en arcones y una vela deja verlos.
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import { RACK_SLOTS, RACK_Y, gearChests, gearRack } from './equipo';
import {
  WALL,
  WIN_HALF,
  W,
  at,
  bx,
  candle,
  cellsOf,
  lampOver,
  stretchesOf,
  worldW,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { candleOn, web } from './piezas';

// ---------- Piezas ----------

/** Barril con lanzas, espadas y un hacha asomando (más bajo que el alféizar). */
function weaponBarrel(): PixelBuffer {
  return Prop.piece(14, 30, (p) => {
    // Astas y hojas.
    p.vline(3, 2, 16, W[4]!);
    p.set(3, 0, P.white);
    p.hline(2, 1, 3, P.mist);
    p.vline(10, 4, 14, W[5]!);
    p.rect(9, 1, 3, 3, P.fog);
    p.vline(6, 6, 12, P.mist);
    p.vline(7, 6, 12, P.fog);
    p.hline(5, 12, 4, P.gold);
    p.rect(4, 5, 2, 3, P.steel);
    // El barril.
    p.blit(Prop.barrel(), 1, 15);
  });
}

/** Muela de afilar: la rueda de piedra con su manivela, en un bastidor sobre la artesa. */
function grindstone(): PixelBuffer {
  return Prop.piece(14, 17, (p) => {
    // Artesa con agua.
    p.rect(1, 12, 12, 5, W[3]!);
    p.hline(1, 12, 12, W[4]!);
    p.hline(2, 13, 10, P.ocean);
    // Bastidor.
    p.vline(1, 2, 10, W[2]!);
    p.vline(12, 2, 10, W[2]!);
    // Rueda con su eje.
    p.ellipse(6.5, 6.5, 5.5, 5.5, P.slate);
    p.ellipse(6.5, 6.5, 4.5, 4.5, P.fog);
    p.ellipse(5.5, 5.5, 2, 2, P.mist);
    p.set(6, 6, P.slate);
    p.hline(1, 6, 12, P.steel);
    // Manivela.
    p.line(13, 6, 13, 2, P.steel);
    p.set(12, 2, W[4]!);
  });
}

/** Escudo de cometa colgado en la pared, con la cruz del gremio. */
function kiteShield(field: string, dark: string): PixelBuffer {
  return Prop.piece(10, 14, (p) => {
    for (let y = 0; y < 14; y++) {
      const hw = y < 7 ? 5 : Math.max(0, 5 - Math.ceil((y - 6) * 0.75));
      if (hw <= 0) continue;
      p.hline(5 - hw, y, hw * 2, field);
      p.set(5 - hw, y, P.gold);
      p.set(4 + hw, y, dark);
    }
    p.hline(0, 0, 10, P.gold);
    p.vline(4, 1, 11, P.gold);
    p.hline(1, 5, 8, P.gold);
  });
}

/** Estante roto de la armería por reparar: la tabla partida y las clavijas vacías. */
function brokenRack(b: PixelBuffer, x: number, y: number) {
  b.rect(x, y, 44, 2, P.bark);
  b.line(x + 20, y + 2, x + 30, y + 12, P.bark);
  b.line(x + 21, y + 2, x + 31, y + 12, P.rust);
  for (let k = 0; k < 3; k++) b.rect(x + 6 + k * 14, y + 6, 2, 2, P.oak);
}

// ---------- Pared y sala ----------

/** Bastidor bajo con escudos redondos apoyados (cabe bajo una ventana). */
function shieldStand(field: string, dark: string): PixelBuffer {
  return Prop.piece(28, 18, (p) => {
    p.rect(0, 15, 28, 3, W[3]!);
    p.hline(0, 15, 28, W[4]!);
    p.hline(0, 6, 28, W[3]!);
    for (const [cx, c] of [
      [6, W[4]!],
      [14, field],
      [22, P.steel],
    ] as const) {
      p.ellipse(cx, 10, 5.5, 5.5, c === field ? P.gold : P.slate);
      p.ellipse(cx, 10, 4.5, 4.5, c);
      if (c === field) p.rect(cx, 6, 4, 9, dark);
      p.ellipse(cx, 10, 1.2, 1.2, P.fog);
    }
  });
}

function wall(b: PixelBuffer, _room: Room, look: SalonLook, { cells, ruin }: WallCtx): void {
  const w = cells.at(-1)!.x1;
  if (ruin) {
    for (const s of stretchesOf(_room, w)) if (s.kind !== 'right') brokenRack(b, bx(s.x0) + 4, 24);
    return;
  }
  const last = cells.at(-1)!;
  const winR = bx(last.win + WIN_HALF);
  if (bx(last.x1) - winR >= 11) b.blit(kiteShield(look.crest.field, look.crest.dark), winR + 1, 16);
  // Sin ventana, en su sitio: lanzas cruzadas, el pendón del gremio o dos hachas.
  cells.forEach((c, j) => {
    if (c.glass) return;
    const x = bx(c.win);
    if (j % 3 === 1) {
      b.hline(x - 7, 12, 14, W[3]!);
      b.rect(x - 6, 13, 12, 18, look.crest.field);
      b.vline(x - 6, 13, 18, look.crest.dark);
      b.vline(x + 5, 13, 18, look.crest.dark);
      for (let k = 0; k < 3; k++) b.hline(x - 6 + k, 31 + k, 12 - k * 2, look.crest.field);
      b.rect(x - 2, 18, 4, 5, P.gold);
      return;
    }
    const axe = j % 3 === 2;
    b.line(x - 9, 14, x + 9, 34, W[4]!);
    b.line(x + 9, 14, x - 9, 34, W[4]!);
    for (const sx of [-1, 1]) {
      if (axe) {
        b.rect(x + sx * 9 - (sx < 0 ? 0 : 3), 13, 4, 5, P.steel);
        b.vline(x + sx * 9 + (sx < 0 ? 0 : 0), 13, 5, P.mist);
      } else {
        b.hline(x + sx * 9 - 1, 13, 3, P.mist);
        b.set(x + sx * 9, 12, P.white);
      }
    }
  });
}

/**
 * Un estante de equipo por hueco (con los arcones de lo que no cabe debajo). En la pequeña,
 * a la izquierda; en las anchas, también en cada tramo de en medio, junto a una armadura (el
 * primero) o al barril de armas (el segundo). Bajo las ventanas: la armadura o el barril, el
 * bastidor de escudos…
 */
function things(room: Room, w: number, look: SalonLook): Thing[] {
  const lvl = room.level;
  const cells = cellsOf(room, w);
  const gear = look.gearRoom === room.id ? look.gear : [];
  const per = RACK_SLOTS[Math.min(lvl, 3)]!;
  const t: Thing[] = [lampOver(cells, w, lvl)];
  let extra = Math.max(0, gear.length - per * cells.length);
  const chestW = worldW(Prop.chest(), WALL) + 1;
  let k = 0;
  const rackAt = (x: number) => {
    const rack = gearRack(gear.slice(k * per, (k + 1) * per), per);
    k++;
    t.push(at(rack, x, WALL, RACK_Y));
    if (extra > 0) {
      // Centrados debajo del estante.
      const n = Math.min(3, Math.ceil(extra / 3));
      t.push(...gearChests(n * 3, x - ((n - 1) * chestW) / 2, 1));
      extra -= n * 3;
    }
  };
  const rackW = worldW(gearRack([], per), WALL);
  for (const s of stretchesOf(room, w)) {
    if (s.kind === 'left') rackAt(s.x0 + 33);
    else if (s.kind === 'mid') {
      const side = s.i === 1 ? Prop.armorStand() : weaponBarrel();
      const sw = worldW(side, WALL);
      const gap = (s.x1 - s.x0 - rackW - sw) / 3;
      if (s.i === 1) {
        rackAt(s.x0 + gap + rackW / 2);
        t.push(at(side, s.x1 - gap - sw / 2, WALL));
      } else {
        t.push(at(side, s.x0 + gap + sw / 2, WALL));
        rackAt(s.x1 - gap - rackW / 2);
      }
    } else if (lvl >= 2) t.push(at(grindstone(), Math.min(s.x0 + 7, w - 9), WALL - 2));
  }
  cells.forEach((c, j) => {
    if (extra > 0) {
      t.push(at(Prop.chest(), c.win, WALL), at(Prop.chest(), c.win, WALL, 11));
      extra -= 6;
    } else if (j === 1) t.push(at(shieldStand(look.crest.field, look.crest.dark), c.win, WALL));
    else t.push(at(lvl >= 2 && j === 0 ? Prop.armorStand() : weaponBarrel(), c.win, WALL));
  });
  return t;
}

/** Por reparar: el equipo, todo en arcones (con una vela para verlos), y una caja. */
function ruin(room: Room, w: number, look: SalonLook): Thing[] {
  const gear = look.gearRoom === room.id ? look.gear : [];
  const cells = cellsOf(room, w);
  const t: Thing[] = [];
  if (gear.length) {
    t.push(...gearChests(gear.length, cells[0]!.x0 + 13, 1));
    const lit = Prop.piece(6, 6, (p) => {
      p.rect(1, 4, 4, 2, P.slate);
      candleOn(p, 2, 4, 3);
    });
    t.push(at(lit, cells[0]!.x0 + 13, WALL - 1, 16, candle(4, 40, 0.5)));
  }
  for (const c of cells) {
    const crate = Prop.crate();
    web(crate, 1, 1, 1);
    t.push(at(crate, c.win, WALL));
  }
  return t;
}

export const armeria: RoomArt = { wall, things, ruin, ownLamp: true };
