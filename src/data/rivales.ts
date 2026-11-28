/**
 * Qué criatura es cada enemigo de las expediciones y qué esbirros trae (usuario, 28 de noviembre:
 * cada jefe, los que tienen sentido con él). Aparte del «perfil del motor» (`BossKind`), que solo
 * dice con qué golpes pelea. Los enemigos normales (manadas, el oso, el jabalí suelto…) no traen.
 */
import type { Heading } from '../core/model';
import type { BossKind } from './bosses';

/** La criatura que se dibuja para cada esbirro (a tamaño de enemigo normal). */
export type MinionKind =
  'lobo' | 'lobo_gris' | 'jabato' | 'trasgo' | 'sanguijuela' | 'ahogado' | 'esqueleto';

export interface Rival {
  /** Con qué golpes pelea (el jefe del motor). */
  engine: BossKind;
  /** Los esbirros que trae (con la lejanía, ver `minionsAt`). */
  minion?: MinionKind;
  /** Si siempre trae estos (el Rey Ahogado, sus dos ahogados), lejos o no. */
  always?: number;
}

/** Los enemigos de cada rumbo, en el orden de `expediciones.enemigos.<rumbo>`. */
const FOES: Record<Heading, readonly Rival[]> = {
  bosque: [
    { engine: 'bestia' },
    { engine: 'jabali' },
    { engine: 'bestia' },
    { engine: 'bestia', minion: 'lobo' },
  ],
  sierra: [
    { engine: 'bestia' },
    { engine: 'bestia' },
    { engine: 'bestia' },
    { engine: 'jabali', minion: 'trasgo' },
  ],
  marismas: [
    { engine: 'sierpe' },
    { engine: 'ahogado' },
    { engine: 'bestia' },
    { engine: 'sierpe', minion: 'sanguijuela' },
  ],
  ruinas: [
    { engine: 'ahogado' },
    { engine: 'bestia' },
    { engine: 'bestia' },
    { engine: 'jabali', minion: 'esqueleto' },
  ],
};

/** Los guardianes de cada rumbo: el primero y, donde lo hay, el segundo (más adelante). */
const GUARDIANS: Record<Heading, readonly Rival[]> = {
  // El Viejo Colmillo (el huargo) con lobos; el Viejo Jabalí con jabatos.
  bosque: [
    { engine: 'bestia', minion: 'lobo' },
    { engine: 'jabali', minion: 'jabato' },
  ],
  // La Sierpe Blanca, con lobos grises.
  sierra: [{ engine: 'sierpe', minion: 'lobo_gris' }],
  // La Reina del Juncal con sanguijuelas; el Rey Ahogado, siempre con sus dos ahogados.
  marismas: [
    { engine: 'sierpe', minion: 'sanguijuela' },
    { engine: 'ahogado', minion: 'ahogado', always: 2 },
  ],
  // La Dragona de Ceniza, con esqueletos.
  ruinas: [{ engine: 'dragona', minion: 'esqueleto' }],
};

/**
 * La criatura de una pelea de expedición: un enemigo del rumbo (`foe`) o, con `guardian` (0 el
 * primero, 1 el segundo), su guardián.
 */
export function expRival(heading: Heading, foe: number, guardian: number | null = null): Rival {
  if (guardian !== null) return GUARDIANS[heading][guardian] ?? GUARDIANS[heading][0]!;
  return FOES[heading][foe] ?? { engine: 'bestia' };
}

/** Si el rumbo tiene segundo guardián. */
export const hasGuardian2 = (heading: Heading) => GUARDIANS[heading].length > 1;

/** Desde qué lejanía (días) trae uno y dos esbirros (los que no los traen siempre). */
export const MINIONS_FROM = [6, 9] as const;

/** Cuántos esbirros trae a esa lejanía. */
export function minionsAt(r: Rival, dist: number): number {
  if (!r.minion) return 0;
  if (r.always !== undefined) return r.always;
  return MINIONS_FROM.filter((d) => dist >= d).length;
}
