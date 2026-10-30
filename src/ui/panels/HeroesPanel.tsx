import { canHire, roster, salaries } from '../../core/game';
import type { GameState, Hero } from '../../core/model';
import type { Task } from '../drop';
import { crewAlerts } from '../crew';
import { CrewList } from './CrewList';
import { moraleBand } from '../../core/party';
import { beds } from '../../core/rooms';
import { CLASS_NAMES, MORALE_INFO, statusLabel } from '../../data/labels';
import { help } from '../HoldHelp';
import { Icon } from '../icons';
import { Portrait } from '../Portrait';
import { Tabs } from '../Tabs';
import { lookOf, marksOf } from '../view';

export type HeroFilter = 'todos' | 'candidatos' | 'trabajadores';

interface Props {
  game: GameState;
  filter: HeroFilter;
  setFilter: (f: HeroFilter) => void;
  onOpen: (id: string) => void;
  onHire: (id: string) => void;
  onHireWorker: (id: string) => void;
  onFireWorker: (id: string) => void;
  onTask: (who: string, task: Task) => void;
}

/** Lo que más importa de un héroe, en una chapa: si pide algo, su ánimo o si está de guardia. */
function heroFlag(h: Hero): { text: string; cls: string } | null {
  if (h.request)
    return { text: h.request === 'cache' ? 'Pide caché' : 'Pide aumento', cls: 'request' };
  if (h.guard) return { text: 'Guardia', cls: 'guard' };
  const band = moraleBand(h.morale);
  if (h.status !== 'muerto' && band !== 'normal')
    return { text: MORALE_INFO[band].label[h.sex].replace('.', ''), cls: band };
  return null;
}

/** Plantilla del gremio, candidatos que esperan en la barra y trabajadores de la casa. */
export function HeroesPanel({
  game,
  filter,
  setFilter,
  onOpen,
  onHire,
  onHireWorker,
  onFireWorker,
  onTask,
}: Props) {
  const mine = game.heroes.filter((h) => h.status !== 'muerto');
  const cands = game.candidates;
  const cap = beds(game.building);

  const row = (h: Hero, candidate: boolean) => {
    const why = candidate ? canHire(game, h.id) : null;
    const flag = candidate ? null : heroFlag(h);
    return (
      <article key={h.id} class="row">
        <button
          class="row-main"
          aria-label={`${h.name}, ${CLASS_NAMES[h.cls][h.sex]} de nivel ${h.lvl}. ${statusLabel(h, candidate)}${flag ? `. ${flag.text}` : ''}. Ver ficha`}
          onClick={() => onOpen(h.id)}
        >
          <Portrait look={lookOf(h)} marks={marksOf(h)} scale={1} alive={false} />
          <span class="row-info" aria-hidden="true">
            <b>
              {h.name} {h.nick && <span class="nick">{h.nick}</span>}
            </b>
            <span class="row-sub">
              {CLASS_NAMES[h.cls][h.sex]} · {h.lvl} · <Icon name="coin" size={10} />
              {h.salary}/sem
            </span>
          </span>
        </button>
        <div class="row-side">
          {!candidate && (
            <span class={`pill pill-${h.status}`} aria-hidden="true">
              {statusLabel(h)}
            </span>
          )}
          {flag && (
            <span class={`pill pill-${flag.cls}`} aria-hidden="true">
              {flag.text}
            </span>
          )}
          {candidate && (
            <button
              class="btn btn-gold"
              disabled={!!why}
              title={why ?? `Prima de fichaje: ${h.fee}`}
              aria-label={`Contratar a ${h.name} por ${h.fee} monedas`}
              onClick={() => onHire(h.id)}
            >
              <Icon name="coin" size={12} /> {h.fee}
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <>
      <Tabs
        label="Héroes"
        value={filter}
        onChange={setFilter}
        tabs={[
          {
            id: 'todos',
            label: 'Héroes',
            icon: 'heroe',
            count: `${roster(game).length}/${cap}`,
            help: 'Tus héroes. Quien está fuera o herido también ocupa cama.',
          },
          {
            id: 'candidatos',
            label: 'Barra',
            icon: 'jarra',
            count: cands.length,
            help: 'Buscan trabajo en la barra. Cada uno esconde un rasgo (¿?) que se sabe tras su primera misión.',
          },
          {
            id: 'trabajadores',
            label: 'Tareas',
            icon: 'martillo',
            alert: crewAlerts(game).length,
            help: 'Quién hace qué en la casa: dónde trabaja cada uno, quién entrena, la guardia y quién descansa. Toca a alguien para cambiarle la tarea.',
          },
        ]}
      />
      {filter === 'trabajadores' ? (
        <CrewList
          game={game}
          onOpen={onOpen}
          onTask={onTask}
          onHire={onHireWorker}
          onFire={onFireWorker}
        />
      ) : filter === 'todos' ? (
        <>
          <div class="rows">{mine.map((h) => row(h, false))}</div>
          {!mine.length && <p class="panel-note">No te queda nadie. Contrata en la barra.</p>}
          {mine.length > 0 && (
            <p class="row-foot" {...help('Los salarios se pagan cada semana, con la deuda.')}>
              <Icon name="coin" size={10} /> Salarios: {salaries(game)} por semana
            </p>
          )}
        </>
      ) : (
        <>
          <div class="rows">{cands.map((h) => row(h, true))}</div>
          {!cands.length && <p class="panel-note">Hoy no hay nadie buscando trabajo.</p>}
        </>
      )}
    </>
  );
}
