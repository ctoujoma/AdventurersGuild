import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import type { Report } from '../core/model';
import { hushRule, type Notice } from './alerts';
import { Icon } from './icons';
import { MailPanel } from './panels/MailPanel';
import { Tabs } from './Tabs';

/** Lo que enseña la campana abierta: los avisos o los informes (el correo). */
export type BellView = 'avisos' | 'informes';

/** Lo que dura a la vista el aviso nuevo junto a la campana. */
const PEEK_MS = 3200;
/** Cuánto hay que deslizar un aviso para descartarlo (px). */
const SWIPE = 72;
/** Lo que tarda en irse un aviso descartado (ms); en «todos», uno tras otro. */
const GONE_MS = 220;
const GONE_STEP = 40;

/**
 * La campanita de arriba: el único buzón, con los avisos y los informes (el correo). Lleva su
 * número (avisos e informes sin leer); cuando llega un aviso nuevo se balancea, suena y lo asoma
 * un momento. Abierta, dos pestañas: en «Avisos», tocar uno lleva a donde se arregla, y se
 * descarta deslizándolo o con su «×» (ver `hushRule`), o con «Descartar todos»; en «Informes»,
 * los informes de los grupos y las cartas, con «Leído todo». Quién la abre, y en qué pestaña,
 * lo lleva `App` (el amanecer la abre en los informes).
 */
