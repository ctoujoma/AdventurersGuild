import { useEffect, useRef, useState } from 'preact/hooks';
import { ARENA, arenaBuffer } from '../art/arenas';
import { bufferCanvas } from '../art/canvas';
import { generateLook } from '../art/heroes/look';
import { audio } from '../audio/audio';
import { haptic } from '../platform/haptics';
import {
  ABILITIES,
  Combat,
  STEP,
  type AbilityId,
  type CombatResult,
  type Order,
} from '../core/combat';
import type { BossFight as Fight } from '../core/model';
import { BOSSES, type BossKind } from '../data/bosses';
import { PLACE_INFO } from '../data/places';
import { Battle } from '../world/battle';
import { lightSprite } from '../world/lighting';
import { Particles } from '../world/particles';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Props {
  fight: Fight;
  onClose: () => void;
  /**
   * La pelea se juega (con `fight.sim` y sin órdenes guardadas): el jugador da órdenes y, al
   * acabar, se le pasan para que el núcleo la resuelva igual.
   */
  onResult?: (orders: Order[]) => void;
}

/** Arma la pelea a partir de lo guardado en el informe (vale igual para repetirla). */
function battleOf(
  fight: Fight,
  width: number,
  hooks: ConstructorParameters<typeof Battle>[1],
  live: boolean,
): Battle {
  return new Battle(
    {
      won: fight.won,
      bandits: 0,
      defenders: fight.heroes.map((h) => ({
        id: h.id,
        look: generateLook(h.seed, h.cls, h.sex),
        marks: { eyepatch: h.eyepatch, scar: h.scar, gear: h.gear },
        hurt: !live && h.fate !== 'ok',
      })),
      arena: { boss: fight.boss, minions: BOSSES[fight.boss].minions, width },
      live,
    },
    hooks,
  );
}

/** Lo que la interfaz enseña de cada héroe mientras se pelea. */
interface HeroView {
  id: string;
  name: string;
  hp: number;
  skill?: AbilityId;
  /** Carga de la habilidad (0–1; 1 lista). */
  charge: number;
  target?: string;
}

const viewOf = (c: Combat): HeroView[] =>
  c.heroes().map((u) => ({
    id: u.id,
    name: u.name.split(' ')[0]!,
    hp: u.hp / u.max,
    skill: u.ability,
    charge: u.ability ? 1 - (u.charge ?? 0) / ABILITIES[u.ability].every : 0,
    target: u.target,
  }));

/**
 * La pelea contra el jefe, a pantalla completa: el escenario del lugar de noche, el grupo
 * contra el jefe y su barra de vida. Con la pelea de verdad (`fight.sim`), la manda la
 * simulación y, si se juega, el jugador elige blancos (arrastrando o tocando), lanza las
 * habilidades y se cubre cuando el jefe avisa. Se puede saltar; al acabar dice cómo ha ido.
 */
