import { describe, expect, it } from 'vitest';
import { RECIPES } from '../data/recipes';
import { DAY_SECONDS, DRESS_GOLD, DRESS_WALK, WORK_END, WORK_START } from './balance';
import { POTION_CAP, POTION_GOLD, POTION_HERBS } from './balance';
import { Rng } from './rng';
import { planBuild } from './rooms';
import {
  canCraft,
  canDress,
  canTemper,
  temperCost,
  dressStatus,
  canUndo,
  craftState,
  dressingOf,
  crafted,
  goodChance,
  qualityOdds,
  knownRecipes,
  learnRecipe,
  stepCrafts as stepRaw,
  collectCraft,
  readyCrafts,
  undoable,
  clockHours,
  canPotion,
  potionCap,
} from './crafting';
import { endDay as endRaw, newGame, reduce as reduceRaw, type Action } from './game';
import type { DawnEvent, GameState, Worker } from './model';

/**
 * Lo acabado espera en su taller hasta que se recoge (`collectCraft`): aquí, para ver qué sale,
 * se recoge en cuanto está listo.
 */
function pick<T extends GameState>(s: T): T {
  if (!readyCrafts(s).length) return s;
  const x = structuredClone(s);
  for (const c of readyCrafts(x)) collectCraft(x, c.id);
  return x;
}
const endDay = (s: GameState, away?: boolean) => pick(endRaw(s, away));
const reduce = (s: GameState, a: Action) => pick(reduceRaw(s, a));
function stepCrafts(s: GameState, ...a: [number, Rng?, boolean?]): DawnEvent[] {
  const news = stepRaw(s, ...a);
  for (const c of readyCrafts(s)) news.push(...collectCraft(s, c.id));
  return news;
}
import { tx } from '../textos';

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
    expect(knownRecipes(s)).toEqual([
      'espada',
      'coraza',
      'ganzuas',
      'botas',
      'amuleto',
      'espadaLarga',
      'cota',
      'escudoTachonado',
      'ganzuasTempladas',
      'botasCuero',
      'capaForrada',
      'hachaRoble',
      'amuletoHierbas',
      'varitaCristal',
    ]);
  });

  it('crear cobra al empezar y deja el objeto en el arcón al acabar', () => {
    const { s, forge } = withForge('crear');
    const gold = s.gold;
    const inv = s.inventory.length;
    let t = reduce(s, { type: 'craft', room: forge, recipe: 'espada' });
    expect(t.gold).toBe(gold - RECIPES.espada.gold);
    expect(t.crafts).toHaveLength(1);
    // Con un herrero normal, la espada (8 h de trabajo) es un tercio de la jornada.
    expect(craftState(t, t.crafts![0]!).hoursLeft).toBeCloseTo(clockHours(8), 5);
    t = reduce(t, { type: 'tick', to: DAY_SECONDS * 0.2 });
    expect(t.crafts).toHaveLength(1);
    const half = craftState(t, t.crafts![0]!);
    expect(half.frac).toBeGreaterThan(0.5);
    expect(half.frac).toBeLessThan(0.7);
    t = reduce(t, { type: 'tick', to: DAY_SECONDS * 0.34 });
    expect(t.crafts).toBeUndefined();
    expect(t.inventory).toHaveLength(inv + 1);
    const it = t.inventory.at(-1)!;
    expect([RECIPES.espada.common.name, RECIPES.espada.good.name].map(tx)).toContain(tx(it.name));
    expect(t.incidentNews?.some((n) => /han acabado/.test(tx(n.t)))).toBe(true);
  });

  it('solo se trabaja en la jornada: de noche se para y a la mañana sigue', () => {
    const { s, forge } = withForge('jornada');
    // Solo un héroe echando una mano: va despacio y dura más de un día.
    s.workers = s.workers.filter((w) => w.trade !== 'forja');
    const hero = s.heroes.find((h) => h.status === 'ok')!;
    let t = reduce(s, { type: 'assign', who: hero.id, room: forge });
    t = reduce(t, { type: 'arrived', heroId: hero.id, room: forge });
    t = reduce(t, { type: 'craft', room: forge, recipe: 'coraza' });
    // A media tarde ya va algo; pasada la hora de dormir, ya no avanza más.
    t = reduce(t, { type: 'tick', to: DAY_SECONDS * WORK_END });
    const atDusk = craftState(t, t.crafts![0]!).frac;
    expect(atDusk).toBeGreaterThan(0);
    t = reduce(t, { type: 'tick', to: DAY_SECONDS * 0.99 });
    expect(craftState(t, t.crafts![0]!).frac).toBeCloseTo(atDusk, 5);
    // Al día siguiente, antes de que lleguen tampoco; luego, sigue donde lo dejó.
    t = endDay(t);
    expect(craftState(t, t.crafts![0]!).frac).toBeCloseTo(atDusk, 5);
    t = reduce(t, { type: 'tick', to: DAY_SECONDS * WORK_START * 0.9 });
    expect(craftState(t, t.crafts![0]!).frac).toBeCloseTo(atDusk, 5);
    // Ya en la jornada, mientras no llega a la forja (lo dice la escena), tampoco.
    t = reduce(t, { type: 'tick', to: DAY_SECONDS * 0.2 });
    expect(craftState(t, t.crafts![0]!).frac).toBeCloseTo(atDusk, 5);
    t = reduce(t, { type: 'arrived', heroId: hero.id, room: forge });
    t = reduce(t, { type: 'tick', to: DAY_SECONDS * 0.3 });
    // (Si ya ha acabado, también ha seguido.)
    const c = t.crafts?.[0];
    expect(c ? craftState(t, c).frac : 1).toBeGreaterThan(atDusk);
  });

  it('a quien se manda a vestir a última hora le esperan a la mañana siguiente', () => {
    const { s, room } = withShop('tarde', 'sastreria');
    const h = s.heroes.find((x) => x.status === 'ok')!;
    s.clock = DAY_SECONDS * 0.79;
    let t = reduce(s, { type: 'dressAt', room, heroId: h.id, dress: { dye: 'vino' } });
    t = endDay(t);
    // Por la noche no se ha dado por llegado: sigue esperando y sin coser.
    const c = dressingOf(t, h.id)!;
    expect(c.wait).toBe(true);
    expect(c.done).toBe(0);
    // Por la mañana va a la sastrería; al llegar, se cose.
    const now = { ...t, clock: DAY_SECONDS * 0.1 };
    const a = reduce(now, { type: 'arrived', heroId: h.id, room });
    expect(dressingOf(a, h.id)!.wait).toBeUndefined();
  });

  it('con el juego cerrado sigue avanzando en las noches', () => {
    const { s, forge } = withForge('cerrado');
    let t = reduce(s, { type: 'craft', room: forge, recipe: 'coraza' });
    t = endDay(t, true);
    expect(t.crafts).toBeUndefined();
    expect(t.inventory.some((i) => i.icon === 'coraza')).toBe(true);
    expect(t.dawn.some((e) => /han acabado/.test(tx(e.t)))).toBe(true);
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
    // Va de camino: hasta que llega, sigue parado.
    expect(craftState(t, t.crafts![0]!).hoursLeft).toBeNull();
    t = reduce(t, { type: 'arrived', heroId: hero.id, room: forge });
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

  it('con más nivel o más ancho, más sitios: lo de más espera en cola y empieza solo', () => {
    const { s, forge } = withForge('cola', 2);
    let t = reduceRaw(s, { type: 'craft', room: forge, recipe: 'espada' });
    expect(canCraft(t, forge, 'ganzuas')).toBeNull();
    t = reduceRaw(t, { type: 'craft', room: forge, recipe: 'ganzuas' });
    // Nivel 2: dos sitios y un puesto. La segunda espera (pagada) y no avanza.
    expect(canCraft(t, forge, 'espada')).toMatch(/a tope/);
    const [a, b] = t.crafts!;
    expect(craftState(t, b!).queued).toBe(true);
    t = reduceRaw(t, { type: 'tick', to: DAY_SECONDS * 0.2 });
    expect(craftState(t, t.crafts![1]!).frac).toBe(0);
    // Acaba la espada (sin recoger): las ganzúas empiezan solas y acaban el mismo día.
    t = reduceRaw(t, { type: 'tick', to: DAY_SECONDS * 0.8 });
    expect(t.crafts!.find((c) => c.id === a!.id)!.ready).toBe(true);
    expect(t.crafts!.find((c) => c.id === b!.id)!.ready).toBe(true);
    // Lo acabado sin recoger ocupa su sitio.
    expect(canCraft(t, forge, 'espada')).toMatch(/a tope/);
    const wide = withForge('ancha', 1);
    wide.s.building.rooms.find((r) => r.id === wide.forge)!.w = 2;
    const w = reduceRaw(wide.s, { type: 'craft', room: wide.forge, recipe: 'espada' });
    expect(canCraft(w, wide.forge, 'ganzuas')).toBeNull();
  });

  it('con el juego cerrado, lo de la cola se hace en la misma noche', () => {
    const { s, forge } = withForge('cola-cerrado', 2);
    let t = reduceRaw(s, { type: 'craft', room: forge, recipe: 'espada' });
    t = reduceRaw(t, { type: 'craft', room: forge, recipe: 'ganzuas' });
    t = endRaw(t, true);
    expect(readyCrafts(t)).toHaveLength(2);
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
      const it = t.inventory.find((x) => x.icon === 'espada' && tx(x.name).includes('templada'));
      if (it) good++;
      expect(t.inventory.every((x) => (x.rarity ?? 0) < 2 || !tx(x.name).includes('casa'))).toBe(
        true,
      );
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
    expect(t.stats?.dressed).toBe(1);
    expect(t.dawn.some((e) => /estrena ropa/.test(tx(e.t)))).toBe(true);
  });

  it('con el juego abierto no se cose hasta que llega; cerrado, a sus horas de camino', () => {
    const { s, room } = withShop('camino', 'sastreria');
    const h = s.heroes.find((x) => x.status === 'ok')!;
    s.clock = DAY_SECONDS * 0.3;
    const t = reduce(s, { type: 'dressAt', room, heroId: h.id, dress: { dye: 'vino' } });
    const c = dressingOf(t, h.id)!;
    expect(craftState(t, c).walking).toBe(true);
    // Pasadas las horas de camino y más, sin llegar no se cose nada.
    const later = { ...t, clock: t.clock! + DAY_SECONDS * ((DRESS_WALK + 3) / 24) };
    stepCrafts(later, later.clock! / DAY_SECONDS);
    const mid = dressingOf(later, h.id)!;
    expect(mid.done).toBe(0);
    expect(craftState(later, mid).walking).toBe(true);
    // Pasa la noche sin llegar: se le sigue esperando.
    expect(dressingOf(endDay(later), h.id)?.wait).toBe(true);
    // Con el juego cerrado (sin escena), se le da por llegado y se cose.
    const away = { ...t, clock: t.clock! + DAY_SECONDS * ((DRESS_WALK + 1) / 24) };
    stepCrafts(away, away.clock! / DAY_SECONDS, undefined, true);
    expect(dressingOf(away, h.id)!.done).toBeGreaterThan(0);
  });

  it('se empieza a coser en cuanto la escena dice que el héroe ha llegado', () => {
    const { s, room } = withShop('llega', 'sastreria');
    const h = s.heroes.find((x) => x.status === 'ok')!;
    s.clock = DAY_SECONDS * 0.3;
    const t = reduce(s, { type: 'dressAt', room, heroId: h.id, dress: { dye: 'vino' } });
    // Llegar a otra sala no cuenta.
    expect(reduce(t, { type: 'arrived', heroId: h.id, room: 'otra' })).toBe(t);
    const soon = { ...t, clock: t.clock! + DAY_SECONDS * (0.2 / 24) };
    const a = reduce(soon, { type: 'arrived', heroId: h.id, room });
    expect(craftState(a, dressingOf(a, h.id)!).walking).toBe(false);
    const later = { ...a, clock: a.clock! + DAY_SECONDS * (0.3 / 24) };
    stepCrafts(later, later.clock! / DAY_SECONDS);
    expect(dressingOf(later, h.id)!.done).toBeGreaterThan(0);
    // Avisar otra vez no cambia nada.
    expect(reduce(a, { type: 'arrived', heroId: h.id, room })).toBe(a);
  });

  it('de misión queda en pausa; al volver tiene que ir otra vez a la sastrería', () => {
    const { s, room } = withShop('pausa', 'sastreria');
    const h = s.heroes.find((x) => x.status === 'ok')!;
    s.clock = DAY_SECONDS * 0.3;
    let t = reduce(s, { type: 'dressAt', room, heroId: h.id, dress: { dye: 'vino' } });
    t = reduce(t, { type: 'arrived', heroId: h.id, room });
    t = { ...t, clock: t.clock! + DAY_SECONDS * (1 / 24) };
    stepCrafts(t, t.clock! / DAY_SECONDS);
    const done = dressingOf(t, h.id)!.done;
    expect(done).toBeGreaterThan(0);
    // Se va de misión: no se cose y, cuando vuelva, le esperan otra vez.
    t.heroes = t.heroes.map((x) => (x.id === h.id ? { ...x, status: 'mision', days: 2 } : x));
    t = { ...t, clock: t.clock! + DAY_SECONDS * (3 / 24) };
    stepCrafts(t, t.clock! / DAY_SECONDS);
    expect(dressingOf(t, h.id)).toMatchObject({ done, wait: true });
    // Vuelve: hasta que llega, nada; al llegar, sigue donde lo dejó.
    t.heroes = t.heroes.map((x) => (x.id === h.id ? { ...x, status: 'ok', days: 0 } : x));
    t = { ...t, clock: t.clock! + DAY_SECONDS * (1 / 24) };
    stepCrafts(t, t.clock! / DAY_SECONDS);
    expect(dressingOf(t, h.id)!.done).toBe(done);
    t = reduce(t, { type: 'arrived', heroId: h.id, room });
    t = { ...t, clock: t.clock! + DAY_SECONDS * (1 / 24) };
    stepCrafts(t, t.clock! / DAY_SECONDS);
    expect(dressingOf(t, h.id)!.done).toBeGreaterThan(done);
  });

  it('si el héroe ya no está en el gremio, se cancela y se devuelve el oro', () => {
    for (const gone of ['muerto', 'desaparecido', 'despedido'] as const) {
      const { s, room } = withShop(`fuera-${gone}`, 'sastreria');
      const h = s.heroes.find((x) => x.status === 'ok')!;
      s.clock = DAY_SECONDS * 0.3;
      const t = reduce(s, { type: 'dressAt', room, heroId: h.id, dress: { dye: 'vino' } });
      t.heroes =
        gone === 'despedido'
          ? t.heroes.filter((x) => x.id !== h.id)
          : t.heroes.map((x) => (x.id === h.id ? { ...x, status: gone } : x));
      const news = stepCrafts(t, 0.4);
      expect(dressingOf(t, h.id)).toBeUndefined();
      expect(t.gold).toBe(s.gold);
      expect(news.some((n) => /devuelve/.test(tx(n.t)))).toBe(true);
    }
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

  it('la ficha sabe cómo está cada opción: libre, bloqueada, sin dinero u ocupada', () => {
    const { s, room } = withShop('ficha', 'sastreria');
    const [h, o] = s.heroes.filter((x) => x.status === 'ok');
    expect(dressStatus(s, h!.id, { dye: 'vino' })).toEqual({ state: 'ok', room, cost: DRESS_GOLD });
    expect(dressStatus(s, h!.id, {}).state).toBe('same');
    expect(dressStatus(s, h!.id, { dye: 'mar' })).toMatchObject({ state: 'lock' });
    expect(dressStatus({ ...s, gold: 3 }, h!.id, { dye: 'vino' })).toMatchObject({
      state: 'gold',
      why: `Te faltan ${DRESS_GOLD - 3} monedas.`,
    });
    const sin = {
      ...s,
      building: { ...s.building, rooms: s.building.rooms.filter((r) => r.id !== room) },
    };
    expect(dressStatus(sin, h!.id, { dye: 'vino' }).state).toBe('none');
    const t = reduce(s, { type: 'dressAt', room, heroId: h!.id, dress: { dye: 'vino' } });
    expect(dressStatus(t, h!.id, { dye: 'bosque' }).state).toBe('sewing');
    const busy = dressStatus(t, o!.id, { dye: 'vino' });
    expect(busy).toMatchObject({ state: 'busy', room });
    expect(busy.state === 'busy' && busy.why).toMatch(new RegExp(`está con ${h!.name}`));
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

describe('cómo acaba cada trabajo (para la escena)', () => {
  it('se apunta si se hizo (con su rareza), si se canceló o qué salió al desmontar', () => {
    const { s, forge } = withForge('final', 3);
    let t = reduce(s, { type: 'craft', room: forge, recipe: 'espada' });
    const made = t.crafts![0]!.id;
    t = reduce(t, { type: 'craft', room: forge, recipe: 'coraza' });
    const gone = t.crafts![1]!.id;
    t = reduce(t, { type: 'cancelCraft', id: gone });
    expect(t.craftLog?.find((e) => e.id === gone)?.how).toBe('cancelado');
    t = endDay(t, true);
    const end = t.craftLog!.find((e) => e.id === made)!;
    expect(end.how).toBe('hecho');
    const it = t.inventory.find((i) => i.icon === 'espada')!;
    expect(end.rarity).toBe(it.rarity);
    // Desmontar: receta o nada.
    t.inventory.push({ ...RECIPES.hacha.good, id: 'i-h' });
    t = reduce(t, { type: 'undoItem', room: forge, itemId: 'i-h' });
    const undo = t.crafts![0]!.id;
    t = endDay(t, true);
    expect(['receta', 'nada']).toContain(t.craftLog?.find((e) => e.id === undo)?.how);
    expect(t.craftLog!.length).toBeLessThanOrEqual(8);
  });
});

describe('materiales en los talleres', () => {
  it('las recetas buenas piden materiales: sin ellos no se empieza y se dice de dónde salen', () => {
    const { s, forge } = withForge('materiales');
    expect(canCraft(s, forge, 'espadaLarga')).toMatch(/Faltan 2 de hierro: sale limpiando/);
    s.mats = { hierro: 3 };
    expect(canCraft(s, forge, 'espadaLarga')).toBeNull();
    const t = reduce(s, { type: 'craft', room: forge, recipe: 'espadaLarga' });
    expect(t.mats?.hierro).toBe(1);
    // Al cancelar, vuelven.
    const back = reduce(t, { type: 'cancelCraft', id: t.crafts![0]!.id });
    expect(back.mats?.hierro).toBe(3);
    expect(back.gold).toBe(s.gold);
  });

  it('mejorar un objeto: +1 cada vez hasta +3, con oro y su material, en su taller', () => {
    const { s, forge } = withForge('mejorar');
    s.inventory.push({
      id: 'esp',
      name: 'Espada de la casa',
      desc: '',
      value: 20,
      kind: 'arma',
      icon: 'espada',
      bonus: { Combate: 1 },
    });
    expect(canTemper(s, forge, 'esp')).toMatch(/Falta 1 de hierro/);
    s.mats = { hierro: 10 };
    expect(temperCost(s.inventory.at(-1)!)).toMatchObject({
      room: 'forja',
      to: 1,
      mats: { hierro: 1 },
    });
    let t = reduce(s, { type: 'temper', room: forge, itemId: 'esp' });
    expect(t.inventory.some((i) => i.id === 'esp')).toBe(false);
    expect(t.mats?.hierro).toBe(9);
    t = endDay(t, true);
    const it = t.inventory.find((i) => i.id === 'esp')!;
    expect(it.plus).toBe(1);
    expect(t.dawn.some((e) => /han acabado/.test(tx(e.t)))).toBe(true);
    // A +3, la obra maestra pide cristal; a +4, ya no hay más.
    expect(temperCost({ ...it, plus: 3 })).toMatchObject({
      to: 4,
      mats: { hierro: 4, cristal: 1 },
    });
    expect(temperCost({ ...it, plus: 4 })).toBeNull();
    // Las botas se mejoran en la sastrería, no en la forja.
    s.inventory.push({
      id: 'bot',
      name: 'Botas',
      desc: '',
      value: 10,
      kind: 'herramienta',
      icon: 'botas',
      bonus: { Supervivencia: 1 },
    });
    expect(canTemper(s, forge, 'bot')).toMatch(/otro taller/);
  });
});

describe('el nivel del taller da la calidad', () => {
  it('a más nivel, más bueno y más raro; sin artesano, la mitad', () => {
    const lo = withForge('cal-1', 1);
    const hi = withForge('cal-3', 3);
    const a = qualityOdds(lo.s, lo.forge);
    const b = qualityOdds(hi.s, hi.forge);
    expect(a.comun + a.bueno + a.raro).toBeCloseTo(1, 9);
    expect(b.raro).toBeGreaterThan(a.raro);
    expect(b.bueno).toBeGreaterThan(a.bueno);
    expect(b.comun).toBeLessThan(a.comun);
    const alone = { ...hi.s, workers: [] };
    expect(qualityOdds(alone, hi.forge).raro).toBeCloseTo(b.raro / 2, 9);
    // Un artesano mañoso pasa algo de común a raro.
    const pro = withForge('cal-pro', 3, 9);
    expect(qualityOdds(pro.s, pro.forge).raro).toBeGreaterThan(b.raro);
  });

  it('lo bueno es lo común con +1 y en verde; lo raro, la receta buena', () => {
    const rc = RECIPES.espada;
    expect(crafted(rc, 'comun')).toEqual(rc.common);
    expect(crafted(rc, 'bueno')).toMatchObject({ name: rc.common.name, rarity: 1, plus: 1 });
    expect(crafted(rc, 'raro')).toEqual(rc.good);
  });
});

describe('pociones en la alquimia', () => {
  it('preparar una poción gasta oro y hierbas, y al acabar suben las pociones', () => {
    const { s, room } = withShop('pocion', 'alquimia');
    s.mats = { ...s.mats, hierbas: POTION_HERBS };
    expect(potionCap(s)).toBe(POTION_CAP[1]);
    expect(canPotion(s, room)).toBeNull();
    const a = reduce(s, { type: 'potion', room });
    expect(a.gold).toBe(s.gold - POTION_GOLD);
    expect(a.mats?.hierbas ?? 0).toBe(0);
    expect(a.crafts?.some((c) => c.potion)).toBe(true);
    // En dos noches está de sobra (unas 6 h de taller).
    const b = endDay(endDay(a, true), true);
    expect(b.crafts?.some((c) => c.potion) ?? false).toBe(false);
    expect(b.potions ?? 0).toBeGreaterThanOrEqual(1);
    expect(b.potions ?? 0).toBeLessThanOrEqual(2);
  });

  it('sin hierbas o con las pociones a tope, no se puede', () => {
    const { s, room } = withShop('sin-hierbas', 'alquimia');
    s.mats = { ...s.mats, hierbas: 0 };
    expect(canPotion(s, room)).toMatch(/hierba/i);
    s.mats = { ...s.mats, hierbas: 10 };
    s.potions = POTION_CAP[1];
    expect(canPotion(s, room)).toMatch(/no caben/);
    expect(reduce(s, { type: 'potion', room })).toBe(s);
    // Las que se preparan cuentan para el tope (a nivel 3 caben dos trabajos a la vez).
    s.building.rooms.find((r) => r.id === room)!.level = 3;
    s.potions = POTION_CAP[3] - 1;
    const a = reduce(s, { type: 'potion', room });
    expect(a.crafts?.length).toBe(1);
    expect(canPotion(a, room)).toMatch(/no caben/);
  });

  it('cancelar devuelve el oro y las hierbas; fuera de la alquimia, no', () => {
    const { s, room } = withShop('cancela', 'alquimia');
    s.mats = { ...s.mats, hierbas: POTION_HERBS };
    const a = reduce(s, { type: 'potion', room });
    const c = a.crafts!.find((x) => x.potion)!;
    const b = reduce(a, { type: 'cancelCraft', id: c.id });
    expect(b.gold).toBe(s.gold);
    expect(b.mats?.hierbas).toBe(POTION_HERBS);
    const forja = withShop('forja-no', 'sastreria');
    expect(canPotion(forja.s, forja.room)).not.toBeNull();
  });
});
