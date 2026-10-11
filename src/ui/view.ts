import { generateLook, type HeroLook, type HeroMarks } from '../art/heroes/look';
import type { GameState, Hero } from '../core/model';
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
});

export const memberOf = (h: Hero): Member => ({
  cls: h.cls,
  lvl: h.lvl,
  attrs: h.attrs,
  traits: h.traits,
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
  return { fac: s.fac, quests: s.quests.length, loot: Math.min(6, s.inventory.length), heroes };
}
