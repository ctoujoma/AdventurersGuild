/**
 * El paisaje de la tira del encargo en curso (`world/tripStrip.ts`): una banda baja y ancha con
 * el terreno del sitio. A la izquierda y a la derecha, la taberna (sale y vuelve); en medio, lo
 * propio del sitio (el vado, la cueva de la sierra, la laguna, el pueblo, las ruinas…); por el
 * camino, árboles y matas según el terreno. Se pinta de día y sin cielo: el cielo, la noche y lo
 * que se mueve los pone la tira.
 */
import { Rng } from '../core/rng';
import type { Terrain } from '../data/places';
import { P, darker } from './palette';
import { PixelBuffer, bayer } from './pixel';
import { sprite } from './pets';

/** Alto del paisaje (sin la franja de la línea del viaje) y fila donde pisan. */
export const LAND_H = 54;
export const LAND_GROUND = 50;

interface Look {
  far: string;
  farD: string;
  grass: string;
  grassD: string;
  tree: string;
  treeD: string;
  path: string;
  /** Árboles por el camino (0–1). */
  trees: number;
}

const LOOK: Record<Terrain, Look> = {
  campo: {
    far: P.leaf,
    farD: P.forest,
    grass: P.lime,
    grassD: P.leaf,
    tree: P.leaf,
    treeD: P.forest,
    path: P.tan,
    trees: 0.25,
  },
  bosque: {
    far: P.forest,
    farD: P.deep,
    grass: P.leaf,
    grassD: P.forest,
    tree: P.forest,
    treeD: P.deep,
    path: P.clay,
    trees: 0.8,
  },
  monte: {
    far: P.steel,
    farD: P.slate,
    grass: P.clay,
    grassD: P.rust,
    tree: P.forest,
    treeD: P.deep,
    path: P.tan,
    trees: 0.2,
  },
  rio: {
    far: P.leaf,
    farD: P.forest,
    grass: P.lime,
    grassD: P.leaf,
    tree: P.leaf,
    treeD: P.forest,
    path: P.sand,
    trees: 0.35,
  },
  costa: {
    far: P.ocean,
    farD: P.ocean,
    grass: P.leaf,
    grassD: P.forest,
    tree: P.leaf,
    treeD: P.forest,
    path: P.sand,
    trees: 0.15,
  },
  pantano: {
    far: P.forest,
    farD: P.deep,
    grass: P.forest,
    grassD: P.deep,
    tree: P.umber,
    treeD: P.bark,
    path: P.clay,
    trees: 0.4,
  },
  pueblo: {
    far: P.leaf,
    farD: P.forest,
    grass: P.lime,
    grassD: P.leaf,
    tree: P.leaf,
    treeD: P.forest,
    path: P.sand,
    trees: 0.2,
  },
  ruina: {
    far: P.slate,
    farD: P.navy,
    grass: P.leaf,
    grassD: P.forest,
    tree: P.forest,
    treeD: P.deep,
    path: P.clay,
    trees: 0.3,
  },
};

/** Un árbol de copa redonda (o seco, en el pantano). */
function tree(b: PixelBuffer, x: number, base: number, h: number, l: Look, dead: boolean): void {
  b.vline(x, base - h, h, P.bark);
  b.vline(x + 1, base - h + 2, h - 2, P.umber);
  if (dead) {
    b.line(x, base - h + 3, x - 3, base - h, P.bark);
    b.line(x + 1, base - h + 5, x + 4, base - h + 2, P.bark);
    return;
  }
  const r = Math.max(3, Math.round(h * 0.45));
  b.ellipse(x + 0.5, base - h, r, r * 0.9, (px, py) =>
    py < base - h - r * 0.3 && px < x ? l.tree : (px + py) % 5 ? l.treeD : l.tree,
  );
}

/** Un pino (sierra y bosque). */
function pine(b: PixelBuffer, x: number, base: number, h: number, l: Look): void {
  b.vline(x, base - 3, 3, P.bark);
  for (let y = 0; y < h - 2; y++) {
    const half = Math.round(((y + 1) / (h - 2)) * (h / 3)) - (y % 3 === 0 ? 1 : 0);
    b.hline(x - half, base - h + y, half * 2 + 1, y % 3 === 1 ? l.tree : l.treeD);
  }
}

/** Una casita: paredes, tejado y ventana con luz. */
function house(b: PixelBuffer, x: number, base: number, w: number, h: number, roof: string): void {
  b.rect(x, base - h, w, h, P.sand);
  b.vline(x, base - h, h, P.tan);
  for (let i = 0; i < Math.ceil(w / 2) + 1; i++)
    b.hline(
      x - 1 + i,
      base - h - 1 - i,
      Math.max(1, w + 2 - i * 2),
      i % 2 ? roof : darker(roof, 1),
    );
  b.rect(x + 2, base - 4, 2, 4, P.bark);
  if (w > 7) b.rect(x + w - 4, base - h + 2, 2, 2, P.gold);
}

