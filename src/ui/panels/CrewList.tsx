import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameState } from '../../core/model';
import { canHireWorker, workerCap } from '../../core/workers';
import { TRADES } from '../../data/workers';
import {
  candidatesFor,
  crewAlerts,
  crewGroups,
  taskOf,
  taskOptions,
  type Group,
  type Member,
} from '../crew';
import type { Task } from '../drop';
import { help } from '../HoldHelp';
import { Icon } from '../icons';
import { Portrait } from '../Portrait';
import { lookOf, marksOf, workerLook } from '../view';

interface Props {
  game: GameState;
  /** Abre la ficha de un héroe. */
  onOpen: (id: string) => void;
  onTask: (who: string, task: Task) => void;
  onHire: (id: string) => void;
  onFire: (id: string) => void;
  /** Alguien a quien elegir al abrir (al tocarlo en la escena). */
  focus?: string | null;
}

/** Del valor de un desplegable a la tarea («» es descansar). */
const toTask = (v: string): Task => v || null;

/** El retrato de alguien de la casa (trabajador, héroe o quien pide trabajo). */
function Face({ game, id }: { game: GameState; id: string }) {
  const w = game.workers.find((x) => x.id === id) ?? game.seekers.find((x) => x.id === id);
  if (w) return <Portrait look={workerLook(w)} scale={1} alive={false} />;
  const h = game.heroes.find((x) => x.id === id);
  return h ? <Portrait look={lookOf(h)} marks={marksOf(h)} scale={1} alive={false} /> : null;
}

