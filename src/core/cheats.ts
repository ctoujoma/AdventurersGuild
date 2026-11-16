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
    return { state: s, note: `Han pasado 3 días: es el día ${s.day}.` };
  }
  if (kind === 'ladronNoche' || kind === 'mensajero') {
    // Ya de noche (a la hora del suceso, si aún es de día) y el suceso ahora mismo.
    const night = NIGHT_ROLL * DAY_SECONDS;
    const s = structuredClone((state.clock ?? 0) < night ? tick(state, night) : state);
    if (kind === 'mensajero') {
      if (s.messenger) return { state, note: 'Ya hay un mensajero en la puerta.' };
      MESSENGER_EVENT.start(s, new Rng(`prueba-${s.day}-${s.uid}`));
      return { state: s, note: 'Un mensajero llama a la puerta con un farol.' };
    }
    if (s.incidents?.length) return { state, note: 'Ya hay un incidente en marcha.' };
    startThief(s);
    return { state: s, note: 'Una sombra con un farol tapado cruza el patio.' };
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
      maxOut(s.building);
      syncFac(s);
      return { state: s, note: 'Todas las salas y mejoras al máximo.' };
    case 'asalto':
      s.raid = {
        day: s.day + 1,
        band: rng.pick(BANDS),
        strength: 8 + rankIndex(s.rep) * 5 + rng.int(0, 4),
        warned: true,
      };
      return { state: s, note: 'Asalto esta noche: pulsa «Cerrar».' };
    case 'forastero': {
      // El forastero de la tormenta ahora mismo (sin esperar a la noche ni a la tormenta). Si no
      // hay caídos, cae el primero que esté en casa, para poder probarlo.
      if (!s.heroes.some((h) => h.status === 'muerto')) {
        const h = s.heroes.find((x) => x.status === 'ok');
        if (!h) return { state, note: 'No hay caídos ni nadie en casa.' };
        h.status = 'muerto';
        delete h.worn;
        delete h.guard;
        delete h.job;
        s.fallen.unshift({ id: h.id, name: h.name, epitaph: `Modo prueba · día ${s.day}.` });
      }
      s.stranger = { day: s.day, at: s.clock ?? 0 };
      return { state: s, note: 'El forastero de la tormenta está junto al fuego del salón.' };
    }
    case 'pesadilla': {
      // Si nadie está herido ni con la moral baja, se le baja al primero que duerma en casa.
      let h = restless(s)[0];
      if (!h) {
        const ok = s.heroes.find((x) => x.status === 'ok' && !x.guard);
        if (!ok) return { state, note: 'No hay nadie en casa que duerma.' };
        ok.morale = Math.min(ok.morale, MORALE_LOW - 10);
        h = restless(s)[0];
        if (!h) return { state, note: 'No hay cama libre para nadie.' };
      }
      const n = toNight(s);
      n.nightmare = { day: n.day, hero: h.id };
      return { state: n, note: `${h.name} da vueltas en la cama: tócale para llevarle un trago.` };
    }
    case 'gato': {
      const room = huntRooms(s)[0];
      if (!room)
        return { state, note: 'Hace falta una despensa o una bodega en la planta del salón.' };
      const n = toNight(s);
      n.nightCat = { day: n.day, room: room.id, n: 3 };
      return { state: n, note: 'El gato ha salido de caza (se ve de noche).' };
    }
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
