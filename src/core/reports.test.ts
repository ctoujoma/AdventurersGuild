import { describe, expect, it } from 'vitest';
import { newGame } from './game';
import { resolveMission } from './resolve';
import { Rng } from './rng';

describe('informes', () => {
  it('salen sin huecos, con buena gramática y muy variados', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const s = newGame(`informe-${i % 30}`);
      const q = s.quests[i % s.quests.length]!;
      const ids = s.heroes.slice(0, 1 + (i % 2)).map((h) => h.id);
      const r = resolveMission(s, { id: 'm', quest: q, heroIds: ids, daysLeft: 0 }, new Rng(i));
      for (const p of r.body) {
        expect(p).not.toMatch(/[{}]/);
        expect(p).not.toMatch(/\b[Aa] el\b|\b[Dd]e el\b/);
        expect(p.trim()).toBe(p);
        seen.add(p);
      }
    }
    expect(seen.size).toBeGreaterThan(250);
  });
});
