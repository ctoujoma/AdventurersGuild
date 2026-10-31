import type { Sfx } from '../audio/audio';

/**
 * Vibración del móvil para los momentos con peso: golpes en la pelea, el cuerno del asalto,
 * monedas, obras terminadas y la fiesta al volver. Va atada a los efectos de sonido, pero
 * suena aunque el sonido esté apagado. Se puede quitar en Ajustes.
 */
const PATTERNS: Partial<Record<Sfx, number | number[]>> = {
  select: 8,
  bell: [10, 60, 10],
  coin: 14,
  depart: 22,
  build: [20, 40, 20],
  hammer: 12,
  creak: 10,
  impact: 28,
  hit: 22,
  thud: 30,
  boom: 45,
  thunder: [40, 30, 60],
  roar: [30, 20, 30],
  horn: [80, 60, 80],
  cheer: [25, 50, 25, 50, 60],
};

/** Separación mínima entre vibraciones sueltas, para que una pelea no zumbe sin parar. */
const GAP = 0.12;

let enabled = true;
let last = 0;

export const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function setHaptics(on: boolean): void {
  enabled = on;
}

export function haptic(name: Sfx): void {
  const p = PATTERNS[name];
  if (!enabled || p === undefined || !canVibrate()) return;
  const now = performance.now() / 1000;
  if (typeof p === 'number' && now - last < GAP) return;
  last = now;
  try {
    navigator.vibrate(p);
  } catch {
    /* algunos navegadores lo bloquean hasta que se toca la pantalla */
  }
}
