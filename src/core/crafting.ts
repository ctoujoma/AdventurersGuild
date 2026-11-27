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
  type Recipe,
  type RecipeId,
} from '../data/recipes';
import type { GearBase } from '../data/items';
import type { RoomType } from '../data/rooms';
import { GARMENTS, TINTS, type Dress } from '../data/custom';
import {
  DRESS_GOLD,
  DRESS_HOURS,
  DRESS_MORALE,
  DRESS_WALK,
  WORK_END,
  WORK_START,
  CRAFT_QUALITY,
  CRAFT_GOOD_PER_SKILL,
  CRAFT_SLOTS,
  CRAFT_STD_WORK,
  DAY_SECONDS,
  TEMPER_GOLD,
  TEMPER_HOURS,
  TEMPER_CRYSTAL,
  TEMPER_MASTER,
  TEMPER_MAX,
  UNDO_CHANCE,
  UNDO_HOURS,
  POTION_CAP,
  POTION_GOLD,
  POTION_HERBS,
  POTION_HOURS,
} from './balance';
import type { Craft, CraftEnd, DawnEvent, GameState, Item, ItemIcon, Rarity, Room } from './model';
import { Rng } from './rng';
import { active } from './rooms';
import { workAt, workedIn } from './workers';
import { hasUnlock, unlockSource } from './goals';
import { bump } from './feats';
import {
  matMsg,
  gainMats,
  hasMats,
  missing,
  spendMats,
  type Material,
  type Mats,
} from './materials';
import { msg, t } from '../textos';

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

/** El taller («la forja», «la sastrería»…) como mensaje, para un hueco. */
const shopMsg = (type?: RoomType) =>
  type && WORKSHOP_PLACE[type] ? msg(`recetas.taller.${type}`) : msg('talleres.el_taller');

/** Por qué no se puede empezar algo en un taller (null = se puede). */
function canStart(s: GameState, roomId: string): string | null {
  const r = s.building.rooms.find((x) => x.id === roomId);
  if (!r || !isWorkshop(r.type)) return t('talleres.error.no_taller');
  if (active(r).level === 0) return t('talleres.error.sin_uso');
  if (craftsIn(s, roomId).length >= craftSlots(r))
    return t(craftSlots(r) > 1 ? 'talleres.error.a_tope' : 'talleres.error.uno');
  return null;
}

/** Por qué no se puede crear una receta en un taller (null = se puede). */
export function canCraft(s: GameState, roomId: string, recipe: RecipeId): string | null {
  const why = canStart(s, roomId);
  if (why) return why;
  const rc = RECIPES[recipe];
  const r = s.building.rooms.find((x) => x.id === roomId)!;
  if (rc.room !== r.type) return t('talleres.error.otra_sala');
  if (!knownRecipes(s).includes(recipe)) return t('talleres.error.no_sabeis');
  if (s.gold < rc.gold) return t('partida.error.faltan', { n: rc.gold - s.gold });
  return lackText(s, rc.mats);
}

/** «Falta 1 de cuero: sale cazando y explorando.» (null si hay de todo). */
export function lackText(s: GameState, need?: Mats): string | null {
  if (!need || hasMats(s, need)) return null;
  const miss = missing(s, need);
  const [m, n] = Object.entries(miss)[0] as [Material, number];
  return t('talleres.error.falta', {
    n,
    material: matMsg(m),
    de_donde: msg(`materiales.${m}.de_donde`),
  });
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
  if (to > TEMPER_MASTER) return null;
  // Pasado el tope de siempre, la obra maestra: pide cristal además de su material.
  const mats: Mats = { [ICON_MATERIAL[it.icon]]: to };
  if (to > TEMPER_MAX) mats.cristal = (mats.cristal ?? 0) + TEMPER_CRYSTAL;
  return {
    room: ICON_SHOP[it.icon],
    gold: TEMPER_GOLD * to,
    hours: TEMPER_HOURS * to,
    mats,
    to,
  };
}

