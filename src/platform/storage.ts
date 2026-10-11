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

/** Carga la partida guardada si es de esta versión; si no, devuelve null. */
export function loadGame(storage: SaveStorage = webStorage): GameState | null {
  const raw = storage.read();
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as GameState;
    return s && s.version === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}

export function saveGame(s: GameState, storage: SaveStorage = webStorage): void {
  storage.write(JSON.stringify(s));
}
