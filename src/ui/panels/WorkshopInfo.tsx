/**
 * Un taller por dentro (forja, sastrería, alquimia): lo que se está haciendo, las recetas para
 * crear, los objetos del arcón que se pueden desmontar para sacar su receta y, en la sastrería,
 * vestir a un héroe (tinte y prenda).
 */
import { useState } from 'preact/hooks';
import { itemIcon } from '../../art/items';
import { DRESS_GOLD, DRESS_HOURS } from '../../core/balance';
import {
  canCraft,
  canDress,
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
import { GARMENTS, TINTS, TINT_IDS, type Dress, type GarmentId } from '../../data/custom';
import { TRADES, type Trade } from '../../data/workers';
import { hasUnlock, unlockSource } from '../../core/goals';
import { BufferImage } from '../BufferImage';
import { Icon } from '../icons';
import { Portrait } from '../Portrait';
import { lookOf, marksOf } from '../view';

const pct = (p: number) => `${Math.round(p * 100)} %`;

/** «unas 8 h», «menos de 1 h». */
const hours = (h: number) => (h < 1 ? 'menos de 1 h' : `unas ${Math.round(h)} h`);

export function WorkshopInfo({
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
  const smith = TRADES[room.type as Trade]?.name.m.toLowerCase() ?? 'alguien';
  return (
    <div class="forge">
      <span class="row-sub">
        {jobs.length
          ? `Trabajando (${jobs.length} de ${craftSlots(room)}).`
          : `Libre: puede hacer ${craftSlots(room) > 1 ? `${craftSlots(room)} cosas` : 'una cosa'} a la vez.`}{' '}
        Sale de las buenas {pct(good)} de las veces.
      </span>
      {!game.workers.some((w) => w.room === room.id && w.trade === room.type) && (
        <span class="row-sub">
          Sin {smith}, solo trabaja un héroe que eche una mano, y más despacio. Si viene alguien a
          pedir trabajo de {smith}, contrátalo (hace falta cama en el dormitorio del servicio).
        </span>
      )}
      {jobs.map(({ craft: c, frac, hoursLeft }) => {
        const rc = c.recipe ? RECIPES[c.recipe] : null;
        const who = c.dress && game.heroes.find((h) => h.id === c.dress!.hero);
        const what = who
          ? `Vistiendo a ${who.name}`
          : c.item
            ? `Desmontando ${c.item.name}`
            : `Creando: ${rc!.name}`;
        return (
          <article key={c.id} class="row forge-job">
            {who ? (
              <Portrait look={lookOf(who)} marks={marksOf(who)} scale={1} alive={false} />
            ) : (
              <BufferImage buf={itemIcon(c.item?.icon ?? rc!.icon, c.item?.rarity)} scale={2} />
            )}
            <span class="row-info">
              <b>{what}</b>
              <span class="train-bar" aria-label={pct(frac)}>
                <i style={{ width: pct(frac) }} />
              </span>
              <span class={`row-sub ${hoursLeft === null ? 'room-bad' : ''}`}>
                {hoursLeft === null
                  ? who && who.status !== 'ok'
                    ? `Parado: ${who.name} no está en casa.`
                    : `Parado: pon a un ${smith} (o a un héroe) a trabajar aquí.`
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
      {room.type === 'sastreria' && <DressPicker game={game} room={room} onAct={onAct} />}
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

/** Vestir a un héroe de casa: el tinte (los que se tienen) y la prenda, con el retrato de cómo queda. */
function DressPicker({
  game,
  room,
  onAct,
}: {
  game: GameState;
  room: Room;
  onAct?: (a: Action) => void;
}) {
  const home = game.heroes.filter((h) => h.status === 'ok');
  const [who, setWho] = useState<string | null>(null);
  const [to, setTo] = useState<Dress>({});
  const [locked, setLocked] = useState<string | null>(null);
  const h = home.find((x) => x.id === who) ?? null;
  const pick = (id: string) => {
    const x = home.find((y) => y.id === id)!;
    setWho(id);
    setTo({ ...x.dress });
    setLocked(null);
  };
  const why = h ? canDress(game, room.id, h.id, to) : null;
  return (
    <div class="dress-pick">
      <h4 class="sec-title">Vestir</h4>
      <span class="row-sub">
        Cambia el color de la ropa y añade una prenda. El héroe viene aquí mientras le cosen (unas{' '}
        {DRESS_HOURS} h) y estrenar le sube la moral. Los tintes nuevos se ganan con hazañas y
        objetivos.
      </span>
      {!home.length && <span class="row-sub">No hay nadie en casa.</span>}
      <div class="dress-heroes" role="radiogroup" aria-label="A quién vestir">
        {home.map((x) => (
          <button
            key={x.id}
            role="radio"
            aria-checked={who === x.id}
            class={`btn ${who === x.id ? 'btn-gold' : 'btn-wood'}`}
            onClick={() => pick(x.id)}
          >
            {x.name}
          </button>
        ))}
      </div>
      {h && (
        <div class="dress-body">
          <Portrait
            look={lookOf({ ...h, dress: to })}
            marks={marksOf(h)}
            scale={2}
            label={`Así quedaría ${h.name}`}
          />
          <div class="dress-opts">
            <div class="tav-swatches" role="radiogroup" aria-label="Tinte">
              <button
                role="radio"
                aria-checked={!to.dye}
                aria-label="El de su clase"
                title="El de su clase"
                class={`tav-swatch room-swatch house ${to.dye ? '' : 'on'}`}
                onClick={() => setTo({ ...to, dye: undefined })}
              />
              {TINT_IDS.map((id) => {
                const [, d, m, l] = TINTS[id].ramp;
                const off = !hasUnlock(game, `tint:${id}`);
                const label = off
                  ? `${TINTS[id].name}. Se gana con: ${unlockSource(`tint:${id}`)}`
                  : TINTS[id].name;
                return (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={to.dye === id}
                    aria-disabled={off}
                    aria-label={label}
                    title={label}
                    class={`tav-swatch room-swatch ${to.dye === id ? 'on' : ''} ${off ? 'locked' : ''}`}
                    style={{ background: `linear-gradient(${l} 0 30%, ${m} 30% 70%, ${d} 70%)` }}
                    onClick={() => {
                      if (off) return setLocked(`${label}.`);
                      setLocked(null);
                      setTo({ ...to, dye: id });
                    }}
                  />
                );
              })}
            </div>
            {locked && <small class="lock-why">{locked}</small>}
            <div class="dress-garments" role="radiogroup" aria-label="Prenda">
              {([undefined, ...Object.keys(GARMENTS)] as (GarmentId | undefined)[]).map((g) => (
                <button
                  key={g ?? 'nada'}
                  role="radio"
                  aria-checked={to.garment === g}
                  class={`btn ${to.garment === g ? 'btn-gold' : 'btn-wood'}`}
                  onClick={() => setTo({ ...to, garment: g })}
                >
                  {g ? GARMENTS[g].name : 'Sin prenda'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {h && onAct && (
        <button
          class="btn btn-gold room-act"
          disabled={!!why}
          title={why ?? undefined}
          onClick={() => {
            onAct({ type: 'dressAt', room: room.id, heroId: h.id, dress: to });
            setWho(null);
          }}
        >
          Vestir · <Icon name="coin" size={10} /> {DRESS_GOLD}
        </button>
      )}
      {h && why && why !== 'Ya va así.' && <p class="qs-warn">{why}</p>}
    </div>
  );
}
