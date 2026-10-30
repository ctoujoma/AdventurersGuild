import type { DawnEvent } from '../core/model';
import { Icon } from './icons';
import { plural } from './text';

interface Props {
  day: number;
  /** Días que han pasado con el juego cerrado (carta de «Mientras no estabas»). */
  away?: number;
  name: string;
  flavor: string;
  events: DawnEvent[];
  unread: number;
  onClose: () => void;
  onMail: () => void;
}

/** Transición entre días: la noche se aclara y se cuenta lo que ha pasado. */
export function Dawn({ day, away, name, flavor, events, unread, onClose, onMail }: Props) {
  return (
    <div class="dawn" role="dialog" aria-label={`Amanece el día ${day}`}>
      <div class="dawn-sky" aria-hidden="true">
        <span class="dawn-sun" />
      </div>
      <article class="dawn-card">
        {away ? (
          <>
            <span class="eyebrow">Mientras no estabas</span>
            <h2>
              {away === 1 ? 'Ha pasado un día' : `Han pasado ${away} días`} · día {day}
            </h2>
          </>
        ) : (
          <>
            <span class="eyebrow">Amanece sobre {name}</span>
            <h2>Día {day}</h2>
            <p class="quote">{flavor}</p>
          </>
        )}
        <ul class="dawn-events">
          {events.map((e, i) => (
            <li
              key={i}
              class={e.head ? 'ev ev-head' : `ev ev-${e.k ?? 'info'}`}
              style={{ animationDelay: `${0.35 + i * 0.12}s` }}
            >
              {e.t}
            </li>
          ))}
          {!events.length && <li class="ev ev-info">Una noche tranquila.</li>}
        </ul>
        <div class="dawn-actions">
          {unread > 0 && (
            <button
              class="btn btn-gold"
              aria-label={`Leer ${unread} ${plural(unread, 'carta', 'cartas')}`}
              onClick={onMail}
            >
              <Icon name="letter" size={16} /> Leer · {unread}
            </button>
          )}
          <button
            class={`btn ${unread ? 'btn-wood' : 'btn-gold'}`}
            aria-label="Abrir la taberna"
            onClick={onClose}
          >
            <Icon name="taberna" size={16} /> Abrir
          </button>
        </div>
      </article>
    </div>
  );
}
