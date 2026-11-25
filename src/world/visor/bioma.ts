/**
 * Cada rumbo, su paisaje: cómo se pintan las capas y las rampas de color que cambian (la hierba de
 * la sierra es pasto alpino; la de las ruinas, seca). Lo demás (luz, cielo, gente) es común.
 */
import type { Terrain } from '../../data/places';
import { BOSQUE, type Paisaje } from './capas';
import { MARISMAS, MARISMAS_RAMPS } from './capas-marismas';
import { RUINAS, RUINAS_RAMPS } from './capas-ruinas';
import { SIERRA, SIERRA_RAMPS } from './capas-sierra';
import { RAMPS, type Ramps } from './tonos';

export type BiomaId = 'bosque' | 'sierra' | 'marismas' | 'ruinas';

export interface Bioma {
  id: BiomaId;
  paisaje: Paisaje;
  ramps: Ramps;
}

const BIOMAS: Record<BiomaId, Bioma> = {
  bosque: { id: 'bosque', paisaje: BOSQUE, ramps: RAMPS },
  sierra: { id: 'sierra', paisaje: SIERRA, ramps: { ...RAMPS, ...SIERRA_RAMPS } },
  marismas: { id: 'marismas', paisaje: MARISMAS, ramps: { ...RAMPS, ...MARISMAS_RAMPS } },
  ruinas: { id: 'ruinas', paisaje: RUINAS, ramps: { ...RAMPS, ...RUINAS_RAMPS } },
};

export const biomaIdOf = (t: Terrain): BiomaId =>
  t === 'monte' ? 'sierra' : t === 'pantano' ? 'marismas' : t === 'ruina' ? 'ruinas' : 'bosque';

export const biomaOf = (t: Terrain): Bioma => BIOMAS[biomaIdOf(t)];
