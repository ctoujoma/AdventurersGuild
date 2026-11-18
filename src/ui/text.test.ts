import { describe, expect, it } from 'vitest';
import { shortGold } from './text';

describe('oro en corto', () => {
  it('hasta 9999 tal cual; luego en miles, hacia abajo y con coma', () => {
    expect(shortGold(950)).toBe('950');
    expect(shortGold(9999)).toBe('9999');
    expect(shortGold(12_340)).toBe('12,3 k');
    expect(shortGold(20_000)).toBe('20 k');
    expect(shortGold(123_456)).toBe('123 k');
  });
});
