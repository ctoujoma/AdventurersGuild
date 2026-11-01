import { describe, expect, it } from 'vitest';
import { newGame, planIssue, reduce, tryWorks, type Action } from './game';
import { roomAt } from './rooms';
import type { GameState } from './model';

/** La taberna del tío el día que se paga la deuda: obras abiertas y la caja que se quiera. */
const paidOff = (gold: number): GameState => ({ ...newGame('obras'), gold, mode: 'libre' });
const idOf = (s: GameState, type: string) => s.building.rooms.find((r) => r.type === type)!.id;

describe('tutorial de obras: ampliar el salón y la cámara', () => {
  it('con un solar: la cocina se muda al solar nuevo y la cámara crece bajo él', () => {
    const s = paidOff(1000);
    const steps: Action[] = [
      { type: 'buyPlot' },
      { type: 'move', id: idOf(s, 'cocina'), col: 4, floor: 0 },
      { type: 'extend', id: idOf(s, 'salon'), dir: 'right' },
      { type: 'dig', col: 4, floor: -1 },
      { type: 'extend', id: idOf(s, 'tesoro'), dir: 'right' },
    ];
    const next = tryWorks(s, steps);
    if ('error' in next) throw new Error(next.error);
    expect(planIssue(next)).toBeNull();
    const after = reduce(s, { type: 'works', steps });
    const salon = after.building.rooms.find((r) => r.type === 'salon')!;
    const tesoro = after.building.rooms.find((r) => r.type === 'tesoro')!;
    expect([salon.col, salon.w]).toEqual([1, 3]);
    expect([tesoro.col, tesoro.w]).toEqual([3, 2]);
    expect(roomAt(after.building, 4, 0)?.type).toBe('cocina');
    // Solar 150, mudanza 15, ampliar el salón 54, excavar 60 y ampliar la cámara 72.
    expect(s.gold - after.gold).toBe(351);
  });

  it('sin solar: cocina y forja suben a la segunda planta', () => {
    const s = paidOff(1000);
    const steps: Action[] = [
      { type: 'move', id: idOf(s, 'cocina'), col: 1, floor: 2 },
      { type: 'extend', id: idOf(s, 'salon'), dir: 'right' },
      { type: 'move', id: idOf(s, 'forja'), col: 2, floor: 2 },
      { type: 'extend', id: idOf(s, 'tesoro'), dir: 'left' },
    ];
    const next = tryWorks(s, steps);
    if ('error' in next) throw new Error(next.error);
    expect(planIssue(next)).toBeNull();
    const after = reduce(s, { type: 'works', steps });
    const salon = after.building.rooms.find((r) => r.type === 'salon')!;
    const tesoro = after.building.rooms.find((r) => r.type === 'tesoro')!;
    expect([salon.col, salon.w]).toEqual([1, 3]);
    expect([tesoro.col, tesoro.w]).toEqual([2, 2]);
    // Dos mudanzas de 15, ampliar el salón 54 y la cámara 72.
    expect(s.gold - after.gold).toBe(156);
  });
});
