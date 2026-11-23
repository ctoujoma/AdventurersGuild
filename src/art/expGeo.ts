/**
 * La geometría del mapa de rumbos (bloque 3; EX16): cuánto mide, dónde cae la comarca y dónde
 * cae un rumbo a tantos días. La usan el dibujo (`expTerrain.ts`, `expMap.ts`) y la interfaz
 * (grupos, parajes y fardos encima).
 */
import type { Heading } from '../core/model';
import { MAP_H, MAP_W, TAVERN } from '../data/places';

export const WORLD_W = MAP_W * 3;
export const WORLD_H = MAP_H * 3;
/** Dónde cae la esquina de la comarca dentro del mapa grande. */
export const OX = MAP_W;
export const OY = MAP_H;
/** Píxeles por día de lejanía, pasada la comarca. */
export const PX_DAY = 34;

/**
 * Hacia dónde sale cada rumbo desde la taberna (radianes; 0 = este, y hacia abajo). Las marismas
 * van al sur-suroeste, no al suroeste justo: así el camino no se mete en la bahía de la comarca.
 */
export const ANGLE: Record<Heading, number> = {
  bosque: 0,
  sierra: -Math.PI / 2,
  marismas: (107 * Math.PI) / 180,
  ruinas: Math.PI / 4,
};
const PHASE: Record<Heading, number> = { bosque: 0.3, sierra: 1.9, marismas: 3.1, ruinas: 4.4 };

/** Distancia (px) de la taberna al borde de la comarca en esa dirección. */
function edge(a: number): number {
  const cx = Math.cos(a);
  const cy = Math.sin(a);
  const tx = cx > 1e-6 ? (MAP_W - TAVERN.x) / cx : cx < -1e-6 ? -TAVERN.x / cx : Infinity;
  const ty = cy > 1e-6 ? (MAP_H - TAVERN.y) / cy : cy < -1e-6 ? -TAVERN.y / cy : Infinity;
  return Math.min(tx, ty);
}

/**
 * Dónde cae, en el mapa grande, un punto del rumbo a `dist` días; `side` (−1 a 1) lo aparta a un
 * lado del camino (los parajes y los fardos). El primer día cruza la comarca; luego, `PX_DAY`.
 */
export function expPoint(h: Heading, dist: number, side = 0): { x: number; y: number } {
  const a = ANGLE[h];
  const e = edge(a);
  const d = Math.max(0, dist);
  const r = d <= 1 ? d * e : e + (d - 1) * PX_DAY;
  const wig = Math.sin(d * 1.7 + PHASE[h]) * 10 * Math.min(1, d) + side * 18;
  const x = OX + TAVERN.x + Math.cos(a) * r - Math.sin(a) * wig;
  const y = OY + TAVERN.y + Math.sin(a) * r + Math.cos(a) * wig;
  return {
    x: Math.max(8, Math.min(WORLD_W - 8, x)),
    y: Math.max(8, Math.min(WORLD_H - 8, y)),
  };
}

/** Lo más lejos (días) que da de sí un rumbo antes de tocar el borde del mapa. */
export function maxDist(h: Heading): number {
  let d = 1;
  for (;;) {
    const p = expPoint(h, d + 0.1);
    if (p.x <= 8 || p.y <= 8 || p.x >= WORLD_W - 8 || p.y >= WORLD_H - 8) return d;
    d += 0.1;
  }
}
