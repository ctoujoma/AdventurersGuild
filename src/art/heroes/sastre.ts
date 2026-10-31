/**
 * La sastrería en el dibujo de los héroes: el tinte cambia los tonos de la tela del traje (no la
 * piel, el cuero ni el metal) y la prenda (capa, tabardo, faja o bufanda) se pinta entre el traje
 * y el equipo, de frente, de perfil y en el retrato. La prenda es de su color (`GARMENTS`); si
 * coincide con el tinte del traje, de otro que contraste (si no, no se vería).
 */
import { GARMENTS, TINTS, type GarmentId, type TintId } from '../../data/custom';
import { P } from '../palette';
import { alpha, type PixelBuffer } from '../pixel';
import { HEADROOM } from './layers';

/** Cuatro tonos de tela, de la sombra a la luz. */
export type Cloth = readonly [string, string, string, string];

export const dyeOf = (dye?: TintId): Cloth | null => (dye ? TINTS[dye].ramp : null);

/** Con qué contrasta cada tema, para la prenda que coincide con el tinte del traje. */
const CONTRAST: Record<TintId, TintId> = {
  vino: 'lino',
  mar: 'ocre',
  bosque: 'ocre',
  ocre: 'mar',
  morado: 'lino',
  ceniza: 'vino',
  lino: 'vino',
};

/** Los tonos de la prenda: los suyos, o los de contraste si son los del tinte del traje. */
const garmentCloth = (g: GarmentId, dye?: TintId): Cloth => {
  const own = GARMENTS[g].tint;
  return TINTS[own === dye ? CONTRAST[own] : own].ramp;
};

/** Pinta solo donde ya hay figura (encima de la ropa). */
const over = (b: PixelBuffer, x: number, y: number, c: string) => {
  if (alpha(b.get(x, y))) b.set(x, y, c);
};
/** Pinta solo donde no hay nada (por detrás de la figura). */
const under = (b: PixelBuffer, x: number, y: number, c: string) => {
  if (!alpha(b.get(x, y))) b.set(x, y, c);
};

/** Un emblema pequeño (dos por dos, dorado) en el pecho del tabardo. */
const emblem = (b: PixelBuffer, x: number, y: number) => {
  b.set(x, y, P.gold);
  b.set(x + 1, y, P.lemon);
  b.set(x, y + 1, P.orange);
  b.set(x + 1, y + 1, P.gold);
};

/** De frente (16 de ancho; las filas, con el margen de arriba). La capa va por detrás. */
export function garmentFront(b: PixelBuffer, g: GarmentId, dye?: TintId): void {
  const [s, d, m, l] = garmentCloth(g, dye);
  const y = (row: number) => HEADROOM + row;
  switch (g) {
    case 'capa':
      for (let r = 10; r <= 20; r++) {
        const w = r < 14 ? 0 : 1;
        for (const x of [2 - w, 3 - w]) under(b, x, y(r), x === 2 - w ? d : m);
        for (const x of [12 + w, 13 + w]) under(b, x, y(r), x === 13 + w ? d : m);
      }
      // Cuello de la capa sobre los hombros.
      for (let x = 3; x <= 12; x++) over(b, x, y(10), x === 3 || x === 12 ? d : m);
      break;
    case 'tabardo':
      for (let r = 11; r <= 18; r++)
        for (let x = 5; x <= 10; x++)
          over(b, x, y(r), x === 5 || x === 10 || r === 18 ? d : r === 11 ? l : m);
      emblem(b, 7, y(13));
      break;
    case 'faja':
      for (let x = 4; x <= 11; x++) {
        over(b, x, y(14), m);
        over(b, x, y(15), d);
      }
      // El nudo y la punta que cuelga.
      over(b, 10, y(14), l);
      b.set(10, y(16), m);
      b.set(11, y(17), d);
      break;
    case 'bufanda':
      for (let x = 5; x <= 10; x++) {
        b.set(x, y(9), x % 2 ? m : d);
        over(b, x, y(10), x % 2 ? l : m);
      }
      for (let r = 11; r <= 13; r++) over(b, 9, y(r), r % 2 ? m : d);
      b.set(9, y(14), s);
      break;
  }
}

