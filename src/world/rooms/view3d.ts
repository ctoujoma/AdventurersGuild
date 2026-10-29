/**
 * La cámara de la vista 3D, en cuentas puras (sin three.js): el plano de corte del edificio se
 * ve a escala 1 (un píxel del mundo, un píxel de la vista) y lo de detrás encoge con la
 * profundidad. El ojo está siempre a la misma distancia del corte, así que la pared del fondo
 * de cada sala sale siempre a la misma escala, BACK, y se puede pintar a ese tamaño: pixel art
 * sin píxeles que bailen al mover la cámara.
 */
import { DEPTH } from './layout';

/** Escala de la pared del fondo respecto al plano de corte. */
export const BACK = 4 / 5;
/** Distancia del ojo al plano de corte (con ella, el fondo sale justo a BACK). */
export const EYE = (DEPTH * BACK) / (1 - BACK);
/** El ojo va algo más alto que el centro de la vista: se ve más suelo que techo. */
export const LIFT = 30;

/** Escala en pantalla de lo que está a `depth` por detrás del plano de corte. */
export const scaleAt = (depth: number) => EYE / (EYE + depth);

/** Lo que mira la cámara: esquina y tamaño de la vista en píxeles del mundo (y hacia abajo). */
export interface View {
  px: number;
  py: number;
  vw: number;
  vh: number;
}

/** Dónde está el ojo, en coordenadas del mundo (por delante del plano de corte, a EYE). */
export const eyeOf = (v: View) => ({ x: v.px + v.vw / 2, y: v.py + v.vh / 2 - LIFT });

/** Píxel de la vista en el que cae un punto del mundo a cierta profundidad. */
export function project(v: View, x: number, y: number, depth: number): { x: number; y: number } {
  const e = eyeOf(v);
  const k = scaleAt(depth);
  return { x: e.x + (x - e.x) * k - v.px, y: e.y + (y - e.y) * k - v.py };
}

/**
 * Bordes del encuadre en el plano cercano, con el eje y hacia arriba (como en three.js): el
 * rectángulo de la vista en el plano de corte llena justo la pantalla.
 */
export function frustum(v: View, near: number) {
  const e = eyeOf(v);
  const s = near / EYE;
  return {
    left: (v.px - e.x) * s,
    right: (v.px + v.vw - e.x) * s,
    top: (e.y - v.py) * s,
    bottom: (e.y - v.py - v.vh) * s,
  };
}

/**
 * Tamaño en el mundo de una figura plana colocada a `depth`, para que en pantalla mida lo
 * mismo que su dibujo (sin que la perspectiva le coma o le duplique píxeles).
 */
export const nativeSize = (px: number, depth: number) => px / scaleAt(depth);

/**
 * Lo que hay que correr una figura plana (su esquina de arriba a la izquierda en `p`, a escala
 * `k`) para que quede a un número entero de píxeles de la pared del fondo de su sala (su
 * esquina en `wx`, `wy`, a escala BACK). La distancia que da la perspectiva se redondea una vez:
 * así la figura no baila un píxel contra la pared al mover la cámara.
 */
export function pinShift(
  v: View,
  p: { x: number; y: number },
  k: number,
  wx: number,
  wy: number,
): { x: number; y: number } {
  const e = eyeOf(v);
  const ax = (wx - e.x) * BACK;
  const ay = (wy - e.y) * BACK;
  const dx = Math.round((p.x - e.x) * k - ax);
  const dy = Math.round((p.y - e.y) * k - ay);
  return { x: e.x + (ax + dx) / k - p.x, y: e.y + (ay + dy) / k - p.y };
}
