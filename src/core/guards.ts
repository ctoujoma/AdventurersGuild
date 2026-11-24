/**
 * Los de guardia: en la puerta (en el recibidor, dan la alarma y cierran el paso) o en la cámara
 * del tesoro (patrullan dentro, se echan encima del ladrón y son la última defensa en un asalto).
 */
import { MAX_GUARDS } from './balance';
import type { GameState, Hero } from './model';
import { vaultOf } from './vault';
import { t } from '../textos';
import { isLight } from './health';

export type Post = 'puerta' | 'tesoro';

export const postOf = (h: Pick<Hero, 'post'>): Post => h.post ?? 'puerta';

/** Los de guardia en casa en ese puesto (en el orden de la lista de héroes). */
export const guardsAt = (s: GameState, post: Post): Hero[] =>
  s.heroes.filter((h) => h.status === 'ok' && h.guard && postOf(h) === post);

/** En cada puesto caben dos. */
export const postFull = (s: GameState, post: Post) => guardsAt(s, post).length >= MAX_GUARDS;

/** Por qué no se puede poner a nadie más en ese puesto (o null). */
/** Por qué este héroe no puede hacer guardia en `post` (herido leve, o el puesto). */
export function guardIssue(s: GameState, h: Hero, post: Post): string | null {
  if (isLight(h)) return t('guardia.herido', { heroe: h.name, sexo: h.sex });
  return postIssue(s, post);
}

export function postIssue(s: GameState, post: Post): string | null {
  if (post === 'tesoro' && !vaultOf(s)) return t('guardia.sin_camara');
  if (postFull(s, post))
    return t(post === 'tesoro' ? 'guardia.llena_camara' : 'guardia.llena_puerta');
  return null;
}
