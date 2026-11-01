/**
 * Talleres: crear objetos de una receta o desmontar uno para intentar sacar la suya. Cada trabajo
 * avanza con el trabajo de la sala (`workAt`: el herrero, o un héroe que echa una mano), con el
 * juego abierto (en cada `tick`) y cerrado (en cada noche, el resto del día). Sin nadie en la
 * sala, se para. Lo que sale va al arcón; a veces sale bueno (más con buen herrero y más nivel).
 * Los legendarios no se crean.
 */
import { RECIPES, RECIPE_BY_ICON, RECIPE_IDS, type RecipeId } from '../data/recipes';
import type { RoomType } from '../data/rooms';
import {
  CRAFT_GOOD,
  CRAFT_GOOD_PER_SKILL,
  CRAFT_SLOTS,
  CRAFT_STD_WORK,
  DAY_SECONDS,
  UNDO_CHANCE,
  UNDO_HOURS,
} from './balance';
import type { Craft, DawnEvent, GameState, Item, Room } from './model';
import { Rng } from './rng';
import { active } from './rooms';
import { workAt } from './workers';

/** Las salas que son taller (las que tienen recetas). */
const SHOPS = new Set<RoomType>(RECIPE_IDS.map((id) => RECIPES[id].room));
export const isWorkshop = (t: RoomType) => SHOPS.has(t);

/** Las recetas que se saben: las de serie y las aprendidas. */
export function knownRecipes(s: GameState): RecipeId[] {
  return RECIPE_IDS.filter((id) => RECIPES[id].free || s.recipes?.includes(id));
}

/** Las recetas de una sala, sabidas o no (las que no, dicen cómo se aprenden). */
export const recipesFor = (t: RoomType) => RECIPE_IDS.filter((id) => RECIPES[id].room === t);

export const craftsIn = (s: GameState, roomId: string) =>
  (s.crafts ?? []).filter((c) => c.room === roomId);

/** Cuántos trabajos a la vez caben en un taller. */
export const craftSlots = (r: Room) => CRAFT_SLOTS[active(r).level] ?? CRAFT_SLOTS.at(-1)!;

const hoursToWork = (h: number) => (h / 24) * CRAFT_STD_WORK;

/** Por qué no se puede empezar algo en un taller (null = se puede). */
function canStart(s: GameState, roomId: string): string | null {
  const r = s.building.rooms.find((x) => x.id === roomId);
  if (!r || !isWorkshop(r.type)) return 'Esa sala no es un taller.';
  if (active(r).level === 0) return 'La sala no está en uso.';
  if (craftsIn(s, roomId).length >= craftSlots(r))
    return craftSlots(r) > 1
      ? 'El taller ya está a tope.'
      : 'El taller ya tiene un trabajo: mejora la sala para hacer dos a la vez.';
  return null;
}

/** Por qué no se puede crear una receta en un taller (null = se puede). */
export function canCraft(s: GameState, roomId: string, recipe: RecipeId): string | null {
  const why = canStart(s, roomId);
  if (why) return why;
  const rc = RECIPES[recipe];
  const r = s.building.rooms.find((x) => x.id === roomId)!;
  if (rc.room !== r.type) return 'Eso no se hace en esta sala.';
  if (!knownRecipes(s).includes(recipe)) return 'Aún no sabéis hacerlo.';
  if (s.gold < rc.gold) return `Te faltan ${rc.gold - s.gold} monedas.`;
  return null;
}

/** Los objetos del arcón que se pueden desmontar en un taller (enseñan una receta que no se sabe). */
export function undoable(s: GameState, roomId: string): Item[] {
  const r = s.building.rooms.find((x) => x.id === roomId);
  if (!r) return [];
  const known = knownRecipes(s);
  const busy = new Set((s.crafts ?? []).map((c) => c.recipe));
  return s.inventory.filter((it) => {
    const id = it.icon && RECIPE_BY_ICON[it.icon];
    return !!id && RECIPES[id].room === r.type && !known.includes(id) && !busy.has(id);
  });
}

/** Por qué no se puede desmontar un objeto en un taller (null = se puede). */
export function canUndo(s: GameState, roomId: string, itemId: string): string | null {
  const why = canStart(s, roomId);
  if (why) return why;
  if (!s.inventory.some((it) => it.id === itemId)) return 'Ese objeto no está en el arcón.';
  if (!undoable(s, roomId).some((it) => it.id === itemId))
    return 'De ese objeto no se saca nada nuevo.';
  return null;
}

const partOf = (s: GameState) => Math.min(1, (s.clock ?? 0) / DAY_SECONDS);

/** Empieza a crear (el estado ya es una copia y ya se ha comprobado con `canCraft`). */
export function startCraft(s: GameState, roomId: string, recipe: RecipeId): void {
  const rc = RECIPES[recipe];
  s.gold -= rc.gold;
  const c: Craft = {
    id: `c${s.uid++}`,
    room: roomId,
    recipe,
    need: hoursToWork(rc.hours),
    done: 0,
    at: partOf(s),
    gold: rc.gold,
  };
  s.crafts = [...(s.crafts ?? []), c];
}

/** Empieza a desmontar (ya comprobado con `canUndo`): el objeto sale del arcón. */
export function startUndo(s: GameState, roomId: string, itemId: string): void {
  const item = s.inventory.find((it) => it.id === itemId)!;
  s.inventory = s.inventory.filter((it) => it !== item);
  const c: Craft = {
    id: `c${s.uid++}`,
    room: roomId,
    recipe: RECIPE_BY_ICON[item.icon!]!,
    need: hoursToWork(UNDO_HOURS),
    done: 0,
    at: partOf(s),
    gold: 0,
    item,
  };
  s.crafts = [...(s.crafts ?? []), c];
}

