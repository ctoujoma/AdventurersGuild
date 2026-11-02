import type { Grid } from '../sprite';
import type { OutfitId } from './look';

/**
 * Capas de perfil (mirando a la derecha; a la izquierda se voltean).
 * Misma rejilla que las frontales: 16×22 de cuerpo, sombreros con 4 filas de margen.
 * Huecos extra: p/P pierna cercana/lejana · q/Q manga y sombra.
 */

const E = '................';
const empty = (n: number): string[] => Array.from({ length: n }, () => E);

export const SIDE_BASE: Grid = [
  E,
  E,
  '.....xxxxxx.....',
  '....xxxxxxxx....',
  '....xxxxxxxxx...',
  '....xxxXxxxex...',
  '....xxxXxxxexx..',
  '....xxxxxxxxx...',
  '.....xxxxxxxX...',
  '.......XXXX.....',
  ...empty(12),
];

/** Torso de perfil (filas 10–16). */
export const SIDE_TORSO: Record<OutfitId, Grid> = {
  guerrero: [
    ...empty(10),
    '.....mmmmmm.....',
    '....mMMmmmmm....',
    '.....cmmMmmc....',
    '.....cmmmmmc....',
    '.....aaaAaaa....',
    '.....mmmmmmm....',
    '.....cCcccCc....',
    ...empty(5),
  ],
  picaro: [
    ...empty(10),
    '.....cccccc.....',
    '....cccccccc....',
    '.....ccccaac....',
    '.....ccaaccc....',
    '.....aacccCc....',
    '.....oooOooo....',
    '.....ccccccc....',
    ...empty(5),
  ],
  mago: [
    ...empty(10),
    '.....ccccaa.....',
    '....ccccccaa....',
    '.....cccccaa....',
    '.....cccccaa....',
    '.....aaaaaaa....',
    '.....cccccaa....',
    '....ccccccaac...',
    ...empty(5),
  ],
  clerigo: [
    ...empty(10),
    '.....cccccc.....',
    '....cccccccc....',
    '.....ccccyyc....',
    '.....cccccyc....',
    '.....ccccccc....',
    '.....AAAAAAA....',
    '....cccccccc....',
    ...empty(5),
  ],
  explorador: [
    ...empty(10),
    '.....cccccc.....',
    '....ccaaaacc....',
    '.....caaaacc....',
    '.....caaaacc....',
    '.....AAAAAAA....',
    '.....aaaOaaa....',
    '.....ccccccc....',
    ...empty(5),
  ],
  tabernero: [
    ...empty(10),
    '.....cccccc.....',
    '....ccccccaa....',
    '.....cccccaa....',
    '.....cccccaa....',
    '.....AAAAAAA....',
    '.....cccccaa....',
    '.....ccccaaa....',
    ...empty(5),
  ],
  herrero: [
    ...empty(10),
    '.....xcccc......',
    '....xxccccaa....',
    '.....xccccaa....',
    '.....xccccaa....',
    '.....AAAAAAA....',
    '.....cccccaa....',
    '.....ccccaaa....',
    ...empty(5),
  ],
  campesino: [
    ...empty(10),
    '.....ccaaaa.....',
    '....ccccaaaa....',
    '.....ccccaac....',
    '.....ccccaac....',
    '.....AAAAAAA....',
    '.....CCCCCCC....',
    '.....CCCCCCC....',
    ...empty(5),
  ],
  mercader: [
    ...empty(10),
    '.....aaaaaa.....',
    '....ccccyycc....',
    '.....cccccyc....',
    '.....ccccccc....',
    '.....cooOoooc...',
    '.....cccOOccc...',
    '.....cccccccc...',
    ...empty(5),
  ],
  noble: [
    ...empty(10),
    '.....wwwwww.....',
    '....cccccaaa....',
    '.....ccccaac....',
    '.....ccccaac....',
    '.....AAAAAAA....',
    '.....ccccaac....',
    '....cccccaacc...',
    ...empty(5),
  ],
  forastero: [
    ...empty(10),
    '....cccccccc....',
    '...cccccccccc...',
    '...cCcccccaac...',
    '...cCccccccccc..',
    '...cCccccccccc..',
    '...cCccccccccc..',
    '...cCccccccccc..',
    ...empty(5),
  ],
};

