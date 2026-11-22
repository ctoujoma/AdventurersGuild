/** Ritmos del reloj del día, en el orden en que los recorre el botón del reloj. */
export const PACES = [1, 2, 4, 8, 0.5] as const;
export type Pace = (typeof PACES)[number];

/** El siguiente ritmo al tocar el reloj: ×1 → ×2 → ×4 → ×8 → ×½ → ×1. */
export function nextPace(p: Pace): Pace {
  return PACES[(PACES.indexOf(p) + 1) % PACES.length]!;
}

/** El ritmo escrito para la barra: «½» en vez de «0.5». */
export function paceLabel(p: number): string {
  return p === 0.5 ? '½' : String(p);
}

/** Ajustes del jugador: se guardan en este navegador, aparte de la partida. */
export interface Settings {
  /** Volúmenes de 0 a 1. */
  music: number;
  sfx: number;
  ambient: number;
  /** Velocidad de la escena: noches, asaltos y paseos. */
  speed: 1 | 1.5 | 2;
  /** Lo rápido que corre el reloj del día (se cambia desde la barra del día; ½ = más despacio). */
  pace: Pace;
  /** Letra más grande en paneles y fichas. */
  bigText: boolean;
  /** Menos movimiento en la interfaz. */
  calm: boolean;
  /** La carta del amanecer, todo de golpe (sin abrir las noticias una a una). */
  dawnAll: boolean;
  /** Vibración en los momentos con peso (si el móvil la tiene). */
  vibrate: boolean;
  /** Pocas luces en la escena (solo las más cercanas al centro), para móviles lentos. */
  fewLights: boolean;
  /**
   * Luz con ambiente: las salas con menos luz de fondo y los fuegos, faroles y velas más
   * fuertes (charcos de luz). Sin marcar, la luz de siempre.
   */
  moodLight: boolean;
  /**
   * Versión de la luz con ambiente que ya se ha visto: al pasar a `MOOD_LIGHT_V` se enciende una
   * vez para todos (quien la tenía apagada la ve), y luego se puede volver a apagar.
   */
  moodLightV: number;
  /** Clima (con luz con ambiente): el que toque cada día o siempre despejado. */
  weather: 'normal' | 'clear';
  /**
   * Días a la antigua (modo prueba): el día solo corre con el juego abierto y se cierra con
   * «Anochecer». Lo normal es que el tiempo corra solo, también cerrado (ver `core/away.ts`).
   */
  classicTime: boolean;
  /** Mandar la partida a los desarrolladores (ver `platform/telemetry.ts`). */
  share: boolean;
  /** Modo prueba: atajos en Ajustes (se abre tocando cinco veces el título). */
  tester: boolean;
  /**
   * Idioma de los textos (`src/textos/<idioma>`); sin él, español. Lo lee `src/textos` al
   * arrancar: cambiarlo recarga la página. El selector sale cuando haya más de un idioma.
   */
  lang?: string;
}

const KEY = 'jarro:ajustes';
/** Sube esto para volver a encender la luz con ambiente a todos una vez (8 de noviembre: 1). */
export const MOOD_LIGHT_V = 1;
export const DEFAULT_SETTINGS: Settings = {
  music: 1,
  sfx: 1,
  ambient: 1,
  speed: 1,
  pace: 1,
  bigText: false,
  calm: false,
  dawnAll: false,
  vibrate: true,
  fewLights: false,
  moodLight: true,
  moodLightV: MOOD_LIGHT_V,
  weather: 'normal',
  classicTime: false,
  share: true,
  tester: false,
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
    pace: PACES.includes(r.pace as Pace) ? (r.pace as Pace) : 1,
    bigText: r.bigText === true,
    calm: r.calm === true,
    dawnAll: r.dawnAll === true,
    vibrate: r.vibrate !== false,
    fewLights: r.fewLights === true,
    moodLight: r.moodLight !== false || r.moodLightV !== MOOD_LIGHT_V,
    moodLightV: MOOD_LIGHT_V,
    weather: r.weather === 'clear' ? 'clear' : 'normal',
    classicTime: r.classicTime === true,
    share: r.share !== false,
    tester: r.tester === true,
    ...(typeof r.lang === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(r.lang)
      ? { lang: r.lang }
      : {}),
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
