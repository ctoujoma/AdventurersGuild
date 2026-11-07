/**
 * Lo que rompe la repetición de la fachada vista desde fuera: las testas de las vigas que
 * asoman de cada forjado, con su sombra, y unos pocos detalles sueltos, fijos por partida
 * (hiedra en una esquina, leña bajo un tejadillo, la bajante con su tonel de lluvia y una
 * escalera apoyada). Todo pinta su relieve (`b.level`) para la luz con ambiente.
 */
import { Rng } from '../../core/rng';
import { P } from '../../art/palette';
import type { PixelBuffer } from '../../art/pixel';
import { step } from './envejecer';

/** Oscurece un escalón lo ya pintado (la sombra de algo que sale de la pared). */
function shade(b: PixelBuffer, x: number, y: number) {
  if (!b.inside(x, y)) return;
  const i = y * b.w + x;
  const c = b.data[i]!;
  if (c >>> 24) b.data[i] = step(c, 'dark');
}

/**
 * Las testas de las vigas a lo largo de un forjado (de `x0` a `x1`, con su cara de arriba en
 * `y` y `h` de grueso): cada 14 a 30 píxeles, la punta de una viga de 6 × `h + 2` con los anillos
 * en la testa, que sobresale y deja su sombra debajo y a un lado.
 */
export function beamEnds(
  b: PixelBuffer,
  x0: number,
  x1: number,
  y: number,
  h: number,
  rng: Rng,
  avoid: (x: number) => boolean,
): void {
  // Cada tanto y a saltos (de dos en dos a veces, con huecos largos): no una fila de dientes.
  for (let x = x0 + 10 + rng.int(0, 30); x < x1 - 10; x += 34 + rng.int(0, 46)) {
    if (avoid(x)) continue;
    const pair = rng.chance(0.3);
    for (const xx of pair ? [x, x + 10] : [x]) {
      if (xx >= x1 - 8) continue;
      const w = 5;
      const top = y - 1;
      const bh = h + 2;
      // La sombra: debajo (dos filas) y a la derecha (una columna), en la pared.
      for (let i = 1; i <= w + 1; i++) {
        shade(b, xx + i, top + bh);
        shade(b, xx + i, top + bh + 1);
      }
      for (let j = 1; j < bh; j++) shade(b, xx + w, top + j);
      b.level = 6;
      b.rect(xx, top, w, bh, P.rust);
      b.hline(xx, top, w, P.oak);
      b.vline(xx, top, bh, P.oak);
      b.hline(xx, top + bh - 1, w, P.bark);
      b.vline(xx + w - 1, top + 1, bh - 1, P.bark);
      // Los anillos de la testa y alguna raja.
      b.set(xx + 2, top + Math.floor(bh / 2), P.bark);
      b.set(xx + 2, top + Math.floor(bh / 2) - 1, P.cocoa);
      if (rng.chance(0.5)) b.vline(xx + 1 + rng.int(0, 2), top + 1, 2 + rng.int(0, 2), P.bark);
    }
    b.level = 0;
  }
}

/**
 * Hiedra que trepa por una esquina: desde `x` (al pie, en `ground`) sube hasta `top`, más
 * tupida abajo; los tallos, a tirones, y las hojas en matas de dos o tres tonos.
 */
export function ivy(
  b: PixelBuffer,
  x: number,
  ground: number,
  top: number,
  dir: 1 | -1,
  rng: Rng,
): void {
  const stems: { x: number; y: number }[] = [];
  for (let s = 0; s < 4; s++) {
    let sx = x + dir * rng.int(0, 10);
    let sy = ground - 1;
    const end = top + rng.int(0, Math.max(1, Math.floor((ground - top) * 0.5)));
    while (sy > end) {
      stems.push({ x: sx, y: sy });
      sy -= 1;
      if (rng.chance(0.3)) sx += dir * (rng.chance(0.65) ? 1 : -1);
    }
  }
  b.level = 5;
  for (const p of stems) b.set(p.x, p.y, P.bark);
  // Matas de hojas a lo largo de los tallos: cada una, un grumo de 2 × 2 a 3 × 3.
  for (const p of stems) {
    const k = (ground - p.y) / Math.max(1, ground - top);
    if (!rng.chance(0.42 - k * 0.22)) continue;
    const r = rng.chance(0.5) ? 2 : 1;
    const ox = p.x + rng.int(-2, 2);
    const oy = p.y + rng.int(-1, 1);
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) {
        if (i * i + j * j > r * r + 1 || rng.chance(0.15)) continue;
        b.set(ox + i, oy + j, j < 0 ? P.leaf : j === 0 ? P.forest : P.deep);
      }
    if (rng.chance(0.25)) b.set(ox, oy - r, P.lime);
  }
  b.level = 0;
}

/**
 * Leña apilada contra la pared bajo un tejadillo de tablas: las testas de los troncos (con sus
 * anillos) en tres o cuatro filas y, encima, el tejadillo con su sombra.
 */
