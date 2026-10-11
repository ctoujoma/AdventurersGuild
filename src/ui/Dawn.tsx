import type { DawnEvent } from '../core/model';
import { plural } from './text';

interface Props {
  day: number;
  flavor: string;
  events: DawnEvent[];
  unread: number;
  onClose: () => void;
  onMail: () => void;
}

/** Transición entre días: la noche se aclara y se cuenta lo que ha pasado. */
export function Dawn({ day, flavor, events, unread, onClose, onMail }: Props) {
  return (
    <div class="dawn" role="dialog" aria-label={`Amanece el día ${day}`}>
      <div class="dawn-sky" aria-hidden="true">
        <span class="dawn-sun" />
      </div>
      <article class="dawn-card">
        <span class="eyebrow">Amanece sobre El Jarro Partido</span>
        <h2>Día {day}</h2>
        <p class="quote">{flavor}</p>
        <ul class="dawn-events">
          {events.map((e, i) => (
            <li
              key={i}
              class={`ev ev-${e.k ?? 'info'}`}
              style={{ animationDelay: `${0.35 + i * 0.12}s` }}
            >
              {e.t}
            </li>
          ))}
          {!events.length && <li class="ev ev-info">Una noche tranquila.</li>}
        </ul>
        <div class="dawn-actions">
          {unread > 0 && (
            <button class="btn btn-gold" onClick={onMail}>
              Leer {unread} {plural(unread, 'carta', 'cartas')}
            </button>
          )}
          <button class={`btn ${unread ? 'btn-wood' : 'btn-gold'}`} onClick={onClose}>
            Abrir la taberna
          </button>
        </div>
      </article>
    </div>
  );
}
