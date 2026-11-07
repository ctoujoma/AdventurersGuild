/**
 * El taller del pintor: los colores de las telas de cada sala se cambian pintándolas. Se elige
 * el color, se paga y un pintor del taller va a la sala; no empieza hasta que llega (lo dice la
 * escena con la acción `arrived`, o como mucho a las `PAINT_WALK` horas) y trabaja en la jornada,
 * a su ritmo, hasta acabar. Entonces la sala cambia de color. Mientras, el pintor no está en su
 * taller: la escena le lleva a la sala que pinta (`painterAt`) y enseña cómo va (`paintState`).
 */
import { TINTS, type TintId } from '../data/custom';
import {
  CRAFT_STD_WORK,
  DAY_SECONDS,
  PAINT_GOLD,
  PAINT_HOURS,
  PAINT_SLOTS,
  PAINT_WALK,
  WORK_END,
  WORK_START,
} from './balance';
import { customOf } from './custom';
import { hasUnlock, unlockSource } from './goals';
import type { DawnEvent, GameState, Paint, Room } from './model';
import { active } from './rooms';
import { ROOMS } from '../data/rooms';
import { effortOf, workedIn } from './workers';

const partOf = (s: GameState) => Math.min(1, (s.clock ?? 0) / DAY_SECONDS);

/** El color de las telas de una sala ahora (null: los de la casa). */
export const roomTint = (s: GameState, roomId: string): TintId | null =>
  s.custom?.colors?.[roomId] ?? null;

/** Los talleres del pintor en uso. */
const shops = (s: GameState) =>
  s.building.rooms.filter((r) => r.type === 'pintor' && active(r).level > 0);

/** Los pintores de un taller (los trabajadores de ese oficio puestos en él). */
const paintersOf = (s: GameState, shop: string) =>
  s.workers.filter((w) => w.room === shop && w.trade === 'pintor');

/** Trabajos a la vez en un taller: uno por pintor, hasta lo que da su nivel. */
const slotsIn = (s: GameState, r: Room) =>
  Math.min(PAINT_SLOTS[active(r).level] ?? PAINT_SLOTS.at(-1)!, paintersOf(s, r.id).length);

/** Lo que cuesta pintar una sala: por hueco. */
export const paintCost = (r: Room) => PAINT_GOLD * r.w * r.h;

/** El trabajo de pintar en marcha en una sala, si lo hay. */
export const paintingOf = (s: GameState, roomId: string) =>
  s.paints?.find((p) => p.room === roomId);

/** A qué sala ha ido un pintor a pintar (para que la escena le lleve allí), si está pintando. */
export const painterAt = (s: GameState, workerId: string) =>
  s.paints?.find((p) => p.painter === workerId)?.room ?? null;

/**
 * Cómo está pintar una sala de un color, para la ficha de la sala (cada color con su estado):
 * - `ok`: se puede; al elegirlo, acción `paint`.
 * - `same`: ya es de ese color. `lock`: aún no lo tenéis (`why` dice de dónde sale).
 * - `none`: no hay taller del pintor. `nobody`: hay taller, pero sin pintor.
 * - `painting`: esa sala ya se está pintando. `busy`: los pintores están con otras salas.
 * - `gold`: falta dinero.
 */
export type PaintStatus =
  | { state: 'ok'; cost: number }
  | {
      state: 'same' | 'lock' | 'none' | 'nobody' | 'painting' | 'busy' | 'gold';
      why: string;
      cost: number;
    };

export function paintStatus(s: GameState, roomId: string, tint: TintId | null): PaintStatus {
  const r = s.building.rooms.find((x) => x.id === roomId);
  const cost = r ? paintCost(r) : PAINT_GOLD;
  if (!r) return { state: 'none', why: 'Esa sala ya no está.', cost };
  if (roomTint(s, roomId) === tint) return { state: 'same', why: 'Ya es de ese color.', cost };
  if (tint && !hasUnlock(s, `tint:${tint}`)) {
    const from = unlockSource(`tint:${tint}`);
    return { state: 'lock', why: from ? `Se consigue con: ${from}.` : 'Aún no lo tenéis.', cost };
  }
  const list = shops(s);
  if (!list.length) return { state: 'none', why: 'Hace falta un taller del pintor.', cost };
  if (!list.some((x) => paintersOf(s, x.id).length))
    return { state: 'nobody', why: 'El taller del pintor no tiene pintor.', cost };
  if (paintingOf(s, roomId)) return { state: 'painting', why: 'Ya la están pintando.', cost };
  if (!freeShop(s)) return { state: 'busy', why: 'Los pintores están pintando otra sala.', cost };
  if (s.gold < cost) return { state: 'gold', why: `Te faltan ${cost - s.gold} monedas.`, cost };
  return { state: 'ok', cost };
}

/** Un taller con sitio para otro trabajo y el pintor libre que irá. */
function freeShop(s: GameState): { shop: Room; painter: string } | null {
  for (const r of shops(s)) {
    const busy = (s.paints ?? []).filter((p) => p.shop === r.id);
    if (busy.length >= slotsIn(s, r)) continue;
    const free = paintersOf(s, r.id)
      .filter((w) => !busy.some((p) => p.painter === w.id))
      .sort((a, b) => b.skill - a.skill)[0];
    if (free) return { shop: r, painter: free.id };
  }
  return null;
}

