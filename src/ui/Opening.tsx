import { useState } from 'preact/hooks';
import type { Arrival } from '../core/model';

interface Props {
  arrival: Arrival;
  /** Mejor llegada de intentos anteriores, para comparar. */
  best: Arrival | null;
  /** Vista de salas: se abren las obras. */
  rooms?: boolean;
  onOpen: () => void;
  onRetry: () => void;
}

/** Al pagar la deuda: el gremio es tuyo y empieza la aventura (o se intenta otra vez). */
export function Opening({ arrival: a, best, rooms, onOpen, onRetry }: Props) {
  const [retry, setRetry] = useState(false);
  const better = best && a.score > best.score;
  return (
    <div class="dawn opening" role="dialog" aria-label="El gremio es tuyo">
      <div class="dawn-sky" aria-hidden="true">
        <span class="dawn-sun" />
      </div>
      <article class="dawn-card">
        <span class="eyebrow">Día {a.day} · la deuda está pagada</span>
        <h2>El gremio es tuyo</h2>
        <p class="opening-lead">Ahora empieza la aventura.</p>
        <div class="arrival">
          <span>
            <b>{a.heroes}</b> héroes
          </span>
          <span>
            <b>{a.gold}</b> monedas
          </span>
          <span>
            <b>{a.rep}</b> reputación
          </span>
          <span>
            <b>{a.trophies}</b> trofeos
          </span>
          <span>
            <b>{a.facilities}</b> mejoras
          </span>
          <span>
            <b>{a.fallen}</b> caídos
          </span>
        </div>
        <p class="opening-score">
          Llegada: <b>{a.score}</b> puntos
          {best && (better ? ' · ¡tu mejor llegada!' : ` · tu mejor: ${best.score}`)}
        </p>
        <ul class="dawn-events">
          {rooms && (
            <li class="ev ev-good">
              Se acabaron los apaños: ya puedes construir salas nuevas, ampliarlas, moverlas,
              excavar el sótano y comprar los solares de al lado.
            </li>
          )}
          <li class="ev ev-info">
            Sin Merlo encima: cada 7 días solo se pagan salarios. Dos semanas sin pagar y el gremio
            quiebra.
          </li>
          <li class="ev ev-warn">
            Los veteranos cobran más con cada nivel y piden caché: haz que rindan en encargos de su
            altura, que ahora pagan más.
          </li>
          <li class="ev ev-good">
            El Libro de hazañas (el libro del desván) premia lo que consigas, y cada mes trae
            desafíos nuevos.
          </li>
        </ul>
        {retry ? (
          <div class="title-confirm">
            <span>
              ¿No te convence cómo has llegado? Empieza de nuevo y llega en mejores condiciones a la
              apertura. Esta partida se perderá (puedes guardarla antes desde Gremio).
            </span>
            <div class="herocard-actions">
              <button class="btn btn-red" onClick={onRetry}>
                Otro intento
              </button>
              <button class="btn btn-wood" onClick={() => setRetry(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div class="dawn-actions">
            <button class="btn btn-gold" onClick={onOpen}>
              Abrir el gremio al mundo
            </button>
            <button class="btn btn-wood" onClick={() => setRetry(true)}>
              Otro intento
            </button>
          </div>
        )}
      </article>
    </div>
  );
}
