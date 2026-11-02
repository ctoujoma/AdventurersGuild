import { describe, expect, it } from 'vitest';
import { RECIPES } from '../data/recipes';
import { DAY_SECONDS, DRESS_GOLD } from './balance';
import { Rng } from './rng';
import { planBuild } from './rooms';
import {
  canCraft,
  canDress,
  canUndo,
  craftState,
  dressingOf,
  goodChance,
  knownRecipes,
  learnRecipe,
  undoable,
} from './crafting';
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
    expect(knownRecipes(s)).toEqual(['espada', 'coraza', 'ganzuas', 'botas', 'amuleto']);
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
    expect(t.incidentNews?.some((n) => /han creado/.test(n.t))).toBe(true);
  });

  it('con el juego cerrado sigue avanzando en las noches', () => {
    const { s, forge } = withForge('cerrado');
    let t = reduce(s, { type: 'craft', room: forge, recipe: 'coraza' });
    t = endDay(t, true);
    expect(t.crafts).toBeUndefined();
    expect(t.inventory.some((i) => i.icon === 'coraza')).toBe(true);
    expect(t.dawn.some((e) => /han creado/.test(e.t))).toBe(true);
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

/** Partida con un taller nuevo (sastrería o alquimia) a nivel 1, en un hueco de la planta baja. */
function withShop(seed: string, type: 'sastreria' | 'alquimia', trade = true) {
  const s = newGame(seed);
  const room = {
    id: `prueba-${type}`,
    type,
    col: s.building.cols,
    floor: 0,
    w: 1,
    h: 1,
    level: 1,
    spent: 0,
  };
  s.building.cols++;
  s.building.rooms.push(room);
  if (trade)
    s.workers.push({
      id: `w-${type}`,
      seed: type,
      name: 'Lía',
      sex: 'f',
      skill: 4,
      trade: type,
      xp: 0,
      salary: 5,
      fee: 0,
      room: room.id,
      quote: '',
    });
  s.gold = 500;
  return { s, room: room.id };
}

describe('la sastrería viste a los héroes', () => {
  it('cobra, lleva al héroe a la sala y al acabar estrena ropa con más moral', () => {
    const { s, room } = withShop('vestir', 'sastreria');
    const h = s.heroes.find((x) => x.status === 'ok')!;
    h.morale = 50;
    let t = reduce(s, {
      type: 'dressAt',
      room,
      heroId: h.id,
      dress: { dye: 'vino', garment: 'faja' },
    });
    expect(t.gold).toBe(s.gold - DRESS_GOLD);
    expect(dressingOf(t, h.id)?.room).toBe(room);
    t = endDay(t, true);
    const x = t.heroes.find((y) => y.id === h.id)!;
    expect(x.dress).toEqual({ dye: 'vino', garment: 'faja' });
    expect(x.morale).toBeGreaterThan(50);
    expect(t.dawn.some((e) => /estrena ropa/.test(e.t))).toBe(true);
  });

  it('solo con los tintes que se tienen, a uno en casa y no a quien ya va así', () => {
    const { s, room } = withShop('tintes', 'sastreria');
    const h = s.heroes.find((x) => x.status === 'ok')!;
    expect(canDress(s, room, h.id, { dye: 'mar' })).toMatch(/Aún no tenéis/);
    expect(canDress(s, room, h.id, {})).toMatch(/Ya va así/);
    expect(canDress({ ...s, unlocks: ['tint:mar'] }, room, h.id, { dye: 'mar' })).toBeNull();
    const away = structuredClone(s);
    away.heroes.find((x) => x.id === h.id)!.status = 'mision';
    expect(canDress(away, room, h.id, { dye: 'vino' })).toMatch(/no está en casa/);
  });

  it('crea botas de serie; en la alquimia, amuletos', () => {
    const a = withShop('botas', 'sastreria');
    expect(canCraft(a.s, a.room, 'botas')).toBeNull();
    expect(canCraft(a.s, a.room, 'espada')).toMatch(/no se hace/);
    const b = withShop('amuletos', 'alquimia');
    const t = endDay(reduce(b.s, { type: 'craft', room: b.room, recipe: 'amuleto' }), true);
    expect(t.inventory.some((i) => i.icon === 'amuleto')).toBe(true);
  });
});

describe('recetas como premio', () => {
  it('se aprende una que no se sabe, mejor de un taller que se tiene', () => {
    const { s } = withShop('premio', 'alquimia', false);
    // Hay forja (rota) y alquimia, pero no sastrería: la capa, no.
    for (let i = 0; i < 3; i++) {
      const id = learnRecipe(s, new Rng(`x${i}`))!;
      expect(['hacha', 'escudo', 'varita']).toContain(id);
      expect(knownRecipes(s)).toContain(id);
    }
    expect(learnRecipe(s, new Rng('z'))).toBe('capa');
    s.recipes = ['hacha', 'escudo', 'capa', 'varita'];
    expect(learnRecipe(s, new Rng('y'))).toBeNull();
  });
});

describe('quién viene a pedir trabajo', () => {
  it('con un taller sin nadie de su oficio, viene alguien de ese oficio', () => {
    const { s } = withShop('voz', 'alquimia', false);
    s.mode = 'libre';
    // Camas de sobra en el servicio para poder contratar.
    s.building.rooms.push({
      id: 'serv',
      type: 'servicio',
      col: s.building.cols,
      floor: 0,
      w: 3,
      h: 1,
      level: 3,
      spent: 0,
    });
    s.building.cols += 3;
    s.seekers = [];
    const t = endDay(s, true);
    expect(t.seekers.some((w) => w.trade === 'alquimia')).toBe(true);
  });

  it('las salas nuevas se abren con su rango', () => {
    const s = newGame('rango');
    s.mode = 'libre';
    const plan = planBuild(s, 'alquimia', 0, 3);
    expect('error' in plan && plan.error).toMatch(/rango/);
  });
});
