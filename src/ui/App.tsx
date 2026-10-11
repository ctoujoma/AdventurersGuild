import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import {
  CAPTIONS,
  DEMO_FACILITIES,
  DEMO_HEROES,
  DEMO_QUESTS,
  FACILITY_INFO,
  toSceneHero,
  type DemoHero,
} from '../data/demo';
import type { Facilities } from '../world/geometry';
import type { Point, SceneModel, WorldScene } from '../world/scene';
import { HeroCard } from './HeroCard';
import { Hud } from './Hud';
import { Icon } from './icons';
import { Panel } from './Panel';
import { GremioPanel } from './panels/GremioPanel';
import { HeroesPanel } from './panels/HeroesPanel';
import { TablonPanel } from './panels/TablonPanel';
import { SceneView } from './SceneView';
import { TabBar, type TabId } from './TabBar';

interface Bubble {
  text: string;
  x: number;
  y: number;
  key: number;
}

export function App() {
  const [tab, setTab] = useState<TabId>('taberna');
  const [fac, setFac] = useState<Facilities>(DEMO_FACILITIES);
  const [heroes, setHeroes] = useState<DemoHero[]>(DEMO_HEROES);
  const [loot, setLoot] = useState(3);
  const [gold, setGold] = useState(312);
  const [card, setCard] = useState<string | null>(null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [hover, setHover] = useState<{ label: string; at: Point } | null>(null);
  const [focusFac, setFocusFac] = useState<keyof Facilities | null>(null);
  const [heroFilter, setHeroFilter] = useState<'todos' | 'candidatos'>('todos');
  const [hint, setHint] = useState(true);
  const scene = useRef<WorldScene | null>(null);

  const model = useMemo<SceneModel>(
    () => ({ fac, quests: DEMO_QUESTS.length, loot, heroes: heroes.map(toSceneHero) }),
    [fac, loot, heroes],
  );

  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    const t = setTimeout(() => setHint(false), 7000);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!bubble) return;
    const t = setTimeout(() => setBubble(null), 3800);
    return () => clearTimeout(t);
  }, [bubble]);

  const openTab = (t: TabId) => {
    if (t === tab) return;
    audio.play(t === 'taberna' ? 'close' : 'open');
    setTab(t);
    setCard(null);
    setBubble(null);
  };

  const say = (text: string, at: Point) => setBubble({ text, x: at.x, y: at.y, key: Date.now() });

  const onHotspot = (id: string, _label: string, at: Point) => {
    setHint(false);
    switch (id) {
      case 'tablon':
        openTab('tablon');
        return;
      case 'barra':
        setHeroFilter('candidatos');
        openTab('heroes');
        return;
      case 'dormitorios':
        setFocusFac('dorm');
        openTab('gremio');
        return;
      case 'enfermeria':
        setFocusFac('enf');
        openTab('gremio');
        return;
      case 'despacho':
      case 'cofres':
        setFocusFac(null);
        openTab('gremio');
        return;
      case 'chimenea':
        say(fac.tab === 0 ? CAPTIONS.chimeneaFria! : CAPTIONS.chimenea!, at);
        return;
      default:
        if (CAPTIONS[id]) say(CAPTIONS[id]!, at);
    }
  };

  const updateHero = (id: string, patch: Partial<DemoHero>) =>
    setHeroes((list) => list.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  const hire = (id: string) => {
    const h = heroes.find((x) => x.id === id);
    if (!h) return;
    audio.play('coin');
    setGold((g) => g - (h.fee ?? 0));
    updateHero(id, { status: 'ok' });
    setTimeout(() => scene.current?.focusHero(id), 50);
  };

  const upgrade = (k: keyof Facilities, delta: number) => {
    const next = Math.max(0, Math.min(3, fac[k] + delta));
    if (next === fac[k]) return;
    if (delta > 0) setTab('taberna');
    scene.current?.focus(FACILITY_INFO[k].room);
    setFac({ ...fac, [k]: next });
  };

  const cardHero = heroes.find((h) => h.id === card) ?? null;

  return (
    <div class="game">
      <Hud gold={gold} />
      <div class="stage">
        <SceneView
          model={model}
          onReady={(s) => (scene.current = s)}
          onHotspot={onHotspot}
          onHero={(id) => {
            setHint(false);
            setBubble(null);
            audio.play('open', 0.6);
            setCard(id);
          }}
          onHover={(label, at) => setHover(label && at ? { label, at } : null)}
        />
        {hover && !bubble && (
          <span class="hovertip" style={{ left: `${hover.at.x}px`, top: `${hover.at.y}px` }}>
            {hover.label}
          </span>
        )}
        {bubble && (
          <div
            key={bubble.key}
            class="bubble"
            style={{ left: `${bubble.x}px`, top: `${bubble.y}px` }}
            role="status"
          >
            {bubble.text}
          </div>
        )}
        {hint && (
          <div class="hint-toast" role="status">
            Arrastra para recorrer la taberna · Toca personas y objetos
          </div>
        )}
        <div class="stage-tools">
          <button class="btn-icon" aria-label="Alejar" onClick={() => scene.current?.zoomBy(-1)}>
            <Icon name="minus" size={16} />
          </button>
          <button class="btn-icon" aria-label="Acercar" onClick={() => scene.current?.zoomBy(1)}>
            <Icon name="plus" size={16} />
          </button>
          <button
            class="btn-icon"
            aria-label="Volver a la sala"
            onClick={() => scene.current?.focus('sala')}
          >
            <Icon name="home" size={16} />
          </button>
        </div>
        {tab === 'tablon' && (
          <Panel title="Tablón de encargos" onClose={() => openTab('taberna')} variant="cork">
            <TablonPanel quests={DEMO_QUESTS} />
          </Panel>
        )}
        {tab === 'heroes' && (
          <Panel title="Héroes" onClose={() => openTab('taberna')}>
            <HeroesPanel
              heroes={heroes}
              filter={heroFilter}
              setFilter={setHeroFilter}
              onOpen={(id) => setCard(id)}
              onHire={hire}
              gold={gold}
            />
          </Panel>
        )}
        {tab === 'gremio' && (
          <Panel title="El gremio" onClose={() => openTab('taberna')}>
            <GremioPanel
              fac={fac}
              focus={focusFac}
              loot={loot}
              setLoot={setLoot}
              onUpgrade={upgrade}
            />
          </Panel>
        )}
        {cardHero && (
          <HeroCard
            hero={cardHero}
            gold={gold}
            onClose={() => setCard(null)}
            onHire={() => hire(cardHero.id)}
            onLocate={() => {
              setCard(null);
              setTab('taberna');
              if (!scene.current?.focusHero(cardHero.id) && cardHero.status === 'mision')
                say(`${cardHero.name} está de misión. Vuelve en ${cardHero.days} días.`, {
                  x: 160,
                  y: 120,
                });
            }}
            onCycle={() => {
              const next =
                cardHero.status === 'ok'
                  ? 'herido'
                  : cardHero.status === 'herido'
                    ? 'mision'
                    : 'ok';
              updateHero(cardHero.id, { status: next });
            }}
          />
        )}
      </div>
      <TabBar
        tab={tab}
        onTab={(t) => {
          if (t === 'heroes') setHeroFilter('todos');
          if (t === 'gremio') setFocusFac(null);
          openTab(t);
        }}
      />
    </div>
  );
}
