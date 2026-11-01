import { useEffect, useMemo, useState } from 'preact/hooks';
import { audio, type Sfx } from '../audio/audio';
import type { DawnEvent } from '../core/model';
import { dawnPages, delayAfter, type Step } from './dawnSteps';
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
  /** Todo de golpe, sin abrir las noticias una a una (ajuste del jugador). */
  all?: boolean;
  /** «Siempre así»: recordar en los ajustes que se quiere todo de golpe. */
  onAlways?: () => void;
  onClose: () => void;
  onMail: () => void;
}

/** El sonido de cada noticia al abrirse, según lo que sea. */
function sfxOf(s: Step): [Sfx, number] {
  const e = s.list[0]!;
  if (s.more) return ['open', 0.6];
  if (e.big) return ['holy', 0.8];
  if (e.k === 'bad') return ['thud', 0.45];
  if (e.k === 'good') return ['select', 0.8];
  if (e.k === 'warn') return ['tab', 0.6];
  return ['click', 0.8];
}

function Line({ e, delay }: { e: DawnEvent; delay?: number }) {
  return (
    <li
      class={e.head ? 'ev ev-head' : `ev ev-${e.k ?? 'info'}${e.big ? ' ev-big' : ''}`}
      style={delay !== undefined ? { animationDelay: `${delay}s` } : undefined}
    >
      {e.big && <Icon name="star" size={14} class="ev-star" />}
      {e.t}
    </li>
  );
}

/**
 * Transición entre días: la noche se aclara y se cuenta lo que ha pasado. Las noticias se abren de
 * una en una (solas, con un ritmo corto, o tocando la carta) y lo bueno de verdad, con brillo. En
 * la de «Mientras no estabas», un día cada vez. «Saltar» lo enseña todo.
 */
export function Dawn({
  day,
  away,
  name,
  flavor,
  events,
  unread,
  all,
  onAlways,
  onClose,
  onMail,
}: Props) {
  const pages = useMemo(() => dawnPages(events), [events]);
  const [page, setPage] = useState(0);
  /** Pasos abiertos de la página. */
  const [open, setOpen] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const flat = all || skipped;
  const steps = pages[page]!.steps;
  const done = flat || open >= steps.length;
  const last = flat || page === pages.length - 1;

  const reveal = () => {
    const s = steps[open];
    if (!s) return;
    const [sfx, v] = sfxOf(s);
    audio.play(sfx, v);
    setOpen((n) => n + 1);
  };
  // Se van abriendo solas; tocar la carta adelanta la siguiente.
  useEffect(() => {
    if (done) return;
    const t = setTimeout(reveal, open ? delayAfter(steps[open - 1]) : 650);
    return () => clearTimeout(t);
  }, [open, page, done]);

  const nextPage = () => {
    audio.play('open', 0.7);
    setPage((p) => p + 1);
    setOpen(0);
  };
  const skip = () => {
    audio.play('click');
    setSkipped(true);
  };

  const list = flat
    ? events.map((e, i) => <Line key={i} e={e} delay={0.35 + Math.min(i, 12) * 0.06} />)
    : steps.slice(0, open).map((s, i) =>
        s.more ? (
          <li key={i} class="ev-more">
            <details>
              <summary>
                Y además, {s.list.length} {plural(s.list.length, 'cosa', 'cosas')} más
              </summary>
              <ul class="dawn-events">
                {s.list.map((e, j) => (
                  <Line key={j} e={e} />
                ))}
              </ul>
            </details>
          </li>
        ) : (
          <Line key={i} e={s.list[0]!} />
        ),
      );

  return (
    <div class="dawn" role="dialog" aria-label={`Amanece el día ${day}`}>
      <div class="dawn-sky" aria-hidden="true">
        <span class="dawn-sun" />
      </div>
      <article class="dawn-card" onClick={() => !done && reveal()}>
        {away ? (
          <>
            <span class="eyebrow">Mientras no estabas</span>
            <h2>
              {away === 1 ? 'Ha pasado un día' : `Han pasado ${away} días`} · día {day}
            </h2>
            {!flat && pages[page]!.head && (
              <p class="dawn-page" key={page}>
                {pages[page]!.head}
                {pages.length > 1 && (
                  <small>
                    {' '}
                    · {page + 1} de {pages.length}
                  </small>
                )}
              </p>
            )}
          </>
        ) : (
          <>
            <span class="eyebrow">Amanece sobre {name}</span>
            <h2>Día {day}</h2>
            <p class="quote">{flavor}</p>
          </>
        )}
        <ul class="dawn-events" aria-live="polite">
          {list}
          {!events.length && <li class="ev ev-info">Una noche tranquila.</li>}
        </ul>
        {!done && (
          <p class="dawn-tap" aria-hidden="true">
            Toca para seguir
          </p>
        )}
        <div class="dawn-actions">
          {!last || !done ? (
            <>
              {done ? (
                <button class="btn btn-gold" onClick={nextPage}>
                  Día siguiente ›
                </button>
              ) : (
                <button
                  class="btn btn-wood"
                  onClick={(e) => {
                    e.stopPropagation();
                    skip();
                  }}
                >
                  Saltar
                </button>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
          {skipped && !all && onAlways && (
            <button class="linklike dawn-always" onClick={onAlways}>
              Siempre de golpe
            </button>
          )}
        </div>
      </article>
    </div>
  );
}