/** Cancela un trabajo: se devuelve lo pagado (o el objeto, si se desmontaba). */
export function cancelCraft(s: GameState, id: string): void {
  const c = s.crafts?.find((x) => x.id === id);
  if (!c) return;
  s.gold += c.gold;
  if (c.item) s.inventory.push(c.item);
  s.crafts = s.crafts!.filter((x) => x !== c);
  if (!s.crafts.length) delete s.crafts;
}

/** Trabajo que hace un taller en un día entero ahora mismo. */
export function craftRate(s: GameState, roomId: string): number {
  const r = s.building.rooms.find((x) => x.id === roomId);
  return r ? workAt(s, r) : 0;
}

export interface CraftState {
  craft: Craft;
  /** Lo que lleva (0–1), contando la parte del día que ya ha pasado. */
  frac: number;
  /** Horas de juego que le quedan al ritmo de ahora; null si está parado (nadie trabaja). */
  hoursLeft: number | null;
}

/** Cómo va un trabajo ahora (para la ficha y la escena). */
export function craftState(s: GameState, c: Craft): CraftState {
  const rate = craftRate(s, c.room);
  const done = Math.min(c.need, c.done + rate * Math.max(0, partOf(s) - c.at));
  return {
    craft: c,
    frac: c.need > 0 ? done / c.need : 1,
    hoursLeft: rate > 0 ? ((c.need - done) / rate) * 24 : null,
  };
}

/** Probabilidad de que una receta salga buena en un taller (por nivel y por el mejor herrero). */
export function goodChance(s: GameState, roomId: string): number {
  const r = s.building.rooms.find((x) => x.id === roomId);
  if (!r) return 0;
  const smiths = s.workers.filter((w) => w.room === roomId && w.trade === r.type);
  const best = smiths.reduce((a, w) => Math.max(a, w.skill), 0);
  const base = CRAFT_GOOD[active(r).level] ?? CRAFT_GOOD.at(-1)!;
  // Sin herrero (solo héroes echando una mano), sale bueno la mitad de veces.
  const p = best ? base + CRAFT_GOOD_PER_SKILL * (best - 4) : base / 2;
  return Math.max(0, Math.min(0.8, p));
}

/** Probabilidad de sacar la receta al desmontar en un taller. */
export function undoChance(s: GameState, roomId: string): number {
  const r = s.building.rooms.find((x) => x.id === roomId);
  return r ? (UNDO_CHANCE[active(r).level] ?? UNDO_CHANCE.at(-1)!) : 0;
}

/** Acaba un trabajo: el objeto al arcón, o la receta (o nada) al desmontar. */
function finish(s: GameState, c: Craft, rng: Rng, news: DawnEvent[]): void {
  s.inventory = [...s.inventory];
  const rc = RECIPES[c.recipe];
  if (c.item) {
    if (rng.chance(undoChance(s, c.room))) {
      s.recipes = [...(s.recipes ?? []), c.recipe];
      news.push({
        t: `Desmontando ${c.item.name}, en la forja han sacado cómo se hace: ya podéis crear ${rc.many}.`,
        k: 'good',
      });
    } else news.push({ t: `Han desmontado ${c.item.name}, pero no han sacado nada en claro.` });
    return;
  }
  const good = rng.chance(goodChance(s, c.room));
  const base = good ? rc.good : rc.common;
  s.inventory.push({ ...structuredClone(base), id: `i${s.uid++}` });
  news.push({
    t: good
      ? `¡La forja ha creado ${base.name}! Ha salido de las buenas. Ya está en el arcón.`
      : `La forja ha creado ${base.name}. Ya está en el arcón.`,
    k: 'good',
  });
}

/**
 * Avanza los talleres hasta la parte del día `part` (0–1) y acaba lo que esté listo. El estado ya
 * es una copia (o se copia aquí lo que se toca). Devuelve las noticias. Con `shared`, usa esa
 * tirada (la de la noche) en vez de la del estado.
 */
export function stepCrafts(s: GameState, part: number, shared?: Rng): DawnEvent[] {
  if (!s.crafts?.length) return [];
  const news: DawnEvent[] = [];
  const rng = shared ?? new Rng(s.rng);
  const keep: Craft[] = [];
  for (const old of s.crafts) {
    const c = { ...old };
    if (!s.building.rooms.some((r) => r.id === c.room)) {
      // El taller ya no está: se devuelve lo pagado o el objeto.
      s.gold += c.gold;
      if (c.item) s.inventory = [...s.inventory, c.item];
      continue;
    }
    c.done += craftRate(s, c.room) * Math.max(0, part - c.at);
    c.at = part;
    if (c.done >= c.need - 1e-9) finish(s, c, rng, news);
    else keep.push(c);
  }
  if (keep.length) s.crafts = keep;
  else delete s.crafts;
  if (!shared) s.rng = rng.save();
  return news;
}

/** Al pasar la noche: lo que quedaba del día y, para el día nuevo, se empieza a contar de cero. */
export function nightCrafts(s: GameState, rng: Rng): DawnEvent[] {
  const news = stepCrafts(s, 1, rng);
  for (const c of s.crafts ?? []) c.at = 0;
  return news;
}
