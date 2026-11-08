import { useEffect, useState } from 'preact/hooks';
import { DRESS_GOLD, GUARD_BONUS, VET_LEVEL, XP_PER_LEVEL } from '../core/balance';
import { craftState, dressStatus, dressingOf } from '../core/crafting';
import { hasUnlock, unlockSource } from '../core/goals';
import { PERKS } from '../core/classes';
import { canHire, gearInStock, requestAmount } from '../core/game';
import type { GameState, Hero } from '../core/model';
import { SKILLS, attr, moraleBand, skill } from '../core/party';
import { CLASS_NAMES, MORALE_INFO, statusLabel } from '../data/labels';
import { HIDDEN_TRAIT_HINT, TRAIT_INFO, traitLabel } from '../data/traits';
import { itemIcon } from '../art/items';
import { RARITY_NAMES, itemEffect } from '../data/items';
import { BufferImage } from './BufferImage';
import { help } from './HoldHelp';
import { Icon } from './icons';
import { taskLabel } from './crew';
import type { Task } from './drop';
import { TaskSelect } from './panels/CrewList';
import { Tabs } from './Tabs';
import { Portrait } from './Portrait';
import { heroFrame, lookOf, marksOf, memberOf } from './view';
import { GARMENTS, TINTS, TINT_IDS, type Dress, type GarmentId, type TintId } from '../data/custom';
import { SLOTS, SLOT_NAMES, gearList, shownItem, slotOf, type Slot } from '../core/gear';

interface Props {
  game: GameState;
  hero: Hero;
  candidate: boolean;
  onClose: () => void;
  onHire: () => void;
  onFire: () => void;
  onLocate: () => void;
  onAnswer: (yes: boolean) => void;
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
    const text = lock ? `${label}. ${why ? `Se gana con: ${why}` : 'Aún no lo tenéis'}` : label;
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
            return setLocked(`${label}: ${why ? `se gana con ${why}` : 'aún no lo tenéis'}.`);
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
      <span class="row-sub">Tinte de la ropa</span>
      <div class="tav-swatches" role="radiogroup" aria-label="Tinte de la ropa">
        {swatch(undefined, 'Sin tinte')}
        {TINT_IDS.map((id) => {
          const [, d, m, l] = TINTS[id].ramp;
          return swatch(id, TINTS[id].name, `linear-gradient(${l} 0 30%, ${m} 30% 70%, ${d} 70%)`);
        })}
      </div>
      {locked && <small class="lock-why">{locked}</small>}
      <span class="row-sub">Prenda</span>
      <div class="tav-symbols" role="radiogroup" aria-label="Prenda">
        {([undefined, ...(Object.keys(GARMENTS) as GarmentId[])] as const).map((g) => (
          <button
            key={g ?? 'nada'}
            role="radio"
            aria-checked={draft.garment === g}
            class={`btn ${draft.garment === g ? 'btn-gold' : 'btn-wood'}`}
            onClick={() => setDraft({ ...draft, garment: g })}
          >
            {g ? GARMENTS[g].name : 'Nada'}
          </button>
        ))}
      </div>
      {sw ? (
        <p class="dress-state" role="status">
          {sw.walking
            ? `${h.name} va de camino a la sastrería.`
            : sw.hoursLeft === null
              ? `${h.name} espera en la sastrería: no hay quien cosa.`
              : `Le están cosiendo: acaba en ${Math.max(1, Math.ceil(sw.hoursLeft))} h.`}
        </p>
      ) : st.state === 'ok' ? (
        <>
          <button
            class="btn btn-gold dress-go"
            onClick={() => onDressAt?.(st.room, draft)}
            disabled={!onDressAt}
          >
            <Icon name="coin" size={12} /> Encargar a la sastrería · {st.cost}
          </button>
          <small class="lock-why">
            {noTailor
              ? 'No hay sastre en la sastrería: no avanzará hasta que pongas a alguien.'
              : `${h.name} irá andando y el sastre le vestirá.`}
          </small>
        </>
      ) : st.state === 'same' ? (
        <small class="lock-why">Así va ahora. Elige otro tinte o prenda.</small>
      ) : (
        <>
          <button class="btn btn-wood dress-go locked" disabled>
            {st.state === 'lock' ? (
              <Icon name="candado" size={12} />
            ) : (
              <Icon name="coin" size={12} />
            )}{' '}
            Encargar a la sastrería · {DRESS_GOLD}
          </button>
          <small class="lock-why">{st.why}</small>
        </>
      )}
      {onDress && st.state !== 'same' && (
        <button class="btn btn-wood dress-go" onClick={() => onDress(draft)}>
          Probar gratis (modo prueba)
        </button>
      )}
    </div>
  );
}

