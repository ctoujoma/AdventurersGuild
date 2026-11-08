import { START_BEER, START_FOOD } from '../core/balance';
import { emptyStats } from '../core/feats';
import { SAVE_VERSION, type GameState } from '../core/model';
import { facOf } from '../core/rooms';
import { migrateGear } from '../core/gear';

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
 * de otra versión devuelve null. El nivel de las instalaciones se saca del edificio.
 */
export function parseSave(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as GameState;
    if (!s || !s.building || !Array.isArray(s.heroes)) return null;
    if (s.version === 4) {
      fiveRarities(s);
      s.version = SAVE_VERSION;
    }
    if (s.version !== SAVE_VERSION) return null;
    s.fac = facOf(s.building);
    s.trophies ??= [];
    // Partidas de antes del aviso: se les pide nombre una vez.
    s.askName ??= true;
    s.mode ??= 'deuda';
    s.stats ??= emptyStats();
    s.feats ??= {};
    s.food ??= START_FOOD;
    s.beer ??= START_BEER;
    for (const h of s.heroes) migrateGear(h);
    return s;
  } catch {
    return null;
  }
}

/** De tres rarezas a cinco: el bueno (1) pasa a raro (2) y el legendario (2) a 4. */
const RARITY_V4 = [0, 2, 4];

/**
 * Partidas de la versión 4: recorre todo el estado (arcón, equipo puesto, encargos, misiones,
 * talleres, peleas guardadas, finales de taller) y cambia cada `rarity`; en los premios
 * (`reward.item`, la rareza del regalo) también.
 */
export function fiveRarities(v: unknown, key?: string): void {
  if (Array.isArray(v)) {
    for (const x of v) fiveRarities(x);
    return;
  }
  if (!v || typeof v !== 'object') return;
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    const x = o[k];
    if (typeof x === 'number' && (k === 'rarity' || (k === 'item' && key === 'reward')))
      o[k] = RARITY_V4[x] ?? x;
    else fiveRarities(x, k);
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
