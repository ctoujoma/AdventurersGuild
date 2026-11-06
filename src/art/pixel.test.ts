import { describe, expect, it } from 'vitest';
import { P } from './palette';
import { bevelRelief, PixelBuffer, rgba, toHex } from './pixel';

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

describe('relieve', () => {
  it('se pinta con el nivel y lo de encima lo tapa', () => {
    const b = new PixelBuffer(4, 4);
    b.rect(0, 0, 4, 4, '#ff0000');
    expect(b.relief).toBeNull();
    b.level = 3;
    b.rect(1, 1, 2, 2, '#00ff00');
    b.level = 0;
    b.set(1, 1, '#0000ff');
    expect(b.reliefAt(2, 2)).toBe(3);
    expect(b.reliefAt(1, 1)).toBe(0);
    expect(b.reliefAt(0, 0)).toBe(0);
  });

  it('se conserva al recortar, copiar y pegar', () => {
    const b = new PixelBuffer(4, 4);
    b.level = 5;
    b.set(2, 2, '#ffffff');
    expect(b.crop(1, 1, 3, 3).reliefAt(1, 1)).toBe(5);
    expect(b.clone().reliefAt(2, 2)).toBe(5);
    const c = new PixelBuffer(4, 4);
    c.blit(b, 1, 0);
    expect(c.reliefAt(3, 2)).toBe(5);
  });
});

describe('bevelRelief', () => {
  it('sale más cuanto más lejos del borde y hunde las líneas oscuras', () => {
    const b = new PixelBuffer(7, 7);
    b.rect(0, 0, 7, 7, '#c08040');
    b.set(3, 2, '#101010');
    const r = bevelRelief(b);
    expect(r[0]).toBe(1);
    expect(r[1 * 7 + 1]).toBe(2);
    expect(r[3 * 7 + 3]).toBe(3);
    expect(r[2 * 7 + 3]).toBe(2);
  });
});
