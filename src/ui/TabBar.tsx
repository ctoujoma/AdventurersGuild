import { Icon, type IconName } from './icons';

/** Las pestañas de abajo. La taberna no tiene: es lo que se ve con todo cerrado. */
export type TabId = 'tablon' | 'mapa' | 'heroes' | 'gremio';

const TABS: { id: TabId; label: string; icon: IconName; help: string }[] = [
  {
    id: 'tablon',
    label: 'Tablón',
    icon: 'tablon',
    help: 'Los encargos que se pueden aceptar y mandar.',
  },
  {
    id: 'mapa',
    label: 'Mapa',
    icon: 'mapa',
    help: 'La comarca: los encargos por sitio, los grupos de viaje y las historias.',
  },
  {
    id: 'heroes',
    label: 'Héroes',
    icon: 'heroes',
    help: 'Tus héroes, los que buscan trabajo, las tareas de la casa y el equipo.',
  },
  {
    id: 'gremio',
    label: 'Gremio',
    icon: 'gremio',
    help: 'La casa: la deuda, la seguridad, las salas, los objetivos y el libro.',
  },
];

/**
 * Barra de pestañas (tocar la abierta vuelve a la taberna; lo decide `App`). `badges`, un número
 * sobre la pestaña (los grupos fuera, en el mapa).
 */
export function TabBar({
  tab,
  onTab,
  hidden,
  badges,
}: {
  tab: TabId | null;
  onTab: (t: TabId) => void;
  hidden?: boolean;
  badges?: Partial<Record<TabId, number>>;
}) {
  if (hidden) return null;
  return (
    <nav class="tabs" aria-label="Secciones">
      {TABS.map((t) => {
        const n = badges?.[t.id] ?? 0;
        return (
          <button
            key={t.id}
            class="tab"
            data-tut={`tab-${t.id}`}
            aria-current={tab === t.id ? 'page' : undefined}
            data-help={t.help}
            onClick={() => onTab(t.id)}
          >
            <span class="tab-ico">
              <Icon name={t.icon} size={24} />
              {n > 0 && <span class="badge badge-info">{n}</span>}
            </span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
