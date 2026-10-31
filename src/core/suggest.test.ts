import { describe, expect, it } from 'vitest';
import { canSend, newGame, reduce } from './game';
import type { GameState, Hero } from './model';
import { repeatParty, suggestParty } from './suggest';

/** Una partida con los héroes que se le den (copias del primero con cambios). */
function withHeroes(seed: string, ...changes: Partial<Hero>[]): GameState {
  const s = newGame(seed);
  const base = s.heroes[0]!;
  s.heroes = changes.map((c, i) => ({
    ...structuredClone(base),
    id: `x${i}`,
    name: `H${i}`,
    ...c,
  }));
  s.quests[0] = { ...s.quests[0]!, slots: 3 };
  return s;
}
const ids = (r: ReturnType<typeof suggestParty>) => ('ids' in r ? r.ids : []);

describe('grupo sugerido', () => {
  it('sugiere un grupo que se puede mandar, sin pasarse de plazas', () => {
    const s = newGame('sugerir');
    const q = s.quests[0]!;
    const r = suggestParty(s, q.id);
    expect('ids' in r).toBe(true);
    expect(ids(r).length).toBeGreaterThan(0);
    expect(ids(r).length).toBeLessThanOrEqual(q.slots);
    expect(canSend(s, q.id, ids(r))).toBeNull();
  });

  it('empieza por el que más ayuda', () => {
    const weak = { attrs: { F: 1, D: 1, M: 1 } };
    const strong = { attrs: { F: 9, D: 9, M: 9 } };
    const s = withHeroes('fuerte', weak, strong, weak);
    expect(ids(suggestParty(s, s.quests[0]!.id))[0]).toBe('x1');
  });

  it('no lleva a más gente de la que hace falta', () => {
    const s = withHeroes(
      'sobra',
      ...Array.from({ length: 3 }, () => ({ attrs: { F: 10, D: 10, M: 10 }, lvl: 9 })),
    );
    s.quests[0] = {
      ...s.quests[0]!,
      challenges: s.quests[0]!.challenges.map((c) => ({ ...c, diff: 1 })),
    };
    expect(ids(suggestParty(s, s.quests[0]!.id))).toHaveLength(1);
  });

  it('a igualdad, mejor quien no tiene la moral baja', () => {
    const s = withHeroes('moral', { morale: 20 }, { morale: 60 });
    expect(ids(suggestParty(s, s.quests[0]!.id))[0]).toBe('x1');
  });

  it('sin los de guardia, heridos o fuera; si no queda nadie, dice por qué', () => {
    const s = withHeroes(
      'nadie',
      { guard: true },
      { status: 'herido', days: 2 },
      { status: 'mision', days: 3 },
      {},
    );
    expect(ids(suggestParty(s, s.quests[0]!.id))).toEqual(['x3']);
    s.heroes[3]!.guard = true;
    expect(suggestParty(s, s.quests[0]!.id)).toEqual({
      why: 'Los que están en casa hacen guardia.',
    });
    s.heroes = s.heroes.filter((h) => !h.guard);
    expect(suggestParty(s, s.quests[0]!.id)).toEqual({ why: 'No hay nadie en casa para ir.' });
    expect(suggestParty(s, 'no-existe')).toMatchObject({ why: expect.stringMatching(/tablón/) });
  });

  it('como la última vez: repite el grupo y dice a quién se salta', () => {
    let s = withHeroes('repetir', {}, {}, {});
    s.quests[1] = { ...s.quests[1]!, slots: 3 };
    expect(repeatParty(s, s.quests[0]!.id)).toBeNull();
    s = reduce(s, { type: 'send', questId: s.quests[0]!.id, heroIds: ['x0', 'x1'] });
    expect(s.lastParty).toEqual(['x0', 'x1']);
    // Siguen fuera: no puede ir nadie, y lo dice.
    const q = s.quests[0]!.id;
    expect(repeatParty(s, q)).toMatchObject({
      from: 'ultima',
      ids: [],
      skipped: ['H0 está de misión', 'H1 está de misión'],
    });
    // Vuelven: uno herido.
    s.heroes[0]!.status = 'ok';
    s.heroes[1]!.status = 'herido';
    s.heroes[1]!.sex = 'f';
    expect(repeatParty(s, q)).toMatchObject({ ids: ['x0'], skipped: ['H1 sigue herida'] });
  });

  it('en una historia, el grupo de su paso anterior', () => {
    let s = withHeroes('historia', {}, {}, {});
    s.chains = [{ id: 'cadena', step: 1, status: 'activa', twists: 0, party: ['x2'] }];
    s.lastParty = ['x0'];
    s.quests[0] = { ...s.quests[0]!, chain: { id: 'cadena', step: 1 } };
    expect(repeatParty(s, s.quests[0]!.id)).toMatchObject({ from: 'paso', ids: ['x2'] });
    // Al mandar un paso, se apunta en la historia.
    s = reduce(s, { type: 'send', questId: s.quests[0]!.id, heroIds: ['x0', 'x1'] });
    expect(s.chains![0]!.party).toEqual(['x0', 'x1']);
  });
});
