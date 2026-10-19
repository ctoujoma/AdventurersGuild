/**
 * Arte de la cámara del tesoro: guarda el oro del gremio y no tiene ventanas. En el primer
 * hueco, la puerta de la caja fuerte empotrada en la pared, que es su cerradura: de tablas con
 * un candado (nivel 1), de hierro con cerrojos (2) y redonda con su rueda (3). Delante y en los
 * demás huecos, arcones, sacos de monedas y montones de oro que crecen con el nivel; en el 3,
 * un ídolo de oro en su peana. El oro da su brillo. Sin armería, el equipo sin dueño también se
 * guarda aquí, en arcones.
 */
import { P } from '../../../art/palette';
import { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import * as Prop from '../../props';
import type { SalonLook } from '../salon';
import { gearChests } from './equipo';
import {
  GOLD,
  WALL,
  WIN_HALF,
  W,
  at,
  bx,
  cellsOf,
  row,
  stretchesOf,
  type Glow,
  type RoomArt,
  type Thing,
  type WallCtx,
} from './kit';
import { candleOn, sack, web } from './piezas';

const SHINE = (r: number, power = 0.5): Glow => ({
  dy: 4,
  r,
  color: GOLD,
  power,
  flicker: 0.05,
});

// ---------- Piezas ----------

/** La puerta de la caja fuerte, empotrada en la pared (en el fondo): su cerradura es el nivel. */
function vaultDoor(level: number): PixelBuffer {
  return Prop.piece(26, 30, (p) => {
    // Marco de piedra.
    p.rect(0, 0, 26, 30, P.slate);
    p.rect(1, 1, 24, 28, P.steel);
    p.hline(1, 1, 24, P.fog);
    if (level >= 3) {
      // Redonda, con remaches dorados, la rueda y los cerrojos.
      p.rect(2, 2, 22, 26, P.black);
      p.ellipse(13, 15, 11, 11, P.slate);
      p.ellipse(13, 15, 10, 10, P.steel);
      p.ellipse(12, 14, 7, 7, P.fog);
      for (let a = 0; a < 12; a++) {
        const t = (a / 12) * Math.PI * 2;
        p.set(Math.round(13 + Math.cos(t) * 9.5), Math.round(15 + Math.sin(t) * 9.5), P.gold);
      }
      p.line(9, 11, 17, 19, P.slate);
      p.line(17, 11, 9, 19, P.slate);
      p.hline(8, 15, 11, P.slate);
      p.vline(13, 10, 11, P.slate);
      p.ellipse(13, 15, 2, 2, P.gold);
      p.set(12, 14, P.lemon);
      return;
    }
    if (level >= 2) {
      // De hierro, con remaches, dos cerrojos y una cerradura grande.
      p.rect(3, 3, 20, 24, P.slate);
      p.rect(4, 4, 18, 22, P.steel);
      for (let y = 6; y < 26; y += 5) for (const x of [5, 20]) p.set(x, y, P.mist);
      for (const y of [8, 20]) {
        p.rect(14, y, 9, 2, P.navy);
        p.hline(14, y, 9, P.fog);
      }
      p.rect(8, 11, 6, 8, P.gold);
      p.rect(9, 12, 4, 6, P.orange);
      p.rect(10, 13, 2, 3, P.black);
      p.set(10, 16, P.black);
      return;
    }
    // De tablas con dos herrajes y un candado.
    p.rect(3, 3, 20, 24, W[3]!);
    for (let x = 3; x < 23; x += 4) p.vline(x, 3, 24, W[2]!);
    for (const y of [7, 21]) {
      p.hline(3, y, 20, P.slate);
      p.hline(3, y + 1, 20, P.navy);
    }
    p.rect(16, 13, 4, 2, P.slate);
    p.ellipse(18, 17, 2.5, 2, P.steel);
    p.set(18, 17, P.black);
  });
}

/**
 * Montón de monedas: un cerro de capas de monedas (cada una, una rayita con su brillo arriba y
 * su sombra abajo), con destellos y monedas sueltas al pie. `amount` (0–1) dice lo grande que es.
 */
export function goldPile(amount: number, wide = 1): PixelBuffer {
  const a = Math.max(0, Math.min(1, amount));
  const w = Math.round((14 + a * 16) * wide);
  const h = Math.round(3 + a * 13 * Math.min(1.4, wide));
  return Prop.piece(w + 6, h + 3, (p) => {
    const cx = (w + 6) / 2;
    const base = h + 1;
    // Cuerpo del cerro, de la sombra a la luz.
    p.ellipse(cx, base, w / 2, h, P.brick);
    p.ellipse(cx - 0.5, base, w / 2 - 1, h - 1, P.orange);
    p.ellipse(cx - 1.5, base - 0.5, w / 2 - 3, h - 2.5, P.gold);
    // Monedas en filas: rayita de oro claro con su borde oscuro debajo.
    for (let y = base - h + 2; y < base; y += 2)
      for (let x = 1 + ((y >> 1) % 2) * 2; x < w + 5; x += 4) {
        if (p.get(x, y) === 0 || p.get(x + 2, y) === 0) continue;
        p.hline(x, y, 2, P.lemon);
        p.set(x, y + 1, P.orange);
        p.set(x + 1, y + 1, P.brick);
      }
    // Destellos.
    p.set(Math.round(cx - w / 5), base - h + 2, P.white);
    if (a > 0.5) p.set(Math.round(cx + w / 6), base - Math.round(h * 0.6), P.white);
    // Monedas sueltas al pie.
    for (const dx of [-w / 2 - 1, w / 2 + 1, -w / 3, w / 2.5]) {
      const x = Math.round(cx + dx);
      p.hline(x - 1, base + 1, 2, P.gold);
      p.set(x, base, P.lemon);
    }
  });
}

/** Saco de monedas atado, con unas cuantas por el suelo. */
function coinSack(): PixelBuffer {
  return Prop.piece(12, 11, (p) => {
    sack(p, 0, 1, [P.rust, P.clay, P.tan]);
    p.set(4, 3, P.gold);
    for (const x of [9, 11]) {
      p.hline(x - 1, 10, 2, P.gold);
      p.set(x, 9, P.lemon);
    }
  });
}

/** Arcón: cerrado si está vacío; abierto con el oro a la altura de `amount` (rebosando a 1). */
function goldChest(amount: number, gems: boolean): PixelBuffer {
  if (amount <= 0) return Prop.chest();
  return Prop.piece(18, 16, (p) => {
    p.blit(Prop.chest(true), 1, 4);
    // Tapa abierta hacia atrás.
    p.rect(1, 1, 16, 3, W[4]!);
    p.hline(1, 1, 16, W[5]!);
    // El oro de dentro (y, lleno, rebosando por delante).
    const top = 8 - Math.round(amount * 3);
    p.ellipse(9, top + 1, 7, 1.5 + amount, P.gold);
    for (let x = 4; x < 15; x += 3) p.set(x, top, P.lemon);
    if (amount >= 1) {
      p.vline(5, 9, 4, P.gold);
      p.vline(12, 9, 5, P.gold);
      p.set(12, 14, P.lemon);
      p.hline(3, 15, 3, P.gold);
    }
    if (gems && amount >= 0.5) {
      p.set(6, top, P.red);
      p.set(10, top - 1, P.cyan);
      p.set(13, top, P.lime);
    }
  });
}

/** Mesa con pilas de monedas contadas (más pilas cuanto más oro). */
function coinStacks(amount: number): PixelBuffer {
  return Prop.piece(28, 22, (p) => {
    p.rect(0, 12, 28, 3, W[4]!);
    p.hline(0, 12, 28, W[5]!);
    p.rect(2, 15, 3, 7, W[3]!);
    p.rect(23, 15, 3, 7, W[3]!);
    const n = Math.round(amount * 6);
    for (let k = 0; k < n; k++) {
      const x = 2 + k * 4;
      const hh = 3 + ((k * 5) % 4) + Math.round(amount * 3);
      p.rect(x, 12 - hh, 3, hh, P.gold);
      for (let y = 12 - hh; y < 12; y += 2) p.hline(x, y, 3, P.orange);
      p.hline(x, 12 - hh, 3, P.lemon);
    }
    // El libro de cuentas.
    p.rect(19, 9, 7, 3, P.wine);
    p.hline(19, 9, 7, P.white);
  });
}

/** Caja fuerte de hierro con remaches (en el tramo de en medio). */
function strongbox(): PixelBuffer {
  return Prop.piece(20, 16, (p) => {
    p.rect(0, 2, 20, 14, P.slate);
    p.rect(1, 3, 18, 12, P.steel);
    p.hline(0, 2, 20, P.fog);
    for (let x = 2; x < 19; x += 4) {
      p.set(x, 4, P.mist);
      p.set(x, 13, P.mist);
    }
    p.rect(8, 6, 4, 5, P.gold);
    p.set(9, 8, P.black);
  });
}

/** Ídolo de oro en su peana de piedra. */
function idol(): PixelBuffer {
  return Prop.piece(14, 28, (p) => {
    p.rect(1, 18, 12, 10, P.steel);
    p.hline(1, 18, 12, P.fog);
    p.rect(0, 17, 14, 2, P.mist);
    // Figura sentada.
    p.ellipse(7, 5, 3, 3, P.gold);
    p.set(6, 4, P.black);
    p.set(8, 4, P.black);
    p.rect(4, 8, 6, 6, P.gold);
    p.rect(3, 13, 8, 4, P.orange);
    p.vline(4, 8, 6, P.lemon);
    p.set(7, 1, P.cyan);
  });
}

/** Repisa de pared con copas y una bandeja de oro (desde el nivel 2). */
function goblets(level: number): PixelBuffer {
  return Prop.piece(22, 12, (p) => {
    p.rect(0, 10, 22, 2, W[4]!);
    p.hline(0, 10, 22, W[5]!);
    p.ellipse(5, 5, 4, 4, P.orange);
    p.ellipse(5, 5, 3, 3, P.gold);
    p.set(4, 3, P.lemon);
    for (const x of [12, 17]) {
      if (x === 17 && level < 3) continue;
      p.rect(x, 3, 3, 3, P.gold);
      p.set(x + 1, 6, P.orange);
      p.vline(x + 1, 7, 2, P.gold);
      p.hline(x, 9, 3, P.orange);
    }
  });
}

// ---------- Pared y sala ----------

function wall(b: PixelBuffer, room: Room, _look: SalonLook, { cells, ruin }: WallCtx): void {
  const lvl = room.level;
  cells.forEach((c, j) => {
    const x = bx(c.win);
    if (j === 0) {
      // La caja fuerte (por reparar, la de tablas, rota) y, encima de los arcones, las copas.
      const d = vaultDoor(ruin ? 1 : lvl);
      if (ruin) web(d, 2, 2, 1);
      b.blit(d, x - 13, 12);
      if (!ruin && lvl >= 2) b.blit(goblets(lvl), bx(c.x0 + 26) - 11, 22);
    } else if (!ruin && lvl >= 2) {
      // Copas en el segundo sitio; en el tercero, un escudo de oro colgado.
      if (j === 1) b.blit(goblets(lvl), x - 11, 18);
      else {
        b.ellipse(x, 22, 8, 8, P.orange);
        b.ellipse(x - 0.5, 21.5, 7, 7, P.gold);
        b.ellipse(x, 22, 3, 3, P.lemon);
        b.set(x - 4, 17, P.white);
        b.line(x - 6, 22, x + 6, 22, P.orange);
      }
    }
  });
  // Una vela en su aplique en el tramo de la derecha (desde el nivel 2).
  const last = cells.at(-1)!;
  const winR = bx(last.win + WIN_HALF);
  if (!ruin && lvl >= 2 && bx(last.x1) - winR >= 8) {
    b.rect(winR + 3, 28, 5, 2, P.slate);
    candleOn(b, winR + 4, 28, 4);
  }
}

/**
 * Dónde se ve el oro, por orden: se va repartiendo según lo llena que está la cámara
 * (`look.vault`), así que con poco oro solo brilla el montón de la caja fuerte y con la cámara
 * llena rebosan los arcones, los cerros y las pilas de monedas. Las salas anchas suman, en el
 * primer tramo de en medio, un gran cerro de oro (con el ídolo en el nivel 3) y, en el segundo,
 * la mesa de contar con la caja fuerte de hierro.
 */
function things(room: Room, w: number, look: SalonLook): Thing[] {
  const lvl = room.level;
  const cells = cellsOf(room, w);
  const gear = look.gearRoom === room.id ? look.gear : [];
  const stretches = stretchesOf(room, w);
  // Los sitios del oro, en el orden en que se llenan.
  type Spot = { key: string; weight: number };
  const spots: Spot[] = [
    { key: 'w0', weight: 1 },
    { key: 'c0', weight: 0.6 },
  ];
  for (const s of stretches) if (s.kind === 'mid') spots.push({ key: `m${s.i}`, weight: 1.6 });
  cells.forEach((_, j) => j > 0 && spots.push({ key: `w${j}`, weight: 1 }));
  spots.push({ key: 'c1', weight: 0.6 });
  if (lvl >= 2) spots.push({ key: 'sacks', weight: 0.5 });
  const total = spots.reduce((a, x) => a + x.weight, 0);
  let left = (look.vault ?? 0) * total;
  const fill: Record<string, number> = {};
  for (const sp of spots) {
    fill[sp.key] = Math.max(0, Math.min(1, left / sp.weight));
    left -= sp.weight;
  }
  const glow = (a: number, r: number) => (a > 0 ? SHINE(r, 0.2 + a * 0.5) : undefined);
  const t: Thing[] = [];
  for (const s of stretches) {
    if (s.kind === 'left') {
      // Sin armería, el equipo va en arcones aquí, en el sitio de los del oro.
      if (gear.length) t.push(...gearChests(gear.length, s.x0 + 12, 1));
      else
        t.push(
          ...row(s, [
            [goldChest(fill.c0!, lvl >= 3), WALL, glow(fill.c0!, 30)],
            [goldChest(fill.c1!, lvl >= 3), WALL],
          ]),
        );
    } else if (s.kind === 'right') {
      if (fill.sacks! > 0) t.push(at(coinSack(), Math.min(s.x0 + 8.5, w - 9), WALL - 2));
    } else if (s.kind === 'mid') {
      const a = fill[`m${s.i}`]!;
      if (s.i === 1)
        t.push(
          ...row(s, [
            ...(lvl >= 3 ? ([[idol(), WALL]] as [PixelBuffer, number][]) : []),
            [a > 0 ? goldPile(a, 1.5) : strongbox(), WALL, glow(a, 60)],
          ]),
        );
      else
        t.push(
          ...row(s, [
            [strongbox(), WALL],
            [coinStacks(a), WALL - 2, glow(a, 40)],
          ]),
        );
    }
  }
  // Debajo de la caja fuerte y de las repisas (más bajo que ellas): los montones.
  cells.forEach((c, j) => {
    const a = fill[`w${j}`]!;
    if (a > 0) t.push(at(goldPile(a, 0.8), c.win, WALL, 0, glow(a, 50)));
  });
  return t;
}

/** Por reparar: arcones vacíos, uno volcado, y el equipo (si se guarda aquí) en arcones. */
function ruin(room: Room, w: number, look: SalonLook): Thing[] {
  const gear = look.gearRoom === room.id ? look.gear : [];
  const tipped = new PixelBuffer(18, 14);
  tipped.blit(Prop.chest(true), 0, 0, true);
  const t: Thing[] = [];
  for (const s of stretchesOf(room, w)) if (s.kind !== 'right') t.push(at(tipped, s.x0 + 20, WALL));
  for (const c of cellsOf(room, w)) t.push(at(Prop.crate(), c.win, WALL));
  if (gear.length) t.push(...gearChests(gear.length, w - 14, -1));
  return t;
}

export const tesoro: RoomArt = { wall, things, ruin };
