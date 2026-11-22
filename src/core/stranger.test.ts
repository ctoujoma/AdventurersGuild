import { describe, expect, it } from 'vitest';
import {
  DAY_SECONDS,
  NIGHT_ROLL,
  STRANGER_EVERY,
  STRANGER_LEAVE,
  VEIL_BED,
  VEIL_CAP,
  VEIL_DAYS,
  VEIL_MORALE,
  restCap,
  strangerPrice,
} from './balance';
import { endDay, newGame, reduce } from './game';
import type { GameState } from './model';
import { NIGHT_EVENTS, canHappen, rollNight } from './night';
import { Rng } from './rng';
import { stormNight } from './sky';
import { STRANGER_EVENT, priceFor, reviveIssue } from './stranger';
import { tx } from '../textos';

/** Una partida sin tutorial, en un día de tormenta, con el primer héroe caído. */
function stormy(seed = 'tormenta'): GameState {
  const s = newGame(seed);
  delete s.tutorial;
  // En el modo libre, para que no acabe la partida por la deuda mientras se prueba.
  s.mode = 'libre';
  let d = 3;
  while (!stormNight(seed, d)) d++;
  s.day = d;
  const h = s.heroes[0]!;
  h.status = 'muerto';
  s.fallen.unshift({ id: h.id, name: h.name, epitaph: 'Prueba.' });
  return s;
}

/** Con oro, raciones, jarras y tela de sobra. */
const rich = (s: GameState): GameState => ({
  ...s,
  gold: 9999,
  food: 99,
  beer: 99,
  mats: { tela: 9 },
});

