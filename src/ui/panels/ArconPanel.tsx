import { useState } from 'preact/hooks';
import { trophyIcon } from '../../art/items';
import { TROPHY_APPEAL, TROPHY_SLOTS } from '../../core/balance';
import type { GameState, Hero, Item } from '../../core/model';
import { RARITY_NAMES, itemName } from '../../data/items';
import { tierOf, type Tier } from '../../art/tiers';
import { MatShelf } from '../mats';
import { ItemImage } from '../ItemImage';
import { ItemGrid, itemScore, type GridEntry } from '../ItemGrid';
import { CLASS_NAMES, skillName } from '../../data/labels';
import { skill, type SkillId } from '../../core/party';
import { BufferImage } from '../BufferImage';
import { help } from '../HoldHelp';
import { Icon } from '../icons';
import { Portrait } from '../Portrait';
import { Tabs } from '../Tabs';
import { lookOf, marksOf, memberOf, heroFrame } from '../view';
import { SLOTS, SLOT_NAMES, priceOf, slotOf, type Slot } from '../../core/gear';
import { t, tx } from '../../textos';
import { placeName } from '../../data/places';

export type ArconTab = 'equipo' | 'tesoros' | 'trofeos';

interface Props {
  game: GameState;
  tab: ArconTab;
  onTab: (t: ArconTab) => void;
  onEquip: (heroId: string, itemId: string) => void;
  onUnequip: (heroId: string, slot: Slot) => void;
  onSell: (itemId: string) => void;
  onSellTrophy: (id: string) => void;
  onHero: (id: string) => void;
}

const isGear = (i: Item) => !!i.kind && i.kind !== 'tesoro';
const inGuild = (h: Hero) => h.status === 'ok' || h.status === 'herido';

/** Botón de vender: moneda y precio. */
function Sell({ name, value, onSell }: { name: string; value: number; onSell: () => void }) {
  return (
    <button
      class="btn btn-wood"
      aria-label={t('paneles.arcon.vender_por_monedas', { nombre: name, valor: value })}
      onClick={onSell}
    >
      <Icon name="coin" size={12} /> {value}
    </button>
  );
}

type Filter = 'todo' | Slot;
const FILTERS: [Filter, string][] = [
  ['todo', t('paneles.arcon.todo')],
  ['arma', 'Arma'],
  ['cuerpo', t('paneles.arcon.cuerpo')],
  ['complemento', t('paneles.arcon.complemento')],
];

