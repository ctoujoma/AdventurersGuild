import { describe, expect, it } from 'vitest';
import { DECOR, FACADE, decorSlots } from '../data/custom';
import { NOBLE_APPEAL, RAID_NOTORIETY, SEAT_TURNS } from './balance';
import { newGame, reduce } from './game';
import type { GameState, Room } from './model';
import { raidChance } from './raids';
import {
  appeal,
  beerPerVisitor,
  brawlChance,
  neighborsOf,
  noisyBeds,
  seatsOf,
  serveCap,
  visitorsOf,
} from './salon';

const room = (s: GameState, type: Room['type']) => s.building.rooms.find((r) => r.type === type)!;

describe('el salón y sus visitantes', () => {
  it('el Atractivo sale del salón, la decoración, la fachada y los trofeos', () => {
    let s = { ...newGame('atractivo'), gold: 1000 };
    // Salón de nivel 1: dos puntos.
    expect(appeal(s)).toBe(2);
    s = reduce(s, { type: 'decor', id: 'lampara', on: true });
    expect(appeal(s)).toBe(2 + DECOR.lampara.appeal);
    s = reduce(s, { type: 'facade', id: 'letrero' });
    expect(s.gold).toBe(1000 - DECOR.lampara.price - FACADE.letrero.price);
    expect(appeal(s)).toBe(2 + DECOR.lampara.appeal + FACADE.letrero.appeal);
    // La fachada se compra una vez.
    expect(reduce(s, { type: 'facade', id: 'letrero' })).toBe(s);
    // Más nivel de salón, más huecos de decoración.
    expect(decorSlots(1)).toBe(2);
    expect(decorSlots(3)).toBe(4);
  });

  it('los visitantes de un día son siempre los mismos y caben en las plazas', () => {
    const s = newGame('visitas');
    const a = visitorsOf(s, 4);
    expect(visitorsOf(s, 4)).toEqual(a);
    expect(a.total).toBeGreaterThan(0);
    const famous = { ...s, rep: 5000 };
    expect(visitorsOf(famous, 4).total).toBe(Math.round(seatsOf(s.building) * SEAT_TURNS));
    // A cuántos se atiende lo deciden la barra y la cocina.
    expect(visitorsOf(famous, 4).served).toBe(
      Math.min(visitorsOf(famous, 4).total, Math.round(serveCap(famous))),
    );
    // Sin salón no viene nadie.
    const shut = structuredClone(s);
    room(shut, 'salon').level = 0;
    expect(visitorsOf(shut, 4).total).toBe(0);
  });

  it('los nobles solo vienen a un salón con mucho Atractivo', () => {
    const s = { ...newGame('nobles'), rep: 200 };
    const nobles = (x: GameState) =>
      Array.from({ length: 20 }, (_, d) => visitorsOf(x, d + 1).kinds.noble).reduce(
        (a, b) => a + b,
      );
    expect(appeal(s)).toBeLessThan(NOBLE_APPEAL);
    expect(nobles(s)).toBe(0);
    const fancy = structuredClone(s);
    fancy.custom = {
      ...fancy.custom!,
      decor: ['lampara', 'chimenea'],
      facade: ['letrero', 'faroles'],
    };
    expect(appeal(fancy)).toBeGreaterThanOrEqual(NOBLE_APPEAL);
    expect(nobles(fancy)).toBeGreaterThan(0);
  });

  it('vecindad: la cocina junto al salón atiende a más, la bodega bajo tierra hace mejor cerveza', () => {
    const s = newGame('vecinos');
    const cocina = room(s, 'cocina');
    expect(neighborsOf(s.building, cocina)[0]?.good).toBe(true);
    const far = structuredClone(s);
    room(far, 'cocina').floor = 1;
    room(far, 'cocina').col = 4;
    expect(serveCap(far)).toBeLessThan(serveCap(s));
    const up = structuredClone(s);
    room(up, 'bodega').floor = 0;
    expect(beerPerVisitor(up)).toBeLessThan(beerPerVisitor(s));
    // Las camas pegadas al salón descansan peor.
    expect(noisyBeds(s.building)).toBe(false);
    const loud = structuredClone(s);
    loud.building.rooms.push({
      id: 'd2',
      type: 'dormitorio',
      col: 4,
      floor: 0,
      w: 1,
      h: 1,
      level: 1,
      spent: 0,
    });
    room(loud, 'cocina').col = 5;
    expect(noisyBeds(loud.building)).toBe(false);
    room(loud, 'cocina').col = 9;
    loud.building.rooms.find((r) => r.id === 'd2')!.col = 3;
    loud.building.rooms = loud.building.rooms.filter((r) => r.type !== 'cocina');
    expect(noisyBeds(loud.building)).toBe(true);
  });

  it('con naipes y mucha gente hay más peleas', () => {
    const s = newGame('peleas');
    const v = visitorsOf(s, 3);
    const cards = { ...s, custom: { ...s.custom!, decor: ['naipes' as const] } };
    expect(brawlChance(cards, v)).toBeGreaterThan(brawlChance(s, v));
  });

  it('tras la visita de un espía, el asalto es más probable unos días', () => {
    const s = { ...newGame('espia'), day: 20, rep: RAID_NOTORIETY + 26 };
    const base = raidChance(s);
    expect(raidChance({ ...s, scout: 19 })).toBeGreaterThan(base);
    expect(raidChance({ ...s, scout: 5 })).toBe(base);
  });
});
