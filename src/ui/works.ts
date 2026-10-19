import { useMemo, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { planIssue, tryWorks, type Action } from '../core/game';
import { laxly } from '../core/rooms';
import type { GameState, Room } from '../core/model';
import { ROOMS } from '../data/rooms';
import { targetsFor, type Pick, type Target } from '../world/rooms/works';

/**
 * El modo obras desde la interfaz. Es un borrador: todo lo que se hace en él se apunta (con su
 * coste sumado), se ve en la escena como quedaría y se paga junto al final; mientras falte algo
 * (salas sin paso, una obligatoria quitada o el oro), no se puede pagar.
 */
export interface Works {
  /** El gremio tal como se enseña: el borrador, si se está en el modo obras. */
  view: GameState;
  planning: boolean;
  steps: Action[];
  /** Lo que cuesta el borrador hasta ahora (negativo si se recupera oro). */
  planCost: number;
  /** Lo que impide pagar el borrador (salas sin paso, una que falta, el oro…). */
  issue: string | null;
  /** Obra elegida en la cinta (construir una sala, una escalera…): sus sitios brillan. */
  pick: Pick | null;
  /** Sala elegida en el modo obras: se ve su menú y las casillas para ampliarla. */
  selected: string | null;
  /** Lo que se marca en la escena: lo elegido, la sala elegida o excavar y solares. */
  active: Pick | null;
  targets: Target[];
  /** Apunta una obra en el borrador. Devuelve si se ha podido. */
  work: (a: Action) => boolean;
  startPick: (p: Pick) => void;
  /** Toca una casilla marcada en la escena. */
  choose: (id: string) => void;
  cancelPick: () => void;
  select: (id: string | null) => void;
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
  /** Levanta en la escena las salas recién hechas (andamio y polvo). */
  raise: (ids: string[]) => void;
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

/** Salas nuevas o cambiadas (sitio, tamaño o nivel) entre dos estados, de abajo arriba. */
export function touchedRooms(before: GameState, after: GameState): string[] {
  const key = (r: Room) => [r.type, r.col, r.floor, r.w, r.h, r.level].join(' ');
  const old = new Map(before.building.rooms.map((r) => [r.id, key(r)]));
  return after.building.rooms
    .filter((r) => old.get(r.id) !== key(r))
    .sort((a, b) => a.floor - b.floor || a.col - b.col)
    .map((r) => r.id);
}

/** Sonido de cada obra al apuntarla. */
const soundOf = (a: Action) =>
  a.type === 'demolish' ? 'close' : a.type === 'move' ? 'select' : 'build';

export function useWorks({ game, dispatch, toast, focus, raise }: Deps): Works {
  const [steps, setSteps] = useState<Action[] | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // El borrador se rehace desde la partida y la lista de obras: así deshacer es quitar la última.
  const draft = useMemo(() => {
    if (!steps) return null;
    const d = tryWorks(game, steps);
    return 'error' in d ? game : d;
  }, [game, steps]);
  const view = draft ?? game;
  const room = selected && view.building.rooms.some((r) => r.id === selected) ? selected : null;
  const active: Pick | null = !steps
    ? null
    : (pick ?? (room ? { kind: 'grow', id: room } : { kind: 'expand' }));
  const targets = useMemo(
    () => (active ? laxly(() => targetsFor(view, active)) : []),
    [view, JSON.stringify(active)],
  );

  const work = (a: Action): boolean => {
    // Fuera del modo obras, una obra lo abre con ella ya apuntada.
    const list = [...(steps ?? []), a];
    const next = tryWorks(game, list);
    if ('error' in next) {
      toast(next.error);
      return false;
    }
    setSteps(list);
    audio.play(soundOf(a));
    const id = roomOf(view, next, a);
    if (id) focus(id);
    if (a.type === 'demolish') setSelected(null);
    return true;
  };

  const endPick = () => setPick(null);

  return {
    view,
    planning: !!steps,
    steps: steps ?? [],
    planCost: game.gold - view.gold,
    issue: steps?.length ? planIssue(view) : null,
    pick,
    selected: room,
    active,
    targets,
    work,
    startPick: (p) => {
      setPick(p);
      setSelected(null);
      if (!laxly(() => targetsFor(view, p)).length) toast('No queda ningún sitio donde hacerlo.');
    },
    choose: (id) => {
      const t = targets.find((x) => x.id === id);
      if (!t) return;
      if (t.blocked) {
        toast(t.blocked);
        audio.play('deselect');
        return;
      }
      // Excavar, ampliar y la escalera siguen marcados (se encadenan); lo demás acaba al hacerlo.
      if (work(t.action) && pick && pick.kind !== 'expand' && pick.kind !== 'stair') endPick();
    },
    cancelPick: () => {
      endPick();
      audio.play('close');
    },
    select: (id) => {
      setPick(null);
      setSelected(id);
      if (id) audio.play('select', 0.6);
    },
    startPlan: () => {
      setSteps([]);
      setSelected(null);
      toast(
        'Modo obras: elige una sala abajo o toca una sala para mejorarla, moverla o ampliarla.',
      );
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
      const after = dispatch({ type: 'works', steps });
      if (after === before) {
        toast('Las obras ya no cuadran con la taberna: revísalas.');
        return;
      }
      const ids = touchedRooms(before, after);
      if (ids[0]) focus(ids[0]);
      raise(ids);
      audio.play('coin');
      toast(
        `Obras pagadas: ${steps.length} ${steps.length === 1 ? 'obra hecha' : 'obras hechas'}.`,
      );
      setSteps(null);
      setSelected(null);
      endPick();
    },
    discard: () => {
      setSteps(null);
      setSelected(null);
      endPick();
      audio.play('close');
    },
  };
}

/** Nombre corto de una sala para los botones y avisos. */
export const roomName = (s: GameState, id: string) => {
  const r = s.building.rooms.find((x) => x.id === id);
  return r ? ROOMS[r.type].name : '';
};
