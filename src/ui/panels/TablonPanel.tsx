import { chainDef } from '../../core/chains';
import type { Quest } from '../../core/model';
import { dangerClass, dangerLabel } from '../../data/labels';
import { MATERIALS, QUEST_MATERIAL } from '../../core/materials';
import { help } from '../HoldHelp';
import { MatIcon } from '../mats';
import { Icon } from '../icons';
import { plural } from '../text';
import { dawnIn, shortDawn, span } from '../when';

interface Props {
  quests: Quest[];
  /** Con la sala de mapas a nivel 2 se ve el peligro real. */
  seeAll: boolean;
  onOpen: (id: string) => void;
}

/**
 * Encargos como notas clavadas en el corcho, con lo justo para elegir: tipo, título, peligro,
 * plazas, días de viaje y paga. El cliente, la historia y los desafíos están en su ficha.
 */
export function TablonPanel({ quests, seeAll, onOpen }: Props) {
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
        const expires = `caduca ${dawnIn(q.expires)}`;
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
              `trae ${MATERIALS[QUEST_MATERIAL[q.type]].name.toLowerCase()}`,
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
                  {shortDawn(q.expires)}
                </span>
              )}
            </span>
            <span class="note-title">{q.title}</span>
            <span class="note-foot" aria-hidden="true">
              <span class={`danger danger-${dangerClass(q.danger, hidden)}`}>
                {dangerLabel(q.danger, hidden)}
              </span>
              <span class="note-k" {...help('Días de viaje')}>
                <Icon name="pasos" size={10} />
                {q.days}
              </span>
              <span class="note-k" {...help('Héroes que caben')}>
                <Icon name="heroe" size={10} />
                {q.slots}
              </span>
              <span
                class="note-k note-mat"
                {...help(`Trae ${MATERIALS[QUEST_MATERIAL[q.type]].name.toLowerCase()}`)}
              >
                <MatIcon m={QUEST_MATERIAL[q.type]} size={12} />
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