/** Por qué no se puede mejorar un objeto del arcón en un taller (null = se puede). */
export function canTemper(s: GameState, roomId: string, itemId: string): string | null {
  const why = canStart(s, roomId);
  if (why) return why;
  const r = s.building.rooms.find((x) => x.id === roomId)!;
  const it = s.inventory.find((x) => x.id === itemId);
  if (!it) return t('talleres.error.no_arcon_puesto');
  const cost = temperCost(it);
  if (!cost)
    return t(
      (it.plus ?? 0) >= TEMPER_MASTER ? 'talleres.error.mejorado' : 'talleres.error.no_mejora',
    );
  if (cost.room !== r.type) return t('talleres.error.otro_taller');
  if (s.gold < cost.gold) return t('partida.error.faltan', { n: cost.gold - s.gold });
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
  if (!s.inventory.some((it) => it.id === itemId)) return t('talleres.error.no_arcon');
  if (!undoable(s, roomId).some((it) => it.id === itemId)) return t('talleres.error.nada_nuevo');
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
  // Lo acabado no se cancela: se recoge.
  const c = s.crafts?.find((x) => x.id === id && !x.ready);
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
  if (r.type !== 'sastreria') return t('talleres.error.sastreria');
  const h = s.heroes.find((x) => x.id === heroId);
  if (!h) return t('talleres.ropa.fuera');
  if (h.status !== 'ok') return t('talleres.ropa.no_en_casa', { heroe: h.name });
  if (dressingOf(s, heroId)) return t('talleres.ropa.cosiendo', { heroe: h.name });
  if (to.dye && !TINTS[to.dye]) return t('talleres.ropa.sin_tinte');
  if (to.garment && !GARMENTS[to.garment]) return t('talleres.ropa.sin_prenda');
  if (to.dye && !hasUnlock(s, `tint:${to.dye}`))
    return t('talleres.ropa.tinte_bloqueado', {
      tinte: msg(`personalizar.tintes.${to.dye}.nombre`),
    });
  if (sameDress(h.dress, to)) return t('talleres.ropa.igual');
  if (s.gold < DRESS_GOLD) return t('partida.error.faltan', { n: DRESS_GOLD - s.gold });
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
  if (!h) return { state: 'away', why: t('talleres.ropa.fuera'), cost };
  if (sameDress(h.dress, to)) return { state: 'same', why: t('talleres.ropa.igual'), cost };
  if (to.dye && !hasUnlock(s, `tint:${to.dye}`)) {
    const from = unlockSource(`tint:${to.dye}`);
    return {
      state: 'lock',
      why: from ? t('talleres.ropa.se_consigue', { como: from }) : t('talleres.ropa.no_lo_teneis'),
      cost,
    };
  }
  const rooms = s.building.rooms.filter((r) => r.type === 'sastreria' && active(r).level > 0);
  if (!rooms.length) return { state: 'none', why: t('talleres.ropa.sin_sastreria'), cost };
  if (h.status !== 'ok')
    return { state: 'away', why: t('talleres.ropa.no_en_casa', { heroe: h.name }), cost };
  if (dressingOf(s, heroId))
    return { state: 'sewing', why: t('talleres.ropa.cosiendo', { heroe: h.name }), cost };
  const free = rooms.find((r) => !canStart(s, r.id));
  if (!free) {
    const r = rooms[0]!;
    const c = craftsIn(s, r.id)[0];
    const who = c?.dress ? s.heroes.find((x) => x.id === c.dress!.hero)?.name : undefined;
    const left = c ? craftState(s, c).hoursLeft : null;
    return {
      state: 'busy',
      why: t('talleres.ropa.ocupada', {
        quien: who,
        con: !!who,
        horas: left === null ? 0 : Math.max(1, Math.ceil(left)),
      }),
      cost,
      room: r.id,
      hoursLeft: left,
    };
  }
  if (s.gold < cost)
    return { state: 'gold', why: t('partida.error.faltan', { n: cost - s.gold }), cost };
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
  if (c.ready) return { craft: c, frac: 1, hoursLeft: 0, walking: false };
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

/** Calidad de lo que sale de una receta: común, bueno o raro. */
export type Quality = 'comun' | 'bueno' | 'raro';
export const QUALITY_NAME: Record<Quality, string> = {
  comun: t('talleres.calidad.comun'),
  bueno: t('talleres.calidad.bueno'),
  raro: t('talleres.calidad.raro'),
};

/**
 * Probabilidades de que una receta salga común, buena o rara en un taller: las da el nivel de la
 * sala, y el mejor artesano las mejora un poco. Sin artesano (solo héroes echando una mano),
 * buena y rara la mitad de veces.
 */
export function qualityOdds(s: GameState, roomId: string): Record<Quality, number> {
  const r = s.building.rooms.find((x) => x.id === roomId);
  if (!r) return { comun: 1, bueno: 0, raro: 0 };
  const smiths = s.workers.filter((w) => w.room === roomId && w.trade === r.type);
  const best = smiths.reduce((a, w) => Math.max(a, w.skill), 0);
  let [comun, bueno, raro] = CRAFT_QUALITY[active(r).level] ?? CRAFT_QUALITY.at(-1)!;
  if (!best) {
    comun += (bueno + raro) / 2;
    bueno /= 2;
    raro /= 2;
  } else {
    const shift = Math.max(-raro, Math.min(comun, CRAFT_GOOD_PER_SKILL * (best - 4)));
    comun -= shift;
    raro += shift;
  }
  return { comun, bueno, raro };
}

/** Probabilidad de que una receta salga rara (para quien solo quiere esa cifra). */
export const goodChance = (s: GameState, roomId: string) => qualityOdds(s, roomId).raro;

/** El objeto que sale de una receta según su calidad (el bueno: el común con +1 y en verde). */
export function crafted(rc: Recipe, q: Quality): GearBase {
  if (q === 'raro') return structuredClone(rc.good);
  const base = structuredClone(rc.common);
  if (q === 'comun') return base;
  return {
    ...base,
    rarity: 1,
    plus: 1,
    value: Math.round((rc.common.value + rc.good.value) / 2),
  };
}

/** Probabilidad de sacar la receta al desmontar en un taller. */
export function undoChance(s: GameState, roomId: string): number {
  const r = s.building.rooms.find((x) => x.id === roomId);
  return r ? (UNDO_CHANCE[active(r).level] ?? UNDO_CHANCE.at(-1)!) : 0;
}

// ---------- Pociones (alquimia) ----------

/** Lo que pide una poción. */
export const POTION_MATS: Mats = { hierbas: POTION_HERBS };
/** Pociones que caben guardadas: por el nivel de la mejor alquimia en uso (0 sin alquimia). */
export function potionCap(s: GameState): number {
  const lvl = s.building.rooms
    .filter((r) => r.type === 'alquimia')
    .reduce((a, r) => Math.max(a, active(r).level), 0);
  return POTION_CAP[lvl] ?? POTION_CAP.at(-1)!;
}
/** Las que se están preparando ahora. */
export const potionsBrewing = (s: GameState) => (s.crafts ?? []).filter((c) => c.potion).length;

/** Por qué no se puede preparar una poción en esta sala (null = se puede). */
export function canPotion(s: GameState, roomId: string): string | null {
  const why = canStart(s, roomId);
  if (why) return why;
  const r = s.building.rooms.find((x) => x.id === roomId)!;
  if (r.type !== 'alquimia') return t('talleres.error.otra_sala');
  const cap = potionCap(s);
  if ((s.potions ?? 0) + potionsBrewing(s) >= cap) return t('talleres.pocion.llenas', { n: cap });
  if (s.gold < POTION_GOLD) return t('partida.error.faltan', { n: POTION_GOLD - s.gold });
  return lackText(s, POTION_MATS);
}

/** Empieza una poción (ya comprobado con `canPotion`). */
export function startPotion(s: GameState, roomId: string): void {
  s.gold -= POTION_GOLD;
  spendMats(s, POTION_MATS);
  s.crafts = [
    ...(s.crafts ?? []),
    {
      id: `c${s.uid++}`,
      room: roomId,
      need: hoursToWork(POTION_HOURS),
      done: 0,
      at: partOf(s),
      gold: POTION_GOLD,
      mats: { ...POTION_MATS },
      potion: true,
    },
  ];
}

/** Acaba un trabajo: el objeto al arcón, o la receta (o nada) al desmontar. */
function finish(s: GameState, c: Craft, rng: Rng, news: DawnEvent[]): void {
  if (c.potion) {
    // A veces salen dos; lo que no cabe (las de las expediciones pueden pasar del tope) no sobra.
    const n = rng.chance(goodChance(s, c.room)) ? 2 : 1;
    const had = s.potions ?? 0;
    s.potions = Math.max(had, Math.min(potionCap(s), had + n));
    logEnd(s, c, 'hecho', n > 1 ? 2 : 0);
    news.push({ t: msg('talleres.aviso.pocion', { n: s.potions - had }), k: 'good' });
    return;
  }
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
        t: msg('talleres.aviso.vestido', { heroe: h.name, sexo: h.sex }),
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
    news.push({
      t: msg('talleres.aviso.mejorado', {
        taller: shopMsg(room?.type),
        objeto: it.name,
        mas: it.plus,
      }),
      k: 'good',
    });
    return;
  }
  const rc = RECIPES[c.recipe!];
  const place = shopMsg(rc.room);
  if (c.item) {
    // Desmontar devuelve algo de su material (si cabe).
    if (c.item.icon) gainMats(s, { [ICON_MATERIAL[c.item.icon]]: 1 });
    if (rng.chance(undoChance(s, c.room))) {
      s.recipes = [...(s.recipes ?? []), c.recipe!];
      logEnd(s, c, 'receta');
      news.push({
        t: msg('talleres.aviso.receta', {
          objeto: c.item.name,
          taller: place,
          receta: msg(`recetas.recetas.${c.recipe}.many`),
        }),
        k: 'good',
      });
    } else {
      logEnd(s, c, 'nada');
      news.push({ t: msg('talleres.aviso.desmontado', { objeto: c.item.name }) });
    }
    return;
  }
  const odds = qualityOdds(s, c.room);
  const roll = rng.next();
  const q: Quality = roll < odds.raro ? 'raro' : roll < odds.raro + odds.bueno ? 'bueno' : 'comun';
  const base = crafted(rc, q);
  s.inventory.push({ ...base, id: `i${s.uid++}` });
  logEnd(s, c, 'hecho', base.rarity ?? 0);
  bump(s, 'crafted');
  news.push({
    t: msg(`talleres.aviso.creado_${q}`, { taller: place, objeto: base.name }),
    k: 'good',
  });
}

