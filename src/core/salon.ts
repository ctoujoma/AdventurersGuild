/**
 * El salón y sus visitantes: el Atractivo de la casa, cuánta gente viene cada día y de qué tipo,
 * a cuántos se atiende, lo que deja la caja y lo que pasa por tenerlos (fama, espías, peleas).
 * También la vecindad entre salas. TS puro: el reducer, la interfaz y la escena lo comparten.
 */
import { DECOR, FACADE } from '../data/custom';
import type { RoomType } from '../data/rooms';
import type { VisitorKind } from '../data/visitors';
import { VISITORS } from '../data/visitors';
import {
  BEER_COIN,
  BRAWL_BASE,
  BRAWL_NAIPES,
  BRAWL_PER_VISITOR,
  NOBLE_APPEAL,
  RAID_FROM,
  SEAT_TURNS,
  SERVE_BASE,
  SERVE_PER_WORK,
  TROPHY_APPEAL,
  TROPHY_SLOTS,
  VISIT_BASE,
  VISIT_PER_APPEAL,
  VISIT_PER_REP,
} from './balance';
import type { Building, GameState, Room } from './model';
import { Rng } from './rng';
import { active, isShaft } from './rooms';
import { workIn } from './workers';

/** El salón en uso (o null si está roto o en obras). */
export function salonOf(b: Building): Room | null {
  const r = b.rooms.find((x) => x.type === 'salon');
  return r && active(r).level > 0 ? r : null;
}

/** Salas en uso de un tipo pegadas a otra por un lado (en la misma planta, sin escalera en medio). */
export function besides(b: Building, r: Room, type: RoomType): boolean {
  return b.rooms.some((o) => {
    if (o === r || o.type !== type || active(o).level === 0) return false;
    if (o.floor > r.floor + r.h - 1 || o.floor + o.h - 1 < r.floor) return false;
    if (o.col + o.w === r.col) return !isShaft(b, r.col);
    if (o.col === r.col + r.w) return !isShaft(b, o.col);
    return false;
  });
}

/** Lo que gana o pierde una sala por lo que tiene al lado (o debajo). */
export interface Neighbor {
  good: boolean;
  text: string;
}

export function neighborsOf(b: Building, r: Room): Neighbor[] {
  const out: Neighbor[] = [];
  if (active(r).level === 0) return out;
  if (r.type === 'cocina' && besides(b, r, 'salon'))
    out.push({
      good: true,
      text: 'Junto al salón: los platos llegan antes y se atiende a más gente.',
    });
  if (r.type === 'salon' && besides(b, r, 'cocina'))
    out.push({ good: true, text: 'La cocina al lado: se atiende a más gente.' });
  if (r.type === 'bodega' && r.floor < 0)
    out.push({ good: true, text: 'Bajo tierra, fresca: la cerveza sale mejor.' });
  if (r.type === 'bodega' && r.floor >= 0)
    out.push({
      good: false,
      text: 'Sobre el suelo la cerveza se calienta: bajo tierra saldría mejor.',
    });
  if ((r.type === 'dormitorio' || r.type === 'veteranos') && besides(b, r, 'salon'))
    out.push({
      good: false,
      text: 'Pegado al salón: con el ruido se descansa peor (−1 de moral).',
    });
  if (r.type === 'salon' && (besides(b, r, 'dormitorio') || besides(b, r, 'veteranos')))
    out.push({ good: false, text: 'Hay camas pegadas al salón: con el ruido se descansa peor.' });
  return out;
}

/** El ruido del salón llega a los dormitorios de al lado. */
export const noisyBeds = (b: Building) =>
  b.rooms.some(
    (r) =>
      (r.type === 'dormitorio' || r.type === 'veteranos') &&
      active(r).level > 0 &&
      besides(b, r, 'salon'),
  );

/** Atractivo: el salón (nivel y altura), su decoración, la fachada y los trofeos de la pared. */
export function appeal(s: GameState): number {
  const r = salonOf(s.building);
  if (!r) return 0;
  const c = s.custom;
  return (
    r.level * 2 +
    (r.h > 1 ? 2 : 0) +
    (c?.decor ?? []).reduce((a, id) => a + DECOR[id].appeal, 0) +
    (c?.facade ?? []).reduce((a, id) => a + FACADE[id].appeal, 0) +
    Math.min(s.trophies.length, TROPHY_SLOTS) * TROPHY_APPEAL
  );
}

