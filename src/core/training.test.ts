import { describe, expect, it } from 'vitest';
import { TRAIN_CAP, TRAIN_COST_BASE } from './balance';
import { endDay, newGame, reduce } from './game';
import type { GameState, Room } from './model';
import { skillGain, stepTraining, trainState, trainingOf } from './training';
import { canAssign } from './workers';

/** Partida con una sala de armas de nivel `level` y el primer héroe (guerrero) entrenando en ella. */
function gym(level = 1): GameState {
  const s = newGame('entreno');
  const r: Room = { id: 'arm', type: 'armas', col: 4, floor: 0, w: 1, h: 1, level, spent: 0 };
  s.building.rooms.push(r);
  const h = s.heroes[0]!;
  h.attrs.F = 3;
  return reduce(s, { type: 'assign', who: h.id, room: 'arm' });
}

describe('entrenamiento', () => {
  it('los héroes en casa entrenan en la sala de su atributo; los trabajadores no', () => {
    const s = gym();
    const h = s.heroes[0]!;
    expect(trainingOf(s, h)).toMatchObject({ attr: 'F' });
    expect(canAssign(s, s.workers[0]!.id, 'arm')).toMatch(/héroes/);
    // De guardia no entrena.
    const g = reduce(s, { type: 'guard', id: h.id, on: true });
    expect(trainingOf(g, g.heroes[0]!)).toBeNull();
  });

  it('cada día suma progreso y al completarlo sube un punto', () => {
    const s = gym();
    const h = s.heroes[0]!;
    const cost = TRAIN_COST_BASE + 3;
    const events: { t: string }[] = [];
    for (let i = 0; i < cost - 1; i++) stepTraining(s, events);
    expect(h.attrs.F).toBe(3);
    expect(trainState(s, h)!.frac).toBeCloseTo((cost - 1) / cost);
    // La barra también avanza con el día.
    expect(trainState(s, h, 0.5)!.frac).toBeCloseTo((cost - 0.5) / cost);
    stepTraining(s, events);
    expect(h.attrs.F).toBe(4);
    expect(events.at(-1)!.t).toMatch(/Fuerza 4/);
    // Y la noche de verdad también entrena.
    const t = gym();
    t.heroes[0]!.train = { F: cost - 1 };
    expect(endDay(t).heroes[0]!.attrs.F).toBe(4);
  });

  it('el atributo no pasa del tope de la sala: hay que mejorarla', () => {
    const s = gym(1);
    const h = s.heroes[0]!;
    h.attrs.F = TRAIN_CAP[1];
    expect(trainState(s, h)).toMatchObject({ capped: true, perDay: 0 });
    stepTraining(s, []);
    expect(h.attrs.F).toBe(TRAIN_CAP[1]);
    const better = gym(2);
    better.heroes[0]!.attrs.F = TRAIN_CAP[1];
    expect(trainState(better, better.heroes[0]!)!.capped).toBe(false);
    // Una sala mejor también entrena más rápido.
    const fast = gym(2);
    expect(trainState(fast, fast.heroes[0]!)!.perDay).toBeGreaterThan(
      trainState(s, { ...h, attrs: { ...h.attrs, F: 3 } })!.perDay,
    );
  });

  it('las habilidades suben solas según la clase', () => {
    const s = gym();
    const h = s.heroes[0]!;
    expect(h.cls).toBe('guerrero');
    // A un guerrero la Fuerza le cuenta doble en Combate.
    expect(skillGain(h, 'F').Combate).toBe(1);
  });
});
