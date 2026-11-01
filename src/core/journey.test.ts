import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from './balance';
import { endDay, newGame, reduce } from './game';
import { BOSS_T, eventText, foeOf, journey, journeyNow, LEGS, RESOLVE_T } from './journey';
import type { GameState, Mission, QuestType } from './model';

/** Manda el primer encargo del tablón con los primeros héroes libres. */
function send(seed: string): GameState {
  const s = newGame(seed);
  const q = s.quests[0]!;
  const ids = s.heroes
    .filter((h) => h.status === 'ok')
    .map((h) => h.id)
    .slice(0, q.slots);
  const t = reduce(s, { type: 'send', questId: q.id, heroIds: ids });
  expect(t.missions).toHaveLength(1);
  return t;
}

describe('contra qué se pelea', () => {
  const q = (type: QuestType, text: string) =>
    ({ type, title: '', text }) as unknown as Mission['quest'];
  it('lo dice el texto del encargo y, si no, el tipo', () => {
    expect(foeOf(q('Escoltar', 'Dicen que son una banda de trasgos.'))).toBe('trasgo');
    expect(foeOf(q('Limpiar', 'Hay esqueletos que no se están quietos.'))).toBe('muerto');
    expect(foeOf(q('Cazar', 'Las huellas son de una manada de lobos.'))).toBe('bestia');
    expect(foeOf(q('Escoltar', 'Un peregrino rico quiere ir a rezar.'))).toBe('bandido');
  });
});

describe('viaje de un grupo fuera', () => {
  it('sale siempre igual para el mismo grupo', () => {
    const s = send('viaje');
    const m = s.missions[0]!;
    expect(journey(m)).toEqual(journey(structuredClone(m)));
  });

  it('las partes cubren de 0 a 1 por orden', () => {
    expect(LEGS[0]!.from).toBe(0);
    expect(LEGS.at(-1)!.to).toBe(1);
    for (let i = 1; i < LEGS.length; i++) expect(LEGS[i]!.from).toBe(LEGS[i - 1]!.to);
  });

  it('los sucesos van por orden, dentro de su parte, y con los nombres del grupo', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const s = send(seed);
      const m = s.missions[0]!;
      const j = journey(m);
      expect(j.events.some((e) => e.kind === 'llegada')).toBe(true);
      expect(j.events.some((e) => e.kind === 'vuelta')).toBe(true);
      expect(j.events.filter((e) => e.kind === 'noche')).toHaveLength(j.days - 1);
      if (j.fight) {
        expect(j.fight.from).toBeGreaterThanOrEqual(0.5);
        expect(j.fight.to).toBeLessThanOrEqual(0.75);
      }
      for (let i = 0; i < j.events.length; i++) {
        const e = j.events[i]!;
        if (i) expect(e.t).toBeGreaterThanOrEqual(j.events[i - 1]!.t);
        const l = LEGS.find((x) => x.id === e.leg)!;
        expect(e.t).toBeGreaterThanOrEqual(l.from);
        expect(e.t).toBeLessThanOrEqual(l.to);
        const text = eventText(s, e);
        expect(text).not.toMatch(/[{}]/);
        if (e.heroId) expect(m.heroIds).toContain(e.heroId);
      }
    }
  });

  it('avanza con el reloj y los días, y se van sumando sucesos', () => {
    let s = send('avanza');
    const m0 = s.missions[0]!;
    const a = journeyNow(s, m0);
    expect(a.t).toBe(0);
    expect(a.leg).toBe('ida');
    expect(a.crew.map((h) => h.id)).toEqual(m0.heroIds);
    s = reduce(s, { type: 'tick', to: DAY_SECONDS * 0.5 });
    const b = journeyNow(s, s.missions[0]!);
    expect(b.t).toBeGreaterThan(a.t);
    expect(b.past.length).toBeGreaterThanOrEqual(a.past.length);
    if (m0.quest.days > 1) {
      s = endDay(s);
      const m = s.missions.find((x) => x.id === m0.id)!;
      const c = journeyNow(s, m);
      expect(c.t).toBeCloseTo(1 / m0.quest.days, 5);
    }
  });
});

