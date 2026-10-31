/**
 * El tiempo corre solo: al volver al juego, lo que ha pasado mientras estaba cerrado o en
 * segundo plano se simula de golpe, como en Fallout Shelter. Fuera corre más despacio que con
 * el juego abierto (`AWAY_DAY_SECONDS`) y tiene un tope (`AWAY_MAX_DAYS`). Las noches pasan con
 * menos asaltos y todo se resuelve solo; lo de cada día queda en una carta de «Mientras no
 * estabas». Nunca se pierde estando fuera: la víspera de un pago que no llega, la taberna
 * espera a la tarde a que vuelva el jugador.
 */
import {
  AWAY_DAY_SECONDS,
  AWAY_MAX_DAYS,
  AWAY_MIN_SECONDS,
  DAY_SECONDS,
  DUSK,
  SALARY_EVERY,
  SCHEDULE,
} from './balance';
import { endDay, salaries, tick } from './game';
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
  /** Lo que toca pagar esta noche y no llega: el tiempo se ha parado en la tarde por eso. */
  waiting?: number;
}

/** Lo que toca pagar la noche que viene (cuota de la deuda y salarios), o 0. */
export function dueTonight(s: GameState): number {
  const next = s.day + 1;
  const pay = s.mode !== 'libre' ? SCHEDULE.find((p) => p.day === next) : undefined;
  const payday = !!pay || (s.mode === 'libre' && next % SALARY_EVERY === 0);
  return payday ? salaries(s) + (pay?.amount ?? 0) : 0;
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
  let waiting: number | undefined;
  const dusk = DUSK * DAY_SECONDS;
  while (left > 0 && !s.over) {
    const clock = s.clock ?? 0;
    // La víspera de un pago se llega a la tarde y, si no hay con qué pagar, se espera al jugador.
    const due = dueTonight(s);
    if (due && clock < dusk) {
      const step = Math.min(left, dusk - clock);
      s = tick(s, clock + step);
      left -= step;
      continue;
    }
    if (due > s.gold) {
      waiting = due;
      break;
    }
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
      dawn: [
        ...days.flatMap((d) => [
          { t: `Día ${d.day}`, head: true },
          ...(d.events.length ? d.events : [{ t: 'Un día tranquilo.' }]),
        ]),
        ...(waiting ? [{ t: waitText(s, waiting), k: 'bad' as const }] : []),
      ],
    };
  }
  return { state: s, days, seconds: total - left, waiting };
}

/** «Esta noche toca pagar 230 y en la caja hay 180: la taberna te ha esperado a la tarde.» */
export const waitText = (s: GameState, due: number) =>
  `Esta noche toca pagar ${due} monedas y en la caja hay ${s.gold}: la taberna te ha esperado a la tarde. Vende algo o cobra un encargo antes de que anochezca.`;
