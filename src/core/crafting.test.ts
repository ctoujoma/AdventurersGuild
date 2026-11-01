import { describe, expect, it } from 'vitest';
import { RECIPES } from '../data/recipes';
import { DAY_SECONDS } from './balance';
import { canCraft, canUndo, craftState, goodChance, knownRecipes, undoable } from './crafting';
import { endDay, newGame, reduce } from './game';
import type { GameState, Worker } from './model';

/** Partida con la forja en uso (nivel `level`) y un herrero de Maña `skill` trabajando en ella. */
function withForge(seed: string, level = 1, skill = 4): { s: GameState; forge: string } {
  const s = newGame(seed);
  const forge = s.building.rooms.find((r) => r.type === 'forja')!;
  forge.level = level;
  delete forge.works;
  const smith: Worker = {
    id: 'w-herrero',
    seed: 'herrero',
    name: 'Brom',
    sex: 'm',
    skill,
    trade: 'forja',
    xp: 0,
    salary: 5,
    fee: 0,
    room: forge.id,
    quote: '',
  };
  s.workers.push(smith);
  s.gold = 500;
  return { s, forge: forge.id };
}

describe('la forja crea objetos', () => {
  it('se saben las recetas de serie y las demás no', () => {
    const s = newGame('recetas');
    expect(knownRecipes(s)).toEqual(['espada', 'coraza', 'ganzuas']);
  });

  it('crear cobra al empezar y deja el objeto en el arcón al acabar', () => {
    const { s, forge } = withForge('crear');
    const gold = s.gold;
    const inv = s.inventory.length;
    let t = reduce(s, { type: 'craft', room: forge, recipe: 'espada' });
    expect(t.gold).toBe(gold - RECIPES.espada.gold);
    expect(t.crafts).toHaveLength(1);
    // Con un herrero normal, la espada (8 h) tarda un tercio del día.
    expect(craftState(t, t.crafts![0]!).hoursLeft).toBeCloseTo(8, 5);
    t = reduce(t, { type: 'tick', to: DAY_SECONDS * 0.2 });
    expect(t.crafts).toHaveLength(1);
    const half = craftState(t, t.crafts![0]!);
    expect(half.frac).toBeGreaterThan(0.5);
    expect(half.frac).toBeLessThan(0.7);
    t = reduce(t, { type: 'tick', to: DAY_SECONDS * 0.34 });
    expect(t.crafts).toBeUndefined();
    expect(t.inventory).toHaveLength(inv + 1);
    const it = t.inventory.at(-1)!;
    expect([RECIPES.espada.common.name, RECIPES.espada.good.name]).toContain(it.name);
    expect(t.incidentNews?.some((n) => /forja ha creado/.test(n.t))).toBe(true);
  });

  it('con el juego cerrado sigue avanzando en las noches', () => {
    const { s, forge } = withForge('cerrado');
    let t = reduce(s, { type: 'craft', room: forge, recipe: 'coraza' });
    t = endDay(t, true);
    expect(t.crafts).toBeUndefined();
    expect(t.inventory.some((i) => i.icon === 'coraza')).toBe(true);
    expect(t.dawn.some((e) => /forja ha creado/.test(e.t))).toBe(true);
  });

  it('sin nadie en la sala se para; un héroe echa una mano, más despacio', () => {
    const { s, forge } = withForge('parado');
    s.workers = s.workers.filter((w) => w.trade !== 'forja');
    let t = reduce(s, { type: 'craft', room: forge, recipe: 'ganzuas' });
    expect(craftState(t, t.crafts![0]!).hoursLeft).toBeNull();
    t = reduce(t, { type: 'tick', to: DAY_SECONDS * 0.5 });
    expect(craftState(t, t.crafts![0]!).frac).toBe(0);
    const hero = t.heroes.find((h) => h.status === 'ok')!;
    t = reduce(t, { type: 'assign', who: hero.id, room: forge });
    const left = craftState(t, t.crafts![0]!).hoursLeft!;
    expect(left).toBeGreaterThan(RECIPES.ganzuas.hours);
  });

  it('un trabajo a la vez en nivel 1, dos con más nivel; sin oro o sin receta, no', () => {
    const { s, forge } = withForge('tope');
    const t = reduce(s, { type: 'craft', room: forge, recipe: 'espada' });
    expect(canCraft(t, forge, 'coraza')).toMatch(/mejora la sala/);
    expect(canCraft(s, forge, 'hacha')).toMatch(/Aún no/);
    expect(canCraft({ ...s, gold: 3 }, forge, 'espada')).toMatch(/faltan/);
    const big = withForge('tope3', 3);
    const u = reduce(big.s, { type: 'craft', room: big.forge, recipe: 'espada' });
    expect(canCraft(u, big.forge, 'coraza')).toBeNull();
  });

  it('cancelar devuelve el oro', () => {
    const { s, forge } = withForge('cancelar');
    const t = reduce(s, { type: 'craft', room: forge, recipe: 'espada' });
    const u = reduce(t, { type: 'cancelCraft', id: t.crafts![0]!.id });
    expect(u.gold).toBe(s.gold);
    expect(u.crafts).toBeUndefined();
  });

  it('sale bueno más a menudo con mejor herrero y más nivel, y nunca legendario', () => {
    const lo = withForge('q1', 1, 3);
    const hi = withForge('q2', 4, 9);
    expect(goodChance(hi.s, hi.forge)).toBeGreaterThan(goodChance(lo.s, lo.forge));
    let good = 0;
    for (let i = 0; i < 40; i++) {
      const { s, forge } = withForge(`muchas-${i}`, 4, 9);
      const t = endDay(reduce(s, { type: 'craft', room: forge, recipe: 'espada' }), true);
      const it = t.inventory.find((x) => x.icon === 'espada' && x.name.includes('templada'));
      if (it) good++;
      expect(t.inventory.every((x) => (x.rarity ?? 0) < 2 || !x.name.includes('casa'))).toBe(true);
    }
    expect(good).toBeGreaterThan(5);
    expect(good).toBeLessThan(35);
  });
});