/**
 * Recoge lo que un taller tiene listo (tocando lo que flota sobre la sala): sale lo que sea (la
 * calidad se tira ahora) y deja libre su puesto. Devuelve los avisos (vacío si no había nada).
 * Muta `s` (ya es una copia).
 */
export function collectCraft(s: GameState, id: string): DawnEvent[] {
  const c = s.crafts?.find((x) => x.id === id && x.ready);
  if (!c) return [];
  const news: DawnEvent[] = [];
  const rng = new Rng(s.rng);
  s.crafts = s.crafts!.filter((x) => x.id !== id);
  if (!s.crafts.length) delete s.crafts;
  finish(s, c, rng, news);
  s.rng = rng.save();
  return news;
}

/** Lo listo para recoger en cada taller (sala → trabajos acabados). */
export const readyCrafts = (s: GameState) => (s.crafts ?? []).filter((c) => c.ready);

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
    if (c.ready) {
      // Acabado: espera a que lo recojan (si el taller ya no está, va directo al arcón).
      if (s.building.rooms.some((r) => r.id === c.room)) keep.push(c);
      else finish(s, c, rng, news);
      continue;
    }
    if (!s.building.rooms.some((r) => r.id === c.room)) {
      // El taller ya no está: se devuelve lo pagado o el objeto.
      s.gold += c.gold;
      if (c.item) s.inventory = [...s.inventory, c.item];
      logEnd(s, c, 'cancelado');
      continue;
    }
    if (c.dress) {
      const h = s.heroes.find((x) => x.id === c.dress!.hero);
      if (!h || h.status === 'muerto' || h.status === 'desaparecido') {
        // Ya no está en el gremio: se cancela y se devuelve lo pagado.
        s.gold += c.gold;
        logEnd(s, c, 'cancelado');
        news.push({
          t: msg('talleres.aviso.cancelado', { heroe: h?.name, para: !!h, n: c.gold }),
        });
        continue;
      }
      if (h.status !== 'ok') {
        // Fuera o en cama: en pausa. Al volver, tiene que ir otra vez a la sastrería.
        c.wait = true;
        c.at = Math.max(part, WORK_START) + DRESS_WALK / 24;
        keep.push(c);
        continue;
      }
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
    if (c.done >= c.need - 1e-9) {
      // Vestir se ve en el héroe; lo demás se queda flotando sobre la sala hasta que lo recojan.
      if (c.dress) finish(s, c, rng, news);
      else {
        c.done = c.need;
        c.ready = true;
        keep.push(c);
        const room = s.building.rooms.find((r) => r.id === c.room);
        news.push({ t: msg('talleres.aviso.listo', { taller: shopMsg(room?.type) }), k: 'good' });
      }
    } else keep.push(c);
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
