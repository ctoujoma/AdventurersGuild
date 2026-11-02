import { describe, expect, it } from 'vitest';
import { newGame, reduce } from '../core/game';
import { brewAt } from '../core/larder';
import type { GameState, Room } from '../core/model';
import { candidatesFor, crewAlerts, crewGroups, taskLabel, taskOf, taskOptions } from './crew';
import { GUARD, planTask, type Task } from './drop';

const roomOf = (s: GameState, type: Room['type']) => s.building.rooms.find((r) => r.type === type)!;
const group = (s: GameState, key: string) => crewGroups(s).find((g) => g.key === key)!;

/** Cambia la tarea de alguien como lo haría la lista. */
function task(s: GameState, who: string, t: Task): GameState {
  const d = planTask(s, who, t);
  if (!d.ok) throw new Error(d.text);
  return d.actions.reduce(reduce, s);
}

describe('la casa por tareas', () => {
  it('cada sala con su gente y sus puestos; los héroes en casa, a descansar', () => {
    const s = newGame('casa');
    const cocina = group(s, roomOf(s, 'cocina').id);
    expect(cocina.slots).toBe(2);
    expect(cocina.people.map((p) => p.name)).toEqual(['Remedios']);
    expect(cocina.note).toMatch(/raciones/);
    expect(group(s, GUARD).people).toEqual([]);
    expect(group(s, 'descansan').people.every((p) => p.hero)).toBe(true);
    // La enfermería está rota: no tiene puestos, no sale.
    expect(crewGroups(s).some((g) => g.key === roomOf(s, 'enfermeria').id)).toBe(false);
  });

  it('un héroe que ayuda ocupa su puesto y sale en la sala, no entre los que descansan', () => {
    let s = newGame('ayuda');
    const h = s.heroes[0]!;
    s = task(s, h.id, roomOf(s, 'bodega').id);
    const bodega = group(s, roomOf(s, 'bodega').id);
    expect(bodega.people.map((p) => p.id)).toContain(h.id);
    expect(bodega.people.find((p) => p.id === h.id)!.hero).toBe(true);
    expect(group(s, 'descansan').people.map((p) => p.id)).not.toContain(h.id);
    // A la guardia: deja la bodega.
    s = task(s, h.id, GUARD);
    expect(taskOf(s, h.id)).toBe(GUARD);
    expect(group(s, GUARD).people.map((p) => p.id)).toEqual([h.id]);
    expect(group(s, roomOf(s, 'bodega').id).people.map((p) => p.id)).not.toContain(h.id);
    // Y a descansar.
    s = task(s, h.id, null);
    expect(taskOf(s, h.id)).toBeNull();
  });

  it('avisa de salas sin nadie, de quien no tiene tarea y de quien está fuera de su oficio', () => {
    let s = newGame('avisos');
    expect(crewAlerts(s)).toEqual([]);
    const cook = s.workers.find((w) => w.trade === 'cocina')!;
    s = task(s, cook.id, null);
    const texts = crewAlerts(s).map((a) => a.text);
    expect(texts).toContain('Cocina: no trabaja nadie.');
    expect(crewAlerts(s).find((a) => a.who === cook.id)?.text).toMatch(/no tiene tarea/);
    // En el salón (no es su oficio) y con la cocina libre: rendiría más en la cocina.
    s = task(s, cook.id, roomOf(s, 'salon').id);
    expect(crewAlerts(s).find((a) => a.who === cook.id)?.text).toMatch(/rendiría más en Cocina/);
    expect(group(s, roomOf(s, 'salon').id).people.find((p) => p.id === cook.id)!.off).toBe(true);
    // Quien pide trabajo ya no avisa aquí: está en la barra.
    s = { ...s, seekers: [{ ...s.workers[0]!, id: 'w99' }] };
    expect(
      crewAlerts(s)
        .map((a) => a.text)
        .join(' '),
    ).not.toMatch(/pide trabajo/);
  });

  it('el selector: los trabajadores no entrenan ni hacen guardia; lo lleno no se puede', () => {
    let s = newGame('selector');
    const cook = s.workers.find((w) => w.trade === 'cocina')!;
    const opts = taskOptions(s, cook.id);
    expect(opts.some((o) => o.task === GUARD)).toBe(false);
    expect(opts[0]).toMatchObject({ task: null, label: 'Mandar a descansar' });
    expect(opts.find((o) => o.task === roomOf(s, 'cocina').id)?.label).toBe('Trabaja en Cocina');
    expect(opts.find((o) => o.task === roomOf(s, 'bodega').id)?.label).toMatch(
      /^Poner a trabajar en Bodega · /,
    );
    expect(opts.find((o) => o.task === roomOf(s, 'cocina').id)?.why).toBeUndefined();
    const [a, b] = s.heroes;
    s = task(s, a!.id, roomOf(s, 'cocina').id);
    const full = taskOptions(s, b!.id).find((o) => o.task === roomOf(s, 'cocina').id)!;
    expect(full.label).toMatch(/llena/);
    expect(full.why).toMatch(/puestos/);
    expect(taskOptions(s, b!.id).find((o) => o.task === GUARD)?.label).toMatch(/2 libres/);
  });

  it('a un hueco libre se puede poner a quien está en casa y no está ya ahí', () => {
    const s = newGame('hueco');
    const cocina = roomOf(s, 'cocina').id;
    const who = candidatesFor(s, cocina).map((m) => m.id);
    expect(who).not.toContain(s.workers.find((w) => w.room === cocina)!.id);
    expect(who).toContain(s.heroes[0]!.id);
    // Los trabajadores no van a la guardia.
    expect(candidatesFor(s, GUARD).every((m) => m.hero)).toBe(true);
  });

  it('cada uno dice lo que pone en su sala, y quien entrena, cómo va', () => {
    let s = newGame('pone');
    const cocina = group(s, roomOf(s, 'cocina').id);
    // Remedios (Maña 4, en su oficio) en una cocina de nivel 1: 4 × 1,5 × 2 = 12 raciones.
    expect(cocina.people[0]!.gives).toBe('+12 raciones');
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
    const h = s.heroes[0]!;
    h.attrs.F = 2;
    s = task(s, h.id, 'arm');
    const m = group(s, 'arm').people[0]!;
    expect(m.sub).toBe('Fuerza 2');
    expect(m.progress).toBeGreaterThanOrEqual(0);
    expect(m.gives).toMatch(/Sube esta noche|Faltan unos \d+ días/);
    expect(m.more).toBeTruthy();
  });

  it('lo que pone cada uno suma lo que saca la sala', () => {
    let s = newGame('suma');
    const bodega = roomOf(s, 'bodega');
    s = task(s, s.heroes[0]!.id, bodega.id);
    const jarras = group(s, bodega.id).people.map((p) => Number(p.gives!.match(/\d+/)![0]));
    expect(jarras.reduce((a, b) => a + b, 0)).toBe(Math.round(brewAt(s, bodega)));
  });

  it('la tarea en dos palabras, para la lista de héroes y la escena', () => {
    let s = newGame('chapa');
    const [a, b] = s.heroes;
    expect(taskLabel(s, a!.id)).toBe('Descansa');
    s = task(s, a!.id, roomOf(s, 'salon').id);
    expect(taskLabel(s, a!.id)).toBe('En el salón');
    s = task(s, a!.id, GUARD);
    expect(taskLabel(s, a!.id)).toBe('De guardia');
    expect(taskLabel(s, s.workers.find((w) => w.trade === 'cocina')!.id)).toBe('En la cocina');
    s = reduce(s, { type: 'send', questId: s.quests[0]!.id, heroIds: [b!.id] });
    expect(taskLabel(s, b!.id)).toMatch(/^De misión/);
  });
});
