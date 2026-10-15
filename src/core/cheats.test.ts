import { describe, expect, it } from 'vitest';
import { CHAINS } from '../data/chains';
import { cheat, testFight } from './cheats';
import { activeChain } from './chains';
import { endDay, newGame } from './game';

describe('modo prueba', () => {
  it('da oro, fama y mejoras sin tocar el estado original', () => {
    const s = newGame('prueba');
    const rich = cheat(s, 'oro').state;
    expect(rich.gold).toBe(s.gold + 500);
    expect(s.gold).toBe(newGame('prueba').gold);
    expect(cheat(s, 'fama').state.rep).toBe(s.rep + 50);
    expect(cheat(s, 'obras').state.fac.vet).toBe(2);
  });

  it('prepara un asalto para esta noche', () => {
    const s = cheat(newGame('asalto'), 'asalto').state;
    expect(s.raid?.warned).toBe(true);
    expect(endDay(s).lastRaid).toBeTruthy();
  });

  it('empieza la siguiente historia y la avanza paso a paso hasta el final', () => {
    let s = cheat(newGame('historia'), 'historia').state;
    expect(activeChain(s)?.id).toBe(CHAINS[0]!.id);
    for (let i = 0; i < CHAINS[0]!.steps.length; i++) s = cheat(s, 'historia').state;
    expect(activeChain(s)).toBeNull();
    expect(s.chains?.[0]?.status).toBe('hecha');
  });

  it('arma una pelea contra cada jefe con los héroes de casa', () => {
    const s = newGame('jefe');
    for (const boss of ['bestia', 'ahogado', 'sierpe'] as const) {
      const f = testFight(s, boss, false)!;
      expect(f.boss).toBe(boss);
      expect(f.heroes.length).toBeGreaterThan(0);
    }
  });
});
