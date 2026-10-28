import { useState } from 'preact/hooks';
import { canHire, roster, salaries } from '../../core/game';
import type { GameState, Hero, Worker } from '../../core/model';
import { canHireWorker, staffBeds, workerCap } from '../../core/workers';
import { TRADES, VILLAGE } from '../../data/workers';
import { JobPicker } from '../JobPicker';
import { moraleBand } from '../../core/party';
import { beds } from '../../core/rooms';
import { CLASS_NAMES, MORALE_INFO, statusLabel } from '../../data/labels';
import { help } from '../HoldHelp';
import { Icon } from '../icons';
import { Portrait } from '../Portrait';
import { Tabs } from '../Tabs';
import { lookOf, marksOf, workerLook } from '../view';

export type HeroFilter = 'todos' | 'candidatos' | 'trabajadores';

interface Props {
  game: GameState;
  filter: HeroFilter;
  setFilter: (f: HeroFilter) => void;
  onOpen: (id: string) => void;
  onHire: (id: string) => void;
  onHireWorker: (id: string) => void;
  onFireWorker: (id: string) => void;
  onAssign: (who: string, room: string | null) => void;
}

/** Quien trabaja en la taberna o viene a pedir trabajo. */
function WorkerRow({
  game,
  w,
  seeker,
  onHire,
  onFire,
  onAssign,
}: {
  game: GameState;
  w: Worker;
  seeker: boolean;
  onHire: (id: string) => void;
  onFire: (id: string) => void;
  onAssign: (who: string, room: string | null) => void;
}) {
  const [sure, setSure] = useState(false);
  const why = seeker ? canHireWorker(game, w.id) : null;
  return (
    <article class="row" {...(seeker ? help(`«${w.quote}»`) : {})}>
      <Portrait look={workerLook(w)} scale={1} label={w.name} alive={false} />
      <div class="row-info">
        <b>
          {w.name} {w.village && <span class="nick">{VILLAGE[w.village].role}</span>}
        </b>
        <span class="row-sub">
          {TRADES[w.trade].name[w.sex]} · Maña {w.skill} · <Icon name="coin" size={10} />
          {w.salary}/sem
        </span>
        {!seeker && (
          <JobPicker
            game={game}
            who={w.id}
            current={w.room}
            onAssign={(room) => onAssign(w.id, room)}
          />
        )}
      </div>
      <div class="row-side">
        {seeker ? (
          <button
            class="btn btn-gold"
            disabled={!!why}
            title={why ?? `Prima: ${w.fee}`}
            aria-label={`Contratar a ${w.name} por ${w.fee} monedas`}
            onClick={() => onHire(w.id)}
          >
            <Icon name="coin" size={12} /> {w.fee}
          </button>
        ) : sure ? (
          <>
            <button class="btn btn-red" onClick={() => onFire(w.id)}>
              Despedir
            </button>
            <button class="btn btn-wood" onClick={() => setSure(false)}>
              No
            </button>
          </>
        ) : (
          <button
            class="btn-icon"
            aria-label={`Despedir a ${w.name}`}
            {...help(`Despedir a ${w.name}`)}
            onClick={() => setSure(true)}
          >
            <Icon name="papelera" size={16} />
          </button>
        )}
      </div>
    </article>
  );
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
  onAssign,
}: Props) {
  const mine = game.heroes.filter((h) => h.status !== 'muerto');
  const cands = game.candidates;
  const cap = beds(game.building);
  const staff = staffBeds(game.building);

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
            label: 'Trabajo',
            icon: 'martillo',
            count: `${game.workers.length}/${workerCap(game)}`,
            help:
              (staff > 0
                ? `Duermen en el dormitorio del servicio (${staff} ${staff === 1 ? 'cama' : 'camas'}); quien no tiene cama, en el pueblo.`
                : game.mode === 'libre'
                  ? 'Para tener más de tres, construye el dormitorio del servicio: una cama para cada uno.'
                  : 'Vienen cada mañana del pueblo y vuelven a dormir a su casa.') +
              ' En su oficio rinden la mitad más.',
          },
        ]}
      />
      {filter === 'trabajadores' ? (
        <>
          <div class="rows">
            {game.workers.map((w) => (
              <WorkerRow
                key={w.id}
                game={game}
                w={w}
                seeker={false}
                onHire={onHireWorker}
                onFire={onFireWorker}
                onAssign={onAssign}
              />
            ))}
          </div>
          {!game.workers.length && <p class="panel-note">No trabaja nadie en la taberna.</p>}
          <h3 class="sec-title">Piden trabajo</h3>
          <div class="rows">
            {game.seekers.map((w) => (
              <WorkerRow
                key={w.id}
                game={game}
                w={w}
                seeker
                onHire={onHireWorker}
                onFire={onFireWorker}
                onAssign={onAssign}
              />
            ))}
          </div>
          {!game.seekers.length && (
            <p class="panel-note">
              {game.mode === 'libre'
                ? 'Hoy no ha venido nadie a pedir trabajo.'
                : 'Cuando el gremio sea tuyo, vendrá gente del pueblo a pedir trabajo.'}
            </p>
          )}
        </>
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
