import { t } from '../textos';
/**
 * Cómo se dicen los plazos: siempre en días de juego («mañana», «en 3 días», «esta noche»),
 * también con el tiempo que corre solo. Un día dura `DAY_SECONDS`, pero contarlo en minutos
 * reales confunde (el reloj corre más deprisa de noche y más despacio con el juego cerrado);
 * los minutos solo salen en la cuenta atrás de la barra del día.
 */

/** Lo que dura algo de `n` días (un viaje que aún no ha salido): «3 días». */
export function span(n: number): string {
  return t('barra.when.dias', { n });
}

/** En corto, para fichas y notas: «3d». */
export function shortSpan(n: number): string {
  return t('barra.when.dias_corto', { n });
}

/**
 * Cuándo pasa algo que llega dentro de `n` amaneceres (vuelta de misión, obra lista, nota que
 * caduca, pago): «hoy», «mañana», «pasado mañana» o «en 4 días».
 */
export function dawnIn(n: number): string {
  return t('barra.when.amanecer', { n: Math.max(0, n) });
}

/** Lo mismo en corto, para notas y cifras: «hoy» o «3d». */
export function shortDawn(n: number): string {
  return n <= 0 ? t('barra.when.hoy') : shortSpan(n);
}

/**
 * Cuándo llega algo que pasa de noche (el asalto). `n` es `raid.day - day`: el núcleo lo
 * resuelve al acabar la noche en que falta uno, así que 1 (o menos) es esta noche.
 */
export function nightIn(n: number): string {
  // Contando esta noche como la primera, igual que el chivatazo («unas 4 noches»).
  return t('barra.when.noche', { n: Math.max(1, n) });
}

/** Cuenta atrás corta para la barra del día: «1:05». */
export function countdown(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
