import { useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { RISK_LABELS, estimate, skill, type Member } from '../core/party';
import { CLASS_NAMES, STATUS_LABEL, lookOf, type DemoHero, type DemoQuest } from '../data/demo';
import { Icon } from './icons';
import { Portrait } from './Portrait';
import { listNames, plural } from './text';

interface Props {
  quest: DemoQuest;
  /** Héroes del gremio (sin candidatos). */
  heroes: DemoHero[];
  onClose: () => void;
  onSend: (ids: string[]) => void;
}

const member = (h: DemoHero): Member => ({
  cls: h.cls,
  lvl: h.lvl,
  attrs: h.attrs,
  traits: h.traits,
});

/** Ficha de un encargo: desafíos, estimación de riesgo y quién va. */
export function QuestSheet({ quest: q, heroes, onClose, onSend }: Props) {
  const [sel, setSel] = useState<string[]>([]);
  const [warn, setWarn] = useState<string | null>(null);
  const party = sel.map((id) => heroes.find((h) => h.id === id)!).filter(Boolean);
  const est = estimate(q.challenges, party.map(member));
  const scale = Math.max(1, ...est.rows.map((r) => Math.max(r.diff, r.power))) * 1.15;

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
              {q.type} · {q.client}
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
            <span class={`danger danger-${q.danger === '¿?' ? 'x' : q.danger.toLowerCase()}`}>
              Peligro {q.danger.toLowerCase()}
            </span>
          </div>

          <div class={`estimate est-${party.length ? est.level : 'none'}`}>
            <b>{party.length ? RISK_LABELS[est.level] : 'Elige un grupo'}</b>
            <span>
              {party.length ? `Grupo ${party.length}/${q.slots}` : `Hasta ${q.slots}`} · {q.days}{' '}
              {plural(q.days, 'día', 'días')} ·{' '}
              <span class="reward-inline">
                <Icon name="coin" size={12} />
                {q.reward}
              </span>
            </span>
          </div>
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
            {heroes.map((h) => {
              const on = sel.includes(h.id);
              const busy = h.status !== 'ok';
              return (
                <button
                  key={h.id}
                  class="pick"
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => toggle(h.id)}
                >
                  <Portrait
                    look={lookOf(h)}
                    marks={{ injured: h.status === 'herido', eyepatch: h.eyepatch }}
                    scale={1}
                    alive={false}
                  />
                  <span class="pick-info">
                    <b>{h.name}</b>
                    <span class="muted">
                      {CLASS_NAMES[h.cls][h.sex]} · {h.lvl}
                    </span>
                    <span class="pick-skills">
                      {busy
                        ? `${STATUS_LABEL[h.status]}${h.days ? ` · ${h.days} d` : ''}`
                        : q.challenges
                            .map((c) => `${c.skill.slice(0, 3)} ${skill(member(h), c.skill)}`)
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
        {warn && (
          <p class="qs-warn" role="status">
            {warn}
          </p>
        )}
        <button class="btn btn-gold qs-send" disabled={!party.length} onClick={() => onSend(sel)}>
          {party.length
            ? `Enviar a ${listNames(party.map((h) => h.name))}`
            : 'Elige al menos un héroe'}
        </button>
      </article>
    </div>
  );
}
