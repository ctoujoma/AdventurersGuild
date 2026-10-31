import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useBackButton } from '../platform/back';
import { HoldHelp } from './HoldHelp';
import { haptic, setHaptics } from '../platform/haptics';
import { audio, type Mood } from '../audio/audio';
import { catchUp, waitText } from '../core/away';
import { left, setRealTime } from './when';
import { IncidentMark } from './IncidentMark';
import { canClose, canHire, customOf, newGame, reduce, type Action } from '../core/game';
import { raidRoute } from '../core/assault';
import { canHireWorker } from '../core/workers';
import { DAY_SECONDS, DELIVERIES, DUSK } from '../core/balance';
import { DECOR, FACADE, PET_LINES } from '../data/custom';
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
import { finishedWorks, gatherAlerts, type Notice } from './alerts';
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
import { canDrag, planDrop, planTask, type Task } from './drop';
import { UncleNote } from './UncleNote';
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
  /** La noche está pasando en la escena (entre «Cerrar» y el resumen del amanecer). */
  const [passing, setPassing] = useState(false);
  /** Días que pasaron con el juego cerrado (la carta del amanecer cuenta «Mientras no estabas»). */
  const [awayDays, setAwayDays] = useState(0);
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
  /** Trabajador tocado en la escena: Tareas lo abre elegido. */
  const [crewFocus, setCrewFocus] = useState<string | null>(null);
  useEffect(() => {
    if (panel !== 'heroes') setCrewFocus(null);
  }, [panel]);
  /** Salas cuya obra acaba de terminar: la campanita lo dice durante ese día. */
  const [worksDone, setWorksDone] = useState<string[]>([]);
  const prevGame = useRef(game);
  useEffect(() => {
    const before = prevGame.current;
    prevGame.current = game;
    const done = finishedWorks(before, game);
    if (game.day !== before.day) setWorksDone(done);
    else if (done.length) setWorksDone((d) => [...d, ...done.filter((id) => !d.includes(id))]);
  }, [game]);
  const [hint, setHint] = useState(false);
  /** Splash del desarrollador, título y juego. Con #debug se entra directo a la partida. */
  const [screen, setScreen] = useState<'splash' | 'title' | 'game'>(() =>
    location.hash.includes('debug') ? 'game' : 'splash',
  );
  const [hasGame, setHasGame] = useState(!!saved);
  const [saveMenu, setSaveMenu] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  // Los plazos se cuentan en minutos con el tiempo que corre solo (ver `when.ts`).
  // El tiempo corre solo salvo con los días a la antigua (modo prueba).
  const realTime = !settings.classicTime;
  setRealTime(realTime);
  // Acelerar el reloj: mientras dura «La deuda» y en el modo prueba (más adelante, quizá de pago).
  const canRush = game.mode !== 'libre' || settings.tester;
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
    if (scene.current) {
      scene.current.speed = settings.speed;
      scene.current.fewLights = settings.fewLights;
    }
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
    // Con la hora: al volver, el tiempo que corre solo sabe cuánto ha estado cerrado.
    saveGame({ ...next, lastSeen: Date.now() });
    setRecords((r) => {
      const m = mergeRecords(r, next);
      if (m !== r) saveRecords(m);
      return m;
    });
  };
  const dispatch = (a: Action): GameState => {
    const before = gameRef.current;
    const next = reduce(before, a);
    if (next !== before) commit(next);
    // Lo que pasa con los incidentes (empieza uno, se arregla o sale mal) se avisa al momento.
    const news = next.incidentNews;
    if (news?.length && news !== before.incidentNews) {
      const last = news.at(-1)!;
      toast(news.map((n) => n.t).join(' '));
      audio.play(last.k === 'good' ? 'cheer' : last.k === 'bad' ? 'thud' : 'creak', 0.6);
      haptic(last.k === 'bad' ? 'thud' : 'select');
    }
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
    audio.setHour(next / DAY_SECONDS);
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
  /**
   * Tiempo que corre solo (en prueba): al volver tras `seconds` reales fuera, se simula lo que
   * ha pasado (`catchUp`) y, si han pasado días, la carta del amanecer lo cuenta.
   */
  const comeBack = (seconds: number) => {
    if (!realTime || passing) return;
    dispatch({ type: 'tick', to: clockRef.current });
    const away = catchUp(gameRef.current, seconds);
    if (!away.seconds) return;
    commit(away.state);
    clockRef.current = away.state.clock ?? 0;
    setClock(clockRef.current);
    scene.current?.setTime(clockRef.current / DAY_SECONDS);
    if (away.days.length) {
      setPanel(null);
      setAwayDays(away.days.length);
      setDawnOpen(true);
    } else
      toast(
        away.waiting
          ? waitText(away.state, away.waiting)
          : 'La taberna ha seguido abierta mientras no estabas.',
      );
  };
  const comeBackRef = useRef(comeBack);
  comeBackRef.current = comeBack;
  // En la pantalla de título no se pone al día: ya lo hará «Continuar» con la hora guardada.
  const inGame = useRef(false);
  inGame.current = screen === 'game';
  // Si se entra directo a la partida (con #debug), se pone al día al arrancar.
  useEffect(() => {
    const seen = gameRef.current.lastSeen;
    if (screen === 'game' && seen) comeBackRef.current((Date.now() - seen) / 1000);
    // Solo al arrancar.
  }, []);
  // Con la pestaña oculta o el juego cerrado, se guarda la hora; al volver, se pone al día.
  const hiddenAt = useRef<number | null>(null);
  useEffect(() => {
    const onHide = () => {
      if (hiddenAt.current === null) hiddenAt.current = Date.now();
      saveGame({ ...gameRef.current, lastSeen: Date.now() });
    };
    const onVisible = () => {
      if (document.hidden) return onHide();
      const t = hiddenAt.current;
      hiddenAt.current = null;
      if (t !== null && inGame.current) comeBackRef.current((Date.now() - t) / 1000);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);
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
    if (id.startsWith('bicho:')) {
      // El gato o el perro del salón: ronronea o ladra (en la escena) y dice algo.
      const lines = PET_LINES[id.slice(6) as keyof typeof PET_LINES];
      if (lines && !works.planning) toast(lines[Math.floor(Math.random() * lines.length)]!);
      return;
    }
    if (id.startsWith('cosa:')) {
      // Algo de una sala: en obras elige la sala; si no, abre lo suyo.
      const [, act, room] = id.split(':');
      if (works.planning) {
        if (room) works.select(room);
        return;
      }
      if (act === 'tablon') openPanel('tablon');
      else if (act === 'mapa') openPanel('fuera');
      else if (act === 'candidatos' || act === 'equipo') roomLink(act);
      return;
    }
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
      `${names} ${plural(ids.length, 'sale', 'salen')} hacia ${q.place}. Vuelta en ${left(days, clockRef.current)}.`,
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

  /** Cambiar la tarea de alguien (trabajar, entrenar, guardia, descansar) desde una lista o ficha. */
  const setTask = (who: string, task: Task) => {
    const d = planTask(gameRef.current, who, task);
    if (!d.ok) return toast(d.text);
    for (const a of d.actions) dispatch(a);
    audio.play(task ? 'select' : 'deselect');
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
    setAwayDays(0);
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
        scene.current?.cheer(
          'barra',
          wins.flatMap((r) => r.heroIds),
        );
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
      // Con el tiempo que corre solo, acelerar solo se puede mientras dura «La deuda» (y en el
      // modo prueba): luego el reloj es el de verdad.
      const pace = realTime && !canRush ? 1 : settings.pace;
      const next = Math.min(DAY_SECONDS, before + 0.25 * pace);
      if (next === before) return;
      moveClock(next, before);
    }, 250);
    return () => clearInterval(id);
  }, [ticking, settings.pace, realTime, canRush]);
  // Tiempo que corre solo (en prueba): al acabar el día la noche cae sola, cuando no hay nada
  // abierto delante (un panel o una ficha esperan a que se cierren).
  useEffect(() => {
    if (!realTime || !ticking || passing || clock < DAY_SECONDS) return;
    if (panel || card || questId || works.planning) return;
    endDay();
  }, [clock, ticking, passing, panel, card, questId, works.planning, realTime]);
  // Lo que se abre desde el gremio (arcón, libro, adornos) deja encendida su pestaña.
  const tab: TabId =
    panel === 'tablon' || panel === 'heroes' || panel === 'gremio'
      ? panel
      : panel === 'arcon' || panel === 'libro' || panel === 'casa'
        ? 'gremio'
        : 'taberna';

  const alerts = useMemo(
    () => gatherAlerts(passing ? sceneGame : game, worksDone),
    [passing ? sceneGame : game, worksDone],
  );
  /** Tocar un aviso lleva a donde se arregla. */
  const goAlert = (n: Notice) => {
    const g = n.go;
    if ('room' in g) {
      setRoomId(g.room);
      openPanel('sala');
      scene.current?.focus(g.room);
      setWorksDone((d) => d.filter((id) => id !== g.room));
    } else if ('crew' in g) {
      openPanel('heroes');
      setHeroFilter('trabajadores');
      setCrewFocus(g.crew);
    } else if ('quest' in g) {
      openPanel('tablon');
      setQuestId(g.quest);
    } else openPanel(g.panel);
  };

  return (
    <div class="game">
      <Hud
        game={passing ? sceneGame : game}
        onSettings={() => setSettingsOpen(true)}
        alerts={alerts}
        onAlert={goAlert}
        quiet={passing || dawnOpen || !!bossCall || !!watching || screen !== 'game'}
      />
      <div class="stage">
        <SceneView
          model={model}
          onReady={(s) => {
            scene.current = s;
            s.setTime(clockRef.current / DAY_SECONDS);
            s.speed = settings.speed;
            s.fewLights = settings.fewLights;
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
            // Un trabajador no tiene ficha: se abre Tareas con él elegido.
            const w = game.workers.find((x) => x.id === id);
            if (w) {
              audio.play('open', 0.6);
              setCrewFocus(w.id);
              setHeroFilter('trabajadores');
              openPanel('heroes');
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
            // Un incidente arreglado ya se avisa solo (con lo que ha pasado).
            if (!d.actions.some((a) => a.type === 'incident')) toast(d.text);
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
        {/* Con el menú de obras abierto, su nombre ya está en el menú. */}
        {hover && !bubble && !dragTip && !(works.planning && works.selected) && (
          <span class="hovertip" style={{ left: `${hover.at.x}px`, top: `${hover.at.y}px` }}>
            {hover.label.split('\n').map((line, i) => (i ? <small key={i}>{line}</small> : line))}
          </span>
        )}
        {bubble && <SpeechBubble bubble={bubble} scene={scene} />}
        {!passing &&
          !dawnOpen &&
          (game.incidents ?? []).map((inc) => (
            <IncidentMark
              key={inc.id}
              game={game}
              inc={inc}
              clock={clock}
              speed={realTime && !canRush ? 1 : settings.pace}
              scene={scene}
              onAct={(act) => {
                if (act.by === 'tocar') audio.play('squeak', 0.5);
                dispatch({ type: 'incident', id: inc.id, act });
              }}
              onAsk={(text, room) => {
                toast(text);
                scene.current?.focus(room);
              }}
            />
          ))}
        {/* La nota del tío ya explica lo mismo: el cartel solo sale sin ella. */}
        {hint && !notice && !tip && (
          <div class="hint-toast" role="status">
            Arrastra para mirar · toca el salón
          </div>
        )}
        {notice && (
          <div key={notice.key} class="hint-toast notice" role="status">
            {notice.text}
          </div>
        )}
        <div class="stage-tools">
          {/* En pantallas táctiles se acerca pellizcando: sin − ni +. */}
          <button
            class="btn-icon tool-zoom"
            aria-label="Alejar"
            onClick={() => scene.current?.zoomBy(-1)}
          >
            <Icon name="minus" size={16} />
          </button>
          <button
            class="btn-icon tool-zoom"
            aria-label="Acercar"
            onClick={() => scene.current?.zoomBy(1)}
          >
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
            real={realTime}
            rush={canRush}
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
              clock={clock}
              seeAll={game.fac.mapas >= 2}
              onOpen={(id) => {
                audio.play('open');
                setQuestId(id);
              }}
            />
          </Panel>
        )}
        {panel === 'heroes' && (
          <Panel title="Héroes y personal" onClose={() => openPanel(null)}>
            <HeroesPanel
              game={game}
              focus={crewFocus}
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
              onTask={setTask}
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
              onTask={works.planning ? undefined : setTask}
              onOpen={(id) => setCard(id)}
              onTint={
                works.planning ? undefined : (id, tint) => dispatch({ type: 'tint', id, tint })
              }
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
          <Panel title="Arcón" onClose={() => openPanel(null)}>
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
          <Panel title="Adornos" onClose={() => openPanel(null)}>
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
              onLook={(patch) => dispatch({ type: 'facadeLook', patch })}
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
          <Panel title="La comarca" wide onClose={() => openPanel(null)}>
            <MapPanel
              game={game}
              onHero={(id) => setCard(id)}
              onQuest={(id) => {
                audio.play('open');
                setQuestId(id);
              }}
            />
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
            onTask={works.planning ? undefined : (task) => setTask(cardHero.id, task)}
            onDress={
              settings.tester
                ? (dress) => dispatch({ type: 'dress', heroId: cardHero.id, dress })
                : undefined
            }
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
                    ? `${cardHero.name} está de misión. Vuelve en ${left(cardHero.days, clockRef.current)}.`
                    : `${cardHero.name} no está en la taberna.`,
                  { x: 160, y: 120 },
                );
            }}
          />
        )}
        {dawnOpen && screen === 'game' && (
          <Dawn
            day={game.day}
            away={awayDays || undefined}
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
      {/* En el modo obras, la cinta manda: sin pestañas, más escena. */}
      <TabBar
        hidden={works.planning}
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
            const seen = gameRef.current.lastSeen;
            if (seen) comeBack((Date.now() - seen) / 1000);
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
