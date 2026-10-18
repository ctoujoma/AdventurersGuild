import { generateLook, type HeroLook, type HeroMarks } from '../art/heroes/look';
import type { Facilities, GameState, Hero, Item, Worker } from '../core/model';
import { customOf, gearInStock } from '../core/game';
import { staffBeds, workerTitle } from '../core/workers';
import { visitorsOf } from '../core/salon';
import { CREST_COLORS, isFeastDay } from '../data/custom';
import { gearOf } from '../core/resolve';
import type { Member } from '../core/party';
import type { SceneHero, SceneModel } from '../world/scene';

/** Puentes entre el modelo del juego y el arte o la escena. */

const looks = new Map<string, HeroLook>();
export function lookOf(h: Hero): HeroLook {
  let l = looks.get(h.seed);
  if (!l) {
    l = generateLook(h.seed, h.cls, h.sex);
    looks.set(h.seed, l);
  }
  return l;
}

/** Los trabajadores visten de taberna (el mozo, sin gorro; el bardo, con gorra). */
export function workerLook(w: Worker): HeroLook {
  let l = looks.get(w.seed);
  if (!l) {
    l = generateLook(w.seed, 'tabernero', w.sex);
    if (w.village === 'bardo') l = { ...l, headgear: 'gorra' };
    if (w.village === 'mozo') l = { ...l, headgear: null };
    looks.set(w.seed, l);
  }
  return l;
}

export const marksOf = (h: Hero): HeroMarks => ({
  injured: h.status === 'herido',
  eyepatch: h.traits.some((t) => t.id === 'tuerto'),
  scar: h.traits.some((t) => t.id === 'cortado'),
  gear: h.item?.icon ? { icon: h.item.icon, rarity: h.item.rarity ?? 0 } : undefined,
});

export const memberOf = (h: Hero, fac?: Facilities): Member & { item?: Item } => ({
  cls: h.cls,
  lvl: h.lvl,
  attrs: h.attrs,
  traits: h.traits,
  morale: h.morale,
  item: h.item,
  gear: gearOf(h.item, fac),
  perk: h.item?.perk,
});

/** Los visitantes de hoy en el orden en que llegan (mezclados, siempre igual para el mismo día). */
function visitorOrder(s: GameState): string[] {
  const v = visitorsOf(s, s.day);
  const list = (Object.keys(v.kinds) as (keyof typeof v.kinds)[]).flatMap((k) =>
    Array.from({ length: v.kinds[k] }, () => k as string),
  );
  // Barajado con la semilla del día: el noble no llega siempre el último.
  let h = s.day * 2654435761;
  for (let i = list.length - 1; i > 0; i--) {
    h = (Math.imul(h ^ (h >>> 15), 2246822519) + i) >>> 0;
    const j = h % (i + 1);
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

const fullName = (h: Hero) => (h.nick ? `${h.name} ${h.nick}` : h.name);

export function sceneModel(s: GameState): SceneModel {
  const heroes: SceneHero[] = [];
  for (const h of s.heroes) {
    if (h.status === 'muerto' || h.status === 'desaparecido') continue;
    heroes.push({
      id: h.id,
      name: fullName(h),
      status: h.status,
      look: lookOf(h),
      marks: marksOf(h),
      guard: !!h.guard,
      work: h.job,
    });
  }
  // Los trabajadores: los que tienen cama en el servicio duermen en casa; los demás, en el pueblo.
  let beds = staffBeds(s.building);
  for (const w of s.workers)
    heroes.push({
      id: w.id,
      name: workerTitle(w),
      status: 'ok',
      look: workerLook(w),
      marks: {},
      work: w.room,
      staff: beds-- > 0 ? 'casa' : 'pueblo',
    });
  for (const h of s.candidates)
    heroes.push({
      id: h.id,
      name: fullName(h),
      status: 'candidato',
      look: lookOf(h),
      marks: marksOf(h),
    });
  return {
    fac: s.fac,
    building: s.building,
    quests: s.quests.length,
    loot: Math.min(6, s.inventory.filter((i) => !i.kind || i.kind === 'tesoro').length),
    fallen: s.fallen.length,
    crest: {
      field: CREST_COLORS[customOf(s).color].field,
      dark: CREST_COLORS[customOf(s).color].dark,
      symbol: customOf(s).symbol,
    },
    staff: s.workers.flatMap((w) => (w.village ? [w.village] : [])),
    dog: customOf(s).dog,
    decor: customOf(s).decor ?? [],
    facade: customOf(s).facade ?? [],
    visitors: { day: s.day, kinds: visitorOrder(s) },
    raven: !!customOf(s).raven,
    feast: customOf(s).feast === s.day ? 'montada' : isFeastDay(s.day) ? 'dia' : 'no',
    gear: gearInStock(s).map((i) => ({ icon: i.icon ?? 'espada', rarity: i.rarity ?? 0 })),
    trophies: s.trophies.map((t) => t.icon),
    heroes,
  };
}
