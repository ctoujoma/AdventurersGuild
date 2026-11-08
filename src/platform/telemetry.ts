import { customOf } from '../core/game';
import type { GameState } from '../core/model';
import { VERSION } from '../version';

/**
 * Envío de la partida a los desarrolladores (Supabase), para ver quién juega, cuánto y cómo
 * va. La clave es pública a propósito: la base solo deja llamar a `reportar`, que crea o
 * actualiza la fila de este jugador; leer los datos solo se puede desde el panel de Supabase.
 * Se puede apagar en Ajustes. Si falla (sin red), no pasa nada.
 */
const URL = 'https://rirxrphghvvmycpbpmlw.supabase.co/rest/v1/rpc/reportar';
const KEY = 'sb_publishable_WkZUE5-MGZiWWnyAqvW69g_E2eU15Ut';

const ID_KEY = 'jarro:jugador';
const MIN_KEY = 'jarro:minutos';

/** Id anónimo de este navegador (se crea la primera vez). */
export function playerId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return '00000000-0000-4000-8000-000000000000';
  }
}

/** Minutos jugados en este navegador (con el juego abierto y visible). */
export function playedMinutes(): number {
  try {
    return Number(localStorage.getItem(MIN_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function addMinute(): number {
  const m = playedMinutes() + 1;
  try {
    localStorage.setItem(MIN_KEY, String(m));
  } catch {
    // Sin almacenamiento: no se cuentan.
  }
  return m;
}

/** Lo que se manda: un resumen para leer de un vistazo y la partida entera. */
export function reportOf(s: GameState, minutes: number, id = playerId()) {
  return {
    p_id: id,
    p_nombre: customOf(s).name,
    p_dia: s.day,
    p_oro: s.gold,
    p_minutos: minutes,
    p_stats: {
      ...(s.stats ?? {}),
      fama: s.rep,
      pagado: s.paid,
      modo: s.mode,
      heroes: s.heroes.length,
      trabajadores: s.workers.length,
      salas: s.building.rooms.length,
      caidos: s.fallen.length,
      fin: s.over,
    },
    p_partida: s,
    p_version: VERSION,
  };
}

export function sendReport(s: GameState): void {
  if (VERSION === 'dev') return; // En local no se ensucia la tabla.
  try {
    void fetch(URL, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(reportOf(s, playedMinutes())),
    }).catch(() => undefined);
  } catch {
    // Sin red o sin fetch: se intenta en el siguiente envío.
  }
}
