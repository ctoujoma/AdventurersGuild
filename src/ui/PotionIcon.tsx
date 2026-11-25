import { potionIcon } from '../art/items';
import { BufferImage } from './BufferImage';

/** El frasco de las pociones (el mismo de la alquimia y la despensa). */
export function PotionIcon({ scale = 1 }: { scale?: number }) {
  return <BufferImage buf={potionIcon()} scale={scale} class="potion-icon" />;
}
