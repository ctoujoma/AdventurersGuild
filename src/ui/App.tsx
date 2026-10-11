import { useMemo, useState } from 'preact/hooks';
import type { Facilities } from '../art/tavern/layout';
import type { TavernModel } from '../art/tavern/scene';
import { DEMO_FACILITIES, DEMO_HEROES, DEMO_QUESTS, type DemoHero } from '../data/demo';
import { keeperSprite, sceneHero } from './sprites';
import { TabBar, type TabId } from './TabBar';
import { TopBar } from './TopBar';
import { Gremio } from './screens/Gremio';
import { Heroes } from './screens/Heroes';
import { Tablon } from './screens/Tablon';
import { Taberna } from './screens/Taberna';

export function App() {
  const [tab, setTab] = useState<TabId>('taberna');
  const [fac, setFac] = useState<Facilities>(DEMO_FACILITIES);
  const [heroes, setHeroes] = useState<DemoHero[]>(DEMO_HEROES);
  const [loot, setLoot] = useState(3);

  const sprites = useMemo(() => new Map(heroes.map((h) => [h.id, sceneHero(h)])), [heroes]);
  const model = useMemo<TavernModel>(
    () => ({
      fac,
      quests: DEMO_QUESTS.length,
      loot,
      keeper: keeperSprite,
      heroes: [...sprites.values()],
    }),
    [fac, loot, sprites],
  );

  const updateHero = (id: string, patch: Partial<DemoHero>) =>
    setHeroes((list) => list.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  return (
    <div class="app">
      <TopBar />
      <main class="screen">
        {tab === 'taberna' && <Taberna model={model} heroes={heroes} sprites={sprites} />}
        {tab === 'tablon' && <Tablon />}
        {tab === 'heroes' && <Heroes heroes={heroes} sprites={sprites} onChange={updateHero} />}
        {tab === 'gremio' && (
          <Gremio model={model} fac={fac} setFac={setFac} loot={loot} setLoot={setLoot} />
        )}
      </main>
      <TabBar tab={tab} onTab={setTab} />
    </div>
  );
}
