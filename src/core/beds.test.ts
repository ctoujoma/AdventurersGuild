import { describe, expect, it } from 'vitest';
import { VET_SNUB_CAP } from './balance';
import { dormIssue, sleepPlan, vetsWithoutWing } from './beds';
import { endDay, newGame, reduce } from './game';
import type { GameState, Room } from './model';

const wing = (level = 1): Room => ({
  id: 'v',
  type: 'veteranos',
  col: 1,
  floor: 2,
  w: 1,
  h: 1,
  level,
  spent: 0,
});
const dorm = (s: GameState) => s.building.rooms.find((r) => r.type === 'dormitorio')!;

describe('quién duerme dónde', () => {
  it('los héroes, en los dormitorios; los veteranos, en el ala si la hay', () => {
    const s = newGame('camas');
    const [a, b] = s.heroes;
    a!.lvl = 6;
    b!.lvl = 2;
    expect(sleepPlan(s).get(a!.id)).toBe(dorm(s).id);
    expect(vetsWithoutWing(s).map((h) => h.id)).toEqual([a!.id]);
    s.building.rooms.push(wing());
    const plan = sleepPlan(s);
    expect(plan.get(a!.id)).toBe('v');
    expect(plan.get(b!.id)).toBe(dorm(s).id);
    expect(vetsWithoutWing(s)).toEqual([]);
  });

  it('en el ala solo duermen veteranos (salvo que no quepan en los dormitorios)', () => {
    const s = newGame('ala');
    s.building.rooms.push(wing());
    const h = s.heroes.find((x) => x.lvl < 4)!;
    expect(dormIssue(s, h.id, 'v')).toMatch(/veterano/);
    expect(reduce(s, { type: 'dorm', who: h.id, room: 'v' })).toBe(s);
  });

  it('se puede cambiar a alguien de dormitorio si queda cama', () => {
    const s = newGame('mover');
    s.building.rooms.push({ ...dorm(s), id: 'd2', col: 1, floor: 2 });
    const h = s.heroes[0]!;
    const before = sleepPlan(s).get(h.id);
    const to = before === 'd2' ? dorm(s).id : 'd2';
    const t = reduce(s, { type: 'dorm', who: h.id, room: to });
    expect(sleepPlan(t).get(h.id)).toBe(to);
    expect(dormIssue(t, h.id, to)).toMatch(/ya duerme/);
    // Los trabajadores, solo al servicio.
    expect(dormIssue(s, s.workers[0]!.id, to)).toBeTruthy();
  });

  it('el veterano sin cuarto en el ala se queja una vez y pierde moral hasta tenerlo', () => {
    const s = newGame('queja');
    const h = s.heroes[0]!;
    h.lvl = 5;
    h.morale = 90;
    let t = endDay({ ...s, tips: ['*'] });
    const x = t.heroes.find((y) => y.id === h.id)!;
    expect(t.dawn.filter((e) => e.t.includes(h.name) && /novatos/.test(e.t))).toHaveLength(1);
    expect(x.morale).toBeLessThan(90);
    expect(x.vetSnub).toBe(true);
    // Otra noche: no se repite el aviso.
    t = endDay(t);
    expect(t.dawn.some((e) => e.t.includes(h.name) && /novatos/.test(e.t))).toBe(false);
    // Con el ala, se le pasa.
    const w = structuredClone(t);
    w.building.rooms.push(wing());
    const next = endDay(w);
    expect(next.heroes.find((y) => y.id === h.id)!.vetSnub).toBeUndefined();
    expect(VET_SNUB_CAP).toBeGreaterThan(0);
  });
});
