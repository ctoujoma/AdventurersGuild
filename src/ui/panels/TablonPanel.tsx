import { chainDef } from '../../core/chains';
import type { Quest } from '../../core/model';
import { dangerClass, dangerLabel } from '../../data/labels';
import { help } from '../HoldHelp';
import { Icon } from '../icons';
import { plural } from '../text';
import { isRealTime, left, shortLeft, shortSpan, span } from '../when';

interface Props {
  quests: Quest[];
  /** Con la sala de mapas a nivel 2 se ve el peligro real. */
  seeAll: boolean;
  onOpen: (id: string) => void;
  /** Reloj del día, para contar en minutos lo que falta (tiempo que corre solo). */
  clock?: number;
}

/**
 * Encargos como notas clavadas en el corcho, con lo justo para elegir: tipo, título, peligro,
 * plazas, días de viaje y paga. El cliente, la historia y los desafíos están en su ficha.
 */
export function TablonPanel({ quests, seeAll, onOpen, clock = 0 }: Props) {
  if (!quests.length)
    return <p class="panel-note">El tablón está vacío. Mañana llegarán más encargos.</p>;
  return (
    <div class="notes">
      {[
        ...quests.filter((q) => q.chain),
        ...quests.filter((q) => q.rumor),
        ...quests.filter((q) => !q.chain && !q.rumor),
      ].map((q, i) => {
        const hidden = q.dangerHidden && !seeAll;
        const chain = q.chain ? chainDef(q.chain.id) : null;
        const expires =
          q.expires === 1 && !isRealTime()
            ? 'caduca mañana'
            : `caduca en ${left(q.expires, clock)}`;
        return (
          <button
            key={q.id}
            data-tut={`quest-${q.id}`}
            class={`note ${q.chain ? 'note-chain' : ''} ${q.rumor ? 'note-rumor' : ''}`}
            style={{ '--tilt': `${(i % 2 ? 1 : -1) * (0.5 + (i % 3) * 0.3)}deg` }}
            onClick={() => onOpen(q.id)}
            aria-label={[
              q.title,
              chain ? `${chain.name}, paso ${q.chain!.step + 1} de ${chain.steps.length}` : q.type,
              q.rumor ? 'de un rumor, con botín especial' : '',
              `peligro ${dangerLabel(q.danger, hidden)}`,
              `${span(q.days)} de viaje`,
              `hasta ${q.slots} ${plural(q.slots, 'héroe', 'héroes')}`,
              `${q.reward} monedas${q.item ? ' y un objeto' : ''}`,
              chain ? '' : expires,
            ]
              .filter(Boolean)
              .join('. ')}
          >
            <span class="pin" aria-hidden="true" />
            {chain && (
              <span class="seal note-seal" aria-hidden="true">
                {q.chain!.step + 1}
              </span>
            )}
            <span class="note-top" aria-hidden="true">
              {chain ? (
                <span class="note-story">
                  {chain.name} · {q.chain!.step + 1}/{chain.steps.length}
                </span>
              ) : (
                <span class="note-type">{q.type}</span>
              )}
              {q.rumor ? (
                <span class="note-new note-rumor-tag">Rumor</span>
              ) : (
                q.fresh && <span class="note-new">Nuevo</span>
              )}
              {!chain && (
                <span class={`note-left ${q.expires === 1 ? 'urgent' : ''}`}>
                  <Icon name="reloj" size={10} />
                  {shortLeft(q.expires, clock)}
                </span>
              )}
            </span>
            <span class="note-title">{q.title}</span>
            <span class="note-foot" aria-hidden="true">
              <span class={`danger danger-${dangerClass(q.danger, hidden)}`}>
                {dangerLabel(q.danger, hidden)}
              </span>
              <span
                class="note-k"
                {...help(isRealTime() ? 'Lo que dura el viaje' : 'Días de viaje')}
              >
                <Icon name="pasos" size={10} />
                {isRealTime() ? shortSpan(q.days) : q.days}
              </span>
              <span class="note-k" {...help('Héroes que caben')}>
                <Icon name="heroe" size={10} />
                {q.slots}
              </span>
              <b class="reward">
                <Icon name="coin" size={12} />
                {q.reward}
                {q.item ? '+' : ''}
              </b>
            </span>
          </button>
        );
      })}
    </div>
  );
}
