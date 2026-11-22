import type { PendingEvent } from '../core/model';
import { tx } from '../textos';

interface Props {
  event: PendingEvent;
  onChoose: (index: number) => void;
}

/** Un suceso en la taberna: hay que decidir. */
export function EventCard({ event, onChoose }: Props) {
  return (
    <div class="card-backdrop">
      <article class="herocard eventcard" role="dialog" aria-label="Suceso en la taberna">
        <div class="qs-scroll">
          <span class="eyebrow">Mientras tanto, en la taberna…</span>
          <p class="event-text">{tx(event.text)}</p>
          <div class="event-options">
            {event.options.map((o, i) => (
              <button
                key={i}
                class={`btn ${i === 0 ? 'btn-gold' : 'btn-wood'}`}
                onClick={() => onChoose(i)}
              >
                <span>{tx(o.label)}</span>
                <small>{tx(o.hint)}</small>
              </button>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
