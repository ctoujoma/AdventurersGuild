import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useBackButton } from '../platform/back';
import { HoldHelp } from './HoldHelp';
import { haptic, setHaptics } from '../platform/haptics';
import { audio, type Mood } from '../audio/audio';
import { canClose, canHire, customOf, newGame, reduce, type Action } from '../core/game';
import { raidRoute } from '../core/assault';
import { canAssign, canHireWorker } from '../core/workers';
import { DAY_SECONDS, DELIVERIES, DUSK } from '../core/balance';
import { DECOR, FACADE } from '../data/custom';
import { RUMORS, VISITORS, type VisitorKind } from '../data/visitors';
import type { BossFight as BossFightRecord, Facilities, GameState } from '../core/model';
import { FACILITY_INFO } from '../data/labels';
import { loadRecords, mergeRecords, saveRecords } from '../platform/records';
import { loadGame, saveGame, webStorage } from '../platform/storage';
import type { Point } from '../world/scene';
import { cheat, testFight } from '../core/cheats';
import { BossCall, BossFight } from './BossFight';
import { Dawn } from './Dawn';
import { DayBar } from './DayBar';
import { GameOver } from './GameOver';
import { HeroCard } from './HeroCard';
import { Hud } from './Hud';
import { Icon } from './icons';
import { Letter } from './Letter';
import { EventCard } from './EventCard';
import { Opening } from './Opening';
import { Panel } from './Panel';
import { LibroPanel } from './panels/LibroPanel';
import { MapPanel } from './panels/MapPanel';
import { SaveMenu } from './SaveMenu';
import { SettingsMenu } from './SettingsMenu';
import { applyLook, loadSettings, saveSettings, type Settings } from '../platform/settings';
import { Splash } from './Splash';
import { Title } from './Title';
import { nextTip } from './tips';
import { canDrag, planDrop } from './drop';
import { UncleNote } from './UncleNote';
import { AwayPanel } from './panels/AwayPanel';
import { GremioPanel } from './panels/GremioPanel';
import { HeroesPanel, type HeroFilter } from './panels/HeroesPanel';
import { MailPanel } from './panels/MailPanel';
import { TablonPanel } from './panels/TablonPanel';
import { TabernaPanel } from './panels/TabernaPanel';
import { ArconPanel, type ArconTab } from './panels/ArconPanel';
import { QuestSheet } from './QuestSheet';
import { SceneView, type GameScene } from './SceneView';
import { RoomPanel, type RoomLink } from './panels/RoomPanel';
import { ObrasPanel } from './panels/ObrasPanel';
import { WorksBar } from './WorksBar';
import { RoomMenu } from './RoomMenu';
import { useWorks } from './works';
import { LOCKED, worksOpen } from '../core/rooms';
import type { Pick } from '../world/rooms/works';
import { ROOMS } from '../data/rooms';
import { TabBar, type TabId } from './TabBar';
import { listNames, plural } from './text';
import { sceneModel } from './view';

type PanelId = Exclude<TabId, 'taberna'> | 'correo' | 'fuera' | 'libro' | 'casa' | 'arcon' | 'sala';

interface Bubble {
  text: string;
  x: number;
  y: number;
  /** Si se sabe, el punto del mundo al que se refiere: el bocadillo lo sigue. */
  wx?: number;
  wy?: number;
  key: number;
}

const freshGame = () => newGame(Date.now().toString(36));

/** Bocadillo de texto anclado a un punto de la escena: se mueve con la cámara. */
function SpeechBubble({ bubble, scene }: { bubble: Bubble; scene: { current: GameScene | null } }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bubble.wx === undefined || bubble.wy === undefined) return;
    let raf = 0;
    const follow = () => {
      const el = ref.current;
      const s = scene.current;
      if (el && s) {
        const p = s.screenOf(bubble.wx!, bubble.wy!);
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [bubble]);
  return (
    <div
      ref={ref}
      key={bubble.key}
      class="bubble"
      style={{ left: `${bubble.x}px`, top: `${bubble.y}px` }}
      role="status"
    >
      {bubble.text}
    </div>
  );
}

