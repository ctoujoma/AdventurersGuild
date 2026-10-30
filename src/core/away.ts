/**
 * «Tiempo que corre solo» (en prueba): al volver al juego, lo que ha pasado mientras estaba
 * cerrado o en segundo plano se simula de golpe, como en Fallout Shelter. El tiempo fuera corre
 * más despacio que con el juego abierto (`AWAY_DAY_SECONDS`) y tiene un tope (`AWAY_MAX_DAYS`).
 * Las noches pasan con menos asaltos y todo se resuelve solo; lo de cada día queda en una carta
 * de «Mientras no estabas».
 */
import { AWAY_DAY_SECONDS, AWAY_MAX_DAYS, AWAY_MIN_SECONDS, DAY_SECONDS } from './balance';
import { endDay, tick } from './game';
import type { DawnEvent, GameState } from './model';

export interface AwayDay {
  /** El día que amaneció y lo que se contó al amanecer. */
  day: number;
  events: DawnEvent[];
}

export interface Away {
  state: GameState;
  /** Los amaneceres que han pasado (vacío si no ha acabado ningún día). */
  days: AwayDay[];
  /** Segundos de juego que han corrido. */
  seconds: number;
}

/** Segundos de juego que corren en `realSeconds` reales con el juego cerrado (con el tope). */
export function awaySeconds(realSeconds: number): number {
  if (realSeconds < AWAY_MIN_SECONDS) return 0;
  return Math.min((realSeconds * DAY_SECONDS) / AWAY_DAY_SECONDS, AWAY_MAX_DAYS * DAY_SECONDS);
}

/** Simula `realSeconds` reales fuera: corre el reloj, cae la noche y amanece las veces que toque. */
export function catchUp(state: GameState, realSeconds: number): Away {
  let left = awaySeconds(realSeconds);
  if (state.over || left <= 0) return { state, days: [], seconds: 0 };
  const total = left;
  let s = state;
  const days: AwayDay[] = [];
  while (left > 0 && !s.over) {
    const clock = s.clock ?? 0;
    const room = DAY_SECONDS - clock;
    if (left < room) {
      s = tick(s, clock + left);
      left = 0;
      break;
    }
    s = tick(s, DAY_SECONDS);
    left -= room;
    s = endDay(s, true);
    days.push({ day: s.day, events: s.dawn });
  }
  if (days.length) {
    // Nada que ver en la escena al volver: el asalto y el jefe ya se cuentan en la carta y en
    // los informes. La carta junta los días, cada uno con su encabezado.
    s = {
      ...s,
      lastRaid: null,
      lastFight: null,
      dawn: days.flatMap((d) => [
        { t: `Día ${d.day}`, head: true },
        ...(d.events.length ? d.events : [{ t: 'Un día tranquilo.' }]),
      ]),
    };
  }
  return { state: s, days, seconds: total - left };
}
