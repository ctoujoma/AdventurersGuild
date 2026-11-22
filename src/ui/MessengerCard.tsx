import { useEffect, useRef } from 'preact/hooks';
import { messengerLook } from '../art/heroes/look';
import { MESSENGER_WAIT } from '../core/balance';
import { aMessenger, messengerSex } from '../core/messenger';
import type { GameState, Messenger } from '../core/model';
import { dangerClass, dangerLabel, questTypeName } from '../data/labels';
import { Icon } from './icons';
import { Portrait } from './Portrait';
import type { GameScene } from './SceneView';
import { shortGold } from './text';
import { span } from './when';
import { t, tx } from '../textos';

interface MarkProps {
  messenger: Messenger;
  /** La puerta (el recibidor). */
  room: string;
  clock: number;
  speed: number;
  scene: { current: GameScene | null };
  onOpen: () => void;
}

/**
 * Llaman a la puerta: un aviso pequeño sobre el recibidor, más tenue que los de día (es de noche y
 * no corre prisa de verdad: si nadie abre, lo resuelve el de guardia o se va).
 */
export function MessengerMark({ messenger, room, clock, speed, scene, onOpen }: MarkProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const follow = () => {
      const el = ref.current;
      const s = scene.current;
      const at = s?.roomTop(room);
      if (el && s && at) {
        const p = s.screenOf(at.x, at.y);
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [messenger.at, room]);
  const left = Math.max(0, messenger.at + MESSENGER_WAIT - clock);
  const frac = Math.max(0, Math.min(1, left / MESSENGER_WAIT));
  const secs = Math.ceil(left / Math.max(0.5, speed));
  return (
    <div ref={ref} class="incident incident-night" role="status">
      <button
        class="incident-btn"
        aria-label={t('barra.messengercard.llaman_a_la_puerta', {
          a_messenger: aMessenger(messenger.day),
          seg: secs,
        })}
        onClick={onOpen}
      >
        <Icon name="letter" size={18} />
        <span class="incident-text">
          <b>{t('barra.messengercard.llaman_a_la_puerta_2')}</b>
          <small>{t('barra.messengercard.abrir_s', { seg: secs })}</small>
        </span>
        <span class="incident-bar" aria-hidden="true">
          <i style={{ width: `${Math.round(frac * 100)}%` }} />
        </span>
      </button>
    </div>
  );
}

interface CardProps {
  game: GameState;
  onAnswer: (accept: boolean) => void;
  onClose: () => void;
}

/** El mensajero tardío: su recado (un encargo urgente) para aceptarlo o despedirle. */
export function MessengerCard({ game, onAnswer, onClose }: CardProps) {
  const m = game.messenger!;
  const q = m.quest;
  const f = messengerSex(m.day) === 'f';
  return (
    <div class="card-backdrop" onClick={onClose}>
      <article
        class="herocard eventcard messengercard"
        role="dialog"
        aria-label={
          f ? t('barra.messengercard.la_mensajera') : t('barra.messengercard.el_mensajero')
        }
        onClick={(e) => e.stopPropagation()}
      >
        <button
          class="btn-icon herocard-x"
          aria-label={t('barra.messengercard.cerrar')}
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <div class="herocard-top">
            <Portrait
              look={messengerLook(m.day, messengerSex(m.day))}
              scale={2}
              label={
                f ? t('barra.messengercard.la_mensajera') : t('barra.messengercard.el_mensajero')
              }
              frame="frame-stranger"
            />
            <div class="herocard-id">
              <span class="eyebrow">{t('barra.messengercard.llaman_a_la_puerta_2')}</span>
              <h3>
                {f ? t('barra.messengercard.una_mensajera') : t('barra.messengercard.un_mensajero')}
              </h3>
              <span class="row-sub">{t('barra.messengercard.con_un_farol_y')}</span>
            </div>
          </div>
          <div class="messenger-note">
            <span class="note-top">
              <span class="note-type">{questTypeName(q.type)}</span>
              <span class="note-new note-urgent-tag">{t('barra.messengercard.urgente')}</span>
            </span>
            <b class="note-title">{tx(q.title)}</b>
            <p class="messenger-text">{tx(q.text)}</p>
            <span class="note-foot">
              <span class={`danger danger-${dangerClass(q.danger, q.dangerHidden)}`}>
                {dangerLabel(q.danger, q.dangerHidden)}
              </span>
              <span class="note-k">
                <Icon name="pasos" size={10} />
                {span(q.days)}
              </span>
              <span class="note-k">
                <Icon name="heroe" size={10} />
                {t('barra.messengercard.heroes', { n: q.slots })}
              </span>
              <b class="reward">
                <Icon name="coin" size={12} />
                {shortGold(q.reward)}
                {q.item ? '+' : ''}
              </b>
            </span>
          </div>
          <p class="row-sub messenger-when">{t('barra.messengercard.paga_mas_de_lo')}</p>
          <div class="herocard-actions stranger-actions">
            <button class="btn btn-wood" onClick={() => onAnswer(false)}>
              {f ? t('barra.messengercard.despedirla') : t('barra.messengercard.despedirle')}
            </button>
            <button class="btn btn-gold" onClick={() => onAnswer(true)}>
              {t('barra.messengercard.aceptar')}
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
