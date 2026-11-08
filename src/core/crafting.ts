/**
 * Talleres: crear objetos de una receta o desmontar uno para intentar sacar la suya. Cada trabajo
 * avanza con el trabajo de la sala (`workAt`: el herrero, o un héroe que echa una mano), con el
 * juego abierto (en cada `tick`) y cerrado (en cada noche, el resto del día). Sin nadie en la
 * sala, se para. Lo que sale va al arcón; a veces sale bueno (más con buen herrero y más nivel).
 * Los legendarios no se crean.
 */
import {
  RECIPES,
  RECIPE_BY_ICON,
  RECIPE_IDS,
  WORKSHOP_PLACE,
  type RecipeId,
} from '../data/recipes';
import type { RoomType } from '../data/rooms';
import { GARMENTS, TINTS, type Dress } from '../data/custom';
import {
  DRESS_GOLD,
  DRESS_HOURS,
  DRESS_MORALE,
  DRESS_WALK,
  WORK_END,
  WORK_START,
  CRAFT_GOOD,
  CRAFT_GOOD_PER_SKILL,
  CRAFT_SLOTS,
  CRAFT_STD_WORK,
  DAY_SECONDS,
  TEMPER_GOLD,
  TEMPER_HOURS,
  TEMPER_MAX,
  UNDO_CHANCE,
  UNDO_HOURS,
} from './balance';
import type { Craft, CraftEnd, DawnEvent, GameState, Item, ItemIcon, Rarity, Room } from './model';
import { Rng } from './rng';
import { active } from './rooms';
import { workAt, workedIn } from './workers';
import { hasUnlock, unlockSource } from './goals';
import { bump } from './feats';
import {
  MATERIALS,
  gainMats,
  hasMats,
  missing,
  spendMats,
  type Material,
  type Mats,
} from './materials';

/** Las salas que son taller (las que tienen recetas). */
const SHOPS = new Set<RoomType>(RECIPE_IDS.map((id) => RECIPES[id].room));
export const isWorkshop = (t: RoomType) => SHOPS.has(t);

/** Las recetas que se saben: las de serie y las aprendidas. */
export function knownRecipes(s: GameState): RecipeId[] {
  return RECIPE_IDS.filter((id) => RECIPES[id].free || s.recipes?.includes(id));
}

/**
 * Aprende una receta que no se sabe (premio de encargos e historias): mejor una de un taller que
 * ya se tiene. Devuelve la aprendida, o null si ya se saben todas.
 */
export function learnRecipe(s: GameState, rng: Rng): RecipeId | null {
  const known = knownRecipes(s);
  const missing = RECIPE_IDS.filter((id) => !known.includes(id));
  if (!missing.length) return null;
  const have = missing.filter((id) => s.building.rooms.some((r) => r.type === RECIPES[id].room));
  const id = rng.pick(have.length ? have : missing);
  s.recipes = [...(s.recipes ?? []), id];
  return id;
}

/** Las recetas de una sala, sabidas o no (las que no, dicen cómo se aprenden). */
export const recipesFor = (t: RoomType) => RECIPE_IDS.filter((id) => RECIPES[id].room === t);

export const craftsIn = (s: GameState, roomId: string) =>
  (s.crafts ?? []).filter((c) => c.room === roomId);

/** Cuántos trabajos a la vez caben en un taller. */
export const craftSlots = (r: Room) => CRAFT_SLOTS[active(r).level] ?? CRAFT_SLOTS.at(-1)!;

const hoursToWork = (h: number) => (h / 24) * CRAFT_STD_WORK;

/**
 * Lo que tarda de verdad, en horas de reloj, algo de `h` horas de trabajo: el trabajo de un día
 * entero se hace en la jornada (de noche no se trabaja), así que va algo más deprisa.
 */
export const clockHours = (h: number) => h * (WORK_END - WORK_START);

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
  return lackText(s, rc.mats);
}

/** «Falta 1 de cuero: sale cazando y explorando.» (null si hay de todo). */
export function lackText(s: GameState, need?: Mats): string | null {
  if (!need || hasMats(s, need)) return null;
  const miss = missing(s, need);
  const [m, n] = Object.entries(miss)[0] as [Material, number];
  return `Falta${n > 1 ? 'n' : ''} ${n} de ${MATERIALS[m].name.toLowerCase()}: ${MATERIALS[m].from.toLowerCase()}`;
}

