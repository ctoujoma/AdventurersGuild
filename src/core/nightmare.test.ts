import { describe, expect, it } from 'vitest';
import {
  CAT_NIGHT_FOOD,
  DAY_SECONDS,
  INCIDENT_EVERY,
  NIGHT_ODDS,
  NIGHT_ROLL,
  NIGHTMARE_BEER,
  NIGHTMARE_EASE,
  NIGHTMARE_LOSS,
} from './balance';
import { cheat } from './cheats';
import { endDay, newGame, reduce } from './game';
import { stepIncidents } from './incidents';
import type { GameState } from './model';
import { NIGHT_EVENTS, canHappen, dawnNight, rollNight } from './night';
import { NIGHT_CAT_EVENT, huntRooms } from './nightCat';
import { NIGHTMARE_EVENT, easeIssue, restless, settleNightmare } from './nightmare';
import { MORALE_LOW } from './party';
import { Rng } from './rng';
import { tx } from '../textos';

/** Una partida sin tutorial, en el modo libre (sin deuda), con jarras y raciones. */
function base(seed = 'noche-b'): GameState {
  const s = newGame(seed);
  delete s.tutorial;
  s.mode = 'libre';
  s.day = 5;
  s.beer = 10;
  s.food = 20;
  return s;
}

/** Con el primer héroe de casa desanimado. */
function gloomy(seed?: string): GameState {
  const s = base(seed);
  s.heroes.find((h) => h.status === 'ok')!.morale = MORALE_LOW - 5;
  return s;
}

/** Con una despensa en la planta del salón (la cocina de la taberna del tío, cambiada). */
function withLarder(seed?: string): GameState {
  const s = base(seed);
  s.building = structuredClone(s.building);
  const r = s.building.rooms.find((x) => x.type === 'cocina')!;
  r.type = 'despensa';
  r.level = 1;
  return s;
}

describe('la pesadilla', () => {
  it('solo si hay alguien herido o desanimado en su cama, y no la noche del asalto', () => {
    const s = base();
    for (const h of s.heroes) h.morale = 80;
    expect(canHappen(s, NIGHTMARE_EVENT)).toBe(false);
    const g = gloomy();
    expect(canHappen(g, NIGHTMARE_EVENT)).toBe(true);
    // De guardia no se acuesta.
    const guard = structuredClone(g);
    for (const h of guard.heroes) if (h.morale < MORALE_LOW) h.guard = true;
    expect(restless(guard)).toEqual([]);
    // La noche del asalto, nada.
    const raid = cheat(g, 'asalto').state;
    expect(canHappen(raid, NIGHTMARE_EVENT)).toBe(false);
  });

  it('está en la lista de sucesos, en la tirada común', () => {
    const ids = NIGHT_EVENTS.map((e) => e.id);
    expect(ids).toContain('pesadilla');
    expect(ids).toContain('gato');
    expect(NIGHTMARE_EVENT.chance).toBeUndefined();
    expect(NIGHT_CAT_EVENT.chance).toBeUndefined();
  });

  it('sin tocar, amanece con menos moral (haya o no guardia)', () => {
    const s = cheat(gloomy(), 'pesadilla').state;
    const h = s.heroes.find((x) => x.id === s.nightmare!.hero)!;
    const other = s.heroes.find((x) => x.status === 'ok' && x.id !== h.id)!;
    other.guard = true;
    const was = h.morale;
    const t = structuredClone(s);
    const said = settleNightmare(t);
    expect(said?.k).toBe('warn');
    expect(tx(said?.t)).toContain(h.name);
    expect(t.heroes.find((x) => x.id === h.id)!.morale).toBe(was - NIGHTMARE_LOSS);
    expect(t.nightmare).toBeNull();
    // Pasando el día (o con «Pasar la noche») igual: la línea va a la carta del amanecer.
    const next = endDay(s);
    expect(next.dawn.some((e) => tx(e.t).includes('dando vueltas'))).toBe(true);
    expect(next.nightmare).toBeNull();
  });

  it('el trago gasta una jarra (herido o no) y sube la moral; al amanecer, bien', () => {
    const s = cheat(gloomy(), 'pesadilla').state;
    const id = s.nightmare!.hero;
    const was = s.heroes.find((x) => x.id === id)!.morale;
    const t = reduce(s, { type: 'nightmare' });
    expect(t.beer).toBe(s.beer - NIGHTMARE_BEER);
    expect(t.heroes.find((x) => x.id === id)!.morale).toBe(was + NIGHTMARE_EASE);
    expect(t.nightmare?.eased).toBe(true);
    expect(t.incidentNews?.[0]?.k).toBe('good');
    // Una vez por noche.
    expect(reduce(t, { type: 'nightmare' })).toBe(t);
    const u = structuredClone(t);
    expect(settleNightmare(u)?.k).toBe('good');
    expect(u.heroes.find((x) => x.id === id)!.morale).toBe(was + NIGHTMARE_EASE);
    // Al herido, también una.
    const hurt = base('herida');
    const h = hurt.heroes.find((x) => x.status === 'ok')!;
    h.status = 'herido';
    h.days = 2;
    const n = cheat(hurt, 'pesadilla').state;
    expect(n.nightmare?.hero).toBe(h.id);
    expect(reduce(n, { type: 'nightmare' }).beer).toBe(n.beer - NIGHTMARE_BEER);
  });

  it('sin cerveza no se puede', () => {
    const s = cheat(gloomy(), 'pesadilla').state;
    s.beer = 0;
    expect(easeIssue(s)).toMatch(/cerveza/);
    expect(reduce(s, { type: 'nightmare' })).toBe(s);
  });

  it('sale en la tirada común (con los demás sucesos que puedan)', () => {
    let got = 0;
    for (let i = 0; i < 200; i++) {
      const s = gloomy('comun');
      s.day = 5 + i;
      rollNight(s, new Rng(`n${i}`));
      if (s.nightmare) got++;
    }
    // La noche sale una de cada dos (algo más con niebla) y se reparte entre los posibles.
    expect(got / 200).toBeGreaterThan(0.1);
    expect(got / 200).toBeLessThan(NIGHT_ODDS + 0.05);
  });

  it('al empezar, elige a uno de los que pueden', () => {
    let got = 0;
    for (let i = 0; i < 40; i++) {
      const s = gloomy(`p${i}`);
      const t = structuredClone(s);
      if (NIGHTMARE_EVENT.start(t, new Rng(`r${i}`)) === null && t.nightmare) got++;
    }
    expect(got).toBe(40);
  });
});

