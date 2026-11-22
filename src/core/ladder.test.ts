import { describe, expect, it } from 'vitest';
import { CACHE, LEVEL_MAX, MASTER_LEVEL, VET_LEVEL, XP_PER_LEVEL } from './balance';
import { isVet } from './beds';
import { newGame } from './game';
import { newLadder } from './ladder';
import { levelUp } from './resolve';

describe('la escalera de los héroes', () => {
  it('veterano a 8, caché al hacerse veterano y maestro, y tope en 15', () => {
    const s = newGame('escalera');
    const h = s.heroes[0]!;
    h.lvl = VET_LEVEL - 1;
    expect(isVet(h)).toBe(false);
    h.xp = XP_PER_LEVEL;
    levelUp(s, h);
    expect(isVet(h)).toBe(true);
    expect(h.request).toBe('cache');
    expect(h.cacheAt).toBe(VET_LEVEL);
    delete h.request;
    h.lvl = MASTER_LEVEL - 1;
    h.xp = XP_PER_LEVEL;
    levelUp(s, h);
    expect(h.request).toBe('cache');
    expect(h.cacheAt).toBe(MASTER_LEVEL);
    expect(CACHE[MASTER_LEVEL]).toBeGreaterThan(CACHE[VET_LEVEL]!);
    h.lvl = LEVEL_MAX - 1;
    h.xp = XP_PER_LEVEL * 5;
    levelUp(s, h);
    expect(h.lvl).toBe(LEVEL_MAX);
    expect(h.xp).toBe(0);
  });

  it('partidas de antes: los veteranos siguen siéndolo, lo pagado cuenta y nadie pasa del 15', () => {
    const s = newGame('vieja');
    const base = s.heroes[0]!;
    s.heroes = [1, 2, 3, 4].map((i) => ({ ...structuredClone(base), id: `h${i}` }));
    const [a, b, c, d] = s.heroes;
    a!.lvl = 4; // veterano de antes, sin caché
    b!.lvl = 6; // cobró el caché del 5
    c!.lvl = 18;
    c!.salary = 400;
    d!.lvl = 2;
    newLadder(s);
    expect(isVet(a!)).toBe(true);
    expect(a!.cacheAt).toBeUndefined();
    expect(isVet(b!)).toBe(true);
    expect(b!.cacheAt).toBe(VET_LEVEL);
    expect(c!.lvl).toBe(LEVEL_MAX);
    expect(c!.salary).toBe(400 - 4 * (16 + 17 + 18));
    expect(isVet(d!)).toBe(false);
    // El del 5 no vuelve a pedir al llegar al 8; el veterano de antes, sí.
    b!.lvl = VET_LEVEL - 1;
    b!.xp = XP_PER_LEVEL;
    levelUp(s, b!);
    expect(b!.request).toBeUndefined();
    a!.lvl = VET_LEVEL - 1;
    a!.xp = XP_PER_LEVEL;
    levelUp(s, a!);
    expect(a!.request).toBe('cache');
  });
});
