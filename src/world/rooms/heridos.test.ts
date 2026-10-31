import { describe, expect, it } from 'vitest';
import { generateLook, heroSprites } from '../../art/heroes/hero';
import type { SceneHero } from '../scene';
import { F, atlas } from './crowd';

const look = generateLook('herido', 'guerrero', 'm');
const person = (injured: boolean) => {
  const marks = { injured };
  const h = {
    id: 'h',
    name: '',
    title: '',
    status: injured ? 'herido' : 'ok',
    look,
    marks,
    guard: false,
  };
  return atlas(heroSprites(look, marks), h as SceneHero);
};
/** Los píxeles de un fotograma del atlas (24 de ancho). */
const cell = (img: ReturnType<typeof person>, i: number) => {
  const out: number[] = [];
  for (let y = 0; y < img.h; y++)
    for (let x = i * 24; x < i * 24 + 24; x++) out.push(img.data[y * img.w + x]!);
  return out.join(',');
};

describe('heridos acostados', () => {
  it('el herido duerme con la venda en cualquier cama y el sano, sin ella', () => {
    const sano = person(false);
    const herido = person(true);
    for (const i of [F.sleep + 1, F.sleepT, F.mat]) expect(cell(herido, i)).not.toBe(cell(sano, i));
  });
});
