import { useEffect, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import type { Custom, Hero, Report } from '../core/model';
import { CREST_COLORS, sealInitial } from '../data/custom';
import { OUTCOME_CLASS } from '../data/labels';
import { Icon } from './icons';
import { Portrait } from './Portrait';
import { lookOf, marksOf } from './view';

interface Props {
  report: Report;
  heroes: Hero[];
  /** La taberna que firma: inicial y color del lacre. */
  seal: Custom;
  onClose: () => void;
  /** Ver (otra vez) la pelea contra el jefe, si la hubo. */
  onWatch?: () => void;
}

/** Informe de misión como carta: quién fue, qué pasó y qué trajeron. */
export function Letter({ report: r, heroes, seal, onClose, onWatch }: Props) {
  const party = r.heroIds
    .map((id) => heroes.find((h) => h.id === id))
    .filter((h): h is Hero => !!h);
  // Llega deslizándose, el lacre cae con un golpe seco y al cerrar se retira.
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => audio.play('thud', 0.35), 300);
    return () => clearTimeout(t);
  }, []);
  const close = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onClose, 160);
  };
  return (
    <div class={`card-backdrop ${leaving ? 'is-leaving' : ''}`} onClick={close}>
      <article
        class="herocard letter"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Informe: ${r.title}`}
      >
        <button class="btn-icon herocard-x" aria-label="Cerrar" onClick={close}>
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <span
            class="seal"
            aria-hidden="true"
            style={{ background: CREST_COLORS[seal.color].field }}
          >
            {sealInitial(seal.name)}
          </span>
          <span class="eyebrow">Informe · día {r.day}</span>
          <h3 class={`outcome outcome-${OUTCOME_CLASS[r.outcome]}`}>
            {r.heading ?? (r.raid ? (r.raid.won ? 'Asalto repelido' : 'Saqueo') : r.outcome)}
          </h3>
          <b class="letter-title">{r.title}</b>
          <div class="letter-party">
            {party.map((h) => (
              <span
                key={h.id}
                class={`letter-hero ${h.status === 'muerto' || h.status === 'desaparecido' ? 'gone' : ''}`}
              >
                <Portrait look={lookOf(h)} marks={marksOf(h)} scale={1} alive={false} />
                <small>{h.name}</small>
              </span>
            ))}
          </div>
          <div class="story">
            {r.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div class="chips">
            {r.chips.map((c, i) => (
              <span key={i} class={`chip chip-${c.k}`}>
                {c.t}
              </span>
            ))}
          </div>
          {onWatch && (
            <button class="btn btn-wood letter-watch" onClick={onWatch}>
              <Icon name="espadas" size={14} /> Ver la batalla
            </button>
          )}
          <p class="sign">— anotado en el libro del gremio</p>
        </div>
      </article>
    </div>
  );
}
