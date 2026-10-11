import { capacity } from '../../core/balance';
import { canHire, roster, salaries } from '../../core/game';
import type { GameState, Hero } from '../../core/model';
import { moraleBand } from '../../core/party';
import { CLASS_NAMES, MORALE_INFO, statusLabel } from '../../data/labels';
import { Icon } from '../icons';
import { Portrait } from '../Portrait';
import { TraitChip } from '../TraitChip';
import { lookOf, marksOf } from '../view';

interface Props {
  game: GameState;
  filter: 'todos' | 'candidatos';
  setFilter: (f: 'todos' | 'candidatos') => void;
  onOpen: (id: string) => void;
  onHire: (id: string) => void;
}

/** Plantilla del gremio y candidatos que esperan en la barra. */
export function HeroesPanel({ game, filter, setFilter, onOpen, onHire }: Props) {
  const mine = game.heroes.filter((h) => h.status !== 'muerto');
  const cands = game.candidates;
  const cap = capacity(game.fac.dorm);

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
      <div class="segmented" role="tablist">
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
      </div>
      {filter === 'todos' ? (
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
