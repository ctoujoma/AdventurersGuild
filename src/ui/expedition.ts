/**
 * Lo que la interfaz de las expediciones necesita del núcleo, ya hecho: cuántos días de ida dan
 * unas raciones y qué pinta el visor ahora (`world/visor/`).
 */
import { DAY_SECONDS, DUSK, EXP_CAMP, EXP_HOURS, HP_LIGHT } from '../core/balance';
import { hpOf } from '../core/health';
import { fightRoster } from '../core/chains';
import { HEADING_FOES, HOUR, distAt, expWeather, gameTime } from '../core/expedition';
import type { BossFight, Expedition, GameState, Hero } from '../core/model';
import type { MarchNow } from '../world/visor/marcha';

/**
 * Días de ida que dan `rations` raciones a `n` héroes, con la regla del núcleo: siguen otro día
 * si les queda para él y para la vuelta (que tarda la mitad).
 */
export function daysOut(n: number, rations: number): number {
  let d = 0;
  let left = rations;
  while (left >= n * (1 + Math.ceil((d + 1) / 2))) {
    left -= n;
    d++;
  }
  return d;
}

/** Hora del día (0–23) en la hora `h` de la expedición. */
export const hourOfDay = (e: Expedition, h = e.hours) =>
  Math.floor(((e.from + h * HOUR) % DAY_SECONDS) / HOUR);

/**
 * La hora para la luz del visor (0–24, con decimales; 0 medianoche), al compás de la taberna: su
 * día (del alba al anochecer, `DUSK`) va de las 6 a las 20 y su noche, de las 20 a las 6. Así, de
 * día en la taberna es de día en la expedición, y la noche cae a la vez en las dos.
 */
export function visorHour(s: GameState): number {
  return hourAt(gameTime(s));
}

/** La hora del visor en un momento (segundos de juego desde el alba del día 1). */
function hourAt(at: number): number {
  const f = (((at % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS) / DAY_SECONDS;
  const h = f < DUSK ? 6 + (14 * f) / DUSK : 20 + (10 * (f - DUSK)) / (1 - DUSK);
  return h % 24;
}

/** Lo que pinta el visor ahora. */
export function marchNow(s: GameState, e: Expedition): MarchNow {
  const heroes = e.heroIds.map((id) => s.heroes.find((h) => h.id === id)).filter((h) => !!h);
  const crew = fightRoster(heroes);
  for (const c of crew) {
    const h = heroes.find((x) => x.id === c.id);
    if (h && hpOf(h) < HP_LIGHT) c.fate = 'herido';
  }
  const last = e.log.at(-1);
  const recent = last && e.hours - last.h <= 1 ? last : undefined;
  const fightLine = [...e.log].reverse().find((l) => l.k === 'pelea');
  const hod = hourOfDay(e);
  const clock = s.clock ?? 0;
  const foes = HEADING_FOES[e.heading] ?? ['bestia'];
  return {
    seed: e.seed,
    terrain:
      e.heading === 'bosque'
        ? 'bosque'
        : e.heading === 'sierra'
          ? 'monte'
          : e.heading === 'marismas'
            ? 'pantano'
            : 'ruina',
    crew,
    mode:
      recent?.k === 'pelea' && e.hours === recent.h
        ? 'fight'
        : // Acampan con la noche de la taberna (de `EXP_CAMP` al alba): de día, andan.
          hod >= EXP_CAMP
          ? 'camp'
          : // Con un suceso esperando (un jefe a la vista…), parados mirando al frente.
            e.pending
            ? 'wait'
            : 'walk',
    night: clock >= DUSK * DAY_SECONDS || clock < 0.04 * DAY_SECONDS,
    home: !!e.turn,
    foe: foes[fightLine?.foe ?? 0] ?? 'bestia',
    heading: e.heading,
    won: fightLine?.won,
    rival: { heading: e.heading, idx: fightLine?.foe ?? 0 },
    wild: Math.min(1, distAt(e) / 8),
    last: recent?.k,
    hour: visorHour(s),
    weather: expWeather(e),
    day: Math.floor(e.hours / EXP_HOURS) + 1,
    event: e.pending ? { kind: e.pending.kind, foe: e.pending.foe } : undefined,
    dress: Object.fromEntries(heroes.filter((h) => h.dress).map((h) => [h.id, h.dress!])),
  };
}

/**
 * Lo que pinta el visor al repetir una pelea de expedición («Ver la pelea»): la misma escena que
 * en directo (rumbo, enemigo, lejanía, hora y tiempo de entonces), en modo pelea.
 */
export function replayNow(s: GameState, f: BossFight): MarchNow | null {
  const x = f.exp;
  if (!x) return null;
  const foes = HEADING_FOES[x.heading] ?? ['bestia'];
  const part = (((x.at % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS) / DAY_SECONDS;
  const heroes = f.heroes
    .map((c) => s.heroes.find((h) => h.id === c.id))
    .filter((h): h is Hero => !!h);
  return {
    seed: `${f.boss}-${x.at}-${x.foe}`,
    terrain:
      x.heading === 'bosque'
        ? 'bosque'
        : x.heading === 'sierra'
          ? 'monte'
          : x.heading === 'marismas'
            ? 'pantano'
            : 'ruina',
    crew: f.heroes,
    mode: 'fight',
    night: part >= DUSK || part < 0.04,
    home: x.home,
    foe: foes[x.foe] ?? 'bestia',
    rival: x.heading === 'bosque' ? { heading: x.heading, idx: x.foe } : undefined,
    wild: Math.min(1, x.dist / 8),
    hour: hourAt(x.at),
    weather: x.weather,
    day: Math.floor(x.at / DAY_SECONDS) + 1,
    dress: Object.fromEntries(heroes.filter((h) => h.dress).map((h) => [h.id, h.dress!])),
  };
}

/** Quién está en el suelo (sin vida: le llevan los demás). */
export const isDown = (h: Hero) => hpOf(h) <= 0;
