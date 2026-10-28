import { useState } from 'preact/hooks';
import { GUARD_BONUS, VET_LEVEL, XP_PER_LEVEL } from '../core/balance';
import { PERKS } from '../core/classes';
import { canHire, gearInStock, guardsFull, requestAmount } from '../core/game';
import type { GameState, Hero } from '../core/model';
import { SKILLS, attr, moraleBand, skill } from '../core/party';
import { CLASS_NAMES, MORALE_INFO, statusLabel } from '../data/labels';
import { HIDDEN_TRAIT_HINT, TRAIT_INFO, traitLabel } from '../data/traits';
import { itemIcon } from '../art/items';
import { RARITY_NAMES, itemEffect } from '../data/items';
import { ROOMS } from '../data/rooms';
import { BufferImage } from './BufferImage';
import { help } from './HoldHelp';
import { Icon } from './icons';
import { JobPicker, jobRooms } from './JobPicker';
import { Portrait } from './Portrait';
import { lookOf, marksOf, memberOf } from './view';

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
  onUnequip: () => void;
  onGuard: (on: boolean) => void;
  /** Echar una mano en una sala mientras está en casa (null: deja de trabajar). */
  onJob?: (room: string | null) => void;
}

const ATTRS = [
  ['F', 'Fuerza'],
  ['D', 'Destreza'],
  ['M', 'Mente'],
] as const;

/** Lo que se ha desplegado debajo de los botones: el trabajo o el equipo. */
type Open = 'trabajo' | 'equipo' | null;

/**
 * Ficha de un héroe, como hoja desde abajo: retrato y estado; cuatro botones (guardia, trabajo,
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
  onGuard,
  onJob,
}: Props) {
  const [open, setOpen] = useState<Open>(null);
  /** Rasgo (o habilidad de clase) cuya explicación se ve. */
  const [chip, setChip] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const stock = gearInStock(game);
  const canGear = !candidate && (h.status === 'ok' || h.status === 'herido');
  const m = memberOf(h, game.fac);
  const why = candidate ? canHire(game, h.id) : null;
  const gone = h.status === 'muerto' || h.status === 'desaparecido';
  const band = moraleBand(h.morale);
  const moraleK = band === 'animado' ? 'ok' : band === 'normal' ? 'mid' : 'low';
  const perk = PERKS[h.cls];
  const home = !candidate && h.status === 'ok';
  const canJob = home && !h.guard && !!onJob;
  const job = canJob && h.job ? jobRooms(game).find((j) => j.room.id === h.job) : undefined;
  const toggle = (o: Open) => setOpen(open === o ? null : o);
  const guardFull = !h.guard && guardsFull(game);
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
        <button class="btn-icon herocard-x" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <div class="herocard-top">
            <Portrait
              look={lookOf(h)}
              marks={marksOf(h)}
              scale={2}
              label={`Retrato de ${h.name}`}
            />
            <div class="herocard-id">
              <h3>{h.name}</h3>
              {h.nick && <span class="nick">{h.nick}</span>}
              <span class="row-sub">
                {CLASS_NAMES[h.cls][h.sex]} · nivel {h.lvl} · <Icon name="coin" size={10} />
                {candidate ? `${h.fee} + ` : ''}
                {h.salary}/sem
              </span>
              <span class={`pill pill-${candidate ? 'candidato' : h.status}`}>
                {statusLabel(h, candidate)}
              </span>
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
          {candidate && <p class="quote">{h.quote}</p>}
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
                <b>{h.request === 'cache' ? 'Pide su caché de veterano' : 'Pide un aumento'}</b>: +
                {requestAmount(h)} por semana.
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
              {home && (
                <button
                  class={`act ${h.guard ? 'on' : ''}`}
                  aria-pressed={!!h.guard}
                  disabled={guardFull}
                  {...help(
                    h.guard
                      ? `De guardia: no sale de misión, pega +${GUARD_BONUS} y aguanta más si asaltan la taberna; da la alarma. Toca para quitarla.`
                      : guardFull
                        ? 'Ya hay dos de guardia en la puerta.'
                        : 'Guardia: si asaltan la taberna, los de guardia salen al patio y dan la alarma. Caben dos.',
                  )}
                  onClick={() => onGuard(!h.guard)}
                >
                  <Icon name="escudo" size={18} />
                  Guardia
                </button>
              )}
              {canJob && (
                <button
                  class={`act ${job ? 'on' : ''}`}
                  aria-expanded={open === 'trabajo'}
                  {...help(
                    'Mientras está en casa puede echar una mano en una sala (rinde menos que un trabajador) o entrenar. También puedes llevarlo con el dedo a la sala.',
                  )}
                  onClick={() => toggle('trabajo')}
                >
                  <Icon name="martillo" size={18} />
                  <span class="act-label">{job ? ROOMS[job.room.type].name : 'Trabajo'}</span>
                </button>
              )}
              {!candidate && (
                <button
                  class={`act ${h.item ? 'on' : ''}`}
                  aria-expanded={open === 'equipo'}
                  aria-label={h.item ? `Equipo: ${h.item.name}` : 'Equipo'}
                  onClick={() => toggle('equipo')}
                >
                  {h.item ? (
                    <BufferImage buf={itemIcon(h.item.icon ?? 'espada', h.item.rarity)} scale={1} />
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
          {open === 'trabajo' && canJob && (
            <JobPicker game={game} who={h.id} current={h.job} idle="No trabaja" onAssign={onJob!} />
          )}
          {open === 'equipo' && (
            <div class="gear-slot">
              {h.item ? (
                <div class={`gear-item rarity-${h.item.rarity ?? 0}`}>
                  <BufferImage buf={itemIcon(h.item.icon ?? 'espada', h.item.rarity)} scale={2} />
                  <span>
                    <b>{h.item.name}</b>
                    <small>
                      <em>{RARITY_NAMES[h.item.rarity ?? 0]}</em> · {itemEffect(h.item)}
                    </small>
                  </span>
                  {canGear && (
                    <button class="btn btn-wood" onClick={onUnequip}>
                      Quitar
                    </button>
                  )}
                </div>
              ) : (
                <span class="row-sub">
                  {stock.length
                    ? 'Sin equipo. Elige uno del tablero de la bodega:'
                    : 'Sin equipo. Los encargos con «+ objeto» pueden traerlo.'}
                </span>
              )}
              {canGear &&
                stock.map((it) => (
                  <button
                    key={it.id}
                    class={`gear-item gear-pick rarity-${it.rarity ?? 0}`}
                    onClick={() => {
                      setOpen(null);
                      onEquip(it.id);
                    }}
                  >
                    <BufferImage buf={itemIcon(it.icon ?? 'espada', it.rarity)} scale={2} />
                    <span>
                      <b>{it.name}</b>
                      <small>
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
        </div>
        {confirm ? (
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
