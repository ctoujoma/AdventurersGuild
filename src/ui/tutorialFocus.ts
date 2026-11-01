import type { Action } from '../core/game';
import type { GameState } from '../core/model';
import { tutorialHero, tutorialQuest, tutorialStep } from '../core/tutorial';

/**
 * A qué apunta el tutorial en cada paso: una lista de sitios, del más avanzado al primero;
 * se resalta el primero que esté en pantalla y todo lo demás queda bloqueado. Un sitio es un
 * selector de la interfaz (`[data-tut=…]`), algo que flota en la escena (`escena:…`, se cierra
 * antes lo que lo tape) o una sala (`sala:<id>`).
 */
export interface Focus {
  /** Sitios, por orden de preferencia. */
  targets: string[];
  /** Deja libre toda la escena (para arrastrar a alguien), y resalta este sitio. */
  scene?: boolean;
  /** El botón de la nota es lo que hay que tocar. */
  note?: boolean;
  /** Otros sitios que también valen y se resaltan a la vez (el tablón de la sala). */
  also?: string[];
}

/** Lo del modo obras que necesita el tutorial de obras para señalar. */
export interface WorksSpots {
  planning: boolean;
  /** El borrador (lo que se ve en la escena). */
  view: GameState;
  selected: string | null;
  /** Sala que se está moviendo (sus sitios están marcados). */
  moving: string | null;
  targets: { id: string; action: Action; blocked?: string }[];
}

const T = (id: string) => `[data-tut="${id}"]`;
const room = (s: GameState, type: string) => {
  const r = s.building.rooms.find((x) => x.type === type);
  return r ? `sala:${r.id}` : null;
};

/** Mandar un encargo: tablón, el encargo, «Sugerir» y «Enviar». */
const send = (q: string | null) =>
  q
    ? [`${T('enviar')}:not([disabled])`, T('sugerir'), T(`quest-${q}`), T('tab-tablon')]
    : [T('tab-tablon')];

/** Abrir la ficha de un héroe desde «Héroes». */
const heroCard = (id: string | null) =>
  id ? [T(`hero-${id}`), T('seg-todos'), T('tab-heroes')] : [T('tab-heroes')];

/** La casilla marcada en la escena que hace esta obra (`obra:…`), si está. */
const spot = (w: WorksSpots | undefined, ok: (a: Action) => boolean) => {
  const t = w?.targets.find((x) => !x.blocked && ok(x.action));
  return t ? [t.id] : [];
};

/**
 * Obras: elegir la sala (tocándola) y luego su casilla o su botón. Con otra cosa a medias
 * (moviendo otra sala), la nota pide cerrarla.
 */
function obras(s: GameState, st: string, w: WorksSpots | undefined): Focus | null {
  const v = w?.view ?? s;
  const id = (type: string) => v.building.rooms.find((r) => r.type === type)?.id ?? '';
  const plot = v.building.cols - 1;
  const grow = (type: string): Focus => {
    const r = id(type);
    if (w?.selected === r)
      return {
        targets: spot(w, (a) => a.type === 'extend' && a.id === r && a.dir === 'right'),
      };
    return { targets: [`sala:${r}`, T('cerrar')] };
  };
  switch (st) {
    case 'o-martillo':
      return { targets: [T('martillo')] };
    case 'o-solar':
      return { targets: [...spot(w, (a) => a.type === 'buyPlot'), T('cerrar')] };
    case 'o-mudar': {
      const r = id('cocina');
      if (w?.moving === r)
        return {
          targets: spot(w, (a) => a.type === 'move' && a.col === plot && a.floor === 0),
          scene: true,
        };
      // Con la cocina elegida vale «Mover» o cogerla con el dedo.
      if (w?.selected === r) return { targets: [T('mover')], also: [`sala:${r}`] };
      return { targets: [`sala:${r}`, T('cerrar')] };
    }
    case 'o-salon':
      return grow('salon');
    case 'o-excavar':
      return {
        targets: [
          ...spot(w, (a) => a.type === 'dig' && a.col === plot && a.floor < 0),
          T('cerrar'),
        ],
      };
    case 'o-camara':
      return grow('tesoro');
    case 'o-pagar':
      return { targets: [T('pagar')] };
    default:
      return { targets: [T('nota-boton')], note: true };
  }
}

export function tutorialFocus(
  s: GameState,
  panel: string | null,
  works?: WorksSpots,
): Focus | null {
  const st = tutorialStep(s);
  if (!st) return null;
  if (st.id.startsWith('o-')) return obras(s, st.id, works);
  switch (st.id) {
    case 'casa':
    case 'dinero':
      // Se mira la casa (y se puede arrastrar); se sigue con el botón de la nota.
      return { targets: [T('nota-boton')], note: true, scene: true };
    case 'tablon':
    case 'mandar':
      // El tablón también se abre tocándolo en la sala.
      return { targets: send(tutorialQuest(s)), also: panel ? [] : ['cosa:tablon'] };
    case 'barra':
      return {
        targets: [`${T('contratar')}:not([disabled])`, T('seg-candidatos'), T('tab-heroes')],
        also: panel ? [] : ['cosa:candidatos'],
      };
    case 'nombre': {
      // El último contratado (el que sigue en casa).
      const h = [...s.heroes].reverse().find((x) => x.status === 'ok')?.id ?? null;
      // El campo y su botón juntos: hay que poder escribir.
      return { targets: [T('nombre-form'), T('nombre'), ...heroCard(h)] };
    }
    case 'enfermeria':
      return {
        targets: [T('mejorar-enfermeria'), room(s, 'enfermeria')].filter(Boolean) as string[],
      };
    case 'mover':
      return { targets: [room(s, 'cocina')].filter(Boolean) as string[], scene: true };
    case 'informe':
      return { targets: [T('informe'), T('correo')] };
    case 'equipo':
      return { targets: [T('equipar'), T('equipo'), ...heroCard(tutorialHero(s))] };
    case 'ratas':
      return { targets: [`escena:${T('incidente')}`] };
    case 'rumor':
      return { targets: [`escena:${T('rumor')}`] };
    case 'objetivos':
      return panel === 'gremio'
        ? { targets: ['.gremio-goals', T('nota-boton')], note: true }
        : { targets: [T('tab-gremio')] };
    case 'esperar':
    case 'pago':
      // Pasos libres: se mira y se toca lo que se quiera (el grupo vuelve, se junta el dinero).
      return null;
    default:
      return { targets: [T('nota-boton')], note: true };
  }
}
