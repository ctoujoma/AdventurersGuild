import { useEffect, useState } from 'preact/hooks';
import { applyUpdate, onUpdateReady } from '../platform/update';
import { t } from '../textos';

/** Aviso fijo de versión nueva: al tocarlo se guarda la partida y se recarga con la nueva. */
export function UpdateBar({ onBeforeReload }: { onBeforeReload: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => onUpdateReady(setReady), []);
  if (!ready) return null;
  return (
    <button
      class="update-bar"
      onClick={() => {
        onBeforeReload();
        applyUpdate();
      }}
    >
      {t('pantallas.app.version_nueva')}
    </button>
  );
}
