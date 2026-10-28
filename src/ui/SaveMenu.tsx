import { useRef, useState } from 'preact/hooks';
import type { GameState } from '../core/model';
import { exportSave, parseSave, saveFileName } from '../platform/storage';
import { Icon } from './icons';

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
        setMsg(`Guardado como ${filename}.`);
      } catch (e) {
        const code = (e as { code?: string }).code;
        setMsg(
          code === 'declined'
            ? 'Descarga cancelada.'
            : 'Aquí no se puede descargar: usa «Copiar código».',
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
      setMsg(`Guardado como ${filename}.`);
    } catch {
      setMsg('Este navegador no deja descargar: usa «Copiar código».');
    }
  };

  const copy = async () => {
    if (!game) return;
    try {
      await navigator.clipboard.writeText(exportSave(game));
      setMsg('Código copiado. Guárdalo en una nota y pégalo aquí para recuperar la partida.');
    } catch {
      setPaste(exportSave(game));
      setMsg('No se pudo copiar solo: el código está abajo, selecciónalo y cópialo a mano.');
    }
  };

  const load = (text: string) => {
    const s = parseSave(text.trim());
    if (!s) return setMsg('Eso no parece una partida de El Jarro Partido (o es de otra versión).');
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
        aria-label="Guardar y cargar partida"
      >
        <button class="btn-icon herocard-x" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <span class="eyebrow">El libro del gremio</span>
          <h3>Guardar y cargar</h3>
          <p class="tiny">
            La partida se guarda sola en este navegador. Aquí puedes sacar una copia para otro
            dispositivo o por si se borra la caché.
          </p>
          {game && (
            <>
              <h4 class="qs-sub">
                Guardar · día {game.day}, {game.gold} monedas
              </h4>
              <div class="herocard-actions">
                <button class="btn btn-gold" onClick={download}>
                  Descargar archivo
                </button>
                <button class="btn btn-wood" onClick={copy}>
                  Copiar código
                </button>
              </div>
            </>
          )}
          <h4 class="qs-sub">Cargar</h4>
          <div class="herocard-actions">
            <button class="btn btn-gold" onClick={() => file.current?.click()}>
              Abrir archivo…
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
            placeholder="…o pega aquí un código de partida"
            value={paste}
            onInput={(e) => setPaste((e.target as HTMLTextAreaElement).value)}
          />
          <button class="btn btn-wood" disabled={!paste.trim()} onClick={() => load(paste)}>
            Cargar desde el código
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
