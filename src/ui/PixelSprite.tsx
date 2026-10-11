import { useEffect, useRef } from 'preact/hooks';
import { toCanvas } from '../art/canvas';
import type { Pixels } from '../art/sprite';

interface Props {
  pixels: Pixels;
  scale?: number;
  label?: string;
}

/** Pinta un sprite a escala entera, sin suavizado. */
export function PixelSprite({ pixels, scale = 3, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = pixels.w;
    canvas.height = pixels.h;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, pixels.w, pixels.h);
    ctx.drawImage(toCanvas(pixels), 0, 0);
  }, [pixels]);
  return (
    <canvas
      ref={ref}
      class="pixel"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: `${pixels.w * scale}px`, height: `${pixels.h * scale}px` }}
    />
  );
}
