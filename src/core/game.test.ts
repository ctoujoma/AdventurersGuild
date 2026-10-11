import { describe, expect, it } from 'vitest';
import { DAYS, SCHEDULE, capacity } from './balance';
import { canSend, endDay, newGame, reduce, roster, salaries } from './game';
import { generateHero, generateQuest } from './generate';
import type { GameState, Hero } from './model';
import { questEstimate, resolveMission } from './resolve';
import { Rng } from './rng';

const ready = (s: GameState) => s.heroes.filter((h) => h.status === 'ok');

/** Un héroe imbatible (o inútil) para forzar resultados. */
function champion(h: Hero, v: number): Hero {
  return { ...h, attrs: { F: v, D: v, M: v }, lvl: v === 10 ? 10 : 1, traits: [] };
}

describe('partida nueva', () => {
  it('es determinista por semilla y serializable', () => {
    const a = newGame('semilla');
    expect(newGame('semilla')).toEqual(a);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(newGame('otra')).not.toEqual(a);
  });

  it('empieza con héroes, candidatos y encargos', () => {
    const s = newGame('x');
    expect(s.heroes.length).toBe(2);
    expect(s.heroes[0]!.cls).toBe('guerrero');
    expect(s.candidates.length).toBe(3);
    expect(s.quests.length).toBeGreaterThanOrEqual(4);
    expect(s.day).toBe(1);
    expect(s.dawn.length).toBeGreaterThan(0);
  });
});

describe('generadores', () => {
  it('generan héroes válidos', () => {
    const rng = new Rng('h');
    for (let i = 0; i < 300; i++) {
      const h = generateHero(rng, `h${i}`, { rank: i % 5, tab: i % 4 });
      for (const v of Object.values(h.attrs)) expect(v).toBeGreaterThanOrEqual(1);
      for (const v of Object.values(h.attrs)) expect(v).toBeLessThanOrEqual(10);
      expect(h.traits).toHaveLength(2);
      expect(h.traits.filter((t) => t.hidden)).toHaveLength(1);
      expect(h.traits[0]!.id).not.toBe(h.traits[1]!.id);
      expect(h.fee).toBeGreaterThan(0);
      expect(h.salary).toBeGreaterThan(0);
    }
  });

  it('generan encargos válidos', () => {
    const rng = new Rng('q');
    for (let i = 0; i < 300; i++) {
      const q = generateQuest(rng, `q${i}`, i % 5, `i${i}`);
      expect(q.slots).toBeGreaterThanOrEqual(1);
      expect(q.slots).toBeLessThanOrEqual(4);
      expect(q.challenges.length).toBeGreaterThanOrEqual(1);
      expect(q.challenges.length).toBeLessThanOrEqual(3);
      for (const c of q.challenges) expect(c.diff).toBeGreaterThan(0);
      expect(q.reward).toBeGreaterThan(0);
      expect(q.days).toBeGreaterThanOrEqual(1);
      expect(q.title).not.toMatch(/[{}]/);
      expect(q.text).not.toMatch(/[{}]/);
    }
  });
});

