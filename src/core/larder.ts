/**
 * Comida y cerveza: las raciones que hace la cocina y las jarras que saca la bodega, cuánto
 * cabe en la casa y quién se lo toma. Lo que dan las salas se suma al terminar el día; los
 * visitantes comen y beben de lo guardado, y los de casa cenan por la noche.
 */
import type { RoomType } from '../data/rooms';
import {
  BREW_PER_WORK,
  CELLAR_COOL,
  CELLAR_STORE,
  COOK_PER_WORK,
  HUNGER_MORALE,
  KITCHEN_STORE,
  PANTRY_STORE,
} from './balance';
import type { Building, DawnEvent, GameState, Hero, Room, RoomYield, Worker } from './model';
import { active } from './rooms';
import { visitorsOf, type DayVisitors } from './salon';
import { listNames } from './text';
import { workAt } from './workers';

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

/** Lo que cabe en las salas de un tipo: tanto por hueco y nivel. */
const stored = (b: Building, type: RoomType, per: number) =>
  b.rooms.reduce((a, r) => {
    if (r.type !== type) return a;
    const { cells, level } = active(r);
    return a + cells * level * per;
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
 * La noche en la despensa: lo que tomaron los visitantes sale de lo guardado, se suma lo que han
 * hecho la cocina y la bodega, y cenan los de casa (los trabajadores primero: son quienes
 * cocinan). Quien se acuesta sin cenar pierde moral. Lo que no cabe se echa a perder.
 */
export function stepLarder(s: GameState, visits: DayVisitors, events: DawnEvent[]): void {
  s.food = Math.max(0, s.food - visits.fed);
  s.beer = Math.max(0, s.beer - visits.drank);
  s.yields = yieldsOf(s);
  for (const y of s.yields) {
    s.food += y.food ?? 0;
    s.beer += y.beer ?? 0;
  }
  const { heroes, workers } = eatersOf(s);
  const meals = Math.min(s.food, heroes.length + workers.length);
  s.food -= meals;
  const hungry = heroes.slice(Math.max(0, meals - workers.length));
  for (const h of hungry) h.morale = Math.max(0, h.morale - HUNGER_MORALE);
  if (hungry.length)
    events.push({
      t: `No hubo comida para todos: ${listNames(hungry.map((h) => h.name))} ${hungry.length === 1 ? 'se acostó' : 'se acostaron'} sin cenar (−${HUNGER_MORALE} de moral).${meals < workers.length ? ' Ni el servicio cenó.' : ''}`,
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
