import { help } from './HoldHelp';
import { Icon, type IconName } from './icons';
import { t } from '../textos';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
  /** Cifra al lado (cuántos hay, «4/4»…). */
  count?: number | string;
  /** Aviso rojo: algo pide atención en esa pestaña. */
  alert?: number;
  /** Explicación al mantener pulsado. */
  help?: string;
}

interface Props<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}

/** Pestañas de un panel: la misma forma en todos (icono, palabra y cifra). */
export function Tabs<T extends string>({ tabs, value, onChange, label }: Props<T>) {
  return (
    <div class="segs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          class="seg"
          data-tut={`seg-${tab.id}`}
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          {...(tab.help ? help(tab.help) : {})}
        >
          {tab.icon && <Icon name={tab.icon} size={14} />}
          <span>{tab.label}</span>
          {tab.count !== undefined && <b class="seg-n">{tab.count}</b>}
          {!!tab.alert && (
            <span class="seg-alert" aria-label={t('barra.tabs.pendientes', { n: tab.alert })}>
              {tab.alert}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