/** Piernas: de pie y ciclo de paso (contacto, cruce). Filas 17–21. */
export const SIDE_LEGS = {
  stand: [
    '......pppp......',
    '......PPpp......',
    '......PPpp......',
    '......oooooo....',
    '......OOOOOO....',
  ],
  contact: [
    '......pppp......',
    '.....PP..pp.....',
    '....PP....pp....',
    '...ooo.....ooo..',
    '...OOO.....OOO..',
  ],
  passing: [
    '......pppp......',
    '......pppp......',
    '.....PPpp.......',
    '....OO.oooo.....',
    '.......OOOO.....',
  ],
  /**
   * Tras apoyar: el peso en la pierna de delante, que ya ha quedado algo más atrás, y el
   * talón de la de atrás levantado.
   */
  down: [
    '......pppp......',
    '.....PP.pp......',
    '....PP...pp.....',
    '....O....ooo....',
    '...OO....OOO....',
  ],
  /** Impulso: la pierna de apoyo, ya detrás, de puntillas; la otra sube por delante. */
  high: [
    '......pppp......',
    '......ppPP......',
    '.....pp...PP....',
    '.....oo....OO...',
    '.....OO.........',
  ],
} satisfies Record<string, Grid>;

/** Faldón de túnica para magos y clérigos (filas 17–21). */
export const SIDE_ROBE = {
  stand: [
    '....cccccccc....',
    '....cCccccccc...',
    '...cCCcccccccc..',
    '...aaaaaaaaaaa..',
    '....oo....ooo...',
  ],
  front: [
    '....cccccccc....',
    '....cCccccccc...',
    '...cCCccccccccc.',
    '..aaaaaaaaaaaaa.',
    '..oo.......ooo..',
  ],
  back: [
    '....cccccccc....',
    '....cCccccccc...',
    '..cCCcccccccc...',
    '.aaaaaaaaaaaa...',
    '.ooo......oo....',
  ],
} satisfies Record<string, Grid>;

/** Brazo cercano (filas 10–16). */
export const SIDE_ARM = {
  rest: [
    E,
    '.......qq.......',
    '.......qQ.......',
    '.......qQ.......',
    '.......qQ.......',
    '.......xx.......',
    E,
  ],
  forward: [
    E,
    '.......qq.......',
    '.......qqq......',
    '........qqq.....',
    '.........qq.....',
    '..........xx....',
    E,
  ],
  back: [
    E,
    '.......qq.......',
    '......qqq.......',
    '.....qqq........',
    '.....qq.........',
    '....xx..........',
    E,
  ],
} satisfies Record<string, Grid>;

/** Brazos de combate: en alto (empieza 5 filas antes que los demás) y en estocada. */
export const SIDE_ARM_UP: Grid = [
  '..........xx....',
  '.........qq.....',
  '.........qq.....',
  '........qq......',
  '.......qq.......',
  '.......qq.......',
];
export const SIDE_ARM_THRUST: Grid = [E, '.......qqqqqqxx.', '.......qQ.......', E, E, E, E];

export const SIDE_HAIR: Record<string, Grid> = {
  corto: [
    E,
    '.....hhhhhh.....',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '...hhhhhh..h....',
    '...hhhh.........',
    '...hhhh.........',
    '....hh..........',
  ],
  largo: [
    E,
    '.....hhhhhh.....',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '..hhhhhhh..h....',
    '..hhhhh.........',
    '..hhhhh.........',
    '..hhhhh.........',
    '..hhhhh.........',
    '..hHhhh.........',
    '..hHhh..........',
    '...hh...........',
  ],
  coleta: [
    E,
    '.....hhhhhh.....',
    '....hhhhhhhh....',
    '..hhhhhhhhhhh...',
    '.hhhhhhh...h....',
    'hhhhhhh.........',
    'hH.hhh..........',
    'hH..hh..........',
    '.H..............',
  ],
  punta: [
    '.....h.hh.h.....',
    '.....hhhhhh.....',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '...hhhhhh..h....',
    '...hhhh.........',
    '...hhhh.........',
  ],
  mono: [
    '..hhh...........',
    '..hhhhhhhhh.....',
    '...hhhhhhhhh....',
    '...hhhhhhhhhh...',
    '...hhhhhh..h....',
    '...hhhh.........',
    '...hhhh.........',
  ],
  calvo: [],
};

