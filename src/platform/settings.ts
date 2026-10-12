/** Ajustes del jugador: se guardan en este navegador, aparte de la partida. */
export interface Settings {
  /** Volúmenes de 0 a 1. */
  music: number;
  sfx: number;
  ambient: number;
  /** Velocidad de la escena: noches, asaltos y paseos. */
  speed: 1 | 1.5 | 2;
  /** Letra más grande en paneles y fichas. */
  bigText: boolean;
  /** Menos movimiento en la interfaz. */
  calm: boolean;
}

const KEY = 'jarro:ajustes';
export const DEFAULT_SETTINGS: Settings = {
  music: 1,
  sfx: 1,
  ambient: 1,
  speed: 1,
  bigText: false,
  calm: false,
};

const clamp01 = (v: unknown, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d;

/** Lee los ajustes guardados, corrigiendo lo que falte o venga mal. */
export function parseSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  return {
    music: clamp01(r.music, 1),
    sfx: clamp01(r.sfx, 1),
    ambient: clamp01(r.ambient, 1),
    speed: r.speed === 1.5 || r.speed === 2 ? r.speed : 1,
    bigText: r.bigText === true,
    calm: r.calm === true,
  };
}

export function loadSettings(): Settings {
  try {
    return parseSettings(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento: se pierden al cerrar */
  }
}

/** Aplica a la página lo que es solo de aspecto (letra grande, menos movimiento). */
export function applyLook(s: Settings): void {
  const html = document.documentElement;
  html.classList.toggle('text-grande', s.bigText);
  html.classList.toggle('calma', s.calm);
}
