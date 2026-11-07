/**
 * La tira de abajo durante el asalto en directo: cada uno de los nuestros con su vida y su
 * habilidad. Tocar el nombre coge el crítico si lo tiene; el botón lanza la habilidad. Para
 * moverlos, se les arrastra en la escena a una sala; para elegir a por quién van, se toca a un
 * bandido.
 */
import { useEffect, useState } from 'preact/hooks';
import { ABILITIES } from '../core/combat';
import type { GameState } from '../core/model';
import type { GameScene } from './SceneView';

interface Row {
  id: string;
  name: string;
  hp: number;
  down: boolean;
  /** 0–1: lo que lleva cargada la habilidad. */
  charge: number;
  skill?: keyof typeof ABILITIES;
  chance: boolean;
  /** De camino a otra sala. */
  moving: boolean;
}

export function RaidCrew({
  game,
  scene,
}: {
  game: GameState;
  scene: { current: GameScene | null };
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [end, setEnd] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      const live = scene.current?.liveRaid?.live;
      if (!live) return setRows([]);
      const r = live.result;
      setEnd(
        !r
          ? null
          : !r.escaped
            ? '¡Los habéis echado!'
            : r.stolen > 0
              ? `Se escapan con ${r.stolen} monedas.`
              : 'Se escapan, pero sin el oro.',
      );
      setRows(
        live
          .defs()
          .filter((d) => !d.worker)
          .map((d) => {
            const h = game.heroes.find((x) => x.id === d.id);
            const every = d.ability ? ABILITIES[d.ability].every : 1;
            return {
              id: d.id,
              name: h?.name ?? d.id,
              hp: d.hp / d.max,
              down: d.down,
              charge: d.ability ? 1 - d.charge / every : 0,
              skill: d.ability,
              chance: d.critOpen && !d.critTaken,
              moving: !!d.to,
            };
          }),
      );
    };
    read();
    const id = setInterval(read, 150);
    return () => clearInterval(id);
  }, [game, scene]);
  if (!rows.length) return null;
  const tap = (id: string) => scene.current?.liveRaid?.tap(id);
  return (
    <div class="raid-crew">
      <p class={`raid-crew-hint ${end ? 'is-end' : ''}`}>
        {end ?? 'Arrastra a los tuyos a una sala · toca a un bandido para ir a por él'}
      </p>
      <ul class="bossfight-crew" aria-label="Los que defienden la taberna">
        {rows.map((h) => {
          const ready = h.charge >= 1 && !h.down;
          return (
            <li
              key={h.id}
              class={`bf-hero ${h.down ? 'is-down' : ''} ${h.chance ? 'is-chance' : ''}`}
            >
              <button
                class="bf-hero-main"
                disabled={h.down}
                aria-label={`${h.name}${h.chance ? ': ¡crítico!' : ''}`}
                onClick={() => tap(h.id)}
              >
                <span class="bf-hero-name">
                  {h.name}
                  {h.chance && <b class="bf-now"> ¡Ahora!</b>}
                </span>
                <span class="bf-hp" aria-hidden="true">
                  <i style={{ width: `${Math.round(h.hp * 100)}%` }} />
                </span>
                <span class="bf-target">
                  {h.down ? 'en el suelo' : h.moving ? 'corriendo' : ''}
                </span>
              </button>
              {h.skill && (
                <button
                  class={`bf-skill ${ready ? 'is-ready' : ''}`}
                  disabled={!ready}
                  title={ABILITIES[h.skill].text}
                  onClick={() => tap(h.id)}
                >
                  <span class="bf-charge" style={{ height: `${Math.round(h.charge * 100)}%` }} />
                  <span class="bf-skill-name">{ABILITIES[h.skill].name}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