describe('el gato cazador', () => {
  it('solo con una despensa o bodega en la planta del salón', () => {
    // En la taberna del tío la bodega está en el sótano: no.
    expect(huntRooms(base())).toEqual([]);
    expect(canHappen(base(), NIGHT_CAT_EVENT)).toBe(false);
    const s = withLarder();
    expect(huntRooms(s).map((r) => r.type)).toEqual(['despensa']);
    expect(canHappen(s, NIGHT_CAT_EVENT)).toBe(true);
    expect(canHappen(cheat(s, 'asalto').state, NIGHT_CAT_EVENT)).toBe(false);
  });

  it('al amanecer, la línea y las raciones; las ratas de día siguen viniendo', () => {
    const s = cheat(withLarder(), 'gato').state;
    expect(s.clock).toBeGreaterThanOrEqual(NIGHT_ROLL * DAY_SECONDS);
    const next = endDay(s);
    const line = next.dawn.find((e) => tx(e.t).startsWith('El gato ha cazado'));
    expect(tx(line?.t)).toContain('despensa');
    expect(next.nightCat ?? null).toBeNull();
    // El incidente de las ratas no se queda sin hacer: al día siguiente puede haberlas.
    let rats = 0;
    for (let i = 0; i < 200; i++) {
      const t = structuredClone({ ...next, clock: 0 });
      t.rng = i * 7919;
      stepIncidents(t, 0, INCIDENT_EVERY / 3);
      if (t.incidents?.some((x) => x.kind === 'ratas')) rats++;
    }
    expect(rats).toBeGreaterThan(0);
  });

  it('las raciones salvadas', () => {
    const s = cheat(withLarder(), 'gato').state;
    const t = structuredClone(s);
    const said = dawnNight(t);
    expect(said.length).toBe(1);
    expect(t.food).toBe(s.food + CAT_NIGHT_FOOD);
  });
});
