/**
 * El bestiario (usuario, 27 de noviembre): cada enemigo vencido, cuántas veces y el primer día.
 * Las claves: `jefe:<BossKind>` (los jefes de las historias), `exp:<rumbo>:<n>` (los enemigos de
 * las expediciones), `guardian:<rumbo>` y `guardian:<rumbo>_2` (los guardianes) y `banda:<n>`
 * (las bandas de los asaltos). La lista entera, con su dibujo, en `ui/panels/BestiaryPanel.tsx`.
 */
import type { GameState } from './model';
import type { Txt } from '../textos';

/** Apunta un enemigo vencido (muta). */
export function defeated(s: GameState, key: string): void {
  const was = s.bestiary?.[key];
  s.bestiary = { ...s.bestiary, [key]: { n: (was?.n ?? 0) + 1, day: was?.day ?? s.day } };
}

/** La banda de un asalto (`asaltos.bandas.<n>.nombre`) como clave; null si no se sabe. */
export function bandKey(band: Txt): string | null {
  const k = typeof band === 'object' && band && 'k' in band ? String(band.k) : '';
  const n = k.match(/^asaltos\.bandas\.(\d+)\./)?.[1];
  return n === undefined ? null : `banda:${n}`;
}
