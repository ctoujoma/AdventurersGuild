/**
 * El equipo de un héroe: tres ranuras. **Arma** (espada, hacha, varita), **cuerpo** (coraza,
 * escudo, capa) y **complemento** (botas, amuleto, ganzúas). Cada objeto va a la suya según su
 * dibujo; los tesoros no se equipan.
 */
import type { Hero, Item, ItemIcon, ItemPerk, Rarity } from './model';

export type Slot = 'arma' | 'cuerpo' | 'complemento';
export const SLOTS: readonly Slot[] = ['arma', 'cuerpo', 'complemento'];
export const SLOT_NAMES: Record<Slot, string> = {
  arma: 'Arma',
  cuerpo: 'Cuerpo',
  complemento: 'Complemento',
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
