import { describe, expect, it } from 'vitest';
import { P } from '../../art/palette';
import { PixelBuffer } from '../../art/pixel';
import { faces, sideTexel } from './volume';

/** Una chimenea de juguete: base ancha (filas 6–11) y tiro estrecho encima (filas 0–5). */
function chimney(): PixelBuffer {
  const b = new PixelBuffer(12, 12);
  b.rect(4, 0, 4, 6, P.slate);
  b.rect(0, 6, 12, 6, P.brick);
  return b;
}

describe('volumen de las figuras', () => {
  it('saca los lados de la silueta, escalonados donde cambia el ancho', () => {
    const f = faces(chimney());
    const left = f.filter((x) => x.side === 'left').map(({ at, from, to }) => [at, from, to]);
    const right = f.filter((x) => x.side === 'right').map(({ at, from, to }) => [at, from, to]);
    expect(left).toEqual([
      [4, 0, 6],
      [0, 6, 12],
    ]);
    expect(right).toEqual([
      [8, 0, 6],
      [12, 6, 12],
    ]);
  });

  it('pone arriba el tiro y las dos repisas de la base', () => {
    const top = faces(chimney())
      .filter((x) => x.side === 'top')
      .map(({ at, from, to }) => [at, from, to]);
    expect(top).toEqual([
      [6, 0, 4],
      [0, 4, 8],
      [6, 8, 12],
    ]);
  });

  it('rellena los dientes del contorno y da un color por píxel, en sombra', () => {
    const b = chimney();
    b.clear(0, 8);
    const left = faces(b).filter((x) => x.side === 'left');
    expect(left.map(({ at, from, to }) => [at, from, to])).toEqual([
      [4, 0, 6],
      [0, 6, 12],
    ]);
    for (const x of faces(b)) expect(x.colors).toHaveLength(x.to - x.from);
    // Los lados salen más oscuros que la cara.
    const lit = b.get(5, 9) & 255;
    expect(left[1]!.colors[3]! & 255).toBeLessThan(lit);
  });

  it('un borde inclinado (escalones de una fila) no lleva cara', () => {
    const b = new PixelBuffer(12, 12);
    for (let y = 0; y < 12; y++)
      b.rect(6 - Math.floor(y / 2), y, 2 + Math.floor(y / 2) * 2, 1, P.clay);
    expect(faces(b).filter((x) => x.side === 'left')).toEqual([]);
  });
});

describe('costados pintados', () => {
  const oak = 0xff3c5a94; // P.oak en ABGR
  const r = (c: number) => c & 255;

  it('hacia el fondo, más oscuro (la sombra junto a la pared)', () => {
    expect(r(sideTexel(oak, 0, 0, 10))).toBeGreaterThan(r(sideTexel(oak, 0, 9, 10)));
  });

  it('la madera lleva las juntas de las tablas; lo de siempre no', () => {
    const plain = [0, 1, 2, 3, 4, 5].map((j) => r(sideTexel(oak, 1, j, 40)));
    const wood = [0, 1, 2, 3, 4, 5].map((j) => r(sideTexel(oak, 1, j, 40, 'madera')));
    expect(wood[2]).toBeLessThan(plain[2]! - 10);
    expect(wood[5]).toBeLessThan(plain[5]! - 10);
  });
});
