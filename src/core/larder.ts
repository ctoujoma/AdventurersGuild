/**
 * Comida y cerveza: las raciones que hace la cocina y las jarras que saca la bodega, cuánto
 * cabe en la casa y quién se lo toma. Lo que dan las salas se suma al terminar el día; los
 * visitantes comen y beben de lo guardado, y los de casa cenan por la noche.
 */
import { bump } from './feats';
import type { RoomType } from '../data/rooms';
import {
  BREW_PER_WORK,
  CELLAR_COOL,
  CELLAR_STORE,
  COOK_PER_WORK,
  HUNGER_MORALE,
  KITCHEN_STORE,
  PANTRY_STORE,
  byLevel,
} from './balance';
import type { Building, DawnEvent, GameState, Hero, Room, RoomYield, Worker } from './model';
import { active } from './rooms';
import { visitorsOf, type DayVisitors } from './salon';
import { workAt } from './workers';
import { msg } from '../textos';
import { nightQueues } from './collect';

/** Raciones que hace una cocina en un día. */
export const cookAt = (s: GameState, r: Room) =>
  r.type === 'cocina' ? workAt(s, r) * COOK_PER_WORK : 0;

/** Jarras que saca una bodega en un día (bajo tierra, fresca, saca más). */
export const brewAt = (s: GameState, r: Room) =>
  r.type === 'bodega' ? workAt(s, r) * BREW_PER_WORK * (r.floor < 0 ? CELLAR_COOL : 1) : 0;

/** Lo que dará cada sala al terminar el día con la gente que trabaja hoy. */
export function yieldsOf(s: GameState): RoomYield[] {
  const out: RoomYield[] = [];
  for (const r of s.building.rooms) {
    const food = Math.round(cookAt(s, r));
    const beer = Math.round(brewAt(s, r));
    if (food) out.push({ room: r.id, food });
    if (beer) out.push({ room: r.id, beer });
  }
  return out;
}

/** Lo que dan al día todas las salas juntas. */
export function dailyYield(s: GameState): { food: number; beer: number } {
  const y = yieldsOf(s);
  return {
    food: y.reduce((a, x) => a + (x.food ?? 0), 0),
    beer: y.reduce((a, x) => a + (x.beer ?? 0), 0),
  };
}

/**
 * Lo que cabe en las salas de un tipo: por hueco, lo de su nivel en la tabla (o, con un número,
 * tanto por hueco y nivel).
 */
const stored = (b: Building, type: RoomType, per: number | readonly number[]) =>
  b.rooms.reduce((a, r) => {
    if (r.type !== type) return a;
    const { cells, level } = active(r);
    return a + cells * (typeof per === 'number' ? level * per : byLevel(per, level));
  }, 0);

/** Raciones que caben: unas pocas en la cocina y muchas en la despensa. */
export const foodCap = (b: Building) =>
  stored(b, 'cocina', KITCHEN_STORE) + stored(b, 'despensa', PANTRY_STORE);

/** Jarras que caben en la bodega. */
export const beerCap = (b: Building) => stored(b, 'bodega', CELLAR_STORE);

/** Quien cena en casa: los héroes que no están fuera y los internos (los del pueblo cenan en la suya). */
export function eatersOf(s: GameState): { heroes: Hero[]; workers: Worker[] } {
  return {
    heroes: s.heroes.filter((h) => h.status === 'ok' || h.status === 'herido'),
    workers: s.workers.filter((w) => !w.village),
  };
}

/**
 * La noche en la despensa: lo que tomaron los visitantes sale de lo guardado (lo que hacen la
 * cocina y la bodega llega por su cola, `core/collect.ts`), y cenan los de casa (los trabajadores primero: son quienes
 * cocinan). Quien se acuesta sin cenar pierde moral. Lo que no cabe se echa a perder.
 */
export function stepLarder(s: GameState, visits: DayVisitors, events: DawnEvent[]): void {
  s.food = Math.max(0, s.food - visits.fed);
  const served = Math.min(s.beer, visits.drank);
  if (served > 0) bump(s, 'beerServed', served);
  s.beer -= served;
  // Lo que hacen la cocina y la bodega llega por su cola: al irse a dormir entra lo que quede.
  s.yields = yieldsOf(s);
  nightQueues(s);
  const { heroes, workers } = eatersOf(s);
  const meals = Math.min(s.food, heroes.length + workers.length);
  s.food -= meals;
  const hungry = heroes.slice(Math.max(0, meals - workers.length));
  for (const h of hungry) h.morale = Math.max(0, h.morale - HUNGER_MORALE);
  if (hungry.length)
    events.push({
      t: msg('comida.sin_cena', {
        quien: hungry.map((h) => h.name),
        n: hungry.length,
        moral: HUNGER_MORALE,
        servicio: meals < workers.length,
      }),
      k: 'bad',
    });
  s.food = Math.min(s.food, foodCap(s.building));
  s.beer = Math.min(s.beer, beerCap(s.building));
}

/** Cuántos de casa se quedarían sin cenar esta noche si nada cambia (para avisar a tiempo). */
export function hungryTonight(s: GameState): number {
  const v = visitorsOf(s, s.day);
  const { heroes, workers } = eatersOf(s);
  const food = Math.max(0, s.food - v.fed) + dailyYield(s).food;
  return Math.max(0, heroes.length + workers.length - food);
}
