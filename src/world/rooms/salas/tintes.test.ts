import { describe, expect, it } from 'vitest';
import { roomMax } from '../../../core/balance';
import type { Room } from '../../../core/model';
import { TINTS, TINT_FROM, TINT_IDS } from '../../../data/custom';
import { generateLook } from '../../../art/heroes/look';
import { heroSprites } from '../../../art/heroes/hero';
import { alpha, toHex } from '../../../art/pixel';
import type { SceneHero } from '../../scene';
import { F, atlas } from '../crowd';
import { ROOMS, type RoomType } from '../../../data/rooms';
import { furnish } from '../furniture';
import { CELL_W, PARTITION, ROOM_H } from '../layout';
import { backWall, floorTex, sideTex, themeOf } from '../textures';
import { dress } from './tintes';

const room = (type: RoomType, r: Partial<Room> = {}): Room => ({
  id: 'x',
  type,
  col: 0,
  floor: 0,
  w: 1,
  h: 1,
  level: 1,
  spent: 0,
  ...r,
});

/** Todo lo que se pinta de una sala, en una ristra de números para comparar. */
function paint(r: Room): string {
  const iw = r.w * CELL_W - PARTITION;
  const theme = themeOf(r.floor);
  const imgs = [
    backWall(r, iw, ROOM_H),
    floorTex(r, theme, iw, 's'),
    sideTex(theme, ROOM_H, [], 's', [], 1, r),
    ...furnish(r, iw).map((t) => t.img),
  ];
  return imgs.map((b) => b.data.join(',')).join('|');
}

describe('colores por sala', () => {
  it('sin tema, cada sala se pinta igual que siempre', () => {
    const r = room('dormitorio', { level: 2 });
    expect(dress(r, {})).toBe(r);
    expect(dress(r, { otra: 'mar' })).toBe(r);
  });

  // (Un tema puede coincidir con los colores de la casa: el granate del salón, por ejemplo.)
  it('en cada sala con telas, los temas se notan desde el nivel en que se pueden elegir', () => {
    for (const type of Object.keys(TINT_FROM) as RoomType[]) {
      for (let level = TINT_FROM[type]!; level <= roomMax(type); level++)
        for (const w of [1, ROOMS[type].maxW]) {
          const r = room(type, { level, w, floor: 1 });
          const plain = paint(r);
          const same = TINT_IDS.filter((tint) => paint(dress(r, { x: tint })) === plain);
          expect(same.length, `${type} nivel ${level} ancho ${w}: ${same}`).toBeLessThanOrEqual(1);
        }
    }
  });
});

describe('la manta de quien duerme', () => {
  it('el atlas de cada persona tiene, acostado e incorporado, la manta de cada tema', () => {
    const look = generateLook('dormilon', 'guerrero', 'm');
    const img = atlas(heroSprites(look), {
      id: 'h',
      name: 'Dormilón',
      title: '',
      status: 'ok',
      look,
      marks: {},
      guard: false,
    } as SceneHero);
    /** Colores del fotograma `i` (24 de ancho). */
    const cell = (i: number) => {
      const out = new Set<string>();
      for (let y = 0; y < img.h; y++)
        for (let x = i * 24; x < i * 24 + 24; x++) {
          const v = img.data[y * img.w + x]!;
          if (alpha(v)) out.add(toHex(v));
        }
      return out;
    };
    TINT_IDS.forEach((id, k) => {
      const mid = TINTS[id].ramp[2];
      for (const i of [F.sleepT + k, F.upT + k]) expect(cell(i).has(mid), `${id} ${i}`).toBe(true);
    });
  });
});
