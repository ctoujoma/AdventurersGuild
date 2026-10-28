import type { Report } from '../../core/model';
import { OUTCOME_CLASS } from '../../data/labels';

/** Correo del amanecer: los informes de los grupos que han vuelto, uno por fila. */
export function MailPanel({
  reports,
  onOpen,
}: {
  reports: Report[];
  onOpen: (id: string) => void;
}) {
  if (!reports.length)
    return <p class="panel-note">Nadie ha vuelto todavía. Los informes llegan aquí al amanecer.</p>;
  return (
    <div class="rows">
      {reports.map((r) => (
        <button key={r.id} class={`row mail ${r.read ? 'read' : ''}`} onClick={() => onOpen(r.id)}>
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
    </div>
  );
}
