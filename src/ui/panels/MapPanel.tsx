import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fogBuffer, mapBuffer } from '../../art/map';
import { chainDef } from '../../core/chains';
import { customOf } from '../../core/game';
import type { GameState, Hero, Quest } from '../../core/model';
import { dangerClass } from '../../data/labels';
import {
  KNOWN_RADIUS,
  MAP_H,
  MAP_W,
  PLACE_INFO,
  REVEAL_RADIUS,
  TAVERN,
  placeAt,
  type Terrain,
} from '../../data/places';
import { BufferImage } from '../BufferImage';
import { Icon, type IconName } from '../icons';
import { listNames, plural } from '../text';

interface Props {
  game: GameState;
  onQuest: (id: string) => void;
  onHero: (id: string) => void;
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
    <span class="mc-stat" title={label} aria-label={label}>
      <Icon name={icon} size={11} />
      {children}
    </span>
  );
}
const MAX_ZOOM = 4;

type Info = { kind: 'place'; name: string } | { kind: 'party'; id: string } | { kind: 'tavern' };

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
 * un grupo abre una ficha flotante dentro del propio mapa.
 */
export function MapPanel({ game, onQuest, onHero }: Props) {
  const level = game.fac.mapas;
  const explored = game.explored ?? [];
  const knownRadius = KNOWN_RADIUS + (level >= 1 ? 20 : 0);
  const known = (name: string) =>
    level >= 2 ||
    explored.includes(name) ||
    Math.hypot(placeAt(name).x - TAVERN.x, placeAt(name).y - TAVERN.y) < knownRadius;
  const fogKey = `${level}|${explored.join(',')}`;
  const fog = useMemo(
    () =>
      level >= 2
        ? null
        : fogBuffer([
            { x: TAVERN.x, y: TAVERN.y, r: knownRadius },
            ...explored.map((n) => ({ ...placeAt(n), r: REVEAL_RADIUS })),
          ]),
    [fogKey],
  );
  const byId = (id: string) => game.heroes.find((h) => h.id === id);
  // La amenaza nace donde termina la historia en marcha (o la última).
  const threat = game.threat ?? 0;
  const lastChain = [...(game.chains ?? [])].reverse()[0];
  const threatAt = lastChain ? placeAt(chainDef(lastChain.id).steps.at(-1)!.place) : null;
  const missing = game.heroes.filter((h) => h.status === 'desaparecido');
  const pinsAt: Record<string, number> = {};

  // ---------- Zoom y arrastre ----------
  const vp = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const [info, setInfo] = useState<Info | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(0);
  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight ?? 0;
    if (h !== cardH) setCardH(h);
  });
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; pinch: number; z: number } | null>(null);
  useEffect(() => {
    const el = vp.current;
    if (!el) return;
    const fit = () => setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 });
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const clampView = (v: { z: number; x: number; y: number }) => ({
    z: v.z,
    x: Math.min(0, Math.max(size.w - size.w * v.z, v.x)),
    y: Math.min(0, Math.max(size.h - size.h * v.z, v.y)),
  });
  const zoomAt = (factor: number, px: number, py: number) =>
    setView((v) => {
      const z = Math.max(1, Math.min(MAX_ZOOM, v.z * factor));
      return clampView({ z, x: px - ((px - v.x) * z) / v.z, y: py - ((py - v.y) * z) / v.z });
    });
  const local = (e: PointerEvent | WheelEvent) => {
    const r = vp.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: PointerEvent) => {
    ptrs.current.set(e.pointerId, local(e));
    gesture.current ??= { moved: 0, pinch: 0, z: view.z };
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      gesture.current.pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      gesture.current.z = view.z;
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
        const target = (gesture.current.z * d) / gesture.current.pinch;
        zoomAt(target / view.z, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
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
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = local(e);
    zoomAt(e.deltaY < 0 ? 1.25 : 0.8, p.x, p.y);
  };
  // Posición en el visor (px) de un punto del mapa.
  const screen = (mx: number, my: number) => ({
    x: view.x + (mx / MAP_W) * size.w * view.z,
    y: view.y + (my / MAP_H) * size.h * view.z,
  });

  // ---------- Ficha flotante ----------
  const questsAt = (name: string) => game.quests.filter((q) => q.place === name);
  const missionsTo = (name: string) => game.missions.filter((m) => m.quest.place === name);
  const days = (n: number) => (
    <Stat icon="reloj" label={`${n} ${plural(n, 'día', 'días')}`}>
      {n}d
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
  } else if (info?.kind === 'party') {
    const m = game.missions.find((x) => x.id === info.id);
    if (m) {
      const pos = partyPos(m.quest.place, m.quest.days, m.daysLeft);
      card = {
        ...screen(pos.x, pos.y),
        body: (
          <>
            <b class="map-card-title">{m.quest.title}</b>
            <span class="mc-stats">
              <Stat icon="pasos" label={pos.back ? 'Vuelven de' : 'Van hacia'}>
                {pos.back ? '← ' : '→ '}
                {m.quest.place}
              </Stat>
              <Stat
                icon="home"
                label={`Vuelven en ${m.daysLeft} ${plural(m.daysLeft, 'día', 'días')}`}
              >
                {m.daysLeft}d
              </Stat>
            </span>
            <div class="map-card-heroes">
              {party(m).map((h) => (
                <button key={h.id} class="btn btn-wood" onClick={() => onHero(h.id)}>
                  {h.name}
                </button>
              ))}
            </div>
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
  // La ficha tiene un ancho fijo; se mide su alto para ver si cabe encima o debajo del punto.
  // Si no cabe en ningún lado (mapa bajito, en vertical), se acopla debajo del mapa.
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
    <div class="map-wrap">
      <div
        ref={vp}
        class="map-viewport"
        style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      >
        <div
          class="map"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
            ['--inv' as string]: String(1 / view.z),
          }}
          onClick={tap(() => setInfo(null))}
        >
          <BufferImage buf={mapBuffer()} scale={1} class="map-layer" label="Mapa de la comarca" />
          {fog && <BufferImage buf={fog} scale={1} class="map-layer" />}
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
          <svg class="map-routes" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true">
            {(game.chains ?? []).map((cs) => {
              const def = chainDef(cs.id);
              const upto = cs.status === 'hecha' ? def.steps.length - 1 : cs.step;
              const pts = def.steps.slice(0, upto + 1).map((st) => placeAt(st.place));
              return (
                <g key={cs.id} class={`thread ${cs.status === 'hecha' ? 'done' : ''}`}>
                  <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} />
                  {def.steps
                    .slice(0, cs.status === 'hecha' ? def.steps.length : cs.step)
                    .map((st, i) => {
                      const p = placeAt(st.place);
                      return (
                        <g key={i}>
                          <line x1={p.x - 2.5} y1={p.y - 2.5} x2={p.x + 2.5} y2={p.y + 2.5} />
                          <line x1={p.x - 2.5} y1={p.y + 2.5} x2={p.x + 2.5} y2={p.y - 2.5} />
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
            <b>⌂</b>
            <small>{customOf(game).name}</small>
          </button>
          {game.quests.map((q) => {
            const p = placeAt(q.place);
            const n = (pinsAt[q.place] = (pinsAt[q.place] ?? 0) + 1) - 1;
            const hidden = q.dangerHidden && level < 2;
            return (
              <button
                key={q.id}
                class={`map-pin danger-${dangerClass(q.danger, hidden)} ${q.chain ? 'chain' : ''}`}
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
          {game.missions.map((m) => {
            const pos = partyPos(m.quest.place, m.quest.days, m.daysLeft);
            const party = m.heroIds.map(byId).filter((h): h is Hero => !!h);
            return (
              <button
                key={m.id}
                class={`map-party ${pos.back ? 'back' : ''}`}
                style={pct(pos.x, pos.y)}
                aria-label={`${listNames(party.map((h) => h.name))}: ${pos.back ? 'vuelven de' : 'van hacia'} ${m.quest.place}`}
                onClick={(e) => {
                  e.stopPropagation();
                  tap(() => setInfo({ kind: 'party', id: m.id }))();
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
              style={pct(
                Math.max(8, TAVERN.x - 14 * Math.max(1, game.raid.day - game.day)),
                TAVERN.y + 10,
              )}
              title={`${game.raid.band}: llega en ${game.raid.day - game.day} noches`}
            >
              ⚔
            </span>
          )}
        </div>
        {place !== 'dock' && cardEl}
        <div class="map-tools" onPointerDown={(e) => e.stopPropagation()}>
          <button
            class="btn-icon"
            aria-label="Acercar el mapa"
            onClick={() => zoomAt(1.5, size.w / 2, size.h / 2)}
          >
            <Icon name="plus" size={14} />
          </button>
          <button
            class="btn-icon"
            aria-label="Alejar el mapa"
            onClick={() => zoomAt(1 / 1.5, size.w / 2, size.h / 2)}
          >
            <Icon name="minus" size={14} />
          </button>
          <button
            class="btn-icon"
            aria-label="Ver la taberna"
            onClick={() => {
              const z = Math.max(view.z, 2);
              const t = { x: (TAVERN.x / MAP_W) * size.w * z, y: (TAVERN.y / MAP_H) * size.h * z };
              setView(clampView({ z, x: size.w / 2 - t.x, y: size.h / 2 - t.y }));
            }}
          >
            <Icon name="home" size={14} />
          </button>
        </div>
      </div>
      {place === 'dock' && cardEl}
      <p class="map-legend">
        <span class="lg-pin">!</span> encargos · <span class="lg-party">2</span> grupos de viaje ·{' '}
        <span class="lg-missing">?</span> desaparecidos · <i class="lg-route" /> camino de un grupo,
        de la taberna al encargo · <i class="lg-thread" /> hilo de una historia: une sus pasos, con
        una cruz en los hechos
        {threat > 0 && ` · Amenaza en la comarca: ${threat}`} · Toca un lugar para ver qué hay;
        arrastra y usa la rueda o los botones para moverte.
        {level < 2 && ' La niebla se levanta explorando (la sala de mapas ayuda).'}
      </p>
    </div>
  );
}
