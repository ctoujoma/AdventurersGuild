import { useEffect, useRef, useState } from 'preact/hooks';
import { ARENA, arenaBuffer } from '../art/arenas';
import { bufferCanvas } from '../art/canvas';
import { generateLook } from '../art/heroes/look';
import { audio } from '../audio/audio';
import type { BossFight as Fight } from '../core/model';
import { BOSSES } from '../data/bosses';
import { PLACE_INFO } from '../data/places';
import { Battle } from '../world/battle';
import { lightSprite } from '../world/lighting';
import { Particles } from '../world/particles';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Props {
  fight: Fight;
  onClose: () => void;
}

/** Arma la pelea a partir de lo guardado en el informe (vale igual para repetirla). */
function battleOf(
  fight: Fight,
  width: number,
  hooks: ConstructorParameters<typeof Battle>[1],
): Battle {
  return new Battle(
    {
      won: fight.won,
      bandits: 0,
      defenders: fight.heroes.map((h) => ({
        id: h.id,
        look: generateLook(h.seed, h.cls, h.sex),
        marks: { eyepatch: h.eyepatch, scar: h.scar, gear: h.gear },
        hurt: h.fate !== 'ok',
      })),
      arena: { boss: fight.boss, minions: BOSSES[fight.boss].minions, width },
    },
    hooks,
  );
}

/**
 * La pelea contra el jefe, a pantalla completa: el escenario del lugar de noche, el grupo
 * contra el jefe y su barra de vida. Se puede saltar; al acabar dice cómo ha ido.
 */
export function BossFight({ fight, onClose }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef(() => {});
  const [hp, setHp] = useState(1);
  const [ended, setEnded] = useState(false);
  const boss = BOSSES[fight.boss];
  const terrain = PLACE_INFO[fight.place]?.terrain ?? 'campo';
  // En vertical se encuadra más cerca (el escenario recortado por los lados).
  const [viewW] = useState(() => (window.innerWidth < window.innerHeight ? 168 : ARENA.w));

  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    const particles = new Particles();
    let muted = false;
    const b = battleOf(fight, viewW, {
      feetAt: () => ARENA.ground,
      burst: (kind, x, y, n) => {
        for (let i = 0; i < n; i++) particles.spawn(kind, x, y);
      },
      coin: () => {},
      sound: (name, vol) => {
        if (!muted) audio.play(name, vol ?? 1);
      },
    });
    const light = document.createElement('canvas');
    light.width = viewW;
    light.height = ARENA.h;
    const lctx = light.getContext('2d')!;
    const back = bufferCanvas(arenaBuffer(terrain));
    // Se pinta a varios aumentos enteros para que el pixel art se vea nítido.
    const fit = () => {
      const k = Math.max(1, Math.round((c.clientWidth * devicePixelRatio) / viewW));
      if (c.width !== viewW * k) {
        c.width = viewW * k;
        c.height = ARENA.h * k;
      }
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let shown = 1;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      // Se para justo antes del final para que la escena quede quieta con el desenlace.
      if (b.t + dt < b.duration - 0.05) b.update(dt);
      else setEnded(true);
      particles.update(dt, t);
      fit();
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(back, Math.round((viewW - ARENA.w) / 2), 0);
      b.draw(ctx, 0, 0);
      particles.draw(ctx, 0, 0, t);
      // Luz de noche: penumbra azulada y, encima, el fuego y la magia de la pelea.
      lctx.globalCompositeOperation = 'copy';
      lctx.fillStyle = 'rgb(150, 160, 210)';
      lctx.fillRect(0, 0, viewW, ARENA.h);
      lctx.globalCompositeOperation = 'lighter';
      for (const l of b.lights())
        lctx.drawImage(lightSprite(l.r, l.color, 0.9), l.x - l.r, l.y - l.r);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(light, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      b.drawFx(ctx, 0, 0);
      const h = b.bossHp ?? 0;
      if (Math.abs(h - shown) > 0.004) {
        shown = h;
        setHp(h);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    // Saltar: se adelanta la pelea en silencio hasta el desenlace.
    skipRef.current = () => {
      muted = true;
      while (b.t < b.duration - 0.5) b.update(1 / 30);
      muted = false;
    };
    return () => cancelAnimationFrame(raf);
  }, [fight]);

  return (
    <div class="bossfight" role="dialog" aria-label={`Pelea contra ${boss.short}`}>
      <header class="bossfight-head">
        <span class="eyebrow">{capitalize(fight.place)}, de noche</span>
        <b class="bossfight-name">{boss.name}</b>
        <div class="boss-hp" aria-label={`Vida: ${Math.round(hp * 100)} %`}>
          <i style={{ width: `${hp * 100}%` }} />
        </div>
      </header>
      <canvas
        ref={canvas}
        class="bossfight-stage"
        style={{
          aspectRatio: `${viewW} / ${ARENA.h}`,
          width: `min(100%, ${((viewW / ARENA.h) * 56).toFixed(1)}vh)`,
        }}
      />
      <footer class="bossfight-foot">
        <p class="bossfight-party">
          {fight.heroes.map((h) => (
            <span key={h.id} class={ended && h.fate !== 'ok' ? `fate-${h.fate}` : ''}>
              {h.name}
              {ended && h.fate === 'herido' ? ` (${h.sex === 'f' ? 'herida' : 'herido'})` : ''}
            </span>
          ))}
        </p>
        {ended ? (
          <>
            <p class={`bossfight-result ${fight.won ? 'won' : 'lost'}`}>
              {fight.won ? boss.win : boss.lose}
            </p>
            <button class="btn btn-gold" onClick={onClose}>
              Continuar
            </button>
          </>
        ) : (
          <button class="btn btn-wood" onClick={() => skipRef.current()}>
            Saltar
          </button>
        )}
      </footer>
    </div>
  );
}

interface CallProps {
  fight: Fight;
  who: string;
  onWatch: () => void;
  onLater: () => void;
}

/** Aviso del amanecer: esta noche un grupo ha dado con el jefe. Verlo o dejarlo para luego. */
export function BossCall({ fight, who, onWatch, onLater }: CallProps) {
  const boss = BOSSES[fight.boss];
  return (
    <div class="card-backdrop">
      <article class="herocard eventcard bosscall" role="dialog" aria-label="Pelea contra un jefe">
        <div class="qs-scroll">
          <span class="eyebrow">Esta noche, en {fight.place}…</span>
          <p class="event-text">
            {who} {fight.heroes.length > 1 ? 'han dado' : 'ha dado'} con {boss.short}.
          </p>
          <div class="event-options">
            <button class="btn btn-gold" onClick={onWatch}>
              <span>Verlo ahora</span>
              <small>La pelea, desde el principio</small>
            </button>
            <button class="btn btn-wood" onClick={onLater}>
              <span>Ahora no</span>
              <small>Queda en el informe para verla luego</small>
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
