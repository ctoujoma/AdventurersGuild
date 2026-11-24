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
import { type Msg, msg, t, tx } from '../textos';

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

/** Nombre, de dónde sale y quién lo pide (`materiales.<id>`), escritos. */
export const MATERIALS: Record<Material, { name: string; from: string; uses: string }> =
  Object.fromEntries(
    MATERIAL_LIST.map((m) => [
      m,
      {
        name: t(`materiales.${m}.nombre`),
        from: t(`materiales.${m}.de_donde`),
        uses: t(`materiales.${m}.usos`),
      },
    ]),
  ) as Record<Material, { name: string; from: string; uses: string }>;

/** El nombre de un material, para un hueco. */
export const matMsg = (m: Material): Msg => msg(`materiales.${m}.nombre`);

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

/**
 * Lo que guarda un almacén de un material, cuando hay varios: el total se reparte según lo que
 * cabe en cada uno (los raros, solo en los de nivel 2 o más); el primero lleva además lo que cabe
 * suelto de los básicos (`MAT_LOOSE`). Null si este almacén no guarda ese material.
 */
export function storeShare(
  s: GameState,
  roomId: string,
  m: Material,
): { n: number; cap: number } | null {
  const rare = !BASIC.includes(m);
  const rooms = s.building.rooms.filter(
    (r) => r.type === 'almacen' && active(r).level >= (rare ? 2 : 1),
  );
  if (!rooms.some((r) => r.id === roomId)) return null;
  const caps = rooms.map((r, i) => {
    const { level, cells } = active(r);
    return (STORE_CAP[level] ?? STORE_CAP.at(-1)!) * cells + (!rare && i === 0 ? MAT_LOOSE : 0);
  });
  const total = caps.reduce((a, c) => a + c, 0);
  const n = Math.min(matOf(s, m), total);
  // Reparto por lo que cabe en cada uno, con los restos a los que más decimales tengan.
  const exact = caps.map((c) => (total ? (n * c) / total : 0));
  const share = exact.map(Math.floor);
  let left = n - share.reduce((a, x) => a + x, 0);
  const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    share[i]!++;
    left--;
  }
  const i = rooms.findIndex((r) => r.id === roomId);
  return { n: share[i]!, cap: caps[i]! };
}

/** «2 de cuero y 1 de hierro», como mensaje. */
export function matsMsg(m: Mats): Msg {
  const parts = MATERIAL_LIST.filter((k) => m[k]).map((k) =>
    msg('materiales.cuanto', { n: m[k], material: matMsg(k) }),
  );
  return parts.length ? msg('general.lista', { xs: parts }) : msg('materiales.nada');
}

/** Lo mismo, escrito. */
export const matsText = (m: Mats): string => tx(matsMsg(m));

/**
 * Guarda materiales: lo que cabe, al montón; lo que no, se vende a `MAT_SELL` cada uno. Devuelve
 * lo guardado, lo vendido y, si algo no cabía, el aviso (construir el almacén o ampliarlo).
 */
export function gainMats(
  s: GameState,
  gain: Mats,
): { kept: Mats; sold: Mats; gold: number; warn: Msg | null } {
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
  const warn = msg('materiales.no_cabe', {
    que: matsMsg(sold),
    oro: gold,
    consejo: storeLevel(s) ? 'ampliar' : s.mode === 'libre' ? 'construir' : 'deuda',
  });
  return { kept, sold, gold, warn };
}

/**
 * Lo que da el siguiente nivel del almacén, para su ficha. El 2 abre los estantes de lo raro, que
 * llega con las expediciones (si aún no las hay, se dice).
 */
export function storeNext(s: GameState, level: number): string | null {
  const next = level + 1;
  if (next > STORE_CAP.length - 1) return null;
  return t('materiales.almacen_siguiente', {
    nivel: next,
    n: STORE_CAP[next] ?? STORE_CAP.at(-1),
    delicado: next === 2,
    expediciones: expeditionsOpen(s),
  });
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
