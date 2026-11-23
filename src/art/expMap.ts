/**
 * El mapa de rumbos de las expediciones (bloque 3; EX16): unas tres veces el de la comarca, con
 * ella en el centro y alrededor la sierra (norte), el bosque (este), las marismas (sur-suroeste),
 * las ruinas (sureste) y el mar (oeste), bajo una niebla que se despeja por donde pasan
 * (`expFog.ts`). Sigue a la sala de mapas como el de la comarca (`mapStyleFor`): pergamino a tinta
 * o terreno a color, los dos del mismo terreno (`expTerrain.ts`) y con los mismos pinceles que la
 * comarca, que va dentro tal cual. Encima, la estela de pasos de los grupos (`trailBuffer`) y las
 * marcas de parajes y fardos (`markBuffer`). La geometría (`expPoint`) está en `expGeo.ts`.
 */
import type { Heading } from '../core/model';
import { MARKS, expDeco } from './expArt';
import type { Clear } from './expFog';
import { WORLD_H, WORLD_W, expPoint } from './expGeo';
import { worldTerrain } from './expTerrain';
import type { MapStyle } from './map';
import { colorRender } from './mapColor';
import { inkRender } from './mapInk';
import { stamp } from './mapIcons';
import { P } from './palette';
import { PixelBuffer, type Color } from './pixel';

export { OX, OY, PX_DAY, WORLD_H, WORLD_W, expPoint } from './expGeo';
export type { Clear } from './expFog';

const cache = new Map<MapStyle, PixelBuffer>();

/** El dibujo, si ya está hecho (si no, `null`: hacerlo tarda un poco). */
export const peekWorld = (style: MapStyle): PixelBuffer | null => cache.get(style) ?? null;

/** El dibujo del mapa grande (con la comarca en medio), a juego con el estilo de la comarca. */
export function worldBuffer(style: MapStyle): PixelBuffer {
  const hit = cache.get(style);
  if (hit) return hit;
  const t = worldTerrain();
  const deco = expDeco(t, style);
  const b = style === 'color' ? colorRender(t, deco) : inkRender(t, deco);
  cache.set(style, b);
  return b;
}

/** Lo ya recorrido de un rumbo hasta `dist` días, como círculos despejados. */
export function trailClears(h: Heading, dist: number, r = 26): Clear[] {
  const out: Clear[] = [];
  for (let d = 0; d <= dist + 1e-9; d += 0.15) out.push({ ...expPoint(h, d), r });
  if (dist > 0) out.push({ ...expPoint(h, dist), r });
  return out;
}

/** Una estela: el rumbo, hasta dónde, y si es la de un grupo de ahora o la de antes (el récord). */
export interface Trail {
  h: Heading;
  dist: number;
  now: boolean;
}

/**
 * La estela de pasos: huellas que alternan izquierda y derecha a lo largo del camino. En
 * pergamino, a tinta roja (las de antes, desvaídas); a color, claras con su sombra, para que se
 * lean sobre cualquier suelo.
 */
export function trailBuffer(trails: readonly Trail[], style: MapStyle): PixelBuffer {
  const b = new PixelBuffer(WORLD_W, WORLD_H);
  // Las de antes primero; las de ahora, encima.
  for (const tr of [...trails].sort((a, c) => Number(a.now) - Number(c.now))) {
    const ink: Color = style === 'color' ? (tr.now ? P.white : P.sand) : tr.now ? P.wine : P.clay;
    const shade: Color | null = style === 'color' ? (tr.now ? P.black : P.ebony) : null;
    let prev = expPoint(tr.h, 0);
    let run = 0;
    let step = 0;
    const gap = tr.now ? 5 : 6;
    for (let d = 0.004; d <= tr.dist + 1e-9; d += 0.004) {
      const p = expPoint(tr.h, d);
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const len = Math.hypot(dx, dy);
      run += len;
      if (len > 0 && run >= gap) {
        run = 0;
        step++;
        if (d < 0.08) {
          prev = p;
          continue;
        }
        // Huella: dos píxeles en el sentido de la marcha, a un lado y al otro.
        const ux = dx / len;
        const uy = dy / len;
        const side = step % 2 ? 1.5 : -1.5;
        const x = Math.round(p.x - uy * side);
        const y = Math.round(p.y + ux * side);
        const x2 = Math.round(p.x - uy * side - ux);
        const y2 = Math.round(p.y + ux * side - uy);
        const pts = [x, y, x2, y2];
        if (shade)
          for (let k = 0; k < pts.length; k += 2) b.set(pts[k]! + 1, pts[k + 1]! + 1, shade);
        for (let k = 0; k < pts.length; k += 2) b.set(pts[k]!, pts[k + 1]!, ink);
      }
      prev = p;
    }
  }
  return b;
}

const markCache = new Map<string, PixelBuffer>();

/**
 * La marca de un paraje o de un fardo (`cofre`, `cueva`, `mina`, `torre`, `ruinas`, `santuario`,
 * `mercader`, `viajero`, `campamento`, `fardo`), con su contorno en tinta (pergamino) o negro
 * (color), como los lugares de la comarca. Lo que no se conoce sale como cofre.
 */
export function markBuffer(kind: string, style: MapStyle): PixelBuffer {
  const key = `${kind}|${style}`;
  const hit = markCache.get(key);
  if (hit) return hit;
  const ic = MARKS[kind] ?? MARKS.cofre!;
  const w = Math.max(...ic.rows.map((r) => r.length)) + 2;
  const h = ic.rows.length + 2;
  const b = new PixelBuffer(w, h);
  stamp(b, w >> 1, h - 2, ic.rows, ic.pal, style === 'color' ? P.black : P.bark);
  markCache.set(key, b);
  return b;
}
