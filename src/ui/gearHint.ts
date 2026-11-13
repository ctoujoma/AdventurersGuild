/**
 * El aviso de equipo olvidado: cuando en el arcón hay algo mejor que lo que lleva alguien en una
 * ranura (o no lleva nada). Lo que es «mejor» lo decide el núcleo (`betterGear`).
 */
import { gearInStock } from '../core/game';
import { betterGear, type Upgrade } from '../core/gear';
import type { GameState, Hero, Item } from '../core/model';
import { listNames } from './text';

/** Lo mejor del arcón para cada ranura de un héroe que puede cambiarse de equipo. */
export function upgradesFor(game: GameState, h: Hero): Upgrade[] {
  if (h.status !== 'ok' && h.status !== 'herido') return [];
  return betterGear(h, gearInStock(game));
}

/** Cómo se nombra una pieza en la frase del aviso, y si va en plural («unas botas»). */
const NOUN: Record<NonNullable<Item['icon']>, [string, boolean]> = {
  espada: ['una espada', false],
  hacha: ['un hacha', false],
  varita: ['una varita', false],
  coraza: ['una coraza', false],
  escudo: ['un escudo', false],
  capa: ['una capa', false],
  botas: ['unas botas', true],
  amuleto: ['un amuleto', false],
  ganzua: ['unas ganzúas', true],
};
const BY_SLOT: Record<Upgrade['slot'], string> = {
  arma: 'un arma',
  cuerpo: 'una armadura',
  complemento: 'un complemento',
};

/** «Hay una espada mejor en el arcón para Brena», «Hay unas botas y una capa mejores…». */
export function gearHintText(name: string, ups: readonly Upgrade[]): string {
  const nouns = ups.map((u) => (u.item.icon ? NOUN[u.item.icon] : [BY_SLOT[u.slot], false]));
  const many = nouns.length > 1 || !!nouns[0]?.[1];
  return `Hay ${listNames(nouns.map((n) => n[0] as string))} ${many ? 'mejores' : 'mejor'} en el arcón para ${name}.`;
}
