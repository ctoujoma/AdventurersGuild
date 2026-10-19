/**
 * Arte de la torre del vigía, encima del tejado: sin levantar, el solar con estacas y tablas;
 * en el nivel 1, la plataforma con su barandilla y un farol; en el 2, más alta, con tejadillo y
 * la campana de aviso; en el 3, con la almenara encendida, el pendón del gremio y la bandera.
 * `towerLampY` dice a qué altura del dibujo va su luz.
 */
import { P } from '../../../art/palette';
import type { PixelBuffer } from '../../../art/pixel';
import { post } from '../../paint';
import * as Prop from '../../props';
import { W } from './kit';

const WOOD = [P.black, P.plum, P.bark, P.rust] as const;
const ROOF = P.wine;

/** Fila (desde arriba del dibujo) donde va la luz: el farol o la almenara. */
export function towerLampY(level: number): number {
  return level >= 3 ? 36 : level === 2 ? 24 : 14;
}

/** Alto de la plataforma (desde arriba del dibujo) y del dibujo entero, por nivel. */
const PLATFORM = [0, 16, 28, 40];
const HEIGHT = [14, 80, 100, 116];

export function watchtower(level: number, crest: { field: string; dark: string }): PixelBuffer {
  if (level <= 0)
    return Prop.piece(44, 14, (p) => {
      for (const dx of [2, 12, 29, 39]) post(p, dx, 2, 3, 12, WOOD);
      p.hline(2, 4, 40, P.tan);
      // Tablas apiladas esperando.
      for (let k = 0; k < 3; k++) {
        p.rect(14 + k, 11 - k * 2, 14, 2, k % 2 ? W[4]! : W[5]!);
        p.hline(14 + k, 11 - k * 2, 14, W[6]!);
      }
    });
  const lvl = Math.min(3, level);
  const h = HEIGHT[lvl]!;
  const top = PLATFORM[lvl]!;
  const cx = 26;
  return Prop.piece(52, h, (p) => {
    // Patas con sus cruces y la escalera de mano en medio.
    post(p, cx - 18, top + 6, 4, h - top - 6, WOOD);
    post(p, cx + 14, top + 6, 4, h - top - 6, WOOD);
    for (let y = top + 14; y < h - 8; y += 14) {
      p.line(cx - 15, y, cx + 15, y + 11, P.bark);
      p.line(cx + 15, y, cx - 15, y + 11, P.bark);
    }
    for (let y = top + 8; y < h; y += 4) p.hline(cx - 3, y, 7, W[3]!);
    p.vline(cx - 4, top + 6, h - top - 6, W[4]!);
    p.vline(cx + 4, top + 6, h - top - 6, W[4]!);
    // La plataforma con su barandilla.
    p.rect(cx - 22, top, 44, 6, P.oak);
    p.hline(cx - 22, top, 44, P.clay);
    p.hline(cx - 22, top + 5, 44, P.bark);
    p.hline(cx - 22, top - 8, 44, W[4]!);
    for (const x of [cx - 22, cx - 11, cx, cx + 11, cx + 21]) p.vline(x, top - 8, 8, W[3]!);
    if (lvl === 1) {
      // Un farol colgado del poste de la barandilla.
      p.vline(cx + 11, top - 12, 4, W[3]!);
      p.blit(Prop.lanternBody(), cx + 7, top - 6);
      return;
    }
    // Postes del tejadillo y el tejadillo a dos aguas.
    const roofY = lvl >= 3 ? 12 : 0;
    p.vline(cx - 20, roofY + 14, top - roofY - 14, W[3]!);
    p.vline(cx + 19, roofY + 14, top - roofY - 14, W[3]!);
    p.poly(
      [
        [cx - 25, roofY + 15],
        [cx, roofY],
        [cx + 25, roofY + 15],
      ],
      ROOF,
    );
    // Hileras de tejas.
    for (let y = roofY + 4; y < roofY + 15; y += 3) {
      const hw = Math.floor(((y - roofY) / 15) * 25);
      for (let x = cx - hw + 1; x < cx + hw; x += 3) p.set(x, y, P.plum);
    }
    p.line(cx - 25, roofY + 15, cx, roofY, P.black);
    p.line(cx, roofY, cx + 25, roofY + 15, P.black);
    p.hline(cx - 24, roofY + 15, 49, P.plum);
    // La campana de aviso, colgada del caballete.
    const by = roofY + 16;
    p.vline(cx, roofY + 8, 8, P.slate);
    for (let j = 0; j < 6; j++) {
      const w = 3 + j;
      p.hline(cx - Math.floor(w / 2), by + j, w, j < 2 ? P.gold : P.orange);
    }
    p.hline(cx - 4, by + 6, 9, P.brick);
    if (lvl === 2) {
      p.blit(Prop.lanternBody(), cx + 12, top - 13);
      return;
    }
    // Nivel 3: bandera en lo alto, la almenara y el pendón del gremio colgando.
    p.vline(cx, 0, 12, P.black);
    p.rect(cx + 1, 0, 10, 6, crest.field);
    p.hline(cx + 1, 5, 10, crest.dark);
    p.set(cx + 10, 1, crest.dark);
    p.rect(cx - 17, top - 6, 9, 3, P.slate);
    p.hline(cx - 17, top - 6, 9, P.fog);
    p.vline(cx - 13, top - 3, 3, P.slate);
    p.rect(cx - 16, top - 8, 7, 2, P.orange);
    p.set(cx - 14, top - 9, P.gold);
    p.rect(cx + 8, top + 6, 10, 14, crest.field);
    p.vline(cx + 8, top + 6, 14, crest.dark);
    p.vline(cx + 17, top + 6, 14, crest.dark);
    for (let k = 0; k < 3; k++) p.hline(cx + 8 + k, top + 20 + k, 10 - k * 2, crest.field);
    p.rect(cx + 11, top + 10, 4, 4, P.gold);
  });
}
