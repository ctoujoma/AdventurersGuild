/**
 * Un taller por dentro (forja, sastrería, alquimia). Sus pestañas van arriba de la ficha, junto a
 * «Sala»: Crear (las recetas, en lista), Templar (lo del arcón que se mejora o se desmonta aquí, en
 * una sola rejilla) y, en la sastrería, Vestir (tinte y prenda de un héroe). Lo que se está
 * haciendo sale en «Sala» y encima de cada pestaña, para ver al momento lo que se encarga.
 */
import { useState } from 'preact/hooks';
import { ItemImage } from '../ItemImage';
import { DRESS_GOLD, DRESS_HOURS, POTION_GOLD, POTION_HOURS } from '../../core/balance';
import { potionIcon } from '../../art/items';
import { BufferImage } from '../BufferImage';
import {
  QUALITY_NAME,
  canCraft,
  canDress,
  canPotion,
  goodChance,
  POTION_MATS,
  potionCap,
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
import type { TabItem } from '../Tabs';
import { heroFrame, lookOf, marksOf } from '../view';
import { t, tx } from '../../textos';

const pct = (p: number) => `${Math.round(p * 100)} %`;

/** «unas 8 h», «menos de 1 h». */
const hours = (h: number) =>
  h < 1 ? t('paneles.workshopinfo.menos_de_1_h') : `unas ${Math.round(h)} h`;

/** «común 45 %, bueno 38 %, raro 17 %» (sin las calidades que no pueden salir). */
const oddsText = (odds: Record<Quality, number>) =>
  (Object.keys(QUALITY_NAME) as Quality[])
    .filter((q) => odds[q] > 0)
    .map((q) => `${QUALITY_NAME[q]} ${pct(odds[q])}`)
    .join(', ');

export type WorkTab = 'crear' | 'templar' | 'vestir';

/** Las pestañas del taller (van en la fila de la ficha, tras «Sala»). */
export function workshopTabs(game: GameState, room: Room): TabItem<WorkTab>[] {
  const known = knownRecipes(game).filter((id) => recipesFor(room.type).includes(id));
  return [
    {
      id: 'crear',
      label: t('paneles.workshopinfo.crear'),
      icon: 'martillo',
      count: known.length + (room.type === 'alquimia' ? 1 : 0),
    },
    {
      id: 'templar',
      label: t('paneles.workshopinfo.templar'),
      icon: 'mejorar',
      count: forWork(game, room).length,
    },
    ...(room.type === 'sastreria'
      ? [{ id: 'vestir', label: t('paneles.workshopinfo.vestir'), icon: 'tijeras' } as const]
      : []),
  ];
}

/**
 * Lo del taller que va en una pestaña: en «Sala» (`tab` vacío), lo que está en marcha con la
 * explicación de si falta artesano; en las demás, lo que está en marcha y debajo lo suyo.
 */
export function WorkshopInfo({
  game,
  room,
  tab,
  onAct,
}: {
  game: GameState;
  room: Room;
  tab?: WorkTab;
  onAct?: (a: Action) => void;
}) {
  const jobs = craftsIn(game, room.id).map((c) => craftState(game, c));
  const smith =
    TRADES[room.type as Trade]?.name.m.toLowerCase() ?? t('paneles.workshopinfo.alguien');
  return (
    <div class="forge">
      <h4 class="sec-title">{t('paneles.workshopinfo.en_marcha')}</h4>
      <span class="row-sub">
        {jobs.length
          ? t('paneles.workshopinfo.trabajando_de', {
              length: jobs.length,
              craft_slots: craftSlots(room),
            })
          : t('paneles.workshopinfo.libre_puede_hacer_a', { n: craftSlots(room) })}
      </span>
      {!tab && !game.workers.some((w) => w.room === room.id && w.trade === room.type) && (
        <span class="row-sub">
          {t('paneles.workshopinfo.sin_solo_trabaja_un', { smith, smith2: smith })}
        </span>
      )}
      {jobs.map(({ craft: c, frac, hoursLeft, walking }) => {
        const rc = c.recipe ? RECIPES[c.recipe] : null;
        const who = c.dress && game.heroes.find((h) => h.id === c.dress!.hero);
        const what = who
          ? t('paneles.workshopinfo.vistiendo_a', { nombre: who.name })
          : c.item && c.temper
            ? t('paneles.workshopinfo.mejorando_a', {
                item_name: itemName(c.item),
                mas: (c.item.plus ?? 0) + 1,
              })
            : c.item
              ? t('paneles.workshopinfo.desmontando', { item_name: itemName(c.item) })
              : c.potion
                ? t('talleres.pocion.preparando')
                : t('paneles.workshopinfo.creando', { objeto: rc!.name });
        return (
          <article key={c.id} class="row forge-job">
            {who ? (
              <Portrait look={lookOf(who)} marks={marksOf(who)} scale={1} alive={false} />
            ) : c.potion ? (
              <BufferImage buf={potionIcon()} scale={2} />
            ) : (
              <ItemImage
                icon={c.item?.icon ?? rc!.icon}
                rarity={c.item?.rarity}
                plus={c.item?.plus}
                name={tx(c.item?.name)}
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
                    ? t('paneles.workshopinfo.en_pausa_sigue_cuando', {
                        nombre: who.name,
                        mision: who.status === 'mision',
                      })
                    : t('paneles.workshopinfo.parado_pon_a_un', { smith })
                  : walking && who
                    ? t('paneles.workshopinfo.viene_de_camino', { nombre: who.name })
                    : t('paneles.workshopinfo.le_quedan', { horas: hours(hoursLeft) })}
              </span>
            </span>
            {onAct && (
              <button class="btn btn-wood" onClick={() => onAct({ type: 'cancelCraft', id: c.id })}>
                {t('paneles.workshopinfo.cancelar')}
              </button>
            )}
          </article>
        );
      })}
      {room.type === 'alquimia' && !tab && <PotionStock game={game} />}
      {tab === 'crear' && room.type === 'alquimia' && (
        <PotionRow game={game} room={room} onAct={onAct} />
      )}
      {tab === 'crear' && <CraftList game={game} room={room} onAct={onAct} />}
      {tab === 'templar' && <TemperGrid game={game} room={room} onAct={onAct} />}
      {tab === 'vestir' && room.type === 'sastreria' && (
        <DressPicker game={game} room={room} onAct={onAct} />
      )}
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
/** «Pociones: 3 de 6», con lo que hacen. */
function PotionStock({ game }: { game: GameState }) {
  return (
    <span class="row-sub potion-stock" data-help={t('talleres.pocion.ayuda')}>
      <BufferImage buf={potionIcon()} scale={1} />{' '}
      <b>{t('talleres.pocion.titulo', { n: game.potions ?? 0, tope: potionCap(game) })}</b>
    </span>
  );
}

/** La poción, la receta de serie de la alquimia: no sale un objeto, suben las pociones. */
function PotionRow({
  game,
  room,
  onAct,
}: {
  game: GameState;
  room: Room;
  onAct?: (a: Action) => void;
}) {
  const why = canPotion(game, room.id);
  return (
    <>
      <PotionStock game={game} />
      <div class="rows">
        <article class="row">
          <BufferImage buf={potionIcon()} scale={2} />
          <span class="row-info">
            <b>{t('talleres.pocion.nombre')}</b>
            <span class="row-sub">
              {t('talleres.pocion.ayuda')} {hours(clockHours(POTION_HOURS))} ·{' '}
              {t('talleres.pocion.dos', { pct: Math.round(goodChance(game, room.id) * 100) })}
            </span>
            <MatCost game={game} mats={POTION_MATS} />
          </span>
          {onAct && (
            <button
              class="btn btn-gold"
              disabled={!!why}
              title={why ?? undefined}
              aria-label={t('talleres.pocion.preparar')}
              onClick={() => onAct({ type: 'potion', room: room.id })}
            >
              {t('paneles.workshopinfo.crear_2')} <Icon name="coin" size={10} /> {POTION_GOLD}
            </button>
          )}
        </article>
      </div>
      {why && <span class="row-sub room-bad">{why}</span>}
    </>
  );
}

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
        {t('paneles.workshopinfo.ahora_con_quien_trabaja', {
          odds_text: oddsText(qualityOdds(game, room.id)),
        })}
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
                  <b>{tx(rc.common.name)}</b>
                  <span class="row-sub">
                    {itemEffect({ ...rc.common, id })} · {hours(clockHours(rc.hours))} ·{' '}
                    <span
                      class={`forge-good tier-${tierOf(rc.good.rarity)}`}
                      title={tx(rc.good.name)}
                    >
                      <em>{t('paneles.workshopinfo.raro')}</em> {itemEffect({ ...rc.good, id })}
                    </span>
                  </span>
                  <MatCost game={game} mats={rc.mats} />
                </span>
                {onAct && (
                  <button
                    class="btn btn-gold"
                    disabled={!!why}
                    title={why ?? undefined}
                    aria-label={t('paneles.workshopinfo.crear_por_monedas', {
                      nombre: tx(rc.common.name),
                      oro: rc.gold,
                    })}
                    onClick={() => onAct({ type: 'craft', room: room.id, recipe: id })}
                  >
                    {t('paneles.workshopinfo.crear_2')} <Icon name="coin" size={10} /> {rc.gold}
                  </button>
                )}
              </article>
            );
          })}
      </div>
      {locked.length > 0 && (
        <span class="row-sub forge-locked">
          <Icon name="pergamino" size={12} />{' '}
          {t('paneles.workshopinfo.por_aprender_desmontando_uno', {
            recetas: listNames(locked.map((id) => RECIPES[id].name)),
          })}
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
  if (!work.length) return <span class="row-sub">{t('paneles.workshopinfo.no_hay_nada_en')}</span>;
  const sel = work.find((w) => w.it.id === pick);
  return (
    <>
      <span class="row-sub">{t('paneles.workshopinfo.lo_del_arcon_que')}</span>
      <ItemGrid
        label={t('paneles.workshopinfo.lo_del_arcon_para')}
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
              <span class="row-sub">{t('paneles.workshopinfo.ya_esta_mejorado_del')}</span>
            )}
            <span class="row-sub">
              {sel.unmake
                ? t('paneles.workshopinfo.desmontar_se_pierde_de', {
                    pct: pct(undoChance(game, room.id)),
                  })
                : t('paneles.workshopinfo.desmontar_ya_sabes_hacerlo')}
            </span>
          </span>
          {onAct && (
            <span class="forge-acts">
              {sel.temper && (
                <button
                  class="btn btn-gold"
                  disabled={!!canTemper(game, room.id, sel.it.id)}
                  title={canTemper(game, room.id, sel.it.id) ?? undefined}
                  aria-label={t('paneles.workshopinfo.mejorar_a_por_monedas', {
                    item_name: itemName(sel.it),
                    to: sel.temper.to,
                    oro: sel.temper.gold,
                  })}
                  onClick={() => {
                    onAct({ type: 'temper', room: room.id, itemId: sel.it.id });
                    setPick(null);
                  }}
                >
                  {t('paneles.workshopinfo.mejorar')} <Icon name="coin" size={10} />{' '}
                  {sel.temper.gold}
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
                  {t('paneles.workshopinfo.desmontar')}
                </button>
              )}
            </span>
          )}
        </article>
      ) : (
        <span class="row-sub">{t('paneles.workshopinfo.toca_uno_para_ver')}</span>
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
        {t('paneles.workshopinfo.cambia_el_color_de', {
          horas: Math.round(clockHours(DRESS_HOURS)),
        })}
      </span>
      {!home.length && <span class="row-sub">{t('paneles.workshopinfo.no_hay_nadie_en')}</span>}
      <div
        class="picks dress-who"
        role="group"
        aria-label={t('paneles.workshopinfo.a_quien_vestir')}
      >
        {home.map((x) => (
          <button
            key={x.id}
            class="pick"
            aria-pressed={who === x.id}
            aria-label={t('paneles.workshopinfo.vestir_a', { nombre: x.name })}
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
            label={t('paneles.workshopinfo.asi_quedaria', { nombre: h.name })}
          />
          <div class="dress-opts">
            <div
              class="tav-swatches"
              role="radiogroup"
              aria-label={t('paneles.workshopinfo.tinte')}
            >
              <button
                role="radio"
                aria-checked={!to.dye}
                aria-label={t('paneles.workshopinfo.el_de_su_clase')}
                title={t('paneles.workshopinfo.el_de_su_clase')}
                class={`tav-swatch room-swatch house ${to.dye ? '' : 'on'}`}
                onClick={() => setTo({ ...to, dye: undefined })}
              />
              {TINT_IDS.map((id) => {
                const [, d, m, l] = TINTS[id].ramp;
                const off = !hasUnlock(game, `tint:${id}`);
                const label = off
                  ? t('paneles.workshopinfo.se_gana_con', {
                      nombre: TINTS[id].name,
                      unlock_source: unlockSource(`tint:${id}`),
                    })
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
            <div
              class="dress-garments"
              role="radiogroup"
              aria-label={t('paneles.workshopinfo.prenda')}
            >
              {([undefined, ...Object.keys(GARMENTS)] as (GarmentId | undefined)[]).map((g) => (
                <button
                  key={g ?? 'nada'}
                  role="radio"
                  aria-checked={to.garment === g}
                  class={`btn ${to.garment === g ? 'btn-gold' : 'btn-wood'}`}
                  onClick={() => setTo({ ...to, garment: g })}
                >
                  {g ? GARMENTS[g].name : t('paneles.workshopinfo.sin_prenda')}
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
          {t('paneles.workshopinfo.vestir_2')} <Icon name="coin" size={10} /> {DRESS_GOLD}
        </button>
      )}
      {h && why && why !== t('talleres.ropa.igual') && <p class="qs-warn">{why}</p>}
    </div>
  );
}
