import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import type { Notice } from './alerts';
import { Icon } from './icons';

/** Lo que dura a la vista el aviso nuevo junto a la campana. */
const PEEK_MS = 3200;

/**
 * La campanita de avisos, arriba. Lleva su número; cuando llega uno nuevo se balancea, suena y
 * asoma el aviso un momento. Tocarla abre la lista; tocar un aviso lleva a donde se arregla.
 */
export function AlertBell({
  alerts,
  onGo,
  quiet,
}: {
  alerts: Notice[];
  onGo: (n: Notice) => void;
  /** Hay algo delante (la noche, el cobro, la carta): lo nuevo espera a que se cierre. */
  quiet?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState<Notice | null>(null);
  /** Sube cada vez que llega algo nuevo: reinicia la animación de la campana. */
  const [ring, setRing] = useState(0);
  const seen = useRef<Set<string> | null>(null);
  const ids = alerts.map((a) => a.id).join('|');
  useEffect(() => {
    // La primera vez se dan por vistos: solo suena lo que llega después.
    if (!seen.current) {
      seen.current = new Set(alerts.map((a) => a.id));
      return;
    }
    if (quiet) return;
    const fresh = alerts.filter((a) => !seen.current!.has(a.id));
    seen.current = new Set(alerts.map((a) => a.id));
    if (!fresh.length) return;
    setRing((r) => r + 1);
    audio.play('bell', fresh.some((a) => a.k === 'bad') ? 1 : 0.7);
    if (!open) setPeek(fresh[0]!);
  }, [ids, quiet]);
  useEffect(() => {
    if (!peek) return;
    const t = setTimeout(() => setPeek(null), PEEK_MS);
    return () => clearTimeout(t);
  }, [peek]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const n = alerts.length;
  const worst = alerts[0]?.k;
  const go = (a: Notice) => {
    setOpen(false);
    setPeek(null);
    audio.play('select');
    onGo(a);
  };
  return (
    <div class="alerts">
      <button
        key={ring}
        class={`btn-icon alerts-bell ${n ? `has-${worst}` : 'is-quiet'} ${ring ? 'is-ringing' : ''}`}
        aria-label={n ? `${n} ${n === 1 ? 'aviso' : 'avisos'}` : 'Sin avisos'}
        aria-expanded={open}
        onClick={() => {
          audio.play(open ? 'close' : 'open');
          setPeek(null);
          setOpen((o) => !o);
        }}
      >
        <Icon name="bell" size={16} />
        {n > 0 && <b class="alerts-count">{n > 9 ? '9+' : n}</b>}
      </button>
      {peek && !open && (
        <button class={`alerts-peek k-${peek.k}`} role="status" onClick={() => go(peek)}>
          <Icon name={peek.icon} size={14} />
          <span>{peek.text}</span>
        </button>
      )}
      {open && (
        <>
          <div class="alerts-scrim" onClick={() => setOpen(false)} />
          <div class="alerts-pop" role="dialog" aria-label="Avisos">
            <h3 class="alerts-title">
              <Icon name="bell" size={14} /> Avisos
            </h3>
            {n ? (
              <ul class="alerts-list">
                {alerts.map((a, i) => (
                  <li key={a.id} style={{ '--i': i }}>
                    <button class={`alerts-item k-${a.k}`} onClick={() => go(a)}>
                      <span class="alerts-ico">
                        <Icon name={a.icon} size={16} />
                      </span>
                      <span class="alerts-text">{a.text}</span>
                      <span class="alerts-go" aria-hidden="true">
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p class="alerts-empty">
                <Icon name="check" size={16} /> Todo en orden. Nada que se te olvide.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
