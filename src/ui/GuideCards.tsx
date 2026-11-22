import { useRef, useState } from 'preact/hooks';
import { GUIDE_IDS, GUIDES, type GuideId } from '../data/guides';
import { t } from '../textos';
import { Icon } from './icons';

interface Props {
  onClose: () => void;
}

/**
 * Ajustes › «Repetir tutoriales»: tarjetas que se pasan con los botones o deslizando, cada una
 * con su captura, un marco que late y una flecha sobre lo que hay que tocar, y el texto abajo.
 * Con una sola guía se abre directa; con varias, se elige primero.
 */
export function GuideCards({ onClose }: Props) {
  const [guide, setGuide] = useState<GuideId | null>(GUIDE_IDS.length === 1 ? GUIDE_IDS[0]! : null);
  const [i, setI] = useState(0);
  const x0 = useRef<number | null>(null);
  const cards = guide ? GUIDES[guide] : [];
  const c = cards[i];
  const go = (n: number) => setI(Math.max(0, Math.min(cards.length - 1, n)));
  const name = guide ? t(`guias.${guide}.nombre`) : '';
  const title = c ? t(`guias.${guide}.${c.key}.titulo`) : '';
  // La flecha, encima del marco si cabe; si no, debajo apuntando hacia arriba.
  const above = c ? c.box[1] > 16 : true;
  return (
    <div class="card-backdrop guide-backdrop" onClick={onClose}>
      <article
        class="guide"
        role="dialog"
        aria-label={t('guias.ui.titulo', { guia: name })}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="guide-head">
          <b>{guide ? t('guias.ui.titulo', { guia: name }) : t('guias.ui.elige')}</b>
          <button class="btn-icon" aria-label={t('guias.ui.cerrar')} onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </header>
        {!guide && (
          <div class="guide-pick">
            {GUIDE_IDS.map((g) => (
              <button key={g} class="btn btn-wood" onClick={() => (setGuide(g), setI(0))}>
                {t(`guias.${g}.nombre`)}
              </button>
            ))}
          </div>
        )}
        {c && (
          <>
            <div
              class="guide-shot"
              onPointerDown={(e) => (x0.current = e.clientX)}
              onPointerUp={(e) => {
                if (x0.current === null) return;
                const d = e.clientX - x0.current;
                x0.current = null;
                if (d < -30) go(i + 1);
                else if (d > 30) go(i - 1);
              }}
            >
              <img src={c.img} alt={t('guias.ui.captura', { paso: title })} draggable={false} />
              <div
                class="guide-box"
                style={{
                  left: `${c.box[0]}%`,
                  top: `${c.box[1]}%`,
                  width: `${c.box[2]}%`,
                  height: `${c.box[3]}%`,
                }}
              />
              <svg
                class={`guide-arrow ${above ? 'is-above' : 'is-below'}`}
                viewBox="0 0 16 16"
                aria-hidden="true"
                style={{
                  left: `calc(${c.box[0] + c.box[2] / 2}% - 18px)`,
                  top: above ? `calc(${c.box[1]}% - 40px)` : `calc(${c.box[1] + c.box[3]}% + 4px)`,
                }}
              >
                <path d="M7 1h2v9h4l-5 5-5-5h4z" />
              </svg>
            </div>
            <h4 class="guide-title">
              <small>{t('guias.ui.paso', { n: i + 1, de: cards.length })}</small> {title}
            </h4>
            <p class="guide-text">{t(`guias.${guide}.${c.key}.texto`)}</p>
            <footer class="guide-foot">
              <button class="btn btn-wood" disabled={i === 0} onClick={() => go(i - 1)}>
                {t('guias.ui.antes')}
              </button>
              <span class="guide-dots" aria-hidden="true">
                {cards.map((_, k) => (
                  <i key={k} class={k === i ? 'on' : ''} />
                ))}
              </span>
              <button
                class="btn btn-gold"
                onClick={() => (i === cards.length - 1 ? onClose() : go(i + 1))}
              >
                {i === cards.length - 1 ? t('guias.ui.hecho') : t('guias.ui.sigue')}
              </button>
            </footer>
          </>
        )}
      </article>
    </div>
  );
}
