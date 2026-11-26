import { describe, expect, it } from 'vitest';
import { CLERIC_NURSE, DAY_SECONDS, HEAL_IN_BED, HP_DAY, HP_GRAVE } from './balance';
import { hpOf } from './health';
import { endDay, newGame, reduce, tick } from './game';
import { cotsIn, cotsOf, healAt, infirmaryPlan, restHours, staffing } from './infirmary';
import type { GameState, Hero, Room } from './model';

/** La partida del tío con la enfermería arreglada (nivel `level`) y `hurt` heridos de 10 días. */
function ward(seed: string, level = 1, hurt = 2): { s: GameState; enf: Room } {
  const s = newGame(seed);
  const enf = s.building.rooms.find((r) => r.type === 'enfermeria')!;
  enf.level = level;
  s.workers = s.workers.map((w) => (w.room === enf.id ? { ...w, room: undefined } : w));
  for (const h of s.heroes) delete h.job;
  const base = s.heroes[0]!;
  s.heroes = Array.from({ length: hurt }, (_, i) => ({
    ...structuredClone(base),
    id: `h${i}`,
    status: 'herido' as const,
    days: 10 - i,
  }));
  return { s, enf };
}

describe('enfermería', () => {
  it('sin nadie trabajando, un catre cura como una cama', () => {
    const { s, enf } = ward('vacia');
    expect(staffing(s, enf)).toBe(0);
    expect(healAt(s, enf)).toBe(HEAL_IN_BED);
  });

  it('cuanta más mano (y más maña), más cura; a pleno, lo del nivel y uno más', () => {
    const { s, enf } = ward('mano', 2);
    const nurse = (skill: number) => ({
      id: 'w1',
      seed: 'w',
      name: 'Ana',
      sex: 'f' as const,
      skill,
      trade: 'enfermeria' as const,
      xp: 0,
      salary: 5,
      fee: 0,
      room: enf.id,
      quote: '',
    });
    s.workers = [...s.workers, nurse(1)];
    const low = healAt(s, enf);
    s.workers = [...s.workers.filter((w) => w.id !== 'w1'), nurse(6)];
    expect(staffing(s, enf)).toBe(1);
    expect(healAt(s, enf)).toBe(HEAL_IN_BED + 2 + 1);
    expect(healAt(s, enf)).toBeGreaterThan(low);
  });

  it('el clérigo echando una mano rinde más que otro héroe', () => {
    const { s, enf } = ward('clerigo');
    const helper = {
      ...structuredClone(s.heroes[0]!),
      id: 'x',
      status: 'ok' as const,
      job: enf.id,
      cls: 'guerrero' as Hero['cls'],
    };
    s.heroes.push(helper);
    const one = staffing(s, enf);
    helper.cls = 'clerigo';
    expect(staffing(s, enf)).toBeCloseTo(Math.min(1, one * CLERIC_NURSE), 6);
  });

  it('el ancho da catres: los más graves van a ellos y los demás se curan en su cama', () => {
    const { s, enf } = ward('catres', 1, 4);
    expect(cotsIn(enf)).toBe(2);
    const hp = (x: GameState, id: string) => hpOf(x.heroes.find((h) => h.id === id)!);
    const next = tick({ ...s, clock: 0 }, DAY_SECONDS / 24);
    expect([...infirmaryPlan(next).keys()].sort()).toEqual(['h0', 'h1']);
    const day = endDay({ ...next, tips: ['*'] }, true);
    // Sin catre, en su cama: lo de un día a ×1.
    expect(hp(day, 'h3') - hp(next, 'h3')).toBeCloseTo(HP_DAY * HEAL_IN_BED * (23 / 24), 2);
  });

  it('puede haber dos: el que no cabe en una va a la otra', () => {
    const { s, enf } = ward('dos', 1, 3);
    s.building.rooms.push({ ...enf, id: 'enf2', col: s.building.cols, floor: 0 });
    s.building.cols++;
    const next = tick({ ...s, clock: 0 }, DAY_SECONDS / 24);
    expect(new Set(infirmaryPlan(next).values()).size).toBe(2);
    expect(infirmaryPlan(next).size).toBe(3);
  });

  it('se cura hora a hora en su cama: se levanta al 20 % si no tiene catre', () => {
    const { s, enf } = ward('horas', 1, 1);
    enf.level = 0;
    const h = s.heroes[0]!;
    // Le faltan dos días a ×1 para levantarse (el 20 %).
    h.hp = HP_GRAVE - 2 * HP_DAY;
    expect(restHours(s, h)).toBe(48);
    const half = tick({ ...s, clock: 0 }, DAY_SECONDS / 2);
    expect(half.heroes[0]!.hp).toBeCloseTo(h.hp + HP_DAY / 2, 6);
    expect(restHours(half, half.heroes[0]!)).toBe(36);
    // Y quien llega al 20 % se levanta en el momento, sin esperar al amanecer.
    h.hp = HP_GRAVE - HP_DAY / 4;
    const up = tick({ ...s, clock: 0 }, DAY_SECONDS / 2);
    expect(up.heroes[0]!.status).toBe('ok');
  });

  it('en un catre se queda hasta la vida entera, aunque esté leve o casi sano', () => {
    const { s } = ward('catre', 1, 1);
    const h = s.heroes[0]!;
    h.status = 'ok';
    h.hp = 0.6;
    h.job = s.building.rooms.find((r) => r.type === 'cocina')?.id;
    let x = tick({ ...s, clock: 0 }, DAY_SECONDS / 24);
    const in1 = x.heroes[0]!;
    expect(in1.status).toBe('herido');
    expect(in1.cot).toBeDefined();
    expect(in1.job).toBeUndefined();
    expect(restHours(x, in1)).toBeGreaterThan(0);
    // Pasa del 50 % y del 90 % y sigue en el catre; al 100 %, se levanta.
    x = { ...x, heroes: [{ ...in1, hp: 0.95 }] };
    x = tick(x, (x.clock ?? 0) + DAY_SECONDS / 24);
    expect(x.heroes[0]!.status).toBe('herido');
    x = tick(x, DAY_SECONDS);
    expect(x.heroes[0]!.status).toBe('ok');
    expect(x.heroes[0]!.cot).toBeUndefined();
  });

  it('a mano: se cambia a quién se cura en un catre y se da el alta', () => {
    const { s, enf } = ward('mano2', 1, 3);
    let x = tick({ ...s, clock: 0 }, DAY_SECONDS / 24);
    const [a, b] = cotsOf(x, enf.id);
    const out = x.heroes.find((h) => !h.cot)!;
    // Lleno: entra el de fuera en el sitio de `a`, que vuelve a su cama (grave) sin catre.
    x = reduce(x, { type: 'cot', who: out.id, room: enf.id, out: a!.id });
    expect(x.heroes.find((h) => h.id === out.id)!.cot).toBe(enf.id);
    expect(x.heroes.find((h) => h.id === a!.id)!.cot).toBeUndefined();
    expect(x.heroes.find((h) => h.id === a!.id)!.cotOff).toBe(true);
    // El alta: deja el catre libre y no se le vuelve a acostar solo.
    x = reduce(x, { type: 'cot', who: b!.id });
    expect(x.heroes.find((h) => h.id === b!.id)!.cot).toBeUndefined();
    x = tick(x, (x.clock ?? 0) + DAY_SECONDS / 24);
    expect(cotsOf(x, enf.id).map((h) => h.id)).toEqual([out.id]);
  });

  it('si llega un grave sin catre libre, deja su sitio el que esté mejor', () => {
    const { s, enf } = ward('relevo', 1, 3);
    s.heroes[0]!.hp = 0.6;
    s.heroes[1]!.hp = 0.4;
    s.heroes[0]!.status = 'ok';
    s.heroes[1]!.status = 'ok';
    s.heroes[2]!.status = 'ok';
    s.heroes[2]!.hp = 0.9;
    let x = tick({ ...s, clock: 0 }, DAY_SECONDS / 24);
    expect(cotsOf(x, enf.id).map((h) => h.id)).toEqual(['h1', 'h0']);
    // Cae grave el de fuera: entra y se levanta el que está mejor (h0).
    x = {
      ...x,
      heroes: x.heroes.map((h) =>
        h.id === 'h2' ? { ...h, hp: 0.1, status: 'herido' as const } : h,
      ),
    };
    x = tick(x, (x.clock ?? 0) + DAY_SECONDS / 24);
    expect(cotsOf(x, enf.id).map((h) => h.id)).toEqual(['h2', 'h1']);
    expect(x.heroes.find((h) => h.id === 'h0')!.status).toBe('ok');
  });
});
