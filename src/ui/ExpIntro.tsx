import { useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { Icon, type IconName } from './icons';
import { t } from '../textos';

interface Props {
  /** Acabado (o cerrado): `toMap` si se pidió ir al mapa. */
  onDone: (toMap: boolean) => void;
}

const PAGES: readonly { icon: IconName; key: string }[] = [
  { icon: 'pasos', key: 'p1' },
  { icon: 'pan', key: 'p2' },
  { icon: 'espadas', key: 'p3' },
];

/** El tutorial corto de las expediciones (bloque 5; EX24): tres páginas al abrirse. */
export function ExpIntro({ onDone }: Props) {
  const [i, setI] = useState(0);
  const p = PAGES[i]!;
  const last = i === PAGES.length - 1;
  return (
    <div class="card-backdrop" onClick={() => onDone(false)}>
      <article
        class="herocard letter exp-intro"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('expediciones.intro.titulo')}
      >
        <button
          class="btn-icon herocard-x"
          aria-label={t('expediciones.intro.cerrar')}
          onClick={() => onDone(false)}
        >
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <span class="eyebrow">
            {t('expediciones.intro.titulo')} ·{' '}
            {t('expediciones.intro.paso', { n: i + 1, total: PAGES.length })}
          </span>
          <div class="exp-intro-pic" aria-hidden="true">
            <Icon name={p.icon} size={40} />
          </div>
          <h3>{t(`expediciones.intro.${p.key}_titulo`)}</h3>
          <p>{t(`expediciones.intro.${p.key}_texto`)}</p>
          <div class="exp-intro-dots" aria-hidden="true">
            {PAGES.map((_, k) => (
              <i key={k} class={k === i ? 'is-on' : ''} />
            ))}
          </div>
          <button
            class="btn btn-gold exp-bag-go"
            onClick={() => {
              audio.play('select');
              if (last) onDone(true);
              else setI(i + 1);
            }}
          >
            {last ? t('expediciones.intro.vamos') : t('expediciones.intro.siguiente')}
          </button>
        </div>
      </article>
    </div>
  );
}
