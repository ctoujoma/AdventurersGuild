import { useState } from 'preact/hooks';
import { canHire, roster, salaries } from '../../core/game';
import type { GameState, Hero, Worker } from '../../core/model';
import { canHireWorker, staffBeds, workerCap } from '../../core/workers';
import { TRADES, VILLAGE } from '../../data/workers';
import { JobPicker } from '../JobPicker';
import { moraleBand } from '../../core/party';
import { beds } from '../../core/rooms';
import { CLASS_NAMES, MORALE_INFO, statusLabel } from '../../data/labels';
import { Icon } from '../icons';
import { Portrait } from '../Portrait';
import { TraitChip } from '../TraitChip';
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
    <article class="hero-row card-paper worker-row">
      <Portrait look={workerLook(w)} scale={2} label={w.name} alive={false} />
      <div class="hero-info">
        <b>
          {w.name} {w.village && <span class="nick">{VILLAGE[w.village].role}</span>}
        </b>
        <span class="muted">
          {TRADES[w.trade].name[w.sex]} · Maña {w.skill} · {w.salary}/sem
        </span>
        {seeker ? (
          <span class="tiny">«{w.quote}»</span>
        ) : (
          <JobPicker
            game={game}
            who={w.id}
            current={w.room}
            onAssign={(room) => onAssign(w.id, room)}
          />
        )}
      </div>
      <div class="hero-side">
        {seeker ? (
          <button
            class="btn btn-gold"
            disabled={!!why}
            title={why ?? `Prima: ${w.fee}`}
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
          <button class="btn btn-wood" onClick={() => setSure(true)}>
            Despedir
          </button>
        )}
      </div>
    </article>
  );
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

  const row = (h: Hero, candidate: boolean) => {
    const why = candidate ? canHire(game, h.id) : null;
    return (
      <article key={h.id} class="hero-row card-paper" onClick={() => onOpen(h.id)}>
        <Portrait look={lookOf(h)} marks={marksOf(h)} scale={2} label={h.name} alive={false} />
        <div class="hero-info">
          <b>
            {h.name} {h.nick && <span class="nick">{h.nick}</span>}
          </b>
          <span class="muted">
            {CLASS_NAMES[h.cls][h.sex]} · nivel {h.lvl} · {h.salary}/sem
          </span>
          <div class="chips">
            {h.traits.map((t) => (
              <TraitChip key={t.id} trait={t} sex={h.sex} />
            ))}
          </div>
        </div>
        <div class="hero-side">
          <span class={`pill pill-${candidate ? 'candidato' : h.status}`}>
            {statusLabel(h, candidate)}
          </span>
          {!candidate && h.guard && <span class="pill pill-guard">De guardia</span>}
          {!candidate && h.request && (
            <span class="pill pill-request">
              {h.request === 'cache' ? 'Pide caché' : 'Pide aumento'}
            </span>
          )}
          {!candidate &&
            !h.request &&
            h.status !== 'muerto' &&
            moraleBand(h.morale) !== 'normal' && (
              <span class={`pill pill-${moraleBand(h.morale)}`}>
                {MORALE_INFO[moraleBand(h.morale)].label[h.sex].replace('.', '')}
              </span>
            )}
          {candidate && (
            <button
              class="btn btn-gold"
              disabled={!!why}
              title={why ?? `Prima de fichaje: ${h.fee}`}
              onClick={(e) => {
                e.stopPropagation();
                onHire(h.id);
              }}
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
      <div class="segmented segmented-3" role="tablist">
        <button role="tab" aria-selected={filter === 'todos'} onClick={() => setFilter('todos')}>
          Tus héroes · {roster(game).length}/{cap}
        </button>
        <button
          role="tab"
          aria-selected={filter === 'candidatos'}
          onClick={() => setFilter('candidatos')}
        >
          En la barra · {cands.length}
        </button>
        <button
          role="tab"
          aria-selected={filter === 'trabajadores'}
          onClick={() => setFilter('trabajadores')}
        >
          Trabajo · {game.workers.length}/{workerCap(game)}
        </button>
      </div>
      {filter === 'trabajadores' ? (
        <>
          <p class="panel-note">
            {staffBeds(game.building) > 0
              ? `Duermen en el dormitorio del servicio (${staffBeds(game.building)} ${staffBeds(game.building) === 1 ? 'cama' : 'camas'}); quien no tiene cama, en el pueblo.`
              : game.mode === 'libre'
                ? 'Para tener más de tres, construye el dormitorio del servicio: una cama para cada uno.'
                : 'Vienen cada mañana del pueblo y vuelven a dormir a su casa.'}{' '}
            En su oficio rinden la mitad más.
          </p>
          <div class="list">
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
          <div class="list">
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
          <p class="panel-note">
            Salarios: {salaries(game)} monedas por semana. Se pagan con la deuda.
          </p>
          <div class="list">{mine.map((h) => row(h, false))}</div>
          {!mine.length && <p class="panel-note">No te queda nadie. Contrata en la barra.</p>}
        </>
      ) : (
        <>
          <p class="panel-note">
            Cada candidato esconde un rasgo (¿?) que se descubre tras su primera misión.
          </p>
          <div class="list">{cands.map((h) => row(h, true))}</div>
          {!cands.length && <p class="panel-note">Hoy no hay nadie buscando trabajo.</p>}
        </>
      )}
    </>
  );
}
