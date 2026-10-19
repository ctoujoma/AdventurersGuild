/**
 * El equipo sin dueño (ver `gearRoom` en furniture.ts): colgado en estantes de pared en la
 * armería y, lo que no cabe o no se puede colgar, en arcones apilados contra la pared.
 */
import { itemIcon } from '../../../art/items';
import { P } from '../../../art/palette';
import type { PixelBuffer } from '../../../art/pixel';
import { planksV } from '../../paint';
import * as Prop from '../../props';
import type { GearView } from '../../scene';
import { W, WALL, at, worldW, type Thing } from './kit';

/** Huecos para colgar equipo en cada estante de la armería, por nivel (filas de tres). */
export const RACK_SLOTS = [0, 3, 6, 9] as const;
/** A qué altura del suelo va el estante (debajo caben los arcones). */
export const RACK_Y = 22;

/** Estante de pared con el equipo colgado (con su rareza) y clavijas en los huecos libres. */
export function gearRack(items: readonly GearView[], slots: number): PixelBuffer {
  const cols = 3;
  const rows = Math.max(1, Math.ceil(slots / cols));
  const w = cols * 14 + 4;
  const h = rows * 15 + 4;
  return Prop.piece(w, h, (b) => {
    // Marco con remate y tablero de tablas oscuras.
    planksV(b, 1, 2, w - 2, h - 3, 'estante', [P.black, P.plum, P.bark, P.bark], 5);
    b.rect(0, 0, w, 2, W[4]!);
    b.hline(0, 0, w, W[5]!);
    b.vline(0, 0, h, W[3]!);
    b.vline(w - 1, 0, h, W[2]!);
    b.hline(0, h - 1, w, W[2]!);
    for (let r = 0; r < rows; r++) {
      const y = 2 + r * 15 + 13;
      b.hline(1, y, w - 2, W[4]!);
      b.hline(1, y + 1, w - 2, W[2]!);
    }
    for (let i = 0; i < slots; i++) {
      const x = 2 + (i % cols) * 14;
      const y = 2 + Math.floor(i / cols) * 15;
      const it = items[i];
      // Dos clavijas por hueco (se ven cuando está vacío).
      b.set(x + 3, y + 3, W[5]!);
      b.set(x + 9, y + 3, W[5]!);
      if (it) b.blit(itemIcon(it.icon, it.rarity), x + 1, y);
    }
  });
}

/**
 * Arcones con el equipo que no se cuelga (uno por cada tres), en filas de hasta tres contra la
 * pared desde `x0` hacia `dir`, y una segunda fila encima.
 */
export function gearChests(n: number, x0: number, dir: 1 | -1, z = WALL): Thing[] {
  const count = Math.min(6, Math.ceil(n / 3));
  const step = worldW(Prop.chest(), z) + 1;
  return Array.from({ length: count }, (_, i) => {
    const row = i < 3 ? 0 : 1;
    const k = row ? i - 3 : i;
    return at(Prop.chest(), x0 + dir * (k * step + row * step * 0.5), z, row * 11);
  });
}
