/**
 * Lo que abre cada rango del gremio (Cobre, Hierro, Plata, Oro y Leyenda, por reputación):
 * plantas nuevas y niveles de sala (ver `FLOORS_BY_RANK` y `LEVEL_RANK` en `balance.ts`), y el
 * aviso del amanecer al subir de rango.
 */
import { ROOMS, type RoomType } from '../data/rooms';
import { FLOORS_BY_RANK, LEVEL_RANK, RANKS, rankIndex } from './balance';
import type { DawnEvent, GameState } from './model';

/** Lo que abre el rango `r`, dicho para el jugador: «la planta 5», «nivel 3 de la capilla»… */
export function rankUnlocks(r: number): string[] {
  const out: string[] = [];
  const floors = FLOORS_BY_RANK[r] ?? 0;
  const before = FLOORS_BY_RANK[r - 1] ?? floors;
  for (let f = before + 1; f <= floors; f++) out.push(`la planta ${f}`);
  for (const [type, levels] of Object.entries(LEVEL_RANK) as [RoomType, Record<number, number>][])
    for (const [level, need] of Object.entries(levels))
      if (need === r) out.push(`el nivel ${level} de ${ROOMS[type].name.toLowerCase()}`);
  return out;
}

/** «a, b y c». */
const list = (xs: string[]) =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`;

/**
 * Al amanecer, si el gremio ha subido de rango, lo cuenta con lo que se abre. Las partidas de
 * antes, que no lo apuntaban, empiezan con el rango que tengan sin aviso.
 */
export function checkRank(s: GameState, events: DawnEvent[]): void {
  const r = rankIndex(s.rep);
  if (s.rankSeen === undefined || r <= s.rankSeen) {
    s.rankSeen = Math.max(s.rankSeen ?? r, r);
    return;
  }
  s.rankSeen = r;
  const opens = rankUnlocks(r);
  events.push({
    t: `¡El gremio es ahora de ${RANKS[r]!.name}! Llegan encargos más duros y mejor pagados${opens.length ? `, y se abre ${list(opens)}` : ''}.`,
    k: 'good',
  });
}