export function AlertBell({
  alerts,
  onGo,
  onHush,
  hushedCount,
  onUnhush,
  quiet,
  reports,
  onReport,
  onReadAll,
  onHistory,
  open,
  onOpen,
}: {
  alerts: Notice[];
  onGo: (n: Notice) => void;
  onHush: (ids: string[]) => void;
  /** Cuántos hay descartados que siguen pasando (para poder volver a verlos). */
  hushedCount: number;
  onUnhush: () => void;
  /** Hay algo delante (la noche, el cobro, la carta): lo nuevo espera a que se cierre. */
  quiet?: boolean;
  reports: Report[];
  onReport: (id: string) => void;
  onReadAll: () => void;
  /** Al historial de encargos (desde el pie de los informes). */
  onHistory?: () => void;
  open: BellView | null;
  onOpen: (v: BellView | null) => void;
}) {
  const setOpen = (v: BellView | null) => onOpen(v);
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
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  // ---------- Descartar ----------
  /** Los que se están yendo: hacia dónde y en qué orden. */
  const [gone, setGone] = useState<Record<string, { dir: number; i: number; dx?: number }>>({});
  const [drag, setDrag] = useState<{ id: string; dx: number } | null>(null);
  const start = useRef<{ id: string; x: number; y: number; swiping: boolean } | null>(null);
  /** Tras deslizar, el toque que sigue no cuenta como «ir al aviso». */
  const swiped = useRef(false);
  const dismiss = (ids: string[], dir = 1, dx?: number) => {
    if (!ids.length) return;
    audio.play('deselect', 0.7);
    setGone((g) => ({ ...g, ...Object.fromEntries(ids.map((id, i) => [id, { dir, i, dx }])) }));
    setTimeout(
      () => {
        onHush(ids);
        setGone((g) => Object.fromEntries(Object.entries(g).filter(([id]) => !ids.includes(id))));
      },
      GONE_MS + (ids.length - 1) * GONE_STEP,
    );
  };
  const swipe = (a: Notice) =>
    hushRule(a) === 'never'
      ? {}
      : {
          onPointerDown: (e: PointerEvent) => {
            start.current = { id: a.id, x: e.clientX, y: e.clientY, swiping: false };
            swiped.current = false;
          },
          onPointerMove: (e: PointerEvent) => {
            const s = start.current;
            if (!s || s.id !== a.id) return;
            const dx = e.clientX - s.x;
            if (!s.swiping) {
              if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - s.y)) return;
              s.swiping = true;
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
            }
            setDrag({ id: a.id, dx });
          },
          onPointerUp: (e: PointerEvent) => {
            const s = start.current;
            start.current = null;
            if (!s?.swiping) return;
            swiped.current = true;
            const dx = e.clientX - s.x;
            setDrag(null);
            if (Math.abs(dx) >= SWIPE) dismiss([a.id], Math.sign(dx), dx);
          },
          onPointerCancel: () => {
            start.current = null;
            setDrag(null);
          },
        };

  const unread = reports.filter((r) => !r.read).length;
  const n = alerts.length + unread;
  // Sin avisos, el color de los informes nuevos (de un grupo que ha vuelto, bueno).
  const worst = alerts[0]?.k ?? 'good';
  const hushable = alerts.filter((a) => hushRule(a) !== 'never' && !gone[a.id]);
  const go = (a: Notice) => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    setOpen(null);
    setPeek(null);
    audio.play('select');
    onGo(a);
  };
  return (
    <div class="alerts">
      <button
        key={ring}
        class={`btn-icon alerts-bell ${n ? `has-${worst}` : 'is-quiet'} ${ring ? 'is-ringing' : ''}`}
        data-tut="correo"
        aria-label={
          [
            alerts.length ? `${alerts.length} ${alerts.length === 1 ? 'aviso' : 'avisos'}` : '',
            unread ? `${unread} ${unread === 1 ? 'informe sin leer' : 'informes sin leer'}` : '',
          ]
            .filter(Boolean)
            .join(' y ') || 'Sin avisos ni informes nuevos'
        }
        aria-expanded={!!open}
        onClick={() => {
          audio.play(open ? 'close' : 'open');
          setPeek(null);
          // Con informes sin leer, abre en ellos (lo nuevo de la mañana).
          setOpen(open ? null : unread ? 'informes' : 'avisos');
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
          <div class="alerts-scrim" onClick={() => setOpen(null)} />
          <div class="alerts-pop" role="dialog" aria-label="Avisos e informes">
            <Tabs
              label="Buzón"
              value={open}
              onChange={(v) => {
                audio.play('select', 0.5);
                setOpen(v);
              }}
              tabs={[
                { id: 'avisos', label: 'Avisos', icon: 'bell', count: alerts.length },
                { id: 'informes', label: 'Informes', icon: 'letter', alert: unread },
              ]}
            />
            {open === 'informes' ? (
              <div class="alerts-mail">
                <MailPanel
                  reports={reports}
                  onOpen={(id) => {
                    setOpen(null);
                    onReport(id);
                  }}
                  onReadAll={onReadAll}
                />
                {onHistory && (
                  <button
                    class="linklike alerts-history"
                    onClick={() => {
                      setOpen(null);
                      onHistory();
                    }}
                  >
                    <Icon name="lista" size={12} /> Historial de encargos
                  </button>
                )}
              </div>
            ) : alerts.length ? (
              <ul class="alerts-list">
                {alerts.map((a, i) => {
                  const g = gone[a.id];
                  const dx = drag?.id === a.id ? drag.dx : 0;
                  // Al soltar, se va desde donde se dejó (no vuelve a su sitio antes).
                  const from = g?.dx ?? 0;
                  const keep = hushRule(a) === 'never';
                  return (
                    <li
                      key={a.id}
                      class={`${g ? 'is-gone' : ''} ${dx ? 'is-dragging' : ''}`}
                      style={{
                        '--i': i,
                        '--dx': `${dx || from}px`,
                        '--dir': g?.dir ?? 1,
                        '--g': g?.i ?? 0,
                        '--o': Math.max(0.3, 1 - Math.abs(dx || from) / (SWIPE * 2.2)),
                        opacity: dx ? 'var(--o)' : undefined,
                      }}
                      {...swipe(a)}
                    >
                      <button class={`alerts-item k-${a.k}`} onClick={() => go(a)}>
                        <span class="alerts-ico">
                          <Icon name={a.icon} size={16} />
                        </span>
                        <span class="alerts-text">
                          {a.text}
                          {keep && <small class="alerts-keep">Se queda hasta que lo veas.</small>}
                          {!keep && hushRule(a) === 'day' && (
                            <small class="alerts-keep">Si lo descartas, vuelve mañana.</small>
                          )}
                        </span>
                        <span class="alerts-go" aria-hidden="true">
                          ›
                        </span>
                      </button>
                      {!keep && (
                        <button
                          class="alerts-x"
                          aria-label={`Descartar: ${a.text}`}
                          title="Descartar"
                          onClick={() => dismiss([a.id])}
                        >
                          <Icon name="close" size={10} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p class="alerts-empty">
                <Icon name="check" size={16} /> Todo en orden. Nada que se te olvide.
              </p>
            )}
            {open === 'avisos' && (hushable.length > 1 || hushedCount > 0) && (
              <div class="alerts-foot">
                {hushable.length > 1 && (
                  <button class="linklike" onClick={() => dismiss(hushable.map((a) => a.id))}>
                    Descartar todos
                  </button>
                )}
                {hushedCount > 0 && (
                  <button
                    class="linklike alerts-unhush"
                    onClick={() => {
                      audio.play('select', 0.6);
                      onUnhush();
                    }}
                  >
                    Ver {hushedCount === 1 ? 'el descartado' : `los ${hushedCount} descartados`}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
