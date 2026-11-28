import { describe, expect, it } from 'vitest';
import { newGame } from '../../core/game';
import { battleSetup } from '../../core/expedition';
import { Combat } from '../../core/combat';
import type { Expedition, Heading } from '../../core/model';
import { scriptOf } from './replay';

function fight(heading: Heading, foe: number, dist = 3) {
  const s = newGame('replay');
  for (const h of s.heroes) h.lvl = 8;
  const ids = s.heroes.slice(0, 3).map((h) => h.id);
  const e = { heading, heroIds: ids, seed: 'replay', hours: 30 } as Expedition;
  return { setup: battleSetup(s, e, dist, foe), ids };
}

describe('la repetición del visor es la pelea de verdad', () => {
  it('cada golpe de un héroe sale en el guion, con lo que quitó', () => {
    const { setup, ids } = fight('sierra', 3);
    const c = new Combat(setup, [], true);
    c.run();
    const real = c.events.filter((e) => e.kind === 'hit' && ids.includes(e.from));
    const sc = scriptOf(setup, ids, 1);
    const blows = sc.heroes.flatMap((h) => h.acts.flatMap((a) => a.blows));
    expect(blows.length).toBe(real.length);
    const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
    expect(sum(blows.map((b) => b.amount))).toBe(
      sum(real.map((e) => (e.kind === 'hit' ? e.amount : 0))),
    );
  });

  it('al ganar, el último cae con un golpe de un héroe (no solo)', () => {
    const { setup, ids } = fight('sierra', 3);
    const sc = scriptOf(setup, ids, 1);
    expect(sc.won).toBe(true);
    const at = sc.foes[0]!.downAt;
    expect(sc.foes[0]!.taken.some((x) => x.at === at && !x.heal)).toBe(true);
  });

  it('una manada (una unidad, tres muñecos) cae de uno en uno, a su parte de vida', () => {
    const { setup, ids } = fight('bosque', 0);
    const sc = scriptOf(setup, ids, 3);
    const downs = sc.foes.map((f) => f.downAt);
    expect(downs.every(Number.isFinite)).toBe(true);
    expect([...downs].sort((a, b) => a - b)).toEqual(downs);
    expect(downs[0]).toBeLessThan(downs[2]!);
  });
});