/** La taberna en pequeño: dos plantas, tejado rojo, chimenea y el letrero. */
export function tinyTavern(): PixelBuffer {
  return sprite(
    [
      '.........cc...',
      '.....rrrrcc...',
      '....rrRRRRrr..',
      '...rrRRRRRRrr.',
      '..rrRRRRRRRRrr',
      '...wwwwwwwwww.',
      '...wyywwwwyyw.',
      '...wyywwwwyyw.',
      '...wwwwwwwwww.',
      '.ss.wwwddwww..',
      '.Ss.wyywddyy..',
      '..k.wwwddwww..',
    ],
    {
      r: P.brick,
      R: P.wine,
      c: P.slate,
      w: P.tan,
      y: P.gold,
      d: P.bark,
      s: P.oak,
      S: P.lemon,
      k: P.bark,
    },
  );
}

/** El carro de la escolta: caja de madera con lona y dos ruedas. */
export function cart(): PixelBuffer {
  return sprite(
    [
      '...mmmmmmmm..',
      '..mMMMMMMMMm.',
      '..mMMMMMMMMm.',
      'ooooooooooooo',
      'OoooooooooooO',
      '.OOOOOOOOOOO.',
      '..ww.....ww..',
      '.wkkw...wkkw.',
      '..ww.....ww..',
    ],
    { m: P.sand, M: P.mist, o: P.oak, O: P.rust, w: P.bark, k: P.tan },
  );
}

/** Un cofre (lo que buscan al explorar o recuperar). */
export function chest(open: boolean): PixelBuffer {
  return sprite(
    open
      ? ['.oooooo.', 'oOOOOOOo', 'gyyyyyyg', 'oooggooo', 'oOOggOOo', 'oOOOOOOo']
      : ['.oooooo.', 'oOOOOOOo', 'oooooooo', 'gggyyggg', 'oOOggOOo', 'oOOOOOOo'],
    { o: P.oak, O: P.rust, g: P.gold, y: P.lemon },
  );
}

/** El botín a la espalda, al volver: un saco atado (con oro asomando si fue brillante). */
export function loot(rich: boolean): PixelBuffer {
  return sprite(
    rich
      ? ['..yk..', '.ykky.', 'sSSSSs', 'sSSSSs', 'sSSSSs', '.ssss.']
      : ['..kk..', '..kk..', '.sSSs.', 'sSSSSs', 'sSSSSs', '.ssss.'],
    { s: P.umber, S: P.tan, k: P.bark, y: P.lemon },
  );
}

/** El río, de `from` hacia abajo, con las piedras del vado en el camino. */
function ford(b: PixelBuffer, mid: number, from: number): void {
  for (let y = from; y < LAND_H; y++) {
    const half = 5 + Math.round((y - 40) * 0.5);
    const cx = mid + Math.round(Math.sin(y * 0.4) * 2);
    b.hline(cx - half, y, half * 2, y % 3 ? P.sky : P.cyan);
  }
  for (const dx of [-6, -1, 4]) b.rect(mid + dx, LAND_GROUND - 1, 3, 2, P.fog);
}

/** Lo propio del sitio, en el tramo de en medio (`x0`–`x1`). */
function landmark(b: PixelBuffer, t: Terrain, x0: number, x1: number, l: Look, rng: Rng): void {
  const G = LAND_GROUND;
  const mid = Math.round((x0 + x1) / 2);
  switch (t) {
    case 'rio': {
      // El río cruza el camino por un vado con piedras.
      ford(b, mid, 40);
      for (let i = 0; i < 5; i++) b.vline(mid - 12 + i * 6 + rng.int(0, 2), 40, 4, P.leaf);
      break;
    }
    case 'monte': {
      // La boca de la cueva en la sierra.
      b.ellipse(mid, G - 6, 16, 18, (x, y) => (y < G - 18 && x < mid ? P.fog : P.steel));
      b.ellipse(mid + 2, G - 3, 6, 8, P.black);
      for (let i = 0; i < 6; i++)
        b.rect(mid - 14 + rng.int(0, 26), G - rng.int(1, 3), 2, 2, P.slate);
      break;
    }
    case 'costa': {
      // El mar al fondo y la arena.
      b.rect(x0 - 10, 30, x1 - x0 + 20, 8, P.ocean);
      for (let x = x0 - 10; x < x1 + 10; x += 3) b.set(x, 31 + (x % 5), P.sky);
      b.rect(x0 - 4, 38, x1 - x0 + 8, 6, P.sand);
      b.vline(mid + 10, 26, 12, P.bark);
      b.rect(mid + 7, 26, 7, 4, P.mist);
      break;
    }
    case 'pantano': {
      // Charcas oscuras, juncos y niebla.
      for (let i = 0; i < 3; i++) {
        const cx = x0 + 8 + i * Math.round((x1 - x0 - 16) / 2);
        b.ellipse(cx, 45, 8, 1.5, P.deep);
        b.hline(cx - 3, 45, 3, P.ocean);
      }
      for (let i = 0; i < 8; i++) b.vline(x0 + rng.int(0, x1 - x0), 40, 4, P.leaf);
      for (let x = x0 - 8; x < x1 + 8; x++)
        for (let y = 36; y < 42; y++) if (bayer(x, y) < 0.18) b.set(x, y, P.mist);
      break;
    }
    case 'pueblo':
      house(b, mid - 18, 44, 10, 7, P.brick);
      house(b, mid - 4, 44, 9, 9, P.rust);
      house(b, mid + 9, 44, 11, 7, P.brick);
      break;
    case 'ruina':
      // Muros rotos y columnas.
      for (const [dx, h] of [
        [-16, 14],
        [-8, 8],
        [6, 18],
        [14, 6],
      ] as const) {
        b.rect(mid + dx, G - 6 - h, 4, h, P.fog);
        b.vline(mid + dx, G - 6 - h, h, P.mist);
        b.rect(mid + dx - 1, G - 6 - h, 6, 2, P.steel);
      }
      b.rect(mid - 20, G - 8, 40, 2, P.steel);
      break;
    case 'bosque':
      for (let i = 0; i < 6; i++)
        pine(b, x0 + 4 + i * Math.round((x1 - x0) / 6), 44, 16 + rng.int(0, 6), l);
      break;
    case 'campo':
      // Un campo arado con su almiar y la cerca.
      for (let y = 38; y < 44; y += 2) b.hline(x0, y, x1 - x0, y % 4 ? P.gold : P.amber);
      b.ellipse(mid + 6, 36, 5, 5, (x) => (x < mid + 5 ? P.lemon : P.gold));
      for (let x = x0; x < x1; x += 5) b.vline(x, 41, 3, P.oak);
      b.hline(x0, 42, x1 - x0, P.oak);
      break;
  }
}