/** El material de cada dibujo: lo que pide mejorarlo y lo que devuelve desmontarlo. */
export const ICON_MATERIAL: Record<ItemIcon, Material> = {
  espada: 'hierro',
  hacha: 'hierro',
  coraza: 'hierro',
  ganzua: 'hierro',
  escudo: 'cuero',
  botas: 'cuero',
  capa: 'tela',
  amuleto: 'hierbas',
  varita: 'madera',
};

/** El taller que mejora cada dibujo. */
const ICON_SHOP: Record<ItemIcon, RoomType> = {
  espada: 'forja',
  hacha: 'forja',
  coraza: 'forja',
  ganzua: 'forja',
  escudo: 'forja',
  botas: 'sastreria',
  capa: 'sastreria',
  amuleto: 'alquimia',
  varita: 'alquimia',
};

/** Lo que cuesta mejorar un objeto un paso más (null si no se puede mejorar más o no se mejora). */
export function temperCost(
  it: Item,
): { room: RoomType; gold: number; hours: number; mats: Mats; to: number } | null {
  if (!it.icon || !it.kind || it.kind === 'tesoro') return null;
  const to = (it.plus ?? 0) + 1;
  if (to > TEMPER_MAX) return null;
  return {
    room: ICON_SHOP[it.icon],
    gold: TEMPER_GOLD * to,
    hours: TEMPER_HOURS * to,
    mats: { [ICON_MATERIAL[it.icon]]: to },
    to,
  };
}

/** Por qué no se puede mejorar un objeto del arcón en un taller (null = se puede). */
export function canTemper(s: GameState, roomId: string, itemId: string): string | null {
  const why = canStart(s, roomId);
  if (why) return why;
  const r = s.building.rooms.find((x) => x.id === roomId)!;
  const it = s.inventory.find((x) => x.id === itemId);
  if (!it) return 'Ese objeto no está en el arcón (si lo lleva alguien, quítaselo antes).';
  const cost = temperCost(it);
  if (!cost)
    return (it.plus ?? 0) >= TEMPER_MAX ? 'Ya está mejorado del todo.' : 'Esto no se mejora.';
  if (cost.room !== r.type) return 'Eso se mejora en otro taller.';
  if (s.gold < cost.gold) return `Te faltan ${cost.gold - s.gold} monedas.`;
  return lackText(s, cost.mats);
}

/** Empieza a mejorar un objeto (ya comprobado con `canTemper`): sale del arcón mientras tanto. */
export function startTemper(s: GameState, roomId: string, itemId: string): void {
  const item = s.inventory.find((it) => it.id === itemId)!;
  const cost = temperCost(item)!;
  s.inventory = s.inventory.filter((it) => it !== item);
  s.gold -= cost.gold;
  spendMats(s, cost.mats);
  const c: Craft = {
    id: `c${s.uid++}`,
    room: roomId,
    item,
    temper: true,
    need: hoursToWork(cost.hours),
    done: 0,
    at: partOf(s),
    gold: cost.gold,
    mats: cost.mats,
  };
  s.crafts = [...(s.crafts ?? []), c];
}

