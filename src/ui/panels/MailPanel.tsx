import type { Report } from '../../core/model';
import { OUTCOME_CLASS, outcomeLabel } from '../../data/labels';
import { idText, t, tx } from '../../textos';

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
  if (!reports.length) return <p class="panel-note">{t('paneles.mail.nadie_ha_vuelto_todavia')}</p>;
  const unread = reports.filter((r) => !r.read).length;
  return (
    <div class="rows">
      {onReadAll && unread > 1 && (
        <button class="btn btn-wood mail-all" onClick={onReadAll}>
          {t('paneles.mail.leido_todo', { unread })}
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
            <b>{tx(r.title)}</b>
            <span class="row-sub">{tx(r.who)}</span>
          </span>
          <span class="mail-side">
            <span
              class={`outcome-pill outcome-${idText(r.heading).startsWith('Carta') ? 'mid' : OUTCOME_CLASS[r.outcome]}`}
            >
              {idText(r.heading).startsWith('Carta')
                ? t('paneles.mail.carta')
                : r.raid
                  ? r.raid.won
                    ? t('paneles.mail.repelido')
                    : t('paneles.mail.saqueo')
                  : outcomeLabel(r.outcome)}
            </span>
            <small class="row-sub">
              {r.read ? t('paneles.mail.dia', { dia: r.day }) : t('paneles.mail.nuevo')}
            </small>
          </span>
        </button>
      ))}
      <p class="panel-note">{t('paneles.mail.se_guardan_los_ultimos')}</p>
    </div>
  );
}
