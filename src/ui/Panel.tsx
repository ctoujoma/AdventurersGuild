import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Icon } from './icons';

interface Props {
  title: string;
  onClose: () => void;
  variant?: 'paper' | 'cork';
  /** Más ancho en pantallas grandes (el mapa). */
  wide?: boolean;
  children: ComponentChildren;
}

/** Panel que sube sobre la escena: marco de madera y fondo de pergamino o corcho. */
export function Panel({ title, onClose, variant = 'paper', wide, children }: Props) {
  // Al cerrar, baja antes de desaparecer.
  const [leaving, setLeaving] = useState(false);
  const close = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onClose, 150);
  };
  return (
    <section
      class={`panel panel-${variant} ${wide ? 'panel-wide' : ''} ${leaving ? 'panel-leave' : ''}`}
      aria-label={title}
    >
      <header class="panel-head">
        <h2>{title}</h2>
        <button class="btn-icon" aria-label="Cerrar" onClick={close}>
          <Icon name="close" size={14} />
        </button>
      </header>
      <div class="panel-body">{children}</div>
    </section>
  );
}
