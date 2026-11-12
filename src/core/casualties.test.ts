import { describe, expect, it } from 'vitest';
import { LOST_SHARE, returnChance } from './balance';
import { endDay, newGame } from './game';
import type { GameState, Hero } from './model';
import type { Challenge } from './party';
import { resolveMission } from './resolve';
import { Rng } from './rng';

const s0 = newGame('bajas');
const IMPOSSIBLE: Challenge = { skill: 'Arcano', diff: 99 };
const EASY: Challenge = { skill: 'Combate', diff: 0 };

/** Un héroe limpio (sin rasgos) de la clase dada. */
const hero = (id: string, cls: Hero['cls'], traits: Hero['traits'] = []): Hero => ({
  ...structuredClone(s0.heroes[0]!),
  id,
  cls,
  traits,
  status: 'mision',
});

/** Manda `n` veces el mismo encargo y cuenta qué fue de cada héroe del grupo. */
function run(
  danger: 0 | 1 | 2 | 3,
  challenges: Challenge[],
  party: () => Hero[],
  n = 600,
): { dead: number; lost: number; byId: Record<string, number> } {
  let dead = 0;
  let lost = 0;
  const byId: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const st: GameState = structuredClone(s0);
    st.heroes = party();
    const q = { ...st.quests[0]!, danger, challenges, twist: undefined };
    resolveMission(
      st,
      { id: 'm', quest: q, heroIds: st.heroes.map((h) => h.id), daysLeft: 0 },
      new Rng(`b${i}`),
    );
    for (const h of st.heroes) {
      if (h.status === 'muerto') dead++;
      if (h.status === 'desaparecido') lost++;
      if (h.status === 'muerto' || h.status === 'desaparecido') byId[h.id] = (byId[h.id] ?? 0) + 1;
    }
  }
  return { dead, lost, byId };
}

describe('bajas (A8)', () => {
  it('en un letal fallido se pierde gente a menudo; en uno fácil, casi nunca', () => {
    const solo = () => [hero('a', 'guerrero')];
    const hard = run(3, [IMPOSSIBLE], solo);
    expect((hard.dead + hard.lost) / 600).toBeGreaterThan(0.5);
    const easy = run(0, [IMPOSSIBLE], solo);
    expect((easy.dead + easy.lost) / 600).toBeLessThan(0.06);
  });

  it('un éxito parcial letal se cobra bajas, menos que un fracaso; uno fácil, casi nunca', () => {
    const solo = () => [hero('a', 'guerrero')];
    const partial = run(3, [EASY, IMPOSSIBLE], solo);
    const failed = run(3, [IMPOSSIBLE], solo);
    expect(partial.dead + partial.lost).toBeGreaterThan(60);
    expect(partial.dead + partial.lost).toBeLessThan(failed.dead + failed.lost);
    const easy = run(1, [EASY, IMPOSSIBLE], solo);
    expect(easy.dead + easy.lost).toBeLessThan(18);
  });

  it('unas 7 de cada 10 bajas son desaparecidos', () => {
    const r = run(3, [IMPOSSIBLE], () => [hero('a', 'guerrero')], 1500);
    const share = r.lost / (r.dead + r.lost);
    expect(share).toBeGreaterThan(LOST_SHARE - 0.08);
    expect(share).toBeLessThan(LOST_SHARE + 0.08);
  });

  it('el clérigo salva a veces, no siempre', () => {
    const alone = run(3, [IMPOSSIBLE], () => [hero('a', 'guerrero'), hero('b', 'guerrero')]);
    const blessed = run(3, [IMPOSSIBLE], () => [hero('a', 'guerrero'), hero('c', 'clerigo')]);
    expect(blessed.byId.a ?? 0).toBeGreaterThan(0);
    expect(blessed.byId.a ?? 0).toBeLessThan((alone.byId.a ?? 0) * 0.8);
  });

  it('el cobarde huye a veces, no siempre', () => {
    const brave = run(3, [IMPOSSIBLE], () => [hero('a', 'guerrero')]);
    const coward = run(3, [IMPOSSIBLE], () => [hero('a', 'guerrero', [{ id: 'cobarde' }])]);
    expect(coward.byId.a ?? 0).toBeGreaterThan(0);
    expect(coward.byId.a ?? 0).toBeLessThan((brave.byId.a ?? 0) * 0.8);
  });

  it('la capilla hace que vuelvan más desaparecidos', () => {
    expect(returnChance(3) - returnChance(0)).toBeGreaterThanOrEqual(0.3);
    const back = (cap: number) => {
      let n = 0;
      for (let i = 0; i < 150; i++) {
        const s = newGame(`capilla${i}`);
        s.fac.cap = cap;
        const h = s.heroes[0]!;
        h.status = 'desaparecido';
        h.days = 1;
        const after = endDay(s).heroes.find((x) => x.id === h.id)!;
        if (after.status !== 'muerto') n++;
      }
      return n;
    };
    expect(back(3)).toBeGreaterThan(back(0) + 30);
  });
});
