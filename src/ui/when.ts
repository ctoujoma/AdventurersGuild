/**
 * Cómo se dicen los plazos. Normalmente en días (o noches); con el tiempo que corre solo (en
 * prueba, ver `core/away.ts`), en minutos de taberna abierta, que es lo que el jugador vive:
 * un día dura `DAY_SECONDS`. Con el juego cerrado va más despacio, y eso lo explica la barra.
 */
import { DAY_SECONDS } from '../core/balance';

let real = false;

/** Lo pone la App en cada pintada, según los ajustes. */
export function setRealTime(on: boolean): void {
  real = on;
}

export const isRealTime = () => real;

/** Lo que dura algo de `n` días desde la mañana (un viaje que aún no ha salido). */
export function span(n: number, one = 'día', many = 'días'): string {
  return real ? minutes(n * DAY_SECONDS) : `${n} ${n === 1 ? one : many}`;
}

/** Lo que falta para algo que pasa dentro de `n` amaneceres, con el reloj del día en `clock`. */
export function left(n: number, clock: number, one = 'día', many = 'días'): string {
  if (!real) return `${n} ${n === 1 ? one : many}`;
  return minutes(Math.max(0, n - 1) * DAY_SECONDS + Math.max(0, DAY_SECONDS - clock));
}

/** Lo mismo en corto, para las fichas del mapa: «3d» o «14m». */
export function shortLeft(n: number, clock: number): string {
  if (!real) return `${n}d`;
  const sec = Math.max(0, n - 1) * DAY_SECONDS + Math.max(0, DAY_SECONDS - clock);
  return `${Math.max(1, Math.ceil(sec / 60))}m`;
}

export function shortSpan(n: number): string {
  return real ? `${Math.max(1, Math.ceil((n * DAY_SECONDS) / 60))}m` : `${n}d`;
}

/** Segundos a «12 min», «1 h 5 min» o «un minuto». */
export function minutes(sec: number): string {
  const m = Math.max(1, Math.ceil(sec / 60));
  if (m === 1) return 'un minuto';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Cuenta atrás corta para la barra del día: «1:05». */
export function countdown(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
