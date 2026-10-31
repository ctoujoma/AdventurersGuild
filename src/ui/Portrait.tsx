import { useEffect, useState } from 'preact/hooks';
import type { HeroLook, HeroMarks } from '../art/heroes/look';
import { renderPortrait } from '../art/portraits/portrait';
import { BufferImage } from './BufferImage';

interface Props {
  look: HeroLook;
  marks?: HeroMarks;
  scale?: number;
  label?: string;
  /** Parpadeo de vez en cuando. */
  alive?: boolean;
  /**
   * El marco según quién es (ver `heroFrame` y `workerFrame`): dorado con el color de la
   * clase para los héroes y de madera con el del oficio para los trabajadores.
   */
  frame?: string;
}

/** Retrato en su marco; si está «vivo», parpadea cada pocos segundos. */
export function Portrait({ look, marks = {}, scale = 2, label, alive = true, frame }: Props) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (!alive) return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(
        () => {
          setBlink(true);
          t = window.setTimeout(() => {
            setBlink(false);
            loop();
          }, 140);
        },
        2500 + Math.random() * 3500,
      );
    };
    loop();
    return () => clearTimeout(t);
  }, [alive]);
  return (
    <span class={frame ? `portrait-frame ${frame}` : 'portrait-frame'}>
      <BufferImage buf={renderPortrait(look, marks, blink)} scale={scale} label={label} />
    </span>
  );
}
