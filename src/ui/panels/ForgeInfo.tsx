/**
 * La forja por dentro: lo que se está creando o desmontando, las recetas para crear y los objetos
 * del arcón que se pueden desmontar para sacar su receta.
 */
import { itemIcon } from '../../art/items';
import {
  canCraft,
  canUndo,
  craftSlots,
  craftState,
  craftsIn,
  goodChance,
  knownRecipes,
  recipesFor,
  undoable,
  undoChance,
} from '../../core/crafting';
import type { Action } from '../../core/game';
import type { GameState, Room } from '../../core/model';
import { itemEffect } from '../../data/items';
import { RECIPES } from '../../data/recipes';
import { BufferImage } from '../BufferImage';
import { Icon } from '../icons';

const pct = (p: number) => `${Math.round(p * 100)} %`;

/** «unas 8 h», «menos de 1 h». */
const hours = (h: number) => (h < 1 ? 'menos de 1 h' : `unas ${Math.round(h)} h`);

export function ForgeInfo({
  game,
  room,
  onAct,
}: {
  game: GameState;
  room: Room;
  onAct?: (a: Action) => void;
}) {
  const jobs = craftsIn(game, room.id).map((c) => craftState(game, c));
  const known = knownRecipes(game);
  const all = recipesFor(room.type);
  const undo = undoable(game, room.id);
  const good = goodChance(game, room.id);
  return (
    <div class="forge">
      <span class="row-sub">
        {jobs.length
          ? `Trabajando (${jobs.length} de ${craftSlots(room)}).`
          : `Libre: puede hacer ${craftSlots(room) > 1 ? `${craftSlots(room)} cosas` : 'una cosa'} a la vez.`}{' '}
        Sale de las buenas {pct(good)} de las veces.
      </span>
      {jobs.map(({ craft: c, frac, hoursLeft }) => {
        const rc = RECIPES[c.recipe];
        const what = c.item ? `Desmontando ${c.item.name}` : `Creando: ${rc.name}`;
        return (
          <article key={c.id} class="row forge-job">
            <BufferImage buf={itemIcon(c.item?.icon ?? rc.icon, c.item?.rarity)} scale={2} />
            <span class="row-info">
              <b>{what}</b>
              <span class="train-bar" aria-label={pct(frac)}>
                <i style={{ width: pct(frac) }} />
              </span>
              <span class={`row-sub ${hoursLeft === null ? 'room-bad' : ''}`}>
                {hoursLeft === null
                  ? 'Parado: pon a un herrero (o a un héroe) a trabajar aquí.'
                  : `Le quedan ${hours(hoursLeft)}.`}
              </span>
            </span>
            {onAct && (
              <button class="btn btn-wood" onClick={() => onAct({ type: 'cancelCraft', id: c.id })}>
                Cancelar
              </button>
            )}
          </article>
        );
      })}
      <h4 class="sec-title">Crear</h4>
      <div class="rows">
        {all.map((id) => {
          const rc = RECIPES[id];
          if (!known.includes(id))
            return (
              <article key={id} class="row forge-locked">
                <BufferImage buf={itemIcon(rc.icon, 0)} scale={2} />
                <span class="row-info">
                  <b>{rc.name}</b>
                  <span class="row-sub">Se aprende desmontando {rc.one} o como premio.</span>
                </span>
                <Icon name="pergamino" size={14} />
              </article>
            );
          const why = canCraft(game, room.id, id);
          return (
            <article key={id} class="row">
              <BufferImage buf={itemIcon(rc.icon, 0)} scale={2} />
              <span class="row-info">
                <b>{rc.common.name}</b>
                <span class="row-sub">
                  {itemEffect({ ...rc.common, id })} · {hours(rc.hours)}
                </span>
                <span class="row-sub forge-good">
                  De las buenas: {rc.good.name} ({itemEffect({ ...rc.good, id })})
                </span>
              </span>
              {onAct && (
                <button
                  class="btn btn-gold"
                  disabled={!!why}
                  title={why ?? undefined}
                  aria-label={`Crear ${rc.common.name} por ${rc.gold} monedas`}
                  onClick={() => onAct({ type: 'craft', room: room.id, recipe: id })}
                >
                  Crear · <Icon name="coin" size={10} /> {rc.gold}
                </button>
              )}
            </article>
          );
        })}
      </div>
      {undo.length > 0 && (
        <>
          <h4 class="sec-title">Desmontar</h4>
          <span class="row-sub">
            Se pierde el objeto; {pct(undoChance(game, room.id))} de las veces se saca cómo se hace.
          </span>
          <div class="rows">
            {undo.map((it) => {
              const why = canUndo(game, room.id, it.id);
              return (
                <article key={it.id} class="row">
                  <BufferImage buf={itemIcon(it.icon ?? 'espada', it.rarity)} scale={2} />
                  <span class="row-info">
                    <b>{it.name}</b>
                    <span class="row-sub">{itemEffect(it)}</span>
                  </span>
                  {onAct && (
                    <button
                      class="btn btn-wood"
                      disabled={!!why}
                      title={why ?? undefined}
                      onClick={() => onAct({ type: 'undoItem', room: room.id, itemId: it.id })}
                    >
                      Desmontar
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