/** A quién se da un objeto: los retratos de los de casa, con lo que gana cada uno. */
function GivePicks({
  game,
  it,
  takers,
  onGive,
}: {
  game: GameState;
  it: Item;
  takers: Hero[];
  onGive: (heroId: string) => void;
}) {
  return (
    <div
      class="picks arcon-picks"
      role="group"
      aria-label={t('paneles.arcon.a_quien_le_das', { item_name: itemName(it) })}
    >
      {takers.map((h) => {
        const slot = slotOf(it) ?? 'arma';
        const was = h.worn?.[slot];
        // Cómo le queda lo que mejora el objeto: de su cifra de ahora a la nueva.
        const gains = (Object.keys(it.bonus ?? {}) as SkillId[]).map((k) => {
          const now = skill(memberOf(h, game.fac), k);
          const then = skill(memberOf({ ...h, worn: { ...h.worn, [slot]: it } }, game.fac), k);
          return { k, now, then };
        });
        return (
          <button
            key={h.id}
            class="pick"
            aria-label={[
              t('paneles.arcon.darselo_a', { nombre: h.name }),
              t('paneles.arcon.de_nivel', { clase: CLASS_NAMES[h.cls][h.sex], nivel: h.lvl }),
              was
                ? t('paneles.arcon.cambia', { objeto: itemName(was) })
                : t('paneles.arcon.libre', { ranura: SLOT_NAMES[slot].toLowerCase() }),
              ...gains.map((g) =>
                t('paneles.arcon.sube', { hab: skillName(g.k), antes: g.now, despues: g.then }),
              ),
            ].join('. ')}
            onClick={() => onGive(h.id)}
          >
            <Portrait
              look={lookOf(h)}
              marks={marksOf(h)}
              frame={heroFrame(h)}
              scale={1}
              alive={false}
            />
            <span class="pick-name" aria-hidden="true">
              {h.name.split(' ')[0]}
            </span>
            <span class="pick-skills" aria-hidden="true">
              <span>
                {CLASS_NAMES[h.cls][h.sex]} · {h.lvl}
              </span>
              {gains.map((g) => (
                <span key={g.k} class={g.then > g.now ? 'up' : ''}>
                  {t('paneles.arcon.sube_corto', {
                    hab: skillName(g.k).slice(0, 3),
                    antes: g.now,
                    despues: g.then,
                  })}
                </span>
              ))}
              <span class="pick-gear">
                {was
                  ? t('paneles.arcon.cambia', { objeto: itemName(was) })
                  : t('paneles.arcon.libre', { ranura: SLOT_NAMES[slot].toLowerCase() })}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * El arcón del gremio: el estante de materiales, el equipo en rejilla (el del tablero de la
 * bodega y el que llevan puesto, con filtro por ranura), los tesoros para vender y los trofeos de
 * la pared de la sala.
 */
export function ArconPanel({
  game,
  tab,
  onTab,
  onEquip,
  onUnequip,
  onSell,
  onSellTrophy,
  onHero,
}: Props) {
  const stock = game.inventory.filter(isGear);
  const treasures = game.inventory.filter((i) => !isGear(i));
  const worn = game.heroes
    .filter((h) => h.status !== 'muerto')
    .flatMap((h) =>
      SLOTS.flatMap((slot) => (h.worn?.[slot] ? [{ h, slot, it: h.worn[slot]! }] : [])),
    );
  const takers = game.heroes.filter(inGuild);
  const [giving, setGiving] = useState(false);
  const [filter, setFilter] = useState<Filter>('todo');
  const [sel, setSel] = useState<string | null>(null);
  // Filtro por nivel (con el contador de cada uno); se suma al de la ranura.
  const [tier, setTier] = useState<Tier | null>(null);
  const inSlot = (it: Item) => filter === 'todo' || slotOf(it) === filter;
  const fits = (it: Item) => inSlot(it) && (tier === null || tierOf(it.rarity) === tier);
  // El arcón y lo puesto juntos, lo mejor primero; lo puesto lleva la inicial de quien lo lleva.
  const all: (GridEntry & { heroId?: string; slot?: Slot; canTake?: boolean })[] = [
    ...stock.map((it) => ({ it, key: `a:${it.id}` })),
    ...worn.map(({ h, slot, it }) => ({
      it,
      key: `p:${h.id}:${slot}`,
      who: h.name,
      heroId: h.id,
      slot,
      canTake: inGuild(h),
    })),
  ];
  const entries = all.filter((e) => fits(e.it)).sort((a, b) => itemScore(b.it) - itemScore(a.it));
  // Cuántos hay de cada nivel (en la ranura elegida), del mejor al peor.
  const tiers = new Map<Tier, { n: number; name: string }>();
  for (const e of all.filter((x) => inSlot(x.it))) {
    const t = tierOf(e.it.rarity);
    const name = RARITY_NAMES[e.it.rarity ?? 0];
    tiers.set(t, { n: (tiers.get(t)?.n ?? 0) + 1, name });
  }
  const tierList = [...tiers.entries()].sort((a, b) => b[0] - a[0]);
  const chosen = entries.find((e) => e.key === sel);

  return (
    <>
      <MatShelf game={game} />
      <Tabs
        label={t('paneles.arcon.arcon')}
        value={tab}
        onChange={onTab}
        tabs={[
          {
            id: 'equipo',
            label: t('paneles.arcon.piezas'),
            icon: 'espadas',
            count: stock.length + worn.length,
          },
          {
            id: 'tesoros',
            label: t('paneles.arcon.tesoros'),
            icon: 'cofre',
            count: treasures.length,
          },
          {
            id: 'trofeos',
            label: t('paneles.arcon.trofeos'),
            icon: 'trofeo',
            count: game.trophies.length,
            help: t('paneles.arcon.caben_en_la_pared', {
              trophy_slots: TROPHY_SLOTS,
              trophy_appeal: TROPHY_APPEAL,
            }),
          },
        ]}
      />

      {tab === 'equipo' && (
        <>
          <Tabs
            label={t('paneles.arcon.filtrar_por_ranura')}
            value={filter}
            onChange={(f) => {
              setFilter(f);
              setTier(null);
              setSel(null);
            }}
            tabs={FILTERS.map(([id, label]) => ({ id, label }))}
          />
          <div class="item-count">
            <span class="row-sub">
              {t('paneles.arcon.lo_mejor_primero', { n: entries.length, puestos: worn.length })}
            </span>
            {tierList.length > 1 && (
              <span
                class="tier-pips"
                role="group"
                aria-label={t('paneles.arcon.filtrar_por_nivel')}
              >
                {tierList.map(([t, { n, name }]) => (
                  <button
                    key={t}
                    class={`tier-pip tier-${t}`}
                    aria-pressed={tier === t}
                    aria-label={`${name}: ${n}`}
                    title={name}
                    onClick={() => {
                      setTier(tier === t ? null : t);
                      setSel(null);
                    }}
                  >
                    <i />
                    {n}
                  </button>
                ))}
              </span>
            )}
          </div>
          {!entries.length && (
            <p class="panel-note">
              {filter === 'todo'
                ? t('paneles.arcon.vacio_los_encargos_con')
                : t('paneles.arcon.nada_de_esta_ranura')}
            </p>
          )}
          <ItemGrid
            label={t('paneles.arcon.equipo')}
            entries={entries}
            selected={sel}
            onPick={(k) => {
              setSel(k);
              setGiving(false);
            }}
          />
          <p class="row-sub item-hint">{t('paneles.arcon.toca_para_elegir_manten')}</p>
          {chosen && (
            <div class="item-bar">
              {giving && !chosen.who && (
                <GivePicks
                  game={game}
                  it={chosen.it}
                  takers={takers}
                  onGive={(h) => {
                    onEquip(h, chosen.it.id);
                    setGiving(false);
                    setSel(null);
                  }}
                />
              )}
              <div class="item-bar-row">
                <span class={`act-slot tier-${tierOf(chosen.it.rarity)}`} aria-hidden="true">
                  <ItemImage
                    icon={chosen.it.icon ?? 'espada'}
                    rarity={chosen.it.rarity}
                    name={tx(chosen.it.name)}
                    scale={1}
                  />
                </span>
                <b class="item-bar-name">
                  {itemName(chosen.it)}
                  <small> · {RARITY_NAMES[chosen.it.rarity ?? 0]}</small>
                </b>
                {chosen.who ? (
                  <>
                    <button class="btn btn-wood" onClick={() => onHero(chosen.heroId!)}>
                      <Icon name="heroe" size={12} /> {chosen.who.split(' ')[0]}
                    </button>
                    {chosen.canTake && (
                      <button
                        class="btn btn-wood"
                        onClick={() => {
                          onUnequip(chosen.heroId!, chosen.slot!);
                          setSel(null);
                        }}
                      >
                        {t('paneles.arcon.quitar')}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      class={`btn ${giving ? 'btn-gold' : 'btn-wood'}`}
                      disabled={!takers.length}
                      aria-expanded={giving}
                      onClick={() => setGiving(!giving)}
                    >
                      <Icon name="heroe" size={12} /> {t('paneles.arcon.dar')}
                    </button>
                    <Sell
                      name={itemName(chosen.it)}
                      value={priceOf(chosen.it)}
                      onSell={() => {
                        onSell(chosen.it.id);
                        setSel(null);
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'tesoros' && (
        <>
          {!treasures.length && (
            <p class="panel-note">{t('paneles.arcon.vacio_joyas_reliquias_y')}</p>
          )}
          <div class="rows">
            {treasures.map((it) => (
              <article key={it.id} class="row">
                <span class="row-info" {...help(tx(it.desc))}>
                  <b>{itemName(it)}</b>
                </span>
                <Sell name={tx(it.name)} value={priceOf(it)} onSell={() => onSell(it.id)} />
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'trofeos' && (
        <>
          {!game.trophies.length && (
            <p class="panel-note">{t('paneles.arcon.un_exito_brillante_en')}</p>
          )}
          <div class="rows">
            {game.trophies.map((trophy, i) => (
              <article key={trophy.id} class="row">
                <BufferImage buf={trophyIcon(trophy.icon)} scale={2} />
                <span
                  class="row-info"
                  {...help(
                    t('paneles.arcon.lo_trajeron_de_el', {
                      desc: tx(trophy.desc),
                      quien: tx(trophy.who),
                      lugar: placeName(trophy.place),
                      dia: trophy.day,
                    }),
                  )}
                >
                  <b>{tx(trophy.name)}</b>
                  <span class="row-sub">
                    {i < TROPHY_SLOTS
                      ? t('paneles.arcon.en_la_pared_del')
                      : t('paneles.arcon.guardado_no_queda_pared')}
                  </span>
                </span>
                <Sell
                  name={tx(trophy.name)}
                  value={trophy.value}
                  onSell={() => onSellTrophy(trophy.id)}
                />
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
