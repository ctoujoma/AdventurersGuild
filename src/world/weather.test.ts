import { describe, expect, it } from 'vitest';
import { CLEAR, approach, dayKind, weatherAt, weatherOf } from './weather';

describe('el tiempo', () => {
  it('es determinista', () => {
    expect(weatherAt('abc', 7, 0.4)).toEqual(weatherAt('abc', 7, 0.4));
  });

  it('el primer día, despejado', () => {
    expect(dayKind('cualquiera', 1)).toBe('despejado');
    expect(weatherAt('cualquiera', 1, 0.5).cloud).toBeLessThan(0.3);
  });

  it('casi siempre despejado o algo nublado, y nunca dos días seguidos de lluvia', () => {
    let calm = 0;
    let wetRun = 0;
    const N = 2000;
    let prevWet = false;
    for (let d = 2; d < N + 2; d++) {
      const k = dayKind('semilla', d);
      if (k === 'despejado' || k === 'nubes') calm++;
      const wet = k === 'lluvia' || k === 'tormenta' || k === 'nieve';
      if (wet && prevWet) wetRun++;
      prevWet = wet;
    }
    expect(calm / N).toBeGreaterThan(0.55);
    expect(wetRun).toBe(0);
  });

  it('cambia poco a poco a lo largo del día', () => {
    for (let d = 2; d < 200; d++)
      for (let t = 0; t < 1; t += 0.01) {
        const a = weatherAt('x', d, t);
        const b = weatherAt('x', d, t + 0.01);
        expect(Math.abs(a.cloud - b.cloud)).toBeLessThan(0.15);
        expect(Math.abs(a.fog - b.fog)).toBeLessThan(0.15);
        expect(Math.abs(a.rain - b.rain)).toBeLessThan(0.15);
      }
  });

  it('cada valor entre 0 y 1', () => {
    for (let d = 1; d < 300; d++)
      for (const t of [0, 0.3, 0.7, 1]) {
        const w = weatherAt('y', d, t);
        for (const v of Object.values(w)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1.0001);
        }
      }
  });

  it('se acerca sin saltos', () => {
    const t = weatherOf('nublado');
    const a = approach(CLEAR, t, 1, 10);
    expect(a.cloud).toBeGreaterThan(CLEAR.cloud);
    expect(a.cloud).toBeLessThan(0.3);
    let w = CLEAR;
    for (let i = 0; i < 100; i++) w = approach(w, t, 1, 10);
    expect(w.cloud).toBeCloseTo(1, 2);
  });
});
