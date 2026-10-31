/**
 * Los tramos de escalera: dónde cae cada peldaño (para pintarlos y para que la gente los pise)
 * y su dibujo. Cada tramo sube de una planta a la de encima dentro de su columna, de perfil:
 * en las plantas pares, de izquierda a derecha; en las impares, al revés (en zigzag). Se pinta
 * como una pieza a `FLIGHT_Z`, y quien sube va justo delante, a `CLIMB_Z`, peldaño a peldaño.
 */
import { P } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import { PARTITION, PITCH, ROOM_H, STAIR_W, floorY } from './layout';
import { scaleAt } from './view3d';

/** Peldaños de un tramo (el último es ya el suelo de arriba). */
export const STEPS = 12;
export const RISE = PITCH / STEPS;
/** Profundidad del tramo y de quien sube por él (justo delante). */
export const FLIGHT_Z = 44;
export const CLIMB_Z = FLIGHT_Z - 2;
/** Ancho de un peldaño, en el mundo, y sitio a cada lado dentro de la columna. */
const TREAD = 8;
const INNER = STAIR_W - PARTITION;
const MARGIN = 0.5;

/** Si el tramo que sube desde `floor` va hacia la derecha. */
export const goesRight = (floor: number) => ((floor % 2) + 2) % 2 === 0;

/**
 * Dónde se pisa el peldaño `i` (0 = el suelo de abajo, `STEPS` = el de arriba) del tramo que
 * sube desde `floor` en la columna cuyo hueco empieza en `x`: el centro del peldaño y su altura.
 */
export function stepAt(x: number, floor: number, i: number): { x: number; y: number } {
  const span = INNER - 2 * MARGIN - TREAD;
  const t = Math.max(0, Math.min(1, (i - 1) / (STEPS - 2)));
  const dx = MARGIN + TREAD / 2 + (goesRight(floor) ? t : 1 - t) * span;
  return { x: x + PARTITION / 2 + dx, y: floorY(floor) - i * RISE };
}

/**
 * El tramo pintado: la zanca, los peldaños abiertos (se ve la pared entre uno y otro) con su
 * canto claro, y el pilar de arranque. (El pasamanos va en la pared del fondo.) Mide el
 * interior de la columna de ancho y el alto de la planta.
 */
export function flightArt(floor: number): PixelBuffer {
  const k = scaleAt(FLIGHT_Z);
  const w = Math.round(INNER * k);
  const h = Math.round(ROOM_H * k);
  const right = goesRight(floor);
  const W = [P.black, P.plum, P.bark, P.rust, P.oak, P.clay, P.tan];
  const b = new PixelBuffer(w, h);
  // En píxeles de la pieza, de izquierda a derecha (luego se voltea si sube a la izquierda).
  const px = (i: number) => (stepAt(0, 0, i).x - PARTITION / 2) * k;
  const py = (i: number) => h - i * RISE * k;
  const tw = Math.round(TREAD * k);
  const visible = Math.floor(ROOM_H / RISE);
  // La zanca: tres píxeles en diagonal (el de arriba, claro) bajo el borde de atrás de los peldaños.
  const z0 = { x: Math.round(px(0.5)), y: h - 1 };
  const z1 = { x: Math.round(px(visible + 1)), y: Math.round(py(visible + 1)) };
  b.line(z0.x - 1, z0.y, z1.x - 1, z1.y, W[5]!);
  b.line(z0.x, z0.y, z1.x, z1.y, W[3]!);
  b.line(z0.x + 1, z0.y, z1.x + 1, z1.y, W[1]!);
  for (let i = 1; i <= visible; i++) {
    const x = Math.round(px(i) - tw / 2);
    const y = Math.round(py(i));
    // Huella: canto claro, la cara y la sombra de debajo (sin tabica: escalón abierto).
    b.hline(x, y, tw, W[6]!);
    b.hline(x, y + 1, tw, W[5]!);
    b.hline(x, y + 2, tw, W[3]!);
    b.hline(x, y + 3, tw, W[1]!);
    b.set(x + tw - 1, y + 1, W[3]!);
  }
  // El pilar de arranque, con su bola, junto al primer peldaño.
  const nx = Math.round(px(1) - tw / 2) - 2;
  const top = Math.round(py(1) - 12 * k);
  b.rect(nx, top, 2, h - top, W[3]!);
  b.vline(nx, top, h - top, W[5]!);
  b.rect(nx - 1, top - 2, 4, 2, W[4]!);
  b.hline(nx - 1, top - 2, 4, W[6]!);
  if (right) return b;
  const m = new PixelBuffer(w, h);
  m.blit(b, 0, 0, true);
  return m;
}
