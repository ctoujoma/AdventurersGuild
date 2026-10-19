import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { RoomScene } from '../world/rooms/RoomScene';
import type { Point, SceneCallbacks, SceneModel } from '../world/scene';

/** La escena que se ve: el gremio por salas. */
export type GameScene = RoomScene;

interface Props {
  model: SceneModel;
  onReady: (scene: GameScene) => void;
  onHotspot: (id: string, label: string, at: Point) => void;
  onHero: (id: string, at: Point) => void;
  onHover: (label: string | null, at: Point | null) => void;
  /** Arrastrar a alguien a una sala (solo en la vista de salas). */
  canDrag?: (id: string) => boolean;
  onDragOver?: (id: string, room: string | null, at: Point) => { ok: boolean } | null;
  onDrop?: (id: string, room: string | null) => void;
  onRoomDrag?: (id: string) => void;
  onRoomDrop?: () => void;
  paused?: boolean;
}

/** La escena por salas, si el navegador puede pintar 3D (WebGL). */
function roomScene(canvas: HTMLCanvasElement, cb: SceneCallbacks): RoomScene | null {
  try {
    return new RoomScene(canvas, cb);
  } catch {
    return null;
  }
}

/** La taberna viva a pantalla completa. */
export function SceneView(props: Props) {
  const { model, onReady, paused } = props;
  const [failed, setFailed] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<GameScene | null>(null);
  const handlers = useRef(props);
  handlers.current = props;

  useEffect(() => {
    const callbacks: SceneCallbacks = {
      onHotspot: (id, label, at) => handlers.current.onHotspot(id, label, at),
      onHero: (id, at) => handlers.current.onHero(id, at),
      onHover: (label, at) => handlers.current.onHover(label, at),
      canDrag: (id) => handlers.current.canDrag?.(id) ?? false,
      onDragOver: (id, room, at) => handlers.current.onDragOver?.(id, room, at) ?? null,
      onDrop: (id, room) => handlers.current.onDrop?.(id, room),
      onRoomDrag: (id) => handlers.current.onRoomDrag?.(id),
      onRoomDrop: () => handlers.current.onRoomDrop?.(),
      onSound: (name, vol) => audio.play(name, vol),
      onFrame: (p) => audio.listen(p),
    };
    const s = roomScene(canvas.current!, callbacks);
    if (!s) {
      setFailed(true);
      return;
    }
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
      s.dispose();
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
      {failed && (
        <p class="scene-fail" role="alert">
          Este navegador no puede pintar la taberna (le falta WebGL). Prueba con otro navegador o
          activa la aceleración por hardware.
        </p>
      )}
    </div>
  );
}
