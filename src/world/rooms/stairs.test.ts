import { describe, expect, it } from 'vitest';
import { PARTITION, PITCH, ROOM_H, STAIR_W, floorY } from './layout';
import { FLIGHT_Z, STEPS, flightArt, goesRight, stepAt } from './stairs';
import { scaleAt } from './view3d';

describe('tramos de escalera', () => {
  it('el primer peldaño es el suelo de abajo y el último el de arriba, sin salirse de la columna', () => {
    for (const f of [-2, -1, 0, 1, 2]) {
      expect(stepAt(100, f, 0).y).toBe(floorY(f));
      expect(stepAt(100, f, STEPS).y).toBeCloseTo(floorY(f + 1));
      for (let i = 0; i <= STEPS; i++) {
        const p = stepAt(100, f, i);
        expect(p.x).toBeGreaterThan(100 + PARTITION / 2);
        expect(p.x).toBeLessThan(100 + STAIR_W - PARTITION / 2);
        // Cada peldaño, más alto que el anterior y hacia el lado al que sube el tramo (el último,
        // ya arriba, encima del de antes).
        if (i > 1 && i < STEPS) {
          const q = stepAt(100, f, i - 1);
          expect(p.y).toBeLessThan(q.y);
          expect(Math.sign(p.x - q.x)).toBe(goesRight(f) ? 1 : -1);
        }
      }
    }
    expect(stepAt(0, 0, 1).y - stepAt(0, 0, 2).y).toBeCloseTo(PITCH / STEPS);
  });

  it('los tramos van en zigzag y su dibujo mide la columna', () => {
    expect(goesRight(0)).toBe(!goesRight(1));
    expect(goesRight(-1)).toBe(goesRight(1));
    const img = flightArt(0);
    const k = scaleAt(FLIGHT_Z);
    expect(img.w).toBe(Math.round((STAIR_W - PARTITION) * k));
    expect(img.h).toBe(Math.round(ROOM_H * k));
    expect(img.countFilled()).toBeGreaterThan(80);
  });
});
