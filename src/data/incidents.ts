/**
 * Incidentes de la taberna: lo que pasa a lo largo del día con el juego abierto y pide que el
 * jugador haga algo (a lo Fallout Shelter, con lo nuestro). Datos: dónde pasa cada uno, cómo
 * se resuelve, cuánto aguanta y lo que se cuenta. Las reglas están en `core/incidents.ts`.
 */
import type { RoomType } from './rooms';

export type IncidentKind =
  'pelea' | 'ladron' | 'fuego' | 'ratas' | 'recaudador' | 'gotera' | 'noble';

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
  /** Lo que se cuenta si sale bien ({h}: quien lo arregla) y si sale mal ({n}: lo que se pierde). */
  win: string;
  lose: string;
  /** Si sale bien: reputación. */
  rep?: number;
  /** Si sale mal: lo que se pierde. */
  loss: { gold?: number; goldShare?: number; food?: number; beer?: number; rep?: number };
  /** Pagar: lo que cuesta (más por cada rango). Tocar: cuántas veces. Elegir: las opciones. */
  cost?: number;
  taps?: number;
  choices?: IncidentChoice[];
}

export const INCIDENTS: Record<IncidentKind, IncidentDef> = {
  pelea: {
    rooms: ['salon'],
    how: 'heroe',
    title: 'Pelea en el salón',
    ask: 'Arrastra a un héroe al salón para separarlos.',
    secs: 40,
    win: '{h} separa a los borrachos antes de que vuelen las sillas.',
    lose: 'La pelea acaba con sillas rotas: {n} monedas en arreglos.',
    rep: 1,
    loss: { gold: 15 },
  },
  ladron: {
    rooms: ['tesoro'],
    how: 'heroe',
    title: 'Un ladrón en la cámara',
    ask: 'Arrastra a un héroe a la cámara del tesoro.',
    secs: 30,
    win: '{h} pilla al ladrón con las manos en la bolsa.',
    lose: 'El ladrón se escapa con {n} monedas.',
    rep: 2,
    loss: { goldShare: 0.08 },
  },
  fuego: {
    rooms: ['cocina'],
    how: 'alguien',
    title: 'Fuego en la cocina',
    ask: 'Arrastra a alguien de la casa a la cocina para apagarlo.',
    secs: 35,
    win: '{h} apaga el fuego a cubos.',
    lose: 'El fuego se come {n} raciones.',
    loss: { food: 8 },
  },
  ratas: {
    rooms: ['despensa', 'cocina'],
    how: 'tocar',
    title: 'Ratas en la despensa',
    ask: 'Toca las ratas para espantarlas.',
    secs: 30,
    taps: 6,
    win: 'Fuera ratas: no queda ni una.',
    lose: 'Las ratas se comen {n} raciones.',
    loss: { food: 6 },
  },
  recaudador: {
    rooms: ['recibidor'],
    how: 'pagar',
    title: 'El recaudador del alcalde',
    ask: 'Toca para pagar la tasa.',
    secs: 40,
    cost: 15,
    win: 'Pagas la tasa y el recaudador lo apunta a favor del gremio.',
    lose: 'El recaudador se va de mal humor y lo cuenta en el ayuntamiento.',
    rep: 1,
    loss: { rep: 3 },
  },
  gotera: {
    rooms: ['bodega'],
    how: 'pagar',
    title: 'Una gotera en la bodega',
    ask: 'Toca para llamar al carpintero.',
    secs: 40,
    cost: 20,
    win: 'El carpintero tapa la gotera antes de que se aguen las cubas.',
    lose: 'La gotera echa a perder {n} jarras.',
    loss: { beer: 6 },
  },
  noble: {
    rooms: ['salon'],
    how: 'elegir',
    title: 'Un noble borracho',
    ask: 'Toca para decidir qué hacer con él.',
    secs: 40,
    choices: [
      {
        label: 'Echarlo a la calle',
        rep: -1,
        text: 'Lo sacas a la calle: el salón respira, pero el noble no olvida.',
      },
      {
        label: 'Pagarle la cuenta',
        gold: -25,
        rep: 2,
        text: 'Le pagas la cuenta y se va cantando las alabanzas del gremio.',
      },
    ],
    win: '',
    lose: 'El noble se va sin pagar y dice cosas feas del gremio por ahí.',
    loss: { rep: 2 },
  },
};
