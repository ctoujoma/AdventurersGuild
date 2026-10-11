import { Icon, type IconName } from './icons';

export type TabId = 'taberna' | 'tablon' | 'heroes' | 'gremio';

const TABS: { id: TabId; label: string }[] = [
  { id: 'taberna', label: 'Taberna' },
  { id: 'tablon', label: 'Tablón' },
  { id: 'heroes', label: 'Héroes' },
  { id: 'gremio', label: 'Gremio' },
];

export function TabBar({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) {
  return (
    <nav class="tabs" aria-label="Secciones">
      {TABS.map((t) => (
        <button
          key={t.id}
          class="tab"
          aria-current={tab === t.id ? 'page' : undefined}
          onClick={() => onTab(t.id)}
        >
          <Icon name={t.id as IconName} size={28} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
