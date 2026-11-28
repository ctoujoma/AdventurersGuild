/**
 * La pelea del visor, tal cual fue (usuario, 28 de noviembre: «el visor debería ser una
 * representación exacta de la pelea»): se vuelve a jugar la pelea de verdad (`Combat`, que es
 * determinista con su semilla) y sus sucesos se pasan a un guion con lo que hace cada muñeco y
 * cuándo: quién pega a quién, cuánto, si es crítico, las curas, el golpe fuerte y quién cae.
 *
 * El motor y el dibujo no siempre cuentan los mismos enemigos (una manada de tres lobos es una
 * sola unidad; el ahogado lleva esbirros que no se dibujan). Si cuadran, cada muñeco es su
 * unidad; si no, la vida de todos se reparte a partes iguales entre los muñecos: cada uno cae con
 * el golpe que se lleva su parte, y el último con el que acaba la pelea.
 */
import { Combat, STEP, type CombatSetup } from '../../core/combat';

/** Un golpe que da alguien (o una cura): a quién (índice de muñeco) y cuánto. */
export interface Blow {
  to: number;
  amount: number;
  crit: boolean;
}

/** Lo que hace uno en un momento (segundos de la pelea): pegar, el golpe fuerte o curar. */
export interface Act {
  at: number;
  kind: 'golpe' | 'fuerte' | 'cura' | 'habilidad';
  blows: Blow[];
}

/** Lo que recibe uno: un golpe (con quién se lo da) o una cura. */
export interface Taken {
  at: number;
  from: number;
  amount: number;
  crit: boolean;
  heal?: boolean;
  /** El golpe fuerte del jefe (tiembla todo). */
  big?: boolean;
}

export interface Track {
  acts: Act[];
  taken: Taken[];
  /** Cuándo cae (segundos de la pelea; Infinity, si aguanta). */
  downAt: number;
}

export interface Script {
  /** Lo que dura la pelea (s). */
  T: number;
  won: boolean;
  heroes: Track[];
  foes: Track[];
}

const cache = new Map<string, Script>();

const track = (): Track => ({ acts: [], taken: [], downAt: Infinity });

/**
 * El guion de una pelea para unos héroes (sus ids, en el orden en que se dibujan) y unos
 * muñecos enemigos (`n`, de delante atrás).
 */
