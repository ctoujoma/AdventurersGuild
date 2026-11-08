import { describe, expect, it } from 'vitest';
import type { Room } from '../../core/model';
import { STRIPE, paintOver, stripeOf } from './pintura';
import { backWall } from './textures';

describe('pintar por franjas', () => {
  it('va de franja en franja y, en la de ahora, de arriba abajo', () => {
    const n = Math.ceil(60 / STRIPE);
    expect(stripeOf(0, 60)).toEqual({ full: 0, n, part: 0 });
    const s = stripeOf(0.25, 60);
    expect(s.full).toBe(Math.floor(n / 4));
    expect(s.part).toBeCloseTo(n / 4 - Math.floor(n / 4));
    expect(stripeOf(1, 60)).toEqual({ full: n, n, part: 0 });
  });

  it('copia lo pintado: las franjas enteras y las filas de arriba de la siguiente', () => {
    const w = 18;
    const h = 4;
    const dst = new Uint8Array(w * h * 4);
    const src = new Uint8Array(w * h * 4).fill(9);
    // Una franja entera y media de la segunda (sus dos filas de arriba).
    paintOver(dst, src, w, h, { full: 1, n: 3, part: 0.5 });
    const at = (x: number, y: number) => dst[(y * w + x) * 4];
    expect(at(0, 3)).toBe(9);
    expect(at(STRIPE - 1, 3)).toBe(9);
    expect(at(STRIPE, 0)).toBe(9);
    expect(at(STRIPE, 2)).toBe(0);
    expect(at(2 * STRIPE, 0)).toBe(0);
  });
});

describe('la pared del color de la sala', () => {
  const room = {
    id: 'd',
    type: 'dormitorio',
    col: 1,
    floor: 1,
    w: 2,
    h: 1,
    level: 1,
    spent: 0,
  } as Room;
  const pixels = (r: Room) => Array.from(backWall(r, 160, 90).data).join();

  it('con tema, la cenefa y la raya del zócalo de su color; sin tema, como siempre', () => {
    expect(pixels({ ...room, tint: 'bosque' } as Room)).not.toBe(pixels(room));
    expect(pixels({ ...room, tint: 'bosque' } as Room)).not.toBe(
      pixels({ ...room, tint: 'mar' } as Room),
    );
  });
});
