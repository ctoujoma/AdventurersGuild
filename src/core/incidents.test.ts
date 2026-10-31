import { describe, expect, it } from 'vitest';
import { INCIDENTS } from '../data/incidents';
import { INCIDENT_EVERY } from './balance';
import { endDay, newGame, reduce } from './game';
import { incidentCost, incidentIssue, stepIncidents } from './incidents';
import type { GameState, Incident } from './model';

/** Partida en el día 3 con un incidente puesto a mano en la primera sala de su tipo. */
function withIncident(kind: Incident['kind'], seed = 'incidente'): GameState {
  const s = { ...newGame(seed), day: 3, gold: 500, clock: 10 };
  s.building = structuredClone(s.building);
  const room = s.building.rooms.find((r) => INCIDENTS[kind].rooms.includes(r.type))!;
  room.level = Math.max(1, room.level);
  delete room.works;
  const d = INCIDENTS[kind];
  s.incidents = [{ id: 'i1', kind, room: room.id, from: 10, until: 10 + d.secs, taps: d.taps }];
  return s;
}

describe('incidentes', () => {
  it('aparecen con el juego abierto, de uno en uno y desde el segundo día', () => {
    const s = { ...newGame('aparecen'), day: 3, clock: 0 };
    let got = 0;
    for (let i = 0; i < 60; i++) {
      const t = structuredClone(s);
      t.rng = i * 7919;
      stepIncidents(t, 0, INCIDENT_EVERY / 2);
      got += t.incidents?.length ?? 0;
      expect(t.incidents?.length ?? 0).toBeLessThanOrEqual(1);
    }
    expect(got).toBeGreaterThan(10);
    const first = { ...newGame('primero'), day: 1, clock: 0 };
    stepIncidents(first, 0, INCIDENT_EVERY * 10);
    expect(first.incidents ?? []).toEqual([]);
  });

  it('sin hacer nada, sale mal a su hora', () => {
    const s = withIncident('pelea');
    const gold = s.gold;
    const news = stepIncidents(s, 10, 10 + INCIDENTS.pelea.secs);
    expect(s.incidents).toEqual([]);
    expect(s.gold).toBeLessThan(gold);
    expect(news[0]?.k).toBe('bad');
  });

  it('pelea: hace falta un héroe; un trabajador no vale', () => {
    const s = withIncident('pelea');
    const worker = s.workers[0]!;
    expect(incidentIssue(s, 'i1', { by: 'who', who: worker.id })).toMatch(/héroe/);
    const hero = s.heroes.find((h) => h.status === 'ok')!;
    const t = reduce(s, { type: 'incident', id: 'i1', act: { by: 'who', who: hero.id } });
    expect(t.incidents).toEqual([]);
    expect(t.rep).toBe(s.rep + (INCIDENTS.pelea.rep ?? 0));
    expect(t.incidentNews?.[0]?.t).toContain(hero.name);
  });

  it('fuego: vale cualquiera de la casa', () => {
    const s = withIncident('fuego');
    const t = reduce(s, { type: 'incident', id: 'i1', act: { by: 'who', who: s.workers[0]!.id } });
    expect(t.incidents).toEqual([]);
  });

  it('recaudador: se paga (y sube con el rango); sin dinero, no', () => {
    const s = withIncident('recaudador');
    const cost = incidentCost(s, s.incidents![0]!);
    expect(incidentCost({ ...s, rep: 400 }, s.incidents![0]!)).toBeGreaterThan(cost);
    const t = reduce(s, { type: 'incident', id: 'i1', act: { by: 'pagar' } });
    expect(t.gold).toBe(s.gold - cost);
    expect(t.incidents).toEqual([]);
    expect(incidentIssue({ ...s, gold: 0 }, 'i1', { by: 'pagar' })).toMatch(/faltan/);
  });

  it('ratas: hay que tocar varias veces', () => {
    let s = withIncident('ratas');
    for (let i = 1; i < INCIDENTS.ratas.taps!; i++) {
      s = reduce(s, { type: 'incident', id: 'i1', act: { by: 'tocar' } });
      expect(s.incidents).toHaveLength(1);
    }
    s = reduce(s, { type: 'incident', id: 'i1', act: { by: 'tocar' } });
    expect(s.incidents).toEqual([]);
  });

  it('noble: cada opción tiene su precio', () => {
    const s = withIncident('noble');
    const out = reduce(s, { type: 'incident', id: 'i1', act: { by: 'elegir', option: 0 } });
    expect(out.rep).toBe(Math.max(0, s.rep - 1));
    const paid = reduce(s, { type: 'incident', id: 'i1', act: { by: 'elegir', option: 1 } });
    expect(paid.gold).toBe(s.gold - 25);
    expect(paid.rep).toBe(s.rep + 2);
  });

  it('al caer la noche, lo que queda sale mal y va a la carta', () => {
    const s = withIncident('gotera');
    const next = endDay(s);
    expect(next.incidents).toEqual([]);
    expect(next.dawn.some((e) => e.t.includes('gotera'))).toBe(true);
  });
});
