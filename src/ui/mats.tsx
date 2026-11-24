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
  matMsg,
  matOf,
  storeLevel,
  storeShare,
  type Material,
  type Mats,
} from '../core/materials';
import type { GameState, Room } from '../core/model';
import type { IconName } from './icons';
import { BufferImage } from './BufferImage';
import { materialIcon } from '../art/materials';
import { idText, t, type Txt } from '../textos';

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

/**
 * El material de un chip del informe («+2 cuero»), si lo es (para el dibujo y el salto): por su
 * clave; en las partidas viejas, leyendo la frase en español.
 */
export function chipMat(c: Txt | undefined): { m: Material; n: number } | null {
  if (c && typeof c === 'object') {
    if (c.k !== 'informes.chip_material') return null;
    const name = idText(c.p?.material as Txt | undefined).toLowerCase();
    const m = MATERIAL_LIST.find((k) => idText(matMsg(k)).toLowerCase() === name);
    return m ? { m, n: Number(c.p?.n) } : null;
  }
  const hit = /^\+(\d+) (.+)$/.exec(c ?? '');
  if (!hit) return null;
  const m = MATERIAL_LIST.find((k) => idText(matMsg(k)).toLowerCase() === hit[2]);
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
            title={
              ok
                ? t('barra.mats.de', { n: need, nombre: name })
                : t('barra.mats.de_faltan', { n: need, nombre: name, faltan: need - have })
            }
          >
            <MatIcon m={m} size={12} />
            {need}
            {!ok && <small> {t('barra.mats.faltan', { n: need - have })}</small>}
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
export function MatShelf({ game, room }: { game: GameState; room?: Room }) {
  const [open, setOpen] = useState<Material | null>(null);
  // En la ficha de un almacén, si hay varios: solo su parte (el arcón enseña el total).
  const stores = game.building.rooms.filter((r) => r.type === 'almacen' && r.level > 0).length;
  const own = room && stores > 1 ? room.id : null;
  const amount = (m: Material) =>
    own
      ? (storeShare(game, own, m) ?? { n: 0, cap: 0 })
      : { n: matOf(game, m), cap: matCap(game, m) };
  const list = MATERIAL_LIST.filter((m) =>
    own
      ? storeShare(game, own, m) !== null
      : BASIC.includes(m) || matCap(game, m) > 0 || matOf(game, m) > 0,
  );
  return (
    <div class="mat-shelf">
      <div class="mat-jars" role="group" aria-label={t('barra.mats.materiales')}>
        {list.map((m) => {
          const { n, cap } = amount(m);
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
      {own && <small class="mat-loose">{t('barra.mats.parte_de', { n: stores })}</small>}
      {!storeLevel(game) && (
        <small class="mat-loose">
          {t('barra.mats.sin_almacen_caben_de', { mat_loose: MAT_LOOSE })}
        </small>
      )}
    </div>
  );
}
