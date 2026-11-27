/**
 * Jefes de los encargos con el dibujo calcado de las expediciones (usuario, 26 de noviembre): en
 * vez del jefe pintado de `bosses.ts`, el calco con sus animaciones (respira, carga, golpea,
 * recibe y muere). La bestia de Hondogrís sale como el huargo del bosque y el jabalí de ceniza, con su hoja; para pasar
 * otro, basta con añadirlo a `BOSS_CALCO`. Los golpes y lo que hace en la pelea siguen siendo los
 * de su jefe (`world/battle.ts`); solo cambia el dibujo.
 */
import type { BossKind } from '../data/bosses';
import { bossArt, type BossArt, type BossPose } from './bosses';
import { cenizaArt, expFoeArt } from './expFoes';
import type { FoeArt } from './foes';
import type { PixelBuffer } from './pixel';

/** Los jefes que ya salen de un calco (y de cuál). */
const BOSS_CALCO: Partial<Record<BossKind, () => FoeArt>> = {
  bestia: () => expFoeArt('bosque', 3).art,
  jabali: cenizaArt,
};

/** La fila del suelo de un dibujo (la de abajo con algo pintado) y su centro. */
function ground(b: PixelBuffer, x: number): { x: number; y: number } {
  for (let y = b.h - 1; y >= 0; y--)
    for (let i = 0; i < b.w; i++) if (b.get(i, y)) return { x, y: y + 1 };
  return { x, y: b.h };
}

/** Un `BossArt` hecho de un calco: sus poses y, en `seq`, los fotogramas de cada una. */
export function calcoBoss(f: FoeArt): BossArt {
  const idle = f.poses.idle;
  const down = f.seq?.down?.at(-1) ?? f.poses.down;
  const reach = Math.max(4, idle.w - f.foot - 1);
  const mouth = { x: reach - 2, y: -(f.chest + 3) };
  const poses: Record<BossPose, PixelBuffer> = {
    ready: idle,
    windup: f.poses.windup,
    strike: f.poses.strike,
    up: f.poses.hurt,
    thrust: f.poses.strike,
    down,
  };
  const seq: Partial<Record<BossPose, readonly PixelBuffer[]>> = {
    ready: f.seq?.idle ?? [idle, f.poses.idle2],
    ...(f.seq?.windup ? { windup: f.seq.windup } : {}),
    ...(f.seq?.strike ? { strike: f.seq.strike, thrust: f.seq.strike } : {}),
    ...(f.seq?.hurt ? { up: f.seq.hurt } : {}),
    ...(f.seq?.down ? { down: f.seq.down } : {}),
  };
  return {
    poses,
    seq,
    foot: ground(idle, f.foot),
    downFoot: ground(down, f.foot),
    chest: f.chest,
    mouth: { ready: mouth, windup: mouth, strike: mouth, up: mouth, thrust: mouth, down: mouth },
    reach,
  };
}

const cache = new Map<BossKind, BossArt>();

/** El dibujo de un jefe para la pelea: el calco, si lo tiene; si no, el de siempre. */
export function bossArtFor(kind: BossKind): BossArt {
  const make = BOSS_CALCO[kind];
  if (!make) return bossArt(kind);
  let a = cache.get(kind);
  if (!a) {
    a = calcoBoss(make());
    cache.set(kind, a);
  }
  return a;
}
