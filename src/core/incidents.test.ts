import { describe, expect, it } from 'vitest';
import { INCIDENTS } from '../data/incidents';
import {
  CAT_EVERY,
  CAT_FIRST,
  DAY_SECONDS,
  GUARD_HOLD,
  GUARD_NAP,
  INCIDENT_EVERY,
  INCIDENT_REACT,
} from './balance';
import { endDay, newGame, reduce } from './game';
import { catHunts, incidentCost, incidentIssue, napping, stepIncidents } from './incidents';
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
    const sent = reduce(s, { type: 'incident', id: 'i1', act: { by: 'who', who: hero.id } });
    // Va andando: se arregla cuando llega a la sala (lo dice la escena).
    expect(sent.incidents?.[0]?.coming?.who).toBe(hero.id);
    expect(incidentIssue(sent, 'i1', { by: 'who', who: hero.id })).toMatch(/Ya va/);
    const room = s.incidents![0]!.room;
    expect(reduce(sent, { type: 'arrived', heroId: hero.id, room: 'otra' })).toBe(sent);
    const t = reduce(sent, { type: 'arrived', heroId: hero.id, room });
    expect(t.incidents).toEqual([]);
    expect(t.rep).toBe(s.rep + (INCIDENTS.pelea.rep ?? 0));
    expect(t.incidentNews?.[0]?.t).toContain(hero.name);
  });

  it('ladrón: al llegar el héroe se pelean, golpe a golpe; al acabar, le pilla o se escapa', () => {
    const s = withIncident('ladron');
    const hero = s.heroes.find((h) => h.status === 'ok')!;
    const room = s.incidents![0]!.room;
    const sent = reduce(s, { type: 'incident', id: 'i1', act: { by: 'who', who: hero.id } });
    const t = reduce(sent, { type: 'arrived', heroId: hero.id, room });
    const duel = t.incidents?.[0]?.duel;
    expect(duel?.who).toBe(hero.id);
    expect(duel!.hits.length).toBeGreaterThan(2);
    // Cada golpe quita vida: quien gana deja al otro a cero.
    const dealt = duel!.hits.filter((h) => h.by === 'h').reduce((a, h) => a + h.amount, 0);
    expect(dealt >= duel!.hp.l).toBe(duel!.won);
    // Mientras pelean no sale mal, aunque se pase su hora.
    const late = structuredClone(t);
    expect(stepIncidents(late, 10, duel!.at + duel!.end - 0.2)).toEqual([]);
    expect(late.incidents).toHaveLength(1);
    const news = stepIncidents(late, 10, duel!.at + duel!.end);
    expect(late.incidents).toEqual([]);
    expect(news[0]?.k).toBe(duel!.won ? 'good' : 'bad');
  });

  it('mientras alguien va de camino no sale mal; si nadie dice que llega, se da por llegado', () => {
    const s = withIncident('pelea');
    const hero = s.heroes.find((h) => h.status === 'ok')!;
    const inc = s.incidents![0]!;
    const sent = reduce(s, { type: 'incident', id: 'i1', act: { by: 'who', who: hero.id } });
    const at = sent.incidents![0]!.coming!.at;
    const u = structuredClone(sent);
    // Pasada su hora, sigue ahí (va de camino)…
    stepIncidents(u, inc.until - 1, Math.min(at - 1, inc.until + 1));
    if (at - 1 > inc.until) expect(u.incidents).toHaveLength(1);
    // …y a su hora de llegada, arreglado.
    const news = stepIncidents(u, at - 1, at);
    expect(u.incidents).toEqual([]);
    expect(news.some((n) => n.t.includes(hero.name))).toBe(true);
  });

  it('si ya hay quien sepa arreglarlo en la sala, se pone a ello solo', () => {
    const s = withIncident('pelea');
    const hero = s.heroes.find((h) => h.status === 'ok')!;
    s.heroes = s.heroes.map((h) => (h.id === hero.id ? { ...h, job: s.incidents![0]!.room } : h));
    const news = stepIncidents(s, 10, 11);
    expect(s.incidents).toHaveLength(1);
    const later = stepIncidents(s, 11, 14);
    expect(s.incidents).toEqual([]);
    expect(later[0]?.t).toContain(hero.name);
    expect(news).toEqual([]);
  });

  it('no salen donde ya hay quien lo arreglaría', () => {
    const s = { ...newGame('atendida'), day: 3, clock: 0 };
    const cocina = s.building.rooms.find((r) => r.type === 'cocina')!;
    expect(s.workers.some((w) => w.room === cocina.id)).toBe(true);
    for (let i = 0; i < 80; i++) {
      const t = structuredClone(s);
      t.rng = i * 7919;
      stepIncidents(t, 0, INCIDENT_EVERY);
      const inc = t.incidents?.[0];
      if (inc?.kind === 'fuego') expect(inc.room).not.toBe(cocina.id);
    }
  });

  it('fuego: vale cualquiera de la casa', () => {
    const s = withIncident('fuego');
    const w = s.workers[0]!;
    const t = reduce(s, { type: 'incident', id: 'i1', act: { by: 'who', who: w.id } });
    const done = reduce(t, { type: 'arrived', heroId: w.id, room: s.incidents![0]!.room });
    expect(done.incidents).toEqual([]);
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

  it('el ladrón que se escapa se topa con la guardia en la puerta', () => {
    const s = withIncident('ladron', 'puerta');
    const g = s.heroes.find((h) => h.status === 'ok')!;
    g.guard = true;
    // Un guardia curtido: le gana seguro.
    g.lvl = 8;
    g.attrs = { F: 12, D: 12, M: 8 };
    const inc = s.incidents![0]!;
    const news = stepIncidents(s, inc.until - 1, inc.until);
    expect(s.incidents).toEqual([]);
    expect(s.gold).toBe(500);
    expect(s.incidentLog?.at(-1)).toMatchObject({ how: 'puerta', guard: g.id });
    expect(news.some((n) => n.t.includes(g.name) && /cierra el paso/.test(n.t))).toBe(true);
  });

  it('el de guardia en la cámara se echa encima del ladrón solo (y se avisa igual)', () => {
    const s = withIncident('ladron', 'camara');
    const g = s.heroes.find((h) => h.status === 'ok')!;
    g.guard = true;
    g.post = 'tesoro';
    g.lvl = 8;
    g.attrs = { F: 12, D: 12, M: 8 };
    // Antes de reaccionar, nada.
    stepIncidents(s, 10, 11);
    expect(s.incidents![0]!.duel).toBeUndefined();
    const at = 10 + INCIDENT_REACT;
    const news = stepIncidents(s, at - 1, at);
    const duel = s.incidents![0]!.duel!;
    expect(duel.who).toBe(g.id);
    expect(news.some((n) => n.t.includes(g.name) && /cámara/.test(n.t))).toBe(true);
    // Le gana: no se pierde nada.
    stepIncidents(s, at, at + duel.end + 1);
    expect(s.incidents).toEqual([]);
    expect(s.gold).toBe(500);
  });

  it('el de guardia en la cámara no cuenta como guardia de la puerta', () => {
    const s = withIncident('pelea', 'camara-pelea');
    const g = s.heroes.find((h) => h.status === 'ok')!;
    g.guard = true;
    g.post = 'tesoro';
    const at = 10 + INCIDENT_REACT;
    stepIncidents(s, at - 1, at);
    expect(s.incidents?.[0]?.coming).toBeUndefined();
  });

  it('a la hora de la siesta, el de guardia solo cabecea y se le cuela; con dos, se turnan', () => {
    const nap = (GUARD_NAP[0] + GUARD_NAP[1]) / 2 - 0.01;
    expect(napping(['a'], 0.3)).toBeNull();
    expect(napping(['a'], nap)).toBe('a');
    expect(napping(['a', 'b'], nap)).toBe('a');
    expect(napping(['a', 'b'], GUARD_NAP[1] - 0.01)).toBe('b');
    const s = withIncident('ladron', 'siesta');
    const g = s.heroes.find((h) => h.status === 'ok')!;
    g.guard = true;
    const inc = s.incidents![0]!;
    s.clock = nap * DAY_SECONDS;
    inc.until = s.clock;
    stepIncidents(s, s.clock - 1, s.clock);
    expect(s.gold).toBeLessThan(500);
    expect(s.incidentLog?.at(-1)).toMatchObject({ how: 'cuela', guard: g.id });
  });

  it('pelea: el de guardia deja la puerta y va a separarlos solo', () => {
    const s = withIncident('pelea', 'guardia-pelea');
    const g = s.heroes.find((h) => h.status === 'ok')!;
    g.guard = true;
    const at = 10 + INCIDENT_REACT;
    const news = stepIncidents(s, at - 1, at);
    expect(s.incidents?.[0]?.coming?.who).toBe(g.id);
    expect(news.some((n) => n.t.includes(g.name))).toBe(true);
    // Al llegar la separa.
    const room = s.incidents![0]!.room;
    const t = reduce(s, { type: 'arrived', heroId: g.id, room });
    expect(t.incidents).toEqual([]);
  });

  it('recaudador: el de guardia le entretiene y da más tiempo (una vez)', () => {
    const s = withIncident('recaudador', 'guardia-tasa');
    const g = s.heroes.find((h) => h.status === 'ok')!;
    g.guard = true;
    const until = s.incidents![0]!.until;
    const at = 10 + INCIDENT_REACT;
    stepIncidents(s, at - 1, at);
    expect(s.incidents![0]!.until).toBe(until + GUARD_HOLD);
    expect(s.incidents![0]!.held).toBe(g.id);
    stepIncidents(s, at, at + 1);
    expect(s.incidents![0]!.until).toBe(until + GUARD_HOLD);
  });

  it('ratas: el gato caza alguna si la sala está en la planta del salón', () => {
    const s = withIncident('ratas', 'gato');
    const inc = s.incidents![0]!;
    // En la cocina, junto al salón (planta baja).
    inc.room = s.building.rooms.find((r) => r.type === 'cocina')!.id;
    expect(catHunts(s.building, inc.room)).toBe(true);
    const taps = inc.taps!;
    stepIncidents(s, 10, 10 + CAT_FIRST + CAT_EVERY);
    expect(s.incidents![0]!.taps).toBe(taps - 2);
  });
});
