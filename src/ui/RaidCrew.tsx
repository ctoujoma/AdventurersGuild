/**
 * La tira de abajo durante el asalto en directo: la barra común de las peleas (`FightCrew`) con
 * los nuestros. Tocar una tarjeta coge el crítico si lo tiene abierto y, si no, lanza la
 * habilidad cuando está lista (también desde su cinta). Para moverlos, se les arrastra en la
 * escena a una sala; para elegir a por quién van, se toca a un bandido. Cuando el cabecilla
 * avisa de su golpe fuerte, «¡Cubríos!».
 */
import { useEffect, useState } from 'preact/hooks';
import type { GameState } from '../core/model';
import { FightCrew, crewCard, type CrewCard } from './FightCrew';
import type { GameScene } from './SceneView';
import { heroFrame, lookOf, marksOf } from './view';
import { t } from '../textos';

export function RaidCrew({
  game,
  scene,
}: {
  game: GameState;
  scene: { current: GameScene | null };
}) {
  const [crew, setCrew] = useState<CrewCard[]>([]);
  const [end, setEnd] = useState<string | null>(null);
  const [warn, setWarn] = useState(false);
  useEffect(() => {
    const read = () => {
      const show = scene.current?.liveRaid;
      const live = show?.live;
      if (!show || !live) return setCrew([]);
      setWarn(show.warning);
      const r = live.result;
      setEnd(
        !r
          ? null
          : !r.escaped
            ? t('paneles.raidcrew.los_habeis_echado')
            : r.stolen > 0
              ? t('paneles.raidcrew.se_escapan_con_monedas', { stolen: r.stolen })
              : t('paneles.raidcrew.se_escapan_pero_sin'),
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
      {/* Mientras avisa el cabecilla, «¡Cubríos!» ocupa el sitio de la pista (sin taparla a medias). */}
      <p class={`raid-crew-hint ${end ? 'is-end' : ''} ${warn && !end ? 'is-hidden' : ''}`}>
        {end ?? t('paneles.raidcrew.arrastra_a_los_tuyos')}
      </p>
      <FightCrew
        crew={crew}
        label={t('paneles.raidcrew.los_que_defienden_la')}
        playing={!end}
        onCrit={(id) => raid()?.tap(id)}
        onPick={(id) => raid()?.tap(id)}
        onSkill={(id) => raid()?.live?.order({ kind: 'skill', who: id })}
        warn={warn}
        onCover={() => {
          raid()?.cover();
          setWarn(false);
        }}
      />
    </div>
  );
}
