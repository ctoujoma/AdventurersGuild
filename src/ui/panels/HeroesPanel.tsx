import { useMemo, useState } from 'preact/hooks';
import { generateLook, type OutfitId } from '../../art/heroes/look';
import { CLASS_NAMES, STATUS_LABEL, lookOf, type DemoHero } from '../../data/demo';
import { Icon } from '../icons';
import { Portrait } from '../Portrait';
import { TraitChip } from '../TraitChip';

interface Props {
  heroes: DemoHero[];
  filter: 'todos' | 'candidatos';
  setFilter: (f: 'todos' | 'candidatos') => void;
  onOpen: (id: string) => void;
  onHire: (id: string) => void;
  gold: number;
}

const CLASSES: OutfitId[] = ['guerrero', 'picaro', 'mago', 'clerigo', 'explorador'];

export function HeroesPanel({ heroes, filter, setFilter, onOpen, onHire, gold }: Props) {
  const [batch, setBatch] = useState(1);
  const gallery = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) =>
        generateLook(
          `galeria-${batch}-${i}`,
          CLASSES[i % CLASSES.length]!,
          (i + batch) % 2 ? 'f' : 'm',
        ),
      ),
    [batch],
  );
  const mine = heroes.filter((h) => h.status !== 'candidato');
  const cands = heroes.filter((h) => h.status === 'candidato');

  const row = (h: DemoHero) => (
    <article key={h.id} class="hero-row card-paper" onClick={() => onOpen(h.id)}>
      <Portrait
        look={lookOf(h)}
        marks={{ injured: h.status === 'herido', eyepatch: h.eyepatch }}
        scale={2}
        label={h.name}
        alive={false}
      />
      <div class="hero-info">
        <b>
          {h.name} {h.nick && <span class="nick">{h.nick}</span>}
        </b>
        <span class="muted">
          {CLASS_NAMES[h.cls][h.sex]} · nivel {h.lvl}
        </span>
        <div class="chips">
          {h.traits.map((t) => (
            <TraitChip key={t.id} trait={t} sex={h.sex} />
          ))}
        </div>
      </div>
      <div class="hero-side">
        <span class={`pill pill-${h.status}`}>
          {STATUS_LABEL[h.status]}
          {h.days && h.status !== 'ok' ? ` · ${h.days} d` : ''}
        </span>
        {h.status === 'candidato' && (
          <button
            class="btn btn-gold"
            disabled={gold < (h.fee ?? 0)}
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

  return (
    <>
      <div class="segmented" role="tablist">
        <button role="tab" aria-selected={filter === 'todos'} onClick={() => setFilter('todos')}>
          Tus héroes · {mine.length}
        </button>
        <button
          role="tab"
          aria-selected={filter === 'candidatos'}
          onClick={() => setFilter('candidatos')}
        >
          En la barra · {cands.length}
        </button>
      </div>
      <div class="list">{(filter === 'todos' ? mine : cands).map(row)}</div>
      {filter === 'candidatos' && cands.length === 0 && (
        <p class="panel-note">Hoy no hay nadie buscando trabajo.</p>
      )}
      <div class="sec-h">
        <h3>Galería de retratos</h3>
        <button class="btn btn-wood" onClick={() => setBatch((b) => b + 1)}>
          Otra tanda
        </button>
      </div>
      <p class="panel-note">Cada héroe se monta con piezas dibujadas a mano según su semilla.</p>
      <div class="gallery">
        {gallery.map((look, i) => (
          <Portrait key={`${batch}-${i}`} look={look} scale={2} alive={false} />
        ))}
      </div>
    </>
  );
}