/** El desplegable con todo lo que puede hacer alguien (trabajar, entrenar, guardia, descansar). */
export function TaskSelect({
  game,
  who,
  name,
  onTask,
}: {
  game: GameState;
  who: string;
  name: string;
  onTask: (who: string, task: Task) => void;
}) {
  const now = taskOf(game, who);
  return (
    <select
      class="job-select"
      aria-label={`Tarea de ${name}`}
      value={now ?? ''}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onTask(who, toTask((e.target as HTMLSelectElement).value))}
    >
      {taskOptions(game, who).map((o) => (
        <option key={o.task ?? ''} value={o.task ?? ''} disabled={!!o.why} title={o.why}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Lo que se puede hacer con quien está elegido: cambiarle la tarea, ver su ficha o despedirlo. */
function Detail({
  game,
  m,
  onOpen,
  onTask,
  onFire,
}: {
  game: GameState;
  m: Member;
  onOpen: (id: string) => void;
  onTask: (who: string, task: Task) => void;
  onFire?: (id: string) => void;
}) {
  const [sure, setSure] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Al elegir a alguien desde un aviso, la lista baja hasta él.
  useEffect(() => ref.current?.scrollIntoView?.({ block: 'nearest' }), []);
  const home = !m.hero || game.heroes.some((h) => h.id === m.id && h.status === 'ok');
  return (
    <div class="crew-detail" ref={ref}>
      {m.more && <span class="row-sub crew-more">{m.more}</span>}
      {home && <TaskSelect game={game} who={m.id} name={m.name} onTask={onTask} />}
      {m.hero ? (
        <button class="btn btn-wood" onClick={() => onOpen(m.id)}>
          Ficha
        </button>
      ) : !onFire ? null : sure ? (
        <span class="crew-sure">
          <button class="btn btn-red" onClick={() => onFire(m.id)}>
            Despedir
          </button>
          <button class="btn btn-wood" onClick={() => setSure(false)}>
            No
          </button>
        </span>
      ) : (
        <button
          class="btn-icon"
          aria-label={`Despedir a ${m.name}`}
          {...help(`Despedir a ${m.name}`)}
          onClick={() => setSure(true)}
        >
          <Icon name="papelera" size={16} />
        </button>
      )}
    </div>
  );
}

/** Un hueco libre: se elige a quién poner ahí. */
function FreeSlot({
  game,
  task,
  onTask,
}: {
  game: GameState;
  task: Task;
  onTask: (who: string, task: Task) => void;
}) {
  const who = candidatesFor(game, task);
  if (!who.length)
    return (
      <span class="crew-slot crew-free" aria-label="Puesto libre">
        Libre
      </span>
    );
  return (
    <select
      class="crew-slot crew-free"
      value=""
      aria-label="Puesto libre: poner a alguien"
      onChange={(e) => {
        const v = (e.target as HTMLSelectElement).value;
        if (v) onTask(v, task);
      }}
    >
      <option value="">+ Libre</option>
      {who.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name} ({m.sub})
        </option>
      ))}
    </select>
  );
}

/** Un grupo con sus huecos: la gente (tocar para elegir) y los puestos libres. */
export function CrewGroup({
  game,
  g,
  title = g.title,
  sel,
  setSel,
  onOpen,
  onTask,
  onFire,
}: {
  game: GameState;
  g: Group;
  /** Otro título (en la ficha de sala: «Trabajan aquí»). */
  title?: string;
  sel: string | null;
  setSel: (id: string | null) => void;
  onOpen: (id: string) => void;
  onTask: (who: string, task: Task) => void;
  onFire?: (id: string) => void;
}) {
  const chosen = g.people.find((p) => p.id === sel);
  const free = g.slots === undefined ? 0 : Math.max(0, g.slots - g.people.length);
  return (
    <section class="crew-group" aria-label={title}>
      <h3 class="crew-h">
        <span>{title}</span>
        {g.slots !== undefined && (
          <span class="row-sub">
            {g.people.length} de {g.slots}
          </span>
        )}
      </h3>
      {g.note && <span class="row-sub">{g.note}</span>}
      <div class="crew-slots">
        {g.people.map((p) => (
          <button
            key={p.id}
            class={`crew-slot ${p.hero ? 'is-hero' : ''} ${sel === p.id ? 'is-sel' : ''}`}
            aria-expanded={sel === p.id}
            onClick={() => setSel(sel === p.id ? null : p.id)}
          >
            <Face game={game} id={p.id} />
            <span class="crew-who">
              <b>{p.name}</b>
              <small>{p.sub}</small>
              {p.off && <small class="crew-off">No es su oficio</small>}
              {p.gives && <small class="crew-gives">{p.gives}</small>}
              {p.progress !== undefined && (
                <span class="train-bar" aria-label={`${Math.round(p.progress * 100)} %`}>
                  <i style={{ width: `${Math.round(p.progress * 100)}%` }} />
                </span>
              )}
            </span>
          </button>
        ))}
        {Array.from({ length: free }, (_, i) => (
          <FreeSlot key={i} game={game} task={g.task ?? null} onTask={onTask} />
        ))}
      </div>
      {chosen && (
        <Detail
          key={chosen.id}
          game={game}
          m={chosen}
          onOpen={onOpen}
          onTask={onTask}
          onFire={onFire}
        />
      )}
    </section>
  );
}

/**
 * Quién hace qué en la casa: cada sala con sus puestos (ocupados o libres), los que entrenan,
 * la guardia, quien descansa y quien está fuera, con los avisos arriba. Tocar a alguien deja
 * cambiarle la tarea; tocar un hueco libre, elegir a quién poner. Debajo, quien pide trabajo.
 */
export function CrewList({ game, onOpen, onTask, onHire, onFire, focus }: Props) {
  const [sel, setSel] = useState<string | null>(focus ?? null);
  useEffect(() => {
    if (focus) setSel(focus);
  }, [focus]);
  const alerts = crewAlerts(game);
  const groups = crewGroups(game);
  return (
    <>
      {alerts.length > 0 && (
        <ul class="crew-alerts" aria-label="Avisos">
          {alerts.map((a) => (
            <li key={a.text}>
              {a.who ? (
                <button class="crew-alert" onClick={() => setSel(a.who!)}>
                  {a.text}
                </button>
              ) : (
                <span class="crew-alert">{a.text}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {groups.map((g) =>
        !g.people.length && g.slots === undefined ? null : (
          <CrewGroup
            key={g.key}
            game={game}
            g={g}
            sel={sel}
            setSel={setSel}
            onOpen={onOpen}
            onTask={onTask}
            onFire={(id) => {
              setSel(null);
              onFire(id);
            }}
          />
        ),
      )}
      <section class="crew-group" aria-label="Piden trabajo">
        <h3 class="crew-h">
          <span>Piden trabajo</span>
          <span class="row-sub">
            {game.workers.length} de {workerCap(game)} trabajadores
          </span>
        </h3>
        {game.seekers.map((w) => {
          const why = canHireWorker(game, w.id);
          return (
            <article key={w.id} class="row" {...help(`«${w.quote}»`)}>
              <Face game={game} id={w.id} />
              <span class="row-info">
                <b>{w.name}</b>
                <span class="row-sub">
                  {TRADES[w.trade].name[w.sex]} · Maña {w.skill} · <Icon name="coin" size={10} />
                  {w.salary}/sem
                </span>
                {why && <small class="crew-off">{why}</small>}
              </span>
              <button
                class="btn btn-gold"
                disabled={!!why}
                title={why ?? undefined}
                aria-label={`Contratar a ${w.name} por ${w.fee} monedas`}
                onClick={() => onHire(w.id)}
              >
                Contratar · <Icon name="coin" size={12} /> {w.fee}
              </button>
            </article>
          );
        })}
        {!game.seekers.length && (
          <p class="panel-note">
            {game.mode === 'libre'
              ? 'Hoy no ha venido nadie a pedir trabajo.'
              : 'Cuando el gremio sea tuyo, vendrá gente del pueblo a pedir trabajo.'}
          </p>
        )}
      </section>
    </>
  );
}
