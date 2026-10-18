/**
 * Los trabajadores: un oficio por cada sala que produce y los tres del pueblo que ya trabajaban
 * para tu tío. Las cifras de lo que rinden están en core/balance.ts; las reglas, en core/workers.ts.
 */
import type { Sex } from '../core/model';
import type { StaffId } from './custom';

/** Oficio: el de la sala en la que rinde más. */
export type Trade = 'salon' | 'cocina' | 'bodega' | 'enfermeria';

export const TRADES: Record<Trade, { name: Record<Sex, string>; job: string; gives: string }> = {
  salon: {
    name: { m: 'Camarero', f: 'Camarera' },
    job: 'Atiende el salón',
    gives: 'más monedas en la caja',
  },
  cocina: {
    name: { m: 'Cocinero', f: 'Cocinera' },
    job: 'Cocina',
    gives: 'el plato de la casa anima más',
  },
  bodega: {
    name: { m: 'Cervecero', f: 'Cervecera' },
    job: 'Hace cerveza',
    gives: 'cerveza que se vende en el salón',
  },
  enfermeria: {
    name: { m: 'Enfermero', f: 'Enfermera' },
    job: 'Cuida a los heridos',
    gives: 'los heridos se curan antes',
  },
};

export const TRADE_LIST = Object.keys(TRADES) as Trade[];

/** Los tres de siempre: vienen cada mañana del pueblo y vuelven a dormir a su casa. */
export const VILLAGE: Record<
  StaffId,
  { name: string; role: string; sex: Sex; trade: Trade; skill: number; quote: string }
> = {
  cocinera: {
    name: 'Remedios',
    role: 'la cocinera',
    sex: 'f',
    trade: 'cocina',
    skill: 4,
    quote: 'Aquí no se tira nada. Lo que sobra hoy, mañana es guiso.',
  },
  bardo: {
    name: 'Tobías',
    role: 'el bardo',
    sex: 'm',
    trade: 'salon',
    skill: 4,
    quote: 'Una canción más y sirvo otra ronda. O al revés.',
  },
  mozo: {
    name: 'Nico',
    role: 'el mozo',
    sex: 'm',
    trade: 'bodega',
    skill: 3,
    quote: 'Los barriles pesan menos si no los miras.',
  },
};

/** Lo que dice quien viene a pedir trabajo. */
export const WORKER_QUOTES: readonly string[] = [
  'Trabajo de sol a sol y no me quejo. Casi nunca.',
  'En mi casa éramos once. Sé hacer de todo un poco.',
  'Me echaron de la posada del camino por llegar pronto. Raro, ¿verdad?',
  'Si hay cama y plato caliente, aquí me quedo.',
  'Mi madre llevaba una taberna. La suya era peor que esta.',
  'No sé luchar, pero sé lo que pesa un barril lleno.',
  'Pago mis deudas trabajando. ¿Hay algo que fregar?',
  'Me han dicho que aquí se come bien. Vengo a comprobarlo.',
];
