import type { GameState, Room } from '../core/model';
import { onDuty, onWay } from '../core/workers';
import { t } from '../textos';

/**
 * Si la sala tiene a alguien puesto que ahora no está (va de camino o es fuera de la jornada), lo
 * dice; null si no hay nadie puesto. No es lo mismo que no tener a nadie.
 */
export function absentText(s: GameState, r: Room): string | null {
  const crew = [
    ...s.workers.filter((w) => w.room === r.id),
    ...s.heroes.filter((h) => h.job === r.id && h.status === 'ok' && !h.guard),
  ];
  if (!crew.length) return null;
  const p = { nombre: crew[0]!.name, n: crew.length };
  if (crew.some((x) => onWay(s, x))) return t('paneles.ausente.camino', p);
  if (!onDuty(s)) return t('paneles.ausente.descansa', p);
  return t('paneles.ausente.no_esta', p);
}
