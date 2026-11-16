import { strangerLook } from '../art/heroes/look';
import { VEIL_BED, VEIL_CAP, VEIL_DAYS } from '../core/balance';
import type { GameState } from '../core/model';
import { fallenHeroes, priceFor, reviveIssue } from '../core/stranger';
import { CLASS_NAMES } from '../data/labels';
import { TRAIT_INFO } from '../data/traits';
import { Icon, type IconName } from './icons';
import { Portrait } from './Portrait';
import { heroFrame, lookOf, marksOf } from './view';

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
  label: string;
}) {
  return (
    <span class={`stranger-cost ${have < need ? 'short' : ''}`} aria-label={`${need} ${label}`}>
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
        aria-label="El forastero de la tormenta"
        onClick={(e) => e.stopPropagation()}
      >
        <button class="btn-icon herocard-x" aria-label="Pensarlo" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <div class="herocard-top">
            <Portrait look={strangerLook()} scale={2} label="El forastero" frame="frame-stranger" />
            <div class="herocard-id">
              <span class="eyebrow">Noche de tormenta</span>
              <h3>El forastero</h3>
              <span class="row-sub">Junto al fuego · se irá mañana a mediodía</span>
            </div>
          </div>
          <p class="event-text">
            No ha pedido cena ni cama. Se sacude la lluvia, mira el Muro de los caídos y dice tus
            nombres sin que nadie se los haya dicho.
          </p>
          <p class="stranger-quote">
            «El velo es fino en noches así. Puedo traer de vuelta a uno de los vuestros. No sale
            gratis, y no vuelve entero.»
          </p>
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
                      {CLASS_NAMES[h.cls][h.sex]} · nivel {h.lvl}
                    </span>
                    <span class="stranger-costs">
                      <Cost icon="coin" need={p.gold} have={game.gold} label="monedas" />
                      <Cost icon="pan" need={p.food} have={game.food} label="raciones" />
                      <Cost icon="jarra" need={p.beer} have={game.beer} label="jarras" />
                      <Cost
                        icon="tela"
                        need={p.mats.tela ?? 0}
                        have={game.mats?.tela ?? 0}
                        label="de tela"
                      />
                    </span>
                    {why && <span class="row-sub room-bad">{why}</span>}
                  </div>
                  <button class="btn btn-gold" disabled={!!why} onClick={() => onAnswer(h.id)}>
                    Traer
                  </button>
                </div>
              );
            })}
          </div>
          <p class="row-sub stranger-cost-note">
            Vuelve en cama {VEIL_BED} días, sin ánimo ({VEIL_DAYS} días con la moral −{VEIL_CAP} de
            tope) y con un rasgo para siempre: <b>{veil.m}</b> (
            {veil.desc.replace(/^Secuela: [^.]*\. /, '').replace(/\.$/, '')}).
          </p>
          <div class="herocard-actions stranger-actions">
            <button class="btn btn-wood" onClick={onClose}>
              Pensarlo
            </button>
            <button class="btn btn-wood" onClick={() => onAnswer(null)}>
              Que se vaya
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
