import { useMemo, useState } from 'preact/hooks';
import { generateLook, renderHero, type Sex } from '../../art/heroes/hero';
import type { SceneHero } from '../../art/tavern/scene';
import { CLASS_NAMES, STATUS_LABEL, type DemoHero } from '../../data/demo';
import { PixelSprite } from '../PixelSprite';

interface Props {
  heroes: DemoHero[];
  sprites: Map<string, SceneHero>;
  onChange: (id: string, patch: Partial<DemoHero>) => void;
}

const NEXT: Record<string, DemoHero['status']> = { ok: 'herido', herido: 'mision', mision: 'ok' };
const CLASSES = Object.keys(CLASS_NAMES) as DemoHero['cls'][];

export function Heroes({ heroes, sprites, onChange }: Props) {
  const [batch, setBatch] = useState(1);
  const gallery = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const cls = CLASSES[i % CLASSES.length]!;
        const sex: Sex = (i + batch) % 2 ? 'f' : 'm';
        return renderHero(generateLook(`galeria-${batch}-${i}`, cls, sex));
      }),
    [batch],
  );

  return (
    <>
      <section class="sec">
        <h2>Tus héroes</h2>
        <p class="hint">
          Cambia su estado y míralo en la Taberna: pasean por la sala, guardan cama o se van de
          misión.
        </p>
        {heroes.map((h) => (
          <article class="card hero-row" key={h.id}>
            <div class="portrait">
              <PixelSprite pixels={sprites.get(h.id)!.sprite} scale={3} label={h.name} />
            </div>
            <div class="hero-info">
              <b>
                {h.name} {h.nick && <span class="nick">{h.nick}</span>}
              </b>
              <span class="muted">
                {CLASS_NAMES[h.cls][h.sex]} · nivel {h.lvl}
              </span>
              <div class="chips">
                {h.traits.map((t) => (
                  <span class={`trait ${t === '¿?' ? 'hidden-trait' : ''}`} key={t}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div class="hero-actions">
              <span class="pill">{STATUS_LABEL[h.status]}</span>
              {h.status === 'candidato' ? (
                <button class="btn primary" onClick={() => onChange(h.id, { status: 'ok' })}>
                  Contratar
                </button>
              ) : (
                <button class="btn" onClick={() => onChange(h.id, { status: NEXT[h.status] })}>
                  Cambiar
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
      <section class="sec">
        <div class="sec-h">
          <h2>Generador</h2>
          <button class="btn" onClick={() => setBatch((b) => b + 1)}>
            Otra tanda
          </button>
        </div>
        <p class="hint">
          Cada héroe se monta por capas a partir de su semilla: piel, pelo, barba, ropa de clase,
          sombrero y arma.
        </p>
        <div class="gallery">
          {gallery.map((p, i) => (
            <PixelSprite key={`${batch}-${i}`} pixels={p} scale={3} />
          ))}
        </div>
      </section>
    </>
  );
}
