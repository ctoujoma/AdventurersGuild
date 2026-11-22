import { strangerLook } from '../art/heroes/look';
import { VEIL_BED, VEIL_CAP, VEIL_DAYS } from '../core/balance';
import type { GameState } from '../core/model';
import { fallenHeroes, priceFor, reviveIssue } from '../core/stranger';
import { CLASS_NAMES } from '../data/labels';
import { TRAIT_INFO } from '../data/traits';
import { Icon, type IconName } from './icons';
import { Portrait } from './Portrait';
import { heroFrame, lookOf, marksOf } from './view';
import { t } from '../textos';

interface Props {
  game: GameState;
  /** Traer de vuelta a ese caído, o (null) decirle que se vaya. */
  onAnswer: (heroId: string | null) => void;
  onClose: () => void;
}

/** Lo que pide, con lo que hay: en rojo lo que no llega. */
function Cost({
  icon,
  need,
  have,
  label,
}: {
  icon: IconName;
  need: number;
  have: number;
  label: 'monedas' | 'raciones' | 'jarras' | 'tela';
}) {
  return (
    <span
      class={`stranger-cost ${have < need ? 'short' : ''}`}
      aria-label={t(`barra.strangercard.coste.${label}`, { n: need })}
    >
      <Icon name={icon} size={12} />
      {need}
    </span>
  );
}

/** El forastero de la tormenta: su oferta, caído a caído, con el precio y la secuela. */
export function StrangerCard({ game, onAnswer, onClose }: Props) {
  const fallen = fallenHeroes(game);
  const veil = TRAIT_INFO.velo;
  return (
    <div class="card-backdrop" onClick={onClose}>
      <article
        class="herocard eventcard strangercard"
        role="dialog"
        aria-label={t('barra.strangercard.el_forastero_de_la')}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          class="btn-icon herocard-x"
          aria-label={t('barra.strangercard.pensarlo')}
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <div class="herocard-top">
            <Portrait
              look={strangerLook()}
              scale={2}
              label={t('barra.strangercard.el_forastero')}
              frame="frame-stranger"
            />
            <div class="herocard-id">
              <span class="eyebrow">{t('barra.strangercard.noche_de_tormenta')}</span>
              <h3>{t('barra.strangercard.el_forastero')}</h3>
              <span class="row-sub">{t('barra.strangercard.junto_al_fuego_se')}</span>
            </div>
          </div>
          <p class="event-text">{t('barra.strangercard.no_ha_pedido_cena')}</p>
          <p class="stranger-quote">{t('barra.strangercard.el_velo_es_fino')}</p>
          <div class="stranger-list">
            {fallen.map((h) => {
              const p = priceFor(h);
              const why = reviveIssue(game, h.id);
              return (
                <div class="stranger-row" key={h.id}>
                  <Portrait
                    look={lookOf(h)}
                    marks={marksOf(h)}
                    scale={1}
                    alive={false}
                    frame={heroFrame(h)}
                  />
                  <div class="stranger-who">
                    <b>{h.name}</b>
                    <span class="row-sub">
                      {t('barra.strangercard.nivel', {
                        clase: CLASS_NAMES[h.cls][h.sex],
                        nivel: h.lvl,
                      })}
                    </span>
                    <span class="stranger-costs">
                      <Cost icon="coin" need={p.gold} have={game.gold} label="monedas" />
                      <Cost icon="pan" need={p.food} have={game.food} label="raciones" />
                      <Cost icon="jarra" need={p.beer} have={game.beer} label="jarras" />
                      <Cost
                        icon="tela"
                        need={p.mats.tela ?? 0}
                        have={game.mats?.tela ?? 0}
                        label="tela"
                      />
                    </span>
                    {why && <span class="row-sub room-bad">{why}</span>}
                  </div>
                  <button class="btn btn-gold" disabled={!!why} onClick={() => onAnswer(h.id)}>
                    {t('barra.strangercard.traer')}
                  </button>
                </div>
              );
            })}
          </div>
          <p class="row-sub stranger-cost-note">
            {t('barra.strangercard.vuelve_en_cama_dias', {
              veil_bed: VEIL_BED,
              veil_days: VEIL_DAYS,
              veil_cap: VEIL_CAP,
            })}{' '}
            <b>{veil.m}</b> ({veil.desc.replace(/^Secuela: [^.]*\. /, '').replace(/\.$/, '')}).
          </p>
          <div class="herocard-actions stranger-actions">
            <button class="btn btn-wood" onClick={onClose}>
              {t('barra.strangercard.pensarlo')}
            </button>
            <button class="btn btn-wood" onClick={() => onAnswer(null)}>
              {t('barra.strangercard.que_se_vaya')}
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
