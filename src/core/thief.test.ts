import { describe, expect, it } from 'vitest';
import {
  DAY_SECONDS,
  NIGHT_ROLL,
  NIGHT_THIEF_RUN,
  NIGHT_THIEF_SHARE,
  NIGHT_THIEF_TOP,
  WORK_END,
} from './balance';
import { endDay, newGame, reduce, tick } from './game';
import { failIncidents, nappers, stepIncidents } from './incidents';
import type { DawnEvent, GameState } from './model';
import { THIEF_EVENT, startThief, thiefRoom } from './thief';

/** Una partida sin tutorial, de noche, con oro, para que entre el ladrón. */
function night(seed = 'ladron-noche', day = 9): GameState {
  const s = newGame(seed);
  delete s.tutorial;
  s.mode = 'libre';
  s.day = day;
  // La caja del día ya entregada: así el oro solo cambia por el ladrón.
  const t = tick({ ...s, clock: 0 }, NIGHT_ROLL * DAY_SECONDS);
  t.gold = 400;
  return t;
}

/** Pone de guardia (en la puerta o en la cámara) a un héroe en casa. */
function guard(s: GameState, i = 0, post?: 'tesoro') {
  const h = s.heroes.filter((x) => x.status === 'ok')[i]!;
  h.guard = true;
  delete h.job;
  if (post) h.post = post;
  return h;
}

/** Pasa la noche sin tocar nada: lo que se cuenta al amanecer. */
function untouched(s: GameState): DawnEvent[] {
  const ev: DawnEvent[] = [];
  failIncidents(s, ev);
  return ev;
}

describe('el ladrón nocturno', () => {
  it('entra de noche hacia la cámara (si hay) o la caja, y no de día', () => {
    const s = night();
    expect(THIEF_EVENT.when(s)).toBe(true);
    const inc = startThief(s)!;
    expect(inc.kind).toBe('nocturno');
    expect(inc.room).toBe(thiefRoom(s));
    // Sin oro que llevarse, no se molesta.
    expect(THIEF_EVENT.when({ ...night(), gold: 5 })).toBe(false);
    // De día no sale nunca entre los incidentes sueltos.
    const d: GameState = { ...night(), clock: 10, incidents: [] };
    for (let i = 0; i < 200; i++) {
      const t = structuredClone(d);
      t.rng = i * 7919;
      stepIncidents(t, 0, 150);
      expect(t.incidents?.some((x) => x.kind === 'nocturno')).toBeFalsy();
    }
  });

  it('sin guardia se lleva una parte de la caja, con tope', () => {
    const s = night();
    startThief(s);
    const ev = untouched(s);
    expect(s.incidents).toEqual([]);
    expect(s.gold).toBe(400 - Math.min(Math.floor(400 * NIGHT_THIEF_SHARE), NIGHT_THIEF_TOP));
    expect(ev[0]?.k).toBe('bad');
    expect(ev[0]?.t).toMatch(/Nadie le vio/);
    const rich = night();
    rich.gold = 5000;
    startThief(rich);
    untouched(rich);
    expect(5000 - rich.gold).toBe(NIGHT_THIEF_TOP);
  });

  it('el de guardia despierto le sale al paso; si cabecea, se cuela', () => {
    let caught = 0;
    let slipped = 0;
    for (let d = 9; d < 69; d++) {
      const s = night('guardia', d);
      const g = guard(s);
      const inc = startThief(s)!;
      // Va a la cámara (sin guardia allí): el de la puerta le ve al salir, un poco después.
      const vault = s.building.rooms.find((r) => r.id === inc.room)?.type === 'tesoro';
      const at = vault ? inc.until + NIGHT_THIEF_RUN : inc.until;
      const asleep = nappers([g.id], at / DAY_SECONDS, s.day).length > 0;
      const thieves = s.stats?.thieves ?? 0;
      const ev = untouched(s);
      const end = s.incidentLog!.at(-1)!;
      if (asleep) {
        expect(end.how).toBe('cuela');
        expect(ev[0]!.t).toContain('cabeceaba');
        slipped++;
      } else if (end.how === 'bien' || end.how === 'puerta') {
        expect(s.gold).toBe(400);
        expect(s.stats?.thieves ?? 0).toBe(thieves + 1);
        caught++;
      }
    }
    // Ni siempre ni nunca: más o menos la mitad de las veces.
    expect(slipped).toBeGreaterThan(10);
    expect(caught).toBeGreaterThan(18);
    expect(caught).toBeLessThan(42);
  });

  it('de noche, cabezadas en ciclo; con dos se turnan, pero a ratos cabecean los dos', () => {
    const ids = ['a', 'b'];
    let one = 0;
    let both = 0;
    let none = 0;
    const from = WORK_END * DAY_SECONDS;
    for (let t = from; t < DAY_SECONDS; t += 0.5) {
      const n = nappers(ids, t / DAY_SECONDS, 5).length;
      if (n === 2) both++;
      else if (n === 1) one++;
      else none++;
    }
    expect(one).toBeGreaterThan(both);
    expect(both).toBeGreaterThan(0);
    expect(none).toBeGreaterThan(0);
    // De día, solo la siesta de siempre.
    expect(nappers(ids, 0.3)).toEqual([]);
    // Pura: lo mismo con lo mismo.
    expect(nappers(ids, 0.8, 7)).toEqual(nappers(ids, 0.8, 7));
  });

  it('arrastrar a un héroe: se despierta, va y pelea con él', () => {
    const s = night('arrastre');
    const inc = startThief(s)!;
    const h = s.heroes.find((x) => x.status === 'ok')!;
    h.lvl = 9;
    h.attrs = { F: 14, D: 14, M: 8 };
    const sent = reduce(s, { type: 'incident', id: inc.id, act: { by: 'who', who: h.id } });
    expect(sent.incidents![0]!.coming?.who).toBe(h.id);
    const met = reduce(sent, { type: 'arrived', heroId: h.id, room: inc.room });
    const duel = met.incidents![0]!.duel!;
    expect(duel.who).toBe(h.id);
    // Sin avisos sueltos: lo que pase, al amanecer.
    const at = (met.clock ?? 0) + duel.end + 1;
    const done = reduce(met, { type: 'tick', to: at });
    expect(done.incidents).toEqual([]);
    expect(done.incidentNews ?? []).toEqual([]);
    expect(done.gold).toBe(400);
    const dawn = endDay(done).dawn;
    expect(dawn.some((e) => e.t.includes(h.name) && /pilló/.test(e.t))).toBe(true);
  });

  it('con el reloj y sin tocar, se resuelve igual que al pasar el día', () => {
    const a = night('igual', 9);
    guard(a);
    startThief(a);
    const b = structuredClone(a);
    const inc = a.incidents![0]!;
    // Con el reloj: hasta su hora y, si hay duelo, hasta que acaba.
    let t = reduce(a, { type: 'tick', to: inc.until + 0.1 });
    const duel = t.incidents?.[0]?.duel;
    if (duel) t = reduce(t, { type: 'tick', to: duel.at + duel.end + 0.1 });
    expect(t.incidents).toEqual([]);
    untouched(b);
    expect(t.gold).toBe(b.gold);
    expect(t.incidentLog?.at(-1)?.how).toBe(b.incidentLog?.at(-1)?.how);
  });
});
