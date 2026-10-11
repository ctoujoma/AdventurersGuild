import type { SceneHero, SceneHeroStatus, TavernModel } from '../../art/tavern/scene';
import { STATUS_LABEL, type DemoHero } from '../../data/demo';
import { PixelSprite } from '../PixelSprite';
import { TavernView } from '../TavernView';

interface Props {
  model: TavernModel;
  heroes: DemoHero[];
  sprites: Map<string, SceneHero>;
}

const ORDER: SceneHeroStatus[] = ['ok', 'candidato', 'herido', 'mision'];

export function Taberna({ model, heroes, sprites }: Props) {
  return (
    <>
      <TavernView model={model} />
      <p class="hint">Toca a alguien en la escena para ver quién es.</p>
      {ORDER.map((status) => {
        const group = heroes.filter((h) => h.status === status);
        if (!group.length) return null;
        return (
          <section class="sec" key={status}>
            <h2>{STATUS_LABEL[status]}</h2>
            <div class="chips">
              {group.map((h) => (
                <span class="who" key={h.id}>
                  <PixelSprite pixels={sprites.get(h.id)!.sprite} scale={1} />
                  {h.name}
                  {h.days ? <small>{h.days} d</small> : null}
                </span>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
