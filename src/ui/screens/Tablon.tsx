import { DEMO_QUESTS } from '../../data/demo';

export function Tablon() {
  return (
    <section class="sec">
      <h2>Tablón de encargos</h2>
      <p class="hint">Fase 1: aquí llegarán los encargos generados. De momento, los del mockup.</p>
      {DEMO_QUESTS.map((q) => (
        <article class="card" key={q.id}>
          <h3>{q.title}</h3>
          <div class="row">
            <span class="muted">{q.client}</span>
            <span class="reward">
              <i class="coin" />
              {q.reward}
            </span>
          </div>
          <span class="muted">Peligro: {q.danger}</span>
        </article>
      ))}
    </section>
  );
}
