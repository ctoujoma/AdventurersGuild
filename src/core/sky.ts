/**
 * El tipo de día (despejado, lluvia, tormenta…): sale solo de la semilla y el día, así que el
 * núcleo puede saber si la noche es de tormenta sin tocar la escena. Cómo se ve cada tipo a cada
 * hora está en `world/weather.ts`, que usa esto.
 */

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

/** Un número de 0 a 1 que solo depende de la semilla, el día y una sal. */
export function skyHash(seed: string, day: number, salt: number): number {
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
  const r = skyHash(seed, day, 1);
  if (r < 0.35) return 'despejado';
  if (r < 0.4) return 'viento';
  if (r < 0.65) return 'nubes';
  if (r < 0.77) return 'nublado';
  if (r < 0.85) return 'niebla';
  if (r < 0.91) return 'lluvia';
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

/**
 * Los días de lluvia, tormenta o nieve: la parte del día (0 amanecer, 1 anochecer) en que se
 * cubre (`start`) y en la que para (`stop`; 2 si no para). Las tormentas no amainan antes de
 * la noche: así cada día de tormenta tiene su noche de tormenta.
 */
export function rainSpan(seed: string, day: number): { start: number; stop: number } {
  const start = 0.1 + skyHash(seed, day, 6) * 0.4;
  const stops = dayKind(seed, day) !== 'tormenta' && skyHash(seed, day, 7) < 0.4;
  return { start, stop: stops ? start + 0.3 + skyHash(seed, day, 8) * 0.2 : 2 };
}

/** Si la noche del día `day` es de tormenta (la que se ve desde que se van a dormir). */
export const stormNight = (seed: string, day: number) => dayKind(seed, day) === 'tormenta';

/** Si la noche del día `day` es de niebla o de tormenta (pasan más cosas, ver `core/night.ts`). */
export const roughNight = (seed: string, day: number) => {
  const k = dayKind(seed, day);
  return k === 'niebla' || k === 'tormenta';
};
