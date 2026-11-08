/**
 * Pintar una sala por franjas: la pared del fondo pasa al color nuevo de izquierda a derecha,
 * una franja cada vez y, dentro de la que se está pintando, de arriba abajo (el pintor empieza
 * subido a la escalera y acaba de rodillas, por el zócalo). Lo usan la pared (`RoomScene`) y el
 * pintor (`crowd.ts`), así que los dos ven lo mismo.
 */

/** Ancho de cada franja, en píxeles del fondo. */
export const STRIPE = 6;

export interface Stripe {
  /** Franjas enteras ya pintadas y cuántas hay. */
  full: number;
  n: number;
  /** De la que se está pintando, lo que lleva de arriba abajo (0–1). */
  part: number;
}

/** Por dónde va una pared de `w` píxeles de ancho pintada en `frac` (0–1). */
export function stripeOf(frac: number, w: number): Stripe {
  const n = Math.max(1, Math.ceil(w / STRIPE));
  const u = Math.max(0, Math.min(1, frac)) * n;
  const full = Math.min(n, Math.floor(u));
  return { full, n, part: full >= n ? 0 : u - full };
}

/**
 * Copia en `dst` lo de `src` que ya está pintado (los dos de `w` × `h`, RGBA): las franjas
 * enteras y, de la que se está pintando, las filas de arriba.
 */
export function paintOver(dst: Uint8Array, src: Uint8Array, w: number, h: number, s: Stripe): void {
  const x1 = Math.min(w, s.full * STRIPE);
  const px1 = Math.min(w, x1 + STRIPE);
  const rows = Math.floor(s.part * h);
  for (let y = 0; y < h; y++) {
    const end = y < rows ? px1 : x1;
    if (end <= 0) continue;
    const i = y * w * 4;
    dst.set(src.subarray(i, i + end * 4), i);
  }
}
