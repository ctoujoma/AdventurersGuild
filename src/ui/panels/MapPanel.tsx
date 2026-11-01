import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fogBuffer, mapBuffer, mapStyleFor } from '../../art/map';
import { chainDef } from '../../core/chains';
import { customOf } from '../../core/game';
import type { GameState, Hero, Quest } from '../../core/model';
import { dangerClass } from '../../data/labels';
import {
  KNOWN_RADIUS,
  MAP_H,
  MAP_W,
  PLACE_INFO,
  REGIONS,
  REVEAL_RADIUS,
  TAVERN,
  placeAt,
  type Terrain,
} from '../../data/places';
import { audio } from '../../audio/audio';
import { BufferImage } from '../BufferImage';
import { left, shortSpan, span } from '../when';
import { help } from '../HoldHelp';
import { Icon, type IconName } from '../icons';
import { listNames, plural } from '../text';

interface Props {
  game: GameState;
  onQuest: (id: string) => void;
  onHero: (id: string) => void;
  /** Abre la ficha «Encargo en curso» de un grupo fuera. */
  onTrip: (missionId: string) => void;
}

const pct = (x: number, y: number) => ({
  left: `${(x / MAP_W) * 100}%`,
  top: `${(y / MAP_H) * 100}%`,
});

const TERRAIN: Record<Terrain, string> = {
  rio: 'Junto al río',
  pueblo: 'Pueblo',
  monte: 'Montaña',
  bosque: 'Bosque',
  costa: 'Costa',
  pantano: 'Pantano',
  campo: 'Campo',
  ruina: 'Ruinas',
};
const TERRAIN_ICON: Record<Terrain, IconName> = {
  rio: 'agua',
  pueblo: 'pueblo',
  monte: 'monte',
  bosque: 'bosque',
  costa: 'agua',
  pantano: 'pantano',
  campo: 'campo',
  ruina: 'ruina',
};
const DANGER_NAMES = ['Peligro bajo', 'Peligro medio', 'Peligro alto', 'Peligro letal'];

/** Una cifra de la ficha con su icono; el texto completo queda para el lector y el ratón. */
function Stat({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: preact.ComponentChildren;
}) {
  return (
    <span class="mc-stat" title={label} aria-label={label} data-help={label}>
      <Icon name={icon} size={11} />
      {children}
    </span>
  );
}
/**
 * El zoom va a escala entera: cada píxel del dibujo son 1, 2, 3… píxeles de pantalla (redondeado
 * a píxeles del aparato), así se ve nítido. El dibujo (`mapBuffer`) puede crecer sin tocar esto.
 */
const MAX_LEVEL = 8;
const dpr = () => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
/** Píxeles de pantalla (CSS) por píxel del dibujo en cada nivel. */
const scaleOf = (level: number) => Math.max(1, Math.round(level * dpr())) / dpr();
/** Redondeo a píxeles del aparato, para que no se emborrone al mover. */
const snap = (v: number) => Math.round(v * dpr()) / dpr();

type Info = { kind: 'place'; name: string } | { kind: 'chain'; id: string } | { kind: 'tavern' };

/** Punta de flecha en mitad de un tramo, apuntando hacia su final. */
function arrow(a: { x: number; y: number }, b: { x: number; y: number }, inv = 1): string {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const mx = (a.x + b.x) / 2 + ux * 2 * inv;
  const my = (a.y + b.y) / 2 + uy * 2 * inv;
  // Del mismo tamaño en pantalla con cualquier zoom.
  const s = 3.2 * inv;
  const p = (dx: number, dy: number) => `${(mx + dx).toFixed(1)},${(my + dy).toFixed(1)}`;
  return `M${p(0, 0)} L${p(-ux * s - uy * s * 0.6, -uy * s + ux * s * 0.6)} L${p(-ux * s + uy * s * 0.6, -uy * s - ux * s * 0.6)} Z`;
}