/** Empieza a pintar una sala (si `paintStatus` dice que se puede). */
export function startPaint(s: GameState, roomId: string, tint: TintId | null): boolean {
  if (tint && !TINTS[tint]) return false;
  if (paintStatus(s, roomId, tint).state !== 'ok') return false;
  const r = s.building.rooms.find((x) => x.id === roomId)!;
  const { shop, painter } = freeShop(s)!;
  const gold = paintCost(r);
  s.gold -= gold;
  const p: Paint = {
    id: `p${s.uid++}`,
    shop: shop.id,
    painter,
    room: roomId,
    tint,
    need: (PAINT_HOURS / 24) * CRAFT_STD_WORK * r.w * r.h,
    done: 0,
    at: partOf(s) + PAINT_WALK / 24,
    wait: true,
    gold,
  };
  s.paints = [...(s.paints ?? []), p];
  return true;
}

/** Lo que rinde ahora quien pinta (su maña en su oficio y el nivel del taller). */
function rateOf(s: GameState, p: Paint): number {
  const w = s.workers.find((x) => x.id === p.painter);
  const shop = s.building.rooms.find((r) => r.id === p.shop);
  if (!w || !shop || w.room !== shop.id) return 0;
  return effortOf(w, 'pintor') * (0.75 + 0.25 * active(shop).level);
}

export interface PaintState {
  paint: Paint;
  /** Lo que lleva (0–1), contando la parte del día que ya ha pasado: la escena pinta tanto. */
  frac: number;
  /** Horas de jornada que le quedan al ritmo de ahora; null si está parado. */
  hoursLeft: number | null;
  /** Aún no ha empezado: el pintor va de camino. */
  walking: boolean;
}

/** Cómo va un trabajo de pintar ahora (para la ficha y la escena). */
export function paintState(s: GameState, p: Paint): PaintState {
  const rate = rateOf(s, p);
  const walking = !!p.wait && p.at > partOf(s) + 1e-9;
  const done = walking ? p.done : Math.min(p.need, p.done + rate * workedIn(p.at, partOf(s)));
  return {
    paint: p,
    frac: p.need > 0 ? done / p.need : 1,
    hoursLeft: rate > 0 ? ((p.need - done) / rate) * 24 * (WORK_END - WORK_START) : null,
    walking,
  };
}

/** La escena dice que alguien ha llegado a una sala: si es el pintor que iba a pintarla, empieza. */
export function arrivePaint(s: GameState, who: string, roomId: string): boolean {
  const p = s.paints?.find((x) => x.painter === who && x.room === roomId && x.wait);
  if (!p) return false;
  const now: Paint = { ...p, at: Math.min(p.at, partOf(s)) };
  delete now.wait;
  s.paints = s.paints!.map((x) => (x === p ? now : x));
  return true;
}

/** Avanza lo que se pinta hasta la parte del día `part` y acaba lo que esté. */
export function stepPaints(s: GameState, part: number): DawnEvent[] {
  if (!s.paints?.length) return [];
  const news: DawnEvent[] = [];
  const keep: Paint[] = [];
  for (const old of s.paints) {
    const p = { ...old };
    const r = s.building.rooms.find((x) => x.id === p.room);
    // La sala, el taller o el pintor ya no están: se devuelve lo pagado.
    if (!r || !s.building.rooms.some((x) => x.id === p.shop) || !rateOfWorker(s, p)) {
      s.gold += p.gold;
      continue;
    }
    if (p.wait && part >= p.at && p.at < WORK_END) delete p.wait;
    if (p.wait) {
      keep.push(p);
      continue;
    }
    p.done += rateOf(s, p) * workedIn(p.at, part);
    p.at = Math.max(p.at, part);
    if (p.done < p.need - 1e-9) {
      keep.push(p);
      continue;
    }
    const c = customOf(s);
    const colors = { ...c.colors };
    if (p.tint) colors[p.room] = p.tint;
    else delete colors[p.room];
    s.custom = { ...c, colors };
    const w = s.workers.find((x) => x.id === p.painter);
    const color = p.tint ? TINTS[p.tint].name.toLowerCase() : 'los colores de la casa';
    news.push({
      t: `${w?.name ?? 'El pintor'} ha acabado de pintar ${ROOMS[r.type].name.toLowerCase()}: ahora luce ${color}.`,
      k: 'good',
    });
  }
  if (keep.length) s.paints = keep;
  else delete s.paints;
  return news;
}

/** El pintor sigue en el gremio y en su taller (si se le despide o se le cambia, se cancela). */
const rateOfWorker = (s: GameState, p: Paint) =>
  s.workers.some((w) => w.id === p.painter && w.room === p.shop);

/** Al pasar la noche: lo que quedaba del día y, para el día nuevo, se cuenta desde la mañana. */
export function nightPaints(s: GameState): DawnEvent[] {
  const news = stepPaints(s, 1);
  for (const p of s.paints ?? []) p.at = p.wait ? WORK_START + PAINT_WALK / 24 : 0;
  return news;
}

/** Cancelar: se devuelve lo pagado y la sala se queda como estaba. */
export function cancelPaint(s: GameState, id: string): void {
  const p = s.paints?.find((x) => x.id === id);
  if (!p) return;
  s.gold += p.gold;
  const rest = s.paints!.filter((x) => x !== p);
  if (rest.length) s.paints = rest;
  else delete s.paints;
}
