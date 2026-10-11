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
}

/** Retrato en su marco; si está «vivo», parpadea cada pocos segundos. */
export function Portrait({ look, marks = {}, scale = 2, label, alive = true }: Props) {
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
    <span class="portrait-frame">
      <BufferImage buf={renderPortrait(look, marks, blink)} scale={scale} label={label} />
    </span>
  );
}