describe('se resuelve al acabar lo suyo', () => {
  it('con el juego abierto llega el informe a media vuelta y los héroes siguen fuera', () => {
    let s = send('faena');
    const m0 = s.missions[0]!;
    const reports = s.reports.length;
    // Avanza día a día hasta pasar el punto de resolver.
    for (let i = 0; i < 10 && !s.missions[0]?.done; i++) {
      s = reduce(s, { type: 'tick', to: DAY_SECONDS * 0.79 });
      if (!s.missions[0]?.done) s = endDay(s);
    }
    // El último día, el reloj pasa por lo suyo antes de la noche: aún no han vuelto.
    const m = s.missions.find((x) => x.id === m0.id)!;
    expect(m.done).toBeDefined();
    expect(s.reports.length).toBe(reports + 1);
    expect(journeyNow(s, m).t).toBeGreaterThanOrEqual(RESOLVE_T - 1e-9);
    for (const id of Object.keys(m.done!.fates))
      expect(s.heroes.find((h) => h.id === id)!.status).toBe('mision');
    expect(journeyNow(s, m).past.some((e) => e.kind === 'aviso')).toBe(true);
    // Al volver, cada uno como quedó y sin informe nuevo.
    while (s.missions.some((x) => x.id === m0.id)) s = endDay(s);
    expect(s.reports.length).toBe(reports + 1);
    for (const [id, f] of Object.entries(m.done!.fates))
      expect(s.heroes.find((h) => h.id === id)!.status).toBe(f.status);
  });

  it('con el juego cerrado se resuelve en la noche y vuelve igual', () => {
    let s = send('cerrado');
    const id = s.missions[0]!.id;
    const reports = s.reports.length;
    while (s.missions.some((x) => x.id === id)) s = endDay(s);
    expect(s.reports.length).toBe(reports + 1);
    expect(s.heroes.some((h) => h.status === 'mision')).toBe(false);
  });
});

describe('ante el jefe se espera al jugador', () => {
  /** Un grupo fuera en el paso del jefe de Hondogrís (el cuarto). */
  const withBoss = (seed: string) => {
    const s = structuredClone(send(seed));
    const m = s.missions[0]!;
    m.quest.chain = { id: 'hondogris', step: 3 };
    m.quest.days = 1;
    m.daysLeft = 1;
    return s;
  };

  it('con el juego abierto se para, avisa y se resuelve cuando se dice', () => {
    let s = withBoss('jefe');
    const id = s.missions[0]!.id;
    const reports = s.reports.length;
    s = reduce(s, { type: 'tick', to: DAY_SECONDS * 0.7 });
    const m = s.missions[0]!;
    expect(m.waiting).toBe(true);
    expect(m.done).toBeUndefined();
    expect(s.bossWait).toBe(id);
    expect(s.reports.length).toBe(reports);
    // Parado ante el jefe aunque pase el reloj.
    s = reduce(s, { type: 'tick', to: DAY_SECONDS * 0.79 });
    expect(journeyNow(s, s.missions[0]!).t).toBeCloseTo(BOSS_T, 5);
    expect(s.missions[0]!.done).toBeUndefined();
    s = reduce(s, { type: 'boss', id });
    expect(s.missions[0]!.done).toBeDefined();
    expect(s.missions[0]!.waiting).toBeUndefined();
    const r = s.reports.find((x) => x.id === s.missions[0]!.done!.report)!;
    expect(r.fight?.boss).toBe('bestia');
  });

  it('si no se dice nada, se resuelve al caer la noche', () => {
    let s = withBoss('noche');
    s = reduce(s, { type: 'tick', to: DAY_SECONDS * 0.7 });
    expect(s.missions[0]!.waiting).toBe(true);
    const reports = s.reports.length;
    s = endDay(s);
    // El informe de la pelea (y, si se gana, la carta del final de la historia).
    expect(s.reports.length).toBeGreaterThan(reports);
    const fight = s.reports.find((r) => r.fight);
    expect(s.lastFight).toBe(fight?.id);
    expect(fight?.fight?.sim?.auto).toBe(true);
    expect(s.missions).toHaveLength(0);
  });
});
