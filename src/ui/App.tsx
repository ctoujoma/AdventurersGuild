import { easeIssue, nightmareNow } from '../core/nightmare';
import { CraftMark } from './CraftMark';
import { CollectMark, collectFx } from './CollectMark';
import { BufferImage } from './BufferImage';
import { queuesShowing, tillReady, tillShows } from '../core/collect';
import { itemIcon, potionIcon } from '../art/items';
import { flyCoins } from './coinFlight';
import { SHEETS, coverOf } from './cover';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useBackButton } from '../platform/back';
import { Held } from './held';
import { HoldHelp } from './HoldHelp';
import { haptic, setHaptics } from '../platform/haptics';
import { loadHushed, saveHushed } from '../platform/hushed';
import { audio, type Mood } from '../audio/audio';
import { catchUp, waitText } from '../core/away';
import { dawnIn } from './when';
import { IncidentHelpers, IncidentMark } from './IncidentMark';
import { RumorMark } from './RumorMark';
import { rumorRoom } from '../core/rumors';
import { messengerRoom } from '../core/messenger';
import { MessengerCard, MessengerMark } from './MessengerCard';
import { canClose, canHire, customOf, newGame, reduce, type Action } from '../core/game';
import { hasUnlock } from '../core/goals';
import type { UnlockId } from '../data/unlocks';
import { Assault, assaultSetup, raidRoute, raidSeed } from '../core/assault';
import { Rng } from '../core/rng';
import { canHireWorker } from '../core/workers';
import { DAY_SECONDS, DELIVERIES, DUSK, NIGHT_RUSH, WORK_END } from '../core/balance';
import { DECOR, FACADE, isDefaultName, PET_LINES } from '../data/custom';
import { RUMORS, VISITORS, type VisitorKind } from '../data/visitors';
import type { BossFight as BossFightRecord, Facilities, GameState, Heading } from '../core/model';
import { FACILITY_INFO } from '../data/labels';
import { loadRecords, mergeRecords, saveRecords } from '../platform/records';
import { loadGame, saveGame, webStorage } from '../platform/storage';
import { addMinute, sendReport } from '../platform/telemetry';
import type { Point } from '../world/scene';
import { cheat, testFight } from '../core/cheats';
import { BossCall, BossFight, BossWait } from './BossFight';
import { bossOf, fightRoster } from '../core/chains';
import { missionCombat } from '../core/combat';
import { Dawn } from './Dawn';
import { DayBar } from './DayBar';
import { GameOver } from './GameOver';
import { HeroCard } from './HeroCard';
import { Hud } from './Hud';
import { PayDay } from './PayDay';
import {
  finishedWorks,
  gatherAlerts,
  pruneHushed,
  shownAlerts,
  type Hushed,
  type Notice,
} from './alerts';
import { Icon } from './icons';
import { Letter } from './Letter';
import { EventCard } from './EventCard';
import { StrangerCard } from './StrangerCard';
import { MESSENGER_ID, STRANGER_ID } from '../world/scene';
import { Opening } from './Opening';
import { NameTavern } from './NameTavern';
import { Panel } from './Panel';
import { HistoryButton, LibroPanel } from './panels/LibroPanel';
import { MapPanel } from './panels/MapPanel';
import { SaveMenu } from './SaveMenu';
import { UpdateBar } from './UpdateBar';
import { SettingsMenu } from './SettingsMenu';
import { PerfMeter } from './PerfMeter';
import type { WeatherKind } from '../world/weather';
import {
  applyLook,
  loadSettings,
  nextPace,
  paceMax,
  type Pace,
  saveSettings,
  type Settings,
} from '../platform/settings';
import { Splash } from './Splash';
import { Title } from './Title';
import { nextTip } from './tips';
import { canDrag, planDrop, planTask, type Drop, type Task } from './drop';
import { UncleNote } from './UncleNote';
import { TripSheet } from './TripSheet';
import { ExpeditionSheet } from './ExpeditionSheet';
import { ExpeditionView } from './ExpeditionView';
import { ExpIntro } from './ExpIntro';
import { ExpFightReplay } from './ExpFightReplay';
import { expOf } from './expedition';
import { GLOW_SFX, type GlowLevel } from './glow';
import { TutorialNote } from './TutorialNote';
import { TutorialFocus } from './TutorialFocus';
import { tutorialFocus } from './tutorialFocus';
import { IntroLetter } from './IntroLetter';
import {
  obrasOn,
  tutorialFrozen,
  tutorialOn,
  tutorialStep,
  tutorialWait,
  type TutorialSkip,
} from '../core/tutorial';
import { GremioPanel } from './panels/GremioPanel';
import { HeroesPanel, type HeroFilter } from './panels/HeroesPanel';
import { HistoryPanel } from './panels/HistoryPanel';
import { TablonPanel } from './panels/TablonPanel';
import { priceOf } from '../core/gear';
import { TabernaPanel } from './panels/TabernaPanel';
import { ArconPanel, type ArconTab } from './panels/ArconPanel';
import { QuestSheet } from './QuestSheet';
import { SceneView, type GameScene } from './SceneView';
import { RaidCrew } from './RaidCrew';
import { RoomPanel, type RoomLink } from './panels/RoomPanel';
import { ObrasPanel } from './panels/ObrasPanel';
import { WorksBar } from './WorksBar';
import { RoomMenu } from './RoomMenu';
import { useWorks } from './works';
import { LOCKED, worksOpen } from '../core/rooms';
import { ROOMS } from '../data/rooms';
import { TabBar, type TabId } from './TabBar';
import type { BellView } from './AlertBell';
import { listNames } from './text';
import { sceneModel } from './view';
import { placeMsg } from '../data/places';
import { t, tx } from '../textos';

/** El mapa es la pestaña «Mapa»; el arcón, Héroes › Equipo; el correo, la campana. */
type PanelId = 'tablon' | 'heroes' | 'gremio' | 'fuera' | 'libro' | 'casa' | 'sala' | 'historial';

interface Bubble {
  text: string;
  x: number;
  y: number;
  /** Si se sabe, el punto del mundo al que se refiere: el bocadillo lo sigue. */
  wx?: number;
  wy?: number;
  key: number;
}

const freshGame = () => newGame(Date.now().toString(36), { tutorial: true });

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

/** Segundos de respiro antes del tutorial de obras tras poner nombre a la taberna. */
const NAME_BREATH = 18;
/** Lo que dura la despedida de una expedición en la escena (ms). */
const BYE_MS = 4200;

