import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from './balance';
import { endDay, newGame, reduce } from './game';
import { eventText, foeOf, journey, journeyNow, LEGS } from './journey';
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