const cache = new Map<string, PixelBuffer>();

/**
 * El paisaje entero para una tira de `w` de ancho: lo lejano, los árboles, el sitio en el tramo
 * `site` (de x a x), el suelo con el camino y la taberna en los dos extremos.
 */
export function tripLand(
  terrain: Terrain,
  w: number,
  site: [number, number],
  seed: string,
): PixelBuffer {
  const key = `${terrain}:${w}:${site.join(',')}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const l = LOOK[terrain];
  const rng = new Rng(`tira-${seed}`);
  const b = new PixelBuffer(w, LAND_H);
  const G = LAND_GROUND;
  // Lo lejano: colinas (o la sierra, con nieve) contra el cielo.
  const high = terrain === 'monte' ? 22 : 10;
  const ph = rng.next() * 6;
  for (let x = 0; x < w; x++) {
    const top = Math.round(
      38 - high * (0.5 + 0.5 * Math.sin(x * 0.045 + ph)) - 3 * Math.sin(x * 0.17 + ph * 2),
    );
    for (let y = top; y < 44; y++)
      b.set(
        x,
        y,
        y - top < 2 && terrain === 'monte' && top < 24 ? P.mist : (x + y) % 7 ? l.far : l.farD,
      );
  }
  // Más cerca, una loma con el verde del sitio.
  for (let x = 0; x < w; x++) {
    const top = Math.round(40 - 3 * (0.5 + 0.5 * Math.sin(x * 0.08 + ph * 3)));
    for (let y = top; y < 44; y++) b.set(x, y, l.grassD);
  }
  // Árboles por el camino (lejos de la taberna y del sitio).
  for (let x = 20; x < w - 20; x += rng.int(6, 12)) {
    if (x > site[0] - 6 && x < site[1] + 6) continue;
    if (!rng.chance(l.trees)) continue;
    const h = rng.int(7, 12);
    if (terrain === 'monte' || (terrain === 'bosque' && rng.chance(0.5))) pine(b, x, 44, h + 3, l);
    else tree(b, x, 44, h, l, terrain === 'pantano');
  }
  landmark(b, terrain, site[0], site[1], l, rng);
  // El suelo: hierba, el camino de tierra por donde andan y el borde de abajo.
  for (let y = 44; y < LAND_H; y++)
    for (let x = 0; x < w; x++) {
      if (alphaAt(b, x, y) && y < 46) continue;
      const road = y >= G - 3 && y <= G + 1;
      const c = road
        ? (x * 3 + y) % 11
          ? l.path
          : darker(l.path, 1)
        : y > G + 1
          ? l.grassD
          : (x + y * 2) % 9
            ? l.grass
            : l.grassD;
      b.set(x, y, c);
    }
  // El río cruza también el camino (el vado).
  if (terrain === 'rio') ford(b, Math.round((site[0] + site[1]) / 2), 46);
  // Matas sueltas al borde del camino.
  for (let x = 4; x < w; x += rng.int(5, 11)) b.set(x, G - 4, l.grassD);
  // La taberna, a la izquierda: se sale de ella y se vuelve a ella por el mismo camino.
  const tav = tinyTavern();
  b.blit(tav, 0, G - tav.h + 1);
  cache.set(key, b);
  return b;
}

const alphaAt = (b: PixelBuffer, x: number, y: number) => b.get(x, y) >>> 24 !== 0;
