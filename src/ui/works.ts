import { useMemo, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { canWork, needsPlan, planIssue, tryWork, tryWorks, type Action } from '../core/game';
import { laxly } from '../core/rooms';
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
  /** Lo que falta arreglar en el plano para poder pagarlo (salas sin paso…). */
  issue: string | null;
  pick: Pick | null;
  /** Lo que se marca en la escena: lo elegido o, en el modo obras, excavar y solares. */
  active: Pick | null;
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
  // En el modo obras, sin nada elegido, se ven los huecos que se pueden excavar y el solar.
  const active: Pick | null = pick ?? (steps ? { kind: 'expand' } : null);
  // En el plano (y al mover, que puede llevar a él) se deja la casa a medias por el camino.
  const loose = !!steps || pick?.kind === 'move';
  const targets = useMemo(
    () =>
      active ? (loose ? laxly(() => targetsFor(view, active)) : targetsFor(view, active)) : [],
    [view, pick, !!steps, loose],
  );
  const chosen = targets.find((t) => t.id === chosenId) ?? null;

  const work = (a: Action): boolean => {
    if (steps) {
      const next = laxly(() => tryWork(view, a));
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
    if (needsPlan(game, a)) {
      // La casa quedaría a medias: se sigue en el plano y se paga cuando todo cuadre.
      setSteps([a]);
      audio.play('select');
      toast('Así la casa queda a medias: sigue en el plano y paga cuando todo cuadre.');
      const next = tryWorks(game, [a]);
      const id = 'error' in next ? null : roomOf(game, next, a);
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
    issue: steps ? planIssue(view) : null,
    pick,
    active,
    targets,
    chosen,
    work,
    startPick: (p) => {
      setPick(p);
      setChosenId(null);
      if (!targetsFor(view, p).length) toast('No queda ningún sitio donde hacerlo.');
    },
    choose: (id) => {
      // En el modo obras basta un toque: se apunta y se deshace si hace falta.
      if (steps) {
        const t = targets.find((x) => x.id === id);
        if (t && work(t.action) && pick && pick.kind !== 'expand') endPick();
        return;
      }
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
      toast('Modo obras: toca los huecos marcados o elige una sala abajo. Se paga al final.');
    },
    undo: () => {
      if (!steps?.length) return;
      setSteps(steps.slice(0, -1));
      audio.play('deselect');
    },
    pay: () => {
      if (!steps?.length) return;
      const issue = planIssue(view);
      if (issue) {
        toast(`Antes de pagar: ${issue}`);
        return;
      }
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