/** Dónde va un grupo: media misión de ida y media de vuelta. */
function partyPos(place: string, days: number, left: number) {
  const p = placeAt(place);
  const f = Math.min(1, Math.max(0, (days - left + 0.5) / days));
  const k = f <= 0.5 ? f * 2 : 2 - f * 2;
  return { x: TAVERN.x + (p.x - TAVERN.x) * k, y: TAVERN.y + (p.y - TAVERN.y) * k, back: f > 0.5 };
}

/**
 * Mapa de la comarca: encargos, grupos de viaje, desaparecidos y asaltos que se acercan.
 * Se puede acercar (rueda, pellizco o botones) y arrastrar; tocar un lugar, un encargo o
 * un grupo abre una ficha flotante dentro del propio mapa. Ocupa el panel entero; debajo, la lista
 * de grupos fuera, plegable. Tocar un grupo (en el mapa o en la lista) abre su «Encargo en curso».
 */
export function MapPanel({ game, onQuest, onHero, onTrip }: Props) {
  const level = game.fac.mapas;
  const explored = game.explored ?? [];
  const knownRadius = KNOWN_RADIUS + (level >= 1 ? 20 : 0);
  const known = (name: string) =>
    level >= 2 ||
    explored.includes(name) ||
    Math.hypot(placeAt(name).x - TAVERN.x, placeAt(name).y - TAVERN.y) < knownRadius;
  const fogKey = `${level}|${explored.join(',')}`;
  // Lo conocido: alrededor de la taberna y de lo explorado. Con la sala de mapas completa
  // se ve toda la comarca, pero las tierras de más allá siguen en la niebla.
  const seen = useMemo(
    () => [
      { x: TAVERN.x, y: TAVERN.y, r: knownRadius + (level >= 2 ? 30 : 0) },
      ...(level >= 2 ? Object.keys(PLACE_INFO) : explored).map((n) => ({
        ...placeAt(n),
        r: REVEAL_RADIUS,
      })),
    ],
    [fogKey],
  );
  // El dibujo: pergamino con la sala de mapas rota o a nivel 1; a color desde el nivel 2.
  const style = mapStyleFor(level);
  const fog = useMemo(() => fogBuffer(seen, style), [seen, style]);
  const regionSeen = (x: number, y: number) =>
    seen.some((k) => Math.hypot(x - k.x, y - k.y) < k.r + 24);
  const byId = (id: string) => game.heroes.find((h) => h.id === id);
  // La amenaza nace donde termina la historia en marcha (o la última).
  const threat = game.threat ?? 0;
  const lastChain = [...(game.chains ?? [])].reverse()[0];
  const threatAt = lastChain ? placeAt(chainDef(lastChain.id).steps.at(-1)!.place) : null;
  const missing = game.heroes.filter((h) => h.status === 'desaparecido');
  const pinsAt: Record<string, number> = {};

  // ---------- Zoom y arrastre ----------
  const vp = useRef<HTMLDivElement>(null);
  const buf = mapBuffer(style);
  const [size, setSize] = useState({ w: 1, h: 1 });
  /** `l`: nivel de zoom (entero); `z`: su escala; `x`, `y`: dónde cae la esquina del dibujo. */
  const [view, setView] = useState({ l: 1, z: 1, x: 0, y: 0 });
  /** La lista de grupos fuera, plegada (en vertical empieza plegada: el mapa, grande). */
  const [trips, setTrips] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > window.innerHeight,
  );
  const [info, setInfo] = useState<Info | null>(null);
  /** La leyenda y la ayuda, plegadas tras el botón «?». */
  const [legend, setLegend] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(0);
  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight ?? 0;
    if (h !== cardH) setCardH(h);
  });
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; pinch: number; z: number } | null>(null);
  /** Centra el dibujo si es más pequeño que el visor; si no, que no se salga. */
  const clampAt = (v: { l: number; z: number; x: number; y: number }, w: number, h: number) => {
    const mw = buf.w * v.z;
    const mh = buf.h * v.z;
    return {
      ...v,
      x: snap(mw <= w ? (w - mw) / 2 : Math.min(0, Math.max(w - mw, v.x))),
      y: snap(mh <= h ? (h - mh) / 2 : Math.min(0, Math.max(h - mh, v.y))),
    };
  };
  const clampView = (v: { l: number; z: number; x: number; y: number }) =>
    clampAt(v, size.w, size.h);
  /** El nivel que deja un punto del dibujo en el centro del visor. */
  const centerOn = (l: number, mx: number, my: number, w: number, h: number) => {
    const z = scaleOf(l);
    return clampAt(
      { l, z, x: w / 2 - (mx / MAP_W) * buf.w * z, y: h / 2 - (my / MAP_H) * buf.h * z },
      w,
      h,
    );
  };
  useEffect(() => {
    const el = vp.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      setSize({ w, h });
      setView((v) => clampAt(v, w, h));
    };
    // Al abrir: un nivel más que el que cabe entero, centrado en la taberna.
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    const whole = Math.max(1, Math.floor(Math.min(w / buf.w, h / buf.h)));
    setView(centerOn(Math.min(MAX_LEVEL, Math.max(2, whole + 1)), TAVERN.x, TAVERN.y, w, h));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const zoomTo = (level: number, px: number, py: number) =>
    setView((v) => {
      const l = Math.max(1, Math.min(MAX_LEVEL, Math.round(level)));
      if (l === v.l) return v;
      const z = scaleOf(l);
      return clampView({ l, z, x: px - ((px - v.x) * z) / v.z, y: py - ((py - v.y) * z) / v.z });
    });
  const local = (e: PointerEvent | WheelEvent) => {
    const r = vp.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: PointerEvent) => {
    ptrs.current.set(e.pointerId, local(e));
    gesture.current ??= { moved: 0, pinch: 0, z: view.l };
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      gesture.current.pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      gesture.current.z = view.l;
    }
  };
  const onMove = (e: PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev || !gesture.current) return;
    const p = local(e);
    ptrs.current.set(e.pointerId, p);
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (gesture.current.pinch > 0) {
        // El pellizco salta de nivel entero en nivel entero.
        const target = (gesture.current.z * d) / gesture.current.pinch;
        zoomTo(target, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      }
      gesture.current.moved += 10;
      return;
    }
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    gesture.current.moved += Math.abs(dx) + Math.abs(dy);
    if (gesture.current.moved > 4) {
      vp.current?.setPointerCapture(e.pointerId);
      setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };
  const onUp = (e: PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (!ptrs.current.size) setTimeout(() => (gesture.current = null), 0);
  };
  /** Un toque que no ha sido arrastre. */
  const tap = (fn: () => void) => () => {
    if ((gesture.current?.moved ?? 0) > 4) return;
    fn();
  };
  /** La rueda suma hasta un «clic» de rueda antes de cambiar de nivel (los paneles táctiles, poco a poco). */
  const wheel = useRef(0);
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    wheel.current += e.deltaY;
    if (Math.abs(wheel.current) < 60) return;
    const p = local(e);
    zoomTo(view.l + (wheel.current < 0 ? 1 : -1), p.x, p.y);
    wheel.current = 0;
  };
  // Posición en el visor (px) de un punto del mapa.
  const screen = (mx: number, my: number) => ({
    x: view.x + (mx / MAP_W) * buf.w * view.z,
    y: view.y + (my / MAP_H) * buf.h * view.z,
  });
  /** Unidades del dibujo (las de los lugares) por píxel de pantalla: grosor de las líneas. */
  const unit = MAP_W / (buf.w * view.z);

  // ---------- Ficha flotante ----------
  const questsAt = (name: string) => game.quests.filter((q) => q.place === name);
  const missionsTo = (name: string) => game.missions.filter((m) => m.quest.place === name);
  const days = (n: number) => (
    <Stat icon="reloj" label={span(n)}>
      {shortSpan(n)}
    </Stat>
  );
  const questLine = (q: Quest) => {
    const hidden = q.dangerHidden && level < 2;
    return (
      <li key={q.id}>
        <button class="map-card-quest" onClick={() => onQuest(q.id)}>
          <b>{q.title}</b>
          <span class="mc-stats">
            <Stat icon="coin" label={`${q.reward} monedas`}>
              {q.reward}
            </Stat>
            {days(q.days)}
            <span
              class={`mc-stat danger-${dangerClass(q.danger, hidden)}`}
              title={hidden ? 'Peligro sin saber' : DANGER_NAMES[q.danger]}
              data-help={`${hidden ? 'Peligro sin saber' : DANGER_NAMES[q.danger]}: una calavera por nivel, de bajo a letal.`}
              aria-label={hidden ? 'Peligro sin saber' : DANGER_NAMES[q.danger]}
            >
              {hidden ? (
                <>
                  <Icon name="calavera" size={11} />?
                </>
              ) : (
                Array.from({ length: q.danger + 1 }, (_, i) => (
                  <Icon key={i} name="calavera" size={11} />
                ))
              )}
            </span>
            {q.chain && (
              <Stat icon="historia" label="Parte de una historia">
                {''}
              </Stat>
            )}
          </span>
        </button>
      </li>
    );
  };
  const party = (m: GameState['missions'][number]) =>
    m.heroIds.map(byId).filter((h): h is Hero => !!h);
  let card: { x: number; y: number; body: preact.ComponentChildren } | null = null;
  if (info?.kind === 'place') {
    const p = placeAt(info.name);
    const qs = questsAt(info.name);
    const ms = missionsTo(info.name);
    const lost = missing.filter((h) => h.lostAt === info.name);
    const terrain = PLACE_INFO[info.name]?.terrain;
    const seen = known(info.name);
    card = {
      ...screen(p.x, p.y),
      body: (
        <>
          <b class="map-card-title">
            <span
              class="mc-terrain"
              title={seen ? (terrain ? TERRAIN[terrain] : 'Lugar') : 'Sin explorar'}
              data-help={seen ? (terrain ? TERRAIN[terrain] : 'Lugar') : 'Sin explorar'}
            >
              {seen && terrain ? <Icon name={TERRAIN_ICON[terrain]} size={14} /> : '?'}
            </span>
            {info.name}
            {explored.includes(info.name) && (
              <span class="mc-ok" title="Explorado" aria-label="explorado">
                <Icon name="check" size={10} />
              </span>
            )}
          </b>
          {qs.length > 0 && <ul class="map-card-list">{qs.map(questLine)}</ul>}
          {ms.map((m) => (
            <span key={m.id} class="mc-stats">
              <Stat icon="pasos" label="De camino">
                {listNames(party(m).map((h) => h.name))}
              </Stat>
              {days(m.daysLeft)}
            </span>
          ))}
          {lost.map((h) => (
            <button key={h.id} class="linklike mc-lost" onClick={() => onHero(h.id)}>
              <i>?</i> Aquí se perdió {h.name}
            </button>
          ))}
          {!qs.length && !ms.length && !lost.length && <span class="tiny">Nada que hacer.</span>}
        </>
      ),
    };
  } else if (info?.kind === 'chain') {
    const cs = (game.chains ?? []).find((c) => c.id === info.id);
    if (cs) {
      const def = chainDef(cs.id);
      const done = cs.status === 'hecha';
      const at = done ? def.steps.length - 1 : cs.step;
      const p = placeAt(def.steps[at]!.place);
      const q = game.quests.find((x) => x.chain?.id === cs.id);
      const left = def.steps.length - cs.step - 1;
      card = {
        ...screen(p.x, p.y),
        body: (
          <>
            <b class="map-card-title">
              <span class="mc-terrain">
                <Icon name="historia" size={14} />
              </span>
              {def.name}
            </b>
            <span class="tiny">
              {def.client} · {done ? 'terminada' : `paso ${cs.step + 1} de ${def.steps.length}`}
            </span>
            <ol class="mc-steps">
              {def.steps.slice(0, at + 1).map((st, i) => {
                const now = !done && i === cs.step;
                return (
                  <li key={i} class={now ? 'now' : 'past'}>
                    <i>{now ? i + 1 : <Icon name="check" size={7} />}</i>
                    <span>
                      {now && q ? (
                        <button class="linklike" onClick={() => onQuest(q.id)}>
                          {st.title}
                        </button>
                      ) : (
                        st.title
                      )}
                      <small>{st.place}</small>
                    </span>
                  </li>
                );
              })}
              {!done && left > 0 && (
                <li class="later">
                  <i>?</i>
                  <span>
                    {left} {plural(left, 'paso más', 'pasos más')} por descubrir
                  </span>
                </li>
              )}
            </ol>
          </>
        ),
      };
    }
  } else if (info?.kind === 'tavern') {
    const out = game.missions.reduce((n, m) => n + m.heroIds.length, 0);
    card = {
      ...screen(TAVERN.x, TAVERN.y),
      body: (
        <>
          <b class="map-card-title">
            <span class="mc-terrain">
              <Icon name="home" size={14} />
            </span>
            {customOf(game).name}
          </b>
          <span class="mc-stats">
            <Stat
              icon="pasos"
              label={`${game.missions.length} ${plural(game.missions.length, 'grupo fuera', 'grupos fuera')}`}
            >
              {game.missions.length}
            </Stat>
            <Stat icon="heroe" label={`${out} ${plural(out, 'héroe fuera', 'héroes fuera')}`}>
              {out}
            </Stat>
            <Stat icon="coin" label={`${game.gold} monedas`}>
              {game.gold}
            </Stat>
          </span>
        </>
      ),
    };
  }
  const soonest = [...game.missions].sort((a, b) => a.daysLeft - b.daysLeft)[0];
  // La ficha tiene un ancho fijo; se mide su alto para ver si cabe encima o debajo del punto.
  // Si no cabe en ningún lado (mapa bajito), se acopla abajo, a lo ancho del mapa.
  const cardW = Math.round(Math.min(240, size.w * 0.86));
  const half = cardW / 2 + 4;
  const cardX = card ? Math.max(half, Math.min(size.w - half, card.x)) : 0;
  const cardY = card ? Math.max(4, Math.min(size.h - 4, card.y)) : 0;
  const room = { up: cardY - 18, down: size.h - cardY - 18 };
  const fitsUp = cardH <= room.up;
  const fitsDown = cardH <= room.down;
  const place: 'up' | 'down' | 'dock' = !cardH
    ? 'up'
    : fitsUp && (cardY >= size.h * 0.45 || !fitsDown)
      ? 'up'
      : fitsDown
        ? 'down'
        : 'dock';
  const cardEl = card && (
    <div
      ref={cardRef}
      class={`map-card ${place === 'down' ? 'below' : place === 'dock' ? 'docked' : ''}`}
      style={
        place === 'dock'
          ? { width: `${cardW}px` }
          : {
              width: `${cardW}px`,
              left: `${cardX}px`,
              top: `${cardY}px`,
              visibility: cardH ? undefined : 'hidden',
            }
      }
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button class="btn-icon map-card-x" aria-label="Cerrar" onClick={() => setInfo(null)}>
        <Icon name="close" size={10} />
      </button>
      {card.body}
    </div>
  );

  return (
    <div class={`map-wrap ${trips ? 'trips-open' : ''}`}>
      <div
        ref={vp}
        class="map-viewport"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      >
        <div
          class="map"
          style={{
            width: `${buf.w}px`,
            height: `${buf.h}px`,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
            ['--inv' as string]: String(1 / view.z),
          }}
          onClick={tap(() => setInfo(null))}
        >
          <BufferImage buf={buf} scale={1} class="map-layer" label="Mapa de la comarca" />
          <BufferImage buf={fog} scale={1} class="map-layer" />
          {threat > 0 && threatAt && (
            <span
              class="map-threat"
              style={{
                ...pct(threatAt.x, threatAt.y),
                width: `${((12 + threat * 0.9) / MAP_W) * 200}%`,
                aspectRatio: '1',
                opacity: 0.25 + threat / 160,
              }}
              aria-hidden="true"
            />
          )}
          <svg
            class="map-routes"
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            style={{ ['--u' as string]: String(unit) }}
            aria-hidden="true"
          >
            {(game.chains ?? []).map((cs) => {
              const def = chainDef(cs.id);
              const done = cs.status === 'hecha';
              const upto = done ? def.steps.length - 1 : cs.step;
              const pts = def.steps.slice(0, upto + 1).map((st) => placeAt(st.place));
              return (
                <g key={cs.id} class={`thread ${done ? 'done' : ''}`}>
                  {pts.slice(1).map((q, i) => {
                    const a = pts[i]!;
                    // El último tramo de una historia en marcha lleva al paso que falta.
                    const next = !done && i === pts.length - 2;
                    return (
                      <g key={i} class={next ? 'next' : ''}>
                        <line x1={a.x} y1={a.y} x2={q.x} y2={q.y} />
                        <path d={arrow(a, q, unit)} />
                      </g>
                    );
                  })}
                </g>
              );
            })}
            {game.missions.map((m) => {
              const p = placeAt(m.quest.place);
              return (
                <line key={m.id} x1={TAVERN.x} y1={TAVERN.y} x2={p.x} y2={p.y} class="route" />
              );
            })}
          </svg>
          {REGIONS.filter((r) => regionSeen(r.x, r.y)).map((r) => (
            <span key={r.name} class="map-region" style={pct(r.x, r.y)} aria-hidden="true">
              {r.name}
            </span>
          ))}
          {Object.entries(PLACE_INFO)
            .filter(([n]) => known(n))
            .map(([n, p]) => (
              <button
                key={n}
                class={`map-place ${info?.kind === 'place' && info.name === n ? 'on' : ''}`}
                style={pct(p.x, p.y)}
                onClick={(e) => {
                  e.stopPropagation();
                  tap(() => setInfo({ kind: 'place', name: n }))();
                }}
              >
                <i />
                <small>{n}</small>
              </button>
            ))}
          <button
            class="map-tavern"
            style={pct(TAVERN.x, TAVERN.y)}
            title={customOf(game).name}
            onClick={(e) => {
              e.stopPropagation();
              tap(() => setInfo({ kind: 'tavern' }))();
            }}
          >
            <b>
              <Icon name="home" size={14} />
            </b>
            <small>{customOf(game).name}</small>
          </button>
          {(game.chains ?? []).flatMap((cs) => {
            const def = chainDef(cs.id);
            const done = cs.status === 'hecha';
            const upto = done ? def.steps.length - 1 : cs.step;
            return def.steps.slice(0, upto + 1).map((st, i) => {
              const p = placeAt(st.place);
              const now = !done && i === cs.step;
              return (
                <button
                  key={`${cs.id}-${i}`}
                  class={`map-step ${now ? 'now' : 'past'} ${done ? 'closed' : ''}`}
                  data-help={`«${def.name}»: ${now ? `paso ${i + 1}, el siguiente que hay que hacer` : `paso ${i + 1}, hecho`}.`}
                  style={pct(p.x - 9, p.y - 3)}
                  aria-label={`«${def.name}», paso ${i + 1} de ${def.steps.length}: ${now ? 'el siguiente' : 'hecho'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    tap(() => setInfo({ kind: 'chain', id: cs.id }))();
                  }}
                >
                  {now ? i + 1 : <Icon name="check" size={7} />}
                </button>
              );
            });
          })}
          {game.quests.map((q) => {
            const p = placeAt(q.place);
            const n = (pinsAt[q.place] = (pinsAt[q.place] ?? 0) + 1) - 1;
            const hidden = q.dangerHidden && level < 2;
            return (
              <button
                key={q.id}
                class={`map-pin danger-${dangerClass(q.danger, hidden)} ${q.chain ? 'chain' : ''}`}
                data-help={`Encargo: ${q.title}. El color dice el peligro (${hidden ? 'sin saber' : DANGER_NAMES[q.danger]!.toLowerCase()})${q.chain ? '; el aro dorado, que es de una historia' : ''}.`}
                style={pct(p.x + n * 7, p.y - 6)}
                aria-label={`${q.title} (${q.place})`}
                onClick={(e) => {
                  e.stopPropagation();
                  tap(() => setInfo({ kind: 'place', name: q.place }))();
                }}
              >
                !
              </button>
            );
          })}
          {game.missions.map((m, i) => {
            const pos = partyPos(m.quest.place, m.quest.days, m.daysLeft);
            const party = m.heroIds.map(byId).filter((h): h is Hero => !!h);
            // Dos grupos en el mismo sitio se ponen uno al lado del otro (si no, se pisan).
            const near = game.missions.slice(0, i).filter((o) => {
              const p = partyPos(o.quest.place, o.quest.days, o.daysLeft);
              return Math.abs(p.x - pos.x) < 14 && Math.abs(p.y - pos.y) < 14;
            }).length;
            return (
              <button
                key={m.id}
                class={`map-party ${pos.back ? 'is-back' : ''}`}
                data-help={`Grupo de viaje (${party.length}): ${pos.back ? 'vuelve de' : 'va hacia'} ${m.quest.place}. Gris a la vuelta.`}
                style={{ ...pct(pos.x, pos.y), '--dx': `${near * 20}px` }}
                aria-label={`${listNames(party.map((h) => h.name))}: ${pos.back ? 'vuelven de' : 'van hacia'} ${m.quest.place}`}
                onClick={(e) => {
                  e.stopPropagation();
                  tap(() => onTrip(m.id))();
                }}
              >
                {party.length}
              </button>
            );
          })}
          {missing.map((h) => (
            <button
              key={h.id}
              class="map-missing"
              data-help={`Aquí se perdió la pista de ${h.name}.`}
              style={pct(placeAt(h.lostAt ?? '').x + 6, placeAt(h.lostAt ?? '').y + 4)}
              aria-label={`${h.name}: se le perdió la pista aquí`}
              onClick={(e) => {
                e.stopPropagation();
                tap(() => setInfo({ kind: 'place', name: h.lostAt ?? '' }))();
              }}
            >
              ?
            </button>
          ))}
          {game.raid?.warned && (
            <span
              class="map-raid"
              data-help={`${game.raid.band} viene hacia la taberna: llega en ${left(game.raid.day - game.day, game.clock ?? 0, 'noche', 'noches')}.`}
              style={pct(
                Math.max(8, TAVERN.x - 14 * Math.max(1, game.raid.day - game.day)),
                TAVERN.y + 10,
              )}
              title={`${game.raid.band}: llega en ${left(game.raid.day - game.day, game.clock ?? 0, 'noche', 'noches')}`}
            >
              <Icon name="espadas" size={15} />
            </span>
          )}
        </div>
        {cardEl}
        <div class="map-tools" onPointerDown={(e) => e.stopPropagation()}>
          <span class="map-level" aria-label={`Zoom ×${view.l}`}>
            ×{view.l}
          </span>
          <button
            class="btn-icon"
            aria-label="Acercar el mapa"
            disabled={view.l >= MAX_LEVEL}
            onClick={() => zoomTo(view.l + 1, size.w / 2, size.h / 2)}
          >
            <Icon name="plus" size={14} />
          </button>
          <button
            class="btn-icon"
            aria-label="Alejar el mapa"
            disabled={view.l <= 1}
            onClick={() => zoomTo(view.l - 1, size.w / 2, size.h / 2)}
          >
            <Icon name="minus" size={14} />
          </button>
          <button
            class="btn-icon"
            aria-label="Ver la taberna"
            onClick={() =>
              setView(centerOn(Math.max(view.l, 2), TAVERN.x, TAVERN.y, size.w, size.h))
            }
          >
            <Icon name="home" size={14} />
          </button>
          <button
            class={`btn-icon map-help ${legend ? 'is-on' : ''}`}
            aria-label="Qué es cada cosa"
            aria-expanded={legend}
            onClick={() => setLegend(!legend)}
          >
            ?
          </button>
        </div>
        <div class="map-over" onPointerDown={(e) => e.stopPropagation()}>
          {threat > 0 && !legend && (
            <p
              class="map-threat-line"
              {...help('Amenaza en la comarca: crece si una historia espera en el tablón.')}
            >
              <Icon name="calavera" size={10} /> Amenaza {threat}
            </p>
          )}
          {legend && (
            <ul class="map-legend">
              <li>
                <span class="lg-pin">!</span> Encargo
              </li>
              <li>
                <span class="lg-party">2</span> Grupo de viaje
              </li>
              <li>
                <span class="lg-missing">?</span> Desaparecido
              </li>
              <li>
                <i class="lg-route" /> Camino de un grupo
              </li>
              <li>
                <i class="lg-thread" />
                <span class="lg-step past">
                  <Icon name="check" size={7} />
                </span>{' '}
                Historia: paso hecho
              </li>
              <li>
                <i class="lg-thread next" />
                <span class="lg-step now">2</span> Historia: siguiente paso
              </li>
              {threat > 0 && <li class="lg-threat">Amenaza en la comarca: {threat}</li>}
            </ul>
          )}
          {legend && (
            <p class="map-hint">
              Toca un lugar para ver qué hay y un grupo para ver su viaje; arrastra o pellizca para
              moverte.
              {level < 2 && ' La niebla se levanta explorando (la sala de mapas ayuda).'}
            </p>
          )}
        </div>
      </div>
      <section class="map-trips" aria-label="Grupos fuera">
        <button
          class="map-trips-toggle"
          aria-expanded={trips}
          onClick={() => {
            audio.play(trips ? 'close' : 'open', 0.6);
            setTrips(!trips);
          }}
        >
          <Icon name="pasos" size={14} />
          <b>Grupos fuera</b>
          {game.missions.length > 0 && <span class="row-sub">{game.missions.length}</span>}
          {!trips && soonest && (
            <span class="map-trips-next">
              {soonest.quest.title}: en casa en {left(soonest.daysLeft, game.clock ?? 0)}
            </span>
          )}
          <span class="map-trips-chev" aria-hidden="true">
            {trips ? '▾' : '▴'}
          </span>
        </button>
        {!trips ? null : game.missions.length ? (
          <ul class="map-trip-list">
            {[...game.missions]
              .sort((a, b) => a.daysLeft - b.daysLeft)
              .map((m) => {
                const pos = partyPos(m.quest.place, m.quest.days, m.daysLeft);
                const done = Math.min(1, Math.max(0, (m.quest.days - m.daysLeft) / m.quest.days));
                return (
                  <li key={m.id} class="map-trip">
                    <button
                      class="map-trip-main"
                      aria-label={`${m.quest.title}: ver el viaje`}
                      onClick={() => onTrip(m.id)}
                    >
                      <b>{m.quest.title}</b>
                      <span class="row-sub">
                        {pos.back ? 'Vuelven de' : 'Van hacia'} {m.quest.place} · en casa en{' '}
                        {left(m.daysLeft, game.clock ?? 0)}
                      </span>
                      <span class="train-bar" aria-hidden="true">
                        <i style={{ width: `${Math.round(done * 100)}%` }} />
                      </span>
                    </button>
                    <div class="map-trip-heroes">
                      {party(m).map((h) => (
                        <button key={h.id} class="btn btn-wood" onClick={() => onHero(h.id)}>
                          {h.name}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
          </ul>
        ) : (
          <p class="tiny">No hay ningún grupo fuera. Los encargos se mandan desde el tablón.</p>
        )}
      </section>
    </div>
  );
}
