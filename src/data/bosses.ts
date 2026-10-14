/**
 * Los jefes que cierran algunas historias. La pelea se puede ver: el núcleo decide el
 * resultado y la escena lo cuenta (src/world/battle.ts y src/art/bosses.ts).
 */

export type BossKind = 'bestia' | 'ahogado' | 'sierpe';

export interface BossDef {
  name: string;
  /** Cómo se le nombra en una frase («… ha dado con …»). */
  short: string;
  /** Esbirros que pelean a su lado. */
  minions: number;
  /** Frase al ganar y al perder, para el final de la pelea. */
  win: string;
  lose: string;
}

export const BOSSES: Record<BossKind, BossDef> = {
  bestia: {
    name: 'La bestia de Hondogrís',
    short: 'la bestia de Hondogrís',
    minions: 0,
    win: '¡La bestia ha caído!',
    lose: 'La bestia los ha hecho huir.',
  },
  ahogado: {
    name: 'El Rey Ahogado',
    short: 'el Rey Ahogado',
    minions: 2,
    win: '¡El Rey Ahogado vuelve al fondo!',
    lose: 'El Rey Ahogado sigue en su laguna.',
  },
  sierpe: {
    name: 'La sierpe de Sierra Parda',
    short: 'la sierpe de Sierra Parda',
    minions: 0,
    win: '¡La sierpe ha caído!',
    lose: 'La sierpe los ha echado de su cueva.',
  },
};
