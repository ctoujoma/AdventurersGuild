import { useEffect, useMemo, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import type { GameState } from '../core/model';
import { customOf } from '../core/game';
import { CREST_COLORS, DEFAULT_NAME } from '../data/custom';
import { crestBoard } from '../world/props';
import { BufferImage } from './BufferImage';
import { VERSION } from '../version';
import { NEWS, loadSeenNews, saveSeenNews, unseenNews } from '../platform/news';
import { t } from '../textos';

interface Props {
  /** Partida guardada, si la hay. */
  saved: GameState | null;
  onContinue: () => void;
  onNew: () => void;
  onSaves: () => void;
  onSettings: () => void;
}

/** Pantalla de título sobre la taberna de noche: el rótulo cae con un golpe seco. */
export function Title({ saved, onContinue, onNew, onSaves, onSettings }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [news, setNews] = useState(() => unseenNews(NEWS, loadSeenNews()));
  const closeNews = () => {
    if (NEWS[0]) saveSeenNews(NEWS[0].pr);
    setNews([]);
  };
  const custom = saved ? customOf(saved) : null;
  const sign = useMemo(() => {
    const col = CREST_COLORS[custom?.color ?? 'vino'];
    return crestBoard(col.field, col.dark, custom?.symbol ?? 'jarra');
  }, [custom?.color, custom?.symbol]);

  useEffect(() => {
    const t = setTimeout(() => audio.play('impact'), 160);
    return () => clearTimeout(t);
  }, []);

  return (
    <div class="title-screen">
      <div class="title-flash" aria-hidden="true" />
      <div class="title-shake">
        <div class="title-logo">
          <span class="title-dust" aria-hidden="true" />
          <BufferImage buf={sign} scale={4} class="title-sign" />
          <span class="title-small">{t('pantallas.title.el_gremio_de')}</span>
          <h1 class="title-big">{t('pantallas.title.aventureros')}</h1>
          <span class="title-plaque">{custom?.name ?? DEFAULT_NAME}</span>
        </div>
        {news.length > 0 && (
          <div class="title-confirm title-news" role="status">
            <strong>{t('pantallas.title.novedades')}</strong>
            <ul>
              {news.map((n) => (
                <li key={n.pr}>
                  {n.title} <small>({n.date})</small>
                </li>
              ))}
            </ul>
            <button class="btn btn-gold" onClick={closeNews}>
              {t('pantallas.title.entendido')}
            </button>
          </div>
        )}
        <nav class="title-menu" aria-label={t('pantallas.title.menu_principal')}>
          {saved && !confirm && (
            <button class="btn btn-gold" onClick={onContinue}>
              {t('pantallas.title.continuar_dia', { dia: saved.day })}
            </button>
          )}
          {confirm ? (
            <div class="title-confirm">
              <span>{t('pantallas.title.ya_tienes_una_partida', { dia: saved?.day })}</span>
              <div class="herocard-actions">
                <button class="btn btn-red" onClick={onNew}>
                  {t('pantallas.title.empezar_otra')}
                </button>
                <button class="btn btn-wood" onClick={() => setConfirm(false)}>
                  {t('pantallas.title.cancelar')}
                </button>
              </div>
            </div>
          ) : (
            <button
              class={`btn ${saved ? 'btn-wood' : 'btn-gold'}`}
              onClick={() => (saved ? setConfirm(true) : onNew())}
            >
              {t('pantallas.title.nueva_partida')}
            </button>
          )}
          {!confirm && (
            <button class="btn btn-wood" onClick={onSaves}>
              {t('pantallas.title.guardar_y_cargar')}
            </button>
          )}
          {!confirm && (
            <button class="btn btn-wood" onClick={onSettings}>
              {t('pantallas.title.ajustes')}
            </button>
          )}
        </nav>
      </div>
      <span class="title-foot">
        {t('pantallas.title.toca_un_boton_para')}
        <small class="title-version">{t('pantallas.title.version', { version: VERSION })}</small>
      </span>
    </div>
  );
}