/** Los objetos del arcón que se pueden desmontar en un taller (enseñan una receta que no se sabe). */
export function undoable(s: GameState, roomId: string): Item[] {
  const r = s.building.rooms.find((x) => x.id === roomId);
  if (!r) return [];
  const known = knownRecipes(s);
  const busy = new Set((s.crafts ?? []).map((c) => c.recipe).filter((r) => !!r));
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
  if (rc.mats) spendMats(s, rc.mats);
  const c: Craft = {
    id: `c${s.uid++}`,
    room: roomId,
    recipe,
    need: hoursToWork(rc.hours),
    done: 0,
    at: partOf(s),
    gold: rc.gold,
  };
  if (rc.mats) c.mats = { ...rc.mats };
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

/** Cuántos finales de trabajo se recuerdan para la escena. */
const LOG_KEEP = 8;

/** Apunta cómo acabó un trabajo (para la escena). */
function logEnd(s: GameState, c: Craft, how: CraftEnd['how'], rarity?: Rarity): void {
  const e: CraftEnd = { id: c.id, room: c.room, how };
  if (rarity !== undefined) e.rarity = rarity;
  if (c.item && c.recipe && (how === 'receta' || how === 'nada'))
    e.undo = { item: c.item.name, recipe: c.recipe, day: s.day };
  s.craftLog = [...(s.craftLog ?? []), e].slice(-LOG_KEEP);
}

/** Cancela un trabajo: se devuelve lo pagado (o el objeto, si se desmontaba). */
export function cancelCraft(s: GameState, id: string): void {
  const c = s.crafts?.find((x) => x.id === id);
  if (!c) return;
  s.gold += c.gold;
  if (c.item) s.inventory.push(c.item);
  if (c.mats) {
    const mats = { ...s.mats };
    for (const [m, n] of Object.entries(c.mats) as [Material, number][])
      mats[m] = (mats[m] ?? 0) + n;
    s.mats = mats;
  }
  logEnd(s, c, 'cancelado');
  s.crafts = s.crafts!.filter((x) => x !== c);
  if (!s.crafts.length) delete s.crafts;
}

/** Trabajo que hace un taller en un día entero ahora mismo. */
export function craftRate(s: GameState, roomId: string, c?: Craft): number {
  const r = s.building.rooms.find((x) => x.id === roomId);
  // Para vestir a alguien, tiene que estar en casa (si sale de encargo o cae herido, se para).
  if (c?.dress && s.heroes.find((h) => h.id === c.dress!.hero)?.status !== 'ok') return 0;
  // Avanza con el reloj: cuenta quien está ahora en la sala (no quien va de camino).
  return r ? workAt(s, r, true) : 0;
}

/** El trabajo de vestir en marcha de un héroe, si lo hay. */
export const dressingOf = (s: GameState, heroId: string) =>
  s.crafts?.find((c) => c.dress?.hero === heroId);

const sameDress = (a: Dress = {}, b: Dress = {}) => a.dye === b.dye && a.garment === b.garment;

/** Por qué no se puede vestir a un héroe así en la sastrería (null = se puede). */
export function canDress(s: GameState, roomId: string, heroId: string, to: Dress): string | null {
  const why = canStart(s, roomId);
  if (why) return why;
  const r = s.building.rooms.find((x) => x.id === roomId)!;
  if (r.type !== 'sastreria') return 'Eso se hace en la sastrería.';
  const h = s.heroes.find((x) => x.id === heroId);
  if (!h) return 'Ya no está en el gremio.';
  if (h.status !== 'ok') return `${h.name} no está en casa.`;
  if (dressingOf(s, heroId)) return `A ${h.name} ya le están cosiendo.`;
  if (to.dye && !TINTS[to.dye]) return 'Ese tinte no existe.';
  if (to.garment && !GARMENTS[to.garment]) return 'Esa prenda no existe.';
  if (to.dye && !hasUnlock(s, `tint:${to.dye}`))
    return `Aún no tenéis el tinte ${TINTS[to.dye].name.toLowerCase()}.`;
  if (sameDress(h.dress, to)) return 'Ya va así.';
  if (s.gold < DRESS_GOLD) return `Te faltan ${DRESS_GOLD - s.gold} monedas.`;
  return null;
}

/**
 * Cómo está una opción de ropa para un héroe, para la ficha (cada tinte o prenda con su estado):
 * - `ok`: se puede, en `room` (la sastrería libre); al elegirla, acción `dressAt`.
 * - `same`: ya va así. `lock`: aún no la tenéis (`why` dice de dónde sale).
 * - `gold`: falta dinero. `none`: no hay sastrería en uso. `away`: no está en casa.
 * - `sewing`: ya le están cosiendo. `busy`: la sastrería está con otro trabajo (`hoursLeft`).
 */
export type DressStatus =
  | { state: 'ok'; room: string; cost: number }
  | { state: 'same' | 'lock' | 'gold' | 'none' | 'away' | 'sewing'; why: string; cost: number }
  | { state: 'busy'; why: string; cost: number; room: string; hoursLeft: number | null };

export function dressStatus(s: GameState, heroId: string, to: Dress): DressStatus {
  const cost = DRESS_GOLD;
  const h = s.heroes.find((x) => x.id === heroId);
  if (!h) return { state: 'away', why: 'Ya no está en el gremio.', cost };
  if (sameDress(h.dress, to)) return { state: 'same', why: 'Ya va así.', cost };
  if (to.dye && !hasUnlock(s, `tint:${to.dye}`)) {
    const from = unlockSource(`tint:${to.dye}`);
    return { state: 'lock', why: from ? `Se consigue con: ${from}.` : 'Aún no lo tenéis.', cost };
  }
  const rooms = s.building.rooms.filter((r) => r.type === 'sastreria' && active(r).level > 0);
  if (!rooms.length) return { state: 'none', why: 'Hace falta una sastrería.', cost };
  if (h.status !== 'ok') return { state: 'away', why: `${h.name} no está en casa.`, cost };
  if (dressingOf(s, heroId))
    return { state: 'sewing', why: `A ${h.name} ya le están cosiendo.`, cost };
  const free = rooms.find((r) => !canStart(s, r.id));
  if (!free) {
    const r = rooms[0]!;
    const c = craftsIn(s, r.id)[0];
    const who = c?.dress ? s.heroes.find((x) => x.id === c.dress!.hero)?.name : undefined;
    const left = c ? craftState(s, c).hoursLeft : null;
    const what = who ? `está con ${who}` : 'está ocupada';
    const when = left === null ? '' : `: acaba en ${Math.max(1, Math.ceil(left))} h`;
    return {
      state: 'busy',
      why: `La sastrería ${what}${when}.`,
      cost,
      room: r.id,
      hoursLeft: left,
    };
  }
  if (s.gold < cost) return { state: 'gold', why: `Te faltan ${cost - s.gold} monedas.`, cost };
  return { state: 'ok', room: free.id, cost };
}

/** Empieza a vestir a un héroe (ya comprobado con `canDress`). */
export function startDress(s: GameState, roomId: string, heroId: string, to: Dress): void {
  s.gold -= DRESS_GOLD;
  const c: Craft = {
    id: `c${s.uid++}`,
    room: roomId,
    dress: { hero: heroId, to: { ...to } },
    need: hoursToWork(DRESS_HOURS),
    done: 0,
    // No se cose hasta que llega (`arrived`); si nadie avisa, cuando le ha dado tiempo de sobra.
    at: partOf(s) + DRESS_WALK / 24,
    wait: true,
    gold: DRESS_GOLD,
  };
  s.crafts = [...(s.crafts ?? []), c];
}

export interface CraftState {
  craft: Craft;
  /** Lo que lleva (0–1), contando la parte del día que ya ha pasado. */
  frac: number;
  /** Horas de juego que le quedan al ritmo de ahora; null si está parado (nadie trabaja). */
  hoursLeft: number | null;
  /** Aún no ha empezado: el héroe va de camino a la sastrería. */
  walking: boolean;
}

/** Cómo va un trabajo ahora (para la ficha y la escena). */
export function craftState(s: GameState, c: Craft): CraftState {
  const rate = craftRate(s, c.room, c);
  const done = Math.min(c.need, c.done + rate * workedIn(c.at, partOf(s)));
  return {
    craft: c,
    frac: c.need > 0 ? done / c.need : 1,
    // Horas de jornada (de noche no se trabaja).
    hoursLeft: rate > 0 ? ((c.need - done) / rate) * 24 * (WORK_END - WORK_START) : null,
    // Hasta que la escena dice que ha llegado (`arrive`).
    walking: !!c.wait,
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
  if (c.dress) {
    const { hero, to } = c.dress;
    s.heroes = s.heroes.map((h) =>
      h.id === hero
        ? { ...h, dress: { ...to }, morale: Math.min(100, h.morale + DRESS_MORALE) }
        : h,
    );
    logEnd(s, c, 'vestido');
    bump(s, 'dressed');
    const h = s.heroes.find((x) => x.id === hero);
    if (h)
      news.push({
        t: `${h.name} estrena ropa: sale de la sastrería ${h.sex === 'f' ? 'hecha' : 'hecho'} un pincel.`,
        k: 'good',
      });
    return;
  }
  s.inventory = [...s.inventory];
  if (c.temper && c.item) {
    const it = { ...c.item, plus: (c.item.plus ?? 0) + 1 };
    s.inventory.push(it);
    logEnd(s, c, 'templado');
    const room = s.building.rooms.find((r) => r.id === c.room);
    const at = (room && WORKSHOP_PLACE[room.type]) ?? 'el taller';
    news.push({
      t: `En ${at} han mejorado ${it.name}: ahora es +${it.plus}. Ya está en el arcón.`,
      k: 'good',
    });
    return;
  }
  const rc = RECIPES[c.recipe!];
  const place = WORKSHOP_PLACE[rc.room] ?? 'el taller';
  if (c.item) {
    // Desmontar devuelve algo de su material (si cabe).
    if (c.item.icon) gainMats(s, { [ICON_MATERIAL[c.item.icon]]: 1 });
    if (rng.chance(undoChance(s, c.room))) {
      s.recipes = [...(s.recipes ?? []), c.recipe!];
      logEnd(s, c, 'receta');
      news.push({
        t: `Desmontando ${c.item.name}, en ${place} han sacado cómo se hace: ya podéis crear ${rc.many}.`,
        k: 'good',
      });
    } else {
      logEnd(s, c, 'nada');
      news.push({ t: `Han desmontado ${c.item.name}, pero no han sacado nada en claro.` });
    }
    return;
  }
  const good = rng.chance(goodChance(s, c.room));
  const base = good ? rc.good : rc.common;
  s.inventory.push({ ...structuredClone(base), id: `i${s.uid++}` });
  logEnd(s, c, 'hecho', base.rarity ?? 0);
  bump(s, 'crafted');
  news.push({
    t: good
      ? `¡En ${place} han creado ${base.name}! Ha salido de las buenas. Ya está en el arcón.`
      : `En ${place} han creado ${base.name}. Ya está en el arcón.`,
    k: 'good',
  });
}

/**
 * Avanza los talleres hasta la parte del día `part` (0–1) y acaba lo que esté listo. El estado ya
 * es una copia (o se copia aquí lo que se toca). Devuelve las noticias. Con `shared`, usa esa
 * tirada (la de la noche) en vez de la del estado.
 */
export function stepCrafts(
  s: GameState,
  part: number,
  shared?: Rng,
  /** El juego cerrado: nadie puede decir que ha llegado (ver abajo). */
  unseen = false,
): DawnEvent[] {
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
      logEnd(s, c, 'cancelado');
      continue;
    }
    // El héroe aún va de camino: no se cose hasta que llega (lo dice la escena, `arrive`). Solo con
    // el juego cerrado, sin escena, se le da por llegado a su hora (si cae en la jornada; si no, a
    // la mañana siguiente).
    if (c.wait && unseen && part >= c.at && c.at < WORK_END) delete c.wait;
    if (c.wait) {
      keep.push(c);
      continue;
    }
    // Solo avanza en la jornada, con quien está en la sala.
    c.done += craftRate(s, c.room, c) * workedIn(c.at, part);
    c.at = Math.max(c.at, part);
    if (c.done >= c.need - 1e-9) finish(s, c, rng, news);
    else keep.push(c);
  }
  if (keep.length) s.crafts = keep;
  else delete s.crafts;
  if (!shared) s.rng = rng.save();
  return news;
}

/**
 * Al pasar la noche: lo que quedaba del día y, para el día nuevo, se empieza a contar de cero.
 * Con `unseen` (el juego cerrado), ver `stepCrafts`.
 */
export function nightCrafts(s: GameState, rng: Rng, unseen = false): DawnEvent[] {
  const news = stepCrafts(s, 1, rng, unseen);
  // Quien aún no había llegado a la sastrería sigue esperado: por la mañana vuelve a ir (y, con
  // el juego cerrado, llega a sus horas de camino).
  for (const c of s.crafts ?? []) c.at = c.wait ? WORK_START + DRESS_WALK / 24 : 0;
  return news;
}

/**
 * La escena dice que un héroe ha llegado a una sala: si allí le esperaban para vestirle, se
 * empieza a coser ya. Devuelve si ha cambiado algo.
 */
export function arrive(s: GameState, heroId: string, roomId: string): boolean {
  const c = s.crafts?.find((x) => x.dress?.hero === heroId && x.room === roomId && x.wait);
  if (!c) return false;
  const now: Craft = { ...c, at: Math.min(c.at, partOf(s)) };
  delete now.wait;
  s.crafts = s.crafts!.map((x) => (x === c ? now : x));
  return true;
}