const ATTRS = [
  ['F', 'Fuerza'],
  ['D', 'Destreza'],
  ['M', 'Mente'],
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
  onFire,
  onLocate,
  onAnswer,
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
  const stock = gearInStock(game);
  const worn = gearList(h);
  const wornShown = shownItem(h);
  const canGear = !candidate && (h.status === 'ok' || h.status === 'herido');
  const m = memberOf(h, game.fac);
  const why = candidate ? canHire(game, h.id) : null;
  const gone = h.status === 'muerto' || h.status === 'desaparecido';
  const band = moraleBand(h.morale);
  const moraleK = band === 'animado' ? 'ok' : band === 'normal' ? 'mid' : 'low';
  const perk = PERKS[h.cls];
  const home = !candidate && h.status === 'ok';
  const canTask = home && !!onTask;
  const task = taskLabel(game, h.id);
  const toggle = (o: Open) => setOpen(open === o ? null : o);
  const chips = [
    { id: 'perk', label: perk.name, cls: 'trait-perk', desc: `Habilidad de clase. ${perk.desc}` },
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
        aria-label={`Ficha de ${h.name}`}
      >
        <button class="btn-icon herocard-x" data-tut="cerrar" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <div class="herocard-top">
            <Portrait
              look={lookOf(dressing ? { ...h, dress: draft } : h)}
              marks={marksOf(h)}
              frame={heroFrame(h)}
              scale={2}
              label={`Retrato de ${h.name}`}
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
                    aria-label="Nombre"
                  />
                  <button class="btn btn-gold" data-tut="nombre-ok">
                    Vale
                  </button>
                </form>
              ) : onRename && !candidate ? (
                <button
                  data-tut="nombre"
                  class="linklike rename-btn"
                  aria-label={`Cambiar el nombre de ${h.name}`}
                  onClick={() => setNaming(true)}
                >
                  <h3>{h.name}</h3>
                </button>
              ) : (
                <h3>{h.name}</h3>
              )}
              {h.nick && <span class="nick">{h.nick}</span>}
              <span class="row-sub">
                {CLASS_NAMES[h.cls][h.sex]} · nivel {h.lvl} · <Icon name="coin" size={10} />
                {candidate ? `${h.fee} + ` : ''}
                {h.salary}/sem
              </span>
              {/* En casa, lo que hace ya lo dice el botón de su tarea. */}
              {(candidate || h.status !== 'ok') && (
                <span class={`pill pill-${candidate ? 'candidato' : h.status}`}>
                  {statusLabel(h, candidate)}
                </span>
              )}
              {!candidate && !gone && (
                <div class="meters">
                  <div
                    class="meter"
                    {...help(
                      `Experiencia: al llegar a ${XP_PER_LEVEL} sube de nivel, rinde más y cobra más. Desde el nivel ${VET_LEVEL} es veterano.`,
                    )}
                  >
                    <span>XP</span>
                    <span class="track">
                      <i class="xp" style={{ width: `${(h.xp / XP_PER_LEVEL) * 100}%` }} />
                    </span>
                    <small>{h.xp}</small>
                  </div>
                  <div
                    class="meter"
                    {...help(
                      `${MORALE_INFO[band].label[h.sex]} ${MORALE_INFO[band].desc} Baja con los viajes y los fracasos; sube descansando.`,
                    )}
                  >
                    <span>Moral</span>
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
              label={`Ficha de ${h.name}`}
              value={view}
              onChange={(v) => {
                if (v === 'ropa' && !dressing) setDraft(h.dress ?? {});
                setView(v);
              }}
              tabs={[
                { id: 'ficha', label: 'Ficha', icon: 'heroe' },
                { id: 'ropa', label: 'Ropa y colores', icon: 'tijeras' },
              ]}
            />
          )}
          {candidate && <p class="quote">{h.quote}</p>}
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
                      ? `«Nivel ${h.lvl}. Ya no soy un cualquiera, y mi precio tampoco.» Si se lo niegas, se lo tomará muy mal.`
                      : '«Con lo que me pagas no me llega ni para la cerveza.»',
                  )}
                >
                  <span>
                    <b>{h.request === 'cache' ? 'Pide su caché de veterano' : 'Pide un aumento'}</b>
                    : +{requestAmount(h)} por semana.
                  </span>
                  <div class="herocard-actions">
                    <button class="btn btn-gold" onClick={() => onAnswer(true)}>
                      <Icon name="coin" size={12} /> {h.salary + requestAmount(h)}/sem
                    </button>
                    <button class="btn btn-wood" onClick={() => onAnswer(false)}>
                      No
                    </button>
                  </div>
                </div>
              )}

              {!candidate && !gone && (
                <div class="acts">
                  {canTask && (
                    <button
                      class={`act ${task !== 'Descansa' ? 'on' : ''}`}
                      aria-expanded={open === 'trabajo'}
                      aria-label={`Tarea: ${task}`}
                      {...help(
                        `Mientras está en casa puede descansar (recupera la moral), echar una mano en una sala (rinde menos que un trabajador), entrenar o hacer guardia (no sale de misión, pega +${GUARD_BONUS} si asaltan y da la alarma; caben dos). También puedes llevarlo con el dedo a la sala.`,
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
                      aria-label={
                        worn.length ? `Equipo: ${worn.map((i) => i.name).join(', ')}` : 'Equipo'
                      }
                      onClick={() => toggle('equipo')}
                    >
                      {wornShown ? (
                        <BufferImage
                          buf={itemIcon(wornShown.icon ?? 'espada', wornShown.rarity)}
                          scale={1}
                        />
                      ) : (
                        <Icon name="cofre" size={18} />
                      )}
                      Equipo
                    </button>
                  )}
                  <button class="act" onClick={onLocate} {...help('Ver dónde está en la taberna.')}>
                    <Icon name="home" size={18} />
                    Ver
                  </button>
                </div>
              )}
              {open === 'trabajo' && canTask && (
                <TaskSelect game={game} who={h.id} name={h.name} onTask={(_, t) => onTask!(t)} />
              )}
              {open === 'equipo' && (
                <div class="gear-slot">
                  {SLOTS.map((slot) => {
                    const it = h.worn?.[slot];
                    return it ? (
                      <div key={slot} class={`gear-item rarity-${it.rarity ?? 0}`}>
                        <BufferImage buf={itemIcon(it.icon ?? 'espada', it.rarity)} scale={2} />
                        <span>
                          <b>{it.name}</b>
                          <small>
                            {SLOT_NAMES[slot]} · <em>{RARITY_NAMES[it.rarity ?? 0]}</em> ·{' '}
                            {itemEffect(it)}
                          </small>
                        </span>
                        {canGear && (
                          <button class="btn btn-wood" onClick={() => onUnequip(slot)}>
                            Quitar
                          </button>
                        )}
                      </div>
                    ) : (
                      <span key={slot} class="row-sub">
                        {SLOT_NAMES[slot]}: nada.
                      </span>
                    );
                  })}
                  {!worn.length && (
                    <span class="row-sub">
                      {stock.length
                        ? 'Elige del tablero de la bodega:'
                        : 'Los encargos con «+ objeto» pueden traer equipo.'}
                    </span>
                  )}
                  {canGear &&
                    stock.map((it) => (
                      <button
                        key={it.id}
                        class={`gear-item gear-pick rarity-${it.rarity ?? 0}`}
                        data-tut="equipar"
                        onClick={() => {
                          setOpen(null);
                          onEquip(it.id);
                        }}
                      >
                        <BufferImage buf={itemIcon(it.icon ?? 'espada', it.rarity)} scale={2} />
                        <span>
                          <b>{it.name}</b>
                          <small>
                            {SLOT_NAMES[slotOf(it) ?? 'arma']} ·{' '}
                            <em>{RARITY_NAMES[it.rarity ?? 0]}</em> · {itemEffect(it)}
                          </small>
                        </span>
                      </button>
                    ))}
                </div>
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
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        {dressing ? null : confirm ? (
          <div class="confirm">
            <span>¿Despedir a {h.name}? Se va hoy y no vuelve.</span>
            <div class="herocard-actions">
              <button class="btn btn-red" onClick={onFire}>
                Sí, despedir
              </button>
              <button class="btn btn-wood" onClick={() => setConfirm(false)}>
                No
              </button>
            </div>
          </div>
        ) : (
          <div class="herocard-actions">
            {candidate && (
              <button class="btn btn-gold" disabled={!!why} onClick={onHire}>
                <Icon name="coin" size={14} /> Contratar · {h.fee}
              </button>
            )}
            {candidate && (
              <button class="btn btn-wood" onClick={onLocate}>
                <Icon name="home" size={14} /> Ver
              </button>
            )}
            {!candidate && h.history.length > 0 && (
              <button
                class="btn btn-wood"
                aria-expanded={history}
                onClick={() => setHistory(!history)}
              >
                <Icon name="historia" size={14} /> Historia
              </button>
            )}
            {home && (
              <button class="btn btn-wood" onClick={() => setConfirm(true)}>
                <Icon name="papelera" size={14} /> Despedir
              </button>
            )}
          </div>
        )}
        {why && <p class="qs-warn">{why}</p>}
      </article>
    </div>
  );
}