describe('sucesos nocturnos', () => {
  it('se tira una sola vez por noche', () => {
    const s = structuredClone(stormy());
    rollNight(s, new Rng('a'));
    const after = structuredClone(s);
    expect(rollNight(s, new Rng('b'))).toEqual([]);
    expect(s).toEqual(after);
    expect(s.nights?.rolled).toBe(s.day);
  });

  it('el forastero solo viene con tormenta y algún caído', () => {
    const s = stormy();
    expect(canHappen(s, STRANGER_EVENT)).toBe(true);
    const alive = structuredClone(s);
    alive.heroes[0]!.status = 'ok';
    expect(canHappen(alive, STRANGER_EVENT)).toBe(false);
    const calm = structuredClone(s);
    while (stormNight(calm.seed, calm.day)) calm.day++;
    expect(canHappen(calm, STRANGER_EVENT)).toBe(false);
  });

  it('no vuelve hasta que pasan unos días', () => {
    const s = stormy();
    s.nights = { rolled: 0, last: { forastero: s.day - STRANGER_EVERY + 1 } };
    expect(canHappen(s, STRANGER_EVENT)).toBe(false);
    s.nights.last.forastero = s.day - STRANGER_EVERY;
    expect(canHappen(s, STRANGER_EVENT)).toBe(true);
  });

  it('viene muchas de las noches que puede (probabilidad moderada)', () => {
    let came = 0;
    for (let i = 0; i < 400; i++) {
      const s = structuredClone(stormy());
      rollNight(s, new Rng(`n${i}`));
      if (s.stranger) came++;
    }
    expect(came / 400).toBeGreaterThan(0.5);
    expect(came / 400).toBeLessThan(0.8);
  });

  it('con el reloj llega a la hora de la noche, y al día siguiente se va a mediodía', () => {
    // Una semilla del generador con la que viene (para no depender de la suerte).
    let s: GameState | null = null;
    for (let i = 0; i < 50 && !s?.stranger; i++) {
      const t = structuredClone(stormy());
      t.rng = new Rng(`r${i}`).save();
      t.clock = NIGHT_ROLL * DAY_SECONDS - 1;
      s = reduce(t, { type: 'tick', to: NIGHT_ROLL * DAY_SECONDS + 1 });
    }
    expect(s!.stranger?.day).toBe(s!.day);
    expect(s!.incidentNews?.some((n) => tx(n.t).includes('forastero'))).toBe(true);
    // Pasa la noche: sigue junto al fuego por la mañana.
    const morning = endDay(s!);
    expect(morning.stranger).toBeTruthy();
    const early = reduce(morning, { type: 'tick', to: STRANGER_LEAVE * DAY_SECONDS - 5 });
    expect(early.stranger).toBeTruthy();
    const noon = reduce(early, { type: 'tick', to: STRANGER_LEAVE * DAY_SECONDS + 1 });
    expect(noon.stranger).toBeNull();
    // Con el juego cerrado ese día, también se ha ido al pasar el día.
    expect(endDay(morning, true).stranger ?? null).toBeNull();
  });

  it('con el juego cerrado, la noche se tira al pasar el día y lo cuenta el amanecer', () => {
    let found = false;
    for (let i = 0; i < 50 && !found; i++) {
      const t = structuredClone(stormy());
      t.rng = new Rng(`c${i}`).save();
      const next = endDay(t, true);
      if (!next.stranger) continue;
      found = true;
      expect(next.stranger.day).toBe(t.day);
      expect(next.dawn.some((e) => tx(e.t).includes('forastero'))).toBe(true);
    }
    expect(found).toBe(true);
  });

  it('todos los sucesos tienen id distinto', () => {
    const ids = NIGHT_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('el forastero trae de vuelta a un caído', () => {
  const withStranger = (s: GameState): GameState => ({ ...s, stranger: { day: s.day, at: 0 } });

  it('el precio sube con el nivel', () => {
    expect(strangerPrice(5).gold).toBeGreaterThan(strangerPrice(1).gold);
    expect(strangerPrice(5).food).toBeGreaterThan(strangerPrice(1).food);
    expect(strangerPrice(6).tela).toBeGreaterThan(strangerPrice(1).tela);
  });

  it('sin con qué pagar, no se puede, y dice lo que falta', () => {
    const s = withStranger({ ...stormy(), gold: 0, food: 0, beer: 0, mats: {} });
    const id = s.heroes[0]!.id;
    expect(reviveIssue(s, id)).toMatch(/Falta: .*monedas.*raciones.*jarras.*tela/);
    expect(reduce(s, { type: 'stranger', heroId: id })).toBe(s);
    // Sin forastero, tampoco.
    expect(reviveIssue(rich(stormy()), id)).toBeTruthy();
  });

  it('cobra, y el revivido vuelve en cama, sin ánimo y con su secuela', () => {
    const s = withStranger(rich(stormy()));
    const h0 = s.heroes[0]!;
    const p = priceFor(h0);
    const next = reduce(s, { type: 'stranger', heroId: h0.id });
    const h = next.heroes.find((x) => x.id === h0.id)!;
    expect(next.gold).toBe(s.gold - p.gold);
    expect(next.food).toBe(s.food - p.food);
    expect(next.beer).toBe(s.beer - p.beer);
    expect(next.mats?.tela).toBe(9 - p.mats.tela!);
    expect(h.status).toBe('herido');
    expect(h.days).toBe(VEIL_BED);
    expect(h.morale).toBe(VEIL_MORALE);
    expect(h.veil).toBe(s.day + VEIL_DAYS);
    expect(h.traits.some((t) => t.id === 'velo')).toBe(true);
    expect(tx(h.history.at(-1))).toMatch(/velo/);
    expect(next.stranger).toBeNull();
    // El Muro lo cuenta: sigue en él, marcado como vuelto.
    expect(next.fallen.find((f) => f.id === h.id)?.back).toBe(s.day);
    expect(next.stats?.revived).toBe(1);
  });

  it('en el Muro, los caídos de antes se encuentran por el nombre', () => {
    const s = withStranger(rich(stormy()));
    const h = s.heroes[0]!;
    s.fallen[0] = { name: h.name, epitaph: 'De antes.' };
    const next = reduce(s, { type: 'stranger', heroId: h.id });
    expect(next.fallen[0]!.back).toBe(s.day);
  });

  it('decirle que no: se va y no cobra', () => {
    const s = withStranger(rich(stormy()));
    const next = reduce(s, { type: 'stranger', heroId: null });
    expect(next.stranger).toBeNull();
    expect(next.gold).toBe(s.gold);
    expect(next.heroes[0]!.status).toBe('muerto');
  });

  it('unos días, su moral no pasa del tope menos el velo; luego se le pasa', () => {
    let s = reduce(withStranger(rich(stormy())), {
      type: 'stranger',
      heroId: stormy().heroes[0]!.id,
    });
    const id = s.heroes[0]!.id;
    const cap = restCap(s.fac.tab) - VEIL_CAP;
    // Con la despensa llena, para que no cuente el hambre.
    const fed = (x: GameState): GameState => ({ ...x, food: 99, beer: 99 });
    for (let i = 0; i < VEIL_DAYS - 1; i++) {
      s = endDay(fed(s));
      expect(s.heroes.find((h) => h.id === id)!.morale).toBeLessThanOrEqual(
        Math.max(cap, VEIL_MORALE),
      );
    }
    for (let i = 0; i < 3; i++) s = endDay(fed(s));
    expect(s.heroes.find((h) => h.id === id)?.veil).toBeUndefined();
  });
});
