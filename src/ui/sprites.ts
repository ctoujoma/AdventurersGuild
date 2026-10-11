import { generateLook, renderHero } from '../art/heroes/hero';
import type { SceneHero } from '../art/tavern/scene';
import type { DemoHero } from '../data/demo';

/** Prepara los sprites de un héroe: de pie (según su estado) y en la cama. */
export function sceneHero(h: DemoHero): SceneHero {
  const look = generateLook(h.id, h.cls, h.sex);
  return {
    id: h.id,
    name: h.nick ? `${h.name} ${h.nick}` : h.name,
    status: h.status,
    sprite: renderHero(look, { injured: h.status === 'herido', eyepatch: h.eyepatch }),
    resting: renderHero({ ...look, headgear: null }, { injured: true, eyepatch: h.eyepatch }),
  };
}

export const keeperSprite = renderHero(generateLook('tabernero', 'tabernero', 'm'));
