import type { GameState, Hero } from '../../core/model';
import { Portrait } from '../Portrait';
import { listNames, plural } from '../text';
import { lookOf, marksOf } from '../view';

/** Quién está fuera: grupos de misión, desaparecidos y heridos. */
export function AwayPanel({ game, onHero }: { game: GameState; onHero: (id: string) => void }) {
  const byId = (id: string) => game.heroes.find((h) => h.id === id);
  const missing = game.heroes.filter((h) => h.status === 'desaparecido');
  const hurt = game.heroes.filter((h) => h.status === 'herido');
  const face = (h: Hero) => (
    <button key={h.id} class="face" onClick={() => onHero(h.id)} aria-label={h.name}>
      <Portrait look={lookOf(h)} marks={marksOf(h)} scale={1} alive={false} />
    </button>
  );
  return (
    <>
      <h3 class="sec-title">De misión</h3>
      {!game.missions.length && (
        <p class="panel-note">No hay nadie fuera. Ve al tablón para mandar un grupo.</p>
      )}
      <div class="list">
        {game.missions.map((m) => {
          const party = m.heroIds.map(byId).filter((h): h is Hero => !!h);
          const done = (m.quest.days - m.daysLeft) / m.quest.days;
          return (
            <article key={m.id} class="card-paper away">
              <div class="away-faces">{party.map(face)}</div>
              <div class="away-info">
                <b>{m.quest.title}</b>
                <span class="muted">
                  {listNames(party.map((h) => h.name))} · {m.quest.place}
                </span>
                <span class="track">
                  <i style={{ width: `${Math.max(8, done * 100)}%` }} />
                </span>
                <small>
                  {m.daysLeft === 1
                    ? 'Vuelven mañana'
                    : `Vuelven en ${m.daysLeft} ${plural(m.daysLeft, 'día', 'días')}`}
                </small>
              </div>
            </article>
          );
        })}
      </div>
      {missing.length > 0 && (
        <>
          <h3 class="sec-title">Desaparecidos</h3>
          <div class="list">
            {missing.map((h) => (
              <article key={h.id} class="card-paper away">
                <div class="away-faces">{face(h)}</div>
                <div class="away-info">
                  <b>{h.name}</b>
                  <span class="muted">Nadie sabe dónde está. Quizá vuelva.</span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {hurt.length > 0 && (
        <>
          <h3 class="sec-title">Guardan cama</h3>
          <div class="list">
            {hurt.map((h) => (
              <article key={h.id} class="card-paper away">
                <div class="away-faces">{face(h)}</div>
                <div class="away-info">
                  <b>{h.name}</b>
                  <span class="muted">
                    {h.days} {plural(h.days, 'día', 'días')} de reposo. La enfermería lo acorta.
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
