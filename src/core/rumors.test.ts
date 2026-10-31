import { describe, expect, it } from 'vitest';
import { RUMOR_EVERY, RUMOR_SECS } from './balance';
import { endDay, newGame, reduce } from './game';
import type { GameState } from './model';
import { stepRumors } from './rumors';

/** Partida en el día 3 con un rumor en la barra. */
function withRumor(seed = 'rumor'): GameState {
  const s = structuredClone({ ...newGame(seed), day: 3, clock: 10 });
  s.rumor = { id: 'r1', text: 'Dicen que en {place} hay oro.', from: 10, until: 10 + RUMOR_SECS };
  return s;
}

describe('rumores de la barra', () => {
  it('se oyen con el juego abierto, de uno en uno y desde el segundo día', () => {
    let got = 0;
    for (let i = 0; i < 60; i++) {
      const s = structuredClone({ ...newGame('oir'), day: 3, clock: 0 });
      s.rng = i * 7919;
      stepRumors(s, 0, RUMOR_EVERY / 2);
      if (s.rumor) got++;
    }
    expect(got).toBeGreaterThan(10);
    const first = structuredClone({ ...newGame('primero'), clock: 0 });
    stepRumors(first, 0, RUMOR_EVERY * 10);
    expect(first.rumor).toBeUndefined();
  });

  it('tocado a tiempo, abre un encargo especial con botín bueno o legendario', () => {
    const s = withRumor();
    const t = reduce(s, { type: 'rumor' });
    expect(t.rumor).toBeUndefined();
    const q = t.quests.find((x) => x.rumor)!;
    expect(q).toBeDefined();
    expect(q.item!.rarity).toBeGreaterThanOrEqual(1);
    expect(q.text).toContain(q.place);
    expect(q.danger).toBeGreaterThanOrEqual(1);
    expect(t.incidentNews?.[0]?.t).toContain(q.title);
  });

  it('si no se toca, se pierde sin más; y mientras haya uno en el tablón no se oye otro', () => {
    const s = withRumor();
    stepRumors(s, 10, 10 + RUMOR_SECS);
    expect(s.rumor).toBeUndefined();
    const t = reduce(withRumor(), { type: 'rumor' });
    for (let i = 0; i < 30; i++) {
      const u = structuredClone(t);
      u.rng = i * 31;
      stepRumors(u, 20, 20 + RUMOR_EVERY);
      expect(u.rumor).toBeUndefined();
    }
  });

  it('el encargo de rumor no ocupa sitio del tablón y caduca', () => {
    const t = reduce(withRumor(), { type: 'rumor' });
    const normal = t.quests.filter((q) => !q.rumor).length;
    const next = endDay(t);
    expect(next.rumor).toBeUndefined();
    expect(next.quests.filter((q) => !q.rumor).length).toBeGreaterThanOrEqual(normal - 3);
    const later = endDay(endDay(next));
    expect(later.quests.some((q) => q.rumor)).toBe(false);
  });
});
