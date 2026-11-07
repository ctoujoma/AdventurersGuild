/**
 * La tira de abajo durante el asalto en directo: una tarjeta por cada uno de los nuestros, con
 * su retrato, su vida y la carga de su habilidad. Tocarla coge el crítico si lo tiene abierto y,
 * si no, lanza la habilidad cuando está lista. Para moverlos, se les arrastra en la escena a una
 * sala; para elegir a por quién van, se toca a un bandido. Con seis caben en una fila en el móvil.
 */
import { useEffect, useState } from 'preact/hooks';
import type { HeroLook, HeroMarks } from '../art/heroes/look';
import { ABILITIES } from '../core/combat';
import type { GameState } from '../core/model';
import { Portrait } from './Portrait';
import type { GameScene } from './SceneView';
import { heroFrame, lookOf, marksOf } from './view';

interface Row {
  id: string;
  name: string;
  look?: HeroLook;
  marks?: HeroMarks;
  frame?: string;
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
              look: h ? lookOf(h) : undefined,
              marks: h ? marksOf(h) : undefined,
              frame: h ? heroFrame(h) : undefined,
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
      <ul
        class="rc-list"
        aria-label="Los que defienden la taberna"
        style={{ gridTemplateColumns: `repeat(${Math.min(rows.length, 6)}, minmax(0, 76px))` }}
      >
        {rows.map((h) => {
          const ready = h.charge >= 1 && !h.down;
          const skill = h.skill ? ABILITIES[h.skill] : null;
          const state = h.down ? 'en el suelo' : h.moving ? 'corriendo' : '';
          const label = [
            h.name,
            `vida ${Math.round(h.hp * 100)} %`,
            h.chance ? '¡crítico!' : '',
            skill && ready ? `${skill.name} lista` : '',
            state,
          ]
            .filter(Boolean)
            .join(', ');
          return (
            <li
              key={h.id}
              class={`rc-card ${h.down ? 'is-down' : ''} ${h.chance ? 'is-chance' : ''} ${ready ? 'is-ready' : ''}`}
            >
              <button
                class="rc-hit"
                disabled={h.down}
                aria-label={label}
                title={skill ? `${skill.name}: ${skill.text}` : h.name}
                onClick={() => tap(h.id)}
              >
                <span class="rc-face">
                  {h.look && (
                    <Portrait
                      look={h.look}
                      marks={h.marks}
                      scale={1}
                      alive={!h.down}
                      frame={h.frame}
                    />
                  )}
                  {h.chance && <b class="rc-now" aria-hidden="true" />}
                  {h.moving && !h.down && (
                    <i class="rc-run" aria-hidden="true">
                      »
                    </i>
                  )}
                </span>
                <span class={`rc-hp ${h.hp < 0.35 ? 'is-low' : ''}`} aria-hidden="true">
                  <i style={{ width: `${Math.round(h.hp * 100)}%` }} />
                </span>
                {skill && (
                  <span class="rc-skill" aria-hidden="true">
                    <i style={{ width: `${Math.round(Math.min(1, h.charge) * 100)}%` }} />
                    <span>{ready ? skill.name : ''}</span>
                  </span>
                )}
                <span class="rc-name" aria-hidden="true">
                  {h.down ? 'en el suelo' : h.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
