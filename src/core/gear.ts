/**
 * El equipo de un héroe: tres ranuras. **Arma** (espada, hacha, varita), **cuerpo** (coraza,
 * escudo, capa) y **complemento** (botas, amuleto, ganzúas). Cada objeto va a la suya según su
 * dibujo; los tesoros no se equipan.
 */
import { PRICE_KIND, PRICE_TIERS } from './balance';
import type { Hero, Item, ItemIcon, ItemPerk, Rarity } from './model';
import { t } from '../textos';
import { skillUse, type ClassId, type SkillId } from './party';

export type Slot = 'arma' | 'cuerpo' | 'complemento';
export const SLOTS: readonly Slot[] = ['arma', 'cuerpo', 'complemento'];
export const SLOT_NAMES: Record<Slot, string> = {
  arma: t('objetos.ranuras.arma'),
  cuerpo: t('objetos.ranuras.cuerpo'),
  complemento: t('objetos.ranuras.complemento'),
};

/** Lo que lleva puesto un héroe, por ranura. */
export type Gear = Partial<Record<Slot, Item>>;

const BY_ICON: Record<ItemIcon, Slot> = {
  espada: 'arma',
  hacha: 'arma',
  varita: 'arma',
  coraza: 'cuerpo',
  escudo: 'cuerpo',
  capa: 'cuerpo',
  botas: 'complemento',
  amuleto: 'complemento',
  ganzua: 'complemento',
};

/** La ranura de un objeto (null: un tesoro, que no se equipa). */
export function slotOf(it: Pick<Item, 'icon' | 'kind'>): Slot | null {
  if (it.icon) return BY_ICON[it.icon];
  if (it.kind === 'arma') return 'arma';
  if (it.kind === 'armadura') return 'cuerpo';
  if (it.kind === 'amuleto' || it.kind === 'herramienta') return 'complemento';
  return null;
}

/** Lo que lleva puesto, en orden de ranura. */
export const gearList = (h: { worn?: Gear }): Item[] =>
  SLOTS.map((s) => h.worn?.[s]).filter((x): x is Item => !!x);

/** Si alguno de sus objetos tiene esa ventaja. */
export const hasPerk = (h: { worn?: Gear }, p: ItemPerk) => gearList(h).some((i) => i.perk === p);

/** El objeto que se ve en su dibujo: el arma o, si no, lo primero que lleve. */
export const shownItem = (h: { worn?: Gear }): Item | undefined => gearList(h)[0];

/** Partidas de antes (un solo objeto en `item`): lo pasa a su ranura. */
export function migrateGear(h: Hero & { item?: Item }): void {
  if (!h.item) return;
  const slot = slotOf(h.item);
  if (slot && !h.worn?.[slot]) h.worn = { ...h.worn, [slot]: h.item };
  delete h.item;
}

/** El objeto que se ve en su dibujo, como lo pide la escena (dibujo y rareza). */
export function shownGear(h: { worn?: Gear }): { icon: ItemIcon; rarity: Rarity } | undefined {
  const it = gearList(h).find((i) => i.icon);
  return it?.icon ? { icon: it.icon, rarity: it.rarity ?? 0 } : undefined;
}

/**
 * Lo que dan por un objeto al venderlo. El equipo, por su rareza y lo que da (`PRICE_TIERS`), sin
 * mirar el rango ni de dónde salió; los tesoros, lo que pone en ellos.
 */
export function priceOf(it: Item): number {
  const slot = slotOf(it);
  if (!it.kind || it.kind === 'tesoro' || !slot) return it.value;
  const tier = PRICE_TIERS[it.rarity ?? 0] ?? PRICE_TIERS[0]!;
  const t = Math.max(0, Math.min(1, (gearPower(it) - tier.min) / (tier.max - tier.min)));
  const raw = (tier.lo + (tier.hi - tier.lo) * t) * (PRICE_KIND[slot] ?? 1);
  return Math.max(5, Math.round(raw / 5) * 5);
}

