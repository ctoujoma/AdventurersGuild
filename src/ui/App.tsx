import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { canHire, newGame, reduce, type Action } from '../core/game';
import type { Facilities, GameState } from '../core/model';
import { CAPTIONS, FACILITY_INFO } from '../data/labels';
import { loadGame, saveGame, webStorage } from '../platform/storage';
import type { Point, WorldScene } from '../world/scene';
import { Dawn } from './Dawn';
import { DayBar } from './DayBar';
import { GameOver } from './GameOver';
import { HeroCard } from './HeroCard';
import { Hud } from './Hud';
import { Icon } from './icons';
import { Letter } from './Letter';
import { Panel } from './Panel';
import { AwayPanel } from './panels/AwayPanel';
import { GremioPanel } from './panels/GremioPanel';
import { HeroesPanel } from './panels/HeroesPanel';
import { MailPanel } from './panels/MailPanel';
import { TablonPanel } from './panels/TablonPanel';
import { QuestSheet } from './QuestSheet';
import { SceneView } from './SceneView';
import { TabBar, type TabId } from './TabBar';
import { listNames, plural } from './text';
import { sceneModel } from './view';

type PanelId = Exclude<TabId, 'taberna'> | 'correo' | 'fuera';

interface Bubble {
  text: string;
  x: number;
  y: number;
  key: number;
}

const freshGame = () => newGame(Date.now().toString(36));

