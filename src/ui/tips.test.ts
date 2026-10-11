import { describe, expect, it } from 'vitest';
import { newGame, reduce } from '../core/game';
import { nextTip } from './tips';

describe('notas del tío', () => {
  it('salen una vez cada una y se pueden apagar', () => {
    let s = newGame('tutorial');
    expect(nextTip(s)?.id).toBe('tablon');
    s = reduce(s, { type: 'tip', id: 'tablon' });
    expect(nextTip(s)?.id).not.toBe('tablon');
    s = reduce(s, { type: 'tip', id: '*' });
    expect(nextTip(s)).toBeNull();
  });
});
