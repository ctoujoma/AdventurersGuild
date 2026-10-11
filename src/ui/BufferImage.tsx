import { useEffect, useRef } from 'preact/hooks';
import { bufferCanvas } from '../art/canvas';
import type { PixelBuffer } from '../art/pixel';

interface Props {
  buf: PixelBuffer;
  scale?: number;
  label?: string;
  class?: string;
}

/** Pinta un PixelBuffer a escala entera, nítido. */
export function BufferImage({ buf, scale = 2, label, class: cls }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = buf.w;
    c.height = buf.h;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, buf.w, buf.h);
    ctx.drawImage(bufferCanvas(buf), 0, 0);
  }, [buf]);
  return (
    <canvas
      ref={ref}
      class={`pixel ${cls ?? ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: `${buf.w * scale}px`, height: `${buf.h * scale}px` }}
    />
  );
}
