/**
 * Los jefes que cierran algunas historias. La pelea se puede ver: el núcleo decide el
 * resultado y la escena lo cuenta (src/world/battle.ts y src/art/bosses.ts).
 */

export type BossKind = 'bestia' | 'ahogado' | 'sierpe' | 'jabali' | 'reina' | 'dragona';
/** Los jefes de base: los demás pelean como uno de estos (con su propio dibujo). */
export type BossBase = 'bestia' | 'ahogado' | 'sierpe';

export interface BossDef {
  name: string;
  /** Cómo se le nombra en una frase («… ha dado con …»). */
  short: string;
  /** Esbirros que pelean a su lado. */
  minions: number;
  /** Frase al ganar y al perder, para el final de la pelea. */
  win: string;
  lose: string;
  /** Golpes de otro jefe (el dibujo es suyo, sobre el cuerpo del de base: `art/bosses.ts`). */
  base?: BossBase;
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
  jabali: {
    name: 'El jabalí de ceniza',
    short: 'el jabalí de ceniza',
    minions: 0,
    win: '¡El jabalí de ceniza ha caído!',
    lose: 'El jabalí de ceniza se pierde gruñendo en el humo.',
    base: 'bestia',
  },
  reina: {
    name: 'La Reina de la Cripta',
    short: 'la Reina de la Cripta',
    minions: 3,
    win: '¡La Reina de la Cripta vuelve a su sueño!',
    lose: 'La Reina de la Cripta sigue en su trono.',
    base: 'ahogado',
  },
  dragona: {
    name: 'La dragona de la Corona Blanca',
    short: 'la dragona de la Corona Blanca',
    minions: 0,
    win: '¡La dragona de la Corona Blanca ha caído!',
    lose: 'La dragona de la Corona Blanca los ha echado del glaciar.',
    base: 'sierpe',
  },
};

/** El jefe de base de este (de quien saca los golpes). */
export const bossBase = (k: BossKind): BossBase => BOSSES[k].base ?? (k as BossBase);
