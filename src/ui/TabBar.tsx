import { Icon, type IconName } from './icons';

export type TabId = 'taberna' | 'tablon' | 'heroes' | 'gremio';

const TABS: { id: TabId; label: string; help: string }[] = [
  { id: 'taberna', label: 'Taberna', help: 'Vuelve a la escena de la taberna.' },
  { id: 'tablon', label: 'Tablón', help: 'Los encargos que se pueden aceptar y mandar.' },
  {
    id: 'heroes',
    label: 'Héroes y personal',
    help: 'Tus héroes, los trabajadores de la casa con sus tareas y los que buscan trabajo.',
  },
  {
    id: 'gremio',
    label: 'Gremio',
    help: 'La deuda, la seguridad, las salas, los adornos, el arcón, el libro y los ajustes.',
  },
];

export function TabBar({
  tab,
  onTab,
  hidden,
}: {
  tab: TabId;
  onTab: (t: TabId) => void;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <nav class="tabs" aria-label="Secciones">
      {TABS.map((t) => (
        <button
          key={t.id}
          class="tab"
          data-tut={`tab-${t.id}`}
          aria-current={tab === t.id ? 'page' : undefined}
          data-help={t.help}
          onClick={() => onTab(t.id)}
        >
          <Icon name={t.id as IconName} size={24} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