export function woodpile(b: PixelBuffer, x: number, ground: number, rng: Rng): void {
  const w = 40 + rng.int(0, 10);
  const rows = 4 + rng.int(0, 1);
  const r = 3;
  // El tejadillo: tablas inclinadas sobre dos palos, y su sombra en la pared.
  const roofY = ground - rows * 6 - 9;
  for (let i = 0; i < w + 6; i++) for (let j = 1; j <= 3; j++) shade(b, x - 3 + i, roofY + 2 + j);
  b.level = 4;
  b.vline(x - 2, roofY + 2, ground - roofY - 2, P.bark);
  b.vline(x + w + 1, roofY + 2, ground - roofY - 2, P.bark);
  b.level = 6;
  for (let i = 0; i < w + 8; i++) {
    const yy = roofY + Math.floor((i * 3) / (w + 8));
    b.set(x - 4 + i, yy, i % 6 === 0 ? P.plum : P.rust);
    b.set(x - 4 + i, yy + 1, P.bark);
    b.set(x - 4 + i, yy + 2, P.black);
  }
  // Los troncos, de abajo arriba, al tresbolillo.
  b.level = 5;
  for (let row = 0; row < rows; row++) {
    const cy = ground - 4 - row * 6;
    for (let cx = x + 3 + (row % 2) * 3; cx < x + w - 2; cx += 7) {
      if (row === rows - 1 && rng.chance(0.3)) continue;
      for (let j = -r; j <= r; j++)
        for (let i = -r; i <= r; i++) {
          if (i * i + j * j > r * r + 1) continue;
          const edge = i * i + j * j > r * r - 1;
          const ring = i * i + j * j <= 1;
          b.set(cx + i, cy + j, edge ? (i + j > 0 ? P.bark : P.rust) : ring ? P.clay : P.oak);
        }
      b.set(cx, cy, P.rust);
    }
  }
  b.level = 0;
}

/**
 * La bajante del canalón, del alero (`top`) al suelo, con sus abrazaderas, y el tonel de lluvia
 * al pie, de duelas y aros, con el agua asomando.
 */
export function rainBarrel(b: PixelBuffer, x: number, top: number, ground: number): void {
  const bw = 16;
  const bh = 20;
  const bx = x - 6;
  const by = ground - bh;
  b.level = 4;
  // El tubo: dos de ancho, con luz a la izquierda; acaba en un codo sobre el tonel.
  for (let y = top; y < by - 2; y++) {
    b.set(x - 1, y, P.steel);
    b.set(x, y, P.slate);
    b.set(x + 1, y, P.slate);
    b.set(x + 2, y, P.navy);
    shade(b, x + 3, y);
    if ((y - top) % 22 === 10) {
      b.hline(x - 2, y, 6, P.navy);
    }
  }
  b.set(x - 1, by - 2, P.fog);
  b.set(x - 1, by - 1, P.slate);
  b.set(x, by - 2, P.slate);
  // La sombra del tonel en la pared.
  for (let j = 2; j < bh; j++) shade(b, bx + bw, by + j);
  b.level = 5;
  for (let j = 0; j < bh; j++) {
    // Algo más ancho en medio (la panza).
    const bulge = j > 2 && j < bh - 3 ? 1 : 0;
    for (let i = -bulge; i < bw + bulge; i++) {
      const k = (i + 3) % 3;
      b.set(bx + i, by + j, i <= 0 ? P.rust : i >= bw - 1 ? P.bark : k === 0 ? P.cocoa : P.oak);
    }
  }
  for (const j of [2, bh - 4]) b.hline(bx - 1, by + j, bw + 2, P.steel);
  b.hline(bx, by, bw, P.black);
  b.hline(bx + 1, by, bw - 2, P.ocean);
  b.level = 0;
}

/** Una escalera de mano apoyada en la pared: dos largueros inclinados y los peldaños. */
export function ladder(b: PixelBuffer, x: number, ground: number, h: number): void {
  const lean = Math.round(h / 6);
  const w = 7;
  b.level = 6;
  for (let j = 0; j < h; j++) {
    const off = Math.round((lean * j) / h);
    const yy = ground - 1 - j;
    // La sombra a la derecha de cada larguero.
    shade(b, x + off + 1, yy);
    shade(b, x + off + w + 1, yy);
    b.set(x + off, yy, P.oak);
    b.set(x + off + w, yy, P.rust);
    if (j % 6 === 3) {
      b.hline(x + off + 1, yy, w - 1, P.clay);
      for (let i = 1; i < w; i++) shade(b, x + off + i, yy + 1);
    }
  }
  b.level = 0;
}

/** Dónde va cada detalle suelto (en el búfer), decidido por la semilla de la partida. */
export function pickDetails(
  seed: string,
  gaps: number[],
  edges: { left: number; right: number },
): {
  ivy: { x: number; dir: 1 | -1 } | null;
  pile: number | null;
  barrel: number | null;
  ladder: number | null;
} {
  const rng = new Rng(`detalles-${seed}`);
  const free = [...gaps];
  const take = () => (free.length ? free.splice(rng.int(0, free.length - 1), 1)[0]! : null);
  return {
    ivy: rng.chance(0.75)
      ? rng.chance(0.5)
        ? { x: edges.left + 2, dir: 1 }
        : { x: edges.right - 3, dir: -1 }
      : null,
    pile: rng.chance(0.7) ? take() : null,
    barrel: rng.chance(0.7) ? take() : null,
    ladder: rng.chance(0.5) ? take() : null,
  };
}
