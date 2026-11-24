import { tierOf } from '../art/tiers';
import { HP_GRAVE, HP_LIGHT } from '../core/balance';
import { healthOf, hpOf, workFactor } from '../core/health';
import { restHours } from '../core/infirmary';
import { restText } from '../data/labels';
import { CACHE_OWED_MORALE, REFUSE_GRUDGE, VEIL_CAP } from '../core/balance';
import { useEffect, useState } from 'preact/hooks';
import { DRESS_GOLD, GUARD_BONUS, LEVEL_MAX, MASTER_LEVEL } from '../core/balance';
import { VET_LEVEL, XP_PER_LEVEL } from '../core/balance';
import { isVet } from '../core/beds';
import { craftState, dressStatus, dressingOf } from '../core/crafting';
import { hasUnlock, unlockSource } from '../core/goals';
import { PERKS } from '../core/classes';
import { canHire, gearInStock, requestAmount } from '../core/game';
import type { GameState, Hero, Item, ItemIcon } from '../core/model';
import { SKILLS, attr, moraleBand, skill, type SkillId } from '../core/party';
import { CLASS_NAMES, MORALE_INFO, statusLabel } from '../data/labels';
import { HIDDEN_TRAIT_HINT, TRAIT_INFO, traitLabel } from '../data/traits';
import { slotIcon } from '../art/materials';
import { itemIcon } from '../art/items';
import { RARITY_NAMES, itemEffect, itemName } from '../data/items';
import { BufferImage } from './BufferImage';
import { gearHintText, upgradesFor } from './gearHint';
import { ItemImage, itemProps } from './ItemImage';
import { help } from './HoldHelp';
import { Icon } from './icons';
import { taskLabel } from './crew';
import type { Task } from './drop';
import { TaskSelect } from './panels/CrewList';
import { Tabs } from './Tabs';
import { ItemGrid } from './ItemGrid';
import { Portrait } from './Portrait';
import { heroFrame, lookOf, marksOf, memberOf } from './view';
import { GARMENTS, TINTS, TINT_IDS, type Dress, type GarmentId, type TintId } from '../data/custom';
import { SLOTS, SLOT_NAMES, gearList, shownItem, slotOf, type Slot } from '../core/gear';
import { idText, t, tx } from '../textos';

interface Props {
  game: GameState;
  hero: Hero;
  candidate: boolean;
  onClose: () => void;
  onHire: () => void;
  /** Candidato: que se vaya (deja sitio a otro). */
  onReject?: () => void;
  onFire: () => void;
  onLocate: () => void;
  onAnswer: (yes: boolean) => void;
  /** Pagar el caché que se le negó. */
  onPayOwed: () => void;
  onEquip: (itemId: string) => void;
  onUnequip: (slot: Slot) => void;
  /** Cambiar su tarea mientras está en casa (trabajar, entrenar, guardia o descansar). */
  onTask?: (task: Task) => void;
  /** Encargar ropa nueva a la sastrería (acción `dressAt`): va andando y el sastre le viste. */
  onDressAt?: (room: string, d: Dress) => void;
  /** Modo prueba: probar la ropa gratis y al momento (acción `dress`). */
  onDress?: (d: Dress) => void;
  /** La cámara le sigue mientras está abierto «Ropa y colores» (`false`: suelta). */
  onFollow?: (on: boolean) => void;
  /** Cambiarle el nombre (solo a los de casa). */
  onRename?: (name: string) => void;
}

/**
 * «Ropa y colores»: se elige tinte y prenda (el retrato enseña cómo quedaría) y se encarga a la
 * sastrería. Los tintes que no se tienen salen con candado y de dónde se ganan; abajo, si se
 * puede pagar y la sastrería está libre, o por qué no.
 */
