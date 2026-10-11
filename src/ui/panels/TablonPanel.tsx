import type { DemoQuest } from '../../data/demo';
import { Icon } from '../icons';

/** Encargos como notas clavadas en el corcho. */
export function TablonPanel({ quests }: { quests: DemoQuest[] }) {
  return (
    <>
      <p class="panel-note">
        Fase 1: formar grupos y mandarlos. De momento, los encargos del mockup.
      </p>
      <div class="notes">
        {quests.map((q, i) => (
          <article
            key={q.id}
            class="note"
            style={{ transform: `rotate(${(i % 2 ? 1 : -1) * (0.6 + (i % 3) * 0.4)}deg)` }}
          >
            <span class="pin" aria-hidden="true" />
            <h3>{q.title}</h3>
            <span class="client">{q.client}</span>
            <p>{q.text}</p>
            <div class="chips">
              {q.challenges.map((c) => (
                <span key={c} class="chal">
                  {c}
                </span>
              ))}
            </div>
            <footer>
              <span class={`danger danger-${q.danger === '¿?' ? 'x' : q.danger.toLowerCase()}`}>
                Peligro {q.danger.toLowerCase()}
              </span>
              <span class="muted">{q.days === 1 ? '1 día' : `${q.days} días`}</span>
              <b class="reward">
                <Icon name="coin" size={14} />
                {q.reward}
              </b>
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}
