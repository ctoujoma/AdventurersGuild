import { describe, expect, it } from 'vitest';
import {
  BEER_COIN,
  CELLAR_STORE,
  COOK_PER_WORK,
  HERO_WORK,
  HUNGER_MORALE,
  KITCHEN_STORE,
  PANTRY_STORE,
  START_BEER,
  START_FOOD,
} from './balance';
import { dayIncome, endDay, newGame, reduce } from './game';
import { beerCap, brewAt, dailyYield, eatersOf, foodCap, hungryTonight } from './larder';
import type { GameState, Room } from './model';
import { visitorsOf } from './salon';

const roomOf = (s: GameState, type: Room['type']) => s.building.rooms.find((r) => r.type === type)!;
const cook = (s: GameState) => s.workers.find((w) => w.village === 'cocinera')!;

describe('comida y cerveza', () => {
  it('quien cocina hace las raciones y quien trabaja en la bodega, las jarras', () => {
    const s = newGame('raciones');
    expect(s.food).toBe(START_FOOD);
    expect(s.beer).toBe(START_BEER);
    // Remedios, con Maña 4 en su oficio, rinde 6.
    expect(dailyYield(s).food).toBe(Math.round(6 * COOK_PER_WORK));
    const none = reduce(s, { type: 'assign', who: cook(s).id, room: null });
    expect(dailyYield(none).food).toBe(0);
    // Un héroe echando una mano también cocina, aunque menos.
    const help = reduce(none, {
      type: 'assign',
      who: s.heroes[0]!.id,
      room: roomOf(s, 'cocina').id,
    });
    expect(dailyYield(help).food).toBe(Math.round(HERO_WORK * COOK_PER_WORK));
    // La bodega bajo tierra saca más que sobre el suelo.
    const up = structuredClone(s);
    roomOf(up, 'bodega').floor = 0;
    expect(brewAt(up, roomOf(up, 'bodega'))).toBeLessThan(brewAt(s, roomOf(s, 'bodega')));
  });

  it('la cocina guarda poco, la despensa mucho y la cerveza va a la bodega', () => {
    const s = newGame('almacen');
    expect(foodCap(s.building)).toBe(KITCHEN_STORE);
    expect(beerCap(s.building)).toBe(CELLAR_STORE);
    const t = structuredClone(s);
    t.building.rooms.push({
      id: 'dsp',
      type: 'despensa',
      col: 4,
      floor: 0,
      w: 2,
      h: 1,
      level: 1,
      spent: 0,
    });
    expect(foodCap(t.building)).toBe(KITCHEN_STORE + 2 * PANTRY_STORE);
    // Lo que no cabe se echa a perder al terminar el día.
    const full = endDay({ ...s, food: 999, beer: 999 });
    expect(full.food).toBeLessThanOrEqual(foodCap(s.building));
    expect(full.beer).toBe(beerCap(s.building));
  });

  it('los visitantes comen y beben de lo guardado; sin raciones solo pagan la jarra', () => {
    const s = { ...newGame('visitas'), rep: 200 };
    const v = visitorsOf(s, 4);
    expect(v.fed).toBe(Math.min(v.served, s.food));
    expect(v.drank).toBe(Math.min(v.served, s.beer));
    const empty = { ...s, food: 0 };
    const w = visitorsOf(empty, 4);
    expect(w.fed).toBe(0);
    expect(w.coins).toBe(w.drank * BEER_COIN);
    expect(dayIncome({ ...s, beer: 0 }, 4)).toBeLessThan(dayIncome(s, 4));
    // Al terminar el día sale de lo guardado lo que tomaron y entra lo que hicieron las salas.
    const next = endDay(s);
    const made = dailyYield(s);
    const home = eatersOf(s);
    const visits = visitorsOf(s, s.day);
    expect(next.food).toBe(
      Math.min(
        foodCap(s.building),
        s.food - visits.fed + made.food - home.heroes.length - home.workers.length,
      ),
    );
    expect(next.yields).toEqual(
      expect.arrayContaining([
        { room: roomOf(s, 'cocina').id, food: made.food },
        { room: roomOf(s, 'bodega').id, beer: made.beer },
      ]),
    );
  });

  it('quien se acuesta sin cenar pierde moral; los del pueblo cenan en su casa', () => {
    const base = newGame('hambre');
    for (const h of base.heroes) h.morale = 40;
    // Al empezar solo cenan los héroes: los tres del pueblo se van a dormir a su casa.
    expect(eatersOf(base).workers).toHaveLength(0);
    const hungry = reduce({ ...base, food: 0 }, { type: 'assign', who: cook(base).id, room: null });
    expect(hungryTonight(hungry)).toBe(base.heroes.length);
    expect(hungryTonight(base)).toBe(0);
    const fed = endDay(base);
    const starved = endDay(hungry);
    for (const h of base.heroes) {
      const a = fed.heroes.find((x) => x.id === h.id)!;
      const b = starved.heroes.find((x) => x.id === h.id)!;
      expect(a.morale - b.morale).toBe(HUNGER_MORALE);
    }
    expect(starved.dawn.some((e) => e.t.includes('sin cenar'))).toBe(true);
  });
});
