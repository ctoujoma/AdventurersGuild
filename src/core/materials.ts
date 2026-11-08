/**
 * Materiales: los traen los encargos (cada tipo, el suyo) y los piden las recetas buenas y las
 * mejoras de los talleres. Sin almacén caben unos pocos de cada «en un rincón de la bodega»; el
 * almacén guarda más con cada nivel. Lo que no cabe se vende solo, por poco, y se avisa (si aún
 * no se puede construir el almacén, que se podrá al pagar la deuda). Los raros (hierbas, madera
 * buena y cristal) llegarán con las expediciones y piden el almacén a nivel 2.
 */
import type { QuestType } from './model';
import type { GameState } from './model';
import { EXPEDITION_LEVEL, MAT_LOOSE, MAT_SELL, STORE_CAP } from './balance';
import { active } from './rooms';

export type Material = 'hierro' | 'cuero' | 'tela' | 'hierbas' | 'madera' | 'cristal';
export const MATERIAL_LIST: readonly Material[] = [
  'hierro',
  'cuero',
  'tela',
  'hierbas',
  'madera',
  'cristal',
];
/** Los de ahora; los demás, con las expediciones. */
export const BASIC: readonly Material[] = ['hierro', 'cuero', 'tela'];

export const MATERIALS: Record<Material, { name: string; from: string; uses: string }> = {
  hierro: {
    name: 'Hierro',
    from: 'Sale limpiando guaridas e investigando.',
    uses: 'Lo piden las armas, las corazas y las ganzúas.',
  },
  cuero: {
    name: 'Cuero',
    from: 'Sale cazando y explorando.',
    uses: 'Lo piden las botas, los escudos y las capas buenas.',
  },
  tela: {
    name: 'Tela',
    from: 'Sale escoltando y recuperando.',
    uses: 'La piden las capas y la ropa de la sastrería.',
  },
  hierbas: {
    name: 'Hierbas',
    from: 'Salen en las expediciones.',
    uses: 'Las piden los amuletos y las pociones.',
  },
  madera: {
    name: 'Madera buena',
    from: 'Sale en las expediciones.',
    uses: 'La piden las hachas y las varitas.',
  },
  cristal: {
    name: 'Cristal',
    from: 'Sale, raro, en las expediciones lejanas.',
    uses: 'Lo pide lo mejor de cada taller.',
  },
};

/** El material que trae cada tipo de encargo. */
export const QUEST_MATERIAL: Record<QuestType, Material> = {
  Cazar: 'cuero',
  Explorar: 'cuero',
  Escoltar: 'tela',
  Recuperar: 'tela',
  Investigar: 'hierro',
  Limpiar: 'hierro',
};

export type Mats = Partial<Record<Material, number>>;

/** Cuántos hay de un material. */
export const matOf = (s: GameState, m: Material) => s.mats?.[m] ?? 0;

/** Las expediciones se abren con el primer héroe que llega a `EXPEDITION_LEVEL`. */
export const expeditionsOpen = (s: GameState) => (s.stats?.maxLvl ?? 1) >= EXPEDITION_LEVEL;

/** Si hay almacén en uso (y de qué nivel el mejor). */
export const storeLevel = (s: GameState) =>
  Math.max(0, ...s.building.rooms.filter((r) => r.type === 'almacen').map((r) => active(r).level));

/**
 * Cuántos caben de un material: los básicos, unos pocos sin almacén y lo que guarde cada almacén
 * (por nivel y por hueco); los raros, solo en un almacén de nivel 2 o más.
 */
export function matCap(s: GameState, m: Material): number {
  const rooms = s.building.rooms.filter((r) => r.type === 'almacen');
  const stored = rooms.reduce((a, r) => {
    const { level, cells } = active(r);
    return a + (STORE_CAP[level] ?? STORE_CAP.at(-1)!) * cells;
  }, 0);
  if (BASIC.includes(m)) return MAT_LOOSE + stored;
  return storeLevel(s) >= 2 ? stored : 0;
}

/** «2 de cuero y 1 de hierro». */
export function matsText(m: Mats): string {
  const parts = MATERIAL_LIST.filter((k) => m[k]).map(
    (k) => `${m[k]} de ${MATERIALS[k].name.toLowerCase()}`,
  );
  return parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`
    : (parts[0] ?? 'nada');
}

/**
 * Guarda materiales: lo que cabe, al montón; lo que no, se vende a `MAT_SELL` cada uno. Devuelve
 * lo guardado, lo vendido y, si algo no cabía, el aviso (construir el almacén o ampliarlo).
 */
export function gainMats(
  s: GameState,
  gain: Mats,
): { kept: Mats; sold: Mats; gold: number; warn: string | null } {
  const kept: Mats = {};
  const sold: Mats = {};
  let gold = 0;
  const mats = { ...s.mats };
  for (const m of MATERIAL_LIST) {
    const n = gain[m] ?? 0;
    if (n <= 0) continue;
    const room = Math.max(0, matCap(s, m) - (mats[m] ?? 0));
    const k = Math.min(n, room);
    if (k) {
      mats[m] = (mats[m] ?? 0) + k;
      kept[m] = k;
    }
    if (n > k) {
      sold[m] = n - k;
      gold += (n - k) * MAT_SELL;
    }
  }
  s.mats = mats;
  s.gold += gold;
  if (!gold) return { kept, sold, gold, warn: null };
  const what = `No cabía: vendido ${matsText(sold)} por ${gold} monedas.`;
  const warn = storeLevel(s)
    ? `${what} Amplía el almacén para guardar más.`
    : s.mode === 'libre'
      ? `${what} Construye un almacén para guardarlos.`
      : `${what} Cuando pagues la deuda podrás construir un almacén.`;
  return { kept, sold, gold, warn };
}

/**
 * Lo que da el siguiente nivel del almacén, para su ficha. El 2 abre los estantes de lo raro, que
 * llega con las expediciones (si aún no las hay, se dice).
 */
export function storeNext(s: GameState, level: number): string | null {
  const next = level + 1;
  const room = `cabe más de cada material (${STORE_CAP[next] ?? STORE_CAP.at(-1)} por hueco)`;
  if (next > STORE_CAP.length - 1) return null;
  if (next === 2)
    return `Nivel 2: ${room} y estantes para lo delicado (hierbas, madera buena y cristal)${
      expeditionsOpen(s) ? '' : ', que llega con las expediciones'
    }.`;
  return `Nivel ${next}: ${room}.`;
}

/** Si hay de todo lo que se pide. */
export const hasMats = (s: GameState, need: Mats = {}) =>
  MATERIAL_LIST.every((m) => matOf(s, m) >= (need[m] ?? 0));

/** Gasta materiales (ya comprobado con `hasMats`). */
export function spendMats(s: GameState, need: Mats = {}): void {
  const mats = { ...s.mats };
  for (const m of MATERIAL_LIST) if (need[m]) mats[m] = (mats[m] ?? 0) - need[m]!;
  s.mats = mats;
}

/** Lo que falta de una lista, para decirlo («falta 1 de cuero»). */
export function missing(s: GameState, need: Mats = {}): Mats {
  const out: Mats = {};
  for (const m of MATERIAL_LIST) {
    const k = (need[m] ?? 0) - matOf(s, m);
    if (k > 0) out[m] = k;
  }
  return out;
}
