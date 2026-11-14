import { useMemo } from 'preact/hooks';
import { chainDef } from '../../core/chains';
import type { GameState, Quest } from '../../core/model';
import { RISK_LABELS, moraleBand } from '../../core/party';
import { outlook, type Outlook } from '../../core/suggest';
import { dangerClass, dangerLabel } from '../../data/labels';
import { MATERIALS, QUEST_MATERIAL } from '../../core/materials';
import { help } from '../HoldHelp';
import { MatIcon } from '../mats';
import { Icon, SKILL_ICON } from '../icons';
import { listNames, plural } from '../text';
import { span } from '../when';

interface Props {
  game: GameState;
  quests: Quest[];
  /** Con la sala de mapas a nivel 2 se ve el peligro real. */
  seeAll: boolean;
  onOpen: (id: string) => void;
}

/** Lo que cambia la nota: quién hay en casa y cómo está, su equipo y los encargos. */
const outlookKey = (s: GameState) =>
  JSON.stringify([
    s.fac.arm,
    s.quests.map((q) => q.id),
    s.heroes.map((h) => [
      h.id,
      h.status,
      h.guard,
      h.lvl,
      h.attrs,
      h.traits,
      moraleBand(h.morale),
      Object.values(h.worn ?? {}).map((i) => [i?.id, i?.plus]),
    ]),
  ]);

/** Cuánto le queda a la nota, en palabras: el último día no se confunde con los días de viaje. */
const leftWords = (n: number) => (n <= 1 ? 'Último día' : `Quedan ${n} días`);

/** La fila de lo que pide (verde si el grupo sugerido llega, rojo si no) y la chapa de cómo saldría. */
function Outlook({ q, o, game }: { q: Quest; o: Outlook | undefined; game: GameState }) {
  if (!o) return null;
  const rows = 'est' in o ? o.est.rows : null;
  const names =
    'ids' in o
      ? listNames(o.ids.map((id) => game.heroes.find((h) => h.id === id)?.name.split(' ')[0] ?? ''))
      : '';
  return (
    <span class="note-odds" aria-hidden="true">
      <span
        class="note-skills"
        {...help(
          rows
            ? `Lo que pide. Verde: tu mejor grupo de casa llega; rojo: se queda corto.`
            : 'Lo que pide.',
        )}
      >
        {q.challenges.map((c, i) => {
          const r = rows?.[i];
          return (
            <span key={i} class={`note-skill ${r ? (r.power >= r.diff ? 'ok' : 'low') : ''}`}>
              <Icon name={SKILL_ICON[c.skill]} size={10} />
            </span>
          );
        })}
      </span>
      {'est' in o ? (
        <span
          class={`note-chance est-${o.est.level}`}
          {...help(
            `Con ${names}: ${RISK_LABELS[o.est.level].toLowerCase()}, ${Math.round(o.est.total * 100)} % de que salga bien.`,
          )}
        >
          {RISK_LABELS[o.est.level]} {Math.round(o.est.total * 100)}%
        </span>
      ) : (
        <span class="note-chance est-none" {...help(o.why)}>
          Sin grupo
        </span>
      )}
    </span>
  );
}

/**
 * Encargos como notas clavadas en el corcho, con lo justo para elegir: tipo, título, lo que pide
 * y cómo saldría con el mejor grupo de casa, peligro, plazas, días de viaje y paga. El cliente,
 * la historia y el detalle de las pruebas están en su ficha.
 */
export function TablonPanel({ game, quests, seeAll, onOpen }: Props) {
  // El grupo sugerido prueba todos los grupos posibles (unos ms por nota): una vez por cambio
  // de quién hay en casa, no en cada vuelta del reloj.
  const key = outlookKey(game);
  const odds = useMemo(
    () => new Map(game.quests.map((q) => [q.id, outlook(game, q.id)] as const)),
    [key],
  );
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
        const o = odds.get(q.id);
        const expires = leftWords(q.expires);
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
              `pide ${listNames(q.challenges.map((c) => c.skill))}`,
              o && 'est' in o
                ? `con tu mejor grupo, ${RISK_LABELS[o.est.level].toLowerCase()}: ${Math.round(o.est.total * 100)} %`
                : o?.why,
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
                <span class={`note-left ${q.expires <= 1 ? 'urgent' : ''}`}>{expires}</span>
              )}
            </span>
            <span class="note-title">{q.title}</span>
            <Outlook q={q} o={o} game={game} />
            <span class="note-foot" aria-hidden="true">
              <span class={`danger danger-${dangerClass(q.danger, hidden)}`}>
                {dangerLabel(q.danger, hidden)}
              </span>
              <span class="note-k" {...help('Días de viaje')}>
                <Icon name="pasos" size={10} />
                {q.days} d
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
