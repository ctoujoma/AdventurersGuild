import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { mapStyleFor } from '../art/map';
import {
  OX,
  OY,
  WORLD_H,
  WORLD_W,
  expPoint,
  markBuffer,
  peekWorld,
  trailBuffer,
  trailClears,
  worldBuffer,
  type Clear,
  type Trail,
} from '../art/expMap';
import type { PixelBuffer } from '../art/pixel';
import { ExpeditionFog } from './ExpeditionFog';
import { TAVERN } from '../data/places';
import { HEADINGS, OPEN_HEADINGS, bundleMsg, distAt } from '../core/expedition';
import type { GameState, Heading } from '../core/model';
import { BufferImage } from './BufferImage';
import { Icon } from './icons';
import { listNames } from './text';
import { msg, t, tx } from '../textos';

interface Props {
  game: GameState;
  /** Abre el visor de una expedición. */
  onExpedition: (id: string) => void;
  /** El selector «Comarca / Rumbos», encima. */
  children?: preact.ComponentChildren;
}

const MAX_LEVEL = 4;
const pct = (p: { x: number; y: number }) => ({
  left: `${(p.x / WORLD_W) * 100}%`,
  top: `${(p.y / WORLD_H) * 100}%`,
});

type Info =
  { kind: 'site'; id: string } | { kind: 'bundle'; id: string } | { kind: 'rumbo'; h: Heading };

/**
 * El mapa de rumbos (bloque 3; EX16): la comarca en el centro y los cuatro rumbos bajo la niebla,
 * que se despeja hasta donde ha llegado el gremio (el récord de cada rumbo) y por donde van los
 * grupos de ahora. Encima, la estela de cada expedición, los parajes vistos y los fardos perdidos.
 * Se arrastra y se acerca (a escala entera). El dibujo, la estela y las marcas, en
 * `art/expMap.ts`; la niebla, que se mueve, en `ExpeditionFog.tsx`.
 */
