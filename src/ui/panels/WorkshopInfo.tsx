/**
 * Un taller por dentro (forja, sastrería, alquimia): lo que se está haciendo, siempre a la vista,
 * y debajo las pestañas: Crear (las recetas, en lista), Templar (lo del arcón que se mejora o se
 * desmonta aquí, en una sola rejilla) y, en la sastrería, Vestir (tinte y prenda de un héroe).
 */
import { useState } from 'preact/hooks';
import { ItemImage } from '../ItemImage';
import { DRESS_GOLD, DRESS_HOURS } from '../../core/balance';
import {
  QUALITY_NAME,
  canCraft,
  canDress,
  canTemper,
  canUndo,
  clockHours,
  craftSlots,
  craftState,
  craftsIn,
  knownRecipes,
  qualityOdds,
  recipesFor,
  temperCost,
  undoable,
  undoChance,
  type Quality,
} from '../../core/crafting';
import type { Action } from '../../core/game';
import type { GameState, Room } from '../../core/model';
import { itemEffect, itemName } from '../../data/items';
import { tierOf } from '../../art/tiers';
import { MatCost } from '../mats';
import { ItemGrid } from '../ItemGrid';
import { RECIPES } from '../../data/recipes';
import { GARMENTS, TINTS, TINT_IDS, type Dress, type GarmentId } from '../../data/custom';
import { TRADES, type Trade } from '../../data/workers';
import { hasUnlock, unlockSource } from '../../core/goals';
import { listNames } from '../../core/text';
import { Icon } from '../icons';
import { Portrait } from '../Portrait';
import { Tabs, type TabItem } from '../Tabs';
import { heroFrame, lookOf, marksOf } from '../view';

const pct = (p: number) => `${Math.round(p * 100)} %`;

/** «unas 8 h», «menos de 1 h». */
const hours = (h: number) => (h < 1 ? 'menos de 1 h' : `unas ${Math.round(h)} h`);

/** «común 45 %, bueno 38 %, raro 17 %» (sin las calidades que no pueden salir). */
const oddsText = (odds: Record<Quality, number>) =>
  (Object.keys(QUALITY_NAME) as Quality[])
    .filter((q) => odds[q] > 0)
    .map((q) => `${QUALITY_NAME[q]} ${pct(odds[q])}`)
    .join(', ');

