/**
 * Los trabajadores: un oficio por cada sala que produce y los tres del pueblo que ya trabajaban
 * para tu tío. Las cifras de lo que rinden están en core/balance.ts; las reglas, en core/workers.ts.
 */
import type { Sex } from '../core/model';
import type { StaffId } from './custom';
import { t, tl } from '../textos';

/** Oficio: el de la sala en la que rinde más. */
export type Trade =
  'salon' | 'cocina' | 'bodega' | 'enfermeria' | 'forja' | 'sastreria' | 'alquimia' | 'pintor';

export const TRADES: Record<Trade, { name: Record<Sex, string>; job: string; gives: string }> = {
  salon: {
    name: {
      m: t('trabajadores.oficios.salon.nombre.m'),
      f: t('trabajadores.oficios.salon.nombre.f'),
    },
    job: t('trabajadores.oficios.salon.trabajo'),
    gives: t('trabajadores.oficios.salon.da'),
  },
  cocina: {
    name: {
      m: t('trabajadores.oficios.cocina.nombre.m'),
      f: t('trabajadores.oficios.cocina.nombre.f'),
    },
    job: t('trabajadores.oficios.cocina.trabajo'),
    gives: t('trabajadores.oficios.cocina.da'),
  },
  bodega: {
    name: {
      m: t('trabajadores.oficios.bodega.nombre.m'),
      f: t('trabajadores.oficios.bodega.nombre.f'),
    },
    job: t('trabajadores.oficios.bodega.trabajo'),
    gives: t('trabajadores.oficios.bodega.da'),
  },
  enfermeria: {
    name: {
      m: t('trabajadores.oficios.enfermeria.nombre.m'),
      f: t('trabajadores.oficios.enfermeria.nombre.f'),
    },
    job: t('trabajadores.oficios.enfermeria.trabajo'),
    gives: t('trabajadores.oficios.enfermeria.da'),
  },
  forja: {
    name: {
      m: t('trabajadores.oficios.forja.nombre.m'),
      f: t('trabajadores.oficios.forja.nombre.f'),
    },
    job: t('trabajadores.oficios.forja.trabajo'),
    gives: t('trabajadores.oficios.forja.da'),
  },
  sastreria: {
    name: {
      m: t('trabajadores.oficios.sastreria.nombre.m'),
      f: t('trabajadores.oficios.sastreria.nombre.f'),
    },
    job: t('trabajadores.oficios.sastreria.trabajo'),
    gives: t('trabajadores.oficios.sastreria.da'),
  },
  alquimia: {
    name: {
      m: t('trabajadores.oficios.alquimia.nombre.m'),
      f: t('trabajadores.oficios.alquimia.nombre.f'),
    },
    job: t('trabajadores.oficios.alquimia.trabajo'),
    gives: t('trabajadores.oficios.alquimia.da'),
  },
  pintor: {
    name: {
      m: t('trabajadores.oficios.pintor.nombre.m'),
      f: t('trabajadores.oficios.pintor.nombre.f'),
    },
    job: t('trabajadores.oficios.pintor.trabajo'),
    gives: t('trabajadores.oficios.pintor.da'),
  },
};

export const TRADE_LIST = Object.keys(TRADES) as Trade[];

/** Los tres de siempre: vienen cada mañana del pueblo y vuelven a dormir a su casa. */
export const VILLAGE: Record<
  StaffId,
  { name: string; papel: string; sex: Sex; trade: Trade; skill: number; cita: string }
> = {
  cocinera: {
    name: t('trabajadores.pueblo.cocinera.nombre'),
    papel: t('trabajadores.pueblo.cocinera.papel'),
    sex: 'f',
    trade: 'cocina',
    skill: 4,
    cita: t('trabajadores.pueblo.cocinera.cita'),
  },
  bardo: {
    name: t('trabajadores.pueblo.bardo.nombre'),
    papel: t('trabajadores.pueblo.bardo.papel'),
    sex: 'm',
    trade: 'salon',
    skill: 4,
    cita: t('trabajadores.pueblo.bardo.cita'),
  },
  mozo: {
    name: t('trabajadores.pueblo.mozo.nombre'),
    papel: t('trabajadores.pueblo.mozo.papel'),
    sex: 'm',
    trade: 'bodega',
    skill: 3,
    cita: t('trabajadores.pueblo.mozo.cita'),
  },
};

/** Lo que dice quien viene a pedir trabajo. */
export const WORKER_QUOTES: readonly string[] = tl('trabajadores.citas_trabajadores');
