import type { ComponentChildren } from 'preact';
import { Icon } from './icons';

interface Props {
  title: string;
  onClose: () => void;
  variant?: 'paper' | 'cork';
  children: ComponentChildren;
}

/** Panel que sube sobre la escena: marco de madera y fondo de pergamino o corcho. */
export function Panel({ title, onClose, variant = 'paper', children }: Props) {
  return (
    <section class={`panel panel-${variant}`} aria-label={title}>
      <header class="panel-head">
        <h2>{title}</h2>
        <button class="btn-icon" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
      </header>
      <div class="panel-body">{children}</div>
    </section>
  );
}
