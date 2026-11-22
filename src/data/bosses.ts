import { t } from '../textos';
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
  /**
   * El jefe del que sale: pelea con sus golpes y sobre su cuerpo, pero con sus propios efectos
   * y su dibujo (`world/battle.ts` y `art/bosses.ts`).
   */
  base?: BossBase;
}

export const BOSSES: Record<BossKind, BossDef> = {
  bestia: {
    name: t('jefes.jefes.bestia.nombre'),
    short: t('jefes.jefes.bestia.corto'),
    minions: 0,
    win: t('jefes.jefes.bestia.gana'),
    lose: t('jefes.jefes.bestia.pierde'),
  },
  ahogado: {
    name: t('jefes.jefes.ahogado.nombre'),
    short: t('jefes.jefes.ahogado.corto'),
    minions: 2,
    win: t('jefes.jefes.ahogado.gana'),
    lose: t('jefes.jefes.ahogado.pierde'),
  },
  sierpe: {
    name: t('jefes.jefes.sierpe.nombre'),
    short: t('jefes.jefes.sierpe.corto'),
    minions: 0,
    win: t('jefes.jefes.sierpe.gana'),
    lose: t('jefes.jefes.sierpe.pierde'),
  },
  jabali: {
    name: t('jefes.jefes.jabali.nombre'),
    short: t('jefes.jefes.jabali.corto'),
    minions: 0,
    win: t('jefes.jefes.jabali.gana'),
    lose: t('jefes.jefes.jabali.pierde'),
    base: 'bestia',
  },
  reina: {
    name: t('jefes.jefes.reina.nombre'),
    short: t('jefes.jefes.reina.corto'),
    minions: 3,
    win: t('jefes.jefes.reina.gana'),
    lose: t('jefes.jefes.reina.pierde'),
    base: 'ahogado',
  },
  dragona: {
    name: t('jefes.jefes.dragona.nombre'),
    short: t('jefes.jefes.dragona.corto'),
    minions: 0,
    win: t('jefes.jefes.dragona.gana'),
    lose: t('jefes.jefes.dragona.pierde'),
    base: 'sierpe',
  },
};