type Tab = 'crear' | 'templar' | 'vestir';

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
  const known = knownRecipes(game).filter((id) => recipesFor(room.type).includes(id));
  // La pestaña elegida se queda mientras la ficha está abierta (la ficha la monta por sala).
  const [tab, setTab] = useState<Tab>('crear');
  const dress = room.type === 'sastreria';
  const shown: Tab = tab === 'vestir' && !dress ? 'crear' : tab;
  const work = forWork(game, room);
  const tabs: TabItem<Tab>[] = [
    { id: 'crear', label: 'Crear', icon: 'martillo', count: known.length },
    { id: 'templar', label: 'Templar', icon: 'mejorar', count: work.length },
    ...(dress ? [{ id: 'vestir', label: 'Vestir', icon: 'tijeras' } as const] : []),
  ];
  const smith = TRADES[room.type as Trade]?.name.m.toLowerCase() ?? 'alguien';
  return (
    <div class="forge">
      <h4 class="sec-title">En marcha</h4>
      <span class="row-sub">
        {jobs.length
          ? `Trabajando (${jobs.length} de ${craftSlots(room)}).`
          : `Libre: puede hacer ${craftSlots(room) > 1 ? `${craftSlots(room)} cosas` : 'una cosa'} a la vez.`}
      </span>
      {!game.workers.some((w) => w.room === room.id && w.trade === room.type) && (
        <span class="row-sub">
          Sin {smith}, solo trabaja un héroe que eche una mano, y más despacio. Si viene alguien a
          pedir trabajo de {smith}, contrátalo (hace falta cama en el dormitorio del servicio).
        </span>
      )}
      {jobs.map(({ craft: c, frac, hoursLeft, walking }) => {
        const rc = c.recipe ? RECIPES[c.recipe] : null;
        const who = c.dress && game.heroes.find((h) => h.id === c.dress!.hero);
        const what = who
          ? `Vistiendo a ${who.name}`
          : c.item && c.temper
            ? `Mejorando ${itemName(c.item)} a +${(c.item.plus ?? 0) + 1}`
            : c.item
              ? `Desmontando ${itemName(c.item)}`
              : `Creando: ${rc!.name}`;
        return (
          <article key={c.id} class="row forge-job">
            {who ? (
              <Portrait look={lookOf(who)} marks={marksOf(who)} scale={1} alive={false} />
            ) : (
              <ItemImage
                icon={c.item?.icon ?? rc!.icon}
                rarity={c.item?.rarity}
                plus={c.item?.plus}
                name={c.item?.name}
                scale={2}
              />
            )}
            <span class="row-info">
              <b>{what}</b>
              <span class="train-bar" aria-label={pct(frac)}>
                <i style={{ width: pct(frac) }} />
              </span>
              <span class={`row-sub ${hoursLeft === null ? 'room-bad' : ''}`}>
                {hoursLeft === null
                  ? who && who.status !== 'ok'
                    ? `En pausa: ${who.name} ${who.status === 'mision' ? 'está de misión' : 'no está en pie'}. Sigue cuando vuelva (o cancela para dejar libre la sastrería).`
                    : `Parado: pon a un ${smith} (o a un héroe) a trabajar aquí.`
                  : walking && who
                    ? `${who.name} viene de camino.`
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
      <div class="forge-tabs">
        <Tabs tabs={tabs} value={shown} onChange={setTab} label="Qué hacer en el taller" />
      </div>
      {shown === 'crear' && <CraftList game={game} room={room} onAct={onAct} />}
      {shown === 'templar' && <TemperGrid game={game} room={room} onAct={onAct} />}
      {shown === 'vestir' && <DressPicker game={game} room={room} onAct={onAct} />}
    </div>
  );
}

/** Lo del arcón que se trabaja en un taller: se mejora (y aún no está a tope) o se desmonta. */
function forWork(game: GameState, room: Room) {
  const undo = undoable(game, room.id);
  return game.inventory.flatMap((it) => {
    const cost = temperCost(it);
    const temper = cost && cost.room === room.type ? cost : null;
    const unmake = undo.includes(it);
    return temper || unmake ? [{ it, temper, unmake }] : [];
  });
}

/** Crear: una fila por receta sabida; las que faltan por aprender, en una línea al final. */
function CraftList({
  game,
  room,
  onAct,
}: {
  game: GameState;
  room: Room;
  onAct?: (a: Action) => void;
}) {
  const known = knownRecipes(game);
  const all = recipesFor(room.type);
  const locked = all.filter((id) => !known.includes(id));
  return (
    <>
      <span class="row-sub">
        Ahora, con quien trabaja aquí, sale: {oddsText(qualityOdds(game, room.id))}. El bueno lleva
        +1; el raro es el que pone en cada receta.
      </span>
      <div class="rows">
        {all
          .filter((id) => known.includes(id))
          .map((id) => {
            const rc = RECIPES[id];
            const why = canCraft(game, room.id, id);
            return (
              <article key={id} class="row">
                <ItemImage icon={rc.icon} scale={2} />
                <span class="row-info">
                  <b>{rc.common.name}</b>
                  <span class="row-sub">
                    {itemEffect({ ...rc.common, id })} · {hours(clockHours(rc.hours))} ·{' '}
                    <span class={`forge-good tier-${tierOf(rc.good.rarity)}`} title={rc.good.name}>
                      <em>raro</em> {itemEffect({ ...rc.good, id })}
                    </span>
                  </span>
                  <MatCost game={game} mats={rc.mats} />
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
      {locked.length > 0 && (
        <span class="row-sub forge-locked">
          <Icon name="pergamino" size={12} /> Por aprender:{' '}
          {listNames(locked.map((id) => RECIPES[id].name))} (desmontando uno o como premio).
        </span>
      )}
    </>
  );
}

/** Templar: una sola rejilla con lo del arcón de este taller; al tocar uno, mejorar y desmontar. */
function TemperGrid({
  game,
  room,
  onAct,
}: {
  game: GameState;
  room: Room;
  onAct?: (a: Action) => void;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const work = forWork(game, room);
  if (!work.length)
    return (
      <span class="row-sub">
        No hay nada en el arcón que se trabaje aquí. Lo que traigan los héroes y no lleven puesto
        sale en esta pestaña.
      </span>
    );
  const sel = work.find((w) => w.it.id === pick);
  return (
    <>
      <span class="row-sub">
        Lo del arcón que se trabaja en este taller. Toca uno: mejorarlo (+1, hasta +3) o desmontarlo
        para aprender cómo se hace.
      </span>
      <ItemGrid
        label="Lo del arcón para este taller"
        entries={work.map(({ it }) => ({ it, key: it.id }))}
        selected={pick}
        onPick={setPick}
      />
      {sel ? (
        <article class="row item-act forge-pick">
          <span class="row-info">
            <b>
              {itemName(sel.it)}
              {sel.temper ? ` → +${sel.temper.to}` : ''}
            </b>
            {sel.temper ? (
              <>
                <span class="row-sub">
                  <b class="forge-plus">
                    +1
                    {Object.keys(sel.it.bonus ?? {})[0]
                      ? ` ${Object.keys(sel.it.bonus ?? {})[0]}`
                      : ''}
                  </b>{' '}
                  · {hours(clockHours(sel.temper.hours))}
                </span>
                <MatCost game={game} mats={sel.temper.mats} />
              </>
            ) : (
              <span class="row-sub">Ya está mejorado del todo (+3).</span>
            )}
            <span class="row-sub">
              {sel.unmake
                ? `Desmontar: se pierde; ${pct(undoChance(game, room.id))} de las veces sacas la receta.`
                : 'Desmontar: ya sabes hacerlo.'}
            </span>
          </span>
          {onAct && (
            <span class="forge-acts">
              {sel.temper && (
                <button
                  class="btn btn-gold"
                  disabled={!!canTemper(game, room.id, sel.it.id)}
                  title={canTemper(game, room.id, sel.it.id) ?? undefined}
                  aria-label={`Mejorar ${itemName(sel.it)} a +${sel.temper.to} por ${sel.temper.gold} monedas`}
                  onClick={() => {
                    onAct({ type: 'temper', room: room.id, itemId: sel.it.id });
                    setPick(null);
                  }}
                >
                  Mejorar · <Icon name="coin" size={10} /> {sel.temper.gold}
                </button>
              )}
              {sel.unmake && (
                <button
                  class="btn btn-wood"
                  disabled={!!canUndo(game, room.id, sel.it.id)}
                  title={canUndo(game, room.id, sel.it.id) ?? undefined}
                  onClick={() => {
                    onAct({ type: 'undoItem', room: room.id, itemId: sel.it.id });
                    setPick(null);
                  }}
                >
                  Desmontar
                </button>
              )}
            </span>
          )}
        </article>
      ) : (
        <span class="row-sub">Toca uno para ver lo que cuesta.</span>
      )}
    </>
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
      <span class="row-sub">
        Cambia el color de la ropa y añade una prenda. El héroe viene aquí mientras le cosen (unas{' '}
        {Math.round(clockHours(DRESS_HOURS))} h) y estrenar le sube la moral. Los tintes nuevos se
        ganan con hazañas y objetivos.
      </span>
      {!home.length && <span class="row-sub">No hay nadie en casa.</span>}
      <div class="picks dress-who" role="group" aria-label="A quién vestir">
        {home.map((x) => (
          <button
            key={x.id}
            class="pick"
            aria-pressed={who === x.id}
            aria-label={`Vestir a ${x.name}`}
            onClick={() => pick(x.id)}
          >
            <Portrait
              look={lookOf(x)}
              marks={marksOf(x)}
              frame={heroFrame(x)}
              scale={1}
              alive={false}
            />
            <span class="pick-name" aria-hidden="true">
              {x.name.split(' ')[0]}
            </span>
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
