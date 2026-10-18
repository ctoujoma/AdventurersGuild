import { describe, expect, it } from 'vitest';
import { DISHES } from '../data/custom';
import { COOK_FULL, HERO_WORK, SKILL_XP, tavernIncome } from './balance';
import { dayIncome, endDay, newGame, reduce, salaries } from './game';
import type { GameState, Room } from './model';
import { Rng } from './rng';
import {
  addSeeker,
  canAssign,
  canHireWorker,
  cookBoost,
  slotsOf,
  staffBeds,
  stepWorkers,
  tidyJobs,
  workIn,
  workerCap,
} from './workers';

const roomOf = (s: GameState, type: Room['type']) => s.building.rooms.find((r) => r.type === type)!;
const village = (s: GameState, k: 'cocinera' | 'bardo' | 'mozo') =>
  s.workers.find((w) => w.village === k)!;

/** Partida tras pagar la deuda, con oro de sobra. */
function libre(seed: string): GameState {
  const s = { ...newGame(seed), gold: 2000 };
  s.mode = 'libre';
  s.day = 31;
  return s;
}

describe('trabajadores', () => {
  it('se empieza con los tres del pueblo, cada uno en la sala de su oficio', () => {
    const s = newGame('pueblo');
    expect(s.workers.map((w) => w.village)).toEqual(['cocinera', 'bardo', 'mozo']);
    expect(village(s, 'cocinera').room).toBe(roomOf(s, 'cocina').id);
    expect(village(s, 'bardo').room).toBe(roomOf(s, 'salon').id);
    expect(village(s, 'mozo').room).toBe(roomOf(s, 'bodega').id);
    expect(s.seekers).toEqual([]);
    // Cobran como el resto: sus salarios van con los de los héroes.
    const heroes = s.heroes.reduce((a, h) => a + h.salary, 0);
    expect(salaries(s)).toBe(heroes + 18);
  });

  it('el servicio del salón y la cerveza de la bodega se notan en la caja', () => {
    const s = newGame('caja');
    const base = tavernIncome(s.fac.tab, s.rep, s.trophies.length);
    // Bardo 4 × 1,5 = 6 en el salón (6 × 0,5) y mozo 3 × 1,5 = 4,5 en la bodega (4,5 × 0,4).
    expect(dayIncome(s, s.day)).toBe(base + 5);
    const idle = reduce(s, { type: 'assign', who: village(s, 'bardo').id, room: null });
    expect(dayIncome(idle, idle.day)).toBe(base + 2);
  });

  it('los héroes echan una mano, pero rinden menos y solo si están en casa', () => {
    const s = newGame('mano');
    const salon = roomOf(s, 'salon');
    const h = s.heroes[0]!;
    const before = workIn(s, 'salon');
    const t = reduce(s, { type: 'assign', who: h.id, room: salon.id });
    expect(workIn(t, 'salon')).toBe(before + HERO_WORK);
    // De guardia o de misión deja el trabajo.
    const g = reduce(t, { type: 'guard', id: h.id, on: true });
    expect(g.heroes[0]!.job).toBeUndefined();
    expect(canAssign(g, h.id, salon.id)).toMatch(/guardia/);
    const q = t.quests[0]!;
    const sent = reduce(t, { type: 'send', questId: q.id, heroIds: [h.id] });
    expect(sent.heroes[0]!.job).toBeUndefined();
  });

  it('cada sala tiene dos puestos por hueco y no admite más', () => {
    let s = newGame('puestos');
    const cocina = roomOf(s, 'cocina');
    expect(slotsOf(cocina)).toBe(2);
    s = reduce(s, { type: 'assign', who: s.heroes[0]!.id, room: cocina.id });
    expect(canAssign(s, s.heroes[1]!.id, cocina.id)).toMatch(/puestos/);
    // Las salas rotas o sin trabajo no tienen puestos.
    expect(canAssign(s, s.heroes[1]!.id, roomOf(s, 'enfermeria').id)).toMatch(/en uso/);
    expect(canAssign(s, s.heroes[1]!.id, roomOf(s, 'capilla').id)).toMatch(/trabajo/);
  });

  it('la cocina hace que el plato de la casa anime más', () => {
    const s = reduce(
      { ...newGame('plato'), gold: 500 },
      { type: 'custom', patch: { dish: 'guiso' } },
    );
    for (const h of s.heroes) h.morale = 10;
    expect(cookBoost(s)).toBe(1 + Math.min(1, 6 / COOK_FULL));
    const morale = (x: GameState) => x.heroes[0]!.morale;
    const cook = endDay(s);
    const none = endDay(reduce(s, { type: 'fireWorker', id: village(s, 'cocinera').id }));
    // Con la cocinera, el guiso anima el doble.
    expect(morale(cook) - morale(none)).toBe(DISHES.guiso.morale);
  });

  it('alguien en la enfermería cura antes a los heridos', () => {
    const start = { ...newGame('enfermera'), gold: 500 };
    const s = reduce(start, { type: 'upgradeRoom', id: roomOf(start, 'enfermeria').id });
    const h = s.heroes[0]!;
    h.status = 'herido';
    h.days = 6;
    const nurse = reduce(s, {
      type: 'assign',
      who: village(s, 'mozo').id,
      room: roomOf(s, 'enfermeria').id,
    });
    const days = (x: GameState) => x.heroes.find((y) => y.id === h.id)!.days;
    expect(days(endDay(nurse))).toBe(days(endDay(s)) - 1);
  });

  it('hasta el día 30 bastan los del pueblo; después, una cama del servicio para cada uno', () => {
    const s = newGame('camas');
    const rng = new Rng(1);
    addSeeker(s, rng, []);
    expect(canHireWorker(s, s.seekers[0]!.id)).toMatch(/pueblo/);
    const t = libre('camas');
    addSeeker(t, rng, []);
    expect(workerCap(t)).toBe(3);
    expect(canHireWorker(t, t.seekers[0]!.id)).toMatch(/servicio/);
    // Un dormitorio del servicio de un hueco: dos camas por nivel.
    t.building.rooms.push({
      id: 'srv',
      type: 'servicio',
      col: 4,
      floor: 1,
      w: 1,
      h: 1,
      level: 2,
      spent: 0,
    });
    expect(staffBeds(t.building)).toBe(4);
    const seeker = t.seekers[0]!;
    const u = reduce(t, { type: 'hireWorker', id: seeker.id });
    expect(u.workers).toHaveLength(4);
    expect(u.gold).toBe(t.gold - seeker.fee);
    expect(u.seekers).toHaveLength(0);
  });

  it('quien se queda sin sala tras una obra busca sitio en otra', () => {
    const s = newGame('obra');
    s.building.rooms = s.building.rooms.filter((r) => r.type !== 'cocina');
    tidyJobs(s);
    // La cocinera se va al salón, que tiene puestos libres.
    expect(village(s, 'cocinera').room).toBe(roomOf(s, 'salon').id);
  });

  it('trabajando se coge maña', () => {
    const s = newGame('maña');
    const w = village(s, 'mozo');
    const events: { t: string }[] = [];
    // En su oficio suma dos por noche.
    for (let i = 0; i < (w.skill * SKILL_XP) / 2; i++) stepWorkers(s, new Rng(i), events);
    expect(w.skill).toBe(4);
    expect(events.some((e) => e.t.includes('Maña 4'))).toBe(true);
  });

  it('desde el día 30 viene gente a pedir trabajo', () => {
    const s = libre('piden');
    s.day = 33;
    stepWorkers(s, new Rng(3), []);
    expect(s.seekers).toHaveLength(1);
    const w = s.seekers[0]!;
    expect(w.skill).toBeGreaterThanOrEqual(2);
    expect(w.salary).toBe(3 + w.skill);
  });
});