export const SIDE_BEARD: Grid = [
  ...empty(7),
  '........hhhh....',
  '.......hhhhhh...',
  '........hhhh....',
];

export const SIDE_HATS: Record<'sombrero' | 'gorra' | 'paja' | 'boina' | 'pluma', Grid> = {
  sombrero: [
    '...cC...........',
    '....ccC.........',
    '.....cccC.......',
    '......ccccC.....',
    '......cyyyyc....',
    '.....ccccccCc...',
    '..cccccccccccccc',
    '...CCCCCCCCCCC..',
  ],
  gorra: [
    E,
    '..r.............',
    '...rr...........',
    '....rr..........',
    '....ccccccc.....',
    '...cccccccccc...',
    '...ccccccccCCCC.',
    E,
  ],
  paja: [
    '................',
    '................',
    '................',
    '.....zzzzzz.....',
    '....zzzZzzZz....',
    '....bbbbbbbb....',
    '.zzzzzzzzzzzzzz.',
    '..ZZZZZZZZZZZZ..',
  ],
  boina: [
    '................',
    '................',
    '................',
    '.....bbbbbb.....',
    '...bbbbbbbbbbb..',
    '..bbbbbbbbbbbbb.',
    '...BBBBBBBBBB...',
    '................',
  ],
  pluma: [
    '...ww...........',
    '...Mww..........',
    '....Mww.........',
    '.....bwbbbb.....',
    '....bbbbbbbbb...',
    '....bbbbbbbbbb..',
    '...BBBBBBBBBBB..',
    '................',
  ],
};

export const SIDE_HELMS: Record<'casco' | 'capucha', Grid> = {
  casco: [
    E,
    '.....mmmmmm.....',
    '....mMMmmmmm....',
    '...mmmmmmmmmm...',
    '...mmmmm....m...',
    '...mmmm.....m...',
    '...mmm..........',
  ],
  capucha: [
    E,
    '.....cccccc.....',
    '....cccccccc....',
    '...ccccccccccc..',
    '...cCccccc..c...',
    '...cCcccc.......',
    '...cCcccc.......',
    '...ccCccc.......',
    '....ccccc.......',
    '....cccccc......',
  ],
};

/** Armas de perfil: `back` se pinta antes que el cuerpo, `front` después. */
export const SIDE_WEAPONS: Record<OutfitId, { back?: Grid; front?: Grid }> = {
  guerrero: {
    back: [
      ...empty(10),
      '...mm...........',
      '..mrrm..........',
      '..mrym..........',
      '..mrrm..........',
      '..mrrm..........',
      '...mm...........',
    ],
  },
  picaro: {
    back: [
      ...empty(13),
      '....M...........',
      '....M...........',
      '....m...........',
      '....o...........',
    ],
  },
  mago: {
    front: [
      '..........g.....',
      '.........gGg....',
      '..........g.....',
      ...Array.from({ length: 19 }, () => '..........v.....'),
    ],
  },
  clerigo: {
    back: [
      ...empty(12),
      '...mMm..........',
      '...MMM..........',
      '....o...........',
      '....o...........',
      '....o...........',
    ],
  },
  explorador: {
    back: [
      ...empty(8),
      '...rr...........',
      '...oo...........',
      '...oo...........',
      '..voo...........',
      '..voo...........',
      '..voO...........',
      '..v.............',
      '..v.............',
    ],
  },
  tabernero: {},
  herrero: {},
  campesino: {},
  mercader: {},
  noble: {},
  forastero: {},
};
