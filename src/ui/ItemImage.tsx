import type { Item, ItemIcon, Rarity } from '../core/model';
import { itemAnimates, itemFrames } from '../art/items';
import { BufferImage } from './BufferImage';
import { useShine } from './useShine';

interface Props {
  icon: ItemIcon;
  rarity?: Rarity;
  plus?: number;
  /** El nombre del objeto (los legendarios con dibujo propio). */
  name?: string;
  scale?: number;
  label?: string;
}

/** El icono de un objeto; los épicos y legendarios brillan de vez en cuando. */
export function ItemImage({ icon, rarity = 0, plus = 0, name, scale = 2, label }: Props) {
  const frames = itemFrames(icon, rarity, plus, name);
  const f = useShine(itemAnimates(rarity), frames.length);
  return <BufferImage buf={frames[f] ?? frames[0]!} scale={scale} label={label} />;
}

/** Las props de `ItemImage` sacadas de un objeto. */
export const itemProps = (
  it: Pick<Item, 'icon' | 'rarity' | 'plus' | 'name'>,
  fallback: ItemIcon = 'espada',
) => ({
  icon: it.icon ?? fallback,
  rarity: it.rarity,
  plus: it.plus,
  name: it.name,
});
