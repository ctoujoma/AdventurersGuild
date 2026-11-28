import { describe, expect, it } from 'vitest';
import { EXP_FOE_COUNT } from '../core/expedition';
import { expFoeArt } from './expFoes';

describe('enemigos de las expediciones', () => {
  it('el motor cuenta los mismos enemigos que dibuja el visor', () => {
    for (const [h, counts] of Object.entries(EXP_FOE_COUNT) as [
      keyof typeof EXP_FOE_COUNT,
      readonly number[],
    ][])
      counts.forEach((n, i) => expect(expFoeArt(h, i).count, `${h} ${i}`).toBe(n));
  });
});