export function scriptOf(setup: CombatSetup, crew: readonly string[], n: number): Script {
  const key = `${setup.seed}|${setup.boss}|${crew.join(',')}|${n}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = new Combat(setup, [], true);
  const res = c.run();
  const foeUnits = c.units.filter((u) => u.side === 'e');
  const heroIx = new Map(crew.map((id, i) => [id, i]));
  const heroes = crew.map(track);
  const foes = Array.from({ length: n }, track);
  const oneToOne = foeUnits.length === n;
  const foeIx = new Map(foeUnits.map((u, i) => [u.id, i]));
  // Repartido: la vida de todos y lo que llevan quitado.
  const pool = foeUnits.reduce((a, u) => a + u.max, 0);
  let lost = 0;
  let turn = 0;
  /** Los muñecos enemigos en pie en `at`. */
  const up = (at: number) => foes.map((_, j) => j).filter((j) => foes[j]!.downAt > at);
  /** El muñeco que recibe lo que va a una unidad enemiga. */
  const foeTo = (id: string, at: number) => (oneToOne ? foeIx.get(id)! : (up(at)[0] ?? n - 1));
  /** El muñeco que da lo que hace una unidad enemiga. */
  const foeFrom = (id: string, at: number) => {
    if (oneToOne) return foeIx.get(id)!;
    const alive = up(at);
    return alive.length ? alive[turn++ % alive.length]! : 0;
  };
  /** El último acto de alguien en este mismo paso (los golpes de un mismo paso van juntos). */
  const actAt = (t: Track, at: number, kind: Act['kind']) => {
    const last = t.acts[t.acts.length - 1];
    if (last && last.at === at && (last.kind === kind || kind === 'golpe')) return last;
    const a: Act = { at, kind, blows: [] };
    t.acts.push(a);
    return a;
  };
  const isHero = (id: string) => heroIx.has(id);
  const isFoe = (id: string) => foeIx.has(id);
  // El golpe fuerte de este paso (los golpes que le siguen son suyos).
  let bigAt = -1;
  let lastDown = 0;
  for (const e of c.events) {
    const at = e.step * STEP;
    if (e.kind === 'special') bigAt = at;
    else if (e.kind === 'skill' && isHero(e.from) && e.skill !== 'curar')
      actAt(heroes[heroIx.get(e.from)!]!, at, 'habilidad');
    else if (e.kind === 'heal' && isHero(e.from) && isHero(e.to)) {
      const from = heroIx.get(e.from)!;
      const to = heroIx.get(e.to)!;
      actAt(heroes[from]!, at, 'cura').blows.push({ to, amount: e.amount, crit: false });
      heroes[to]!.taken.push({ at, from, amount: e.amount, crit: false, heal: true });
    } else if (e.kind === 'hit' && isHero(e.from) && isFoe(e.to)) {
      const from = heroIx.get(e.from)!;
      const to = foeTo(e.to, at);
      actAt(heroes[from]!, at, 'golpe').blows.push({ to, amount: e.amount, crit: e.crit });
      foes[to]!.taken.push({ at, from, amount: e.amount, crit: e.crit });
      if (!oneToOne) {
        lost += e.dealt;
        // Cae el de delante cuando se lleva su parte (el último, con la pelea).
        const share = (pool * (n - up(at).length + 1)) / n;
        if (up(at).length > 1 && lost >= share - 1e-6) foes[to]!.downAt = at;
      }
    } else if (e.kind === 'hit' && isFoe(e.from) && isHero(e.to)) {
      const big = bigAt === at;
      const from = foeFrom(e.from, at);
      const to = heroIx.get(e.to)!;
      const a = actAt(foes[from]!, at, big ? 'fuerte' : 'golpe');
      a.blows.push({ to, amount: e.amount, crit: e.crit });
      heroes[to]!.taken.push({ at, from, amount: e.amount, crit: e.crit, big });
    } else if (e.kind === 'down') {
      if (isHero(e.to)) heroes[heroIx.get(e.to)!]!.downAt = at;
      else if (isFoe(e.to)) {
        if (oneToOne) foes[foeIx.get(e.to)!]!.downAt = at;
        else lastDown = at;
      }
    }
  }
  // Repartido: los que quedaban caen con el golpe que acaba la pelea.
  if (!oneToOne && res.won) for (const f of foes) if (f.downAt === Infinity) f.downAt = lastDown;
  const s: Script = { T: res.steps * STEP, won: res.won, heroes, foes };
  cache.set(key, s);
  return s;
}

/**
 * Un guion de relleno para las peleas guardadas sin la suya (de antes de que se apuntara): por
 * turnos, el grupo y los enemigos se van dando, y caen todos al final.
 */
export function stubScript(heroes: number, n: number, won: boolean, turn: number): Script {
  const h = Array.from({ length: heroes }, track);
  const f = Array.from({ length: n }, track);
  const turns = 4 + 2 * n;
  const H = turns / 2;
  let down = 0;
  for (let k = 0; k < turns && heroes && n; k++) {
    const at = (k + 0.32) * turn;
    if (k % 2 === 0) {
      const from = (k >> 1) % heroes;
      const to = Math.min(n - 1, down);
      h[from]!.acts.push({ at, kind: 'golpe', blows: [{ to, amount: 0, crit: false }] });
      f[to]!.taken.push({ at, from, amount: 0, crit: false });
      // Cada uno cae con su golpe (el último, con el de acabar, si ganan).
      if (won && (k >> 1) + 1 >= Math.round(((down + 1) * H) / n)) f[down++]!.downAt = at;
    } else {
      const alive = f.map((_, j) => j).filter((j) => f[j]!.downAt > at);
      if (!alive.length) continue;
      const from = alive[(k >> 1) % alive.length]!;
      const to = (k >> 1) % Math.min(2, heroes);
      f[from]!.acts.push({ at, kind: 'golpe', blows: [{ to, amount: 0, crit: false }] });
      h[to]!.taken.push({ at, from, amount: 0, crit: false });
    }
  }
  return { T: turns * turn, won, heroes: h, foes: f };
}
