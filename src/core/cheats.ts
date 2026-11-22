/**
 * Modo prueba (oculto en Ajustes): atajos para ver lo que normalmente tarda días en llegar.
 * No forma parte de la partida normal ni del simulador.
 */
import { CHAINS } from '../data/chains';
import type { BossKind } from '../data/bosses';
import { BANDS } from '../data/raids';
import { DAY_SECONDS, NIGHT_ROLL, rankIndex } from './balance';
import { activeChain, advanceChain, chainDef, fightRoster, offerChain } from './chains';
import { endDay, tick } from './game';
import { MESSENGER_EVENT } from './messenger';
import { startThief } from './thief';
import type { BossFight, GameState, Report } from './model';
import { Rng } from './rng';
import { MORALE_LOW } from './party';
import { huntRooms } from './nightCat';
import { restless } from './nightmare';
import { maxOut, syncFac } from './rooms';
import { type Txt, msg, t } from '../textos';

export type Cheat =
  | 'oro'
  | 'fama'
  | 'curar'
  | 'obras'
  | 'asalto'
  | 'historia'
  | 'dias'
  | 'forastero'
  | 'ladronNoche'
  | 'mensajero'
  | 'pesadilla'
  | 'gato';

/** Lleva el reloj a la hora de los sucesos de la noche (si aún no ha llegado) y da la noche por tirada. */
function toNight(s: GameState): GameState {
  const n = tick(s, NIGHT_ROLL * DAY_SECONDS);
  n.nights = { rolled: n.day, last: { ...(n.nights?.last ?? {}) } };
  return n;
}

export function cheat(state: GameState, kind: Cheat): { state: GameState; note: string } {
  if (kind === 'dias') {
    let s = state;
    for (let i = 0; i < 3 && !s.over; i++) s = endDay(s);
    return { state: s, note: t('trucos.dias', { dia: s.day }) };
  }
  if (kind === 'ladronNoche' || kind === 'mensajero') {
    // Ya de noche (a la hora del suceso, si aún es de día) y el suceso ahora mismo.
    const night = NIGHT_ROLL * DAY_SECONDS;
    const s = structuredClone((state.clock ?? 0) < night ? tick(state, night) : state);
    if (kind === 'mensajero') {
      if (s.messenger) return { state, note: t('trucos.ya_mensajero') };
      MESSENGER_EVENT.start(s, new Rng(`prueba-${s.day}-${s.uid}`));
      return { state: s, note: t('trucos.mensajero') };
    }
    if (s.incidents?.length) return { state, note: t('trucos.ya_incidente') };
    startThief(s);
    return { state: s, note: t('trucos.ladron') };
  }
  const s = structuredClone(state);
  const rng = new Rng(`prueba-${s.day}-${s.uid}`);
  switch (kind) {
    case 'oro':
      s.gold += 500;
      return { state: s, note: t('trucos.oro') };
    case 'fama':
      s.rep += 50;
      return { state: s, note: t('trucos.fama', { n: s.rep }) };
    case 'curar':
      for (const h of s.heroes)
        if (h.status === 'herido') {
          h.status = 'ok';
          h.days = 0;
        }
      for (const h of s.heroes) if (h.status !== 'muerto') h.morale = 100;
      return { state: s, note: t('trucos.curar') };
    case 'obras':
      maxOut(s.building);
      syncFac(s);
      return { state: s, note: t('trucos.obras') };
    case 'asalto':
      s.raid = {
        day: s.day + 1,
        band: rng.pick(BANDS),
        strength: 8 + rankIndex(s.rep) * 5 + rng.int(0, 4),
        warned: true,
      };
      return { state: s, note: t('trucos.asalto') };
    case 'forastero': {
      // El forastero de la tormenta ahora mismo (sin esperar a la noche ni a la tormenta). Si no
      // hay caídos, cae el primero que esté en casa, para poder probarlo.
      if (!s.heroes.some((h) => h.status === 'muerto')) {
        const h = s.heroes.find((x) => x.status === 'ok');
        if (!h) return { state, note: t('trucos.sin_caidos') };
        h.status = 'muerto';
        delete h.worn;
        delete h.guard;
        delete h.job;
        s.fallen.unshift({
          id: h.id,
          name: h.name,
          epitaph: msg('trucos.epitafio', { dia: s.day }),
        });
      }
      s.stranger = { day: s.day, at: s.clock ?? 0 };
      return { state: s, note: t('trucos.forastero') };
    }
    case 'pesadilla': {
      // Si nadie está herido ni con la moral baja, se le baja al primero que duerma en casa.
      let h = restless(s)[0];
      if (!h) {
        const ok = s.heroes.find((x) => x.status === 'ok' && !x.guard);
        if (!ok) return { state, note: t('trucos.nadie_duerme') };
        ok.morale = Math.min(ok.morale, MORALE_LOW - 10);
        h = restless(s)[0];
        if (!h) return { state, note: t('trucos.sin_cama') };
      }
      const n = toNight(s);
      n.nightmare = { day: n.day, hero: h.id };
      return { state: n, note: t('trucos.pesadilla', { heroe: h.name }) };
    }
    case 'gato': {
      const room = huntRooms(s)[0];
      if (!room) return { state, note: t('trucos.sin_despensa') };
      const n = toNight(s);
      n.nightCat = { day: n.day, room: room.id, n: 3 };
      return { state: n, note: t('trucos.gato') };
    }
    case 'historia': {
      const cs = activeChain(s);
      const events: { t: Txt }[] = [];
      if (!cs) {
        // La siguiente historia sin esperar a tener la fama.
        const next = CHAINS.find((c) => !(s.chains ?? []).some((x) => x.id === c.id));
        if (!next) return { state, note: t('trucos.sin_historias') };
        s.rep = Math.max(s.rep, next.rep);
        offerChain(s, rng, events);
        return { state: s, note: t('trucos.carta', { historia: next.name }) };
      }
      // Da por bueno el paso que está en el tablón y trae el siguiente.
      const q = s.quests.find((x) => x.chain?.id === cs.id);
      if (!q) return { state, note: t('trucos.en_camino') };
      s.quests = s.quests.filter((x) => x !== q);
      const r: Report = {
        id: `r${s.uid++}`,
        day: s.day,
        title: q.title,
        heroIds: [],
        who: msg('trucos.el_gremio'),
        outcome: 'Éxito',
        body: [msg('trucos.paso_bueno')],
        chips: [],
        read: true,
      };
      advanceChain(s, rng, q, r, events);
      const def = chainDef(cs.id);
      return {
        state: s,
        note:
          cs.status === 'hecha'
            ? t('trucos.terminada', { historia: def.name })
            : t('trucos.paso', { historia: def.name, n: cs.step + 1 }),
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
