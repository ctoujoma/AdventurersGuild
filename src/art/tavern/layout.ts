/**
 * Qué se ve en la taberna según el nivel de cada instalación. Lógica pura y testeable:
 * la escena solo pinta lo que diga este fichero.
 */

export interface Facilities {
  /** Dormitorios: 0 en ruinas, 1–3 mejorados. Capacidad = 2 + 2 × nivel. */
  dorm: number;
  /** Enfermería: 0 cerrada, 1–3 con camillas. */
  enf: number;
  /** Taberna (sala común): 0 en ruinas, 1–3 cada vez más acogedora. */
  tab: number;
}

export const FACILITY_MAX = 3;

export interface TavernLayout {
  /** Literas del dormitorio (cada una, 2 camas). */
  bunks: number[];
  /** Camillas de la enfermería (x de cada una). */
  cots: number[];
  /** Mesas de la sala (x de cada una). */
  tables: number[];
  bottles: number;
  mugsOnBar: number;
  barrels: number;
  lanterns: number[];
  fire: 'apagado' | 'normal' | 'grande';
  trophy: boolean;
  banner: boolean;
  tablecloths: boolean;
  /** Habitaciones en ruinas (telarañas, tablones, grietas). */
  ruined: { dorm: boolean; enf: boolean; tab: boolean };
}

export const DORM_X0 = 18;
export const BUNK_STEP = 21;

export function capacity(dormLevel: number): number {
  return 2 + 2 * dormLevel;
}

export function tavernLayout(f: Facilities): TavernLayout {
  const bunkCount = f.dorm === 0 ? 0 : capacity(f.dorm) / 2;
  return {
    bunks: Array.from({ length: bunkCount }, (_, i) => DORM_X0 + i * BUNK_STEP),
    cots: f.enf === 0 ? [] : f.enf === 1 ? [112] : [110, 136],
    tables: f.tab === 0 ? [] : f.tab === 1 ? [76] : [66, 92],
    bottles: [1, 4, 6, 7][f.tab] ?? 7,
    mugsOnBar: [0, 1, 2, 3][f.tab] ?? 3,
    barrels: [0, 0, 1, 2][f.tab] ?? 2,
    lanterns: f.tab >= 2 ? [60, 104] : [],
    fire: f.tab === 0 ? 'apagado' : f.tab === 3 ? 'grande' : 'normal',
    trophy: f.tab >= 3,
    banner: f.tab >= 3,
    tablecloths: f.tab >= 3,
    ruined: { dorm: f.dorm === 0, enf: f.enf === 0, tab: f.tab === 0 },
  };
}

/** Plazas donde ve a la gente herida: primero camillas; si no hay enfermería, camas de abajo. */
export function sickbeds(f: Facilities): { x: number; kind: 'camilla' | 'litera' }[] {
  const l = tavernLayout(f);
  if (l.cots.length) return l.cots.map((x) => ({ x, kind: 'camilla' as const }));
  return l.bunks.map((x) => ({ x, kind: 'litera' as const }));
}
