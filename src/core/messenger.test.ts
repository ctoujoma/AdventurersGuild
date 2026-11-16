import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, MESSENGER_WAIT, NIGHT_ROLL } from './balance';
import { endDay, newGame, reduce } from './game';
import { generateQuest } from './generate';
import { nappers } from './incidents';
import { MESSENGER_EVENT, messengerGone } from './messenger';
import type { GameState } from './model';
import { Rng } from './rng';

/** Una partida sin tutorial, de noche, con el mensajero llamando a la puerta. */
function knock(seed = 'mensajero', day = 4): GameState {
  const s = newGame(seed);
  delete s.tutorial;
  s.mode = 'libre';
  s.day = day;
  s.clock = NIGHT_ROLL * DAY_SECONDS;
  MESSENGER_EVENT.start(s, new Rng(seed));
  return s;
}

describe('el mensajero tardío', () => {
  it('trae un encargo urgente del nivel de la casa, mejor pagado y que caduca pronto', () => {
    const s = knock();
    const q = s.messenger!.quest;
    expect(q.urgent).toBe(true);
    expect(q.expires).toBe(2);
    // Paga más que uno normal del mismo rango.
    const plain = generateQuest(new Rng('x'), 'q', 0, 'i', true);
    expect(q.reward).toBeGreaterThan(plain.reward * 0.9);
    // No vuelve a llamar mientras está.
    expect(MESSENGER_EVENT.when(s)).toBe(false);
  });

  it('aceptar: al tablón ya; sale al amanecer o se pierde al acabar el día siguiente', () => {
    const s = knock();
    const q = s.messenger!.quest;
    const t = reduce(s, { type: 'messenger', accept: true });
    expect(t.messenger).toBeNull();
    expect(t.quests.some((x) => x.id === q.id)).toBe(true);
    const d1 = endDay(t);
    expect(d1.quests.some((x) => x.id === q.id)).toBe(true);
    expect(d1.dawn.some((e) => e.t.includes(q.title))).toBe(true);
    const d2 = endDay(d1);
    expect(d2.quests.some((x) => x.id === q.id)).toBe(false);
  });

  it('despedirle: se va con su encargo', () => {
    const s = knock();
    const q = s.messenger!.quest;
    const t = reduce(s, { type: 'messenger', accept: false });
    expect(t.messenger).toBeNull();
    expect(endDay(t).quests.some((x) => x.id === q.id)).toBe(false);
  });

  it('sin tocar: si nadie le abre, se va; el de guardia despierto le recoge el recado', () => {
    const alone = knock();
    const q = alone.messenger!.quest;
    const gone = reduce(alone, { type: 'tick', to: alone.messenger!.at + MESSENGER_WAIT + 1 });
    expect(messengerGone(gone)).toBe(true);
    expect(gone.incidentNews ?? []).toEqual([]);
    const d = endDay(gone);
    expect(d.quests.some((x) => x.id === q.id)).toBe(false);
    expect(d.dawn.some((e) => /nadie le abrió/.test(e.t))).toBe(true);
    // Con guardia: solo si estaba despierto cuando llamó.
    let took = 0;
    let missed = 0;
    for (let day = 3; day < 43; day++) {
      const s = newGame('guardia-mensajero');
      delete s.tutorial;
      s.mode = 'libre';
      s.day = day;
      s.clock = NIGHT_ROLL * DAY_SECONDS;
      const g = s.heroes.find((h) => h.status === 'ok')!;
      g.guard = true;
      MESSENGER_EVENT.start(s, new Rng(`m${day}`));
      const m = s.messenger!;
      const awake = !nappers([g.id], m.at / DAY_SECONDS, s.day).length;
      expect(m.guard === g.id).toBe(awake);
      const next = endDay(s);
      expect(next.quests.some((x) => x.id === m.quest.id)).toBe(awake);
      if (awake) took++;
      else {
        expect(next.dawn.some((e) => e.t.includes(g.name) && /cabeceaba/.test(e.t))).toBe(true);
        missed++;
      }
    }
    expect(took).toBeGreaterThan(5);
    expect(missed).toBeGreaterThan(5);
  });
});
