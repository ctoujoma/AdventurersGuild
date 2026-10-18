import { useMemo, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { canWork, tryWork, tryWorks, type Action } from '../core/game';
import type { GameState } from '../core/model';
import { ROOMS } from '../data/rooms';
import { targetsFor, type Pick, type Target } from '../world/rooms/works';

/**
 * Las obras desde la interfaz: elegir sitio en la escena y confirmar, y el modo plano, en el
 * que las obras se prueban sobre un borrador y se pagan todas juntas al final.
 */
export interface Works {
  /** El gremio tal como se enseña: el borrador del plano, si lo hay. */
  view: GameState;
  planning: boolean;
  steps: Action[];
  /** Lo que cuesta el plano hasta ahora (negativo si se recupera oro). */
  planCost: number;
  pick: Pick | null;
  targets: Target[];
  chosen: Target | null;
  /** Hace una obra (o la apunta en el plano). Devuelve si se ha hecho. */
  work: (a: Action) => boolean;
  startPick: (p: Pick) => void;
  choose: (id: string) => void;
  confirm: () => void;
  cancelPick: () => void;
  startPlan: () => void;
  undo: () => void;
  pay: () => void;
  discard: () => void;
}

interface Deps {
  game: GameState;
  dispatch: (a: Action) => GameState;
  toast: (text: string) => void;
  /** Mira a una sala de la escena (la que se acaba de tocar). */
  focus: (id: string) => void;
}

/** Lo que se cuenta al hacer una obra. */
function told(s: GameState, a: Action): string {
  switch (a.type) {
    case 'build':
      return `Obra en marcha: ${ROOMS[a.room].name.toLowerCase()}. Mañana estará lista.`;
    case 'move': {
      const r = s.building.rooms.find((x) => x.id === a.id);
      return r ? `${ROOMS[r.type].name}: se muda esta noche.` : 'Mudanza en marcha.';
    }
    case 'dig':
      return 'Hueco excavado: ya se puede construir ahí.';
    case 'addStair':
      return 'Escalera nueva: llega de arriba abajo.';
    case 'buyPlot':
      return 'Solar comprado: un hueco más de ancho en todas las plantas.';
    case 'extend':
      return 'Obra en marcha: mañana la sala será más grande.';
    case 'demolish':
      return 'Sala derribada. Se recupera la mitad de lo gastado.';
    default:
      return 'Hecho.';
  }
}

/** Sala a la que mirar tras una obra, si la hay. */
function roomOf(before: GameState, after: GameState, a: Action): string | null {
  if (a.type === 'move' || a.type === 'extend' || a.type === 'upgradeRoom') return a.id;
  if (a.type === 'build') {
    const r = after.building.rooms.find((x) => !before.building.rooms.some((y) => y.id === x.id));
    return r?.id ?? null;
  }
  return null;
}

export function useWorks({ game, dispatch, toast, focus }: Deps): Works {
  const [steps, setSteps] = useState<Action[] | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);

  // El borrador se rehace desde la partida y la lista de obras: así deshacer es quitar la última.
  const draft = useMemo(() => {
    if (!steps) return null;
    const d = tryWorks(game, steps);
    return 'error' in d ? game : d;
  }, [game, steps]);
  const view = draft ?? game;
  const targets = useMemo(() => (pick ? targetsFor(view, pick) : []), [view, pick]);
  const chosen = targets.find((t) => t.id === chosenId) ?? null;

  const work = (a: Action): boolean => {
    if (steps) {
      const next = tryWork(view, a);
      if ('error' in next) {
        toast(next.error);
        return false;
      }
      setSteps([...steps, a]);
      audio.play('select');
      toast('Apuntado en el plano.');
      const id = roomOf(view, next, a);
      if (id) focus(id);
      return true;
    }
    const why = canWork(game, a);
    if (why) {
      toast(why);
      return false;
    }
    const next = dispatch(a);
    audio.play(a.type === 'demolish' ? 'close' : 'build');
    // Construir junto a una sala igual del mismo nivel la amplía en vez de hacer otra.
    const grew = a.type === 'build' && next.building.rooms.length === game.building.rooms.length;
    toast(told(game, grew ? { type: 'extend', id: '', dir: 'right' } : a));
    const id = roomOf(game, next, a);
    if (id) focus(id);
    return true;
  };

  const endPick = () => {
    setPick(null);
    setChosenId(null);
  };

  return {
    view,
    planning: !!steps,
    steps: steps ?? [],
    planCost: game.gold - view.gold,
    pick,
    targets,
    chosen,
    work,
    startPick: (p) => {
      setPick(p);
      setChosenId(null);
      if (!targetsFor(view, p).length) toast('No queda ningún sitio donde hacerlo.');
    },
    choose: (id) => {
      setChosenId(id);
      audio.play('select', 0.6);
    },
    confirm: () => {
      if (!chosen || !work(chosen.action)) return;
      // Ganando sitio se sigue tocando huecos, como en una mina; lo demás acaba al hacerlo.
      if (pick?.kind === 'expand') setChosenId(null);
      else endPick();
    },
    cancelPick: () => {
      endPick();
      audio.play('close');
    },
    startPlan: () => {
      setSteps([]);
      toast('Modo plano: prueba las obras y paga al final.');
    },
    undo: () => {
      if (!steps?.length) return;
      setSteps(steps.slice(0, -1));
      audio.play('deselect');
    },
    pay: () => {
      if (!steps?.length) return;
      const before = game;
      if (dispatch({ type: 'works', steps }) === before) {
        toast('El plano ya no cuadra con la taberna: revísalo.');
        return;
      }
      audio.play('build');
      toast(`Plano pagado: ${steps.length} ${steps.length === 1 ? 'obra' : 'obras'} en marcha.`);
      setSteps(null);
      endPick();
    },
    discard: () => {
      setSteps(null);
      endPick();
      audio.play('close');
    },
  };
}
