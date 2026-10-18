import { useEffect, useRef } from 'preact/hooks';
import { audio } from '../audio/audio';
import { RoomScene } from '../world/rooms/RoomScene';
import { WorldScene, type Point, type SceneCallbacks, type SceneModel } from '../world/scene';

/** La escena que se ve: el gremio por salas o, si se elige en Ajustes, la taberna dibujada. */
export type GameScene = WorldScene | RoomScene;

interface Props {
  model: SceneModel;
  onReady: (scene: GameScene) => void;
  onHotspot: (id: string, label: string, at: Point) => void;
  onHero: (id: string, at: Point) => void;
  onHover: (label: string | null, at: Point | null) => void;
  paused?: boolean;
  /** Pinta el gremio por salas en lugar de la taberna dibujada. */
  rooms?: boolean;
}

/** La escena por salas, si el navegador puede pintar 3D (si no, se queda la taberna dibujada). */
function roomScene(canvas: HTMLCanvasElement, cb: SceneCallbacks): RoomScene | null {
  try {
    return new RoomScene(canvas, cb);
  } catch {
    return null;
  }
}

/** La taberna viva a pantalla completa. */
export function SceneView({ model, onReady, onHotspot, onHero, onHover, paused, rooms }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<GameScene | null>(null);
  const handlers = useRef({ onHotspot, onHero, onHover });
  handlers.current = { onHotspot, onHero, onHover };

  useEffect(() => {
    const callbacks: SceneCallbacks = {
      onHotspot: (id, label, at) => handlers.current.onHotspot(id, label, at),
      onHero: (id, at) => handlers.current.onHero(id, at),
      onHover: (label, at) => handlers.current.onHover(label, at),
      onSound: (name, vol) => audio.play(name, vol),
      onFrame: (p) => audio.listen(p),
    };
    const s =
      (rooms && roomScene(canvas.current!, callbacks)) ||
      new WorldScene(canvas.current!, callbacks);
    scene.current = s;
    // Gancho de depuración para pruebas automáticas (solo con #debug en la URL).
    if (location.hash === '#debug') (window as unknown as { __scene: GameScene }).__scene = s;
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
      if (s instanceof RoomScene) s.dispose();
      else s.stop();
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
