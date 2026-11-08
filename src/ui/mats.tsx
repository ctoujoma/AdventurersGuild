/**
 * Los materiales en la interfaz: su dibujo, lo que cuesta algo (en verde si lo hay, en gris con
 * lo que falta) y el estante de arriba del Arcón.
 */
import { useState } from 'preact/hooks';
import { MAT_LOOSE } from '../core/balance';
import {
  BASIC,
  MATERIAL_LIST,
  MATERIALS,
  matCap,
  matOf,
  storeLevel,
  type Material,
  type Mats,
} from '../core/materials';
import type { GameState } from '../core/model';
import type { IconName } from './icons';
import { BufferImage } from './BufferImage';
import { materialIcon } from '../art/materials';

export const MAT_ICON: Record<Material, IconName> = {
  hierro: 'lingote',
  cuero: 'cuero',
  tela: 'tela',
  hierbas: 'hierbas',
  madera: 'madera',
  cristal: 'cristal',
};

/**
 * El dibujo de un material (`art/materials.ts`), a su tamaño de verdad para que no se emborrone:
 * el de 16 en las líneas y los chips; con `size` de 20 o más, el de 32, con más detalle.
 */
export function MatIcon({ m, size = 14 }: { m: Material; size?: number }) {
  return (
    <BufferImage
      buf={materialIcon(m, size >= 20 ? 32 : 16)}
      scale={1}
      label={MATERIALS[m].name}
      class="mat-icon"
    />
  );
}

/** «+2 cuero» de un chip del informe: el material, si lo es (para el dibujo y el salto). */
export function chipMat(t: string): { m: Material; n: number } | null {
  const hit = /^\+(\d+) (.+)$/.exec(t);
  if (!hit) return null;
  const m = MATERIAL_LIST.find((k) => MATERIALS[k].name.toLowerCase() === hit[2]);
  return m ? { m, n: Number(hit[1]) } : null;
}

/** Lo que pide algo, material a material: verde si lo hay, gris con lo que falta si no. */
export function MatCost({ game, mats }: { game: GameState; mats?: Mats }) {
  const list = MATERIAL_LIST.filter((m) => mats?.[m]);
  if (!list.length) return null;
  return (
    <span class="mat-cost">
      {list.map((m) => {
        const need = mats![m]!;
        const have = matOf(game, m);
        const ok = have >= need;
        const name = MATERIALS[m].name.toLowerCase();
        return (
          <span
            key={m}
            class={`mat-need ${ok ? 'is-ok' : 'is-short'}`}
            title={ok ? `${need} de ${name}` : `${need} de ${name}: faltan ${need - have}`}
          >
            <MatIcon m={m} size={12} />
            {need}
            {!ok && <small> (faltan {need - have})</small>}
          </span>
        );
      })}
    </span>
  );
}

/**
 * El estante del Arcón: un tarro por material con su dibujo, cuántos hay y cuántos caben. Al
 * tocarlo, de dónde sale y para qué sirve. Los raros, solo si hay sitio para ellos o alguno.
 */
export function MatShelf({ game }: { game: GameState }) {
  const [open, setOpen] = useState<Material | null>(null);
  const list = MATERIAL_LIST.filter(
    (m) => BASIC.includes(m) || matCap(game, m) > 0 || matOf(game, m) > 0,
  );
  return (
    <div class="mat-shelf">
      <div class="mat-jars" role="group" aria-label="Materiales">
        {list.map((m) => {
          const n = matOf(game, m);
          const cap = matCap(game, m);
          return (
            <button
              key={m}
              class={`mat-jar ${n >= cap && cap > 0 ? 'is-full' : ''} ${open === m ? 'is-open' : ''}`}
              data-mat={m}
              aria-expanded={open === m}
              aria-label={`${MATERIALS[m].name}: ${n} de ${cap}`}
              onClick={() => setOpen(open === m ? null : m)}
            >
              <MatIcon m={m} size={22} />
              <b>
                {n}
                <small>/{cap}</small>
              </b>
            </button>
          );
        })}
      </div>
      {open && (
        <p class="mat-why" role="status">
          <b>{MATERIALS[open].name}.</b> {MATERIALS[open].from} {MATERIALS[open].uses}
        </p>
      )}
      {!storeLevel(game) && (
        <small class="mat-loose">Sin almacén caben {MAT_LOOSE} de cada, en un rincón.</small>
      )}
    </div>
  );
}