export function App() {
  const [saved] = useState(loadGame);
  const [game, setGame] = useState<GameState>(() => saved ?? freshGame());
  /** Lo que ve la escena: durante el amanecer sigue mostrando la noche anterior. */
  const [sceneGame, setSceneGame] = useState(game);
  const [panel, setPanel] = useState<PanelId | null>(null);
  // Partida nueva: el día 1 se abre con la carta del tío.
  const [dawnOpen, setDawnOpen] = useState(!saved);
  /** La noche está pasando en la escena (entre «Terminar día» y el resumen del amanecer). */
  const [passing, setPassing] = useState(false);
  const [card, setCard] = useState<string | null>(null);
  const [questId, setQuestId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; key: number } | null>(null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [hover, setHover] = useState<{ label: string; at: Point } | null>(null);
  const [focusFac, setFocusFac] = useState<keyof Facilities | null>(null);
  const [heroFilter, setHeroFilter] = useState<'todos' | 'candidatos'>('todos');
  const [hint, setHint] = useState(false);
  const scene = useRef<WorldScene | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;

  const model = useMemo(() => sceneModel(sceneGame), [sceneGame]);

  useEffect(() => {
    if (!dawnOpen && !passing) setSceneGame(game);
  }, [game, dawnOpen, passing]);

  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    if (!saved) saveGame(game);
    return () => window.removeEventListener('pointerdown', unlock);
    // Solo al arrancar.
  }, []);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 8000);
    return () => clearTimeout(t);
  }, [hint]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!bubble) return;
    const t = setTimeout(() => setBubble(null), 3800);
    return () => clearTimeout(t);
  }, [bubble]);

  const commit = (next: GameState) => {
    gameRef.current = next;
    setGame(next);
    saveGame(next);
  };
  const dispatch = (a: Action): GameState => {
    const next = reduce(gameRef.current, a);
    if (next !== gameRef.current) commit(next);
    return next;
  };

  // Gancho para pruebas automáticas (solo con #debug en la URL).
  useEffect(() => {
    if (location.hash !== '#debug') return;
    (window as unknown as { __game: unknown }).__game = {
      get: () => gameRef.current,
      dispatch,
      set: (s: GameState) => commit(s),
    };
  });

  const toast = (text: string) => setNotice({ text, key: Date.now() });
  const say = (text: string, at: Point) => setBubble({ text, x: at.x, y: at.y, key: Date.now() });

  const openPanel = (p: PanelId | null) => {
    if (p === panel) return;
    audio.play(p ? 'open' : 'close');
    setPanel(p);
    setCard(null);
    setQuestId(null);
    setReportId(null);
    setBubble(null);
  };

  const onHotspot = (id: string, _label: string, at: Point) => {
    setHint(false);
    switch (id) {
      case 'tablon':
        openPanel('tablon');
        return;
      case 'barra':
        setHeroFilter('candidatos');
        openPanel('heroes');
        return;
      case 'dormitorios':
        setFocusFac('dorm');
        openPanel('gremio');
        return;
      case 'enfermeria':
        setFocusFac('enf');
        openPanel('gremio');
        return;
      case 'mapa':
        openPanel('fuera');
        return;
      case 'armeria':
        setFocusFac('arm');
        openPanel('gremio');
        return;
      case 'capilla':
        setFocusFac('cap');
        openPanel('gremio');
        return;
      case 'despacho':
        setFocusFac('mapas');
        openPanel('gremio');
        return;
      case 'equipo':
      case 'cofres':
        setFocusFac(null);
        openPanel('gremio');
        return;
      case 'chimenea':
        say(game.fac.tab === 0 ? CAPTIONS.chimeneaFria! : CAPTIONS.chimenea!, at);
        return;
      default: {
        const t = id.startsWith('trofeo-') ? game.trophies[Number(id.slice(7))] : null;
        if (t) say(`${t.name}. Lo trajeron ${t.who} de ${t.place}, el día ${t.day}.`, at);
        else if (CAPTIONS[id]) say(CAPTIONS[id]!, at);
      }
    }
  };

  const hire = (id: string) => {
    const why = canHire(game, id);
    if (why) return toast(why);
    const c = game.candidates.find((x) => x.id === id)!;
    dispatch({ type: 'hire', id });
    audio.play('coin');
    toast(`${c.name} se une al gremio. Su rasgo oculto se sabrá tras su primera misión.`);
    setTimeout(() => scene.current?.focusHero(id), 60);
  };

  const fire = (id: string) => {
    const h = game.heroes.find((x) => x.id === id)!;
    dispatch({ type: 'fire', id });
    audio.play('close');
    setCard(null);
    toast(`${h.name} recoge sus cosas y se va sin despedirse.`);
  };

  /** Manda un grupo: la nota sale del tablón y los héroes cruzan la puerta. */
  const send = (qid: string, ids: string[]) => {
    const q = game.quests.find((x) => x.id === qid);
    if (!q) return;
    const before = gameRef.current;
    const next = dispatch({ type: 'send', questId: qid, heroIds: ids });
    if (next === before) return;
    const days = next.missions.at(-1)?.daysLeft ?? q.days;
    const names = listNames(ids.map((id) => game.heroes.find((h) => h.id === id)?.name ?? ''));
    audio.play('depart');
    setQuestId(null);
    setPanel(null);
    scene.current?.focus('puerta');
    toast(
      `${names} ${plural(ids.length, 'sale', 'salen')} hacia ${q.place}. Vuelta en ${days} ${plural(days, 'día', 'días')}.`,
    );
  };

  const upgrade = (k: keyof Facilities) => {
    const before = gameRef.current;
    if (dispatch({ type: 'upgrade', fac: k }) === before) return;
    setPanel(null);
    scene.current?.focus(FACILITY_INFO[k].room);
  };

  const sell = (itemId: string) => {
    const it = game.inventory.find((i) => i.id === itemId);
    dispatch({ type: 'sell', itemId });
    audio.play('coin');
    if (it) toast(`Vendido: ${it.name} por ${it.value} monedas.`);
  };

  const endDay = () => {
    if (passing) return;
    setHint(false);
    setPanel(null);
    setCard(null);
    setQuestId(null);
    setBubble(null);
    const before = gameRef.current;
    const next = dispatch({ type: 'endDay' });
    if (next === before) return;
    const sunrise = () => {
      setPassing(false);
      audio.play('dawn');
      setDawnOpen(true);
    };
    if (!scene.current) return sunrise();
    setPassing(true);
    audio.play('night');
    scene.current.nightfall(sunrise);
  };

  const closeDawn = (then?: PanelId) => {
    const returned = sceneGame.missions.some((m) => !game.missions.some((x) => x.id === m.id));
    // Si algún grupo vuelve con éxito, ronda en la barra cuando cruzan la puerta.
    const wins = game.reports.filter(
      (r) => r.day === game.day && r.outcome.startsWith('Éxito') && r.outcome !== 'Éxito parcial',
    );
    setDawnOpen(false);
    if (game.day === 1) setHint(true);
    if (then) openPanel(then);
    else if (returned) setTimeout(() => scene.current?.focus('puerta'), 30);
    if (wins.length)
      setTimeout(() => {
        scene.current?.cheer('barra');
        if (!then) scene.current?.focus('barra');
        toast(`¡Ronda para todos! ${wins.map((r) => r.who).join(' y ')} lo celebran en la barra.`);
      }, 3600);
  };

  const openReport = (id: string) => {
    dispatch({ type: 'read', reportId: id });
    audio.play('open');
    setReportId(id);
  };

  const restart = () => {
    webStorage.clear();
    const s = freshGame();
    commit(s);
    setSceneGame(s);
    setPanel(null);
    setCard(null);
    setDawnOpen(true);
    scene.current?.focus('sala');
  };

  const cardHero =
    game.heroes.find((h) => h.id === card) ?? game.candidates.find((h) => h.id === card) ?? null;
  const cardIsCandidate = !!cardHero && game.candidates.includes(cardHero);
  const openQuest = game.quests.find((q) => q.id === questId) ?? null;
  const report = game.reports.find((r) => r.id === reportId) ?? null;
  const unread = game.reports.filter((r) => !r.read).length;
  const away = game.missions.length + game.heroes.filter((h) => h.status === 'desaparecido').length;
  const tab: TabId =
    panel === 'tablon' || panel === 'heroes' || panel === 'gremio' ? panel : 'taberna';

  return (
    <div class="game">
      <Hud game={passing ? sceneGame : game} />
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
        {hint && !notice && (
          <div class="hint-toast" role="status">
            Arrastra para recorrer la taberna · Toca el tablón para mandar un grupo
          </div>
        )}
        {notice && (
          <div key={notice.key} class="hint-toast notice" role="status">
            {notice.text}
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
        {!panel && !game.over && (
          <DayBar
            unread={unread}
            away={away}
            onMail={() => openPanel('correo')}
            onAway={() => openPanel('fuera')}
            onEndDay={endDay}
          />
        )}
        {panel === 'tablon' && (
          <Panel title="Tablón de encargos" onClose={() => openPanel(null)} variant="cork">
            <TablonPanel
              quests={game.quests}
              seeAll={game.fac.mapas >= 2}
              onOpen={(id) => {
                audio.play('open');
                setQuestId(id);
              }}
            />
          </Panel>
        )}
        {panel === 'heroes' && (
          <Panel title="Héroes" onClose={() => openPanel(null)}>
            <HeroesPanel
              game={game}
              filter={heroFilter}
              setFilter={setHeroFilter}
              onOpen={(id) => setCard(id)}
              onHire={hire}
            />
          </Panel>
        )}
        {panel === 'gremio' && (
          <Panel title="El gremio" onClose={() => openPanel(null)}>
            <GremioPanel
              game={game}
              focus={focusFac}
              onUpgrade={upgrade}
              onSell={sell}
              onSellTrophy={(id) => {
                const t = game.trophies.find((x) => x.id === id);
                dispatch({ type: 'sellTrophy', id });
                audio.play('coin');
                if (t)
                  toast(`Vendido: ${t.name} por ${t.value} monedas. La pared se queda más sosa.`);
              }}
              onNewGame={restart}
            />
          </Panel>
        )}
        {panel === 'correo' && (
          <Panel title="Correo del amanecer" onClose={() => openPanel(null)}>
            <MailPanel reports={game.reports} onOpen={openReport} />
          </Panel>
        )}
        {panel === 'fuera' && (
          <Panel title="Fuera del gremio" onClose={() => openPanel(null)}>
            <AwayPanel game={game} onHero={(id) => setCard(id)} />
          </Panel>
        )}
        {openQuest && (
          <QuestSheet
            key={openQuest.id}
            game={game}
            quest={openQuest}
            onClose={() => setQuestId(null)}
            onSend={(ids) => send(openQuest.id, ids)}
          />
        )}
        {report && (
          <Letter report={report} heroes={game.heroes} onClose={() => setReportId(null)} />
        )}
        {cardHero && (
          <HeroCard
            key={cardHero.id}
            game={game}
            hero={cardHero}
            candidate={cardIsCandidate}
            onClose={() => setCard(null)}
            onHire={() => hire(cardHero.id)}
            onFire={() => fire(cardHero.id)}
            onAnswer={(yes) => dispatch({ type: 'answer', id: cardHero.id, yes })}
            onEquip={(itemId) => {
              dispatch({ type: 'equip', heroId: cardHero.id, itemId });
              audio.play('select');
            }}
            onUnequip={() => {
              dispatch({ type: 'unequip', heroId: cardHero.id });
              audio.play('deselect');
            }}
            onLocate={() => {
              setCard(null);
              setPanel(null);
              if (!scene.current?.focusHero(cardHero.id))
                say(
                  cardHero.status === 'mision'
                    ? `${cardHero.name} está de misión. Vuelve en ${cardHero.days} ${plural(cardHero.days, 'día', 'días')}.`
                    : `${cardHero.name} no está en la taberna.`,
                  { x: 160, y: 120 },
                );
            }}
          />
        )}
        {dawnOpen && (
          <Dawn
            day={game.day}
            flavor={game.flavor}
            events={game.dawn}
            unread={unread}
            onClose={() => closeDawn()}
            onMail={() => closeDawn('correo')}
          />
        )}
        {game.over && !dawnOpen && <GameOver game={game} onNew={restart} />}
      </div>
      <TabBar
        tab={tab}
        onTab={(t) => {
          if (t === 'heroes') setHeroFilter('todos');
          if (t === 'gremio') setFocusFac(null);
          openPanel(t === 'taberna' ? null : t);
        }}
      />
    </div>
  );
}
