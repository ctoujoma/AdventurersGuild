/**
 * Caché de dibujos caros entre un montaje de la escena y el siguiente (al pagar obras o cambiar
 * algo del edificio se rehace todo, y casi todo sale igual). Solo para dibujos puros: con el
 * mismo encargo (la clave), el mismo resultado. Lo que devuelve es compartido: se lee, no se
 * pinta encima (para eso, `clone()`).
 *
 * Se olvida lo menos usado cuando lo guardado pasa de `BUDGET` píxeles.
 */
import type { PixelBuffer } from '../../art/pixel';

const BUDGET = 10_000_000;
const store = new Map<string, { v: unknown; px: number }>();
let used = 0;

/** Lo que ocupa un valor guardado (en píxeles; un búfer de dibujo, su área). */
const sizeOf = (v: unknown): number => {
  if (Array.isArray(v)) return v.reduce((n: number, x) => n + sizeOf(x), 0);
  if (v && typeof v === 'object') {
    if ('w' in v && 'h' in v) {
      const b = v as PixelBuffer;
      return b.w * b.h;
    }
    // Algo con su búfer dentro (el corte de la fachada).
    if ('buf' in v) return sizeOf(v.buf);
  }
  return 1000;
};

/** El dibujo de `key` si ya se hizo; si no, lo hace con `make` y lo guarda. */
export function memo<T>(key: string, make: () => T, px?: number): T {
  const hit = store.get(key);
  if (hit) {
    // Al final de la lista: lo último usado es lo último en olvidarse.
    store.delete(key);
    store.set(key, hit);
    return hit.v as T;
  }
  const v = make();
  const size = px ?? sizeOf(v);
  store.set(key, { v, px: size });
  used += size;
  for (const [k, e] of store) {
    if (used <= BUDGET || k === key) break;
    store.delete(k);
    used -= e.px;
  }
  return v;
}

/** Lo que se ha hecho a partir de cada búfer (por búfer y clave): muere con él. */
const derived = new WeakMap<object, Map<string, unknown>>();

/** Un dibujo hecho a partir de otro (`src`, compartido y sin tocar): se guarda mientras viva `src`. */
export function memoOf<T>(src: object, key: string, make: () => T): T {
  let m = derived.get(src);
  if (!m) derived.set(src, (m = new Map()));
  if (m.has(key)) return m.get(key) as T;
  const v = make();
  m.set(key, v);
  return v;
}

/** Vacía la caché (para las pruebas). */
export function forget(): void {
  store.clear();
  used = 0;
}
