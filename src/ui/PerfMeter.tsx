import { useEffect, useState } from 'preact/hooks';
import type { GameScene } from './SceneView';
import { t } from '../textos';

/**
 * Medidor de rendimiento (Ajustes › Modo prueba): fotogramas por segundo, milisegundos por
 * fotograma (media y el peor de cada diez) y lo que se dibuja (llamadas, triángulos, texturas y el
 * tamaño del lienzo). Para ver en el dispositivo de cada uno qué pesa (en obras, con la luz con
 * ambiente, con el clima…). Se pone al día dos veces por segundo.
 */
export function PerfMeter({ scene }: { scene: { current: GameScene | null } }) {
  const [txt, setTxt] = useState('');
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let shown = last;
    const dts: number[] = [];
    const loop = (now: number) => {
      dts.push(now - last);
      if (dts.length > 120) dts.shift();
      last = now;
      if (now - shown > 500 && dts.length > 5) {
        shown = now;
        const avg = dts.reduce((a, x) => a + x, 0) / dts.length;
        const p90 = [...dts].sort((a, b) => a - b)[Math.floor(dts.length * 0.9)]!;
        const st = scene.current?.perfStats();
        setTxt(
          t('pantallas.perf.linea', {
            fps: Math.round(1000 / avg),
            ms: avg.toFixed(1),
            peor: p90.toFixed(1),
            llamadas: st?.calls ?? 0,
            tri: Math.round((st?.tris ?? 0) / 1000),
            tex: st?.tex ?? 0,
            w: st?.w ?? 0,
            h: st?.h ?? 0,
          }),
        );
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div class="perf-meter" role="status" aria-live="off">
      {txt}
    </div>
  );
}
