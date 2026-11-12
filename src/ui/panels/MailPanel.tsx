import type { Report } from '../../core/model';
import { OUTCOME_CLASS } from '../../data/labels';

/** Correo del amanecer: los informes de los grupos que han vuelto, uno por fila. */
export function MailPanel({
  reports,
  onOpen,
  onReadAll,
}: {
  reports: Report[];
  onOpen: (id: string) => void;
  /** Marca todo como leído (sale si hay algo sin leer). */
  onReadAll?: () => void;
}) {
  if (!reports.length)
    return <p class="panel-note">Nadie ha vuelto todavía. Los informes llegan aquí al amanecer.</p>;
  const unread = reports.filter((r) => !r.read).length;
  return (
    <div class="rows">
      {onReadAll && unread > 1 && (
        <button class="btn btn-wood mail-all" onClick={onReadAll}>
          Leído todo ({unread})
        </button>
      )}
      {reports.map((r) => (
        <button
          key={r.id}
          data-tut={r.read ? undefined : 'informe'}
          class={`row mail ${r.read ? 'read' : ''}`}
          onClick={() => onOpen(r.id)}
        >
          <span class={`seal seal-sm ${r.read ? 'seal-read' : ''}`} aria-hidden="true">
            G
          </span>
          <span class="mail-info">
            <b>{r.title}</b>
            <span class="row-sub">{r.who}</span>
          </span>
          <span class="mail-side">
            <span
              class={`outcome-pill outcome-${r.heading?.startsWith('Carta') ? 'mid' : OUTCOME_CLASS[r.outcome]}`}
            >
              {r.heading?.startsWith('Carta')
                ? 'Carta'
                : r.raid
                  ? r.raid.won
                    ? 'Repelido'
                    : 'Saqueo'
                  : r.outcome}
            </span>
            <small class="row-sub">{r.read ? `día ${r.day}` : 'Nuevo'}</small>
          </span>
        </button>
      ))}
      <p class="panel-note">Se guardan los últimos 50 informes.</p>
    </div>
  );
}
