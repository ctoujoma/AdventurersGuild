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

export function tutorialFocus(s: GameState, panel: string | null): Focus | null {
  const st = tutorialStep(s);
  if (!st) return null;
  switch (st.id) {
    case 'casa':
    case 'dinero':
      // Se mira la casa (y se puede arrastrar); se sigue con el botón de la nota.
      return { targets: [T('nota-boton')], note: true, scene: true };
    case 'tablon':
    case 'mandar':
      return { targets: send(tutorialQuest(s)) };
    case 'barra':
      return {
        targets: [`${T('contratar')}:not([disabled])`, T('seg-candidatos'), T('tab-heroes')],
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
    case 'pago':
      // Hasta el pago, libre: juntar el dinero con el tablón, la casa… y pasar las noches.
      return null;
    default:
      return { targets: [T('nota-boton')], note: true };
  }
}
