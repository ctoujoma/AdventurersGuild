import type { Quest } from '../../core/model';
import { dangerClass, dangerLabel } from '../../data/labels';
import { Icon } from '../icons';
import { plural } from '../text';

interface Props {
  quests: Quest[];
  /** Con la sala de mapas a nivel 2 se ve el peligro real. */
  seeAll: boolean;
  onOpen: (id: string) => void;
}

/** Encargos como notas clavadas en el corcho; al tocar una se forma el grupo. */
export function TablonPanel({ quests, seeAll, onOpen }: Props) {
  return (
    <>
      <p class="panel-note">
        {quests.length
          ? 'Toca un encargo para formar un grupo y mandarlo.'
          : 'El tablón está vacío. Mañana llegarán más encargos.'}
      </p>
      <div class="notes">
        {quests.map((q, i) => (
          <button
            key={q.id}
            class="note"
            style={{ '--tilt': `${(i % 2 ? 1 : -1) * (0.6 + (i % 3) * 0.4)}deg` }}
            onClick={() => onOpen(q.id)}
            aria-label={`${q.title}. ${q.reward} monedas. Formar grupo`}
          >
            <span class="pin" aria-hidden="true" />
            <span class="note-top">
              <span class="note-type">{q.type}</span>
              {q.fresh && <span class="note-new">Nuevo</span>}
              <span class={`muted ${q.expires === 1 ? 'urgent' : ''}`}>
                {q.expires === 1 ? 'caduca mañana' : `caduca en ${q.expires} días`}
              </span>
            </span>
            <span class="note-title">{q.title}</span>
            <span class="client">{q.client}</span>
            <span class="note-text">{q.text}</span>
            <span class="chips">
              {q.challenges.map((c) => (
                <span key={c.skill} class="chal">
                  {c.skill} {c.diff}
                </span>
              ))}
            </span>
            <span class="note-foot">
              <span class={`danger danger-${dangerClass(q.danger, q.dangerHidden && !seeAll)}`}>
                Peligro {dangerLabel(q.danger, q.dangerHidden && !seeAll)}
              </span>
              <span class="muted">
                {q.days} {plural(q.days, 'día', 'días')} · hasta {q.slots}
              </span>
              <b class="reward">
                <Icon name="coin" size={14} />
                {q.reward}
                {q.item ? ' +' : ''}
              </b>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
