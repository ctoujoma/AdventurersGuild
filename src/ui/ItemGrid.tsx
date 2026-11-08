/**
 * El equipo en rejilla: cada objeto es una casilla que dice de un vistazo su rareza (el marco),
 * la mejora del taller (+N), si tiene ventaja (estrella), lo que sube (dos fichas, la principal
 * más grande) y quién lo lleva (su inicial). Un toque corto la elige; manteniendo pulsado (o con
 * el ratón encima) sale un recuadro con todo lo demás.
 */
import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { itemIcon } from '../art/items';
import { temperCost } from '../core/crafting';
import { SLOT_NAMES, slotOf } from '../core/gear';
import type { Item } from '../core/model';
import type { SkillId } from '../core/party';
import { RARITY_NAMES, PERK_INFO, itemName } from '../data/items';
import { ROOMS } from '../data/rooms';
import { haptic } from '../platform/haptics';
import { BufferImage } from './BufferImage';
import { Icon } from './icons';

/** Lo que dura la pulsación larga (la misma que la ayuda de `HoldHelp`). */
const HOLD_MS = 450;

export const SKILL_SHORT: Record<SkillId, string> = {
  Combate: 'CMB',
  Trampas: 'TRA',
  Arcano: 'ARC',
  Supervivencia: 'SUP',
};

/** Lo que sube un objeto, con la mejora del taller sumada a lo principal (como en `gearOf`). */
export function itemStats(it: Item): { k: SkillId; n: number; base: number }[] {
  return (Object.entries(it.bonus ?? {}) as [SkillId, number][]).map(([k, v], i) => ({
    k,
    n: v + (i === 0 ? (it.plus ?? 0) : 0),
    base: v,
  }));
}

/** Para ordenar: lo mejor primero (rareza, mejora y lo que sube). */
export const itemScore = (it: Item) =>
  (it.rarity ?? 0) * 100 + (it.plus ?? 0) * 10 + itemStats(it).reduce((a, s) => a + s.n, 0);

export interface GridEntry {
  it: Item;
  /** Quién lo lleva puesto (su nombre), si alguien. */
  who?: string;
  /** Clave única en la rejilla (un objeto puesto y otro del arcón pueden compartir id). */
  key: string;
}

