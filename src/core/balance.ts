/**
 * Todas las constantes de equilibrio en un solo sitio, para ajustarlas con el simulador
 * (`npm run sim`) sin tocar la lógica.
 */
import type { Facilities, Outcome } from './model';

export const DAYS = 30;
export const DEBT = 1000;
/** Pagos mínimos al prestamista. Cada pago incluye los salarios de la semana. */
export const SCHEDULE: readonly { day: number; amount: number }[] = [
  { day: 7, amount: 150 },
  { day: 14, amount: 200 },
  { day: 21, amount: 250 },
  { day: 28, amount: 400 },
];

export const START = {
  gold: 160,
  fac: { dorm: 1, enf: 0, tab: 1 } as Facilities,
  heroes: 2,
  candidates: 3,
  quests: 4,
};

export const FACILITY_MAX = 3;
/** Coste de subir a cada nivel (índice = nivel nuevo). */
export const UPGRADE_COST: Record<keyof Facilities, readonly number[]> = {
  dorm: [0, 80, 150, 280],
  enf: [0, 100, 200, 340],
  tab: [0, 90, 170, 300],
};

export const capacity = (dorm: number) => 2 + 2 * dorm;
/** Ingreso diario de la taberna: por nivel y un poco por reputación. */
export const tavernIncome = (tab: number, rep: number) =>
  tab === 0 ? 0 : tab * 10 + Math.min(10, Math.floor(rep / 25) * 2);
/** Días de cama que se recuperan cada noche. */
export const healRate = (enf: number) => 1 + enf;

export const RANKS: readonly { name: string; at: number }[] = [
  { name: 'cobre', at: 0 },
  { name: 'hierro', at: 40 },
  { name: 'plata', at: 100 },
  { name: 'oro', at: 180 },
  { name: 'leyenda', at: 300 },
];

export function rankIndex(rep: number): number {
  let i = 0;
  RANKS.forEach((r, k) => {
    if (rep >= r.at) i = k;
  });
  return i;
}

export const BOARD_SIZE = (tab: number) => 3 + Math.min(2, tab);
/** Cada cuántos días llega un candidato nuevo. */
export const CANDIDATE_EVERY = 2;
export const MAX_CANDIDATES = 3;

export const XP_PER_LEVEL = 100;
export const XP: Record<Outcome, number> = {
  'Éxito brillante': 50,
  Éxito: 40,
  'Éxito parcial': 25,
  Fracaso: 15,
  Desastre: 15,
};
export const PAY: Record<Outcome, number> = {
  'Éxito brillante': 1.25,
  Éxito: 1,
  'Éxito parcial': 0.35,
  Fracaso: 0,
  Desastre: 0,
};
export const REP: Record<Outcome, number> = {
  'Éxito brillante': 8,
  Éxito: 5,
  'Éxito parcial': 1,
  Fracaso: -3,
  Desastre: -6,
};
/** Probabilidad base de herida por héroe según el resultado (un clérigo la reduce a la mitad). */
export const INJURY: Record<Outcome, number> = {
  'Éxito brillante': 0.04,
  Éxito: 0.1,
  'Éxito parcial': 0.25,
  Fracaso: 0.45,
  Desastre: 0.7,
};
export const MORALE: Record<Outcome, number> = {
  'Éxito brillante': 10,
  Éxito: 6,
  'Éxito parcial': 0,
  Fracaso: -8,
  Desastre: -15,
};
/** Monedas por punto de dificultad de un encargo (antes de peligro y duración). */
export const REWARD_PER_POINT = 5.5;
/** Probabilidad de que un fracaso acabe en desastre, por nivel de peligro. */
export const DISASTER = [0.05, 0.3, 0.6, 0.9] as const;
/** Probabilidad de una baja (herida grave, muerte o desaparición) en un fracaso, por peligro. */
export const FAIL_CASUALTY = [0, 0.05, 0.15, 0.3] as const;
/** El giro oculto sube así la dificultad del primer desafío. */
export const TWIST_DIFF = 3;
/** Parte del oro que se queda un codicioso. */
export const GREED = 0.1;
