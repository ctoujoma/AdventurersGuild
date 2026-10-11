import { useState } from 'preact/hooks';
import { RAISE_AMOUNT, XP_PER_LEVEL } from '../core/balance';
import { PERKS } from '../core/classes';
import { canHire } from '../core/game';
import type { GameState, Hero } from '../core/model';
import { SKILLS, attr, moraleBand, skill } from '../core/party';
import { CLASS_NAMES, MORALE_INFO, statusLabel } from '../data/labels';
import { HIDDEN_TRAIT_HINT, TRAIT_INFO, traitLabel } from '../data/traits';
import { Icon } from './icons';
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
}: Props) {
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
              <div class="meter">
                <span>Experiencia</span>
                <span class="track">
                  <i class="xp" style={{ width: `${(h.xp / XP_PER_LEVEL) * 100}%` }} />
                </span>
                <small>
                  {h.xp}/{XP_PER_LEVEL}
                </small>
              </div>
              <div class="meter">
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
          {h.request === 'raise' && !candidate && (
            <div class="request" role="status">
              <span>
                «Con lo que me pagas no me llega ni para la cerveza.» {h.name} pide {RAISE_AMOUNT}{' '}
                monedas más por semana.
              </span>
              <div class="herocard-actions">
                <button class="btn btn-gold" onClick={() => onAnswer(true)}>
                  Subir a {h.salary + RAISE_AMOUNT}
                </button>
                <button class="btn btn-wood" onClick={() => onAnswer(false)}>
                  Negarse
                </button>
              </div>
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
