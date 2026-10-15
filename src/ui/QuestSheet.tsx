import { useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { canSend } from '../core/game';
import type { GameState, Quest } from '../core/model';
import { chainDef } from '../core/chains';
import { PERKS, partyClasses, tripDays } from '../core/classes';
import { RISK_LABELS, moraleMod, skill } from '../core/party';
import { questEstimate } from '../core/resolve';
import { CLASS_NAMES, dangerClass, dangerLabel, statusLabel } from '../data/labels';
import { Icon } from './icons';
import { Portrait } from './Portrait';
import { listNames, plural } from './text';
import { lookOf, marksOf, memberOf } from './view';

interface Props {
  game: GameState;
  quest: Quest;
  onClose: () => void;
  onSend: (ids: string[]) => void;
}

/** Ficha de un encargo: desafíos, estimación de riesgo y quién va. */
export function QuestSheet({ game, quest: q, onClose, onSend }: Props) {
  const [sel, setSel] = useState<string[]>([]);
  const [warn, setWarn] = useState<string | null>(null);
  const heroes = game.heroes.filter((h) => h.status !== 'muerto');
  // Los disponibles primero y, entre ellos, quien más destaca en lo que pide el encargo
  // (su mejor habilidad de las pedidas y, a igualdad, la suma de todas).
  const fit = (h: (typeof heroes)[number]) => {
    const vals = q.challenges.map((c) => skill(memberOf(h, game.fac), c.skill));
    return Math.max(0, ...vals) * 100 + vals.reduce((a, b) => a + b, 0);
  };
  const busyOf = (h: (typeof heroes)[number]) => h.status !== 'ok' || !!h.guard;
  const ranked = [...heroes].sort(
    (a, b) => Number(busyOf(a)) - Number(busyOf(b)) || fit(b) - fit(a),
  );
  const party = sel.map((id) => heroes.find((h) => h.id === id)!).filter(Boolean);
  const members = party.map((h) => memberOf(h, game.fac));
  const est = questEstimate(q, members, game.fac);
  const scale = Math.max(1, ...est.rows.map((r) => Math.max(r.diff, r.power))) * 1.15;
  const blocked = party.length ? canSend(game, q.id, sel) : null;
  const mage = party.find((h) => h.cls === 'mago');
  const days = tripDays(q, members, game.fac.establo);
  const hideDanger = q.dangerHidden && !mage && game.fac.mapas < 2;

  const toggle = (id: string) => {
    setWarn(null);
    if (sel.includes(id)) {
      audio.play('deselect');
      setSel(sel.filter((x) => x !== id));
    } else if (sel.length < q.slots) {
      audio.play('select');
      setSel([...sel, id]);
    } else
      setWarn(`Este encargo admite ${q.slots} ${plural(q.slots, 'héroe', 'héroes')} como máximo.`);
  };

  return (
    <div class="card-backdrop" onClick={onClose}>
      <article
        class="herocard questsheet"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Encargo: ${q.title}`}
      >
        <button class="btn-icon herocard-x" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <header class="qs-head">
            <span class="eyebrow">
              {q.chain
                ? `${chainDef(q.chain.id).name} · paso ${q.chain.step + 1} de ${chainDef(q.chain.id).steps.length}`
                : `${q.type} · ${q.client}`}
            </span>
            <h3>{q.title}</h3>
          </header>
          <p class="quote">{q.text}</p>
          <div class="chips">
            {q.challenges.map((c) => (
              <span key={c.skill} class="chal">
                {c.skill} {c.diff}
              </span>
            ))}
            <span class={`danger danger-${dangerClass(q.danger, hideDanger)}`}>
              Peligro {dangerLabel(q.danger, hideDanger)}
            </span>
            {q.item && <span class="chal chal-item">+ objeto</span>}
          </div>

          <div class={`estimate est-${party.length ? est.level : 'none'}`}>
            <b>{party.length ? RISK_LABELS[est.level] : 'Elige un grupo'}</b>
            <span>
              {party.length ? `Grupo ${party.length}/${q.slots}` : `Hasta ${q.slots}`} · {days}{' '}
              {plural(days, 'día', 'días')} ·{' '}
              <span class="reward-inline">
                <Icon name="coin" size={12} />
                {q.reward}
              </span>
            </span>
          </div>
          {est.reveal && mage && (
            <div class="twist" role="status">
              <b>{mage.name} nota algo raro.</b> {q.twist} El primer desafío será más duro.
            </div>
          )}
          {mage && q.dangerHidden && game.fac.mapas < 2 && (
            <div class="twist" role="status">
              <b>{mage.name} no se fía del cliente.</b> El peligro real es mayor de lo que dice.
            </div>
          )}
          {party.length > 0 && (
            <ul class="perks">
              {partyClasses(members).map((c) => (
                <li key={c}>
                  <b>{PERKS[c].name}</b> {PERKS[c].desc}
                </li>
              ))}
            </ul>
          )}
          <div class="cbars">
            {est.rows.map((r) => {
              const k = r.power >= r.diff ? 'ok' : r.power >= r.diff - 3 ? 'close' : 'low';
              return (
                <div key={r.skill} class="cbar">
                  <span>{r.skill}</span>
                  <span class="track" title={`Dificultad ${r.diff}`}>
                    <i class={k} style={{ width: `${(r.power / scale) * 100}%` }} />
                    <b style={{ left: `${(r.diff / scale) * 100}%` }} />
                  </span>
                  <span class="v">
                    {r.power}/{r.diff}
                  </span>
                </div>
              );
            })}
          </div>

          <h4 class="qs-sub">Quién va</h4>
          <div class="picks">
            {ranked.map((h) => {
              const on = sel.includes(h.id);
              const busy = busyOf(h);
              return (
                <button
                  key={h.id}
                  class="pick"
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => toggle(h.id)}
                >
                  <Portrait look={lookOf(h)} marks={marksOf(h)} scale={1} alive={false} />
                  <span class="pick-info">
                    <b>{h.name}</b>
                    <span class="muted">
                      {CLASS_NAMES[h.cls][h.sex]} · {h.lvl}
                      {moraleMod(h) > 0 && (
                        <span class="mood up"> · {h.sex === 'f' ? 'animada' : 'animado'}</span>
                      )}
                      {moraleMod(h) < 0 && (
                        <span class="mood down">
                          {' '}
                          · {h.sex === 'f' ? 'desanimada' : 'desanimado'}
                        </span>
                      )}
                    </span>
                    <span class="pick-skills">
                      {busy
                        ? h.guard
                          ? 'De guardia'
                          : statusLabel(h)
                        : q.challenges
                            .map(
                              (c) =>
                                `${c.skill.slice(0, 3)} ${skill(memberOf(h, game.fac), c.skill)}`,
                            )
                            .join(' · ')}
                    </span>
                  </span>
                  <span class="check" aria-hidden="true">
                    {on && <Icon name="check" size={16} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {(warn || blocked) && (
          <p class="qs-warn" role="status">
            {warn ?? blocked}
          </p>
        )}
        <button
          class="btn btn-gold qs-send"
          disabled={!party.length || !!blocked}
          onClick={() => onSend(sel)}
        >
          {party.length
            ? `Enviar a ${listNames(party.map((h) => h.name))}`
            : 'Elige al menos un héroe'}
        </button>
      </article>
    </div>
  );
}
