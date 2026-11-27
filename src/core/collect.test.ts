import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, DUSK, TILL_SHOW } from './balance';
import { queueCap, queueOf, queuesShowing, readyIn, tillShows } from './collect';
import { endDay, newGame, reduce } from './game';
import { cookAt, foodCap } from './larder';
import type { GameState } from './model';

/** La partida del tío, sin objetivos que sumen (la cocina de Remedios ya hace raciones). */
function home(seed: string) {
  const s = newGame(seed);
  const far = { id: 'encargos', text: '', base: 0, target: 999, reward: {} };
  s.goals = { active: [far, far, far], done: {}, log: [] };
  s.tips = ['*'];
  return s;
}
const kitchenOf = (s: GameState) => s.building.rooms.find((r) => r.type === 'cocina')!;
const at = (s: GameState, part: number) => reduce(s, { type: 'tick', to: part * DAY_SECONDS });

describe('recoger lo que da la taberna', () => {
  it('la cocina llena su cola (medio día) y, llena, para', () => {
    const s0 = home('cola');
    const k = kitchenOf(s0);
    expect(cookAt(s0, k)).toBeGreaterThan(0);
    const cap = queueCap(k);
    expect(cap).toBeGreaterThan(0);
    // A media jornada lleva algo; al anochecer, la cola no pasa de su tope.
    const mid = at(s0, 0.2);
    expect(queueOf(mid, kitchenOf(mid))!.n).toBeGreaterThan(0);
    const late = at(s0, DUSK - 0.01);
    expect(queueOf(late, kitchenOf(late))!.n).toBeLessThanOrEqual(cap);
  });

  it('la burbuja sale al 90 %; recoger pasa a los armarios lo que quepa', () => {
    let s = home('burbuja');
    s.food = 0;
    s = at(s, DUSK - 0.01);
    const k = kitchenOf(s);
    const q = queueOf(s, k)!;
    if (q.n >= q.cap * 0.9) expect(queuesShowing(s).some((x) => x.room === k.id)).toBe(true);
    const ready = readyIn(s, k)!;
    expect(ready.n).toBeGreaterThan(0);
    const next = reduce(s, { type: 'collect', what: 'sala', id: k.id });
    expect(next.food).toBe(ready.n);
    expect(queueOf(next, kitchenOf(next))!.n).toBeLessThan(1);
  });

  it('con los armarios llenos no se recoge: lo hecho se queda en la cola', () => {
    let s = home('lleno');
    s.food = foodCap(s.building);
    s = at(s, 0.3);
    const k = kitchenOf(s);
    expect(readyIn(s, k)!.full).toBe(true);
    expect(reduce(s, { type: 'collect', what: 'sala', id: k.id })).toBe(s);
  });

  it('al irse a dormir entra todo lo de las colas; sin pasar por el día, lo de todo el día', () => {
    const plain = home('dormir');
    plain.food = 0;
    // A media mañana la cola aún no ha parado: al cerrar el día, lo mismo que sin reloj.
    const s = at(plain, 0.3);
    expect(queueOf(s, kitchenOf(s))!.n).toBeGreaterThan(0);
    const a = endDay(s);
    const b = endDay(plain);
    expect(a.queue).toBeUndefined();
    expect(a.food).toBe(b.food);
    expect(b.queueAt).toBe(0);
  });

  it('más ancha y de más nivel, más cola y más almacén (cada nivel, más que el anterior)', () => {
    const s = home('ancha');
    const k = kitchenOf(s);
    const at = (w: number, level: number) => ({ ...k, w, level });
    expect(queueCap(at(1, 1))).toBe(8);
    expect(queueCap(at(3, 1))).toBe(24);
    expect(queueCap(at(3, 4))).toBe(78);
    const cap = (w: number, level: number) => foodCap({ ...s.building, rooms: [at(w, level)] });
    expect(cap(1, 1)).toBe(20);
    expect(cap(3, 1)).toBe(60);
    expect(cap(1, 4)).toBe(110);
    expect(cap(1, 3) - cap(1, 2)).toBeGreaterThan(cap(1, 2) - cap(1, 1));
  });

  it('recoger a mano cuenta para los objetivos (la caja, las raciones) y servir jarras también', () => {
    let s = home('cuenta');
    s.food = 0;
    s = at(s, DUSK - 0.01);
    const k = kitchenOf(s);
    const n = readyIn(s, k)!.n;
    const a = reduce(s, { type: 'collect', what: 'sala', id: k.id });
    expect(a.stats?.gathered).toBe(n);
    const b = reduce({ ...a, till: TILL_SHOW }, { type: 'collect', what: 'caja' });
    expect(b.stats?.tills).toBe(1);
    const c = endDay({ ...home('beben'), beer: 20 });
    expect(c.stats?.beerServed ?? 0).toBeGreaterThan(0);
  });

  it('la bolsa de la caja sale sobre el salón desde 100 monedas', () => {
    const s = home('bolsa');
    expect(tillShows({ ...s, till: TILL_SHOW - 1 })).toBe(false);
    expect(tillShows({ ...s, till: TILL_SHOW })).toBe(true);
  });
});
