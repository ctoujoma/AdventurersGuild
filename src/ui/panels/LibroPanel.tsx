import { chainDef } from '../../core/chains';
import { rewardText, statValue } from '../../core/feats';
import { goalProgress } from '../../core/goals';
import type { ActiveGoal, GameState } from '../../core/model';
import { FEATS } from '../../data/feats';
import type { Records } from '../../platform/records';

interface Props {
  game: GameState;
  records: Records;
}

/** Un objetivo en curso: qué pide, cuánto lleva y qué da. */
export function GoalRow({ game, goal }: { game: GameState; goal: ActiveGoal }) {
  const n = goalProgress(game, goal);
  return (
    <article class="feat">
      <b>{goal.text}</b>
      <span class="track">
        <i style={{ width: `${(n / goal.target) * 100}%` }} />
      </span>
      <small>
        {n}/{goal.target} · {rewardText(goal.reward)}
      </small>
    </article>
  );
}

/** Libro de hazañas: objetivos (y lo cumplido), historias, hazañas por niveles, récords y los caídos. */
export function LibroPanel({ game, records }: Props) {
  const goals = game.goals;
  return (
    <>
      {goals && (
        <section>
          <h3 class="sec-title">Objetivos</h3>
          <div class="rows">
            {goals.active.map((g) => (
              <GoalRow key={g.id} game={game} goal={g} />
            ))}
          </div>
          {goals.log.length > 0 && (
            <details class="set-fold goal-log">
              <summary>Cumplidos · {goals.log.length}</summary>
              <ul>
                {goals.log.map((l, i) => (
                  <li key={i}>
                    <b>Día {l.day}</b> · {l.text} <small>({l.reward})</small>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {(game.chains ?? []).length > 0 && (
        <section>
          <h3 class="sec-title">Historias</h3>
          <div class="rows">
            {(game.chains ?? []).map((cs) => {
              const def = chainDef(cs.id);
              const n = cs.status === 'hecha' ? def.steps.length : cs.step;
              return (
                <article key={cs.id} class={`feat ${cs.status === 'hecha' ? 'done' : ''}`}>
                  <div class="feat-head">
                    <b>{def.name}</b>
                    <span class="pips">
                      {def.steps.map((_, i) => (
                        <i key={i} class={i < n ? 'on' : ''} />
                      ))}
                    </span>
                  </div>
                  <small>
                    {def.client} ·{' '}
                    {cs.status === 'hecha'
                      ? 'Cumplida'
                      : `En el tablón: «${def.steps[cs.step]!.title}»${cs.twists ? ` (se ha torcido ${cs.twists} ${cs.twists === 1 ? 'vez' : 'veces'})` : ''}`}
                  </small>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h3 class="sec-title">Hazañas</h3>
        <div class="rows">
          {FEATS.map((f) => {
            const got = game.feats?.[f.id] ?? 0;
            const v = statValue(game, f.stat);
            const next = f.tiers[got];
            const prev = got ? f.tiers[got - 1]! : 0;
            return (
              <article key={f.id} class={`feat ${next === undefined ? 'done' : ''}`}>
                <div class="feat-head">
                  <b>{f.name}</b>
                  <span class="pips" aria-label={`Nivel ${got} de ${f.tiers.length}`}>
                    {f.tiers.map((_, i) => (
                      <i key={i} class={i < got ? 'on' : ''} />
                    ))}
                  </span>
                </div>
                {next !== undefined ? (
                  <>
                    <span class="track">
                      <i style={{ width: `${((v - prev) / (next - prev)) * 100}%` }} />
                    </span>
                    <small>
                      {f.text.replace('{n}', String(next))} · {Math.min(v, next)}/{next} · Premio:{' '}
                      {rewardText(f.rewards[got]!)}
                    </small>
                  </>
                ) : (
                  <small>Completada: {f.text.replace('{n}', String(f.tiers.at(-1)))}.</small>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h3 class="sec-title">Récords</h3>
        <div class="records">
          <span>
            Mejor llegada a la apertura <b>{records.bestArrival?.score ?? '—'}</b>
          </span>
          <span>
            Más días al frente <b>{records.maxDays || '—'}</b>
          </span>
          <span>
            Más oro en la caja <b>{records.maxGold || '—'}</b>
          </span>
          <span>
            Más trofeos <b>{records.maxTrophies || '—'}</b>
          </span>
        </div>
      </section>

      {game.fallen.length > 0 && (
        <section>
          <h3 class="sec-title">Muro de los caídos</h3>
          <div class="rows">
            {game.fallen.map((f, i) => (
              <div key={i} class="fallen">
                <b>{f.name}</b>
                <span>{f.epitaph}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
