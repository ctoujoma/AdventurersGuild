/**
 * Incidentes de la taberna: lo que pasa a lo largo del día con el juego abierto y pide que el
 * jugador haga algo (a lo Fallout Shelter, con lo nuestro). Datos: dónde pasa cada uno, cómo
 * se resuelve, cuánto aguanta y lo que se cuenta. Las reglas están en `core/incidents.ts`.
 */
import { NIGHT_THIEF_SECS, NIGHT_THIEF_SHARE, NIGHT_THIEF_TOP } from '../core/balance';
import type { RoomType } from './rooms';
import { t } from '../textos';

export type IncidentKind =
  'pelea' | 'ladron' | 'fuego' | 'ratas' | 'recaudador' | 'gotera' | 'noble' | 'nocturno';

/**
 * Cómo se resuelve: arrastrando a un héroe o a cualquiera de la casa a la sala, tocando el icono
 * y pagando, tocándolo varias veces o eligiendo.
 */
export type IncidentHow = 'heroe' | 'alguien' | 'pagar' | 'tocar' | 'elegir';

export interface IncidentChoice {
  label: string;
  gold?: number;
  rep?: number;
  text: string;
}

export interface IncidentDef {
  /** Salas donde puede pasar (en uso). */
  rooms: RoomType[];
  how: IncidentHow;
  /** Título del icono y lo que hay que hacer. */
  title: string;
  ask: string;
  /** Segundos de reloj del día que aguanta antes de salir mal. */
  secs: number;
  /*
   * Lo que se cuenta si sale bien y si sale mal: `incidentes.incidentes.<tipo>.gana` ({heroe}:
   * quien lo arregla) y `.pierde` ({n}: lo que se pierde), ver `core/incidents.ts`.
   */
  /** Si sale bien: reputación. */
  rep?: number;
  /** Si sale mal: lo que se pierde (`goldTop`: tope de `goldShare`, por cada rango uno más). */
  loss: {
    gold?: number;
    goldShare?: number;
    goldTop?: number;
    food?: number;
    beer?: number;
    rep?: number;
  };
  /** Solo de noche (un suceso nocturno, ver `core/thief.ts`): de día no sale. */
  night?: boolean;
  /** Pagar: lo que cuesta (más por cada rango). Tocar: cuántas veces. Elegir: las opciones. */
  cost?: number;
  taps?: number;
  choices?: IncidentChoice[];
}

export const INCIDENTS: Record<IncidentKind, IncidentDef> = {
  pelea: {
    rooms: ['salon'],
    how: 'heroe',
    title: t('incidentes.incidentes.pelea.titulo'),
    ask: t('incidentes.incidentes.pelea.ask'),
    secs: 40,
    rep: 1,
    loss: { gold: 15 },
  },
  ladron: {
    rooms: ['tesoro'],
    how: 'heroe',
    title: t('incidentes.incidentes.ladron.titulo'),
    ask: t('incidentes.incidentes.ladron.ask'),
    secs: 30,
    rep: 2,
    loss: { goldShare: 0.08 },
  },
  fuego: {
    rooms: ['cocina'],
    how: 'alguien',
    title: t('incidentes.incidentes.fuego.titulo'),
    ask: t('incidentes.incidentes.fuego.ask'),
    secs: 35,
    loss: { food: 8 },
  },
  ratas: {
    rooms: ['despensa', 'cocina'],
    how: 'tocar',
    title: t('incidentes.incidentes.ratas.titulo'),
    ask: t('incidentes.incidentes.ratas.ask'),
    secs: 30,
    taps: 6,
    loss: { food: 6 },
  },
  recaudador: {
    rooms: ['recibidor'],
    how: 'pagar',
    title: t('incidentes.incidentes.recaudador.titulo'),
    ask: t('incidentes.incidentes.recaudador.ask'),
    secs: 40,
    cost: 15,
    rep: 1,
    loss: { rep: 3 },
  },
  gotera: {
    rooms: ['bodega'],
    how: 'pagar',
    title: t('incidentes.incidentes.gotera.titulo'),
    ask: t('incidentes.incidentes.gotera.ask'),
    secs: 40,
    cost: 20,
    loss: { beer: 6 },
  },
  nocturno: {
    rooms: ['tesoro', 'recibidor'],
    how: 'heroe',
    night: true,
    title: t('incidentes.incidentes.nocturno.titulo'),
    ask: t('incidentes.incidentes.nocturno.ask'),
    secs: NIGHT_THIEF_SECS,
    rep: 2,
    loss: { goldShare: NIGHT_THIEF_SHARE, goldTop: NIGHT_THIEF_TOP },
  },
  noble: {
    rooms: ['salon'],
    how: 'elegir',
    title: t('incidentes.incidentes.noble.titulo'),
    ask: t('incidentes.incidentes.noble.ask'),
    secs: 40,
    choices: [
      {
        label: t('incidentes.incidentes.noble.choices.0.etiqueta'),
        rep: -1,
        text: t('incidentes.incidentes.noble.choices.0.texto'),
      },
      {
        label: t('incidentes.incidentes.noble.choices.1.etiqueta'),
        gold: -25,
        rep: 2,
        text: t('incidentes.incidentes.noble.choices.1.texto'),
      },
    ],
    loss: { rep: 2 },
  },
};
