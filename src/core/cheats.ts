/**
 * Modo prueba (oculto en Ajustes): atajos para ver lo que normalmente tarda días en llegar.
 * No forma parte de la partida normal ni del simulador.
 */
import { CHAINS } from '../data/chains';
import type { BossKind } from '../data/bosses';
import { BANDS } from '../data/raids';
import { UPGRADE_COST, rankIndex } from './balance';
import { activeChain, advanceChain, chainDef, fightRoster, offerChain } from './chains';
import { endDay } from './game';
import type { BossFight, Facilities, GameState, Report } from './model';
import { Rng } from './rng';

export type Cheat = 'oro' | 'fama' | 'curar' | 'obras' | 'asalto' | 'historia' | 'dias';

export function cheat(state: GameState, kind: Cheat): { state: GameState; note: string } {
  if (kind === 'dias') {
    let s = state;
    for (let i = 0; i < 3 && !s.over; i++) s = endDay(s);
    return { state: s, note: `Han pasado 3 días: es el día ${s.day}.` };
  }
  const s = structuredClone(state);
  const rng = new Rng(`prueba-${s.day}-${s.uid}`);
  switch (kind) {
    case 'oro':
      s.gold += 500;
      return { state: s, note: '+500 monedas.' };
    case 'fama':
      s.rep += 50;
      return { state: s, note: `+50 de reputación (${s.rep}).` };
    case 'curar':
      for (const h of s.heroes)
        if (h.status === 'herido') {
          h.status = 'ok';
          h.days = 0;
        }
      for (const h of s.heroes) if (h.status !== 'muerto') h.morale = 100;
      return { state: s, note: 'Todos curados y con la moral al máximo.' };
    case 'obras':
      for (const k of Object.keys(UPGRADE_COST) as (keyof Facilities)[])
        s.fac[k] = UPGRADE_COST[k].length - 1;
      return { state: s, note: 'Todas las mejoras al máximo.' };
    case 'asalto':
      s.raid = {
        day: s.day + 1,
        band: rng.pick(BANDS),
        strength: 8 + rankIndex(s.rep) * 5 + rng.int(0, 4),
        warned: true,
      };
      return { state: s, note: 'Asalto esta noche: pulsa «Terminar día».' };
    case 'historia': {
      const cs = activeChain(s);
      const events: { t: string }[] = [];
      if (!cs) {
        // La siguiente historia sin esperar a tener la fama.
        const next = CHAINS.find((c) => !(s.chains ?? []).some((x) => x.id === c.id));
        if (!next) return { state, note: 'No quedan historias por empezar.' };
        s.rep = Math.max(s.rep, next.rep);
        offerChain(s, rng, events);
        return { state: s, note: `Carta nueva: «${next.name}».` };
      }
      // Da por bueno el paso que está en el tablón y trae el siguiente.
      const q = s.quests.find((x) => x.chain?.id === cs.id);
      if (!q)
        return { state, note: 'El paso de la historia está en camino; espera a que vuelvan.' };
      s.quests = s.quests.filter((x) => x !== q);
      const r: Report = {
        id: `r${s.uid++}`,
        day: s.day,
        title: q.title,
        heroIds: [],
        who: 'El gremio',
        outcome: 'Éxito',
        body: ['(Modo prueba: paso dado por bueno.)'],
        chips: [],
        read: true,
      };
      advanceChain(s, rng, q, r, events);
      const def = chainDef(cs.id);
      return {
        state: s,
        note:
          cs.status === 'hecha'
            ? `«${def.name}» terminada.`
            : `«${def.name}»: paso ${cs.step + 1} en el tablón.`,
      };
    }
  }
}

/** Una pelea contra un jefe con los héroes que haya en casa, para verla sin esperar. */
export function testFight(s: GameState, boss: BossKind, won: boolean): BossFight | null {
  const heroes = s.heroes.filter((h) => h.status === 'ok').slice(0, 4);
  if (!heroes.length) return null;
  const chain = CHAINS.find((c) => c.steps.some((st) => st.boss === boss))!;
  const roster = fightRoster(heroes);
  if (!won && roster.length > 1) roster[roster.length - 1]!.fate = 'herido';
  return { boss, place: chain.steps.find((st) => st.boss === boss)!.place, won, heroes: roster };
}
