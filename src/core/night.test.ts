import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, WORK_END } from './balance';
import { newGame, nightLeft } from './game';

describe('la noche', () => {
  it('empieza cuando se van a dormir y dura hasta que acaba el día', () => {
    const s = newGame('noche');
    expect(nightLeft({ ...s, clock: 0 })).toBe(0);
    expect(nightLeft({ ...s, clock: WORK_END * DAY_SECONDS - 1 })).toBe(0);
    expect(nightLeft({ ...s, clock: WORK_END * DAY_SECONDS })).toBeCloseTo(
      (1 - WORK_END) * DAY_SECONDS,
    );
    expect(nightLeft({ ...s, clock: DAY_SECONDS })).toBe(0);
  });
});