function DressMenu({
  game,
  hero: h,
  draft,
  setDraft,
  onDressAt,
  onDress,
}: {
  game: GameState;
  hero: Hero;
  draft: Dress;
  setDraft: (d: Dress) => void;
  onDressAt?: (room: string, d: Dress) => void;
  onDress?: (d: Dress) => void;
}) {
  const [locked, setLocked] = useState<string | null>(null);
  const st = dressStatus(game, h.id, draft);
  const sewing = dressingOf(game, h.id);
  const sw = sewing ? craftState(game, sewing) : null;
  const swatch = (id: TintId | undefined, label: string, bg?: string) => {
    const why = id && !hasUnlock(game, `tint:${id}`) ? unlockSource(`tint:${id}`) : null;
    const lock = id && !hasUnlock(game, `tint:${id}`);
    const text = lock
      ? `${label}. ${why ? t('ficha.herocard.se_gana_con', { why }) : t('ficha.herocard.aun_no_lo_teneis')}`
      : label;
    return (
      <button
        key={id ?? 'nada'}
        role="radio"
        aria-checked={draft.dye === id}
        aria-disabled={!!lock}
        aria-label={text}
        title={text}
        class={`tav-swatch room-swatch ${id ? '' : 'house'} ${draft.dye === id ? 'on' : ''} ${lock ? 'locked' : ''}`}
        style={bg ? { background: bg } : undefined}
        onClick={() => {
          if (lock)
            return setLocked(
              t('ficha.herocard.bloqueado', { que: label, hay: !!why, como: why ?? '' }),
            );
          setLocked(null);
          setDraft({ ...draft, dye: id });
        }}
      >
        {lock && <Icon name="candado" size={10} />}
      </button>
    );
  };
  const noTailor =
    st.state === 'ok' && !game.workers.some((w) => w.room === st.room && w.trade === 'sastreria');
  return (
    <div class="room-tint dress-menu">
      <span class="row-sub">{t('ficha.herocard.tinte_de_la_ropa')}</span>
      <div class="tav-swatches" role="radiogroup" aria-label={t('ficha.herocard.tinte_de_la_ropa')}>
        {swatch(undefined, t('ficha.herocard.sin_tinte'))}
        {TINT_IDS.map((id) => {
          const [, d, m, l] = TINTS[id].ramp;
          return swatch(id, TINTS[id].name, `linear-gradient(${l} 0 30%, ${m} 30% 70%, ${d} 70%)`);
        })}
      </div>
      {locked && <small class="lock-why">{locked}</small>}
      <span class="row-sub">{t('ficha.herocard.prenda')}</span>
      <div class="tav-symbols" role="radiogroup" aria-label={t('ficha.herocard.prenda')}>
        {([undefined, ...(Object.keys(GARMENTS) as GarmentId[])] as const).map((g) => (
          <button
            key={g ?? 'nada'}
            role="radio"
            aria-checked={draft.garment === g}
            class={`btn ${draft.garment === g ? 'btn-gold' : 'btn-wood'}`}
            onClick={() => setDraft({ ...draft, garment: g })}
          >
            {g ? GARMENTS[g].name : t('ficha.herocard.nada')}
          </button>
        ))}
      </div>
      {sw ? (
        <p class="dress-state" role="status">
          {sw.walking
            ? t('ficha.herocard.va_de_camino_a', { nombre: h.name })
            : sw.hoursLeft === null
              ? t('ficha.herocard.espera_en_la_sastreria', { nombre: h.name })
              : t('ficha.herocard.le_estan_cosiendo_acaba', {
                  horas: Math.max(1, Math.ceil(sw.hoursLeft)),
                })}
        </p>
      ) : st.state === 'ok' ? (
        <>
          <button
            class="btn btn-gold dress-go"
            onClick={() => onDressAt?.(st.room, draft)}
            disabled={!onDressAt}
          >
            <Icon name="coin" size={12} />{' '}
            {t('ficha.herocard.encargar_a_la_sastreria', { coste: st.cost })}
          </button>
          <small class="lock-why">
            {noTailor
              ? t('ficha.herocard.no_hay_sastre_en')
              : t('ficha.herocard.ira_andando_y_el', { nombre: h.name })}
          </small>
        </>
      ) : st.state === 'same' ? (
        <small class="lock-why">{t('ficha.herocard.asi_va_ahora_elige')}</small>
      ) : (
        <>
          <button class="btn btn-wood dress-go locked" disabled>
            {st.state === 'lock' ? (
              <Icon name="candado" size={12} />
            ) : (
              <Icon name="coin" size={12} />
            )}{' '}
            {t('ficha.herocard.encargar_a_la_sastreria', { coste: DRESS_GOLD })}
          </button>
          <small class="lock-why">{st.why}</small>
        </>
      )}
      {onDress && st.state !== 'same' && (
        <button class="btn btn-wood dress-go" onClick={() => onDress(draft)}>
          {t('ficha.herocard.probar_gratis_modo_prueba')}
        </button>
      )}
    </div>
  );
}