/** Plazas del salón: dos taburetes por mesa, más mesas cuanto más ancho. */
export function seatsOf(b: Building): number {
  const r = salonOf(b);
  if (!r) return 0;
  const w = (r.works?.from ?? r).w;
  return Math.max(1, w * 2 - 1) * 2;
}

/** A cuántos se puede atender hoy: los de la barra y, con la cocina al lado, alguno más. */
export function serveCap(s: GameState): number {
  const r = salonOf(s.building);
  if (!r) return 0;
  return (
    SERVE_BASE + workIn(s, 'salon') * SERVE_PER_WORK + (besides(s.building, r, 'cocina') ? 2 : 0)
  );
}

export interface DayVisitors {
  /** Los que han venido y los que se han podido atender. */
  total: number;
  served: number;
  /** Raciones y jarras que se tomaron los atendidos (de lo que había guardado). */
  fed: number;
  drank: number;
  kinds: Record<VisitorKind, number>;
  /** Lo que dejan en la caja los atendidos: la cena y la cerveza. */
  coins: number;
}

const KINDS = Object.keys(VISITORS) as VisitorKind[];

/**
 * Los visitantes de un día: siempre los mismos para el mismo día y la misma casa (sale de la
 * semilla), así la caja se puede repartir en entregas y la escena enseña la misma gente.
 */
export function visitorsOf(s: GameState, day: number): DayVisitors {
  const kinds: Record<VisitorKind, number> = { campesino: 0, mercader: 0, noble: 0, espia: 0 };
  const seats = seatsOf(s.building);
  if (!seats) return { total: 0, served: 0, fed: 0, drank: 0, kinds, coins: 0 };
  const rng = new Rng(`${s.seed}:visitas:${day}`);
  const a = appeal(s);
  const want = VISIT_BASE + s.rep * VISIT_PER_REP + a * VISIT_PER_APPEAL + rng.int(-1, 1);
  const total = Math.max(1, Math.min(Math.round(seats * SEAT_TURNS), Math.round(want)));
  // Quién es cada uno: los nobles piden Atractivo; los mercaderes, fama; el espía, un gremio
  // con algo que robar.
  for (let i = 0; i < total; i++) {
    const r = rng.next();
    if (a >= NOBLE_APPEAL && r < 0.08 + (a - NOBLE_APPEAL) * 0.02) kinds.noble++;
    else if (r < 0.25 + Math.min(0.25, s.rep / 1600)) kinds.mercader++;
    else kinds.campesino++;
  }
  if (day >= RAID_FROM && kinds.campesino > 0 && rng.chance(0.12)) {
    kinds.campesino--;
    kinds.espia++;
  }
  const served = Math.min(total, Math.round(serveCap(s)));
  // Se atiende antes a quien más gasta; sin raciones guardadas, solo beben.
  let left = served;
  let food = Math.max(0, Math.floor(s.food));
  let fed = 0;
  let coins = 0;
  for (const k of ['noble', 'mercader', 'campesino', 'espia'] as const) {
    const n = Math.min(left, kinds[k]);
    const f = Math.min(n, food);
    coins += f * VISITORS[k].spend;
    food -= f;
    fed += f;
    left -= n;
  }
  const drank = Math.min(served, Math.max(0, Math.floor(s.beer)));
  coins += drank * BEER_COIN;
  return { total, served, fed, drank, kinds, coins };
}

/** Probabilidad de pelea en el salón con esta gente. */
export const brawlChance = (s: GameState, v: DayVisitors) =>
  v.total === 0
    ? 0
    : BRAWL_BASE +
      BRAWL_PER_VISITOR * Math.max(0, v.total - 6) +
      ((s.custom?.decor ?? []).includes('naipes') ? BRAWL_NAIPES : 0);

/** «5 campesinos, 1 mercader» para los resúmenes. */
export function visitorList(v: DayVisitors): string {
  return KINDS.filter((k) => v.kinds[k] > 0)
    .map((k) => `${v.kinds[k]} ${v.kinds[k] === 1 ? VISITORS[k].name : VISITORS[k].plural}`)
    .join(', ');
}
