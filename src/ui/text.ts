export { listNames, plural } from '../core/text';

/**
 * Oro en corto, para lo que tiene poco sitio (las notas del tablón): hasta 999 tal cual; luego
 * «1,2 k» (con un decimal si hace falta, hacia abajo) y desde 100 000, «123 k».
 */
export function shortGold(n: number): string {
  if (Math.abs(n) < 1000) return String(n);
  const k = n / 1000;
  const r = Math.abs(k) < 100 ? Math.floor(k * 10) / 10 : Math.floor(k);
  return `${String(r).replace('.', ',')} k`;
}
