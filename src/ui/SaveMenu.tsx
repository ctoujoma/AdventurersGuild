import { useRef, useState } from 'preact/hooks';
import type { GameState } from '../core/model';
import { exportSave, parseSave, saveFileName } from '../platform/storage';
import { Icon } from './icons';
import { t } from '../textos';

/** Lo mínimo del visor de claude.ai para ofrecer un archivo (capacidad `downloads`). */
interface Host {
  use(name: 'downloads'): Promise<{
    save(r: { filename: string; data: string }): Promise<unknown>;
  } | null>;
}

interface Props {
  /** Partida actual (null si no hay ninguna empezada). */
  game: GameState | null;
  onLoad: (s: GameState) => void;
  onClose: () => void;
}

/**
 * Guardar y cargar partidas: archivo (descarga y selector) y, por si el navegador no deja
 * descargar, un código de texto para copiar y pegar.
 */
export function SaveMenu({ game, onLoad, onClose }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const download = async () => {
    if (!game) return;
    const filename = saveFileName(game);
    // Dentro de claude.ai el visor guarda el archivo (pide confirmación); en la web, descarga normal.
    const host = (window as unknown as { claude?: Host }).claude;
    const saver = host ? await host.use('downloads').catch(() => null) : null;
    if (saver) {
      try {
        await saver.save({ filename, data: exportSave(game) });
        setMsg(t('pantallas.savemenu.guardado_como', { filename }));
      } catch (e) {
        const code = (e as { code?: string }).code;
        setMsg(
          code === 'declined'
            ? t('pantallas.savemenu.descarga_cancelada')
            : t('pantallas.savemenu.aqui_no_se_puede'),
        );
      }
      return;
    }
    try {
      const blob = new Blob([exportSave(game)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setMsg(t('pantallas.savemenu.guardado_como', { filename }));
    } catch {
      setMsg(t('pantallas.savemenu.este_navegador_no_deja'));
    }
  };

  const copy = async () => {
    if (!game) return;
    try {
      await navigator.clipboard.writeText(exportSave(game));
      setMsg(t('pantallas.savemenu.codigo_copiado_guardalo_en'));
    } catch {
      setPaste(exportSave(game));
      setMsg(t('pantallas.savemenu.no_se_pudo_copiar'));
    }
  };

  const load = (text: string) => {
    const s = parseSave(text.trim());
    if (!s) return setMsg(t('pantallas.savemenu.eso_no_parece_una'));
    onLoad(s);
  };

  const pick = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) load(await f.text());
  };

  return (
    <div class="card-backdrop save-backdrop as-sheet" onClick={onClose}>
      <article
        class="herocard savemenu"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('pantallas.savemenu.guardar_y_cargar_partida')}
      >
        <button
          class="btn-icon herocard-x"
          data-tut="cerrar"
          aria-label={t('pantallas.savemenu.cerrar')}
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <span class="eyebrow">{t('pantallas.savemenu.el_libro_del_gremio')}</span>
          <h3>{t('pantallas.savemenu.guardar_y_cargar')}</h3>
          <p class="tiny">{t('pantallas.savemenu.la_partida_se_guarda')}</p>
          {game && (
            <>
              <h4 class="qs-sub">
                {t('pantallas.savemenu.guardar_dia_monedas', { dia: game.day, oro: game.gold })}
              </h4>
              <div class="herocard-actions">
                <button class="btn btn-gold" onClick={download}>
                  {t('pantallas.savemenu.descargar_archivo')}
                </button>
                <button class="btn btn-wood" onClick={copy}>
                  {t('pantallas.savemenu.copiar_codigo')}
                </button>
              </div>
            </>
          )}
          <h4 class="qs-sub">{t('pantallas.savemenu.cargar')}</h4>
          <div class="herocard-actions">
            <button class="btn btn-gold" onClick={() => file.current?.click()}>
              {t('pantallas.savemenu.abrir_archivo')}
            </button>
            <input
              ref={file}
              type="file"
              accept=".json,application/json,text/plain"
              hidden
              onChange={pick}
            />
          </div>
          <textarea
            class="save-code"
            placeholder={t('pantallas.savemenu.o_pega_aqui_un')}
            value={paste}
            onInput={(e) => setPaste((e.target as HTMLTextAreaElement).value)}
          />
          <button class="btn btn-wood" disabled={!paste.trim()} onClick={() => load(paste)}>
            {t('pantallas.savemenu.cargar_desde_el_codigo')}
          </button>
          {msg && (
            <p class="qs-warn" role="status">
              {msg}
            </p>
          )}
        </div>
      </article>
    </div>
  );
}
