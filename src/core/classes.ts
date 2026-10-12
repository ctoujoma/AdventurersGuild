/**
 * Habilidades de clase: lo que cada clase aporta al grupo además de sus números.
 * La resolución las aplica y la ficha del encargo las enseña antes de enviar.
 */
import {
  CLERIC_SOLACE,
  ROGUE_GOLD,
  SCOUT_AMBUSH,
  SCOUT_DAYS,
  SCOUT_MIN,
  WARRIOR_GUARD,
} from './balance';
import type { Quest } from './model';
import type { ClassId, Member } from './party';

export const PERKS: Record<ClassId, { name: string; desc: string }> = {
  guerrero: { name: 'Escudo', desc: 'Cubre al grupo: sus compañeros se hieren la mitad.' },
  picaro: {
    name: 'Manos largas',
    desc: `+${ROGUE_GOLD * 100} % de oro, y trae el objeto aunque el éxito sea parcial.`,
  },
  mago: { name: 'Sexto sentido', desc: 'Descubre giros ocultos y el peligro real del encargo.' },
  clerigo: {
    name: 'Plegaria',
    desc: `Evita muertes en el grupo y las derrotas desaniman la mitad.`,
  },
  explorador: {
    name: 'Atajos',
    desc: `En viajes de ${SCOUT_MIN} días o más vuelve ${SCOUT_DAYS} antes, y esquiva la mitad de emboscadas.`,
  },
};

const hasCls = (party: readonly Member[], c: ClassId) => party.some((m) => m.cls === c);

/** Días que tarda el grupo: un explorador conoce atajos. */
export function tripDays(q: Quest, party: readonly Member[], establo = 0): number {
  const scout = hasCls(party, 'explorador') && q.days >= SCOUT_MIN;
  // El establo presta monturas: un día menos en los viajes largos.
  const horses = establo >= 1 && q.days >= SCOUT_MIN;
  return Math.max(1, q.days - (scout ? SCOUT_DAYS : 0) - (horses ? 1 : 0));
}

/** Multiplicadores que el grupo aplica a la resolución. */
export function partyMods(party: readonly Member[]) {
  return {
    disaster: hasCls(party, 'explorador') ? SCOUT_AMBUSH : 1,
    gold: hasCls(party, 'picaro') ? 1 + ROGUE_GOLD : 1,
    partialLoot: hasCls(party, 'picaro'),
    guard: WARRIOR_GUARD,
    solace: hasCls(party, 'clerigo') ? CLERIC_SOLACE : 1,
    seer: hasCls(party, 'mago'),
    saves: hasCls(party, 'clerigo'),
  };
}

/** Clases distintas del grupo, en orden, para enseñar sus habilidades. */
export function partyClasses(party: readonly Member[]): ClassId[] {
  return [...new Set(party.map((m) => m.cls))];
}
