import { describe, expect, it } from 'vitest';
import {
  Combat,
  MAX_TIME,
  STEP,
  heroUnit,
  questFoes,
  runCombat,
  setupCombat,
  type CombatSetup,
} from './combat';
import { newGame } from './game';

/** Los dos héroes de una partida nueva contra la bestia de Hondogrís. */
function setup(seed: string, diff = 12): CombatSetup {
  const s = newGame(seed);
  const heroes = s.heroes.map((h) => heroUnit(h));
  return setupCombat(seed, 'bestia', heroes, questFoes('bestia', [{ diff }, { diff }]));
}

describe('la pelea contra un jefe', () => {
  it('acaba siempre, ganando o perdiendo, antes del tiempo máximo', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const r = runCombat(setup(seed));
      expect(r.steps * STEP).toBeLessThanOrEqual(MAX_TIME + STEP);
      expect(typeof r.won).toBe('boolean');
    }
  });

  it('con la misma semilla y las mismas órdenes, sale igual', () => {
    const st = setup('igual');
    const live = new Combat(st, [], false);
    const hero = live.heroes()[0]!;
    let given = false;
    while (!live.result) {
      // A media pelea, el primero usa su habilidad en cuanto puede.
      if (!given && live.t > 4 && hero.charge === 0)
        given = live.order({ who: hero.id, kind: 'skill' });
      live.tick();
    }
    expect(given).toBe(true);
    const again = runCombat(st, live.orders);
    expect(again).toEqual(live.result);
  });

  it('repetida con cubrirse y críticos a medias, sale igual (la IA no se mete distinto)', () => {
    for (const seed of ['r1', 'r2', 'r3']) {
      const st = setup(seed, 16);
      const live = new Combat(st, [], false);
      let covered = 0;
      while (!live.result) {
        const h = live.heroes().find((u) => u.hp > 0);
        // Se cubre solo en el primer aviso y coge solo algunas ocasiones de crítico.
        if (h && !covered && live.events.some((e) => e.kind === 'warn'))
          if (live.order({ who: h.id, kind: 'cover' })) covered++;
        for (const u of live.heroes())
          if (u.critOpen && live.step % 3 === 0) live.order({ who: u.id, kind: 'crit' });
        live.tick();
      }
      const again = new Combat(st, live.orders, false);
      expect(again.run()).toEqual(live.result);
      expect(again.events).toEqual(live.events);
    }
  });

  it('coger la ocasión de crítico hace que el golpe entre crítico', () => {
    const c = new Combat(setup('critico'), [], false);
    let taken = 0;
    while (!c.result) {
      for (const u of c.heroes())
        if (u.critOpen && !u.critTaken && c.order({ who: u.id, kind: 'crit' })) taken++;
      c.tick();
    }
    const crits = c.events.filter((e) => e.kind === 'crit' && c.unit(e.from)?.side === 'h').length;
    expect(taken).toBeGreaterThan(0);
    // Cada ocasión cogida acaba en crítico (salvo la última si la pelea termina antes).
    expect(crits).toBeGreaterThanOrEqual(taken - 1);
  });

  it('sin tocar nada, la pelea va igual que si se las apañan solos', () => {
    for (const seed of ['x', 'y', 'z']) {
      const st = setup(seed);
      expect(new Combat(st, [], false).run()).toEqual(runCombat(st));
    }
  });

  it('cubrirse a tiempo del golpe fuerte del jefe quita mucho daño', () => {
    const st = setup('cubrirse', 16);
    const hurt = (cover: boolean) => {
      const c = new Combat(st, [], false);
      while (!c.result && !c.events.some((e) => e.kind === 'special')) {
        if (cover && c.events.some((e) => e.kind === 'warn'))
          c.order({ who: c.heroes()[0]!.id, kind: 'cover' });
        c.tick();
      }
      const special = c.events.find((e) => e.kind === 'special')!;
      return c.events
        .filter((e) => e.step === special.step && e.kind === 'hit')
        .reduce((a, e) => a + (e.amount ?? 0), 0);
    };
    expect(hurt(true)).toBeLessThan(hurt(false) * 0.6);
  });

  it('las órdenes que no valen no cuentan (cubrirse sin aviso, habilidad sin cargar)', () => {
    const c = new Combat(setup('mal'), [], false);
    const h = c.heroes()[0]!;
    expect(c.order({ who: h.id, kind: 'cover' })).toBe(false);
    h.charge = 3;
    expect(c.order({ who: h.id, kind: 'skill' })).toBe(false);
    expect(c.orders).toHaveLength(0);
  });

  it('un jefe más duro gana más a menudo', () => {
    const wins = (diff: number) =>
      ['1', '2', '3', '4', '5', '6', '7', '8'].filter((k) => runCombat(setup(k, diff)).won).length;
    expect(wins(6)).toBeGreaterThanOrEqual(wins(30));
  });
});
