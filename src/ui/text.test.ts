import { describe, expect, it } from 'vitest';
import { shortGold } from './text';

describe('oro en corto', () => {
  it('hasta 999 tal cual; luego en miles, hacia abajo y con coma', () => {
    expect(shortGold(950)).toBe('950');
    expect(shortGold(1000)).toBe('1 k');
    expect(shortGold(1250)).toBe('1,2 k');
    expect(shortGold(9999)).toBe('9,9 k');
    expect(shortGold(12_340)).toBe('12,3 k');
    expect(shortGold(20_000)).toBe('20 k');
    expect(shortGold(123_456)).toBe('123 k');
  });
});
