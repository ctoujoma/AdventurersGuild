/**
 * Lo que hay fuera del edificio, alrededor: los árboles y arbustos del patio y del terreno de la
 * derecha, y dónde pueden salir las matas de hierba. Todo a los lados de `L.left`…`L.right` (el
 * edificio, el jardín y el anexo con sus solares): nada cae dentro del jardín ni del anexo,
 * crezca lo que crezca (ver `patio.test.ts`).
 */
import { DEPTH, type RoomsLayout } from './layout';

/** Hasta dónde llega el césped del jardín; de ahí a los árboles, el terreno. */
export const LAWN_D = 118;

export interface YardTree {
  x: number;
  depth: number;
  conifer: boolean;
  h: number;
}

/**
 * Árboles a varias profundidades a los lados: con la perspectiva, cada uno se mueve a su paso al
 * mover la cámara (los de más al fondo, menos). Los de la derecha, contados desde `L.right`.
 */
export function yardTrees(L: RoomsLayout): YardTree[] {
  const px = L.patio.x;
  const t = (x: number, depth: number, conifer: boolean, h: number) => ({ x, depth, conifer, h });
  return [
    t(px - 40, 36, true, 92),
    t(px - 95, 120, false, 78),
    t(px - 150, 62, true, 84),
    t(px - 210, 180, true, 96),
    t(px - 270, 95, false, 70),
    t(px + 20, 206, false, 74),
    t(L.right + 120, 48, true, 90),
    t(L.right + 175, 150, false, 80),
    t(L.right + 235, 82, true, 76),
    t(L.right + 300, 196, true, 98),
    t(L.right + 360, 120, false, 72),
  ];
}

/** Medio ancho de un árbol en el mundo (pino: la mitad de alto; roble: el 80 %). */
export const treeHalf = (t: YardTree) => (t.h * (t.conifer ? 0.5 : 0.8)) / 2;

/** Los arbustos de los lados del patio y del terreno. */
export function yardBushes(L: RoomsLayout): { seed: string; x: number; depth: number }[] {
  return [
    { seed: 'patio1', x: L.left - 30, depth: 12 },
    { seed: 'patio2', x: L.right + 40, depth: 30 },
    { seed: 'patio3', x: L.right + 80, depth: 90 },
  ];
}

/**
 * Si puede salir una mata de hierba en (`x`, `z`): ni dentro del edificio, el jardín o el anexo,
 * ni en el césped del jardín (sí en su borde sin segar), ni encima del pozo, ni en el camino de
 * tierra del patio.
 */
export function tuftAllowed(L: RoomsLayout, x: number, z: number): boolean {
  if (x > L.left - 6 && x < L.right + 6 && z < DEPTH + 8) return false;
  const g = L.garden;
  if (g && x > g.x + 8 && x < g.x + g.w - 8 && z < LAWN_D - 10) return false;
  const well = { x: L.patio.x + 40, z: 70 };
  if (Math.hypot(x - well.x, (z - well.z) * 0.6) < 18) return false;
  if (z > 6 && z < 26 && x < L.left) return false;
  return true;
}