describe('desmontar para sacar la receta', () => {
  const axe = (s: GameState) => {
    s.inventory.push({ ...RECIPES.hacha.good, name: 'Hacha vieja', id: 'i-hacha' });
  };

  it('solo se ofrecen los objetos que enseñan algo nuevo', () => {
    const { s, forge } = withForge('ofrece');
    axe(s);
    s.inventory.push({ ...RECIPES.espada.common, id: 'i-espada' });
    expect(undoable(s, forge).map((i) => i.id)).toEqual(['i-hacha']);
    expect(canUndo(s, forge, 'i-espada')).toMatch(/nada nuevo/);
  });

  it('el objeto se pierde; a veces sale la receta y entonces se puede crear', () => {
    let learned = 0;
    for (let i = 0; i < 20; i++) {
      const { s, forge } = withForge(`desmontar-${i}`, 2);
      axe(s);
      let t = reduce(s, { type: 'undoItem', room: forge, itemId: 'i-hacha' });
      expect(t.inventory.some((x) => x.id === 'i-hacha')).toBe(false);
      expect(undoable(t, forge)).toHaveLength(0);
      t = endDay(t, true);
      expect(t.crafts).toBeUndefined();
      expect(t.inventory.some((x) => x.id === 'i-hacha')).toBe(false);
      if (knownRecipes(t).includes('hacha')) {
        learned++;
        expect(canCraft(t, forge, 'hacha')).toBeNull();
      }
    }
    expect(learned).toBeGreaterThan(5);
    expect(learned).toBeLessThan(20);
  });

  it('cancelar devuelve el objeto', () => {
    const { s, forge } = withForge('devuelve');
    axe(s);
    const t = reduce(s, { type: 'undoItem', room: forge, itemId: 'i-hacha' });
    const u = reduce(t, { type: 'cancelCraft', id: t.crafts![0]!.id });
    expect(u.inventory.some((x) => x.id === 'i-hacha')).toBe(true);
  });
});
