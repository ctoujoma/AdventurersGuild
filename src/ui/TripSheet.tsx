import { useMemo } from 'preact/hooks';
import { arenaBuffer } from '../art/arenas';
import { chainDef } from '../core/chains';
import { eventText, journeyNow, LEGS, type JourneyNow } from '../core/journey';
import type { GameState, Mission } from '../core/model';
import { dangerClass, dangerLabel } from '../data/labels';
import { BufferImage } from './BufferImage';
import { Icon, type IconName } from './icons';
import { Portrait } from './Portrait';
import { lookOf, marksOf, heroFrame } from './view';
import { left } from './when';

interface Props {
  game: GameState;
  mission: Mission;
  onClose: () => void;
  onHero: (id: string) => void;
}

const KIND_ICON: Record<JourneyNow['past'][number]['kind'], IconName> = {
  camino: 'pasos',
  llegada: 'banderin',
  faena: 'diana',
  pelea: 'espadas',
  jefe: 'calavera',
  noche: 'moon',
  vuelta: 'home',
};

/**
 * La tira del viaje. Hueco para `QuestStrip` (agente de arte): recibe `now` y nada más. Hasta
 * que llegue, el fondo del terreno con el grupo marcado donde va.
 */
function Strip({ now }: { now: JourneyNow }) {
  const back = useMemo(() => arenaBuffer(now.journey.terrain), [now.journey.terrain]);
  return (
    <div class={`trip-strip ${now.night ? 'is-night' : ''}`} data-strip>
      <BufferImage buf={back} scale={1} class="trip-strip-back" />
      <span class="trip-strip-party" style={{ left: `${Math.round(now.t * 100)}%` }}>
        <Icon name="pasos" size={12} />
      </span>
    </div>
  );
}

/** Ficha «Encargo en curso»: la tira, el encargo, quién va, el viaje por partes y su diario. */
export function TripSheet({ game, mission: m, onClose, onHero }: Props) {
  const now = journeyNow(game, m);
  const q = m.quest;
  const heroes = m.heroIds.map((id) => game.heroes.find((h) => h.id === id)).filter((h) => !!h);
  const legIndex = LEGS.findIndex((l) => l.id === now.leg);
  return (
    <div class="card-backdrop as-sheet" onClick={onClose}>
      <article
        class="herocard questsheet tripsheet"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Encargo en curso: ${q.title}`}
      >
        <button class="btn-icon herocard-x" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <Strip now={now} />
          <header class="qs-head">
            <span class="eyebrow">
              {q.chain
                ? `${chainDef(q.chain.id).name} · paso ${q.chain.step + 1} de ${chainDef(q.chain.id).steps.length}`
                : `Encargo en curso · ${q.type}`}
            </span>
            <h3>{q.title}</h3>
          </header>
          <div class="chips qs-facts">
            <span class="fact">
              <Icon name="pasos" size={12} />
              {q.place}
            </span>
            <span class="fact">
              <Icon name="home" size={12} />
              en casa en {left(m.daysLeft, game.clock ?? 0)}
            </span>
            <span class={`danger danger-${dangerClass(q.danger, false)}`}>
              Peligro {dangerLabel(q.danger, false)}
            </span>
          </div>

          <div class="trip-crew">
            {heroes.map((h) => (
              <button
                key={h.id}
                class="pick"
                aria-label={`${h.name}: ver su ficha`}
                onClick={() => onHero(h.id)}
              >
                <Portrait
                  look={lookOf(h)}
                  marks={marksOf(h)}
                  frame={heroFrame(h)}
                  scale={1}
                  alive={false}
                />
                <span class="pick-name">{h.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          <ol class="trip-legs" aria-label="El viaje por partes">
            {LEGS.map((l, i) => {
              const fill = i < legIndex ? 1 : i === legIndex ? now.legT : 0;
              return (
                <li
                  key={l.id}
                  class={`trip-leg ${i < legIndex ? 'is-done' : ''} ${i === legIndex ? 'is-now' : ''}`}
                  style={{ flex: l.to - l.from }}
                  aria-current={i === legIndex ? 'step' : undefined}
                >
                  <span class="trip-leg-bar" aria-hidden="true">
                    <i style={{ width: `${Math.round(fill * 100)}%` }} />
                  </span>
                  <span class="trip-leg-name">{l.name}</span>
                </li>
              );
            })}
          </ol>

          <h4 class="crew-h">
            <span>Lo que ha pasado</span>
          </h4>
          {now.past.length ? (
            <ul class="trip-log">
              {[...now.past].reverse().map((e, i) => (
                <li key={`${e.t}-${i}`} class={`trip-ev trip-ev-${e.kind}`}>
                  <Icon name={KIND_ICON[e.kind]} size={12} />
                  <span>{eventText(game, e)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="tiny">Acaban de salir por la puerta.</p>
          )}
          <p class="tiny trip-note">Lo que de verdad pase lo contarán al volver, en su informe.</p>
        </div>
      </article>
    </div>
  );
}