export function App() {
  const [saved] = useState(loadGame);
  const [game, setGame] = useState<GameState>(() => saved ?? freshGame());
  /** Lo que ve la escena: durante el amanecer sigue mostrando la noche anterior. */
  const [sceneGame, setSceneGame] = useState(game);
  const [panel, setPanel] = useState<PanelId | null>(null);
  /** La campana abierta (avisos o informes) y de dónde se llegó al historial. */
  const [bell, setBell] = useState<BellView | null>(null);
  const [histFrom, setHistFrom] = useState<'tablon' | 'libro'>('tablon');
  /** La pestaña del jardín abierta en Adornos: panel bajo y la cámara en el jardín. */
  const [gardenView, setGardenView] = useState(false);
  /** Grupo fuera cuya ficha «Encargo en curso» está abierta. */
  const [tripId, setTripId] = useState<string | null>(null);
  /** Expediciones: la hoja de preparar una (`'nueva'`) o el visor de una fuera (su id). */
  const [expId, setExpId] = useState<string | null>(null);
  /** La despedida de una expedición en la escena (EX13): unos 4 s antes de abrir su visor. */
  const [bye, setBye] = useState<string | null>(null);
  /** El tutorial corto de las expediciones (tras la carta del veterano o al abrir el mapa). */
  const [expIntro, setExpIntro] = useState(false);
  /** Informes de expediciones que acaban de volver: su «La mochila» sale sola en cuanto se pueda. */
  const [bagQueue, setBagQueue] = useState<string[]>([]);
  const byeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [arconTab, setArconTab] = useState<ArconTab>('equipo');
  /** Sala tocada en la vista de salas (su ficha). */
  const [roomId, setRoomId] = useState<string | null>(null);
  // Partida nueva: el día 1 se abre con la carta del tío.
  const [dawnOpen, setDawnOpen] = useState(!saved);
  /** Con el juego abierto, el amanecer no tapa la pantalla: queda un botón para ver el parte. */
  const [dawnChip, setDawnChip] = useState<number | null>(null);
  /** La carta del amanecer se ha abierto desde ese botón (lo de la escena ya pasó). */
  const fromChip = useRef(false);
  /** La noche está pasando en la escena (entre «Cerrar» y el resumen del amanecer). */
  const [passing, setPassing] = useState(false);
  /** Días que pasaron con el juego cerrado (la carta del amanecer cuenta «Mientras no estabas»). */
  const [awayDays, setAwayDays] = useState(0);
  /** Hay un asalto en el patio (se puede saltar). */
  const [raiding, setRaiding] = useState(false);
  /** El asalto de esta noche se juega en directo (se puede mover a la gente). */
  const [raidLive, setRaidLive] = useState(false);
  const raidLiveRef = useRef(false);
  raidLiveRef.current = raidLive;
  /** Pelea contra un jefe de esta noche: el aviso (id del informe) y la pelea abierta. */
  const [bossCall, setBossCall] = useState<string | null>(null);
  /** Al empezar con el tutorial: unos segundos para ver la taberna (la cámara entra) antes del cuaderno. */
  const [introHold, setIntroHold] = useState(false);
  /** Grupo ante su jefe cuyo aviso está a la vista (con el juego abierto). */
  const [bossWait, setBossWait] = useState<string | null>(null);
  const [watching, setWatching] = useState<{
    fight: BossFightRecord;
    dawn: boolean;
    /** Se juega: al acabar, las órdenes van al núcleo (el grupo que espera ante el jefe). */
    play?: string;
  } | null>(null);
  const [card, setCard] = useState<string | null>(null);
  /** La oferta del forastero de la tormenta, abierta (ver `strangerKey`). */
  const [strangerOpen, setStrangerOpen] = useState(false);
  /** El mensajero tardío: su tarjeta, al tocarle a él o su aviso (no para «Pasar la noche»). */
  const [messengerOpen, setMessengerOpen] = useState(false);
  const [questId, setQuestId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; key: number } | null>(null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [hover, setHover] = useState<{ label: string; at: Point } | null>(null);
  /** Llevando a alguien con el dedo: qué pasaría si se suelta ahí. */
  const [dragTip, setDragTip] = useState<{ text: string; ok: boolean; at: Point } | null>(null);
  const lastDrop = useRef<Drop | null>(null);
  const [focusFac, setFocusFac] = useState<keyof Facilities | null>(null);
  const [heroFilter, setHeroFilter] = useState<HeroFilter>('todos');
  /** Trabajador tocado en la escena: Tareas lo abre elegido. */
  const [crewFocus, setCrewFocus] = useState<string | null>(null);
  useEffect(() => {
    if (panel !== 'heroes') setCrewFocus(null);
  }, [panel]);
  /** El cobro del día de pago a la vista, y lo que viene después (el jefe o la carta). */
  const [paying, setPaying] = useState(false);
  const payThen = useRef<(() => void) | null>(null);
  /**
   * Lo que llega solo (el cobro, el aviso de un jefe, un suceso…) no corta lo que el jugador
   * tiene abierto: si hay un panel, una ficha o una carta delante, espera a que lo cierre.
   */
  const busyRef = useRef(false);
  const [held] = useState(() => new Held());
  const whenFree = (fn: () => void) => held.when(busyRef.current, fn);
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
  // El tiempo corre solo salvo con los días a la antigua (modo prueba).
  const realTime = !settings.classicTime;
  // Acelerar el reloj: mientras dura «La deuda» y en el modo prueba (más adelante, quizá de pago).
  // El reloj se acelera siempre: hasta ×4, y ×8 con el modo prueba (`paceMax`).
  const canRush = true;
  const clockSpeed = Math.min(settings.pace, paceMax(settings.tester)) as Pace;
  // Las piezas que se ganan; en el modo prueba, todas.
  const has = (id: UnlockId) => settings.tester || hasUnlock(game, id);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Modo prueba: el tiempo forzado (solo en esta sesión). */
  const [forcedWeather, setForcedWeather] = useState<WeatherKind | null>(null);
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
      scene.current.moodLight = settings.moodLight;
      scene.current.weatherMode = settings.weather;
      scene.current.calm = settings.calm;
    }
    saveSettings(settings);
  }, [settings]);
  const gameRef = useRef(game);
  gameRef.current = game;

  useEffect(() => {
    if (!dawnOpen && !paying && !passing) setSceneGame(game);
  }, [game, dawnOpen, paying, passing]);

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
      toast(news.map((n) => tx(n.t)).join(' '));
      // Un hallazgo raro o legendario de una expedición suena con su brillo (EX18).
      const glow = Math.max(0, ...news.map((n) => n.glow ?? 0)) as GlowLevel;
      if (glow) audio.play(GLOW_SFX[glow]);
      else audio.play(last.k === 'good' ? 'cheer' : last.k === 'bad' ? 'thud' : 'creak', 0.6);
      haptic(last.k === 'bad' ? 'thud' : 'select');
    }
    // Vuelve una expedición con el juego abierto (EX20): la cámara les ve entrar por el patio y
    // luego, ronda en la barra (si no se está mirando otra cosa).
    const back = (before.expeditions ?? []).filter(
      (e) => !next.expeditions?.some((x) => x.id === e.id),
    );
    // Su mochila sale sola, como aviso grande (espera a que no haya nada abierto).
    if (back.length) {
      const fresh = next.reports
        .filter((r) => r.exp?.bag && !before.reports.some((x) => x.id === r.id))
        .map((r) => r.id);
      if (fresh.length) setBagQueue((q) => [...q, ...fresh]);
    }
    if (back.length && !panel && !bye && !reportId && (!expId || back.some((e) => e.id === expId)))
      welcome(
        back
          .flatMap((e) => e.heroIds)
          .filter((id) => next.heroes.some((h) => h.id === id && h.status !== 'muerto')),
      );
    // Un grupo ha llegado ante su jefe con el juego abierto: el aviso, al momento.
    if (next.bossWait && next.bossWait !== before.bossWait) setBossWait(next.bossWait);
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
  // El salón, donde flota la bolsa de la caja.
  const salonId = game.building.rooms.find((r) => r.type === 'salon')?.id;

  /** Los de una expedición que vuelve: la cámara les sigue al entrar y, al llegar, ronda. */
  const welcome = (ids: string[]) => {
    if (!ids.length || settings.calm) return;
    setTimeout(() => {
      scene.current?.focus('patio');
      scene.current?.follow(ids[0]!);
    }, 300);
    setTimeout(() => {
      scene.current?.follow(null);
      scene.current?.cheer('barra', ids);
    }, 300 + BYE_MS);
  };

  // Fuera de Adornos se acaba la vista previa del jardín.
  useEffect(() => {
    if (panel !== 'casa') setGardenView(false);
  }, [panel]);

  // Lo que tapan los paneles y las fichas, para que la cámara encuadre lo que enfoca en lo que
  // queda libre (por encima de la hoja en vertical; a su lado en horizontal). Se mide al abrir,
  // cerrar o cambiar de alto cualquiera de ellos.
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => scene.current?.setCover(coverOf(stage)));
    };
    const ro = new ResizeObserver(measure);
    const watch = () => {
      ro.disconnect();
      ro.observe(stage);
      for (const el of stage.querySelectorAll<HTMLElement>(SHEETS)) ro.observe(el);
      measure();
    };
    const mo = new MutationObserver(watch);
    mo.observe(stage, { childList: true });
    watch();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
    };
  }, [screen]);

  /**
   * Ante el jefe: «Ver la pelea» la juega (el resultado sale de la pelea, con las órdenes del
   * jugador); «Que se las apañen» la resuelve ya, sola.
   */
  const facBoss = (id: string, watch: boolean) => {
    setBossWait(null);
    const s = gameRef.current;
    const m = s.missions.find((x) => x.id === id);
    const boss = m && bossOf(m.quest);
    if (watch && m && boss) {
      audio.play('horn');
      const party = s.heroes.filter((h) => m.heroIds.includes(h.id));
      setWatching({
        fight: {
          boss,
          place: m.quest.place,
          won: false,
          heroes: fightRoster(party),
          sim: { setup: missionCombat(s, m, boss), orders: [] },
        },
        dawn: false,
        play: id,
      });
      return;
    }
    dispatch({ type: 'boss', id });
  };

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
      // Las monedas vuelan de la caja al oro de arriba; cada una que llega, tintinea.
      const p = scene.current?.payPoint();
      const stage = document.querySelector('.stage');
      if (p && stage) {
        const r = stage.getBoundingClientRect();
        const n = Math.min(8, Math.max(3, Math.ceil((after.gold - gold) / 5)));
        flyCoins({ x: r.left + p.x, y: r.top + p.y }, n, () => audio.play('coin', 0.09));
      }
    }
  };
  /**
   * Tiempo que corre solo (en prueba): al volver tras `seconds` reales fuera, se simula lo que
   * ha pasado (`catchUp`) y, si han pasado días, la carta del amanecer lo cuenta.
   */
  const comeBack = (seconds: number) => {
    // Mientras dura el tutorial, el tiempo no corre ni con la taberna cerrada.
    if (!realTime || passing || tutorialOn(gameRef.current)) return;
    dispatch({ type: 'tick', to: clockRef.current });
    // A medio asalto en directo no se pone al día: la pelea se queda en pausa y sigue al volver
    // (si no, la noche pasaría dos veces).
    if (raidLiveRef.current) return;
    const away = catchUp(gameRef.current, seconds);
    if (!away.seconds) return;
    commit(away.state);
    clockRef.current = away.state.clock ?? 0;
    setClock(clockRef.current);
    scene.current?.setTime(clockRef.current / DAY_SECONDS);
    if (away.days.length) {
      // La carta del amanecer va encima de lo que hubiera abierto (no lo cierra).
      setAwayDays(away.days.length);
      setDawnOpen(true);
    } else
      toast(
        away.waiting
          ? tx(waitText(away.state, away.waiting))
          : t('pantallas.app.la_taberna_ha_seguido'),
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
  // Minutos jugados (con la partida a la vista) y envío a los desarrolladores cada 2.
  const shareRef = useRef(settings.share);
  shareRef.current = settings.share;
  useEffect(() => {
    if (screen !== 'game') return;
    if (shareRef.current) sendReport(gameRef.current);
    const id = setInterval(() => {
      if (document.hidden) return;
      const m = addMinute();
      if (shareRef.current && m % 2 === 0) sendReport(gameRef.current);
    }, 60_000);
    return () => clearInterval(id);
  }, [screen]);
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
    // Solo si no se ve: al hacer o pagar obras la cámara no se va de lo que se está mirando.
    focus: (id) => scene.current?.focus(id, true),
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
  // Con el menú de Héroes abierto, se resaltan todos en la taberna para verlos bien.
  const spotHeroes = panel === 'heroes';
  const model = useMemo(
    () => sceneModel(draft ?? sceneGame, spotHeroes),
    [sceneGame, draft, spotHeroes],
  );
  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    s.setTargets(
      works.active
        ? works.targets.map((t) => ({
            id: t.id,
            rect: t.rect,
            label:
              t.blocked || t.action.type === 'gardenLook'
                ? t.label
                : `${t.label} · ${Math.abs(t.cost)}`,
            blocked: !!t.blocked,
            info: !!t.info,
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
    // La primera vez que se abre el mapa con las expediciones abiertas, su tutorial corto.
    const g = gameRef.current;
    if (p === 'fuera' && g.expOpened && !g.tips?.includes('expediciones')) setExpIntro(true);
    setCard(null);
    setQuestId(null);
    setReportId(null);
    setBubble(null);
  };

  const onHotspot = (id: string, label?: string) => {
    setHint(false);
    if (id.startsWith('bicho:')) {
      // Un animal de la casa o un bicho de una sala rota: hace lo suyo en la escena y dice algo.
      const lines = PET_LINES[id.slice(6).split(':')[0] as keyof typeof PET_LINES];
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
      // Quien está fuera (la nota del tablón o su cama hecha): se lee lo que dice.
      if (act === 'fuera') {
        if (label) toast(label.replace(/\n/g, ' · '));
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
    const trophy = game.trophies.find((x) => x.id === id);
    dispatch({ type: 'sellTrophy', id });
    audio.play('coin');
    if (trophy)
      toast(
        t('pantallas.app.vendido_por_monedas_la', { nombre: tx(trophy.name), valor: trophy.value }),
      );
  };

  const hire = (id: string) => {
    const why = canHire(game, id);
    if (why) return toast(why);
    const c = game.candidates.find((x) => x.id === id)!;
    dispatch({ type: 'hire', id });
    audio.play('coin');
    toast(t('pantallas.app.se_une_al_gremio', { nombre: c.name }));
    setTimeout(() => scene.current?.focusHero(id), 60);
  };

  const fire = (id: string) => {
    const h = game.heroes.find((x) => x.id === id)!;
    dispatch({ type: 'fire', id });
    audio.play('close');
    setCard(null);
    toast(t('pantallas.app.recoge_sus_cosas_y', { nombre: h.name }));
  };

  /** Manda un grupo: la nota sale del tablón y los héroes cruzan la puerta. */
  const send = (qid: string, ids: string[], unguard = false) => {
    const q = game.quests.find((x) => x.id === qid);
    if (!q) return;
    const before = gameRef.current;
    const next = dispatch({ type: 'send', questId: qid, heroIds: ids, unguard });
    if (next === before) return;
    const days = next.missions.at(-1)?.daysLeft ?? q.days;
    const names = listNames(ids.map((id) => game.heroes.find((h) => h.id === id)?.name ?? ''));
    audio.play('depart');
    setQuestId(null);
    setPanel(null);
    scene.current?.focus('puerta');
    toast(
      t('pantallas.app.hacia_vuelta', {
        names,
        n: ids.length,
        lugar: placeMsg(q.place),
        dawn_in: dawnIn(days),
      }),
    );
  };

  /** Acaba la despedida (sola o al tocar para saltarla) y abre el visor de la expedición. */
  const endBye = (id: string | null) => {
    for (const x of byeTimers.current) clearTimeout(x);
    byeTimers.current = [];
    scene.current?.farewellEnd();
    setBye(null);
    if (id) setExpId(id);
  };

  /**
   * Sale una expedición (EX13): la cámara va a la puerta, los de casa les despiden, suena el
   * cuerno y la cámara les sigue por el patio; a los ~4 s (o al tocar) se abre su visor.
   */
  const sendExpedition = (
    heading: Heading,
    ids: string[],
    rations: number,
    unguard: boolean,
    potions = 0,
  ) => {
    const before = gameRef.current;
    const next = dispatch({
      type: 'expedition',
      heading,
      heroIds: ids,
      rations,
      unguard,
      potions,
    });
    if (next === before) return;
    audio.play('depart');
    setPanel(null);
    setExpId(null);
    const id = next.expeditions?.at(-1)?.id ?? null;
    const s = scene.current;
    if (!s || settings.calm) {
      setExpId(id);
      s?.focus('puerta');
      return;
    }
    s.farewell(
      next.heroes.filter((h) => h.status === 'ok').map((h) => h.id),
      ids[0],
    );
    setBye(id);
    byeTimers.current = [
      setTimeout(() => audio.play('horn', 0.7), 700),
      setTimeout(() => endBye(id), BYE_MS),
    ];
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
    if (w) toast(t('pantallas.app.se_queda_a_trabajar', { nombre: w.name }));
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
    if (to === 'equipo' || to === 'tesoros') {
      setHeroFilter('equipo');
      setArconTab(to);
    }
    openPanel(
      to === 'candidatos' || to === 'trabajadores' || to === 'equipo' || to === 'tesoros'
        ? 'heroes'
        : to,
    );
  };

  // Vender pregunta antes (nombre y precio); al confirmar, se vende.
  const [selling, setSelling] = useState<string | null>(null);
  const sell = (itemId: string) => {
    audio.play('open', 0.5);
    setSelling(itemId);
  };
  const sellNow = (itemId: string) => {
    const it = game.inventory.find((i) => i.id === itemId);
    setSelling(null);
    dispatch({ type: 'sell', itemId });
    audio.play('coin');
    if (it) toast(t('pantallas.app.vendido', { objeto: tx(it.name), oro: priceOf(it) }));
  };
  const sellIt = selling ? game.inventory.find((i) => i.id === selling) : undefined;

  // Escape y el botón «atrás» del móvil cierran lo que esté encima (ajustes, partidas,
  // informe, encargo, ficha, panel).
  const overlayOpen =
    !!watching ||
    !!bell ||
    settingsOpen ||
    saveMenu ||
    !!reportId ||
    !!questId ||
    !!card ||
    !!panel ||
    !!works.pick;
  const closeWatch = () => {
    if (watching?.dawn) setDawnChip(gameRef.current.day);
    setWatching(null);
  };
  const closeTop = () => {
    if (watching) closeWatch();
    else if (bell) setBell(null);
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

  /** Deja la pantalla libre: solo para lo que de verdad debe cortar (asalto, cobro, fin de partida). */
  const clearScreen = () => {
    setPanel(null);
    setCard(null);
    setQuestId(null);
    setReportId(null);
    setTripId(null);
    setExpId(null);
    setBell(null);
  };

  /** Cae la noche (o, en el tutorial, se salta el tiempo hasta lo siguiente que pase). */
  const endDay = (skip?: TutorialSkip) => {
    if (passing) return;
    if (!skip) {
      dispatch({ type: 'tick', to: clockRef.current });
      if (!canClose(gameRef.current)) return;
    }
    setHint(false);
    setBubble(null);
    const before = gameRef.current;
    // Asalto esta noche con la escena a la vista: se juega en directo y, al acabar, amanece.
    // El núcleo lo resuelve en el `endDay` que deja `day` en `raid.day`, o sea, la noche de antes.
    const due = before.raid && before.raid.day <= before.day + 1;
    const live = !skip && due && scene.current && !before.over;
    // La noche normal cae con lo abierto delante (la escena oscurece detrás); solo el asalto
    // (hay que verlo) y los saltos del tutorial (los pide el jugador) dejan la pantalla libre.
    if (skip || live) clearScreen();
    if (live) {
      const rng = new Rng(raidSeed(before));
      const fight = new Assault(assaultSetup(before, before.raid!.strength, rng), rng);
      setPassing(true);
      setRaiding(true);
      setRaidLive(true);
      raidLiveRef.current = true;
      audio.play('horn');
      scene.current!.raidNight(
        { plan: fight.plan() },
        () => {
          setRaidLive(false);
          raidLiveRef.current = false;
          dispatch({ type: 'raidFought', result: fight.result ?? fight.run() });
          const next = dispatch({ type: 'endDay' });
          dawnAfter(before, next, skip)();
        },
        fight,
      );
      return;
    }
    const next = dispatch(skip ? { type: 'tutorial', op: skip } : { type: 'endDay' });
    if (next === before) return;
    // Asalto que se repite (sin directo) o fin de partida: eso sí corta.
    if (next.lastRaid || next.over) clearScreen();
    const sunrise = dawnAfter(before, next, skip);
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

  /** Lo que pasa al amanecer, tras la noche (con su asalto o sin él). */
  const dawnAfter = (before: GameState, next: GameState, skip?: TutorialSkip) => {
    const party = next.lastRaid?.won || (next.mode === 'libre' && before.mode !== 'libre');
    const sunrise = () => {
      setPassing(false);
      setRaiding(false);
      audio.play('dawn');
      // Si esta noche un grupo ha dado con un jefe, primero el aviso (verlo o no).
      const open = () => {
        if (next.lastFight) setBossCall(next.lastFight);
        // En el tutorial (saltos de días) o al acabar, la carta entera; jugando, sin tapar nada.
        else if (skip || next.over) setDawnOpen(true);
        else quietDawn(next);
      };
      // El día de pago, antes de todo, el cobro.
      const payday = next.payday?.day === next.day && !next.over;
      const show = () => {
        // Si se ha tenido algo abierto hasta el día siguiente, eso ya pasó (queda en el correo).
        if (gameRef.current.day !== next.day) return;
        if (payday) {
          payThen.current = open;
          setPaying(true);
        } else open();
      };
      // El cobro (cada 7 días, un momento importante) corta como el asalto: deja la pantalla libre
      // y sale ya. El aviso del jefe tapa la pantalla: espera a que se cierre lo abierto.
      if (payday) {
        clearScreen();
        show();
      } else if (next.lastFight && !next.over) whenFree(show);
      else show();
      // Asalto repelido o deuda saldada: suena el brindis.
      if (party) setTimeout(() => audio.fanfare(), 60);
    };
    return sunrise;
  };

  /**
   * Amanece con el juego abierto: lo de la escena pasa ya (lo que hicieron las salas, la ronda
   * de los que vuelven) y el parte queda en un botón, sin tapar la pantalla.
   */
  const quietDawn = (next: GameState) => {
    setDawnChip(next.day);
    const made = next.yields;
    if (made?.length) setTimeout(() => scene.current?.yields(made), 400);
    const wins = next.reports.filter(
      (r) => r.day === next.day && r.outcome.startsWith('Éxito') && r.outcome !== 'Éxito parcial',
    );
    if (wins.length)
      setTimeout(() => {
        scene.current?.cheer(
          'barra',
          wins.flatMap((r) => r.heroIds),
        );
        toast(t('pantallas.app.ronda_para_todos_lo', { quienes: wins.map((r) => tx(r.who)) }));
      }, 1200);
  };

  const closeDawn = (then?: PanelId) => {
    if (fromChip.current) {
      // Abierta desde el botón: lo de la escena ya pasó al amanecer.
      fromChip.current = false;
      setDawnOpen(false);
      if (then) openPanel(then);
      return;
    }
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
        toast(t('pantallas.app.ronda_para_todos_lo', { quienes: wins.map((r) => tx(r.who)) }));
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
    toast(t('pantallas.app.partida_cargada_dia_monedas', { dia: s.day, oro: s.gold }));
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
  const openTrip = game.missions.find((m) => m.id === tripId) ?? null;
  const openExp = game.expeditions?.find((x) => x.id === expId) ?? null;
  const waitMission = bossWait
    ? (game.missions.find((m) => m.id === bossWait && m.waiting) ?? null)
    : null;
  const report = game.reports.find((r) => r.id === reportId) ?? null;
  const callReport = bossCall ? game.reports.find((r) => r.id === bossCall) : undefined;
  const unread = game.reports.filter((r) => !r.read).length;
  const away = game.missions.length + game.heroes.filter((h) => h.status === 'desaparecido').length;
  // El jugador está con algo suyo abierto: lo que llega solo espera (ver `whenFree`).
  const busy =
    !!panel ||
    !!card ||
    !!questId ||
    !!reportId ||
    !!tripId ||
    !!bell ||
    strangerOpen ||
    messengerOpen ||
    settingsOpen ||
    saveMenu ||
    !!watching;
  busyRef.current = busy;
  // La mochila de la expedición que ha vuelto: cuando no haya nada abierto, tras verles entrar.
  useEffect(() => {
    if (!bagQueue.length || busy || bye || expIntro || expId || dawnOpen) return;
    const id = setTimeout(() => {
      const [first, ...rest] = bagQueue;
      setBagQueue(rest);
      if (first && gameRef.current.reports.some((r) => r.id === first && !r.read))
        openReport(first);
    }, BYE_MS);
    return () => clearTimeout(id);
  }, [bagQueue, busy, bye, expIntro, expId, dawnOpen]);
  useEffect(() => {
    if (!busy) held.free();
  }, [busy]);
  const calm =
    screen === 'game' &&
    !dawnOpen &&
    !paying &&
    !passing &&
    !(game.opening && !game.opening.seen) &&
    // El tutorial de obras se lee dentro del modo obras.
    (obrasOn(game) || (!works.pick && !works.planning));
  // El suceso del amanecer también espera a que se cierre lo abierto (no lo tapa).
  const eventHeld = !!game.event && busy;
  const pendingEvent = calm && !game.over && !busy ? (game.event ?? null) : null;
  // El tutorial guiado va antes que las notas sueltas del tío (y las sustituye mientras dura).
  // La lección sigue a la vista con paneles abiertos: señala lo que hay que tocar dentro.
  // En el respiro de antes de un paso no hay nota ni foco: se mira y se trastea a gusto.
  // Poner nombre a la taberna (al pagar la deuda) va antes que el tutorial de obras: mientras
  // está a la vista no hay nota ni cuenta atrás, y tras ponerlo hay un respiro más largo.
  const naming =
    calm && !game.over && !!game.askName && isDefaultName(customOf(game).name) && !eventHeld;
  const askedName = useRef(false);
  if (naming) askedName.current = true;
  const breath = tutorialWait(game);
  const wait =
    calm && !pendingEvent && !introHold && !naming
      ? breath && askedName.current && obrasOn(game)
        ? Math.max(breath, NAME_BREATH)
        : breath
      : 0;
  useEffect(() => {
    if (!wait) return;
    const t = setTimeout(() => dispatch({ type: 'tutorial', op: 'listo' }), wait * 1000);
    return () => clearTimeout(t);
  }, [wait, game.tutorial?.step]);
  const lesson =
    calm && !pendingEvent && !introHold && !naming && !game.tutorial?.wait
      ? tutorialStep(game)
      : null;
  const lessonFocus = lesson
    ? tutorialFocus(game, panel, {
        planning: works.planning,
        view: works.view,
        selected: works.selected,
        moving: works.pick?.kind === 'move' ? works.pick.id : null,
        targets: works.targets,
      })
    : null;
  /** Altura de lo que señala el tutorial: la nota se pone en la otra mitad. */
  const [spotY, setSpotY] = useState<number | null>(null);
  /** Lo que tapa lo que señala el tutorial hay que cerrarlo antes (la nota lo dice). */
  const [spotClose, setSpotClose] = useState(false);
  const tip = calm && !game.event && !busy && !tutorialOn(game) ? nextTip(game) : null;
  // La nota del tío mira hacia lo que explica.
  useEffect(() => {
    if (tip?.focus) scene.current?.focus(tip.focus);
  }, [tip?.id]);
  useEffect(() => {
    const at = lesson?.focus?.(gameRef.current);
    if (at && lesson?.zoom) scene.current?.closeUp(at);
    else if (at) scene.current?.focus(at);
  }, [lesson?.id]);
  // Tutorial de obras: la casilla que hay que tocar (el solar, el «+»…), a la vista.
  const lessonSpot = lessonFocus?.targets.find((x) => x.startsWith('obra:'));
  useEffect(() => {
    if (lessonSpot) scene.current?.showTarget(lessonSpot);
  }, [lesson?.id, lessonSpot]);

  // El reloj del día: corre con el juego abierto, también con un panel delante, y se para en
  // los momentos que piden atención (evento, nota, asalto, amanecer…) y con la pestaña oculta.
  // «Pasar la noche»: de noche, el reloj corre a x16 hasta el amanecer (se apaga con el día nuevo).
  const [nightRush, setNightRush] = useState(false);
  useEffect(() => setNightRush(false), [game.day]);
  // El forastero de la tormenta: al llegar se para «Pasar la noche» (su oferta es una decisión
  // del jugador) y la cámara va al salón; si no se le contesta, la oferta sigue en la campanita
  // hasta que se va, al día siguiente a mediodía.
  const knocking = !!game.messenger && !game.messenger.gone;
  useEffect(() => {
    if (!knocking) setMessengerOpen(false);
  }, [knocking]);
  const strangerKey = game.stranger ? game.stranger.day : null;
  const strangerWas = useRef(strangerKey);
  useEffect(() => {
    if (strangerKey !== null && strangerKey !== strangerWas.current) {
      setNightRush(false);
      const salon = game.building.rooms.find((r) => r.type === 'salon');
      if (salon) scene.current?.focus(salon.id);
    }
    if (strangerKey === null) setStrangerOpen(false);
    strangerWas.current = strangerKey;
  }, [strangerKey]);
  const isNight = clock >= WORK_END * DAY_SECONDS;
  // Con el tiempo que corre solo, acelerar el día solo se puede mientras dura «La deuda» (y en el
  // modo prueba): luego el reloj es el de verdad. La noche se puede pasar siempre.
  const clockPace = nightRush && isNight ? NIGHT_RUSH : realTime && !canRush ? 1 : clockSpeed;
  const paceRef = useRef(clockPace);
  paceRef.current = clockPace;
  const ticking =
    calm &&
    !game.over &&
    !pendingEvent &&
    !tip &&
    !tutorialFrozen(game) &&
    !works.planning &&
    !works.pick &&
    !watching &&
    !bossCall &&
    !settingsOpen &&
    !saveMenu;
  useEffect(() => {
    clockRef.current = game.clock ?? 0;
    setClock(clockRef.current);
    scene.current?.setTime(clockRef.current / DAY_SECONDS);
  }, [game.day, game.seed]);
  // La escena va al ritmo del reloj: a x2, x4 u x8 la gente también anda (y trabaja) más deprisa
  // (y a x½, más despacio).
  const pace = ticking ? clockPace : 1;
  useEffect(() => {
    if (scene.current) scene.current.pace = pace;
  }, [pace]);
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      const before = clockRef.current;
      const next = Math.min(DAY_SECONDS, before + 0.25 * paceRef.current);
      if (next === before) return;
      moveClock(next, before);
    }, 250);
    return () => clearInterval(id);
  }, [ticking]);
  // Tiempo que corre solo: al acabar el día la noche cae sola, aunque haya un panel o una ficha
  // abiertos (siguen abiertos, salvo si hay asalto); solo el modo obras la hace esperar.
  useEffect(() => {
    if (!realTime || !ticking || passing || clock < DAY_SECONDS) return;
    if (works.planning) return;
    endDay();
  }, [clock, ticking, passing, works.planning, realTime]);
  // Lo que se abre desde una pestaña (el libro y los adornos, del gremio; el historial, de donde
  // se llegó) la deja encendida. Con todo cerrado, ninguna: se ve la taberna.
  const tab: TabId | null =
    panel === 'tablon' || panel === 'heroes' || panel === 'gremio'
      ? panel
      : panel === 'fuera'
        ? 'mapa'
        : panel === 'libro' || panel === 'casa'
          ? 'gremio'
          : panel === 'historial'
            ? histFrom === 'libro'
              ? 'gremio'
              : 'tablon'
            : null;
  const openHistory = (from: 'tablon' | 'libro') => {
    setHistFrom(from);
    openPanel('historial');
  };

  const shown = passing ? sceneGame : game;
  const allAlerts = useMemo(() => gatherAlerts(shown, worksDone), [shown, worksDone]);
  // Los descartados, por partida. Se olvidan cuando el aviso deja de estar.
  const [hushed, setHushed] = useState<Hushed>(() => loadHushed(game.seed));
  useEffect(() => setHushed(loadHushed(game.seed)), [game.seed]);
  useEffect(() => {
    if (passing) return;
    const next = pruneHushed(hushed, allAlerts);
    if (next !== hushed) setHushed(next);
  }, [allAlerts]);
  useEffect(() => saveHushed(game.seed, hushed), [hushed]);
  const alerts = useMemo(
    () => shownAlerts(allAlerts, hushed, shown.day),
    [allAlerts, hushed, shown.day],
  );
  const hush = (ids: string[]) =>
    setHushed((h) => ({ ...h, ...Object.fromEntries(ids.map((id) => [id, shown.day])) }));
  /** Tocar un aviso lleva a donde se arregla. */
  const goAlert = (n: Notice) => {
    const g = n.go;
    if ('room' in g) {
      setRoomId(g.room);
      openPanel('sala');
      scene.current?.focus(g.room);
      setWorksDone((d) => d.filter((id) => id !== g.room));
    } else if ('barra' in g) {
      openPanel('heroes');
      setHeroFilter('candidatos');
    } else if ('crew' in g) {
      openPanel('heroes');
      setHeroFilter('trabajadores');
      setCrewFocus(g.crew);
    } else if ('trip' in g) {
      audio.play('open');
      setTripId(g.trip);
    } else if ('quest' in g) {
      openPanel('tablon');
      setQuestId(g.quest);
    } else if ('stranger' in g) {
      audio.play('open');
      setStrangerOpen(true);
    } else if ('build' in g) {
      openPanel(null);
      works.startPlan();
      works.startPick({ kind: 'build', type: g.build });
    } else openPanel(g.panel);
  };

  return (
    <div class="game">
      <Hud
        game={passing ? sceneGame : game}
        onSettings={() => setSettingsOpen(true)}
        onSaves={() => setSaveMenu(true)}
        onTitle={toTitle}
        reports={game.reports}
        onReport={openReport}
        onReadAll={() => {
          audio.play('select');
          dispatch({ type: 'readAll' });
        }}
        onHistory={() => openHistory('tablon')}
        bell={bell}
        onBell={setBell}
        alerts={alerts}
        onAlert={goAlert}
        onHush={hush}
        hushedCount={allAlerts.length - alerts.length}
        onUnhush={() => setHushed({})}
        quiet={passing || paying || dawnOpen || !!bossCall || !!watching || screen !== 'game'}
      />
      <div class="stage" ref={stageRef}>
        <SceneView
          model={model}
          onReady={(s) => {
            scene.current = s;
            s.setTime(clockRef.current / DAY_SECONDS);
            s.speed = settings.speed;
            s.pace = pace;
            s.fewLights = settings.fewLights;
            s.moodLight = settings.moodLight;
            s.weatherMode = settings.weather;
            s.calm = settings.calm;
            s.forceWeather = forcedWeather;
          }}
          onHotspot={onHotspot}
          onHero={(id, at) => {
            setHint(false);
            setBubble(null);
            // El forastero de la tormenta: su oferta.
            if (id === STRANGER_ID) {
              audio.play('open', 0.6);
              setStrangerOpen(true);
              return;
            }
            if (id === MESSENGER_ID) {
              if (knocking) {
                audio.play('open', 0.6);
                setMessengerOpen(true);
              }
              return;
            }
            // El de la pesadilla: se le lleva un trago de la bodega (si queda).
            const nm = gameRef.current.nightmare;
            if (nm && nm.hero === id && !nm.eased && nightmareNow(gameRef.current)) {
              const why = easeIssue(gameRef.current);
              if (why) {
                audio.play('click', 0.5);
                say(why, at);
                return;
              }
              audio.play('splash', 0.5);
              dispatch({ type: 'nightmare' });
              return;
            }
            // Los visitantes cuentan lo que se oye por ahí.
            if (id.startsWith('vis-')) {
              const i = Number(id.split('-')[2]);
              const kind = model.visitors?.kinds[i] ?? 'campesino';
              audio.play('click', 0.5);
              say(
                kind === 'espia'
                  ? t('pantallas.app.forastero_callado_y_la')
                  : t('pantallas.app.visitante_dice', {
                      quien: VISITORS[kind as VisitorKind].name,
                      rumor: RUMORS[(game.day * 7 + i) % RUMORS.length],
                    }),
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
            setDragTip({
              text: d?.text ?? t('pantallas.app.sueltalo_en_una_sala'),
              ok: !!d?.ok,
              at,
            });
            lastDrop.current = d;
            return d;
          }}
          onArrive={(id, room) => {
            // Solo importa si algo espera a que llegue: vestirle, su tarea nueva o un incidente.
            const g = gameRef.current;
            const waits =
              g.crafts?.some((c) => c.wait && c.dress?.hero === id) ||
              g.paints?.some((p) => p.wait && p.painter === id && p.room === room) ||
              [...g.heroes, ...g.workers].some((x) => x.id === id && x.walk !== undefined) ||
              g.incidents?.some((i) => i.coming?.who === id);
            if (waits) dispatch({ type: 'arrived', heroId: id, room });
          }}
          onRoomDrag={(id) => works.startPick({ kind: 'move', id })}
          onRoomDrop={() => {
            works.cancelPick();
            toast(t('pantallas.app.ahi_no_cabe_sueltala'));
          }}
          onDrop={(id, room) => {
            setDragTip(null);
            const d = room ? planDrop(gameRef.current, id, room) : null;
            // En el tutorial, lo que no se deja hacer se explica también al soltar (la escena
            // suelta sin sala lo que no vale: se mira lo último que se dijo al arrastrar).
            const last = lastDrop.current;
            lastDrop.current = null;
            if (!d?.ok) {
              if (last && !last.ok && tutorialOn(gameRef.current)) toast(last.text);
              return;
            }
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
          !paying &&
          (game.incidents ?? []).map((inc) => (
            <IncidentHelpers key={`h-${inc.id}`} game={game} inc={inc} scene={scene} />
          ))}
        {!passing &&
          !dawnOpen &&
          !paying &&
          (game.incidents ?? []).map((inc) => (
            <IncidentMark
              key={inc.id}
              game={game}
              inc={inc}
              clock={clock}
              speed={clockPace}
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
        {!passing &&
          !dawnOpen &&
          !paying &&
          (model.crafts ?? []).map((c, i, all) => {
            const slot = all.slice(0, i).filter((x) => x.room === c.room).length;
            const aside = (game.incidents ?? []).some((x) => x.room === c.room);
            if (!c.ready)
              return <CraftMark key={c.id} craft={c} slot={slot} scene={scene} aside={aside} />;
            const type = game.building.rooms.find((r) => r.id === c.room)?.type;
            return (
              <CollectMark
                key={c.id}
                room={c.room}
                scene={scene}
                slot={slot}
                aside={aside}
                label={t('recoger.taller', {
                  taller: t(type ? `recetas.taller.${type}` : 'talleres.el_taller'),
                })}
                onTake={(el) => {
                  haptic('select');
                  collectFx(el, '[data-tut="tab-heroes"]', 'objeto');
                  dispatch({ type: 'collect', what: 'taller', id: c.id });
                }}
              >
                <BufferImage buf={c.potion ? potionIcon() : itemIcon(c.icon, c.rarity)} scale={2} />
              </CollectMark>
            );
          })}
        {!passing && !dawnOpen && !paying && tillShows(game) && salonId && (
          <CollectMark
            room={salonId}
            scene={scene}
            count={`+${tillReady(game)}`}
            label={t('recoger.caja', { n: tillReady(game) })}
            onTake={(el) => {
              const n = tillReady(gameRef.current);
              haptic('select');
              collectFx(el, '[data-gold]', 'oro', n, `+${n}`);
              dispatch({ type: 'collect', what: 'caja' });
              toast(t('recoger.caja_hecho', { n }));
            }}
          >
            <Icon name="coin" size={24} />
          </CollectMark>
        )}
        {!passing &&
          !dawnOpen &&
          !paying &&
          queuesShowing(game).map((y) => (
            <CollectMark
              key={`y-${y.room}`}
              room={y.room}
              scene={scene}
              count={y.full ? '!' : `+${y.n}`}
              full={y.full}
              label={t('recoger.sala', { que: y.kind, n: y.n })}
              onTake={(el) => {
                if (y.full) {
                  audio.play('thud', 0.5);
                  toast(t('recoger.lleno', { que: y.kind }));
                  return;
                }
                haptic('select');
                collectFx(
                  el,
                  y.kind === 'food' ? '[data-food]' : '[data-beer]',
                  y.kind === 'food' ? 'pan' : 'jarra',
                  y.n,
                  `+${y.n}`,
                );
                dispatch({ type: 'collect', what: 'sala', id: y.room });
                toast(t('recoger.sala_hecho', { que: y.kind, n: y.n }));
              }}
            >
              <Icon name={y.kind === 'food' ? 'pan' : 'jarra'} size={24} />
            </CollectMark>
          ))}
        {!passing && !dawnOpen && knocking && messengerRoom(game) && (
          <MessengerMark
            messenger={game.messenger!}
            room={messengerRoom(game)!}
            clock={clock}
            speed={clockPace}
            scene={scene}
            onOpen={() => {
              audio.play('open', 0.6);
              setMessengerOpen(true);
            }}
          />
        )}
        {!passing && !dawnOpen && game.rumor && rumorRoom(game) && (
          <RumorMark
            key={game.rumor.id}
            rumor={game.rumor}
            room={rumorRoom(game)!}
            clock={clock}
            speed={clockPace}
            scene={scene}
            onTake={() => {
              audio.play('coin', 0.6);
              dispatch({ type: 'rumor' });
            }}
          />
        )}
        {/* La nota del tío ya explica lo mismo: el cartel solo sale sin ella. */}
        {hint && !notice && !tip && (
          <div class="hint-toast" role="status">
            {t('pantallas.app.arrastra_para_mirar_toca')}
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
            aria-label={t('pantallas.app.alejar')}
            onClick={() => scene.current?.zoomBy(-1)}
          >
            <Icon name="minus" size={16} />
          </button>
          <button
            class="btn-icon tool-zoom"
            aria-label={t('pantallas.app.acercar')}
            onClick={() => scene.current?.zoomBy(1)}
          >
            <Icon name="plus" size={16} />
          </button>
          <button
            class="btn-icon"
            aria-label={t('pantallas.app.volver_a_la_sala')}
            data-help={t('pantallas.app.vuelve_a_la_sala')}
            onClick={() => scene.current?.home()}
          >
            <Icon name="home" size={16} />
          </button>
          {roomsLive && (
            <button
              class={`btn-icon ${works.planning ? 'is-on' : ''}`}
              aria-label={t('pantallas.app.modo_obras')}
              data-tut="martillo"
              data-help={t('pantallas.app.modo_obras_marca_los')}
              onClick={() => {
                if (works.planning && works.steps.length)
                  toast(t('pantallas.app.tienes_obras_apuntadas_pagalas'));
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
            part={clock / DAY_SECONDS}
            real={realTime}
            rush={canRush}
            canClose={clock >= DUSK * DAY_SECONDS}
            night={passing}
            pace={clockSpeed}
            rushing={nightRush}
            onRushNight={() => {
              audio.play('select', 0.5);
              setNightRush(!nightRush);
            }}
            onPace={() => {
              // Con «Pasar la noche» puesto el reloj va a su ritmo: tocar el reloj lo quita, para
              // que la velocidad elegida se note.
              if (nightRush && isNight) setNightRush(false);
              setSettings({ ...settings, pace: nextPace(clockSpeed, paceMax(settings.tester)) });
            }}
            onDusk={() =>
              moveClock(Math.max(clockRef.current, DUSK * DAY_SECONDS), clockRef.current)
            }
            onEndDay={() => endDay()}
          />
        )}
        {panel === 'tablon' && (
          <Panel
            title={t('pantallas.app.tablon_de_encargos')}
            onClose={() => openPanel(null)}
            variant="cork"
          >
            <HistoryButton game={game} onClick={() => openHistory('tablon')} />
            <TablonPanel
              game={game}
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
          <Panel title={t('pantallas.app.heroes_y_personal')} onClose={() => openPanel(null)}>
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
                if (w) toast(t('pantallas.app.recoge_sus_cosas_y_2', { nombre: w.name }));
              }}
              onTask={setTask}
              equipo={
                <ArconPanel
                  game={game}
                  tab={arconTab}
                  onTab={setArconTab}
                  onEquip={(heroId, itemId) => {
                    const h = game.heroes.find((x) => x.id === heroId);
                    const it = game.inventory.find((x) => x.id === itemId);
                    dispatch({ type: 'equip', heroId, itemId });
                    audio.play('select');
                    if (h && it)
                      toast(t('pantallas.app.se_equipa', { nombre: h.name, nombre2: tx(it.name) }));
                  }}
                  onUnequip={(heroId, slot) => {
                    dispatch({ type: 'unequip', heroId, slot });
                    audio.play('deselect');
                  }}
                  onSell={sell}
                  onSellTrophy={sellTrophy}
                  onHero={(id) => {
                    audio.play('open');
                    setCard(id);
                  }}
                />
              }
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
                works.planning || !settings.tester
                  ? undefined
                  : (id, tint) => dispatch({ type: 'tint', id, tint })
              }
              onAct={works.planning ? undefined : dispatch}
              onPreview={works.planning ? undefined : (id, t) => scene.current?.previewTint(id, t)}
              onDecor={
                works.planning
                  ? undefined
                  : (id, on) => {
                      dispatch({ type: 'decor', id, on });
                      audio.play(on ? 'build' : 'close');
                      if (on) toast(t('pantallas.app.ya_luce_en_el', { nombre: DECOR[id].name }));
                    }
              }
              onFeast={() => {
                dispatch({ type: 'feast' });
                audio.fanfare();
                toast(t('pantallas.app.fiesta_montada_banderines_musica'));
              }}
            />
          </Panel>
        )}
        {panel === 'gremio' && (
          <Panel title={t('pantallas.app.el_gremio')} onClose={() => openPanel(null)}>
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
              onLibro={() => openPanel('libro')}
              onTaberna={() => openPanel('casa')}
            />
          </Panel>
        )}
        {panel === 'casa' && (
          <Panel
            title={t('pantallas.app.adornos')}
            low={gardenView}
            onClose={() => openPanel(null)}
          >
            <TabernaPanel
              game={game}
              has={has}
              onCustom={(patch) => {
                dispatch({ type: 'custom', patch });
                audio.play('click');
              }}
              onDog={() => {
                dispatch({ type: 'buyDog' });
                audio.play('coin');
                toast(t('pantallas.app.tizon_ya_duerme_junto'));
              }}
              onLook={(patch) => dispatch({ type: 'facadeLook', patch })}
              onGarden={(patch) => dispatch({ type: 'gardenLook', patch })}
              onGardenWorks={() => {
                openPanel(null);
                works.startPlan();
                works.startPick({ kind: 'garden', piece: 'fuente' });
              }}
              onGardenView={(on) => {
                setGardenView(on);
                // El panel baja: el jardín, en lo que queda libre por encima (ver `setCover`).
                if (on) scene.current?.focus('jardin');
              }}
              onFacade={(id) => {
                dispatch({ type: 'facade', id });
                audio.play('build');
                toast(t('pantallas.app.ya_se_ven_desde', { nombre: FACADE[id].name }));
              }}
              onRaven={() => {
                dispatch({ type: 'buyRaven' });
                audio.play('coin');
                toast(t('pantallas.app.carbon_se_posa_en'));
              }}
            />
          </Panel>
        )}
        {panel === 'libro' && (
          <Panel title={t('pantallas.app.libro_de_hazanas')} onClose={() => openPanel(null)}>
            <LibroPanel game={game} records={records} onHistory={() => openHistory('libro')} />
          </Panel>
        )}
        {panel === 'historial' && (
          <Panel title={t('pantallas.app.historial_de_encargos')} onClose={() => openPanel(null)}>
            <button class="back" onClick={() => openPanel(histFrom)}>
              ← {histFrom === 'libro' ? t('pantallas.app.libro') : t('pantallas.app.tablon')}
            </button>
            <HistoryPanel
              game={game}
              onTrip={(id) => {
                audio.play('open');
                setTripId(id);
              }}
              onReport={openReport}
            />
          </Panel>
        )}
        {panel === 'fuera' && (
          <Panel title={t('pantallas.app.la_comarca')} full onClose={() => openPanel(null)}>
            <MapPanel
              game={game}
              onHero={(id) => setCard(id)}
              onTrip={(id) => {
                audio.play('open');
                setTripId(id);
              }}
              onExpedition={(id) => {
                audio.play('open');
                setExpId(id ?? 'nueva');
              }}
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
            onSend={(ids, unguard) => send(openQuest.id, ids, unguard)}
          />
        )}
        {expIntro && (
          <ExpIntro
            onDone={(toMap) => {
              setExpIntro(false);
              dispatch({ type: 'tip', id: 'expediciones' });
              if (toMap && panel !== 'fuera') openPanel('fuera');
            }}
          />
        )}
        {bye && (
          <button class="exp-bye" onClick={() => endBye(bye)}>
            <span>{t('expediciones.salida.saltar')}</span>
          </button>
        )}
        {expId === 'nueva' && (
          <ExpeditionSheet
            game={game}
            onClose={() => setExpId(null)}
            onSend={sendExpedition}
            onDrink={(heroId) => {
              audio.play('glint');
              dispatch({ type: 'drink', heroId });
            }}
          />
        )}
        {openExp && (
          <ExpeditionView
            key={openExp.id}
            game={game}
            exp={openExp}
            onClose={() => setExpId(null)}
            onHero={(id) => setCard(id)}
            onBack={() => {
              audio.play('select');
              dispatch({ type: 'expBack', id: openExp.id });
            }}
            onChoose={(option) => {
              audio.play('select');
              const before = gameRef.current;
              const next = dispatch({ type: 'expChoose', id: openExp.id, option });
              // Si eligen pelear, la pelea se ve ya (la última del diario, si es de ahora).
              const e = next.expeditions?.find((x) => x.id === openExp.id);
              const last = e?.log.at(-1)?.fight ?? e?.log.at(-2)?.fight;
              const fresh = next !== before && last && e && e.log.at(-1)!.h === e.hours;
              // «Que peleen solos»: sin abrirla (queda en el diario con «Ver la pelea»).
              if (fresh && last && option !== 'solos') setWatching({ fight: last, dawn: false });
            }}
            onMute={(on) => dispatch({ type: 'expMute', id: openExp.id, on })}
            onDrink={(heroId) => {
              audio.play('glint');
              dispatch({ type: 'drink', heroId, expId: openExp.id });
            }}
            onWatch={(fight) => {
              audio.play('open');
              setWatching({ fight, dawn: false });
            }}
          />
        )}
        {openTrip && (
          <TripSheet
            key={openTrip.id}
            game={game}
            mission={openTrip}
            onClose={() => setTripId(null)}
            onHero={(id) => setCard(id)}
            onReport={(id) => {
              setTripId(null);
              setReportId(id);
            }}
            onBoss={(watch) => {
              setTripId(null);
              facBoss(openTrip.id, watch);
            }}
          />
        )}
        {report && (
          <Letter
            report={report}
            heroes={game.heroes}
            seal={customOf(game)}
            onClose={() => {
              setReportId(null);
              if (report.vet && !gameRef.current.tips?.includes('expediciones')) setExpIntro(true);
            }}
            onWatch={
              report.fight ? () => setWatching({ fight: report.fight!, dawn: false }) : undefined
            }
            onWatchFight={(fight) => {
              audio.play('open');
              setWatching({ fight, dawn: false });
            }}
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
            onReject={() => {
              audio.play('close');
              dispatch({ type: 'reject', id: cardHero.id });
              setCard(null);
            }}
            onFire={() => fire(cardHero.id)}
            onAnswer={(yes) => dispatch({ type: 'answer', id: cardHero.id, yes })}
            onPayOwed={() => dispatch({ type: 'payOwed', id: cardHero.id })}
            onTask={works.planning ? undefined : (task) => setTask(cardHero.id, task)}
            onRename={(name) => dispatch({ type: 'renameHero', id: cardHero.id, name })}
            onDressAt={(room, dress) => {
              dispatch({ type: 'dressAt', room, heroId: cardHero.id, dress });
              audio.play('select');
            }}
            onDress={
              settings.tester
                ? (dress) => dispatch({ type: 'dress', heroId: cardHero.id, dress })
                : undefined
            }
            onFollow={(on) => scene.current?.follow(on ? cardHero.id : null)}
            onEquip={(itemId) => {
              dispatch({ type: 'equip', heroId: cardHero.id, itemId });
              audio.play('select');
            }}
            onUnequip={(slot) => {
              dispatch({ type: 'unequip', heroId: cardHero.id, slot });
              audio.play('deselect');
            }}
            onLocate={() => {
              setCard(null);
              setPanel(null);
              if (!scene.current?.focusHero(cardHero.id))
                say(
                  cardHero.status === 'mision'
                    ? t('pantallas.app.esta_de_mision_vuelve', {
                        nombre: cardHero.name,
                        dawn_in: dawnIn(cardHero.days),
                      })
                    : t('pantallas.app.no_esta_en_la', { nombre: cardHero.name }),
                  { x: 160, y: 120 },
                );
            }}
          />
        )}
        {paying && screen === 'game' && game.payday && (
          <PayDay
            game={game}
            onClose={() => {
              setPaying(false);
              audio.play('close');
              payThen.current?.();
              payThen.current = null;
            }}
          />
        )}
        {dawnOpen && screen === 'game' && game.tutorial && !game.tutorial.letter && (
          <IntroLetter
            onOpen={() => {
              audio.play('open');
              dispatch({ type: 'tutorial', op: 'carta' });
              closeDawn();
              // Entrada: de fuera, a la izquierda, hasta el salón; luego el cuaderno.
              const salon = game.building.rooms.find((r) => r.type === 'salon');
              if (salon) scene.current?.travelIn(salon.id);
              setIntroHold(true);
              setTimeout(() => setIntroHold(false), 3500);
            }}
          />
        )}
        {dawnOpen && screen === 'game' && !(game.tutorial && !game.tutorial.letter) && (
          <Dawn
            day={game.day}
            away={awayDays || undefined}
            name={customOf(game).name}
            flavor={tx(game.flavor)}
            events={game.dawn}
            unread={unread}
            all={settings.dawnAll || settings.calm}
            onAlways={() => {
              setSettings((s) => ({ ...s, dawnAll: true }));
              toast(t('pantallas.app.hecho_la_carta_del'));
            }}
            onClose={() => closeDawn()}
            onMail={() => {
              closeDawn();
              setBell('informes');
            }}
          />
        )}
        {/* Con algo abierto, el botón del parte espera (no tapa el panel). */}
        {screen === 'game' && dawnChip === game.day && !dawnOpen && !passing && !busy && (
          <button
            class={`dawn-chip ${game.dawn.some((e) => e.k === 'bad') ? 'is-bad' : ''}`}
            aria-label={t('pantallas.app.amanece_el_dia_ver', { dia: game.day })}
            onClick={() => {
              audio.play('open');
              fromChip.current = true;
              setDawnChip(null);
              setDawnOpen(true);
            }}
          >
            <Icon name="letter" size={14} />
            <span>
              {t('pantallas.app.dia', { dia: game.day })} <b>{t('pantallas.app.ver_el_parte')}</b>
              {game.dawn.length > 0 && <small> ({game.dawn.length})</small>}
            </span>
          </button>
        )}
        {screen === 'game' &&
          !dawnOpen &&
          !paying &&
          !passing &&
          !busy &&
          game.opening &&
          !game.opening.seen && (
            <Opening
              arrival={game.opening}
              rooms={roomsLive}
              best={prevBest}
              onOpen={() => {
                audio.play('dawn');
                dispatch({ type: 'ackOpening' });
                scene.current?.cheer('barra');
                toast(t('pantallas.app.abre_sus_puertas_al', { nombre: customOf(game).name }));
              }}
              onRetry={restart}
            />
          )}
        {pendingEvent === null && naming && (
          <NameTavern
            onName={(name) => {
              dispatch({ type: 'custom', patch: { name } });
              audio.play('coin');
              toast(t('pantallas.app.letrero_nuevo_en_la'));
            }}
            onLater={() => dispatch({ type: 'nameAsked' })}
          />
        )}
        {game.over && !dawnOpen && screen === 'game' && <GameOver game={game} onNew={restart} />}
      </div>
      {/* En el modo obras, la cinta manda: sin pestañas, más escena. */}
      <TabBar
        hidden={works.planning}
        tab={tab}
        badges={{ mapa: away }}
        onTab={(t) => {
          const p = t === 'mapa' ? 'fuera' : t;
          // Tocar la pestaña abierta vuelve a la taberna.
          if (panel === p) return openPanel(null);
          if (t === 'heroes') setHeroFilter('todos');
          if (t === 'gremio') setFocusFac(null);
          openPanel(p);
        }}
      />
      {raiding && (
        <div class="raid-banner" role="status">
          <b>{t('pantallas.app.asalto_a_la_taberna')}</b>
          <button class="btn btn-wood" onClick={() => scene.current?.skipRaid()}>
            {raidLive ? t('pantallas.app.que_se_las_apanen') : t('pantallas.app.saltar')}
          </button>
        </div>
      )}
      {raidLive && <RaidCrew game={game} scene={scene} />}
      {bossCall && callReport?.fight && (
        <BossCall
          fight={callReport.fight}
          who={tx(callReport.who)}
          onWatch={() => {
            setBossCall(null);
            audio.play('horn');
            setWatching({ fight: callReport.fight!, dawn: true });
          }}
          onLater={() => {
            setBossCall(null);
            setDawnChip(game.day);
          }}
        />
      )}
      {waitMission && bossOf(waitMission.quest) && !busy && (
        <BossWait
          boss={bossOf(waitMission.quest)!}
          place={waitMission.quest.place}
          who={listNames(
            waitMission.heroIds.map((id) => game.heroes.find((h) => h.id === id)?.name ?? '?'),
          )}
          many={waitMission.heroIds.length > 1}
          onWatch={() => facBoss(waitMission.id, true)}
          onAuto={() => facBoss(waitMission.id, false)}
          onLater={() => setBossWait(null)}
        />
      )}
      {watching && expOf(watching.fight) && !watching.play && (
        <ExpFightReplay game={game} fight={watching.fight} onClose={closeWatch} />
      )}
      {watching && !(expOf(watching.fight) && !watching.play) && (
        <BossFight
          fight={watching.fight}
          onClose={closeWatch}
          onResult={
            watching.play
              ? (orders) => dispatch({ type: 'boss', id: watching.play!, orders })
              : undefined
          }
        />
      )}
      {strangerOpen && game.stranger && !game.over && (
        <StrangerCard
          game={game}
          onAnswer={(id) => {
            dispatch({ type: 'stranger', heroId: id });
            audio.play(id ? 'cheer' : 'close');
            setStrangerOpen(false);
          }}
          onClose={() => setStrangerOpen(false)}
        />
      )}
      {messengerOpen && knocking && !game.over && (
        <MessengerCard
          game={game}
          onAnswer={(accept) => {
            dispatch({ type: 'messenger', accept });
            audio.play(accept ? 'coin' : 'close');
            setMessengerOpen(false);
          }}
          onClose={() => setMessengerOpen(false)}
        />
      )}
      {pendingEvent && (
        <EventCard
          event={pendingEvent}
          onChoose={(i) => {
            const next = dispatch({ type: 'choose', index: i });
            audio.play(i === 0 ? 'coin' : 'close');
            if (next.lastChoice) toast(tx(next.lastChoice));
          }}
        />
      )}
      {lesson && lessonFocus && (
        <TutorialFocus
          focus={lessonFocus}
          scene={scene}
          onSpot={(y, closing) => {
            setSpotY(y);
            setSpotClose(closing);
          }}
        />
      )}
      {lesson && (
        <TutorialNote
          game={game}
          step={lesson}
          ready={
            !lessonFocus?.note || lessonFocus.targets[0] !== '.gremio-goals' || panel === 'gremio'
          }
          up={!lessonFocus?.note && spotY !== null && spotY > innerHeight * 0.5}
          closing={!!lessonFocus && spotClose}
          onOk={() => {
            audio.play('close');
            dispatch({ type: 'tutorial', op: 'ok' });
          }}
          onSkipTime={(to) => endDay(to)}
          onSkipAll={() => dispatch({ type: 'tutorial', op: 'saltar' })}
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
      {settings.tester && settings.perf && <PerfMeter scene={scene} />}
      {sellIt && (
        <div class="card-backdrop confirm-backdrop" onClick={() => setSelling(null)}>
          <article
            class="herocard confirm-card"
            role="alertdialog"
            aria-label={t('pantallas.app.vender_pregunta', {
              objeto: tx(sellIt.name),
              oro: priceOf(sellIt),
            })}
            onClick={(e) => e.stopPropagation()}
          >
            <p>
              {t('pantallas.app.vender_pregunta', {
                objeto: tx(sellIt.name),
                oro: priceOf(sellIt),
              })}
            </p>
            <div class="herocard-actions">
              <button class="btn btn-gold" onClick={() => sellNow(sellIt.id)}>
                <Icon name="coin" size={12} />{' '}
                {t('pantallas.app.vender_si', { oro: priceOf(sellIt) })}
              </button>
              <button class="btn btn-wood" onClick={() => setSelling(null)}>
                {t('pantallas.app.vender_no')}
              </button>
            </div>
          </article>
        </div>
      )}
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
          weather={forcedWeather}
          onLightning={() => scene.current?.lightning()}
          onWeather={(k) => {
            setForcedWeather(k);
            if (scene.current) scene.current.forceWeather = k;
          }}
          onBoss={(boss, won) => {
            const fight = testFight(gameRef.current, boss, won);
            if (!fight) return toast(t('pantallas.app.no_hay_nadie_en'));
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
      <UpdateBar
        onBeforeReload={() => hasGame && saveGame({ ...gameRef.current, lastSeen: Date.now() })}
      />
    </div>
  );
}
