/**
 * El tiempo que hace: solo lo usa la escena (no afecta a la partida ni se guarda). Sale de la
 * semilla de la partida, el día y la hora, así que es el mismo al volver a abrir. Cada día tiene
 * su tipo (casi siempre despejado o algo nublado; pocos de lluvia y nunca dos seguidos de
 * lluvia fuerte) y, dentro del día, va cambiando poco a poco.
 */

/** Cada componente, de 0 a 1. */
export interface Weather {
  /** Nubes: 0 cielo limpio, 0,4 algunas, 1 cubierto del todo. */
  cloud: number;
  /** Niebla (sobre todo de mañana). */
  fog: number;
  rain: number;
  snow: number;
  wind: number;
  /** Tormenta: relámpagos y truenos (con lluvia). */
  storm: number;
}

export type WeatherKind =
  'despejado' | 'nubes' | 'nublado' | 'niebla' | 'viento' | 'lluvia' | 'tormenta' | 'nieve';

export const WEATHER_KINDS: readonly WeatherKind[] = [
  'despejado',
  'nubes',
  'nublado',
  'niebla',
  'viento',
  'lluvia',
  'tormenta',
  'nieve',
];

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  despejado: 'Despejado',
  nubes: 'Algo nublado',
  nublado: 'Nublado',
  niebla: 'Niebla',
  viento: 'Viento',
  lluvia: 'Lluvia',
  tormenta: 'Tormenta',
  nieve: 'Nieve',
};

export const CLEAR: Weather = { cloud: 0.1, fog: 0, rain: 0, snow: 0, wind: 0.15, storm: 0 };

const W = (p: Partial<Weather>): Weather => ({ ...CLEAR, ...p });

/** El tiempo «de libro» de cada tipo (para forzarlo desde el modo prueba). */
export function weatherOf(kind: WeatherKind): Weather {
  switch (kind) {
    case 'despejado':
      return CLEAR;
    case 'nubes':
      return W({ cloud: 0.42, wind: 0.25 });
    case 'nublado':
      return W({ cloud: 1, wind: 0.3 });
    case 'niebla':
      return W({ cloud: 0.85, fog: 1, wind: 0 });
    case 'viento':
      return W({ cloud: 0.4, wind: 0.9 });
    case 'lluvia':
      return W({ cloud: 1, rain: 0.7, wind: 0.35 });
    case 'tormenta':
      return W({ cloud: 1, rain: 1, wind: 0.8, storm: 1 });
    case 'nieve':
      return W({ cloud: 1, snow: 0.8, wind: 0.2 });
  }
}

