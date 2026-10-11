import type { Sex } from '../art/heroes/hero';
import type { OutfitId } from '../art/heroes/layers';
import type { SceneHeroStatus } from '../art/tavern/scene';
import type { Facilities } from '../art/tavern/layout';

/**
 * Datos de ejemplo para la fase 0: los mismos personajes del mockup.
 * En la fase 1 los sustituye el estado real de la partida.
 */
export interface DemoHero {
  id: string;
  name: string;
  nick?: string;
  sex: Sex;
  cls: Exclude<OutfitId, 'tabernero'>;
  lvl: number;
  status: SceneHeroStatus;
  traits: string[];
  eyepatch?: boolean;
  days?: number;
}

export const CLASS_NAMES: Record<DemoHero['cls'], { m: string; f: string }> = {
  guerrero: { m: 'Guerrero', f: 'Guerrera' },
  picaro: { m: 'Pícaro', f: 'Pícara' },
  mago: { m: 'Mago', f: 'Maga' },
  clerigo: { m: 'Clérigo', f: 'Clériga' },
  explorador: { m: 'Explorador', f: 'Exploradora' },
};

export const STATUS_LABEL: Record<SceneHeroStatus, string> = {
  ok: 'En la sala',
  herido: 'Guarda cama',
  mision: 'De misión',
  candidato: 'Busca trabajo',
};

export const DEMO_HEROES: DemoHero[] = [
  {
    id: 'brom',
    name: 'Brom',
    nick: 'el Tuerto',
    sex: 'm',
    cls: 'guerrero',
    lvl: 3,
    status: 'herido',
    traits: ['Valiente', 'Bebedor', 'Tuerto'],
    eyepatch: true,
    days: 3,
  },
  {
    id: 'lysa',
    name: 'Lysa Vel',
    sex: 'f',
    cls: 'picaro',
    lvl: 2,
    status: 'ok',
    traits: ['Codiciosa', 'Afortunada'],
  },
  {
    id: 'maren',
    name: 'Maren',
    sex: 'f',
    cls: 'clerigo',
    lvl: 2,
    status: 'ok',
    traits: ['Leal', '¿?'],
  },
  {
    id: 'toby',
    name: 'Tobías',
    sex: 'm',
    cls: 'explorador',
    lvl: 1,
    status: 'mision',
    traits: ['Cobarde', '¿?'],
    days: 2,
  },
  {
    id: 'isolde',
    name: 'Isolde Brasa',
    sex: 'f',
    cls: 'mago',
    lvl: 2,
    status: 'candidato',
    traits: ['Arrogante', '¿?'],
  },
  {
    id: 'garr',
    name: 'Garr',
    nick: 'Pedrusco',
    sex: 'm',
    cls: 'guerrero',
    lvl: 1,
    status: 'candidato',
    traits: ['Leal', '¿?'],
  },
  {
    id: 'nim',
    name: 'Nim',
    sex: 'f',
    cls: 'explorador',
    lvl: 1,
    status: 'candidato',
    traits: ['Gafe', '¿?'],
  },
];

export const DEMO_FACILITIES: Facilities = { dorm: 2, enf: 0, tab: 1 };

export const DEMO_QUESTS = [
  {
    id: 'q1',
    title: 'Ratas en la bodega del molino',
    client: 'Ilario, molinero',
    reward: 60,
    danger: 'Bajo',
  },
  {
    id: 'q2',
    title: 'El puente de los ahorcados',
    client: 'Gremio de mercaderes',
    reward: 180,
    danger: 'Medio',
  },
  {
    id: 'q3',
    title: 'Lo que suena en la cripta de Valdeloro',
    client: 'Hermana Odile, templo',
    reward: 320,
    danger: 'Alto',
  },
  {
    id: 'q4',
    title: 'Un tal Corvo busca a alguien discreto',
    client: 'Desconocido',
    reward: 240,
    danger: '¿?',
  },
];

export const FACILITY_INFO: Record<keyof Facilities, { name: string; levels: string[] }> = {
  dorm: {
    name: 'Dormitorios',
    levels: [
      'En ruinas: paja en el suelo',
      '2 literas · 4 héroes',
      '3 literas · 6 héroes',
      '4 literas con colchas · 8 héroes',
    ],
  },
  enf: {
    name: 'Enfermería',
    levels: [
      'Cerrada: los heridos van a las literas',
      '1 camilla y una vela',
      '2 camillas y hierbas',
      '2 camillas y botica',
    ],
  },
  tab: {
    name: 'Taberna',
    levels: [
      'En ruinas: chimenea apagada',
      'Una mesa y lo justo',
      'Dos mesas, barriles y faroles',
      'Manteles, trofeo de caza y estandarte',
    ],
  },
};