export function App() {
  const [saved] = useState(loadGame);
  const [game, setGame] = useState<GameState>(() => saved ?? freshGame());
  /** Lo que ve la escena: durante el amanecer sigue mostrando la noche anterior. */
  const [sceneGame, setSceneGame] = useState(game);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [arconTab, setArconTab] = useState<ArconTab>('equipo');
  /** Sala tocada en la vista de salas (su ficha). */
  const [roomId, setRoomId] = useState<string | null>(null);
  // Partida nueva: el día 1 se abre con la carta del tío.
  const [dawnOpen, setDawnOpen] = useState(!saved);
  /** La noche está pasando en la escena (entre «Terminar día» y el resumen del amanecer). */
  const [passing, setPassing] = useState(false);
  /** Hay un asalto en el patio (se puede saltar). */
  const [raiding, setRaiding] = useState(false);
  /** Pelea contra un jefe de esta noche: el aviso (id del informe) y la pelea abierta. */
  const [bossCall, setBossCall] = useState<string | null>(null);
  const [watching, setWatching] = useState<{ fight: BossFightRecord; dawn: boolean } | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const [questId, setQuestId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; key: number } | null>(null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [hover, setHover] = useState<{ label: string; at: Point } | null>(null);
  /** Llevando a alguien con el dedo: qué pasaría si se suelta ahí. */
  const [dragTip, setDragTip] = useState<{ text: string; ok: boolean; at: Point } | null>(null);
  const [focusFac, setFocusFac] = useState<keyof Facilities | null>(null);
  const [heroFilter, setHeroFilter] = useState<HeroFilter>('todos');
  const [hint, setHint] = useState(false);
  /** Splash del desarrollador, título y juego. Con #debug se entra directo a la partida. */
  const [screen, setScreen] = useState<'splash' | 'title' | 'game'>(() =>
    location.hash.includes('debug') ? 'game' : 'splash',
  );
  const [hasGame, setHasGame] = useState(!!saved);
  const [saveMenu, setSaveMenu] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [records, setRecords] = useState(loadRecords);
  /** Mejor llegada antes de esta partida, para comparar en la apertura. */
  const [prevBest] = useState(() => loadRecords().bestArrival);
  const scene = useRef<GameScene | null>(null);
  // Ajustes: volúmenes, velocidad de la escena y aspecto; se guardan al cambiar.
  useEffect(() => {
    audio.setLevels(settings);
    applyLook(settings);
    setHaptics(settings.vibrate);
    if (scene.current) scene.current.speed = settings.speed;
    saveSettings(settings);
  }, [settings]);
  const gameRef = useRef(game);
  gameRef.current = game;

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
    setRecords((r) => {
      const m = mergeRecords(r, next);
      if (m !== r) saveRecords(m);
      return m;
    });
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

  /** Reloj del día en la interfaz (el del estado se guarda cada pocos segundos). */
  const clockRef = useRef(game.clock ?? 0);
  const [clock, setClock] = useState(clockRef.current);
  /** Mueve el reloj: la escena lo sigue y la partida se entera al cruzar una entrega o cada 5 s. */
  const moveClock = (next: number, before: number) => {
    clockRef.current = next;
    setClock(next);
    scene.current?.setTime(next / DAY_SECONDS);
    const open = DUSK * DAY_SECONDS;
    const delivery = (x: number) => Math.floor((Math.min(x, open) / open) * DELIVERIES);
    if (
      Math.floor(next / 5) === Math.floor(before / 5) &&
      delivery(next) === delivery(before) &&
      next < DAY_SECONDS
    )
      return;
    const gold = gameRef.current.gold;
    const after = dispatch({ type: 'tick', to: next });
    if (after.gold > gold) {
      scene.current?.pay();
      audio.play('coin', 0.25);
    }
  };
  const say = (text: string, at: Point) =>
    setBubble({ text, x: at.x, y: at.y, wx: at.wx, wy: at.wy, key: Date.now() });

  // Obras en la vista de salas: elegir sitio en la escena y el modo plano (que se ve en la escena).
  const works = useWorks({
    game,
    dispatch,
    toast,
    focus: (id) => scene.current?.focus(id),
    raise: (ids) => {
      const s = scene.current;
      s?.raise(ids);
    },
    price: (id, cost) => {
      const s = scene.current;
      s?.priceTag(id, cost);
    },
  });
  const draft = works.planning ? works.view : null;
  const model = useMemo(() => sceneModel(draft ?? sceneGame), [sceneGame, draft]);
  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    s.setTargets(
      works.active
        ? works.targets.map((t) => ({
            id: t.id,
            rect: t.rect,
            label: t.blocked ? t.label : `${t.label} · ${Math.abs(t.cost)}`,
            blocked: !!t.blocked,
            remove: t.cost < 0,
          }))
        : null,
      null,
      // Los huecos de siempre del modo obras (los de ampliar y los de mudanza) no mueven la cámara.
      !works.pick || works.pick.kind === 'move',
    );
    s.setGrabbable(works.planning && !works.pick ? works.selected : null);
  }, [works.active?.kind, works.targets, works.pick, works.selected, works.planning]);
  // El camino de los bandidos, a la vista mientras se planea la casa o se mira la cámara o la puerta.
  const routeRoom =
    panel === 'sala' && roomId ? (draft ?? game).building.rooms.find((r) => r.id === roomId) : null;
  const showRoute =
    works.planning || routeRoom?.type === 'tesoro' || routeRoom?.type === 'recibidor';
  const routeBuilding = (draft ?? game).building;
  useEffect(() => {
    const s = scene.current;
    s?.setRoute(showRoute ? raidRoute(routeBuilding) : null);
  }, [showRoute, routeBuilding]);
  /** Las obras se eligen en la escena (si el navegador la ha podido pintar). */
  const roomsLive = !!scene.current;
  const pickSpot = (p: Pick) => {
    openPanel(null);
    if (!works.planning) works.startPlan();
    works.startPick(p);
  };

  const openPanel = (p: PanelId | null) => {
    if (p === panel) return;
    audio.play(p ? 'open' : 'close');
    setPanel(p);
    setCard(null);
    setQuestId(null);
    setReportId(null);
    setBubble(null);
  };

  const onHotspot = (id: string) => {
    setHint(false);
    if (id.startsWith('obra:')) {
      works.choose(id);
      return;
    }
    if (id.startsWith('sala:')) {
      // En el modo obras, tocar una sala la elige (menú de obras junto a ella).
      if (works.planning) {
        works.select(id.slice(5));
        return;
      }
      setRoomId(id.slice(5));
      openPanel('sala');
    }
  };

  const sellTrophy = (id: string) => {
    const t = game.trophies.find((x) => x.id === id);
    dispatch({ type: 'sellTrophy', id });
    audio.play('coin');
    if (t) toast(`Vendido: ${t.name} por ${t.value} monedas. La pared queda un poco más vacía.`);
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

  const upgradeRoom = (id: string) => {
    const before = gameRef.current;
    if (dispatch({ type: 'upgradeRoom', id }) === before) return;
    setPanel(null);
    scene.current?.focus(id);
  };

  const hireWorker = (id: string) => {
    const w = game.seekers.find((x) => x.id === id);
    const why = canHireWorker(game, id);
    if (why) return toast(why);
    dispatch({ type: 'hireWorker', id });
    audio.play('coin');
    if (w) toast(`${w.name} se queda a trabajar. Empieza ahora mismo.`);
  };

  const assignJob = (who: string, room: string | null) => {
    const why = canAssign(gameRef.current, who, room);
    if (why) return toast(why);
    dispatch({ type: 'assign', who, room });
    audio.play(room ? 'select' : 'deselect');
  };

  const roomLink = (to: RoomLink) => {
    if (to === 'candidatos' || to === 'trabajadores') setHeroFilter(to);
    if (to === 'equipo' || to === 'tesoros') setArconTab(to);
    openPanel(
      to === 'candidatos' || to === 'trabajadores'
        ? 'heroes'
        : to === 'equipo' || to === 'tesoros'
          ? 'arcon'
          : to,
    );
  };

  const sell = (itemId: string) => {
    const it = game.inventory.find((i) => i.id === itemId);
    dispatch({ type: 'sell', itemId });
    audio.play('coin');
    if (it) toast(`Vendido: ${it.name} por ${it.value} monedas.`);
  };

  // Escape y el botón «atrás» del móvil cierran lo que esté encima (ajustes, partidas,
  // informe, encargo, ficha, panel).
  const overlayOpen =
    !!watching ||
    settingsOpen ||
    saveMenu ||
    !!reportId ||
    !!questId ||
    !!card ||
    !!panel ||
    !!works.pick;
  const closeWatch = () => {
    if (watching?.dawn) setDawnOpen(true);
    setWatching(null);
  };
  const closeTop = () => {
    if (watching) closeWatch();
    else if (settingsOpen) setSettingsOpen(false);
    else if (saveMenu) setSaveMenu(false);
    else if (reportId) setReportId(null);
    else if (questId) setQuestId(null);
    else if (card) setCard(null);
    else if (panel) openPanel(null);
    else if (works.pick) works.cancelPick();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useBackButton(overlayOpen, closeTop);

  // Música según lo que pasa: la pelea, un asalto anunciado, el modo libre o la taberna.
  const mood: Mood =
    raiding || watching
      ? 'asalto'
      : game.raid?.warned
        ? 'tension'
        : game.mode === 'libre'
          ? 'libre'
          : 'taberna';
  useEffect(() => audio.setMood(mood), [mood]);

  const endDay = () => {
    if (passing) return;
    dispatch({ type: 'tick', to: clockRef.current });
    if (!canClose(gameRef.current)) return;
    setHint(false);
    setPanel(null);
    setCard(null);
    setQuestId(null);
    setBubble(null);
    const before = gameRef.current;
    const next = dispatch({ type: 'endDay' });
    if (next === before) return;
    const party = next.lastRaid?.won || (next.mode === 'libre' && before.mode !== 'libre');
    const sunrise = () => {
      setPassing(false);
      setRaiding(false);
      audio.play('dawn');
      // Si esta noche un grupo ha dado con un jefe, primero el aviso (verlo o no).
      if (next.lastFight) setBossCall(next.lastFight);
      else setDawnOpen(true);
      // Asalto repelido o deuda saldada: suena el brindis.
      if (party) setTimeout(() => audio.fanfare(), 60);
    };
    if (!scene.current) return sunrise();
    setPassing(true);
    if (next.lastRaid) {
      setRaiding(true);
      audio.play('horn');
      scene.current.raidNight(next.lastRaid, sunrise);
    } else {
      audio.play('night');
      scene.current.nightfall(sunrise);
    }
  };

  const closeDawn = (then?: PanelId) => {
    const returned = sceneGame.missions.some((m) => !game.missions.some((x) => x.id === m.id));
    // Si algún grupo vuelve con éxito, ronda en la barra cuando cruzan la puerta.
    const wins = game.reports.filter(
      (r) => r.day === game.day && r.outcome.startsWith('Éxito') && r.outcome !== 'Éxito parcial',
    );
    setDawnOpen(false);
    if (game.day === 1) setHint(true);
    // Lo que hicieron las salas anoche sube flotando sobre ellas.
    const made = game.yields;
    if (made?.length)
      setTimeout(() => {
        const s = scene.current;
        s?.yields(made);
      }, 400);
    if (then) openPanel(then);
    else if (returned) setTimeout(() => scene.current?.focus('patio'), 30);
    if (wins.length)
      setTimeout(() => {
        scene.current?.cheer('barra');
        if (!then) scene.current?.focus('barra');
        toast(`¡Ronda para todos! ${wins.map((r) => r.who).join(' y ')} lo celebran en la barra.`);
      }, 5600);
  };

  const openReport = (id: string) => {
    dispatch({ type: 'read', reportId: id });
    audio.play('open');
    setReportId(id);
  };

  const loadSave = (s: GameState) => {
    commit(s);
    setSceneGame(s);
    setHasGame(true);
    setSaveMenu(false);
    setPanel(null);
    setCard(null);
    setDawnOpen(false);
    setScreen('game');
    audio.play('open');
    toast(`Partida cargada: día ${s.day}, ${s.gold} monedas.`);
  };

  const toTitle = () => {
    setPanel(null);
    setCard(null);
    setScreen('title');
  };

  const restart = () => {
    setHasGame(true);
    setScreen('game');
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
  const callReport = bossCall ? game.reports.find((r) => r.id === bossCall) : undefined;
  const unread = game.reports.filter((r) => !r.read).length;
  const away = game.missions.length + game.heroes.filter((h) => h.status === 'desaparecido').length;
  const calm =
    screen === 'game' &&
    !dawnOpen &&
    !passing &&
    !(game.opening && !game.opening.seen) &&
    !works.pick &&
    !works.planning;
  const pendingEvent = calm && !game.over ? (game.event ?? null) : null;
  const tip =
    calm && !pendingEvent && !card && !questId && !reportId && !panel ? nextTip(game) : null;
  // La nota del tío mira hacia lo que explica.
  useEffect(() => {
    if (tip?.focus) scene.current?.focus(tip.focus);
  }, [tip?.id]);

  // El reloj del día: corre con el juego abierto, también con un panel delante, y se para en
  // los momentos que piden atención (evento, nota, asalto, amanecer…) y con la pestaña oculta.
  const ticking =
    calm &&
    !game.over &&
    !pendingEvent &&
    !tip &&
    !watching &&
    !bossCall &&
    !settingsOpen &&
    !saveMenu;
  useEffect(() => {
    clockRef.current = game.clock ?? 0;
    setClock(clockRef.current);
    scene.current?.setTime(clockRef.current / DAY_SECONDS);
  }, [game.day, game.seed]);
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      const before = clockRef.current;
      const next = Math.min(DAY_SECONDS, before + 0.25 * settings.pace);
      if (next === before) return;
      moveClock(next, before);
    }, 250);
    return () => clearInterval(id);
  }, [ticking, settings.pace]);
  const tab: TabId =
    panel === 'tablon' || panel === 'heroes' || panel === 'gremio' ? panel : 'taberna';

  return (
    <div class="game">
      <Hud game={passing ? sceneGame : game} onSettings={() => setSettingsOpen(true)} />
      <div class="stage">
        <SceneView
          model={model}
          onReady={(s) => {
            scene.current = s;
            s.setTime(clockRef.current / DAY_SECONDS);
            s.speed = settings.speed;
          }}
          onHotspot={onHotspot}
          onHero={(id, at) => {
            setHint(false);
            setBubble(null);
            // Los visitantes cuentan lo que se oye por ahí.
            if (id.startsWith('vis-')) {
              const i = Number(id.split('-')[2]);
              const kind = model.visitors?.kinds[i] ?? 'campesino';
              audio.play('click', 0.5);
              say(
                kind === 'espia'
                  ? 'Forastero callado: «¿Y la cámara del tesoro… queda muy abajo?»'
                  : `${VISITORS[kind as VisitorKind].name.replace(/^./, (c) => c.toUpperCase())}: «${RUMORS[(game.day * 7 + i) % RUMORS.length]}»`,
                at,
              );
              return;
            }
            // Un trabajador no tiene ficha: dice lo suyo.
            const w = game.workers.find((x) => x.id === id);
            if (w) {
              audio.play('click', 0.5);
              say(`${w.name}: «${w.quote}»`, at);
              return;
            }
            audio.play('open', 0.6);
            setCard(id);
          }}
          onHover={(label, at) => setHover(label && at ? { label, at } : null)}
          canDrag={(id) => !works.planning && canDrag(gameRef.current, id)}
          onDragOver={(id, room, at) => {
            setBubble(null);
            setHint(false);
            const d = room ? planDrop(gameRef.current, id, room) : null;
            setDragTip({ text: d?.text ?? 'Suéltalo en una sala.', ok: !!d?.ok, at });
            return d;
          }}
          onRoomDrag={(id) => works.startPick({ kind: 'move', id })}
          onRoomDrop={() => {
            works.cancelPick();
            toast('Ahí no cabe: suéltala en una casilla verde.');
          }}
          onDrop={(id, room) => {
            setDragTip(null);
            const d = room ? planDrop(gameRef.current, id, room) : null;
            if (!d?.ok) return;
            for (const a of d.actions) dispatch(a);
            toast(d.text);
            haptic('select');
          }}
        />
        {dragTip && (
          <span
            class={`droptip ${dragTip.ok ? 'ok' : 'bad'}`}
            style={{
              left: `${Math.max(124, Math.min(window.innerWidth - 124, dragTip.at.x))}px`,
              top: `${Math.max(110, dragTip.at.y)}px`,
            }}
          >
            {dragTip.text}
          </span>
        )}
        {hover && !bubble && !dragTip && (
          <span class="hovertip" style={{ left: `${hover.at.x}px`, top: `${hover.at.y}px` }}>
            {hover.label}
          </span>
        )}
        {bubble && <SpeechBubble bubble={bubble} scene={scene} />}
        {hint && !notice && (
          <div class="hint-toast" role="status">
            Arrastra para recorrer la casa · Toca el salón para ver el tablón
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
          {roomsLive && (
            <button
              class={`btn-icon ${works.planning ? 'is-on' : ''}`}
              aria-label="Modo obras"
              data-help="Modo obras: marca los huecos que se pueden excavar y el solar de al lado, y abajo salen las salas para construir. Todo se apunta y se paga al final."
              onClick={() => {
                if (works.planning && works.steps.length)
                  toast('Tienes obras apuntadas: págalas o sal desde la barra de abajo.');
                else if (works.planning) works.discard();
                else if (!worksOpen(works.view)) toast(LOCKED);
                else {
                  openPanel(null);
                  works.startPlan();
                }
              }}
            >
              <Icon name="martillo" size={16} />
            </button>
          )}
        </div>
        {!panel && works.planning && works.selected && !works.pick && scene.current && (
          <RoomMenu
            scene={scene.current}
            game={works.view}
            roomId={works.selected}
            onUpgrade={(id) => works.work({ type: 'upgradeRoom', id })}
            onMove={(id) => works.startPick({ kind: 'move', id })}
            onDemolish={(id) => works.work({ type: 'demolish', id })}
            onInfo={(id) => {
              setRoomId(id);
              openPanel('sala');
            }}
            onClose={() => works.select(null)}
          />
        )}
        {!panel && works.planning && <WorksBar works={works} onMore={() => openPanel('gremio')} />}
        {!panel && !game.over && !works.pick && !works.planning && (
          <DayBar
            unread={unread}
            away={away}
            onMail={() => openPanel('correo')}
            onAway={() => openPanel('fuera')}
            part={clock / DAY_SECONDS}
            canClose={clock >= DUSK * DAY_SECONDS}
            night={passing}
            pace={settings.pace}
            onPace={() =>
              setSettings({
                ...settings,
                pace: settings.pace === 1 ? 2 : settings.pace === 2 ? 4 : 1,
              })
            }
            onDusk={() =>
              moveClock(Math.max(clockRef.current, DUSK * DAY_SECONDS), clockRef.current)
            }
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
              onHireWorker={hireWorker}
              onFireWorker={(id) => {
                const w = game.workers.find((x) => x.id === id);
                dispatch({ type: 'fireWorker', id });
                audio.play('close');
                if (w) toast(`${w.name} recoge sus cosas y se despide.`);
              }}
              onAssign={assignJob}
            />
          </Panel>
        )}
        {panel === 'sala' && roomId && (
          <Panel
            title={
              ROOMS[works.view.building.rooms.find((r) => r.id === roomId)?.type ?? 'salon'].name
            }
            onClose={() => openPanel(null)}
          >
            <RoomPanel
              game={works.view}
              roomId={roomId}
              onUpgrade={(id) =>
                works.planning
                  ? works.work({ type: 'upgradeRoom', id }) && openPanel(null)
                  : upgradeRoom(id)
              }
              onLink={roomLink}
              onAssign={works.planning ? undefined : assignJob}
            />
          </Panel>
        )}
        {panel === 'gremio' && (
          <Panel title="El gremio" onClose={() => openPanel(null)}>
            <GremioPanel
              game={works.view}
              focus={focusFac}
              onUpgrade={(k) =>
                works.planning ? works.work({ type: 'upgrade', fac: k }) : upgrade(k)
              }
              obrasFirst={works.planning}
              obras={
                roomsLive ? (
                  <ObrasPanel
                    game={works.view}
                    planning={works.planning}
                    onPick={pickSpot}
                    onWork={(a) => works.work(a)}
                    onRoom={(id) => {
                      setRoomId(id);
                      openPanel('sala');
                      scene.current?.focus(id);
                    }}
                    onPlan={() => {
                      works.startPlan();
                      openPanel(null);
                    }}
                  />
                ) : undefined
              }
              onSaves={() => setSaveMenu(true)}
              onSettings={() => setSettingsOpen(true)}
              onLibro={() => openPanel('libro')}
              onTaberna={() => openPanel('casa')}
              onTitle={toTitle}
              onArcon={() => {
                setArconTab('equipo');
                openPanel('arcon');
              }}
            />
          </Panel>
        )}
        {panel === 'arcon' && (
          <Panel title="Arcón y trofeos" onClose={() => openPanel(null)}>
            <ArconPanel
              game={game}
              tab={arconTab}
              onTab={setArconTab}
              onEquip={(heroId, itemId) => {
                const h = game.heroes.find((x) => x.id === heroId);
                const it = game.inventory.find((x) => x.id === itemId);
                dispatch({ type: 'equip', heroId, itemId });
                audio.play('select');
                if (h && it) toast(`${h.name} se equipa: ${it.name}.`);
              }}
              onUnequip={(heroId) => {
                dispatch({ type: 'unequip', heroId });
                audio.play('deselect');
              }}
              onSell={sell}
              onSellTrophy={sellTrophy}
              onHero={(id) => {
                audio.play('open');
                setCard(id);
              }}
            />
          </Panel>
        )}
        {panel === 'casa' && (
          <Panel title="Tu taberna" onClose={() => openPanel(null)}>
            <TabernaPanel
              game={game}
              onCustom={(patch) => {
                dispatch({ type: 'custom', patch });
                audio.play('click');
              }}
              onDog={() => {
                dispatch({ type: 'buyDog' });
                audio.play('coin');
                toast('Tizón ya duerme junto a la puerta. ¡Guau!');
              }}
              onDecor={(id, on) => {
                dispatch({ type: 'decor', id, on });
                audio.play(on ? 'build' : 'close');
                if (on) toast(`${DECOR[id].name}: ya luce en el salón.`);
              }}
              onFacade={(id) => {
                dispatch({ type: 'facade', id });
                audio.play('build');
                toast(`${FACADE[id].name}: ya se ven desde el camino.`);
              }}
              onRaven={() => {
                dispatch({ type: 'buyRaven' });
                audio.play('coin');
                toast('Carbón se posa en el letrero y grazna. Parece que le gusta el sitio.');
              }}
              onFeast={() => {
                dispatch({ type: 'feast' });
                audio.fanfare();
                toast('¡Fiesta montada! Banderines, música y la caja abierta hasta el alba.');
              }}
            />
          </Panel>
        )}
        {panel === 'libro' && (
          <Panel title="Libro de hazañas" onClose={() => openPanel(null)}>
            <LibroPanel game={game} records={records} />
          </Panel>
        )}
        {panel === 'correo' && (
          <Panel title="Correo del amanecer" onClose={() => openPanel(null)}>
            <MailPanel reports={game.reports} onOpen={openReport} />
          </Panel>
        )}
        {panel === 'fuera' && (
          <Panel title="La comarca" onClose={() => openPanel(null)}>
            <MapPanel
              game={game}
              onHero={(id) => setCard(id)}
              onQuest={(id) => {
                audio.play('open');
                setQuestId(id);
              }}
            />
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
          <Letter
            report={report}
            heroes={game.heroes}
            seal={customOf(game)}
            onClose={() => setReportId(null)}
            onWatch={
              report.fight ? () => setWatching({ fight: report.fight!, dawn: false }) : undefined
            }
          />
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
            onGuard={(on) => {
              dispatch({ type: 'guard', id: cardHero.id, on });
              audio.play(on ? 'select' : 'deselect');
            }}
            onJob={works.planning ? undefined : (room) => assignJob(cardHero.id, room)}
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
        {dawnOpen && screen === 'game' && (
          <Dawn
            day={game.day}
            name={customOf(game).name}
            flavor={game.flavor}
            events={game.dawn}
            unread={unread}
            onClose={() => closeDawn()}
            onMail={() => closeDawn('correo')}
          />
        )}
        {screen === 'game' && !dawnOpen && !passing && game.opening && !game.opening.seen && (
          <Opening
            arrival={game.opening}
            rooms={roomsLive}
            best={prevBest}
            onOpen={() => {
              audio.play('dawn');
              dispatch({ type: 'ackOpening' });
              scene.current?.cheer('barra');
              toast(`${customOf(game).name} abre sus puertas al mundo. ¡A por la leyenda!`);
            }}
            onRetry={restart}
          />
        )}
        {game.over && !dawnOpen && screen === 'game' && <GameOver game={game} onNew={restart} />}
      </div>
      <TabBar
        tab={tab}
        onTab={(t) => {
          if (t === 'heroes') setHeroFilter('todos');
          if (t === 'gremio') setFocusFac(null);
          openPanel(t === 'taberna' ? null : t);
        }}
      />
      {raiding && (
        <div class="raid-banner" role="status">
          <b>¡Asalto a la taberna!</b>
          <button class="btn btn-wood" onClick={() => scene.current?.skipRaid()}>
            Saltar
          </button>
        </div>
      )}
      {bossCall && callReport?.fight && (
        <BossCall
          fight={callReport.fight}
          who={callReport.who}
          onWatch={() => {
            setBossCall(null);
            audio.play('horn');
            setWatching({ fight: callReport.fight!, dawn: true });
          }}
          onLater={() => {
            setBossCall(null);
            setDawnOpen(true);
          }}
        />
      )}
      {watching && <BossFight fight={watching.fight} onClose={closeWatch} />}
      {pendingEvent && (
        <EventCard
          event={pendingEvent}
          onChoose={(i) => {
            const next = dispatch({ type: 'choose', index: i });
            audio.play(i === 0 ? 'coin' : 'close');
            if (next.lastChoice) toast(next.lastChoice);
          }}
        />
      )}
      {tip && (
        <UncleNote
          tip={tip}
          onOk={() => {
            audio.play('close');
            dispatch({ type: 'tip', id: tip.id });
          }}
          onOff={() => dispatch({ type: 'tip', id: '*' })}
        />
      )}
      {screen === 'title' && (
        <Title
          saved={hasGame ? game : null}
          onContinue={() => {
            audio.play('open');
            setScreen('game');
          }}
          onNew={restart}
          onSaves={() => setSaveMenu(true)}
          onSettings={() => setSettingsOpen(true)}
        />
      )}
      {screen === 'splash' && <Splash onDone={() => setScreen('title')} />}
      {settingsOpen && (
        <SettingsMenu
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
          onCheat={(kind) => {
            const r = cheat(gameRef.current, kind);
            if (r.state !== gameRef.current) {
              commit(r.state);
              setSceneGame(r.state);
            }
            audio.play('coin');
            return r.note;
          }}
          onBoss={(boss, won) => {
            const fight = testFight(gameRef.current, boss, won);
            if (!fight) return toast('No hay nadie en casa para pelear.');
            setSettingsOpen(false);
            setWatching({ fight, dawn: false });
          }}
        />
      )}
      {saveMenu && (
        <SaveMenu
          game={hasGame ? game : null}
          onLoad={loadSave}
          onClose={() => setSaveMenu(false)}
        />
      )}
      <HoldHelp />
    </div>
  );
}
