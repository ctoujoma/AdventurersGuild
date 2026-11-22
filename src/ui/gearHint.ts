/**
 * El aviso de equipo olvidado: cuando en el arcón hay algo mejor que lo que lleva alguien en una
 * ranura (o no lleva nada). Lo que es «mejor» lo decide el núcleo (`betterGear`).
 */
import { gearInStock } from '../core/game';
import { betterGear, type Upgrade } from '../core/gear';
import type { GameState, Hero, Item } from '../core/model';
import { listNames } from './text';
import { t } from '../textos';

/** Lo mejor del arcón para cada ranura de un héroe que puede cambiarse de equipo. */
export function upgradesFor(game: GameState, h: Hero): Upgrade[] {
  if (h.status !== 'ok' && h.status !== 'herido') return [];
  return betterGear(h, gearInStock(game));
}

/** Cómo se nombra una pieza en la frase del aviso, y si va en plural («unas botas»). */
const NOUN: Record<NonNullable<Item['icon']>, [string, boolean]> = {
  espada: [t('ficha.gearhint.una_espada'), false],
  hacha: [t('ficha.gearhint.un_hacha'), false],
  varita: [t('ficha.gearhint.una_varita'), false],
  coraza: [t('ficha.gearhint.una_coraza'), false],
  escudo: [t('ficha.gearhint.un_escudo'), false],
  capa: [t('ficha.gearhint.una_capa'), false],
  botas: [t('ficha.gearhint.unas_botas'), true],
  amuleto: [t('ficha.gearhint.un_amuleto'), false],
  ganzua: [t('ficha.gearhint.unas_ganzuas'), true],
};
const BY_SLOT: Record<Upgrade['slot'], string> = {
  arma: t('ficha.gearhint.un_arma'),
  cuerpo: t('ficha.gearhint.una_armadura'),
  complemento: t('ficha.gearhint.un_complemento'),
};

/** «Hay una espada mejor en el arcón para Brena», «Hay unas botas y una capa mejores…». */
export function gearHintText(name: string, ups: readonly Upgrade[]): string {
  const nouns = ups.map((u) => (u.item.icon ? NOUN[u.item.icon] : [BY_SLOT[u.slot], false]));
  const many = nouns.length > 1 || !!nouns[0]?.[1];
  return t('ficha.gearhint.hay_en_el_arcon', {
    cosas: listNames(nouns.map((n) => n[0] as string)),
    varias: many,
    nombre: name,
  });
}