/** Una casilla. */
function ItemTile({
  e,
  selected,
  onPick,
  onTip,
}: {
  e: GridEntry;
  selected: boolean;
  onPick: () => void;
  onTip: (el: HTMLElement | null) => void;
}) {
  const { it, who } = e;
  const stats = itemStats(it);
  // Dos fichas como mucho, la mayor primero; solo se agranda si sube más que la otra.
  const chips = [...stats].sort((a, b) => b.n - a.n).slice(0, 2);
  const tie = chips.length === 2 && chips[0]!.n === chips[1]!.n;
  const ref = useRef<HTMLButtonElement>(null);
  const hold = useRef<{ t: number; x: number; y: number; fired: boolean } | null>(null);
  const label = [
    itemName(it),
    RARITY_NAMES[it.rarity ?? 0],
    ...stats.map((s) => `+${s.n} ${s.k}`),
    it.perk ? PERK_INFO[it.perk] : '',
    who ? `lo lleva ${who}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <button
      ref={ref}
      class={`item-tile rarity-${it.rarity ?? 0} ${selected ? 'is-sel' : ''}`}
      aria-label={label}
      aria-pressed={selected}
      onPointerDown={(ev) => {
        if (ev.pointerType === 'mouse') return;
        const t = window.setTimeout(() => {
          if (!hold.current) return;
          hold.current.fired = true;
          haptic('select');
          onTip(ref.current);
        }, HOLD_MS);
        hold.current = { t, x: ev.clientX, y: ev.clientY, fired: false };
      }}
      onPointerMove={(ev) => {
        const h = hold.current;
        if (h && Math.hypot(ev.clientX - h.x, ev.clientY - h.y) > 8) {
          clearTimeout(h.t);
          hold.current = null;
        }
      }}
      onPointerUp={() => {
        if (hold.current) clearTimeout(hold.current.t);
      }}
      onPointerEnter={(ev) => {
        if (ev.pointerType === 'mouse') onTip(ref.current);
      }}
      onPointerLeave={(ev) => {
        if (ev.pointerType === 'mouse') onTip(null);
      }}
      onContextMenu={(ev) => ev.preventDefault()}
      onClick={() => {
        // Lo que se mantuvo pulsado para leer no se elige al soltar.
        if (hold.current?.fired) {
          hold.current = null;
          return;
        }
        hold.current = null;
        onPick();
      }}
    >
      {it.plus ? <b class="item-plus">+{it.plus}</b> : null}
      {it.perk && (
        <span class="item-perk">
          <Icon name="star" size={10} />
        </span>
      )}
      <BufferImage buf={itemIcon(it.icon ?? 'espada', it.rarity)} scale={3} />
      <span class="item-chips">
        {chips.map((s, i) => (
          <span
            key={s.k}
            class={`item-chip skill-${SKILL_SHORT[s.k]} ${i || tie ? '' : 'is-main'}`}
          >
            {SKILL_SHORT[s.k]} {s.n}
          </span>
        ))}
      </span>
      {who && <span class="item-who">{who[0]}</span>}
    </button>
  );
}

/** El recuadro con todo lo de un objeto, pegado a su casilla (debajo o, si no cabe, encima). */
function ItemTip({ e, at }: { e: GridEntry; at: DOMRect }) {
  const { it, who } = e;
  const slot = slotOf(it);
  const cost = temperCost(it);
  const W = Math.min(300, innerWidth - 16);
  const left = Math.max(8, Math.min(innerWidth - W - 8, at.left + at.width / 2 - W / 2));
  const below = at.bottom + 260 < innerHeight || at.top < 260;
  const style = below
    ? { left: `${left}px`, top: `${at.bottom + 10}px`, width: `${W}px` }
    : { left: `${left}px`, bottom: `${innerHeight - at.top + 10}px`, width: `${W}px` };
  return (
    <div class={`item-tip rarity-${it.rarity ?? 0}`} role="tooltip" style={style}>
      <div class="item-tip-head">
        <span class={`item-tip-icon rarity-${it.rarity ?? 0}`}>
          <BufferImage buf={itemIcon(it.icon ?? 'espada', it.rarity)} scale={3} />
        </span>
        <span>
          <b>
            {it.name}
            {it.plus ? <span class="item-tip-plus"> +{it.plus}</span> : null}
          </b>
          <em>
            {RARITY_NAMES[it.rarity ?? 0]}
            {slot ? ` · ${SLOT_NAMES[slot]}` : ''}
          </em>
        </span>
      </div>
      <div class="item-tip-stats">
        {itemStats(it).map((s) => (
          <span key={s.k}>
            <b class={`item-chip skill-${SKILL_SHORT[s.k]}`}>{SKILL_SHORT[s.k]}</b> +{s.n} {s.k}
            {s.n !== s.base && (
              <small>
                {' '}
                ({s.base} {s.base === 1 ? 'suya' : 'suyas'}, +{s.n - s.base} del taller)
              </small>
            )}
          </span>
        ))}
        {it.perk && (
          <span>
            <Icon name="star" size={12} /> {PERK_INFO[it.perk]}
          </span>
        )}
        {cost ? (
          <small>
            Se puede mejorar a +{cost.to} en {ROOMS[cost.room].name.toLowerCase()}.
          </small>
        ) : it.plus ? (
          <small>Mejorado del todo: no sube más.</small>
        ) : null}
      </div>
      {it.desc && <p class="item-tip-desc">«{it.desc}»</p>}
      <div class="item-tip-foot">
        <span>{who ? `Lo lleva ${who}` : 'En el arcón'}</span>
        <span>Vale {it.value} monedas</span>
      </div>
    </div>
  );
}

/**
 * La rejilla. `selected` y `onPick` son la casilla elegida (un toque); el recuadro lo lleva ella
 * sola (pulsación larga en el móvil, ratón encima en el ordenador) y se va con el siguiente toque.
 */
export function ItemGrid({
  entries,
  selected,
  onPick,
  label,
  tut,
}: {
  entries: GridEntry[];
  selected: string | null;
  onPick: (key: string | null) => void;
  label: string;
  /** Para que el tutorial la señale. */
  tut?: string;
}) {
  const [tip, setTip] = useState<{ key: string; at: DOMRect } | null>(null);
  // Con el dedo, el recuadro se queda hasta el siguiente toque (en cualquier sitio).
  useEffect(() => {
    if (!tip) return;
    const off = (ev: PointerEvent) => {
      if (ev.pointerType !== 'mouse') setTip(null);
    };
    const t = setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', off, true);
    };
  }, [tip]);
  const shown = tip && entries.find((e) => e.key === tip.key);
  return (
    <>
      <div class="item-grid" role="group" aria-label={label} data-tut={tut}>
        {entries.map((e) => (
          <ItemTile
            key={e.key}
            e={e}
            selected={selected === e.key}
            onPick={() => onPick(selected === e.key ? null : e.key)}
            onTip={(el) => setTip(el ? { key: e.key, at: el.getBoundingClientRect() } : null)}
          />
        ))}
      </div>
      {/* Fuera del panel: dentro, su animación descoloca lo que va en posición fija. */}
      {shown && tip && createPortal(<ItemTip e={shown} at={tip.at} />, document.body)}
    </>
  );
}
