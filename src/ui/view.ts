import { generateLook, type HeroLook, type HeroMarks } from '../art/heroes/look';
import type { Facilities, GameState, Hero, Item } from '../core/model';
import { gearInStock } from '../core/game';
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

export const marksOf = (h: Hero): HeroMarks => ({
  injured: h.status === 'herido',
  eyepatch: h.traits.some((t) => t.id === 'tuerto'),
  scar: h.traits.some((t) => t.id === 'cortado'),
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
    });
  }
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
    quests: s.quests.length,
    loot: Math.min(6, s.inventory.filter((i) => !i.kind || i.kind === 'tesoro').length),
    fallen: s.fallen.length,
    gear: gearInStock(s).map((i) => ({ icon: i.icon ?? 'espada', rarity: i.rarity ?? 0 })),
    trophies: s.trophies.map((t) => t.icon),
    heroes,
  };
}