/** Un número de 0 a 1 que solo depende de la semilla, el día y una sal. */
function hash(seed: string, day: number, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h = Math.imul(h ^ day, 2246822519);
  h = Math.imul(h ^ (h >>> 15), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** El tipo de día, sin mirar el anterior. */
function rawKind(seed: string, day: number): WeatherKind {
  if (day <= 1) return 'despejado';
  const r = hash(seed, day, 1);
  if (r < 0.35) return 'despejado';
  if (r < 0.4) return 'viento';
  if (r < 0.65) return 'nubes';
  if (r < 0.77) return 'nublado';
  if (r < 0.85) return 'niebla';
  if (r < 0.93) return 'lluvia';
  if (r < 0.96) return 'tormenta';
  return 'nieve';
}

const wet = (k: WeatherKind) => k === 'lluvia' || k === 'tormenta' || k === 'nieve';

/** El tipo de día: tras uno de lluvia (o nieve), nunca otro; se queda en nublado. */
export function dayKind(seed: string, day: number): WeatherKind {
  const k = rawKind(seed, day);
  if (wet(k) && wet(rawKind(seed, day - 1))) return 'nublado';
  return k;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * El tiempo a una hora del día (`tod`: 0 al amanecer, 1 al anochecer). Determinista: con la
 * misma semilla, día y hora sale siempre lo mismo. Los cambios dentro del día son graduales.
 */
export function weatherAt(seed: string, day: number, tod: number): Weather {
  const w = rawAt(seed, day, tod);
  for (const key of KEYS) w[key] = Math.max(0, Math.min(1, w[key]));
  return w;
}

function rawAt(seed: string, day: number, tod: number): Weather {
  const kind = dayKind(seed, day);
  const j = (salt: number) => hash(seed, day, salt);
  const t = Math.max(0, Math.min(1, tod));
  // Las nubes de fondo ondulan suave a lo largo del día (cada día a su manera).
  const wave = Math.sin((t * (1.5 + j(2)) + j(3)) * Math.PI * 2) * 0.08;
  const wind = 0.1 + j(4) * 0.25;
  switch (kind) {
    case 'despejado':
      return W({ cloud: Math.max(0, 0.08 + j(5) * 0.12 + wave), wind });
    case 'nubes':
      return W({ cloud: 0.32 + j(5) * 0.18 + wave * 1.5, wind: wind + 0.1 });
    case 'nublado': {
      // Algunos días se nubla poco a poco; otros, se abre por la tarde.
      const a = 0.15 + j(6) * 0.35;
      const opens = j(7) < 0.35;
      const c = opens
        ? lerp(1, 0.45, smooth(a + 0.2, a + 0.45, t))
        : lerp(0.55, 1, smooth(a - 0.15, a + 0.1, t));
      return W({ cloud: c + wave * 0.5, wind: wind + 0.15 });
    }
    case 'viento': {
      // Rachas que suben y bajan a lo largo del día, con nubes que corren.
      const gust = 0.7 + 0.25 * Math.sin((t * (2 + j(6)) + j(7)) * Math.PI * 2);
      return W({ cloud: 0.3 + j(5) * 0.2 + wave, wind: gust });
    }
    case 'niebla': {
      // Niebla de madrugada que se levanta a media mañana; luego, algunas nubes.
      const lift = 0.22 + j(6) * 0.2;
      const fog = 1 - smooth(lift, lift + 0.18, t);
      return W({ cloud: lerp(0.85, 0.3 + j(5) * 0.2, smooth(lift, lift + 0.3, t)), fog, wind: 0 });
    }
    case 'lluvia':
    case 'tormenta':
    case 'nieve': {
      // Se va cubriendo y, ya cubierto, empieza; algunos días para antes del anochecer.
      const a = 0.1 + j(6) * 0.4;
      const stop = j(7) < 0.4 ? a + 0.3 + j(8) * 0.2 : 2;
      const on = smooth(a + 0.06, a + 0.2, t) * (1 - smooth(stop, stop + 0.14, t));
      const cloud = Math.max(lerp(0.45, 1, smooth(a - 0.15, a + 0.05, t)), on);
      const k = kind === 'tormenta' ? 1 : 0.5 + j(9) * 0.35;
      return W({
        cloud,
        rain: kind === 'nieve' ? 0 : on * k,
        snow: kind === 'nieve' ? on * k : 0,
        storm: kind === 'tormenta' ? on : 0,
        wind: kind === 'tormenta' ? 0.5 + on * 0.4 : wind + on * 0.2,
      });
    }
  }
}

const KEYS: (keyof Weather)[] = ['cloud', 'fog', 'rain', 'snow', 'wind', 'storm'];

/**
 * Acerca `cur` a `target` sin saltos: un paso de `dt` segundos con un tiempo de `tau` segundos
 * (lo que tarda en hacer casi dos tercios del camino).
 */
export function approach(cur: Weather, target: Weather, dt: number, tau: number): Weather {
  const k = 1 - Math.exp(-Math.max(0, dt) / tau);
  const out = { ...cur };
  for (const key of KEYS) out[key] = cur[key] + (target[key] - cur[key]) * k;
  return out;
}
