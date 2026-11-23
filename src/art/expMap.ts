/**
 * El mapa de rumbos de las expediciones (bloque 3; EX16): unas tres veces el de la comarca, con
 * ella en el centro y alrededor la sierra (norte), el bosque (este), las marismas (suroeste), las
 * ruinas (sureste) y el mar (oeste), bajo una niebla que se despeja por donde pasan.
 *
 * Es un **marcador** hasta que llegue el dibujo del agente de arte (`docs/encargos/
 * arte-expediciones.md`, punto 6): manchas de color por rumbo con un poco de trama. La geometría
 * (`expPoint`: dónde cae un rumbo a tantos días) es la que usa la interfaz para poner encima los
 * grupos, los parajes y los fardos; el dibujo bueno puede cambiar sin tocarla.
 */
import type { Heading } from '../core/model';
import { MAP_H, MAP_W, TAVERN } from '../data/places';
import { mapBuffer, type MapStyle } from './map';
import { fbm } from './mapTerrain';
import { P } from './palette';
import { PixelBuffer, bayer, type Color } from './pixel';

export const WORLD_W = MAP_W * 3;
export const WORLD_H = MAP_H * 3;
/** Dónde cae la esquina de la comarca dentro del mapa grande. */
export const OX = MAP_W;
export const OY = MAP_H;
/** Píxeles por día de lejanía, pasada la comarca. */
export const PX_DAY = 34;

/** Hacia dónde sale cada rumbo desde la taberna (radianes; 0 = este, y hacia abajo). */
const ANGLE: Record<Heading, number> = {
  bosque: 0,
  sierra: -Math.PI / 2,
  marismas: (3 * Math.PI) / 4,
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

type Region = Heading | 'mar';
const COLOR: Record<Region, readonly Color[]> = {
  bosque: [P.deep, P.forest, P.forest, P.leaf],
  sierra: [P.slate, P.steel, P.fog, P.mist],
  marismas: [P.forest, P.ocean, P.leaf, P.lime],
  ruinas: [P.umber, P.clay, P.tan, P.sand],
  mar: [P.navy, P.navy, P.ocean, P.sky],
};

/** El rumbo más cercano en ángulo (con algo de ruido en las lindes); al oeste, el mar. */
function regionAt(x: number, y: number): Region {
  const a = Math.atan2(y - (OY + TAVERN.y), x - (OX + TAVERN.x));
  const n = (fbm(x / 60, y / 60, 71, 3) - 0.5) * 0.9;
  const coast = OX - 30 + (fbm(0, y / 40, 72, 3) - 0.5) * 80;
  if (x < coast && !(y > OY + MAP_H && x > OX * 0.55)) return 'mar';
  let best: Region = 'bosque';
  let gap = Infinity;
  for (const h of Object.keys(ANGLE) as Heading[]) {
    const d = Math.abs(Math.atan2(Math.sin(a + n - ANGLE[h]), Math.cos(a + n - ANGLE[h])));
    if (d < gap) {
      gap = d;
      best = h;
    }
  }
  return best;
}

const cache = new Map<MapStyle, PixelBuffer>();

/** El dibujo del mapa grande (con la comarca en medio), a juego con el estilo de la comarca. */
export function worldBuffer(style: MapStyle): PixelBuffer {
  const hit = cache.get(style);
  if (hit) return hit;
  const b = new PixelBuffer(WORLD_W, WORLD_H);
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < WORLD_W; x++) {
      if (x >= OX && x < OX + MAP_W && y >= OY && y < OY + MAP_H) continue;
      const r = COLOR[regionAt(x, y)];
      const v = fbm(x / 22, y / 22, 73, 3) + (bayer(x, y) - 0.5) * 0.25;
      b.set(x, y, r[Math.max(0, Math.min(r.length - 1, Math.floor(v * r.length)))]!);
    }
  b.blit(mapBuffer(style), OX, OY);
  cache.set(style, b);
  return b;
}

/** Lo que se ve: círculos (en píxeles del mapa grande) despejados de niebla. */
export interface Clear {
  x: number;
  y: number;
  r: number;
}

/** Lo ya recorrido de un rumbo hasta `dist` días, como círculos despejados. */
export function trailClears(h: Heading, dist: number, r = 26): Clear[] {
  const out: Clear[] = [];
  for (let d = 0; d <= dist + 1e-9; d += 0.15) out.push({ ...expPoint(h, d), r });
  if (dist > 0) out.push({ ...expPoint(h, dist), r });
  return out;
}

/**
 * La niebla del mapa grande: espesa lejos de lo visto, con borde tramado. La comarca, siempre
 * despejada (tiene su propia niebla en el mapa de la comarca). Se pinta a bloques de 2 × 2.
 */
export function worldFog(clears: readonly Clear[], style: MapStyle): PixelBuffer {
  const S = 2;
  const w = WORLD_W / S;
  const h = WORLD_H / S;
  const far = new Float32Array(w * h).fill(Infinity);
  // Lo de fuera de la comarca: a qué distancia queda del rectángulo.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const px = x * S;
      const py = y * S;
      const dx = Math.max(OX - px, 0, px - (OX + MAP_W));
      const dy = Math.max(OY - py, 0, py - (OY + MAP_H));
      far[y * w + x] = Math.hypot(dx, dy) + 6;
    }
  for (const c of clears) {
    const x0 = Math.max(0, Math.floor((c.x - c.r - 40) / S));
    const x1 = Math.min(w - 1, Math.ceil((c.x + c.r + 40) / S));
    const y0 = Math.max(0, Math.floor((c.y - c.r - 40) / S));
    const y1 = Math.min(h - 1, Math.ceil((c.y + c.r + 40) / S));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x * S - c.x, y * S - c.y) - c.r;
        if (d < far[y * w + x]!) far[y * w + x] = d;
      }
  }
  const lo = [P.fog, P.mist, P.white];
  const b = new PixelBuffer(WORLD_W, WORLD_H);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const best = far[y * w + x]!;
      if (best <= 0) continue;
      const d = Math.min(1, best / 30) + (fbm(x / 14, y / 9, 131, 3) - 0.5) * 0.8;
      if (d < 0.3) continue;
      if (d < 0.42 && bayer(x, y) >= (d - 0.3) / 0.12) continue;
      if (style === 'color') {
        const c = d < 0.55 ? lo[0]! : d < 0.8 ? lo[1]! : lo[2]!;
        b.rect(x * S, y * S, S, S, c);
        continue;
      }
      // Pergamino: «tierra ignota», rayada en diagonal.
      for (let k = 0; k < S * S; k++) {
        const px = x * S + (k % S);
        const py = y * S + Math.floor(k / S);
        b.set(px, py, (px + py) % 6 === 0 ? P.tan : d < 0.55 ? P.tan : P.sand);
      }
    }
  return b;
}
