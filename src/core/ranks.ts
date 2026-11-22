/**
 * Lo que abre cada rango del gremio (Cobre, Hierro, Plata, Oro y Leyenda, por reputación):
 * plantas nuevas y niveles de sala (ver `FLOORS_BY_RANK` y `LEVEL_RANK` en `balance.ts`), y el
 * aviso del amanecer al subir de rango.
 */
import type { RoomType } from '../data/rooms';
import {
  FLOORS_BY_RANK,
  LEVEL_RANK,
  QUIET_AFTER,
  QUIET_FAME,
  RANKS,
  WING_RANK,
  rankIndex,
  rankMsg,
} from './balance';
import type { DawnEvent, GameState } from './model';
import { type Msg, msg, t } from '../textos';

/** Lo que abre el rango `r`, dicho para el jugador: «la planta 5», «nivel 3 de la capilla»… */
export function rankOpens(r: number): Msg[] {
  const out: Msg[] = [];
  const floors = FLOORS_BY_RANK[r] ?? 0;
  const before = FLOORS_BY_RANK[r - 1] ?? floors;
  for (let f = before + 1; f <= floors; f++) out.push(msg('rangos.planta', { n: f }));
  for (const [type, levels] of Object.entries(LEVEL_RANK) as [RoomType, Record<number, number>][])
    for (const [level, need] of Object.entries(levels))
      if (need === r)
        out.push(msg('rangos.nivel', { n: level, sala: msg(`salas.salas.${type}.nombre`) }));
  if (r === WING_RANK) out.push(msg('rangos.patio'));
  return out;
}

/** Lo mismo, escrito (para la interfaz). */
export const rankUnlocks = (r: number): string[] => rankOpens(r).map((m) => t(m.k, m.p));

/**
 * Al amanecer, si el gremio ha subido de rango, lo cuenta con lo que se abre. Las partidas de
 * antes, que no lo apuntaban, empiezan con el rango que tengan sin aviso.
 */
export function checkRank(s: GameState, events: DawnEvent[]): void {
  const r = rankIndex(s.rep);
  if (s.rankLost !== undefined && r >= s.rankLost) {
    events.push({
      t: msg('rangos.recupera', { rango: rankMsg(s.rankLost) }),
      k: 'good',
    });
    delete s.rankLost;
  }
  if (s.rankSeen === undefined || r <= s.rankSeen) {
    s.rankSeen = Math.max(s.rankSeen ?? r, r);
    return;
  }
  s.rankSeen = r;
  const opens = rankOpens(r);
  events.push({
    t: msg('rangos.sube', { rango: rankMsg(r), abre: opens, hay: opens.length > 0 }),
    k: 'good',
    big: true,
  });
}

/**
 * Si pasan días sin nadie fuera de encargo, la comarca se olvida del gremio: la fama baja un poco
 * cada noche, sin caer más allá del rango de debajo del más alto alcanzado. Lo construido se
 * queda; lo nuevo de un rango perdido no se puede construir hasta recuperarlo (lo pide el rango).
 * Solo jugando: con el juego cerrado no pasa (lo decide quien llama).
 */
export function fadeFame(s: GameState, events: DawnEvent[]): void {
  const quiet = s.quiet ?? 0;
  if (quiet <= QUIET_AFTER) return;
  const before = rankIndex(s.rep);
  const floor = RANKS[Math.max(0, (s.rankSeen ?? before) - 1)]!.at;
  if (s.rep <= floor) return;
  if (quiet === QUIET_AFTER + 1)
    events.push({
      t: msg('rangos.olvido'),
      k: 'warn',
    });
  s.rep = Math.max(floor, s.rep - Math.max(1, Math.round(s.rep * QUIET_FAME)));
  const after = rankIndex(s.rep);
  if (after < before) {
    s.rankLost = Math.max(s.rankLost ?? 0, before);
    events.push({
      t: msg('rangos.baja', { rango: rankMsg(after), antes: rankMsg(before) }),
      k: 'bad',
    });
  }
}
