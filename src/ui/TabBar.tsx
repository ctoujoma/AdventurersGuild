import { Icon, type IconName } from './icons';
import { t } from '../textos';

/** Las pestañas de abajo. La taberna no tiene: es lo que se ve con todo cerrado. */
export type TabId = 'tablon' | 'mapa' | 'heroes' | 'gremio';

const TABS: { id: TabId; label: string; icon: IconName; help: string }[] = [
  {
    id: 'tablon',
    label: t('barra.tabbar.tablon'),
    icon: 'tablon',
    help: t('barra.tabbar.los_encargos_que_se'),
  },
  {
    id: 'mapa',
    label: t('barra.tabbar.mapa'),
    icon: 'mapa',
    help: t('barra.tabbar.la_comarca_los_encargos'),
  },
  {
    id: 'heroes',
    label: t('barra.tabbar.heroes'),
    icon: 'heroes',
    help: t('barra.tabbar.tus_heroes_los_que'),
  },
  {
    id: 'gremio',
    label: t('barra.tabbar.gremio'),
    icon: 'gremio',
    help: t('barra.tabbar.la_casa_la_deuda'),
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
  locked,
  onLocked,
}: {
  tab: TabId | null;
  onTab: (t: TabId) => void;
  hidden?: boolean;
  badges?: Partial<Record<TabId, number>>;
  /** Con candado (el tutorial): se ve pero no se abre; al tocar, `onLocked` con el porqué. */
  locked?: Partial<Record<TabId, string>>;
  onLocked?: (why: string) => void;
}) {
  if (hidden) return null;
  return (
    <nav class="tabs" aria-label={t('barra.tabbar.secciones')}>
      {TABS.map((t) => {
        const n = badges?.[t.id] ?? 0;
        const lock = locked?.[t.id];
        return (
          <button
            key={t.id}
            class={`tab ${lock ? 'is-locked' : ''}`}
            data-tut={`tab-${t.id}`}
            aria-current={tab === t.id ? 'page' : undefined}
            aria-disabled={lock ? true : undefined}
            data-help={lock ?? t.help}
            onClick={() => (lock ? onLocked?.(lock) : onTab(t.id))}
          >
            <span class="tab-ico">
              <Icon name={t.icon} size={24} />
              {lock && (
                <span class="tab-lock" aria-hidden="true">
                  <Icon name="candado" size={12} />
                </span>
              )}
              {n > 0 && <span class="badge badge-info">{n}</span>}
            </span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
