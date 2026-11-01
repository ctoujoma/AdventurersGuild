import { describe, expect, it } from 'vitest';
import { SCHEDULE } from './balance';
import { newGame, reduce } from './game';
import type { GameState } from './model';
import { salaries } from './game';
import {
  STEPS,
  firstDue,
  payReady,
  tutorialHero,
  tutorialOn,
  tutorialStep,
  tutorialWait,
} from './tutorial';

const at = (s: GameState) => tutorialStep(s)?.id;
const ok = (s: GameState) => reduce(s, { type: 'tutorial', op: 'ok' });
/** Acaba el respiro de antes del paso (lo que hace la interfaz al cabo de unos segundos). */
const go = (s: GameState) => (tutorialWait(s) ? reduce(s, { type: 'tutorial', op: 'listo' }) : s);

describe('tutorial guiado', () => {
  it('solo con la opción, y con un primer encargo fácil para los dos héroes', () => {
    expect(tutorialOn(newGame('sin'))).toBe(false);
    const s = newGame('con', { tutorial: true });
    expect(at(s)).toBe('casa');
    expect(at(ok(s))).toBe('dinero');
    expect(at(ok(ok(s)))).toBe('tablon');
    const q = s.quests.find((x) => x.id === s.tutorial!.quest)!;
    expect(q).toMatchObject({ days: 1, danger: 0, slots: 2 });
    expect(q.item).toBeDefined();
  });

  it('el reloj está parado mientras dura', () => {
    const s = newGame('reloj', { tutorial: true });
    expect(reduce(s, { type: 'tick', to: 100 })).toBe(s);
  });

  it('se puede saltar entero', () => {
    const s = reduce(newGame('saltar', { tutorial: true }), { type: 'tutorial', op: 'saltar' });
    expect(tutorialOn(s)).toBe(false);
    expect(s.tips).toContain('tablon');
  });

  it('las notas que piden algo no se pasan con el botón', () => {
    const s = ok(ok(newGame('boton', { tutorial: true })));
    expect(at(s)).toBe('tablon');
    expect(ok(s)).toBe(s);
  });

  it('de principio a fin: encargo, contratar, nombre, enfermería, mover, vuelta… y pago', () => {
    let s = newGame('entero', { tutorial: true });
    expect(s.dawn).toEqual([]);
    s = reduce(s, { type: 'tutorial', op: 'carta' });
    expect(s.tutorial!.letter).toBe(true);
    // Antes del tablón, la casa y de dónde sale el dinero.
    expect(at(s)).toBe('casa');
    s = ok(ok(s));
    expect(at(s)).toBe('tablon');
    const heroes = s.heroes.map((h) => h.id);
    s = reduce(s, { type: 'send', questId: s.tutorial!.quest!, heroIds: heroes });
    expect(at(s)).toBe('barra');
    s = go({ ...s, gold: s.gold + 200 });
    const hired = s.candidates[0]!.id;
    s = reduce(s, { type: 'hire', id: hired });
    expect(at(s)).toBe('nombre');
    // Dejar el nombre como estaba también vale.
    const name = s.heroes.find((h) => h.id === hired)!.name;
    s = reduce(s, { type: 'renameHero', id: hired, name });
    expect(at(s)).toBe('enfermeria');
    const enf = s.building.rooms.find((r) => r.type === 'enfermeria')!;
    s = go(reduce(s, { type: 'upgradeRoom', id: enf.id }));
    expect(at(s)).toBe('mover');
    const cocina = s.building.rooms.find((r) => r.type === 'cocina')!;
    const w = s.workers.find((x) => x.room !== cocina.id)!;
    s = reduce(s, { type: 'assign', who: w.id, room: cocina.id });
    expect(at(s)).toBe('esperar');
    s = reduce(s, { type: 'tutorial', op: 'vuelta' });
    expect(s.missions).toHaveLength(0);
    expect(at(s)).toBe('informe');
    s = reduce(s, { type: 'read', reportId: s.reports[0]!.id });
    if (at(s) === 'equipo') {
      const it = s.inventory.find((i) => i.kind !== 'tesoro')!;
      s = reduce(s, { type: 'equip', heroId: tutorialHero(s)!, itemId: it.id });
    }
    if (at(s) === 'herido') s = ok(s);
    expect(at(s)).toBe('ratas');
    // Primero el respiro: las ratas aún no han salido.
    expect(tutorialWait(s)).toBeGreaterThan(0);
    expect(s.incidents ?? []).toHaveLength(0);
    s = go(s);
    const inc = s.incidents![0]!;
    for (let i = 0; i < 10 && s.incidents?.length; i++)
      s = reduce(s, { type: 'incident', id: inc.id, act: { by: 'tocar' } });
    expect(at(s)).toBe('rumor');
    expect(s.rumor).toBeUndefined();
    s = reduce(go(s), { type: 'rumor' });
    if (at(s) === 'mandar') {
      const q = s.quests.find((x) => x.rumor)!;
      const home = s.heroes.filter((h) => h.status === 'ok').slice(0, q.slots);
      s = reduce(s, { type: 'send', questId: q.id, heroIds: home.map((h) => h.id) });
    }
    s = go(s);
    expect(at(s)).toBe('objetivos');
    s = ok(s);
    expect(at(s)).toBe('pago');
    // Al pago se salta con la caja lista; si no, noche a noche.
    for (let i = 0; i < 6 && !payReady(s); i++) s = reduce(s, { type: 'tutorial', op: 'noche' });
    s = reduce(s, { type: 'tutorial', op: 'pago' });
    expect(s.over).toBeNull();
    expect(s.paid).toBe(SCHEDULE[0]!.amount);
    expect(s.day).toBe(SCHEDULE[0]!.day);
    expect(at(s)).toBe('fin');
    s = ok(s);
    expect(tutorialOn(s)).toBe(false);
    expect(s.tutorial!.step).toBe(STEPS.length);
  });

  it('el respiro: sin acabar, el paso no cuenta ni se prepara', () => {
    let s = ok(ok(newGame('respiro', { tutorial: true })));
    s = reduce(s, {
      type: 'send',
      questId: s.tutorial!.quest!,
      heroIds: s.heroes.map((h) => h.id),
    });
    expect(at(s)).toBe('barra');
    expect(tutorialWait(s)).toBe(STEPS.find((x) => x.id === 'barra')!.pause);
    // Contratar en el respiro no pasa el paso hasta que acaba.
    s = reduce({ ...s, gold: s.gold + 200 }, { type: 'hire', id: s.candidates[0]!.id });
    expect(at(s)).toBe('barra');
    s = go(s);
    expect(tutorialWait(s)).toBe(0);
    expect(at(s)).toBe('nombre');
    expect(reduce(s, { type: 'tutorial', op: 'listo' })).toBe(s);
  });

  it('al pago no se salta sin la caja lista; noche a noche, y el tío pone lo que falte', () => {
    let s = newGame('caja', { tutorial: true });
    s = { ...s, tutorial: { ...s.tutorial!, step: STEPS.findIndex((x) => x.id === 'pago') } };
    s = { ...s, gold: 0 };
    expect(firstDue(s)).toBe(SCHEDULE[0]!.amount + salaries(s));
    expect(payReady(s)).toBe(false);
    expect(reduce(s, { type: 'tutorial', op: 'pago' })).toBe(s);
    const n = reduce(s, { type: 'tutorial', op: 'noche' });
    expect(n.day).toBe(s.day + 1);
    // La noche del pago, si no llega, pone el tío lo que falta.
    s = { ...s, day: SCHEDULE[0]!.day - 1 };
    s = reduce(s, { type: 'tutorial', op: 'noche' });
    expect(s.over).toBeNull();
    expect(s.paid).toBe(SCHEDULE[0]!.amount);
    expect(at(s)).toBe('fin');
  });
});
