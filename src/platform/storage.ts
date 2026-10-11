import { START } from '../core/balance';
import { SAVE_VERSION, type GameState } from '../core/model';

/**
 * Dónde se guarda la partida. En la web, localStorage; en Android se cambiará por
 * Capacitor Preferences sin tocar el juego.
 */
export interface SaveStorage {
  read(): string | null;
  write(data: string): void;
  clear(): void;
}

const KEY = 'jarro:partida';

export const webStorage: SaveStorage = {
  read() {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  write(data) {
    try {
      localStorage.setItem(KEY, data);
    } catch {
      // Sin almacenamiento (modo privado, vista previa): se juega sin guardar.
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nada que borrar.
    }
  },
};

/**
 * Lee una partida desde texto (guardado local o archivo importado). Si no es válida o es
 * de otra versión devuelve null. Las partidas antiguas se completan con lo que falte.
 */
export function parseSave(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as GameState;
    if (!s || s.version !== SAVE_VERSION || !s.fac || !Array.isArray(s.heroes)) return null;
    s.fac = { ...START.fac, ...s.fac };
    s.trophies ??= [];
    return s;
  } catch {
    return null;
  }
}

/** Carga la partida guardada en el navegador, si hay. */
export function loadGame(storage: SaveStorage = webStorage): GameState | null {
  return parseSave(storage.read());
}

/** Nombre de archivo para exportar: «jarro-partido-dia-12.json». */
export const saveFileName = (s: GameState) => `jarro-partido-dia-${s.day}.json`;

/** Texto de la partida para exportar (el mismo formato que el guardado automático). */
export const exportSave = (s: GameState) => JSON.stringify(s);

export function saveGame(s: GameState, storage: SaveStorage = webStorage): void {
  storage.write(JSON.stringify(s));
}
