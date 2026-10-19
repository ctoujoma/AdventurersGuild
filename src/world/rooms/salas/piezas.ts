/**
 * Pinceles pequeños que usan varias salas: tarros, estantes, sacos, panes, quesos, velas…
 * Pintan sobre un búfer en una posición; las piezas enteras (con su contorno) van en el fichero
 * de cada sala.
 */
import { P, type Ramp } from '../../../art/palette';
import type { PixelBuffer } from '../../../art/pixel';
import { W } from './kit';

/** Tonos de los tarros y botes: barro, loza, vidrio verde, miel y azul. */
const JARS: Ramp[] = [
  [P.rust, P.clay, P.tan],
  [P.steel, P.mist, P.white],
  [P.deep, P.forest, P.leaf],
  [P.brick, P.orange, P.gold],
  [P.navy, P.ocean, P.sky],
];

/** Un tarro de 4 de ancho con su base en `base` (fila de la tabla en la que se apoya). */
export function jar(b: PixelBuffer, x: number, base: number, kind: number, tall = false) {
  const [d, m, l] = JARS[kind % JARS.length]!;
  const h = tall ? 6 : 4;
  b.rect(x, base - h, 4, h, m!);
  b.vline(x, base - h + 1, h - 1, l!);
  b.vline(x + 3, base - h + 1, h - 1, d!);
  b.hline(x, base - h, 4, d!);
  // Tapa de tela o de corcho.
  b.hline(x + 1, base - h - 1, 2, kind % 2 ? P.sand : W[4]!);
}

/** Tabla de estante de `w` con su escuadra. */
export function shelf(b: PixelBuffer, x: number, y: number, w: number) {
  b.rect(x, y, w, 2, W[4]!);
  b.hline(x, y, w, W[5]!);
  b.hline(x, y + 2, w, W[1]!);
  b.set(x + 1, y + 3, W[2]!);
  b.set(x + w - 2, y + 3, W[2]!);
}

/** Saco de arpillera atado, de 8×9, con la esquina en `x, y`. */
export function sack(b: PixelBuffer, x: number, y: number, ramp: Ramp = [P.clay, P.tan, P.sand]) {
  b.ellipse(x + 4, y + 6, 4, 3.5, ramp[1]!);
  b.ellipse(x + 3, y + 5, 2.5, 2.5, ramp[2]!);
  b.rect(x + 3, y, 2, 3, ramp[1]!);
  b.hline(x + 2, y + 2, 4, ramp[0]!);
  b.hline(x + 1, y + 9, 6, ramp[0]!);
}

/** Pan redondo (5×3) apoyado en `base`. */
export function loaf(b: PixelBuffer, x: number, base: number) {
  b.hline(x + 1, base - 3, 3, P.tan);
  b.hline(x, base - 2, 5, P.clay);
  b.hline(x, base - 1, 5, P.rust);
  b.set(x + 2, base - 2, P.tan);
}

/** Queso en rueda (6×4) apoyado en `base`. */
export function cheese(b: PixelBuffer, x: number, base: number) {
  b.hline(x + 1, base - 4, 4, P.lemon);
  b.rect(x, base - 3, 6, 3, P.gold);
  b.hline(x, base - 1, 6, P.orange);
  b.set(x + 4, base - 2, P.orange);
}

/** Vela encendida de `h` de alto con su base en `base`. */
export function candleOn(b: PixelBuffer, x: number, base: number, h = 4) {
  b.rect(x, base - h, 2, h, P.sand);
  b.vline(x, base - h, h, P.white);
  b.set(x, base - h - 1, P.lemon);
  b.set(x + 1, base - h - 1, P.gold);
}

/** Ristra de ajos o manojo de hierbas colgando de `x, y` (de 5 de ancho y 9 de largo). */
export function herbs(b: PixelBuffer, x: number, y: number, garlic = false) {
  b.vline(x + 2, y, 2, P.black);
  if (garlic) {
    b.vline(x + 2, y + 2, 8, P.tan);
    for (let k = 0; k < 3; k++) {
      b.ellipse(x + 2 + (k % 2 ? 1 : -1) * 0.5, y + 4 + k * 2.5, 1.6, 1.4, P.sand);
      b.set(x + 2, y + 4 + k * 2, P.white);
    }
    return;
  }
  for (let k = 0; k < 7; k++) b.vline(x + 1 + (k % 3), y + 2 + k, 2, k % 2 ? P.leaf : P.forest);
}

/** Cobre: cazo o sartén colgados (6 de ancho), con brillo. */
export function copperPan(b: PixelBuffer, x: number, y: number) {
  b.vline(x + 3, y, 3, P.rust);
  b.ellipse(x + 3, y + 6, 3, 3, P.brick);
  b.ellipse(x + 2.5, y + 5.5, 2, 2, P.amber);
  b.set(x + 2, y + 5, P.gold);
}

/** Recorta lo pintado de `b` a lo que cumple `inside` (para formas que no son rectángulos). */
export function clip(b: PixelBuffer, inside: (x: number, y: number) => boolean) {
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (!inside(x, y)) b.clear(x, y);
}

/** Telaraña pequeña en una esquina de una pieza (para lo que está por reparar). */
export function web(b: PixelBuffer, x: number, y: number, dir: 1 | -1) {
  for (let k = 0; k < 5; k++) b.set(x + dir * k, y + k, P.fog);
  for (let k = 0; k < 5; k++) b.set(x + dir * k, y, k % 2 ? P.mist : P.fog);
  for (let k = 0; k < 5; k++) b.set(x, y + k, k % 2 ? P.mist : P.fog);
  b.set(x + dir * 2, y + 1, P.fog);
  b.set(x + dir, y + 2, P.fog);
}