/** La silueta de cada ranura vacía (un objeto típico, en sombra). */
const SILHOUETTE: Record<Slot, ItemIcon> = {
  arma: 'espada',
  cuerpo: 'coraza',
  complemento: 'amuleto',
};

/**
 * El muñeco del equipo: las tres ranuras (arma, cuerpo, complemento), con lo que lleva o su
 * silueta si están vacías. Tocar una abre lo que cabe en ella del arcón, con lo que cambia cada
 * habilidad («Combate 9 → 11»), y deja quitar lo que lleva.
 */
function GearDoll({
  game,
  hero: h,
  canGear,
  onEquip,
  onUnequip,
}: {
  game: GameState;
  hero: Hero;
  canGear: boolean;
  onEquip: (itemId: string) => void;
  onUnequip: (slot: Slot) => void;
}) {
  // Las ranuras con algo mejor en el arcón llevan marca; al abrir, la primera de ellas.
  const better = new Set(upgradesFor(game, h).map((u) => u.slot));
  const [sel, setSel] = useState<Slot | null>(
    SLOTS.find((x) => better.has(x)) ?? SLOTS.find((x) => !h.worn?.[x]) ?? 'arma',
  );
  const was = sel ? h.worn?.[sel] : undefined;
  const fits = sel ? gearInStock(game).filter((it) => slotOf(it) === sel) : [];
  // El elegido en la rejilla (un toque); debajo sale lo que cambia y «Ponérselo».
  const [pick, setPick] = useState<string | null>(null);
  const picked = fits.find((it) => it.id === pick);
  /** Lo que cambia cada habilidad al ponerse `it` (o quitarse lo de la ranura, sin él). */
  const deltas = (it?: Item) => {
    const keys = new Set([
      ...Object.keys(it?.bonus ?? {}),
      ...Object.keys(was?.bonus ?? {}),
    ]) as Set<SkillId>;
    const after = { ...h.worn, [sel!]: it };
    if (!it) delete after[sel!];
    return [...keys].map((k) => ({
      k,
      now: skill(memberOf(h, game.fac), k),
      then: skill(memberOf({ ...h, worn: after }, game.fac), k),
    }));
  };
  const deltaText = (d: { k: SkillId; now: number; then: number }[]) =>
    d.map((x) => (
      <span key={x.k} class={x.then > x.now ? 'up' : x.then < x.now ? 'down' : ''}>
        {x.k} {x.now} → {x.then}
      </span>
    ));
  return (
    <div class="doll">
      <div class="doll-slots" role="radiogroup" aria-label={t('ficha.herocard.equipo')}>
        {SLOTS.map((sl) => {
          const it = h.worn?.[sl];
          return (
            <button
              key={sl}
              role="radio"
              aria-checked={sel === sl}
              aria-label={t('ficha.herocard.ranura', {
                ranura: SLOT_NAMES[sl],
                lleva: !!it,
                objeto: it ? itemName(it) : '',
                mejor: better.has(sl),
              })}
              class={`doll-slot tier-${tierOf(it?.rarity)} ${it ? '' : 'is-empty'} ${sel === sl ? 'is-sel' : ''} ${better.has(sl) ? 'has-better' : ''}`}
              onClick={() => setSel(sel === sl ? null : sl)}
            >
              {it ? (
                <ItemImage {...itemProps(it, SILHOUETTE[sl])} scale={2} />
              ) : (
                // Vacía: su silueta apagada.
                <BufferImage buf={slotIcon(sl, 16)} scale={2} />
              )}
              {it?.plus ? <b class="doll-plus">+{it.plus}</b> : null}
              <small>{SLOT_NAMES[sl]}</small>
            </button>
          );
        })}
      </div>
      {sel && (
        <div class="doll-pick">
          {/* Lo que lleva → lo elegido, lo que cambia y los botones juntos (siempre aquí). */}
          <div class="swap">
            <div class="swap-row">
              <span
                class={`swap-box tier-${tierOf(was?.rarity)} ${was ? '' : 'is-empty'}`}
                aria-hidden="true"
              >
                {was ? (
                  <ItemImage {...itemProps(was, SILHOUETTE[sel])} scale={2} />
                ) : (
                  <BufferImage buf={slotIcon(sel, 16)} scale={2} />
                )}
              </span>
              {picked && (
                <>
                  <span class="swap-arrow" aria-hidden="true">
                    →
                  </span>
                  <span class={`swap-box tier-${tierOf(picked.rarity)}`} aria-hidden="true">
                    <ItemImage {...itemProps(picked)} scale={2} />
                  </span>
                </>
              )}
              <span class={`swap-info tier-${tierOf((picked ?? was)?.rarity)}`}>
                {picked ? (
                  <>
                    <b>{itemName(picked)}</b>
                    <small>
                      <em>{RARITY_NAMES[picked.rarity ?? 0]}</em>
                    </small>
                    <small class="doll-deltas">{deltaText(deltas(picked))}</small>
                  </>
                ) : was ? (
                  <>
                    <b>{itemName(was)}</b>
                    <small>
                      <em>{RARITY_NAMES[was.rarity ?? 0]}</em> · {itemEffect(was)}
                    </small>
                  </>
                ) : (
                  <small>{t('ficha.herocard.no_lleva_nada', { ranura: SLOT_NAMES[sel] })}</small>
                )}
                {canGear && !picked && fits.length > 0 && (
                  <small class="swap-hint">{t('ficha.herocard.toca_uno_del_arcon')}</small>
                )}
              </span>
            </div>
            {canGear && (was || picked) && (
              <div class="swap-btns">
                {was && (
                  <button class="btn btn-wood" onClick={() => onUnequip(sel)}>
                    {t('ficha.herocard.quitar')}
                  </button>
                )}
                {picked && (
                  <button
                    class="btn btn-gold"
                    onClick={() => {
                      onEquip(picked.id);
                      setPick(null);
                    }}
                  >
                    {was ? t('ficha.herocard.cambiar') : t('ficha.herocard.ponerselo')}
                  </button>
                )}
              </div>
            )}
          </div>
          {canGear && fits.length > 0 && (
            <ItemGrid
              label={t('ficha.herocard.del_arcon', { ranura: SLOT_NAMES[sel].toLowerCase() })}
              tut="equipar"
              entries={fits.map((it) => ({ it, key: it.id }))}
              selected={pick}
              onPick={setPick}
            />
          )}
          {canGear && !fits.length && (
            <span class="row-sub">
              {t('ficha.herocard.en_el_arcon_no', {
                ranura: SLOT_NAMES[sel].toLowerCase(),
                vacio: !game.inventory.length,
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const ATTRS = [
  ['F', t('ficha.herocard.fuerza')],
  ['D', t('ficha.herocard.destreza')],
  ['M', t('ficha.herocard.mente')],
] as const;

/** Lo que se ha desplegado debajo de los botones: la tarea o el equipo. */
type Open = 'trabajo' | 'equipo' | null;

/**
 * Ficha de un héroe, como hoja desde abajo: retrato y estado; tres botones (su tarea, el
 * equipo y verlo en la taberna); atributos y habilidades; y los rasgos en chapas que se leen
 * con un toque.
 */
export function HeroCard({
  game,
  hero: h,
  candidate,
  onClose,
  onHire,
  onReject,
  onFire,
  onLocate,
  onAnswer,
  onPayOwed,
  onEquip,
  onUnequip,
  onTask,
  onDressAt,
  onDress,
  onFollow,
  onRename,
}: Props) {
  const [open, setOpen] = useState<Open>(null);
  /** La ropa que se está mirando en «Ropa y colores» (el retrato la enseña). */
  const [draft, setDraft] = useState<Dress>(h.dress ?? {});
  /** Pestaña: la ficha de siempre o «Ropa y colores». */
  const [view, setView] = useState<'ficha' | 'ropa'>('ficha');
  const dressing = view === 'ropa';
  // La cámara le sigue mientras se mira la ropa; al cerrar (o al irse la ficha), suelta.
  useEffect(() => {
    if (!dressing) return;
    onFollow?.(true);
    return () => onFollow?.(false);
  }, [dressing]);
  /** Escribiendo un nombre nuevo. */
  const [naming, setNaming] = useState(false);
  /** Rasgo (o habilidad de clase) cuya explicación se ve. */
  const [chip, setChip] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const worn = gearList(h);
  const wornShown = shownItem(h);
  const canGear = !candidate && (h.status === 'ok' || h.status === 'herido');
  // Equipo olvidado: lo mejor del arcón para sus ranuras (marca en el botón del equipo).
  const ups = candidate ? [] : upgradesFor(game, h);
  const gearHint = ups.length ? gearHintText(h.name.split(' ')[0]!, ups) : null;
  const m = memberOf(h, game.fac);
  const why = candidate ? canHire(game, h.id) : null;
  const gone = h.status === 'muerto' || h.status === 'desaparecido';
  const maxed = h.lvl >= LEVEL_MAX;
  const title = h.lvl >= MASTER_LEVEL ? 'maestro' : isVet(h) ? 'veterano' : 'no';
  const band = moraleBand(h.morale);
  const moraleK = band === 'animado' ? 'ok' : band === 'normal' ? 'mid' : 'low';
  const perk = PERKS[h.cls];
  const home = !candidate && h.status === 'ok';
  const canTask = home && !!onTask;
  const task = taskLabel(game, h.id);
  const toggle = (o: Open) => setOpen(open === o ? null : o);
  const chips = [
    {
      id: 'perk',
      label: perk.name,
      cls: 'trait-perk',
      desc: t('ficha.herocard.habilidad_de_clase', { desc: perk.desc }),
    },
    ...h.traits.map((t) => ({
      id: t.id,
      label: traitLabel(t, h.sex),
      cls: t.hidden ? 'trait-hidden' : `trait-${TRAIT_INFO[t.id].tone}`,
      desc: t.hidden ? HIDDEN_TRAIT_HINT : TRAIT_INFO[t.id].desc,
    })),
  ];
  const shown = chips.find((c) => c.id === chip);

  return (
    <div class="card-backdrop as-sheet" onClick={onClose}>
      <article
        class="herocard herosheet"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('ficha.herocard.ficha_de', { nombre: h.name })}
      >
        <button
          class="btn-icon herocard-x"
          data-tut="cerrar"
          aria-label={t('ficha.herocard.cerrar')}
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <div class="herocard-top">
            <Portrait
              look={lookOf(dressing ? { ...h, dress: draft } : h)}
              marks={marksOf(h)}
              frame={heroFrame(h)}
              scale={2}
              label={t('ficha.herocard.retrato_de', { nombre: h.name })}
            />
            <div class="herocard-id">
              {naming ? (
                <form
                  class="rename"
                  data-tut="nombre-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = (e.currentTarget.elements.namedItem('name') as HTMLInputElement)
                      .value;
                    if (v.trim()) onRename?.(v);
                    setNaming(false);
                  }}
                >
                  <input
                    name="name"
                    maxLength={24}
                    defaultValue={h.name}
                    autoFocus
                    aria-label={t('ficha.herocard.nombre')}
                  />
                  <button class="btn btn-gold" data-tut="nombre-ok">
                    {t('ficha.herocard.vale')}
                  </button>
                </form>
              ) : onRename && !candidate ? (
                <button
                  data-tut="nombre"
                  class="linklike rename-btn"
                  aria-label={t('ficha.herocard.cambiar_el_nombre_de', { nombre: h.name })}
                  onClick={() => setNaming(true)}
                >
                  <h3>{h.name}</h3>
                </button>
              ) : (
                <h3>{h.name}</h3>
              )}
              {h.nick && <span class="nick">{tx(h.nick)}</span>}
              <span class="row-sub">
                {t('ficha.herocard.nivel', {
                  clase: CLASS_NAMES[h.cls][h.sex],
                  nivel: h.lvl,
                  titulo: candidate ? 'no' : title,
                  sexo: h.sex,
                })}{' '}
                <Icon name="coin" size={10} />
                {t('ficha.herocard.sem', { prima: candidate, fichaje: h.fee, sueldo: h.salary })}
              </span>
              {/* En casa, lo que hace ya lo dice el botón de su tarea. */}
              {(candidate || h.status !== 'ok') && (
                <span class={`pill pill-${candidate ? 'candidato' : h.status}`}>
                  {statusLabel(h, candidate, game)}
                </span>
              )}
              {!candidate && !gone && (
                <div class="meters">
                  {/* La vida que se guarda: marcas del 50 % (leve) y del 20 % (grave). */}
                  <div
                    class="meter meter-hp"
                    {...help(
                      t('ficha.herocard.vida_ayuda', {
                        estado: healthOf(h),
                        sexo: h.sex,
                        leve: Math.round(HP_LIGHT * 100),
                        grave: Math.round(HP_GRAVE * 100),
                        falta: restText(restHours(game, h)),
                        hay_falta: restHours(game, h) > 0,
                        rinde: Math.round(workFactor(h) * 100),
                      }),
                    )}
                  >
                    <span>{t('ficha.herocard.vida')}</span>
                    <span class="track">
                      <i
                        class={`hp-${healthOf(h)}`}
                        style={{ width: `${Math.round(hpOf(h) * 100)}%` }}
                      />
                      <b style={{ left: `${HP_GRAVE * 100}%` }} />
                      <b style={{ left: `${HP_LIGHT * 100}%` }} />
                    </span>
                    <small>{Math.round(hpOf(h) * 100)}</small>
                  </div>
                  <div
                    class="meter"
                    {...help(
                      t('ficha.herocard.experiencia_al_llegar_a', {
                        xp_per_level: XP_PER_LEVEL,
                        vet_level: VET_LEVEL,
                        maestro: MASTER_LEVEL,
                        max: LEVEL_MAX,
                      }),
                    )}
                  >
                    <span>{t('ficha.herocard.xp')}</span>
                    <span class="track">
                      <i
                        class="xp"
                        style={{ width: `${maxed ? 100 : (h.xp / XP_PER_LEVEL) * 100}%` }}
                      />
                    </span>
                    <small>{maxed ? t('ficha.herocard.nivel_maximo') : h.xp}</small>
                  </div>
                  <div
                    class="meter"
                    {...help(
                      t('ficha.herocard.baja_con_los_viajes', {
                        animo: MORALE_INFO[band].label[h.sex],
                        desc: MORALE_INFO[band].desc,
                      }),
                    )}
                  >
                    <span>{t('ficha.herocard.moral')}</span>
                    <span class="track">
                      <i class={moraleK} style={{ width: `${h.morale}%` }} />
                    </span>
                    <small>{h.morale}</small>
                  </div>
                </div>
              )}
            </div>
          </div>
          {!candidate && !gone && (
            <Tabs
              label={t('ficha.herocard.ficha_de', { nombre: h.name })}
              value={view}
              onChange={(v) => {
                if (v === 'ropa' && !dressing) setDraft(h.dress ?? {});
                setView(v);
              }}
              tabs={[
                { id: 'ficha', label: t('ficha.herocard.ficha'), icon: 'heroe' },
                { id: 'ropa', label: t('ficha.herocard.ropa_y_colores'), icon: 'tijeras' },
              ]}
            />
          )}
          {candidate && <p class="quote">{tx(h.quote)}</p>}
          {dressing && (
            <DressMenu
              game={game}
              hero={h}
              draft={draft}
              setDraft={setDraft}
              onDressAt={onDressAt}
              onDress={onDress}
            />
          )}
          {!dressing && (
            <>
              {h.request && !candidate && (
                <div
                  class="request"
                  role="status"
                  {...help(
                    h.request === 'cache'
                      ? t('ficha.herocard.nivel_ya_no_soy', {
                          nivel: h.cacheAt ?? h.lvl,
                          moral: CACHE_OWED_MORALE,
                        })
                      : t('ficha.herocard.con_lo_que_me', { dias: REFUSE_GRUDGE.days }),
                  )}
                >
                  <span>
                    <b>
                      {h.request === 'cache'
                        ? t('ficha.herocard.pide_su_cache_de', {
                            titulo: (h.cacheAt ?? h.lvl) >= MASTER_LEVEL ? 'maestro' : 'veterano',
                            sexo: h.sex,
                          })
                        : t('ficha.herocard.pide_un_aumento')}
                    </b>
                    {t('ficha.herocard.por_semana', { oro: requestAmount(h) })}
                  </span>
                  <div class="herocard-actions">
                    <button class="btn btn-gold" onClick={() => onAnswer(true)}>
                      <Icon name="coin" size={12} />{' '}
                      {t('ficha.herocard.sem_2', { sueldo: h.salary + requestAmount(h) })}
                    </button>
                    <button class="btn btn-wood" onClick={() => onAnswer(false)}>
                      {t('ficha.herocard.no')}
                    </button>
                  </div>
                </div>
              )}

              {!candidate && !gone && !!h.owed && (
                <div
                  class="request"
                  role="status"
                  {...help(t('ficha.herocard.debe_cache_ayuda', { oro: h.owed }))}
                >
                  <span class="room-bad">
                    <b>{t('ficha.herocard.debe_cache', { moral: CACHE_OWED_MORALE })}</b>
                  </span>
                  <div class="herocard-actions">
                    <button class="btn btn-gold" onClick={onPayOwed}>
                      <Icon name="coin" size={12} />{' '}
                      {t('ficha.herocard.pagar_cache', { sueldo: h.salary + h.owed })}
                    </button>
                  </div>
                </div>
              )}
              {!candidate && !gone && h.grudge && h.grudge.until > game.day && (
                <p class="row-sub room-bad" {...help(t('ficha.herocard.le_negaste_lo_que'))}>
                  {t('ficha.herocard.resentido', {
                    sexo: h.sex,
                    tope: h.grudge.cap,
                    dias: h.grudge.until - game.day,
                  })}
                </p>
              )}
              {!candidate && !gone && h.veil && h.veil > game.day && (
                <p class="row-sub room-bad" {...help(t('ficha.herocard.volvio_de_entre_los'))}>
                  {t('ficha.herocard.vuelto_del_velo_moral', {
                    veil_cap: VEIL_CAP,
                    dias: h.veil - game.day,
                  })}
                </p>
              )}
              {!candidate && !gone && h.vetSnub && (
                <p class="row-sub room-bad">{t('ficha.herocard.quiere_dormir_en_el')}</p>
              )}
              {!candidate && !gone && (
                <div class="acts">
                  {canTask && (
                    <button
                      class={`act ${task !== t('ficha.crew.descansa') ? 'on' : ''}`}
                      aria-expanded={open === 'trabajo'}
                      aria-label={t('ficha.herocard.tarea', { tarea: task })}
                      {...help(
                        t('ficha.herocard.mientras_esta_en_casa', {
                          guard_bonus: GUARD_BONUS,
                        }),
                      )}
                      onClick={() => toggle('trabajo')}
                    >
                      <Icon name={h.guard ? 'escudo' : 'martillo'} size={18} />
                      <span class="act-label">{task}</span>
                    </button>
                  )}
                  {!candidate && (
                    <button
                      data-tut="equipo"
                      class={`act ${wornShown ? 'on' : ''}`}
                      aria-expanded={open === 'equipo'}
                      aria-label={t('ficha.herocard.equipo_de', {
                        n: worn.length,
                        de: SLOTS.length,
                        objetos: worn.map(itemName),
                        hay_pista: !!gearHint,
                        pista: gearHint ?? '',
                      })}
                      {...(gearHint ? help(gearHint) : {})}
                      onClick={() => toggle('equipo')}
                    >
                      {gearHint && (
                        <span class="gear-mark act-mark" aria-hidden="true">
                          <Icon name="cofre" size={10} />
                        </span>
                      )}
                      <span class="act-slots" aria-hidden="true">
                        {SLOTS.map((sl) => {
                          const it = h.worn?.[sl];
                          return (
                            <span
                              key={sl}
                              class={`act-slot ${it ? `tier-${tierOf(it.rarity)}` : 'is-empty'} ${ups.some((u) => u.slot === sl) ? 'has-better' : ''}`}
                            >
                              <BufferImage
                                buf={
                                  it
                                    ? itemIcon(
                                        it.icon ?? SILHOUETTE[sl],
                                        it.rarity,
                                        it.plus,
                                        idText(it.name),
                                      )
                                    : slotIcon(sl, 16)
                                }
                                scale={1}
                              />
                            </span>
                          );
                        })}
                      </span>
                      {t('ficha.herocard.equipo')}
                    </button>
                  )}
                  <button
                    class="act"
                    onClick={onLocate}
                    {...help(t('ficha.herocard.ver_donde_esta_en'))}
                  >
                    <Icon name="home" size={18} />
                    {t('ficha.herocard.ver')}
                  </button>
                </div>
              )}
              {open === 'trabajo' && canTask && (
                <TaskSelect game={game} who={h.id} name={h.name} onTask={(_, t) => onTask!(t)} />
              )}
              {open === 'equipo' && (
                <GearDoll
                  game={game}
                  hero={h}
                  canGear={canGear}
                  onEquip={onEquip}
                  onUnequip={onUnequip}
                />
              )}

              <div class="attrs">
                {ATTRS.map(([k, label]) => (
                  <div key={k} class="attr">
                    <b>{attr(m, k)}</b>
                    <small>{label}</small>
                  </div>
                ))}
              </div>
              <div class="skills">
                {SKILLS.map((s) => (
                  <span key={s} class="skill">
                    <span>{s}</span>
                    <b>{skill(m, s)}</b>
                  </span>
                ))}
              </div>
              <div class="chips">
                {chips.map((c) => (
                  <button
                    key={c.id}
                    class={`trait ${c.cls}`}
                    aria-pressed={chip === c.id}
                    onClick={() => setChip(chip === c.id ? null : c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {shown && (
                <p class="chip-desc" role="status">
                  <b>{shown.label}.</b> {shown.desc}
                </p>
              )}
              {history && h.history.length > 0 && (
                <ul class="hist">
                  {h.history.map((x, i) => (
                    <li key={i}>{tx(x)}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        {dressing ? null : confirm ? (
          <div class="confirm">
            <span>{t('ficha.herocard.despedir_a_se_va', { nombre: h.name })}</span>
            <div class="herocard-actions">
              <button class="btn btn-red" onClick={onFire}>
                {t('ficha.herocard.si_despedir')}
              </button>
              <button class="btn btn-wood" onClick={() => setConfirm(false)}>
                {t('ficha.herocard.no')}
              </button>
            </div>
          </div>
        ) : (
          <div class="herocard-actions">
            {candidate && (
              <button class="btn btn-gold" disabled={!!why} onClick={onHire}>
                <Icon name="coin" size={14} /> {t('ficha.herocard.contratar', { paga: h.fee })}
              </button>
            )}
            {candidate && onReject && (
              <button
                class="btn btn-wood"
                {...help(t('ficha.herocard.rechazar_ayuda'))}
                onClick={onReject}
              >
                {t('ficha.herocard.rechazar')}
              </button>
            )}
            {candidate && (
              <button class="btn btn-wood" onClick={onLocate}>
                <Icon name="home" size={14} /> {t('ficha.herocard.ver')}
              </button>
            )}
            {!candidate && h.history.length > 0 && (
              <button
                class="btn btn-wood"
                aria-expanded={history}
                onClick={() => setHistory(!history)}
              >
                <Icon name="historia" size={14} /> {t('ficha.herocard.historia')}
              </button>
            )}
            {home && (
              <button class="btn btn-wood" onClick={() => setConfirm(true)}>
                <Icon name="papelera" size={14} /> {t('ficha.herocard.despedir')}
              </button>
            )}
          </div>
        )}
        {why && <p class="qs-warn">{why}</p>}
      </article>
    </div>
  );
}
