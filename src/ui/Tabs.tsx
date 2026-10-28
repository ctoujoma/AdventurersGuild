import { help } from './HoldHelp';
import { Icon, type IconName } from './icons';

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
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          class="seg"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          {...(t.help ? help(t.help) : {})}
        >
          {t.icon && <Icon name={t.icon} size={14} />}
          <span>{t.label}</span>
          {t.count !== undefined && <b class="seg-n">{t.count}</b>}
          {!!t.alert && (
            <span class="seg-alert" aria-label={`${t.alert} pendientes`}>
              {t.alert}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
