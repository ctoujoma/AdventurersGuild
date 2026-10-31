import { describe, expect, it } from 'vitest';
import { CHAINS } from '../data/chains';
import { PLACE_INFO, TAVERN } from '../data/places';
import { BOSSES } from '../data/bosses';
import { GEAR } from '../data/items';
import { activeChain, advanceChain, chainQuest, offerChain } from './chains';
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

  it('los premios y los jefes de las historias existen', () => {
    for (const c of CHAINS) {
      expect(
        GEAR.some((g) => g.name === c.reward.item),
        c.id,
      ).toBe(true);
      for (const st of c.steps) if (st.boss) expect(BOSSES[st.boss]).toBeDefined();
    }
    expect(CHAINS.filter((c) => c.steps.some((st) => st.boss)).length).toBeGreaterThanOrEqual(3);
  });

  it('la pelea contra el jefe queda en el informe y se avisa al amanecer', () => {
    const s = withChain();
    const def = CHAINS[0]!;
    const last = def.steps.length - 1;
    expect(def.steps[last]!.boss).toBe('bestia');
    s.chains![0]!.step = last;
    s.quests = s.quests.filter((q) => !q.chain);
    const q = chainQuest(s, new Rng('b'), def, last, 0);
    const party = s.heroes.slice(0, 2);
    for (const h of party) {
      h.status = 'mision';
      h.days = 1;
    }
    s.missions.push({ id: 'm1', quest: q, heroIds: party.map((h) => h.id), daysLeft: 1 });
    const after = endDay(s);
    const r = after.reports.find((x) => x.id === after.lastFight)!;
    expect(r.fight?.boss).toBe('bestia');
    expect(r.fight?.place).toBe(q.place);
    expect(r.fight?.heroes.map((h) => h.id)).toEqual(party.map((h) => h.id));
    expect(r.fight?.won).toBe(r.outcome !== 'Fracaso' && r.outcome !== 'Desastre');
    // La noche siguiente ya no hay aviso pendiente.
    expect(endDay(after).lastFight).toBeNull();
  });
});

describe('historias de oro y leyenda', () => {
  it('hay historia con jefe para cada rango alto, y todo en tierra', async () => {
    const { RANKS } = await import('./balance');
    const { coastAt } = await import('../art/map');
    for (const r of RANKS.slice(2)) {
      const next = RANKS[RANKS.indexOf(r) + 1]?.at ?? Infinity;
      const here = CHAINS.filter((c) => c.rep >= r.at && c.rep < next);
      expect(
        here.some((c) => c.steps.some((st) => st.boss)),
        r.name,
      ).toBe(true);
    }
    for (const c of CHAINS)
      for (const st of c.steps) {
        const p = PLACE_INFO[st.place]!;
        expect(p.x, st.place).toBeGreaterThan(coastAt(p.y) + 8);
      }
  });
});
