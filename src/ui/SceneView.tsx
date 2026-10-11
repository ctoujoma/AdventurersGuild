import { useEffect, useRef } from 'preact/hooks';
import { audio } from '../audio/audio';
import { WorldScene, type Point, type SceneModel } from '../world/scene';

interface Props {
  model: SceneModel;
  onReady: (scene: WorldScene) => void;
  onHotspot: (id: string, label: string, at: Point) => void;
  onHero: (id: string, at: Point) => void;
  onHover: (label: string | null, at: Point | null) => void;
  paused?: boolean;
}

/** La taberna viva a pantalla completa. */
export function SceneView({ model, onReady, onHotspot, onHero, onHover, paused }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<WorldScene | null>(null);
  const handlers = useRef({ onHotspot, onHero, onHover });
  handlers.current = { onHotspot, onHero, onHover };

  useEffect(() => {
    const s = new WorldScene(canvas.current!, {
      onHotspot: (id, label, at) => handlers.current.onHotspot(id, label, at),
      onHero: (id, at) => handlers.current.onHero(id, at),
      onHover: (label, at) => handlers.current.onHover(label, at),
      onSound: (name, vol) => audio.play(name, vol),
      onFrame: (p) => audio.listen(p),
    });
    scene.current = s;
    // Gancho de depuración para pruebas automáticas (solo con #debug en la URL).
    if (location.hash === '#debug') (window as unknown as { __scene: WorldScene }).__scene = s;
    s.setModel(model);
    const el = wrap.current!;
    const fit = () => s.resize(el.clientWidth, el.clientHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    s.start();
    onReady(s);
    const vis = () => (document.hidden ? s.stop() : s.start());
    document.addEventListener('visibilitychange', vis);
    return () => {
      ro.disconnect();
      s.stop();
      document.removeEventListener('visibilitychange', vis);
    };
    // La escena se crea una sola vez.
  }, []);

  useEffect(() => {
    scene.current?.setModel(model);
  }, [model]);

  useEffect(() => {
    if (!scene.current) return;
    if (paused) scene.current.stop();
    else scene.current.start();
  }, [paused]);

  return (
    <div class="scene" ref={wrap}>
      <canvas
        ref={canvas}
        class="pixel scene-canvas"
        aria-label="La taberna El Jarro Partido. Arrastra para recorrerla y toca lo que quieras."
      />
    </div>
  );
}
