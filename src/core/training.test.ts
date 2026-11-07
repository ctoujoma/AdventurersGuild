import { describe, expect, it } from 'vitest';
import {
  DAY_SECONDS,
  TRAIN_CAP,
  TRAIN_COST_BASE,
  TRAIN_HERO_BASE,
  TRAIN_PER_LEVEL,
  XP_PER_LEVEL,
} from './balance';
import { levelUp } from './resolve';
import { endDay, newGame, reduce } from './game';
import type { GameState, Room } from './model';
import { cappedTrainees, skillGain, stepTraining, trainState, trainingOf } from './training';
import { canAssign, workedIn } from './workers';

/** Partida con una sala de armas de nivel `level` y el primer héroe (guerrero) entrenando en ella. */
function gym(level = 1): GameState {
  const s = newGame('entreno');
  const r: Room = { id: 'arm', type: 'armas', col: 4, floor: 0, w: 1, h: 1, level, spent: 0 };
  s.building.rooms.push(r);
  const h = s.heroes[0]!;
  h.attrs.F = 3;
  // Asignado y ya en la sala (al amanecer): cuenta el día entero.
  const t = reduce(s, { type: 'assign', who: h.id, room: 'arm' });
  return reduce(t, { type: 'arrived', heroId: h.id, room: 'arm' });
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
    expect(trainState(s, h, 0.5)!.frac).toBeCloseTo((cost - 1 + workedIn(0, 0.5)) / cost);
    stepTraining(s, events);
    expect(h.attrs.F).toBe(4);
    expect(events.at(-1)!.t).toMatch(/Fuerza 4/);
    // Y la noche de verdad también entrena.
    const t = gym();
    t.heroes[0]!.train = { F: cost - 1 };
    expect(endDay(t).heroes[0]!.attrs.F).toBe(4);
  });

  it('quien llega a media tarde entrena solo lo que queda de día', () => {
    const s = newGame('tarde');
    s.building.rooms.push({
      id: 'arm',
      type: 'armas',
      col: 4,
      floor: 0,
      w: 1,
      h: 1,
      level: 1,
      spent: 0,
    });
    s.clock = DAY_SECONDS / 2;
    const h = s.heroes[0]!;
    h.attrs.F = 3;
    const t = reduce(reduce(s, { type: 'assign', who: h.id, room: 'arm' }), {
      type: 'arrived',
      heroId: h.id,
      room: 'arm',
    });
    const full = gym();
    stepTraining(full, []);
    stepTraining(t, []);
    expect(t.heroes[0]!.train!.F).toBeCloseTo(full.heroes[0]!.train!.F! * workedIn(0.5, 1));
  });

  it('el atributo no pasa del tope de la sala: hay que mejorarla', () => {
    const s = gym(1);
    const h = s.heroes[0]!;
    h.attrs.F = TRAIN_CAP[1];
    h.lvl = 5;
    expect(trainState(s, h)).toMatchObject({ capped: true, perDay: 0, by: 'sala' });
    const room = h.job;
    const said: { t: string }[] = [];
    stepTraining(s, said);
    expect(h.attrs.F).toBe(TRAIN_CAP[1]);
    // Sin nada que aprender, deja la sala y se avisa de por qué.
    expect(h.job).toBeUndefined();
    expect(said.at(-1)!.t).toMatch(/deja .*ya no aprende más Fuerza.*mejorar la sala/);
    h.job = room;
    const better = gym(2);
    better.heroes[0]!.attrs.F = TRAIN_CAP[1];
    better.heroes[0]!.lvl = 5;
    expect(trainState(better, better.heroes[0]!)!.capped).toBe(false);
    // Una sala mejor también entrena más rápido.
    const fast = gym(2);
    expect(trainState(fast, fast.heroes[0]!)!.perDay).toBeGreaterThan(
      trainState(s, { ...h, attrs: { ...h.attrs, F: 3 } })!.perDay,
    );
  });

  it('tampoco pasa del tope del héroe (3 + 2 por nivel); al subir de nivel, sigue', () => {
    const s = gym(4);
    const h = s.heroes[0]!;
    h.lvl = 2;
    // Un guerrero en la sala de armas: la Fuerza es lo suyo (2 más).
    h.attrs.F = TRAIN_HERO_BASE + 2 * TRAIN_PER_LEVEL + 2;
    expect(trainState(s, h)).toMatchObject({ capped: true, by: 'nivel', cap: 9 });
    const events: { t: string }[] = [];
    h.train = { F: 99 };
    const room = h.job;
    stepTraining(s, events);
    expect(h.attrs.F).toBe(9);
    expect(h.job).toBeUndefined();
    expect(events.at(-1)!.t).toMatch(/subir de nivel/);
    h.job = room;
    h.lvl = 3;
    expect(trainState(s, h)).toMatchObject({ capped: false, cap: 11 });
  });

  it('quien llega al tope esa noche sube el punto, deja la sala y se avisa', () => {
    const s = gym(4);
    const h = s.heroes[0]!;
    h.lvl = 1;
    h.attrs.F = 6;
    h.train = { F: 99 };
    expect(cappedTrainees(s)).toHaveLength(0);
    const events: { t: string }[] = [];
    stepTraining(s, events);
    expect(h.attrs.F).toBe(7);
    expect(h.job).toBeUndefined();
    expect(events.map((e) => e.t)).toEqual([
      expect.stringMatching(/ha entrenado: Fuerza 7/),
      expect.stringMatching(/deja la sala de armas/),
    ]);
  });

  it('en el atributo principal de su clase llega a 2 más que en los otros', () => {
    const s = gym(4);
    const h = s.heroes[0]!;
    expect(h.cls).toBe('guerrero');
    h.lvl = 1;
    h.attrs.F = 5;
    // Fuerza es lo suyo: hasta 7 en la sala de armas (en lo demás, hasta 5).
    expect(trainState(s, h)).toMatchObject({ capped: false, cap: 7 });
    h.attrs.F = 7;
    expect(trainState(s, h)).toMatchObject({ capped: true, by: 'nivel', cap: 7 });
  });

  it('el punto de subir de nivel no se pierde aunque el atributo pase de 10', () => {
    const s = gym();
    const h = s.heroes[0]!;
    h.attrs.F = 10;
    h.xp = XP_PER_LEVEL;
    levelUp(s, h);
    expect(h.attrs.F).toBe(11);
  });

  it('las habilidades suben solas según la clase', () => {
    const s = gym();
    const h = s.heroes[0]!;
    expect(h.cls).toBe('guerrero');
    // A un guerrero la Fuerza le cuenta doble en Combate.
    expect(skillGain(h, 'F').Combate).toBe(1);
  });
});
