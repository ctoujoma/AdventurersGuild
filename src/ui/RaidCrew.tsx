/**
 * La tira de abajo durante el asalto en directo: la barra común de las peleas (`FightCrew`) con
 * los nuestros. Tocar una tarjeta coge el crítico si lo tiene abierto y, si no, lanza la
 * habilidad cuando está lista (también desde su cinta). Para moverlos, se les arrastra en la
 * escena a una sala; para elegir a por quién van, se toca a un bandido.
 */
import { useEffect, useState } from 'preact/hooks';
import type { GameState } from '../core/model';
import { FightCrew, crewCard, type CrewCard } from './FightCrew';
import type { GameScene } from './SceneView';
import { heroFrame, lookOf, marksOf } from './view';

export function RaidCrew({
  game,
  scene,
}: {
  game: GameState;
  scene: { current: GameScene | null };
}) {
  const [crew, setCrew] = useState<CrewCard[]>([]);
  const [end, setEnd] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      const live = scene.current?.liveRaid?.live;
      if (!live) return setCrew([]);
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
      setCrew(
        live
          .defs()
          .filter((d) => !d.worker)
          .map((d) => {
            const h = game.heroes.find((x) => x.id === d.id);
            return crewCard(d, {
              name: h?.name ?? d.id,
              look: h ? lookOf(h) : undefined,
              marks: h ? marksOf(h) : undefined,
              frame: h ? heroFrame(h) : undefined,
              moving: !!d.to,
            });
          }),
      );
    };
    read();
    const id = setInterval(read, 150);
    return () => clearInterval(id);
  }, [game, scene]);
  if (!crew.length) return null;
  const raid = () => scene.current?.liveRaid;
  return (
    <div class="raid-crew">
      <p class={`raid-crew-hint ${end ? 'is-end' : ''}`}>
        {end ?? 'Arrastra a los tuyos a una sala · toca a un bandido para ir a por él'}
      </p>
      <FightCrew
        crew={crew}
        label="Los que defienden la taberna"
        playing={!end}
        onCrit={(id) => raid()?.tap(id)}
        onPick={(id) => raid()?.tap(id)}
        onSkill={(id) => raid()?.live?.order({ kind: 'skill', who: id })}
      />
    </div>
  );
}