export function ExpeditionMap({ game, onExpedition, children }: Props) {
  const style = mapStyleFor(game.fac.mapas);
  // El dibujo tarda un poco la primera vez: se hace tras pintar la vista (y mientras, el fondo).
  const [buf, setBuf] = useState<PixelBuffer | null>(() => peekWorld(style));
  useEffect(() => {
    const hit = peekWorld(style);
    if (hit) {
      setBuf(hit);
      return;
    }
    const id = setTimeout(() => setBuf(worldBuffer(style)), 30);
    return () => clearTimeout(id);
  }, [style]);
  const exps = game.expeditions ?? [];
  const best = game.expBest ?? {};
  const sites = game.expSites ?? [];
  const bundles = game.expBundles ?? [];
  // Hasta dónde se ve: el récord de cada rumbo y lo que llevan andado los de ahora.
  const reach = (h: Heading) =>
    Math.max(
      best[h] ?? 0,
      ...exps.filter((e) => e.heading === h).map((e) => e.turn?.dist ?? distAt(e)),
    );
  const fogKey = HEADINGS.map((h) => reach(h).toFixed(1)).join('|') + `|${sites.length}|${style}`;
  const clears = useMemo(() => {
    const out: Clear[] = [];
    for (const h of HEADINGS) out.push(...trailClears(h, reach(h)));
    for (const s of sites) out.push({ ...expPoint(s.heading, s.dist, s.side), r: 14 });
    return out;
  }, [fogKey]);
  // La estela de pasos: la del récord de cada rumbo y la de los grupos de ahora.
  const trails: Trail[] = [
    ...HEADINGS.filter((h) => best[h] !== undefined).map((h) => ({
      h,
      dist: best[h]!,
      now: false,
    })),
    ...exps.map((e) => ({ h: e.heading, dist: e.turn?.dist ?? distAt(e), now: true })),
  ];
  const trailKey = trails.map((x) => `${x.h}${x.dist.toFixed(2)}${x.now}`).join('|') + style;
  const steps = useMemo(() => trailBuffer(trails, style), [trailKey]);

  // ---------- Arrastre y zoom ----------
  const vp = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const [size, setSize] = useState({ w: 1, h: 1 });
  const clamp = (v: { z: number; x: number; y: number }, w = size.w, h = size.h) => {
    const mw = WORLD_W * v.z;
    const mh = WORLD_H * v.z;
    return {
      z: v.z,
      x: mw <= w ? (w - mw) / 2 : Math.min(0, Math.max(w - mw, v.x)),
      y: mh <= h ? (h - mh) / 2 : Math.min(0, Math.max(h - mh, v.y)),
    };
  };
  useEffect(() => {
    const el = vp.current;
    if (!el) return;
    const fit = () => setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 });
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    const z = Math.max(1, Math.floor(Math.min(w / WORLD_W, h / WORLD_H)) + 1);
    // Centrado entre la taberna y lo más lejos que se ha llegado (o donde van los de ahora).
    const far = [...HEADINGS].sort((a, b) => reach(b) - reach(a))[0]!;
    const tip = expPoint(far, reach(far) + 0.8);
    const cx = (OX + TAVERN.x + tip.x) / 2;
    const cy = (OY + TAVERN.y + tip.y) / 2;
    setView(clamp({ z, x: w / 2 - cx * z, y: h / 2 - cy * z }, w, h));
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const zoomTo = (z: number, px = size.w / 2, py = size.h / 2) =>
    setView((v) => {
      const nz = Math.max(1, Math.min(MAX_LEVEL, z));
      if (nz === v.z) return v;
      return clamp({ z: nz, x: px - ((px - v.x) * nz) / v.z, y: py - ((py - v.y) * nz) / v.z });
    });
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);
  const onDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    d.moved += Math.abs(dx) + Math.abs(dy);
    if (d.moved > 4) {
      vp.current?.setPointerCapture(e.pointerId);
      setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };
  const onUp = () => setTimeout(() => (drag.current = null), 0);
  const tap = (fn: () => void) => (e: Event) => {
    e.stopPropagation();
    if ((drag.current?.moved ?? 0) > 4) return;
    fn();
  };
  const wheel = useRef(0);
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    wheel.current += e.deltaY;
    if (Math.abs(wheel.current) < 60) return;
    const r = vp.current!.getBoundingClientRect();
    zoomTo(view.z + (wheel.current < 0 ? 1 : -1), e.clientX - r.left, e.clientY - r.top);
    wheel.current = 0;
  };

  const [info, setInfo] = useState<Info | null>(null);
  // Las marcas siguen el tamaño de los píxeles del mapa (y al menos al doble, para tocarlas).
  const mark = Math.max(2, view.z);
  const card = (() => {
    if (!info) return null;
    if (info.kind === 'site') {
      const s = sites.find((x) => x.id === info.id);
      if (!s) return null;
      return (
        <>
          <b>
            {t('expediciones.mapa.paraje', { que: msg(`expediciones.sucesos.${s.kind}.titulo`) })}
          </b>
          <span>
            {t('expediciones.mapa.donde', {
              rumbo: s.heading,
              dias: Math.max(1, Math.round(s.dist)),
            })}
          </span>
          <span>
            {s.done
              ? t('expediciones.mapa.explorado', { dia: s.done })
              : t('expediciones.mapa.sin_explorar', { dia: s.day })}
          </span>
        </>
      );
    }
    if (info.kind === 'bundle') {
      const b = bundles.find((x) => x.id === info.id);
      if (!b) return null;
      return (
        <>
          <b>{t('expediciones.mapa.fardo', { quien: b.who, m: b.who.length })}</b>
          <span>
            {t('expediciones.mapa.donde', {
              rumbo: b.heading,
              dias: Math.max(1, Math.round(b.dist)),
            })}
          </span>
          <span>{t('expediciones.mapa.fardo_lleva', { que: tx(bundleMsg(b)), dia: b.day })}</span>
        </>
      );
    }
    const h = info.h;
    const r = best[h];
    return (
      <>
        <b>{t(`expediciones.rumbos.${h}.titulo`)}</b>
        <span>
          {!OPEN_HEADINGS.includes(h)
            ? t('expediciones.mapa.en_obras')
            : r === undefined
              ? t('expediciones.mapa.sin_ir')
              : t('expediciones.mapa.record', { dias: Math.round(r) })}
        </span>
        <span>
          {t('expediciones.mapa.parajes', {
            n: sites.filter((x) => x.heading === h).length,
          })}
        </span>
      </>
    );
  })();

  return (
    <div
      ref={vp}
      class="map-viewport exp-map"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={onWheel}
    >
      <div
        class="map"
        style={{
          width: `${WORLD_W}px`,
          height: `${WORLD_H}px`,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
          ['--inv' as string]: String(1 / view.z),
        }}
        onClick={tap(() => setInfo(null))}
      >
        {buf && (
          <BufferImage
            buf={buf}
            scale={1}
            class="map-layer"
            label={t('expediciones.mapa.titulo')}
          />
        )}
        <BufferImage buf={steps} scale={1} class="map-layer" />
        <ExpeditionFog clears={clears} style={style} />
        {HEADINGS.map((h) => {
          const at = expPoint(h, Math.max(1.6, reach(h) + 0.8));
          return (
            <button
              key={h}
              class={`exp-map-rumbo ${OPEN_HEADINGS.includes(h) ? '' : 'is-works'}`}
              style={pct(at)}
              onClick={tap(() => setInfo({ kind: 'rumbo', h }))}
            >
              {t(`expediciones.rumbos.${h}.titulo`)}
              {best[h] !== undefined && (
                <small>{t('expediciones.mapa.record_corto', { dias: Math.round(best[h]!) })}</small>
              )}
            </button>
          );
        })}
        {sites.map((s) => (
          <button
            key={s.id}
            class={`exp-map-mark ${s.done ? 'is-done' : ''}`}
            style={pct(expPoint(s.heading, s.dist, s.side))}
            aria-label={t('expediciones.mapa.paraje', {
              que: msg(`expediciones.sucesos.${s.kind}.titulo`),
            })}
            onClick={tap(() => setInfo({ kind: 'site', id: s.id }))}
          >
            <BufferImage buf={markBuffer(s.kind, style)} scale={mark} />
          </button>
        ))}
        {bundles.map((b) => (
          <button
            key={b.id}
            class="exp-map-mark is-bundle"
            style={pct(expPoint(b.heading, b.dist, b.side))}
            aria-label={t('expediciones.mapa.fardo', { quien: b.who, m: b.who.length })}
            onClick={tap(() => setInfo({ kind: 'bundle', id: b.id }))}
          >
            <BufferImage buf={markBuffer('fardo', style)} scale={mark} />
          </button>
        ))}
        <span class="map-tavern exp-map-home" style={pct({ x: OX + TAVERN.x, y: OY + TAVERN.y })}>
          <Icon name="home" size={12} />
        </span>
        {exps.map((e) => (
          <button
            key={e.id}
            class={`map-party exp-map-party ${e.pending ? 'is-waiting' : ''}`}
            style={pct(expPoint(e.heading, distAt(e)))}
            aria-label={t('expediciones.mappanel.ver', {
              rumbo: e.heading,
              quien: listNames(
                e.heroIds.map((id) => game.heroes.find((h) => h.id === id)?.name ?? ''),
              ),
            })}
            onClick={tap(() => onExpedition(e.id))}
          >
            {e.pending ? '!' : e.heroIds.length}
          </button>
        ))}
      </div>
      {card && (
        <div class="exp-map-card" onPointerDown={(e) => e.stopPropagation()}>
          <button
            class="btn-icon exp-map-x"
            aria-label={t('expediciones.mapa.cerrar')}
            onClick={() => setInfo(null)}
          >
            <Icon name="close" size={10} />
          </button>
          {card}
        </div>
      )}
      {children}
      <div class="map-tools" onPointerDown={(e) => e.stopPropagation()}>
        <span class="map-level">×{view.z}</span>
        <button
          class="btn-icon"
          aria-label={t('expediciones.mapa.acercar')}
          disabled={view.z >= MAX_LEVEL}
          onClick={() => zoomTo(view.z + 1)}
        >
          <Icon name="plus" size={14} />
        </button>
        <button
          class="btn-icon"
          aria-label={t('expediciones.mapa.alejar')}
          disabled={view.z <= 1}
          onClick={() => zoomTo(view.z - 1)}
        >
          <Icon name="minus" size={14} />
        </button>
      </div>
    </div>
  );
}