describe('acciones', () => {
  it('no mutan el estado recibido', () => {
    const s = newGame('pura');
    const before = JSON.stringify(s);
    const c = s.candidates[0]!;
    reduce({ ...s, gold: 999 }, { type: 'hire', id: c.id });
    reduce(s, { type: 'endDay' });
    reduce(s, { type: 'send', questId: s.quests[0]!.id, heroIds: [s.heroes[0]!.id] });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('contratar cobra la prima y respeta las camas', () => {
    let s = { ...newGame('fichar'), gold: 5000 };
    const c = s.candidates[0]!;
    s = reduce(s, { type: 'hire', id: c.id });
    expect(s.gold).toBe(5000 - c.fee);
    expect(s.heroes.some((h) => h.id === c.id)).toBe(true);
    expect(s.candidates.some((h) => h.id === c.id)).toBe(false);
    // Llenar hasta la capacidad: el siguiente no entra.
    while (s.candidates.length && roster(s).length < capacity(s.fac.dorm))
      s = reduce(s, { type: 'hire', id: s.candidates[0]!.id });
    if (s.candidates.length) {
      const after = reduce(s, { type: 'hire', id: s.candidates[0]!.id });
      expect(after).toBe(s);
    }
  });

  it('sin dinero no se contrata', () => {
    const s = { ...newGame('pobre'), gold: 0 };
    expect(reduce(s, { type: 'hire', id: s.candidates[0]!.id })).toBe(s);
  });

  it('enviar saca la nota del tablón y manda al grupo', () => {
    let s = newGame('enviar');
    const q = s.quests.find((x) => x.slots >= 1)!;
    const h = ready(s)[0]!;
    s = reduce(s, { type: 'send', questId: q.id, heroIds: [h.id] });
    expect(s.quests.some((x) => x.id === q.id)).toBe(false);
    expect(s.heroes.find((x) => x.id === h.id)!.status).toBe('mision');
    expect(s.missions).toHaveLength(1);
    // Ya no está disponible para otro encargo.
    expect(canSend(s, s.quests[0]!.id, [h.id])).not.toBeNull();
  });

  it('un arrogante no va con héroes de menor nivel', () => {
    const s = newGame('orgullo');
    const [a, b] = s.heroes;
    a!.traits = [{ id: 'arrogante' }];
    a!.lvl = 3;
    b!.lvl = 1;
    const q = { ...s.quests[0]!, slots: 2 };
    s.quests[0] = q;
    expect(canSend(s, q.id, [a!.id, b!.id])).toMatch(/no va con/);
  });

  it('mejorar cuesta oro y sube el nivel', () => {
    const s = { ...newGame('obra'), gold: 1000 };
    const up = reduce(s, { type: 'upgrade', fac: 'enf' });
    expect(up.fac.enf).toBe(s.fac.enf + 1);
    expect(up.gold).toBeLessThan(1000);
  });
});

describe('resolución', () => {
  it('un grupo imbatible triunfa y uno inútil fracasa', () => {
    const s = newGame('dados');
    const q = { ...s.quests[0]!, twist: undefined, danger: 0 as const };
    const strong = structuredClone(s);
    strong.heroes = strong.heroes.map((h) => champion(h, 10));
    const r1 = resolveMission(
      strong,
      { id: 'm', quest: q, heroIds: strong.heroes.map((h) => h.id), daysLeft: 0 },
      new Rng(1),
    );
    expect(r1.outcome).toMatch(/Éxito/);
    expect(strong.gold).toBeGreaterThan(s.gold);

    const weak = structuredClone(s);
    weak.heroes = weak.heroes.map((h) => champion(h, 1));
    const hard = { ...q, challenges: [{ skill: 'Combate' as const, diff: 40 }] };
    let fails = 0;
    for (let i = 0; i < 20; i++) {
      const w = structuredClone(weak);
      const r = resolveMission(
        w,
        { id: 'm', quest: hard, heroIds: w.heroes.map((h) => h.id), daysLeft: 0 },
        new Rng(i),
      );
      if (r.outcome === 'Fracaso' || r.outcome === 'Desastre') fails++;
    }
    expect(fails).toBeGreaterThanOrEqual(16);
  });

  it('el informe tiene texto sin huecos y descubre rasgos ocultos', () => {
    const s = newGame('informe');
    const h = s.heroes[1]!;
    const r = resolveMission(
      s,
      { id: 'm', quest: s.quests[0]!, heroIds: [h.id], daysLeft: 0 },
      new Rng(7),
    );
    expect(r.body.length).toBeGreaterThan(2);
    for (const p of r.body) expect(p).not.toMatch(/[{}]/);
    if (h.status !== 'muerto' && h.status !== 'desaparecido')
      expect(h.traits.every((t) => !t.hidden)).toBe(true);
  });

  it('un mago descubre el giro oculto en la estimación', () => {
    const s = newGame('giro');
    const q = { ...s.quests[0]!, twist: 'Trampa' };
    const mage = { cls: 'mago' as const, lvl: 1, attrs: { F: 3, D: 3, M: 8 }, traits: [] };
    const plain = { ...mage, cls: 'guerrero' as const };
    expect(questEstimate(q, [mage]).reveal).toBe(true);
    expect(questEstimate(q, [plain]).reveal).toBe(false);
    expect(questEstimate(q, [mage]).rows[0]!.diff).toBe(q.challenges[0]!.diff + 3);
  });
});

describe('avance de día', () => {
  it('los grupos vuelven con informe cuando acaba la misión', () => {
    let s = newGame('vuelta');
    const q = s.quests[0]!;
    const h = ready(s)[0]!;
    s = reduce(s, { type: 'send', questId: q.id, heroIds: [h.id] });
    for (let d = 0; d < q.days; d++) s = endDay(s);
    expect(s.missions).toHaveLength(0);
    expect(s.reports).toHaveLength(1);
    expect(s.reports[0]!.heroIds).toEqual([h.id]);
    expect(s.heroes.find((x) => x.id === h.id)!.status).not.toBe('mision');
  });

  it('rellena el tablón y es determinista', () => {
    const a = endDay(newGame('d'));
    expect(endDay(newGame('d'))).toEqual(a);
    expect(a.day).toBe(2);
    expect(a.quests.length).toBeGreaterThanOrEqual(4);
    expect(a.dawn.length).toBeGreaterThan(0);
  });

  it('cobra salarios y deuda el día de pago', () => {
    let s = { ...newGame('pago'), gold: 5000 };
    const first = SCHEDULE[0]!;
    while (s.day < first.day - 1) s = endDay(s);
    const wages = salaries(s);
    const gold = s.gold;
    s = endDay(s);
    expect(s.paid).toBe(first.amount);
    // La taberna cobra antes de pagar; puede volver alguien con oro, así que basta con la cota.
    expect(s.gold).toBeLessThanOrEqual(gold + 200 - wages - first.amount + 400);
    expect(s.over).toBeNull();
  });

  it('sin dinero el día de pago se pierde la partida', () => {
    let s = { ...newGame('ruina'), gold: 0 };
    s.fac = { ...s.fac, tab: 0 };
    while (!s.over) s = endDay({ ...s, gold: 0 });
    expect(s.over!.kind).toBe('derrota');
    expect(s.day).toBe(SCHEDULE[0]!.day);
    // Ya no se puede jugar.
    expect(endDay(s)).toBe(s);
  });

  it('pagando todo, el gremio es tuyo y empieza el modo libre', () => {
    let s = newGame('victoria');
    while (s.mode !== 'libre' && !s.over) s = endDay({ ...s, gold: s.gold + 1000 });
    expect(s.over).toBeNull();
    expect(s.day).toBe(DAYS + 1);
    expect(s.opening?.seen).toBe(false);
    expect(s.opening!.score).toBeGreaterThan(0);
    expect(s.month?.goals.length).toBeGreaterThan(0);
    s = reduce(s, { type: 'ackOpening' });
    expect(s.opening?.seen).toBe(true);
    // Y la partida sigue: los salarios se pagan cada semana.
    for (let i = 0; i < 10; i++) s = endDay({ ...s, gold: s.gold + 500 });
    expect(s.over).toBeNull();
  });

  it('en modo libre, dos semanas sin pagar salarios es la quiebra', () => {
    let s = newGame('quiebra');
    while (s.mode !== 'libre' && !s.over) s = endDay({ ...s, gold: s.gold + 1000 });
    for (let i = 0; i < 20 && !s.over; i++) s = endDay({ ...s, gold: 0 });
    expect(s.over?.kind).toBe('derrota');
  });
});
