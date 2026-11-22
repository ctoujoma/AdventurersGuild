import type { ComponentChildren } from 'preact';
import { canHire, roster, salaries } from '../../core/game';
import type { GameState, Hero } from '../../core/model';
import type { Task } from '../drop';
import { CrewList, SeekerList } from './CrewList';
import { crewAlerts, taskLabel } from '../crew';
import { moraleBand } from '../../core/party';
import { beds } from '../../core/rooms';
import { CLASS_NAMES, MORALE_INFO, statusLabel } from '../../data/labels';
import { help } from '../HoldHelp';
import { gearHintText, upgradesFor } from '../gearHint';
import { Icon } from '../icons';
import { Portrait } from '../Portrait';
import { Tabs } from '../Tabs';
import { lookOf, marksOf, heroFrame } from '../view';
import { t, tx } from '../../textos';

export type HeroFilter = 'todos' | 'candidatos' | 'trabajadores' | 'equipo';

interface Props {
  game: GameState;
  filter: HeroFilter;
  setFilter: (f: HeroFilter) => void;
  onOpen: (id: string) => void;
  onHire: (id: string) => void;
  onHireWorker: (id: string) => void;
  onFireWorker: (id: string) => void;
  onTask: (who: string, task: Task) => void;
  /** En Tareas, a quién elegir al abrir. */
  focus?: string | null;
  /** La pestaña Equipo: el arcón (lo monta `App`, con sus acciones). */
  equipo: ComponentChildren;
}

/** Lo que más importa de un héroe, en una chapa: si pide algo, su ánimo o si está de guardia. */
function heroFlag(h: Hero): { text: string; cls: string } | null {
  if (h.request)
    return {
      text:
        h.request === 'cache' ? t('paneles.heroes.pide_cache') : t('paneles.heroes.pide_aumento'),
      cls: 'request',
    };
  const band = moraleBand(h.morale);
  if (h.status !== 'muerto' && band !== 'normal')
    return { text: MORALE_INFO[band].label[h.sex].replace('.', ''), cls: band };
  return null;
}

/**
 * Plantilla del gremio, candidatos que esperan en la barra, trabajadores de la casa y el equipo
 * (el arcón: el equipo es de los héroes).
 */
export function HeroesPanel({
  game,
  filter,
  setFilter,
  onOpen,
  onHire,
  onHireWorker,
  onFireWorker,
  onTask,
  focus,
  equipo,
}: Props) {
  const mine = game.heroes.filter((h) => h.status !== 'muerto');
  const cands = game.candidates;
  const cap = beds(game.building);

  const row = (h: Hero, candidate: boolean) => {
    const why = candidate ? canHire(game, h.id) : null;
    const flag = candidate ? null : heroFlag(h);
    // Lo que hace: su tarea si está en casa («Entrena Fuerza»), o su estado si está fuera.
    const doing = candidate ? statusLabel(h, true) : taskLabel(game, h.id);
    const pill = h.status === 'ok' ? (h.guard ? 'guard' : 'ok') : h.status;
    // Equipo olvidado: hay algo mejor en el arcón para alguna de sus ranuras.
    const ups = candidate ? [] : upgradesFor(game, h);
    const gearHint = ups.length ? gearHintText(h.name.split(' ')[0]!, ups) : null;
    return (
      <article key={h.id} class="row">
        <button
          data-tut={`hero-${h.id}`}
          class="row-main"
          aria-label={t('paneles.heroes.de_nivel_ver_ficha', {
            nombre: h.name,
            clase: CLASS_NAMES[h.cls][h.sex],
            nivel: h.lvl,
            doing,
            hay_aviso: !!flag,
            aviso: flag?.text ?? '',
            hay_pista: !!gearHint,
            pista: gearHint ?? '',
          })}
          onClick={() => onOpen(h.id)}
        >
          <Portrait
            look={lookOf(h)}
            marks={marksOf(h)}
            frame={heroFrame(h)}
            scale={1}
            alive={false}
          />
          <span class="row-info" aria-hidden="true">
            <b>
              {h.name} {h.nick && <span class="nick">{tx(h.nick)}</span>}
              {gearHint && (
                <span class="gear-mark" {...help(gearHint)}>
                  <Icon name="cofre" size={10} />
                </span>
              )}
            </b>
            <span class="row-sub">
              {CLASS_NAMES[h.cls][h.sex]} · {h.lvl} · <Icon name="coin" size={10} />
              {t('paneles.heroes.sem', { salary: h.salary })}
            </span>
          </span>
        </button>
        <div class="row-side">
          {!candidate && (
            <span class={`pill pill-${pill}`} aria-hidden="true">
              {doing}
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
              data-tut="contratar"
              disabled={!!why}
              title={why ?? t('paneles.heroes.prima_de_fichaje', { paga: h.fee })}
              aria-label={t('paneles.heroes.contratar_a_por_monedas', {
                nombre: h.name,
                paga: h.fee,
              })}
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
        label={t('paneles.heroes.heroes')}
        value={filter}
        onChange={setFilter}
        tabs={[
          {
            id: 'todos',
            label: t('paneles.heroes.heroes'),
            icon: 'heroe',
            count: roster(game).length,
            help: t('paneles.heroes.tus_heroes_quien_esta'),
          },
          {
            id: 'candidatos',
            label: t('paneles.heroes.barra'),
            icon: 'jarra',
            count: cands.length + game.seekers.length,
            help: t('paneles.heroes.buscan_trabajo_en_la'),
          },
          {
            id: 'trabajadores',
            label: t('paneles.heroes.tareas'),
            icon: 'martillo',
            alert: crewAlerts(game).length,
            help: t('paneles.heroes.quien_hace_que_en'),
          },
          {
            id: 'equipo',
            label: t('paneles.heroes.equipo'),
            icon: 'cofre',
            count: game.inventory.length,
            help: t('paneles.heroes.el_arcon_el_equipo'),
          },
        ]}
      />
      {filter === 'equipo' ? (
        equipo
      ) : filter === 'trabajadores' ? (
        <CrewList game={game} onOpen={onOpen} onTask={onTask} onFire={onFireWorker} focus={focus} />
      ) : filter === 'todos' ? (
        <>
          <div class="rows">{mine.map((h) => row(h, false))}</div>
          {!mine.length && <p class="panel-note">{t('paneles.heroes.no_te_queda_nadie')}</p>}
          {mine.length > 0 && (
            <p class="row-foot" {...help(t('paneles.heroes.los_salarios_se_pagan'))}>
              <Icon name="cama" size={10} />{' '}
              {t('paneles.heroes.de_camas', { length: roster(game).length, cabe: cap })}{' '}
              <Icon name="coin" size={10} />{' '}
              {t('paneles.heroes.salarios_por_semana', { salaries: salaries(game) })}
            </p>
          )}
        </>
      ) : (
        <>
          <section class="crew-group" aria-label={t('paneles.heroes.heroes_que_buscan_gremio')}>
            <h3 class="crew-h">
              <span>{t('paneles.heroes.heroes')}</span>
              <span class="row-sub">
                {t('paneles.heroes.de_camas_2', { length: roster(game).length, cabe: cap })}
              </span>
            </h3>
            <div class="rows">{cands.map((h) => row(h, true))}</div>
            {!cands.length && <p class="panel-note">{t('paneles.heroes.hoy_no_hay_ningun')}</p>}
          </section>
          <SeekerList game={game} onHire={onHireWorker} />
        </>
      )}
    </>
  );
}