/** De perfil (mirando a la derecha): `bob`, lo que baja el cuerpo en ese paso. */
export function garmentSide(b: PixelBuffer, g: GarmentId, dye: TintId | undefined, bob: number) {
  const [s, d, m, l] = garmentCloth(g, dye);
  const y = (row: number) => HEADROOM + row + bob;
  switch (g) {
    case 'capa':
      // Cae por la espalda, algo despegada al final.
      for (let r = 10; r <= 20; r++) {
        const x0 = r < 15 ? 4 : 3;
        under(b, x0, y(r), d);
        under(b, x0 + 1, y(r), m);
        if (r > 15) under(b, x0 - 1, y(r), s);
      }
      over(b, 5, y(10), m);
      over(b, 6, y(10), l);
      break;
    case 'tabardo':
      for (let r = 11; r <= 17; r++)
        for (let x = 8; x <= 11; x++) over(b, x, y(r), x === 11 || r === 17 ? d : m);
      b.set(9, y(13), P.gold);
      break;
    case 'faja':
      for (let x = 5; x <= 11; x++) over(b, x, y(14), x === 11 ? l : m);
      under(b, 4, y(15), m);
      under(b, 4, y(16), d);
      break;
    case 'bufanda':
      for (let x = 6; x <= 10; x++) over(b, x, y(10), x % 2 ? m : d);
      // Las puntas, al aire por detrás.
      under(b, 5, y(10), m);
      under(b, 4, y(11), d);
      under(b, 3, y(11), s);
      break;
  }
}

/** En el retrato (40 × 48): lo de detrás (la capa) antes de la figura; lo demás, después. */
export function garmentPortrait(
  b: PixelBuffer,
  g: GarmentId,
  dye: TintId | undefined,
  back: boolean,
) {
  const [s, d, m, l] = garmentCloth(g, dye);
  if (back) {
    if (g !== 'capa') return;
    for (let y = 35; y < 48; y++)
      for (let x = 0; x < 40; x++) {
        const edge = Math.abs(x - 20) > 19 - (y - 35) * 0.35;
        if (!edge) b.set(x, y, (x + y) % 7 === 0 ? d : x < 4 || x > 35 ? d : m);
      }
    return;
  }
  switch (g) {
    case 'capa':
      // El cuello de la capa por encima de los hombros.
      for (let x = 9; x <= 30; x++) {
        over(b, x, 38, x < 12 || x > 27 ? d : m);
        if (x < 15 || x > 24) over(b, x, 39, d);
      }
      break;
    case 'tabardo':
      for (let y = 40; y < 48; y++)
        for (let x = 13; x <= 26; x++)
          over(b, x, y, x === 13 || x === 26 ? d : y === 40 ? l : (x + y) % 9 === 0 ? d : m);
      emblem(b, 19, 43);
      b.set(18, 43, P.gold);
      b.set(21, 44, P.gold);
      break;
    case 'faja':
      // Cruzada al pecho, de un hombro a la otra cadera.
      for (let k = 0; k < 14; k++) {
        const x = 12 + k;
        const y = 37 + k;
        if (y > 47) break;
        over(b, x, y, m);
        over(b, x + 1, y, l);
        over(b, x + 2, y, d);
      }
      break;
    case 'bufanda':
      for (let y = 36; y <= 39; y++)
        for (let x = 13; x <= 27; x++) b.set(x, y, (x + y) % 4 < 2 ? m : d);
      for (let x = 13; x <= 27; x++) b.set(x, 36, l);
      for (let y = 40; y <= 46; y++) {
        b.set(24, y, y % 3 ? m : d);
        b.set(25, y, y % 3 ? d : s);
      }
      break;
  }
}
