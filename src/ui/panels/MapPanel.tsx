import { useMemo } from 'preact/hooks';
import { fogBuffer, mapBuffer } from '../../art/map';
import { chainDef } from '../../core/chains';
import { customOf } from '../../core/game';
import type { GameState, Hero } from '../../core/model';
import { dangerClass } from '../../data/labels';
import {
  KNOWN_RADIUS,
  MAP_H,
  MAP_W,
  PLACE_INFO,
  REVEAL_RADIUS,
  TAVERN,
  placeAt,
} from '../../data/places';
import { BufferImage } from '../BufferImage';
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

/** Dónde va un grupo: media misión de ida y media de vuelta. */
function partyPos(place: string, days: number, left: number) {
  const p = placeAt(place);
  const f = Math.min(1, Math.max(0, (days - left + 0.5) / days));
  const k = f <= 0.5 ? f * 2 : 2 - f * 2;
  return { x: TAVERN.x + (p.x - TAVERN.x) * k, y: TAVERN.y + (p.y - TAVERN.y) * k, back: f > 0.5 };
}

/** Mapa de la comarca: encargos, grupos de viaje, desaparecidos y asaltos que se acercan. */
export function MapPanel({ game, onQuest, onHero }: Props) {
  const level = game.fac.mapas;
  const explored = game.explored ?? [];
  const known = (name: string) =>
    level >= 2 ||
    explored.includes(name) ||
    Math.hypot(placeAt(name).x - TAVERN.x, placeAt(name).y - TAVERN.y) <
      KNOWN_RADIUS + (level >= 1 ? 20 : 0);
  const fogKey = `${level}|${explored.join(',')}`;
  const fog = useMemo(
    () =>
      level >= 2
        ? null
        : fogBuffer([
            { x: TAVERN.x, y: TAVERN.y, r: KNOWN_RADIUS + (level >= 1 ? 20 : 0) },
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

  return (
    <div class="map-wrap">
      <div class="map" style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
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
            return <line key={m.id} x1={TAVERN.x} y1={TAVERN.y} x2={p.x} y2={p.y} class="route" />;
          })}
        </svg>
        {Object.entries(PLACE_INFO)
          .filter(([n]) => known(n))
          .map(([n, p]) => (
            <span key={n} class="map-place" style={pct(p.x, p.y)}>
              <i />
              <small>{n}</small>
            </span>
          ))}
        <span class="map-tavern" style={pct(TAVERN.x, TAVERN.y)} title={customOf(game).name}>
          <b>⌂</b>
          <small>{customOf(game).name}</small>
        </span>
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
              title={`${q.title} · ${q.reward} monedas · ${q.days} ${plural(q.days, 'día', 'días')}`}
              onClick={() => onQuest(q.id)}
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
              title={`${listNames(party.map((h) => h.name))}: ${pos.back ? 'vuelven de' : 'van hacia'} ${m.quest.place}`}
              onClick={() => party[0] && onHero(party[0].id)}
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
            title={`${h.name}: se le perdió la pista aquí`}
            onClick={() => onHero(h.id)}
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
      <p class="map-legend">
        <span class="lg-pin">!</span> encargos del tablón · <span class="lg-party">2</span> grupos
        de viaje · <span class="lg-missing">?</span> desaparecidos
        {threat > 0 && ` · Amenaza en la comarca: ${threat}`}
        {level < 2 &&
          ' · La niebla se levanta visitando lugares (y explorando); la sala de mapas ayuda.'}
      </p>
    </div>
  );
}
