import { describe, expect, it } from 'vitest';
import { newGame, reduce } from '../core/game';
import { TIPS, nextTip } from './tips';

describe('notas del tío', () => {
  it('salen una vez cada una y se pueden apagar', () => {
    let s = newGame('tutorial');
    expect(nextTip(s)?.id).toBe('tablon');
    s = reduce(s, { type: 'tip', id: 'tablon' });
    expect(nextTip(s)?.id).not.toBe('tablon');
    s = reduce(s, { type: 'tip', id: '*' });
    expect(nextTip(s)).toBeNull();
  });

  it('el día 30, en la vista de salas, el tío explica las obras una a una', () => {
    let s = newGame('obras');
    s.tips = TIPS.filter((t) => !t.rooms).map((t) => t.id);
    s.mode = 'libre';
    s.day = 31;
    s.opening = {
      day: 31,
      heroes: 0,
      gold: 0,
      rep: 0,
      trophies: 0,
      facilities: 0,
      fallen: 0,
      score: 0,
      seen: true,
    };
    expect(nextTip(s)).toBeNull();
    expect(nextTip(s, true)?.id).toBe('obras');
    s = reduce(s, { type: 'tip', id: 'obras' });
    // Al día siguiente, el modo plano; y al otro, excavar.
    expect(nextTip(s, true)).toBeNull();
    s.day = 32;
    expect(nextTip(s, true)?.id).toBe('plano');
    s = reduce(s, { type: 'tip', id: 'plano' });
    s.day = 33;
    expect(nextTip(s, true)?.id).toBe('excavar');
  });
});
