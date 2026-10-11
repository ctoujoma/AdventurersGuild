import { describe, expect, it } from 'vitest';
import { P } from './palette';
import { PixelBuffer, rgba, toHex } from './pixel';

describe('PixelBuffer', () => {
  it('convierte colores ida y vuelta', () => {
    for (const c of Object.values(P)) expect(toHex(rgba(c))).toBe(c);
  });

  it('pinta rectángulos recortados a los bordes', () => {
    const b = new PixelBuffer(8, 8);
    b.rect(-2, -2, 5, 5, P.red);
    expect(b.countFilled()).toBe(9);
    expect(toHex(b.get(0, 0))).toBe(P.red);
    expect(b.get(3, 3)).toBe(0);
  });

  it('el contorno añade un píxel alrededor de la silueta', () => {
    const b = new PixelBuffer(3, 3);
    b.set(1, 1, P.white);
    const o = b.outlined(() => P.black);
    expect(o.w).toBe(5);
    expect(o.countFilled()).toBe(5);
    expect(toHex(o.get(2, 1))).toBe(P.black);
  });

  it('blit respeta la transparencia y el volteo', () => {
    const src = new PixelBuffer(2, 1);
    src.set(0, 0, P.gold);
    const dst = new PixelBuffer(2, 1);
    dst.rect(0, 0, 2, 1, P.navy);
    dst.blit(src, 0, 0, true);
    expect(toHex(dst.get(1, 0))).toBe(P.gold);
    expect(toHex(dst.get(0, 0))).toBe(P.navy);
  });
});
