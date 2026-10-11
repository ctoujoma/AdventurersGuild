import { useEffect, useRef, useState } from 'preact/hooks';
import { SCENE_H, SCENE_W, TavernScene, type TavernModel } from '../art/tavern/scene';

interface Props {
  model: TavernModel;
  onPick?: (id: string) => void;
}

interface Label {
  name: string;
  x: number;
  y: number;
}

/** La escena de la taberna, escalada a un múltiplo entero para que el pixel art se vea nítido. */
export function TavernView({ model, onPick }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<TavernScene | null>(null);
  const [scale, setScale] = useState(2);
  const [label, setLabel] = useState<Label | null>(null);

  useEffect(() => {
    const s = new TavernScene(canvas.current!);
    scene.current = s;
    s.start();
    const stopWhenHidden = () => (document.hidden ? s.stop() : s.start());
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => {
      s.stop();
      document.removeEventListener('visibilitychange', stopWhenHidden);
    };
  }, []);

  useEffect(() => {
    scene.current?.setModel(model);
  }, [model]);

  useEffect(() => {
    const el = wrap.current!;
    // Escala entera cuando cabe (nítido); por debajo de 2×, la que llene el ancho.
    const fit = () => {
      const s = el.clientWidth / SCENE_W;
      setScale(s >= 2 ? Math.floor(s) : Math.max(1, s));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!label) return;
    const t = setTimeout(() => setLabel(null), 2200);
    return () => clearTimeout(t);
  }, [label]);

  const pick = (e: MouseEvent) => {
    const c = canvas.current!;
    const rect = c.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SCENE_W;
    const y = ((e.clientY - rect.top) / rect.height) * SCENE_H;
    const actor = scene.current?.actorAt(x, y);
    if (!actor) return setLabel(null);
    setLabel({ name: actor.name, x: actor.x + actor.sprite.w / 2, y: actor.y });
    onPick?.(actor.id);
  };

  return (
    <div class="tavern" ref={wrap}>
      <div
        class="tavern-stage"
        style={{ width: `${SCENE_W * scale}px`, height: `${SCENE_H * scale}px` }}
      >
        <canvas
          ref={canvas}
          class="pixel"
          onClick={pick}
          role="img"
          aria-label="La taberna El Jarro Partido vista en corte: tejado, dormitorios, enfermería, sala común y bodega"
        />
        {label && (
          <span
            class="tavern-label"
            style={{ left: `${label.x * scale}px`, top: `${label.y * scale}px` }}
          >
            {label.name}
          </span>
        )}
      </div>
    </div>
  );
}
