import { useState } from 'preact/hooks';

interface Props {
  onName: (name: string) => void;
  onLater: () => void;
}

/** Pide nombre a la taberna (al pagar la deuda, o a quien sigue con el de serie). */
export function NameTavern({ onName, onLater }: Props) {
  const [name, setName] = useState('');
  const ok = name.trim().length > 0;
  return (
    <div class="dawn" role="dialog" aria-label="Nombre de la taberna">
      <form
        class="dawn-card name-tavern"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onName(name);
        }}
      >
        <span class="eyebrow">El letrero de la puerta</span>
        <h2>¿Cómo se llama tu taberna?</h2>
        <p>
          «El Jarro Partido» era cosa de tu tío. Ahora el gremio es tuyo: ponle un nombre que se lea
          desde el camino.
        </p>
        <input
          class="name-tavern-input"
          maxLength={24}
          placeholder="La Oca Dorada"
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <div class="herocard-actions">
          <button type="submit" class="btn btn-gold" disabled={!ok}>
            Colgar el letrero
          </button>
          <button type="button" class="btn btn-wood" onClick={onLater}>
            Dejar el de siempre
          </button>
        </div>
        <p class="tiny">Puedes cambiarlo cuando quieras en Adornos.</p>
      </form>
    </div>
  );
}
