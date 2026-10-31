import { P, darker } from '../art/palette';
import { PixelBuffer, toHex } from '../art/pixel';

/**
 * Armas de combate en pixel art, dibujadas apuntando hacia arriba. `px`/`py` es el punto de
 * agarre: ahí va la mano y alrededor de él se gira el arma al atacar.
 */

export type WeaponId =
  | 'espada'
  | 'daga'
  | 'baston'
  | 'maza'
  | 'arco'
  | 'garrote'
  | 'cuchillo'
  | 'hacha'
  | 'antorcha'
  | 'escudo'
  // Herramientas de los puestos de trabajo (no se pelea con ellas).
  | 'cucharon'
  | 'pala'
  | 'cuenco'
  | 'jarra'
  | 'trapo';

export interface Weapon {
  img: PixelBuffer;
  px: number;
  py: number;
}

const INK: Record<string, string> = {
  W: P.white,
  m: P.mist,
  S: P.steel,
  s: P.fog,
  G: P.gold,
  y: P.lemon,
  b: P.oak,
  B: P.bark,
  o: P.amber,
  r: P.wine,
  R: P.red,
  c: P.cyan,
  C: P.white,
  u: P.rust,
};

function grid(rows: string[], px: number, py: number): Weapon {
  const b = new PixelBuffer(rows[0]!.length, rows.length);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = INK[ch];
      if (c) b.set(x, y, c);
    }),
  );
  // Contorno oscuro para que se lean de noche; desplaza el agarre un píxel.
  return { img: b.outlined((n) => darker(toHex(n), 3)), px: px + 1, py: py + 1 };
}

export const WEAPONS: Record<WeaponId, Weapon> = {
  espada: grid(
    [
      '..W..',
      '.WmS.',
      '.WmS.',
      '.WmS.',
      '.WmS.',
      '.WmS.',
      '.WmS.',
      'GGGGG',
      '..b..',
      '..b..',
      '..o..',
    ],
    2,
    9,
  ),
  daga: grid(['.W.', 'WmS', 'WmS', 'WmS', 'GGG', '.b.', '.o.'], 1, 5),
  baston: grid(
    [
      '..c..',
      '.cCc.',
      '..c..',
      '.b.b.',
      '..b..',
      '..b..',
      '..b..',
      '..b..',
      '..b..',
      '..b..',
      '..b..',
      '..b..',
      '..b..',
      '..b..',
      '..b..',
      '..B..',
    ],
    2,
    10,
  ),
  maza: grid(
    ['.SmS.', 'SmWmS', 'SSmSS', '.SSS.', '..b..', '..b..', '..b..', '..b..', '..o..'],
    2,
    7,
  ),
  arco: grid(
    ['s.bb.', 's...b', 's...b', 's...b', 's...b', 's...b', 's...b', 's...b', 's.bb.'],
    4,
    4,
  ),
  garrote: grid(
    ['.bb.', 'bBbb', 'bbBb', 'bbbb', '.bb.', '.bb.', '..b.', '..b.', '..b.', '..B.'],
    2,
    8,
  ),
  cuchillo: grid(['.W', 'mS', 'mS', 'uu', 'B.'], 1, 3),
  hacha: grid(
    [
      '.SS..',
      'SWSb.',
      'SmSb.',
      'SSSb.',
      '.SSb.',
      '...b.',
      '...b.',
      '...b.',
      '...b.',
      '...b.',
      '...B.',
    ],
    3,
    8,
  ),
  antorcha: grid(['.B.', '.b.', '.b.', '.b.', '.b.', '.B.'], 1, 4),
  escudo: grid(['.SSSS.', 'SrrrrS', 'SrGGrS', 'SrGGrS', 'SrrrrS', '.SrrS.', '..SS..'], 3, 3),
  cucharon: grid(['.ss.', 'sSSs', '.ss.', '..s.', '..s.', '..s.', '..b.', '..b.'], 2, 6),
  pala: grid(
    ['.bb.', 'bBBb', 'bBBb', 'bBBb', '.bb.', '..b.', '..b.', '..b.', '..b.', '..b.', '..B.'],
    2,
    9,
  ),
  cuenco: grid(['.WW.', 'sWWs', '.ss.'], 1, 2),
  jarra: grid(['WWW.', 'GGGb', 'GyGb', 'GGGb', 'GGG.'], 3, 2),
  // Trapo de secar, doblado en la mano.
  trapo: grid(['mWW', 'WWm', '.Wm'], 1, 0),
};
