import { describe, expect, it } from 'vitest';
import { CHAINS } from '../data/chains';
import { PLACE_INFO } from '../data/places';
import { activeChain, advanceChain, offerChain } from './chains';
import { endDay, newGame } from './game';
import type { GameState, Report } from './model';
import { Rng } from './rng';

const report = (outcome: Report['outcome']): Report => ({
  id: 'r',
  day: 1,
  title: '',
  heroIds: [],
  who: 'Brom',
  outcome,
  body: [],
  chips: [],
  read: false,
});

function withChain(): GameState {
  const s = newGame('cadena');
  s.rep = CHAINS[0]!.rep;
  offerChain(s, new Rng('o'), []);
  return s;
}

describe('cadenas de misiones', () => {
  it('todos los pasos van a lugares del mapa', () => {
    for (const c of CHAINS) for (const st of c.steps) expect(PLACE_INFO[st.place]).toBeDefined();
  });

  it('con fama llega la carta y el primer paso aparece en el tablón', () => {
    const s = withChain();
    expect(activeChain(s)?.id).toBe(CHAINS[0]!.id);
    expect(s.quests.some((q) => q.chain?.step === 0)).toBe(true);
    expect(s.reports[0]!.heading).toMatch(/Carta/);
    // No cuenta para el tamaño del tablón ni caduca.
    const after = endDay(s);
    expect(after.quests.filter((q) => q.chain).length).toBe(1);
  });

  it('avanza con éxito, se tuerce con fracaso y paga al final', () => {
    const s = withChain();
    const rng = new Rng('a');
    const def = CHAINS[0]!;
    const take = () => {
      const q = s.quests.find((x) => x.chain)!;
      s.quests = s.quests.filter((x) => x !== q);
      return q;
    };
    let q = take();
    advanceChain(s, rng, q, report('Fracaso'), []);
    const again = s.quests.find((x) => x.chain)!;
    expect(again.chain!.step).toBe(0);
    expect(again.challenges[0]!.diff).toBeGreaterThan(q.challenges[0]!.diff - 3);
    expect(activeChain(s)?.twists).toBe(1);
    const gold = s.gold;
    for (let i = 0; i < def.steps.length; i++) {
      q = take();
      advanceChain(s, rng, q, report('Éxito'), []);
    }
    expect(activeChain(s)).toBeNull();
    expect(s.gold).toBe(gold + def.reward.gold);
    expect(s.inventory.some((it) => it.name === def.reward.item)).toBe(true);
    expect(s.stats?.chains).toBe(1);
  });
});
