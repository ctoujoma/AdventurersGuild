import { describe, expect, it } from 'vitest';
import { SCHEDULE } from './balance';
import { newGame, reduce } from './game';
import type { GameState } from './model';
import { STEPS, tutorialOn, tutorialStep } from './tutorial';

const at = (s: GameState) => tutorialStep(s)?.id;
const ok = (s: GameState) => reduce(s, { type: 'tutorial', op: 'ok' });

describe('tutorial guiado', () => {
  it('solo con la opción, y con un primer encargo fácil para los dos héroes', () => {
    expect(tutorialOn(newGame('sin'))).toBe(false);
    const s = newGame('con', { tutorial: true });
    expect(at(s)).toBe('hola');
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

  it('de principio a fin: encargo, contratar, enfermería, vuelta, ratas, rumor y pago', () => {
    let s = ok(newGame('entero', { tutorial: true }));
    expect(at(s)).toBe('tablon');
    const heroes = s.heroes.map((h) => h.id);
    s = reduce(s, { type: 'send', questId: s.tutorial!.quest!, heroIds: heroes });
    expect(at(s)).toBe('barra');
    s = { ...s, gold: s.gold + 200 };
    s = reduce(s, { type: 'hire', id: s.candidates[0]!.id });
    expect(at(s)).toBe('nombre');
    s = reduce(s, { type: 'renameHero', id: heroes[0]!, name: 'Brena' });
    expect(s.heroes[0]!.name).toBe('Brena');
    expect(at(s)).toBe('enfermeria');
    const enf = s.building.rooms.find((r) => r.type === 'enfermeria')!;
    s = reduce(s, { type: 'upgradeRoom', id: enf.id });
    expect(at(s)).toBe('mover');
    s = ok(s);
    expect(at(s)).toBe('esperar');
    s = reduce(s, { type: 'tutorial', op: 'vuelta' });
    expect(s.missions).toHaveLength(0);
    expect(at(s)).toBe('informe');
    s = reduce(s, { type: 'read', reportId: s.reports[0]!.id });
    // Equipo y herido, si los hay, con su botón.
    while (at(s) === 'equipo' || at(s) === 'herido') s = ok(s);
    expect(at(s)).toBe('ratas');
    const inc = s.incidents![0]!;
    for (let i = 0; i < 10 && s.incidents?.length; i++)
      s = reduce(s, { type: 'incident', id: inc.id, act: { by: 'tocar' } });
    expect(at(s)).toBe('rumor');
    s = reduce(s, { type: 'rumor' });
    expect(at(s)).toBe('mandar');
    s = ok(s);
    expect(at(s)).toBe('objetivos');
    s = ok(s);
    expect(at(s)).toBe('pago');
    s = reduce(s, { type: 'tutorial', op: 'pago' });
    expect(s.over).toBeNull();
    expect(s.paid).toBe(SCHEDULE[0]!.amount);
    expect(s.day).toBe(SCHEDULE[0]!.day);
    expect(at(s)).toBe('fin');
    s = ok(s);
    expect(tutorialOn(s)).toBe(false);
    expect(s.tutorial!.step).toBe(STEPS.length);
  });
});
