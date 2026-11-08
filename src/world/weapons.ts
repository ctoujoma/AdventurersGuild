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
  | 'trapo'
  // Los del taller de la forja.
  | 'martillo'
  | 'tenaza'
  | 'lima'
  // Los de la sastrería y la alquimia.
  | 'tijera'
  | 'aguja'
  | 'cinta'
  | 'tela'
  | 'palo'
  | 'frasco'
  | 'maja'
  | 'pluma'
  | 'atizador'
  // La brocha del pintor, con la punta mojada.
  | 'brocha'
  // El cucharón visto en escorzo (casi de frente), al probar el guiso.
  | 'sorbo';

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
  // Martillo de herrero: cabeza de hierro y mango corto.
  martillo: grid(['SmmS', 'SSSS', '.b..', '.b..', '.b..', '.B..'], 1, 4),
  // Tenazas con una pieza al rojo en la punta.
  tenaza: grid(['oR.', 'Ro.', 's.s', 's.s', '.s.', 's.s', 's.s'], 1, 5),
  // Lima de desbastar.
  // Tijeras de sastre (las hojas arriba, los ojos abajo).
  tijera: grid(['m.m', 'm.m', '.S.', 'o.o', 'ooo'], 1, 3),
  // Aguja con su hilo rojo colgando.
  aguja: grid(['.W', '.m', 'Rm', 'R.', 'R.'], 1, 1),
  // La cinta de medir, con sus marcas, colgando de la mano.
  cinta: grid(['y', 'G', 'y', 'G', 'y', 'G', 'y'], 0, 0),
  // Un retal de tela (para probarla por encima).
  tela: grid(['rrrr', 'rRRr', 'rRrr', 'rRRr', 'rrr.'], 1, 0),
  // Palo de teñir o de remover, con la punta manchada.
  palo: grid(['b', 'b', 'b', 'b', 'b', 'B', 'c'], 0, 2),
  // Frasco de cristal con un líquido de color.
  frasco: grid(['.s.', '.s.', 'sCs', 'ccc', '.c.'], 1, 2),
  // La maja del mortero.
  maja: grid(['b', 'b', 'b', 'S', 'S'], 0, 1),
  // El atizador de hierro, con su gancho.
  atizador: grid(['s.', 'sS', '.S', '.S', '.S', '.S', '.b', '.B'], 1, 6),
  // El cucharón en escorzo: el cazo junto a la boca y un poco del mango hacia la mano.
  sorbo: grid(['.sS', 'bs.'], 0, 1),
  // La brocha del pintor: las cerdas mojadas de pintura, la virola y el mango.
  brocha: grid(['.R.', 'RRR', 'RRR', 'mmm', '.b.', '.b.', '.o.'], 1, 5),
  // Pluma de escribir.
  pluma: grid(['W.', 'Wm', '.m', '.B'], 1, 3),
  lima: grid(['.s', 'Ss', 'Ss', 'Ss', 'bB', 'b.'], 0, 4),
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
