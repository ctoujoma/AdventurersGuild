import type { Grid } from '../sprite';
import type { OutfitId } from './look';

/**
 * Capas de los héroes. Cuerpo, ropa, pelo y armas son cuadrículas de 16×22
 * que se apilan; los sombreros miden 16×8 y asoman 4 filas por encima de la cabeza.
 *
 * Huecos de color (se resuelven al pintar, por héroe y por clase):
 *   x/X piel y sombra     h/H pelo y sombra     c/C ropa y sombra
 *   a/A acento y sombra   m/M metal y brillo    o/O cuero y cuero oscuro
 *   e ojos   n venda   r rojo   v/V madera   g/G brillo mágico   y/Y oro
 */

export const BODY_W = 16;
export const BODY_H = 22;
export const HEADROOM = 4;

export const BASE: Grid = [
  '................',
  '................',
  '....xxxxxxxx....',
  '...xxxxxxxxxx...',
  '...xxxxxxxxxx...',
  '...xxexxxxexx...',
  '...xxexxxxexx...',
  '...xxxxXXxxxx...',
  '....XxxxxxxX....',
  '......XXXX......',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..xx........xx..',
  '..xx........xx..',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const EMPTY_TOP: Grid = Array.from({ length: 10 }, () => '................');

export const OUTFITS = {
  guerrero: [
    ...EMPTY_TOP,
    '...mmmmmmmmmm...',
    '..mMmmmmmmmmMm..',
    '..ccmmMMMMmmcc..',
    '..ccmmmMMmmmcc..',
    '..CCaaaAaaaaCC..',
    '....mmmmmmmm....',
    '....cCccccCc....',
    '....CCC..CCC....',
    '....CCC..CCC....',
    '....mmm..mmm....',
    '...oooo..oooo...',
    '...OOOO..OOOO...',
  ],
  picaro: [
    ...EMPTY_TOP,
    '...cccccccccc...',
    '..cccccccccaac..',
    '..cCcccccaacCc..',
    '..cCcccaacccCc..',
    '..cCcaacccccCc..',
    '....oooOoooo....',
    '....cccccccc....',
    '....CCC..CCC....',
    '....CCC..CCC....',
    '....CCC..CCC....',
    '...oooo..oooo...',
    '...OOOO..OOOO...',
  ],
  mago: [
    ...EMPTY_TOP,
    '...ccccaacccc...',
    '..cccccaaccccc..',
    '..cCcccaacccCc..',
    '..cCcccaacccCc..',
    '..cCaaaaaaaaCc..',
    '....cccaaccc....',
    '....cccaaccc....',
    '...ccCcaacCcc...',
    '..ccCccaaccCcc..',
    '..cCCccaaccCCc..',
    '..aaaaaaaaaaaa..',
    '...oo......oo...',
  ],
  clerigo: [
    ...EMPTY_TOP,
    '...cccccccccc...',
    '..cccccaaccccc..',
    '..cCcaaaaaacCc..',
    '..cCcccaacccCc..',
    '..cCcccaacccCc..',
    '....AAAAAAAA....',
    '....cccccccc....',
    '...cCccccccCc...',
    '..ccCccccccCcc..',
    '..cCCccccccCCc..',
    '..CCCCCCCCCCCC..',
    '...oo......oo...',
  ],
  explorador: [
    ...EMPTY_TOP,
    '...cccccccccc...',
    '..ccaaaccaaacc..',
    '..cCaaaccaaaCc..',
    '..cCaaaccaaaCc..',
    '..cCAAAAAAAACc..',
    '....aaaOOaaa....',
    '....cccccccc....',
    '....CCC..CCC....',
    '....CCC..CCC....',
    '....ooo..ooo....',
    '...oooo..oooo...',
    '...OOOO..OOOO...',
  ],
  tabernero: [
    ...EMPTY_TOP,
    '...cccccccccc...',
    '..cccaaaaaaccc..',
    '..cCcaaaaaacCc..',
    '..cCcaaaaaacCc..',
    '..cCAAAAAAAACc..',
    '....aaaaaaaa....',
    '....aaaaaaaa....',
    '....aaaaaaaa....',
    '....OOO..OOO....',
    '....OOO..OOO....',
    '...oooo..oooo...',
    '...OOOO..OOOO...',
  ],
} satisfies Record<OutfitId, Grid>;

export const HAIR = {
  corto: [
    '................',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '...hHhhhhhhHh...',
    '...h........h...',
  ],
  largo: [
    '................',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '..hhhhhhhhhhhh..',
    '..hh........hh..',
    '..hh........hh..',
    '..hh........hh..',
    '..hH........Hh..',
    '..hH........Hh..',
    '..HH........HH..',
    '...H........H...',
  ],
  coleta: [
    '................',
    '....hhhhhhhh....',
    '...hhhhhhhhhhh..',
    '...hHhhhhhhHhhh.',
    '...h........hhh.',
    '.............hh.',
    '.............hH.',
    '.............hH.',
    '..............H.',
  ],
  punta: [
    '.....h.hh.h.....',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '...hHhHhhHhHh...',
    '...h........h...',
  ],
  mono: [
    '.......hh.......',
    '......hHhh......',
    '...hhhhhhhhhh...',
    '...hhhhhhhhhh...',
    '...h........h...',
  ],
  calvo: [],
} satisfies Record<string, Grid>;

export const BEARD: Grid = [
  ...Array.from({ length: 7 }, () => '................'),
  '...hh......hh...',
  '....hhhhhhhh....',
  '.....hhhhhh.....',
];

/** Sombreros: 16×8, se pintan desde 4 filas por encima del cuerpo (las 4 de margen). */
export const HATS = {
  sombrero: [
    '.........cC.....',
    '........ccC.....',
    '.......cccC.....',
    '......ccccCc....',
    '......cyyyyc....',
    '.....ccccccCc...',
    '..cccccccccccc..',
    '...CCCCCCCCCC...',
  ],
  gorra: [
    '................',
    '...........r....',
    '..........rr....',
    '.........rr.....',
    '....ccccrccc....',
    '...cccccccccc...',
    '..CCCCCCCCCCCC..',
    '................',
  ],
} satisfies Record<string, Grid>;

/** Cascos y capuchas: van en coordenadas del cuerpo (tapan pelo y frente). */
export const HELMS = {
  casco: [
    '................',
    '....mmmmmmmm....',
    '...mMMmmmmmmm...',
    '...mmmmmmmmmm...',
    '...m...mm...m...',
    '...m........m...',
  ],
  capucha: [
    '................',
    '....cccccccc....',
    '...cccccccccc...',
    '..ccCccccccCcc..',
    '..cC........Cc..',
    '..cC........Cc..',
    '..cC........Cc..',
    '..cC........Cc..',
    '..ccC......Ccc..',
    '...cccccccccc...',
  ],
} satisfies Record<string, Grid>;

export const WEAPONS = {
  guerrero: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '..............M.',
    '..............Mm',
    '..............Mm',
    '..............Mm',
    '..............Mm',
    '..............Mm',
    '..............Mm',
    '..............Mm',
    '..............Mm',
    '.............YYY',
    '..............o.',
    '..............o.',
    '..............Y.',
  ],
  picaro: [
    ...Array.from({ length: 11 }, () => '................'),
    '.M............M.',
    '.M............M.',
    '.M............M.',
    '.m............m.',
    '.o............o.',
    '.o............o.',
  ],
  mago: [
    '..............g.',
    '.............gGg',
    '..............g.',
    '..............V.',
    ...Array.from({ length: 18 }, () => '..............v.'),
  ],
  clerigo: [
    ...Array.from({ length: 8 }, () => '................'),
    '.............mMm',
    '.............MMM',
    '.............mMm',
    '..............o.',
    '..............o.',
    '..............o.',
    '..............o.',
    '..............o.',
    '..............o.',
    '..............o.',
  ],
  explorador: [
    ...Array.from({ length: 8 }, () => '................'),
    '.v..............',
    'vn..............',
    'vn..............',
    'vn..............',
    'vn..............',
    'vn..............',
    'vn..............',
    'vn..............',
    'vn..............',
    'vn..............',
    'vn..............',
    '.v..............',
  ],
  tabernero: [
    ...Array.from({ length: 13 }, () => '................'),
    '.............ww.',
    '.............ww.',
  ],
} satisfies Record<OutfitId, Grid>;

export const OVERLAYS = {
  parche: [
    '................',
    '................',
    '................',
    '................',
    '...kkkkkkkkkk...',
    '.........kkk....',
    '.........kkk....',
  ],
  venda: ['................', '................', '...nnnnnnnnnn...', '...nnnnnrnnnn...'],
} satisfies Record<string, Grid>;
