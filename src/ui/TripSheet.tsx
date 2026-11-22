import { chainDef } from '../core/chains';
import { eventText, journeyNow, LEGS, type JourneyNow } from '../core/journey';
import type { GameState, Mission } from '../core/model';
import { dangerClass, dangerLabel, questTypeName } from '../data/labels';
import { Icon, type IconName } from './icons';
import { Portrait } from './Portrait';
import { QuestStrip } from './QuestStrip';
import { lookOf, marksOf, heroFrame } from './view';
import { dawnIn } from './when';
import { t, tx } from '../textos';
import { placeName } from '../data/places';

interface Props {
  game: GameState;
  mission: Mission;
  onClose: () => void;
  onHero: (id: string) => void;
  /** Abre el informe, cuando ya ha llegado. */
  onReport: (id: string) => void;
  /** Ante el jefe: verla (`true`) o que se las apañen. */
  onBoss: (watch: boolean) => void;
}

const KIND_ICON: Record<JourneyNow['past'][number]['kind'], IconName> = {
  camino: 'pasos',
  llegada: 'banderin',
  faena: 'diana',
  pelea: 'espadas',
  jefe: 'calavera',
  aviso: 'letter',
  noche: 'moon',
  vuelta: 'home',
};

/** Ficha «Encargo en curso»: la tira, el encargo, quién va, el viaje por partes y su diario. */
export function TripSheet({ game, mission: m, onClose, onHero, onReport, onBoss }: Props) {
  const now = journeyNow(game, m);
  const q = m.quest;
  const heroes = m.heroIds.map((id) => game.heroes.find((h) => h.id === id)).filter((h) => !!h);
  const legIndex = LEGS.findIndex((l) => l.id === now.leg);
  return (
    <div class="card-backdrop as-sheet" onClick={onClose}>
      <article
        class="herocard questsheet tripsheet"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('paneles.tripsheet.encargo_en_curso', { titulo: tx(q.title) })}
      >
        <button
          class="btn-icon herocard-x"
          data-tut="cerrar"
          aria-label={t('paneles.tripsheet.cerrar')}
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <QuestStrip now={now} />
          <header class="qs-head">
            <span class="eyebrow">
              {q.chain
                ? t('paneles.tripsheet.paso_de', {
                    nombre: tx(chainDef(q.chain.id).name),
                    paso: q.chain.step + 1,
                    pasos: chainDef(q.chain.id).steps.length,
                  })
                : t('paneles.tripsheet.encargo_en_curso_2', { tipo: questTypeName(q.type) })}
            </span>
            <h3>{tx(q.title)}</h3>
          </header>
          <div class="chips qs-facts">
            <span class="fact">
              <Icon name="pasos" size={12} />
              {placeName(q.place)}
            </span>
            <span class="fact">
              <Icon name="home" size={12} />
              {t('paneles.tripsheet.en_casa', { dawn_in: dawnIn(m.daysLeft) })}
            </span>
            <span class={`danger danger-${dangerClass(q.danger, false)}`}>
              {t('paneles.tripsheet.peligro', { danger_label: dangerLabel(q.danger, false) })}
            </span>
          </div>

          <div class="trip-crew">
            {heroes.map((h) => (
              <button
                key={h.id}
                class="pick"
                aria-label={t('paneles.tripsheet.ver_su_ficha', { nombre: h.name })}
                onClick={() => onHero(h.id)}
              >
                <Portrait
                  look={lookOf(h)}
                  marks={marksOf(h)}
                  frame={heroFrame(h)}
                  scale={1}
                  alive={false}
                />
                <span class="pick-name">{h.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          <ol class="trip-legs" aria-label={t('paneles.tripsheet.el_viaje_por_partes')}>
            {LEGS.map((l, i) => {
              const fill = i < legIndex ? 1 : i === legIndex ? now.legT : 0;
              return (
                <li
                  key={l.id}
                  class={`trip-leg ${i < legIndex ? 'is-done' : ''} ${i === legIndex ? 'is-now' : ''}`}
                  style={{ flex: l.to - l.from }}
                  aria-current={i === legIndex ? 'step' : undefined}
                >
                  <span class="trip-leg-bar" aria-hidden="true">
                    <i style={{ width: `${Math.round(fill * 100)}%` }} />
                  </span>
                  <span class="trip-leg-name">{l.name}</span>
                </li>
              );
            })}
          </ol>

          <h4 class="crew-h">
            <span>{t('paneles.tripsheet.lo_que_ha_pasado')}</span>
          </h4>
          {now.past.length ? (
            <ul class="trip-log">
              {[...now.past].reverse().map((e, i) => (
                <li key={`${e.t}-${i}`} class={`trip-ev trip-ev-${e.kind}`}>
                  <Icon name={KIND_ICON[e.kind]} size={12} />
                  <span>{eventText(game, e)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="tiny">{t('paneles.tripsheet.acaban_de_salir_por')}</p>
          )}
          {m.waiting && (
            <div class="trip-boss" role="status">
              <b>{t('paneles.tripsheet.estan_ante_el_jefe')}</b>
              <div class="trip-boss-actions">
                <button class="btn btn-gold" onClick={() => onBoss(true)}>
                  {t('paneles.tripsheet.ver_la_pelea')}
                </button>
                <button class="btn btn-wood" onClick={() => onBoss(false)}>
                  {t('paneles.tripsheet.que_se_las_apanen')}
                </button>
              </div>
              <span class="tiny">{t('paneles.tripsheet.si_no_dices_nada')}</span>
            </div>
          )}
          {m.done ? (
            <button class="btn btn-wood trip-note" onClick={() => onReport(m.done!.report)}>
              <Icon name="letter" size={14} /> {t('paneles.tripsheet.leer_el_informe')}
            </button>
          ) : (
            <p class="tiny trip-note">{t('paneles.tripsheet.cuando_acaben_lo_suyo')}</p>
          )}
        </div>
      </article>
    </div>
  );
}
