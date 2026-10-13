import { describe, expect, it } from 'vitest';
import { CHAINS } from '../data/chains';
import { PLACE_INFO, TAVERN } from '../data/places';
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

  it('el camino de cada historia no zigzaguea, no repite sitio ni se cruza', () => {
    type Pt = { x: number; y: number };
    const cross = (a: Pt, b: Pt, c: Pt, d: Pt) => {
      const o = (p: Pt, q: Pt, r: Pt) =>
        Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
      return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
    };
    for (const c of CHAINS) {
      const places = c.steps.map((st) => st.place).filter((p, i, a) => p !== a[i - 1]);
      expect(new Set(places).size, c.id).toBe(places.length);
      const pts = [TAVERN, ...places.map((p) => PLACE_INFO[p]!)];
      // Sin giros de casi media vuelta (ir y volver).
      for (let i = 1; i + 1 < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        const d = pts[i + 1]!;
        const u = { x: b.x - a.x, y: b.y - a.y };
        const v = { x: d.x - b.x, y: d.y - b.y };
        const cos = (u.x * v.x + u.y * v.y) / Math.hypot(u.x, u.y) / Math.hypot(v.x, v.y);
        expect(cos, `${c.id} giro en ${places[i - 1]}`).toBeGreaterThan(
          Math.cos((150 * Math.PI) / 180),
        );
      }
      for (let i = 0; i + 1 < pts.length; i++)
        for (let j = i + 2; j + 1 < pts.length; j++)
          expect(cross(pts[i]!, pts[i + 1]!, pts[j]!, pts[j + 1]!), `${c.id} ${i}-${j}`).toBe(
            false,
          );
    }
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
