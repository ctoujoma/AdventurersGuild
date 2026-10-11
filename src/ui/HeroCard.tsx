import { CLASS_NAMES, STATUS_LABEL, lookOf, type DemoHero } from '../data/demo';
import { Icon } from './icons';
import { Portrait } from './Portrait';
import { TraitChip } from './TraitChip';

interface Props {
  hero: DemoHero;
  gold: number;
  onClose: () => void;
  onHire: () => void;
  onLocate: () => void;
  onCycle: () => void;
}

/** Ficha emergente de un héroe con su retrato. */
export function HeroCard({ hero, gold, onClose, onHire, onLocate, onCycle }: Props) {
  const candidate = hero.status === 'candidato';
  return (
    <div class="card-backdrop" onClick={onClose}>
      <article
        class="herocard"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Ficha de ${hero.name}`}
      >
        <button class="btn-icon herocard-x" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
        <div class="herocard-top">
          <Portrait
            look={lookOf(hero)}
            marks={{ injured: hero.status === 'herido', eyepatch: hero.eyepatch }}
            scale={3}
            label={`Retrato de ${hero.name}`}
          />
          <div class="herocard-id">
            <h3>{hero.name}</h3>
            {hero.nick && <span class="nick">{hero.nick}</span>}
            <span class="muted">
              {CLASS_NAMES[hero.cls][hero.sex]} · nivel {hero.lvl}
            </span>
            <span class={`pill pill-${hero.status}`}>
              {STATUS_LABEL[hero.status]}
              {hero.days ? ` · ${hero.days} d` : ''}
            </span>
          </div>
        </div>
        {hero.quote && <p class="quote">{hero.quote}</p>}
        <div class="chips">
          {hero.traits.map((t) => (
            <TraitChip key={t.id} trait={t} sex={hero.sex} />
          ))}
        </div>
        <div class="herocard-actions">
          {candidate ? (
            <button class="btn btn-gold" disabled={gold < (hero.fee ?? 0)} onClick={onHire}>
              <Icon name="coin" size={14} /> Contratar · {hero.fee}
            </button>
          ) : (
            <button class="btn btn-wood" onClick={onCycle}>
              Cambiar estado
            </button>
          )}
          <button class="btn btn-wood" onClick={onLocate}>
            Ver en la taberna
          </button>
        </div>
        <p class="tiny">Salario {hero.salary}/semana</p>
      </article>
    </div>
  );
}
