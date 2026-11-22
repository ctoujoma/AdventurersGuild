import { useState } from 'preact/hooks';
import { t } from '../textos';

interface Props {
  onName: (name: string) => void;
  onLater: () => void;
}

/** Pide nombre a la taberna (al pagar la deuda, o a quien sigue con el de serie). */
export function NameTavern({ onName, onLater }: Props) {
  const [name, setName] = useState('');
  const ok = name.trim().length > 0;
  return (
    <div class="dawn" role="dialog" aria-label={t('pantallas.nametavern.nombre_de_la_taberna')}>
      <form
        class="dawn-card name-tavern"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onName(name);
        }}
      >
        <span class="eyebrow">{t('pantallas.nametavern.el_letrero_de_la')}</span>
        <h2>{t('pantallas.nametavern.como_se_llama_tu')}</h2>
        <p>{t('pantallas.nametavern.el_jarro_partido_era')}</p>
        <input
          class="name-tavern-input"
          maxLength={24}
          placeholder={t('pantallas.nametavern.la_oca_dorada')}
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <div class="herocard-actions">
          <button type="submit" class="btn btn-gold" disabled={!ok}>
            {t('pantallas.nametavern.colgar_el_letrero')}
          </button>
          <button type="button" class="btn btn-wood" onClick={onLater}>
            {t('pantallas.nametavern.dejar_el_de_siempre')}
          </button>
        </div>
        <p class="tiny">{t('pantallas.nametavern.puedes_cambiarlo_cuando_quieras')}</p>
      </form>
    </div>
  );
}
