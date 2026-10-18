import { useState } from 'preact/hooks';
import { GUARD_BONUS, VET_LEVEL, XP_PER_LEVEL } from '../core/balance';
import { PERKS } from '../core/classes';
import { canHire, gearInStock, requestAmount } from '../core/game';
import type { GameState, Hero } from '../core/model';
import { SKILLS, attr, moraleBand, skill } from '../core/party';
import { CLASS_NAMES, MORALE_INFO, statusLabel } from '../data/labels';
import { HIDDEN_TRAIT_HINT, TRAIT_INFO, traitLabel } from '../data/traits';
import { itemIcon } from '../art/items';
import { RARITY_NAMES, itemEffect } from '../data/items';
import { BufferImage } from './BufferImage';
import { Icon } from './icons';
import { JobPicker } from './JobPicker';
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

/** Ficha completa de un héroe con su retrato. */
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
  const [picking, setPicking] = useState(false);
  const stock = gearInStock(game);
  const canGear = !candidate && (h.status === 'ok' || h.status === 'herido');
  const [confirm, setConfirm] = useState(false);
  const m = memberOf(h, game.fac);
  const why = candidate ? canHire(game, h.id) : null;
  const gone = h.status === 'muerto' || h.status === 'desaparecido';
  const band = moraleBand(h.morale);
  const moraleK = band === 'animado' ? 'ok' : band === 'normal' ? 'mid' : 'low';
  const perk = PERKS[h.cls];
  return (
    <div class="card-backdrop" onClick={onClose}>
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
              scale={3}
              label={`Retrato de ${h.name}`}
            />
            <div class="herocard-id">
              <h3>{h.name}</h3>
              {h.nick && <span class="nick">{h.nick}</span>}
              <span class="muted">
                {CLASS_NAMES[h.cls][h.sex]} · nivel {h.lvl}
              </span>
              <span class={`pill pill-${candidate ? 'candidato' : h.status}`}>
                {statusLabel(h, candidate)}
              </span>
              <span class="tiny">
                {candidate ? `Fichaje ${h.fee} · ` : ''}
                Salario {h.salary}/semana
              </span>
            </div>
          </div>
          {candidate && <p class="quote">{h.quote}</p>}
          {!candidate && !gone && (
            <div class="meters">
              <div
                class="meter"
                data-help={`Al llegar a ${XP_PER_LEVEL} sube de nivel: rinde más y cobra más. Desde el nivel ${VET_LEVEL} es veterano.`}
              >
                <span>Experiencia</span>
                <span class="track">
                  <i class="xp" style={{ width: `${(h.xp / XP_PER_LEVEL) * 100}%` }} />
                </span>
                <small>
                  {h.xp}/{XP_PER_LEVEL}
                </small>
              </div>
              <div
                class="meter"
                data-help="Las ganas de trabajar. Baja con los viajes y los fracasos; sube descansando en la taberna."
              >
                <span>Moral</span>
                <span class="track">
                  <i class={moraleK} style={{ width: `${h.morale}%` }} />
                </span>
                <small>{h.morale}</small>
              </div>
              <p class={`morale-note morale-${band}`}>
                <b>{MORALE_INFO[band].label[h.sex]}</b> {MORALE_INFO[band].desc}
              </p>
            </div>
          )}
          {h.request && !candidate && (
            <div class="request" role="status">
              <span>
                {h.request === 'cache'
                  ? `«Nivel ${h.lvl}. Ya no soy un cualquiera, y mi precio tampoco.» ${h.name} pide su caché de veterano: ${requestAmount(h)} monedas más por semana. Si se lo niegas, se lo tomará muy mal.`
                  : `«Con lo que me pagas no me llega ni para la cerveza.» ${h.name} pide ${requestAmount(h)} monedas más por semana.`}
              </span>
              <div class="herocard-actions">
                <button class="btn btn-gold" onClick={() => onAnswer(true)}>
                  Subir a {h.salary + requestAmount(h)}
                </button>
                <button class="btn btn-wood" onClick={() => onAnswer(false)}>
                  Negarse
                </button>
              </div>
            </div>
          )}
          {!candidate && (
            <div class="gear-slot">
              <small>Equipo</small>
              {h.item ? (
                <div class={`gear-item rarity-${h.item.rarity ?? 0}`}>
                  <BufferImage buf={itemIcon(h.item.icon ?? 'espada', h.item.rarity)} scale={3} />
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
                <span class="muted">
                  {stock.length
                    ? 'Sin equipo. En el tablero de la bodega hay equipo libre.'
                    : 'Sin equipo. Los encargos con «+ objeto» pueden traerlo.'}
                </span>
              )}
              {canGear && stock.length > 0 && (
                <button class="btn btn-wood gear-toggle" onClick={() => setPicking(!picking)}>
                  {picking ? 'Cerrar' : h.item ? 'Cambiar' : 'Equipar'} · {stock.length}{' '}
                  {stock.length === 1 ? 'disponible' : 'disponibles'}
                </button>
              )}
              {picking &&
                stock.map((it) => (
                  <button
                    key={it.id}
                    class={`gear-item gear-pick rarity-${it.rarity ?? 0}`}
                    onClick={() => {
                      setPicking(false);
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
          {!candidate && h.status === 'ok' && (
            <div class={`guard-box ${h.guard ? 'on' : ''}`}>
              <span>
                {h.guard
                  ? `De guardia: no sale de misión y suma +${GUARD_BONUS} si asaltan la taberna.`
                  : 'Si asaltan la taberna, defienden quienes estén en casa. De guardia, defienden mejor.'}
              </span>
              <button class="btn btn-wood" onClick={() => onGuard(!h.guard)}>
                {h.guard ? 'Quitar la guardia' : 'Dejar de guardia'}
              </button>
            </div>
          )}
          {!candidate && h.status === 'ok' && !h.guard && onJob && (
            <div class="guard-box">
              <span>
                Mientras está en casa puede echar una mano en una sala (rinde menos que un
                trabajador) o entrenar. También puedes cogerlo en la escena y soltarlo en la sala.
              </span>
              <JobPicker
                game={game}
                who={h.id}
                current={h.job}
                idle="No trabaja"
                onAssign={onJob}
              />
            </div>
          )}
          <div class="perk">
            <small>Habilidad de clase</small>
            <b>{perk.name}</b>
            <span>{perk.desc}</span>
          </div>
          <div class="attrs">
            {ATTRS.map(([k, label]) => (
              <div key={k} class="attr">
                <small>{label}</small>
                <b>{attr(m, k)}</b>
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
          <div class="trait-list">
            {h.traits.map((t) => (
              <div key={t.id} class="trait-line">
                <span
                  class={`trait ${t.hidden ? 'trait-hidden' : `trait-${TRAIT_INFO[t.id].tone}`}`}
                >
                  {traitLabel(t, h.sex)}
                </span>
                <span>{t.hidden ? HIDDEN_TRAIT_HINT : TRAIT_INFO[t.id].desc}</span>
              </div>
            ))}
          </div>
          {!candidate && h.history.length > 0 && (
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
                Cancelar
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
            {!gone && (
              <button class="btn btn-wood" onClick={onLocate}>
                Ver en la taberna
              </button>
            )}
            {!candidate && h.status === 'ok' && (
              <button class="btn btn-wood" onClick={() => setConfirm(true)}>
                Despedir
              </button>
            )}
          </div>
        )}
        {why && <p class="qs-warn">{why}</p>}
      </article>
    </div>
  );
}