/**
 * Lo que da un objeto, para compararlo con otro de su ranura: la suma de sus bonos, las mejoras
 * del taller (el temple) y uno más si tiene efecto. Es la misma cuenta que pone su precio.
 */
export function gearPower(it: Item): number {
  const bonus = Object.values(it.bonus ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  return bonus + (it.plus ?? 0) + (it.perk ? 1 : 0);
}

/**
 * Lo que vale un objeto para una clase: sus bonos, cada uno por lo que la clase usa esa habilidad
 * (`skillUse`); la mejora (+N) va con su habilidad principal y el efecto especial cuenta uno.
 */
export function gearValueFor(it: Item, cls: ClassId): number {
  const entries = Object.entries(it.bonus ?? {}) as [SkillId, number][];
  const bonus = entries.reduce((a, [sk, n]) => a + n * skillUse(cls, sk), 0);
  const main = entries.sort((a, b) => b[1] - a[1])[0]?.[0];
  return bonus + (it.plus ?? 0) * (main ? skillUse(cls, main) : 1) + (it.perk ? 1 : 0);
}

/** Lo mínimo que tiene que ganar un héroe para que se le avise (no por una minucia). */
export const GEAR_HINT_MIN = 0.75;

/**
 * El consejo del arcón para toda la casa: cada objeto guardado, solo a quien más gana con él
 * (por su clase y lo que ya lleva), y a cada uno, como mucho uno por ranura. Así una espada nueva
 * no se le sugiere a todos a la vez, ni a un mago. Devuelve, por héroe, lo que le conviene.
 */
export function gearAdvice(
  heroes: readonly Pick<Hero, 'id' | 'cls' | 'worn'>[],
  stock: readonly Item[],
): Map<string, Upgrade[]> {
  const pairs: { hero: string; slot: Slot; item: Item; gain: number }[] = [];
  for (const h of heroes)
    for (const it of stock) {
      if (!it.kind || it.kind === 'tesoro') continue;
      const slot = slotOf(it);
      if (!slot) continue;
      const now = h.worn?.[slot];
      const gain = gearValueFor(it, h.cls) - (now ? gearValueFor(now, h.cls) : 0);
      if (gain >= GEAR_HINT_MIN) pairs.push({ hero: h.id, slot, item: it, gain });
    }
  pairs.sort((a, b) => b.gain - a.gain || a.hero.localeCompare(b.hero));
  const out = new Map<string, Upgrade[]>();
  const used = new Set<string>();
  const filled = new Set<string>();
  for (const p of pairs) {
    if (used.has(p.item.id) || filled.has(`${p.hero}:${p.slot}`)) continue;
    used.add(p.item.id);
    filled.add(`${p.hero}:${p.slot}`);
    out.set(p.hero, [...(out.get(p.hero) ?? []), { slot: p.slot, item: p.item }]);
  }
  return out;
}

/** Algo del arcón que da más que lo que lleva un héroe en esa ranura (o que lleva nada). */
export interface Upgrade {
  slot: Slot;
  item: Item;
}

/**
 * Las ranuras de un héroe para las que hay algo mejor en el arcón (`stock`: lo guardado), con lo
 * mejor de cada una. Los tesoros no cuentan. Es el aviso de que el equipo se queda olvidado.
 */
export function betterGear(h: { worn?: Gear }, stock: readonly Item[]): Upgrade[] {
  const out: Upgrade[] = [];
  for (const slot of SLOTS) {
    let best: Item | undefined;
    for (const it of stock) {
      if (!it.kind || it.kind === 'tesoro' || slotOf(it) !== slot) continue;
      if (!best || gearPower(it) > gearPower(best)) best = it;
    }
    const now = h.worn?.[slot];
    if (best && gearPower(best) > (now ? gearPower(now) : 0)) out.push({ slot, item: best });
  }
  return out;
}
