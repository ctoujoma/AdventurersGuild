import type { Hero, Report } from '../core/model';
import { OUTCOME_CLASS } from '../data/labels';
import { Icon } from './icons';
import { Portrait } from './Portrait';
import { lookOf, marksOf } from './view';

interface Props {
  report: Report;
  heroes: Hero[];
  onClose: () => void;
}

/** Informe de misión como carta: quién fue, qué pasó y qué trajeron. */
export function Letter({ report: r, heroes, onClose }: Props) {
  const party = r.heroIds
    .map((id) => heroes.find((h) => h.id === id))
    .filter((h): h is Hero => !!h);
  return (
    <div class="card-backdrop" onClick={onClose}>
      <article
        class="herocard letter"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Informe: ${r.title}`}
      >
        <button class="btn-icon herocard-x" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <span class="seal" aria-hidden="true">
            G
          </span>
          <span class="eyebrow">Informe · día {r.day}</span>
          <h3 class={`outcome outcome-${OUTCOME_CLASS[r.outcome]}`}>{r.outcome}</h3>
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
          <p class="sign">— anotado en el libro del gremio</p>
        </div>
      </article>
    </div>
  );
}
