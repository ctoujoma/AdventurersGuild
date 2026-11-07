/**
 * Cómo se dicen los plazos: siempre en días de juego («mañana», «en 3 días», «esta noche»),
 * también con el tiempo que corre solo. Un día dura `DAY_SECONDS`, pero contarlo en minutos
 * reales confunde (el reloj corre más deprisa de noche y más despacio con el juego cerrado);
 * los minutos solo salen en la cuenta atrás de la barra del día.
 */

const days = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Lo que dura algo de `n` días (un viaje que aún no ha salido): «3 días». */
export function span(n: number, one = 'día', many = 'días'): string {
  return days(n, one, many);
}

/** En corto, para fichas y notas: «3d». */
export function shortSpan(n: number): string {
  return `${n}d`;
}

/**
 * Cuándo pasa algo que llega dentro de `n` amaneceres (vuelta de misión, obra lista, nota que
 * caduca, pago): «hoy», «mañana», «pasado mañana» o «en 4 días».
 */
export function dawnIn(n: number): string {
  if (n <= 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === 2) return 'pasado mañana';
  return `en ${n} días`;
}

/** Lo mismo en corto, para notas y cifras: «hoy» o «3d». */
export function shortDawn(n: number): string {
  return n <= 0 ? 'hoy' : `${n}d`;
}

/**
 * Cuándo llega algo que pasa de noche (el asalto). `n` es `raid.day - day`: el núcleo lo
 * resuelve al acabar la noche en que falta uno, así que 1 (o menos) es esta noche.
 */
export function nightIn(n: number): string {
  if (n <= 1) return 'esta noche';
  if (n === 2) return 'mañana por la noche';
  if (n === 3) return 'pasado mañana por la noche';
  // Contando esta noche como la primera, igual que el chivatazo («unas 4 noches»).
  return `en ${n} noches`;
}

/** Cuenta atrás corta para la barra del día: «1:05». */
export function countdown(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