export function BossFight({ fight, onClose, onResult }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef(() => {});
  const combatRef = useRef<Combat | null>(null);
  const battleRef = useRef<Battle | null>(null);
  const [hp, setHp] = useState(1);
  const [ended, setEnded] = useState(false);
  const [party, setParty] = useState<HeroView[]>([]);
  const [warn, setWarn] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [result, setResult] = useState<CombatResult | null>(null);
  const boss = BOSSES[fight.boss];
  const terrain = PLACE_INFO[fight.place]?.terrain ?? 'campo';
  const sim = fight.sim;
  const playing = !!sim && !!onResult;
  // En vertical se encuadra más cerca (el escenario recortado por los lados).
  const [viewW] = useState(() => (window.innerWidth < window.innerHeight ? 168 : ARENA.w));

  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    const particles = new Particles();
    let muted = false;
    const b = battleOf(
      fight,
      viewW,
      {
        feetAt: () => ARENA.ground,
        burst: (kind, x, y, n) => {
          for (let i = 0; i < n; i++) particles.spawn(kind, x, y);
        },
        coin: () => {},
        sound: (name, vol) => {
          if (!muted) audio.play(name, vol ?? 1);
        },
      },
      !!sim,
    );
    battleRef.current = b;
    // La pelea de verdad: la que se juega (sin órdenes) o la del informe (con las suyas).
    const combat = sim
      ? new Combat(sim.setup, playing ? [] : sim.orders, playing ? false : !!sim.auto)
      : null;
    combatRef.current = combat;
    let seen = 0;
    let acc = 0;
    let reported = false;
    /** Lo que pasa en la simulación se ve en la escena. */
    const follow = () => {
      if (!combat) return;
      for (; seen < combat.events.length; seen++) {
        const e = combat.events[seen]!;
        if ((e.kind === 'hit' || e.kind === 'crit') && e.to) b.flashHit(e.to, e.kind === 'crit');
        else if (e.kind === 'down' && e.to) b.down(e.to);
        else if (e.kind === 'warn') {
          setWarn(true);
          if (!muted) audio.play('roar', 0.7);
        } else if (e.kind === 'special') {
          setWarn(false);
          if (!muted) audio.play(e.amount ? 'thud' : 'boom', 0.9);
        } else if (e.kind === 'cover' && !muted) audio.play('swing', 0.8);
        else if (e.kind === 'heal' && !muted) audio.play('holy', 0.6);
      }
      for (const u of combat.units) {
        b.setHp(u.id, u.hp / u.max);
        if (u.target) b.aim(u.id, u.target);
      }
      if (combat.result && !reported) {
        reported = true;
        b.end(combat.result.won);
        setResult(combat.result);
        setWarn(false);
        if (playing) onResult!(combat.orders);
      }
    };
    // Para las capturas (`tools/shots/jefes.mjs`): la pelea, a mano desde la consola.
    if (location.hash === '#debug')
      Object.assign(window as unknown as Record<string, unknown>, {
        __battle: b,
        __combat: combat,
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
    let ui = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      // Se para justo antes del final para que la escena quede quieta con el desenlace.
      if (b.t + dt < b.duration - 0.05) b.update(dt);
      else setEnded(true);
      // La simulación arranca cuando el grupo llega a la pelea.
      if (combat && !combat.result && b.t >= b.fightAt) {
        acc += dt;
        while (acc >= STEP && !combat.result) {
          acc -= STEP;
          combat.tick();
        }
      }
      follow();
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
      // La barra del grupo, unas diez veces por segundo.
      if (combat && (ui += dt) > 0.1) {
        ui = 0;
        setParty(viewOf(combat));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    // Saltar: se adelanta la pelea en silencio hasta el desenlace (sin más órdenes).
    skipRef.current = () => {
      muted = true;
      if (combat) {
        while (b.t < b.fightAt) b.update(1 / 30);
        while (!combat.result) combat.tick();
        follow();
      }
      while (b.t < b.duration - 0.5) b.update(1 / 30);
      muted = false;
    };
    return () => cancelAnimationFrame(raf);
  }, [fight]);

  /** Qué enemigo hay en un punto de la pantalla. */
  const foeAt = (clientX: number, clientY: number): string | null => {
    const c = canvas.current;
    const b = battleRef.current;
    const combat = combatRef.current;
    if (!c || !b || !combat) return null;
    const r = c.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    const x = ((clientX - r.left) / r.width) * viewW;
    const y = ((clientY - r.top) / r.height) * ARENA.h;
    // Los esbirros primero (son más pequeños y van delante del jefe).
    const foes = combat.foes().filter((f) => f.hp > 0);
    foes.sort((a, b2) => (a.kind === 'jefe' ? 1 : 0) - (b2.kind === 'jefe' ? 1 : 0));
    for (const f of foes) {
      const s = b.spot(f.id);
      if (s && x >= s.x - 3 && x <= s.x + s.w + 3 && y >= s.y - 3 && y <= s.y + s.h + 3)
        return f.id;
    }
    return null;
  };

  const order = (o: Parameters<Combat['order']>[0]) => {
    const ok = combatRef.current?.order(o) ?? false;
    if (ok) {
      haptic('select');
      setParty(viewOf(combatRef.current!));
    }
    return ok;
  };

  // Arrastrar un héroe hasta un enemigo: ese es su blanco.
  const drag = useRef<string | null>(null);
  useEffect(() => {
    if (!playing) return;
    const up = (e: PointerEvent) => {
      const who = drag.current;
      drag.current = null;
      if (!who) return;
      const to = foeAt(e.clientX, e.clientY);
      if (to) {
        order({ who, kind: 'target', to });
        setChosen(null);
      }
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  });

  const won = result ? result.won : fight.won;
  const downed = result ? result.downed : null;
  const fateOf = (h: Fight['heroes'][number]) =>
    downed ? (downed.includes(h.id) ? 'herido' : 'ok') : h.fate;

  return (
    <div class="bossfight" role="dialog" aria-label={`Pelea contra ${boss.short}`}>
      <header class="bossfight-head">
        <span class="eyebrow">{capitalize(fight.place)}, de noche</span>
        <b class="bossfight-name">{boss.name}</b>
        <div class="boss-hp" aria-label={`Vida: ${Math.round(hp * 100)} %`}>
          <i style={{ width: `${hp * 100}%` }} />
        </div>
      </header>
      <div class="bossfight-wrap">
        <canvas
          ref={canvas}
          class={`bossfight-stage ${chosen ? 'is-aiming' : ''}`}
          style={{
            aspectRatio: `${viewW} / ${ARENA.h}`,
            width: `min(100%, ${((viewW / ARENA.h) * 56).toFixed(1)}vh)`,
          }}
          onPointerDown={(e) => {
            if (!playing || !chosen) return;
            const to = foeAt(e.clientX, e.clientY);
            if (to) {
              order({ who: chosen, kind: 'target', to });
              setChosen(null);
            }
          }}
        />
        {playing && warn && !result && (
          <button
            class="btn btn-gold bossfight-cover"
            onClick={() => {
              const first = party.find((h) => h.hp > 0);
              if (first) order({ who: first.id, kind: 'cover' });
              setWarn(false);
            }}
          >
            ¡Cubríos!
          </button>
        )}
      </div>
      {sim && !ended && (
        <ul class="bossfight-crew" aria-label="El grupo">
          {party.map((h) => {
            const ready = h.charge >= 1 && h.hp > 0;
            return (
              <li
                key={h.id}
                class={`bf-hero ${h.hp <= 0 ? 'is-down' : ''} ${chosen === h.id ? 'is-chosen' : ''}`}
              >
                <button
                  class="bf-hero-main"
                  disabled={!playing || h.hp <= 0}
                  aria-label={`${h.name}: elegir a quién ataca (o arrástralo a un enemigo)`}
                  onPointerDown={() => {
                    if (playing && h.hp > 0) drag.current = h.id;
                  }}
                  onClick={() => setChosen(chosen === h.id ? null : h.id)}
                >
                  <span class="bf-hero-name">{h.name}</span>
                  <span class="bf-hp" aria-hidden="true">
                    <i style={{ width: `${Math.round(h.hp * 100)}%` }} />
                  </span>
                  <span class="bf-target">
                    {h.target === 'jefe' ? 'al jefe' : h.target ? 'al esbirro' : ''}
                  </span>
                </button>
                {h.skill && (
                  <button
                    class={`bf-skill ${ready ? 'is-ready' : ''}`}
                    disabled={!playing || !ready}
                    title={ABILITIES[h.skill].text}
                    onClick={() => order({ who: h.id, kind: 'skill' })}
                  >
                    <span class="bf-charge" style={{ height: `${Math.round(h.charge * 100)}%` }} />
                    <span class="bf-skill-name">{ABILITIES[h.skill].name}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {playing && !ended && (
        <p class="bossfight-hint">
          {chosen
            ? 'Toca un enemigo para que vaya a por él.'
            : 'Arrastra a un héroe hasta un enemigo (o tócalo y luego al enemigo). Cuando el jefe avise, ¡cubríos!'}
        </p>
      )}
      <footer class="bossfight-foot">
        {(!sim || ended) && (
          <p class="bossfight-party">
            {fight.heroes.map((h) => {
              const f = fateOf(h);
              return (
                <span key={h.id} class={ended && f !== 'ok' ? `fate-${f}` : ''}>
                  {h.name}
                  {ended && f === 'herido' ? ` (${h.sex === 'f' ? 'herida' : 'herido'})` : ''}
                </span>
              );
            })}
          </p>
        )}
        {ended ? (
          <>
            <p class={`bossfight-result ${won ? 'won' : 'lost'}`}>{won ? boss.win : boss.lose}</p>
            <button class="btn btn-gold" onClick={onClose}>
              Continuar
            </button>
          </>
        ) : (
          <button class="btn btn-wood" onClick={() => skipRef.current()}>
            {playing ? 'Que se las apañen' : 'Saltar'}
          </button>
        )}
      </footer>
    </div>
  );
}

interface CallProps {
  fight: Fight;
  who: string;
  /** Con el juego abierto: acaba de pasar (si no, fue esta noche). */
  live?: boolean;
  onWatch: () => void;
  onLater: () => void;
}

/** Aviso del amanecer: esta noche un grupo ha dado con el jefe. Verlo o dejarlo para luego. */
export function BossCall({ fight, who, live, onWatch, onLater }: CallProps) {
  const boss = BOSSES[fight.boss];
  return (
    <div class="card-backdrop">
      <article class="herocard eventcard bosscall" role="dialog" aria-label="Pelea contra un jefe">
        <div class="qs-scroll">
          <span class="eyebrow">
            {live ? 'Ahora mismo' : 'Esta noche'}, en {fight.place}…
          </span>
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

interface WaitProps {
  boss: BossKind;
  place: string;
  who: string;
  many: boolean;
  onWatch: () => void;
  onAuto: () => void;
  onLater: () => void;
}

/** Con el juego abierto: un grupo ha llegado ante su jefe y espera a que el jugador diga. */
export function BossWait({ boss, place, who, many, onWatch, onAuto, onLater }: WaitProps) {
  const b = BOSSES[boss];
  return (
    <div class="card-backdrop">
      <article class="herocard eventcard bosscall" role="dialog" aria-label="Un grupo ante su jefe">
        <div class="qs-scroll">
          <span class="eyebrow">Ahora mismo, en {place}…</span>
          <p class="event-text">
            {who} {many ? 'han dado' : 'ha dado'} con {b.short}. Esperan a que digas.
          </p>
          <div class="event-options">
            <button class="btn btn-gold" onClick={onWatch}>
              <span>Ver la pelea</span>
              <small>Desde el principio</small>
            </button>
            <button class="btn btn-wood" onClick={onAuto}>
              <span>Que se las apañen</span>
              <small>Se resuelve sola y queda en el informe</small>
            </button>
            <button class="btn btn-wood" onClick={onLater}>
              <span>Luego</span>
              <small>Esperan hasta la noche; si no, se las apañan</small>
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
