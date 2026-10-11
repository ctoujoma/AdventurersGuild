import { generateLook, type HeroLook, type OutfitId, type Sex } from '../art/heroes/look';
import type { Facilities } from '../world/geometry';
import type { HeroStatus, SceneHero } from '../world/scene';

/**
 * Datos de ejemplo de la fase 0: los personajes del mockup. En la fase 1 los sustituye
 * el estado real de la partida.
 */

export type ClassId = Exclude<OutfitId, 'tabernero'>;

export interface DemoHero {
  id: string;
  name: string;
  nick?: string;
  sex: Sex;
  cls: ClassId;
  lvl: number;
  status: HeroStatus;
  traits: string[];
  eyepatch?: boolean;
  days?: number;
  fee?: number;
  salary: number;
  quote?: string;
}

export const CLASS_NAMES: Record<ClassId, { m: string; f: string }> = {
  guerrero: { m: 'Guerrero', f: 'Guerrera' },
  picaro: { m: 'Pícaro', f: 'Pícara' },
  mago: { m: 'Mago', f: 'Maga' },
  clerigo: { m: 'Clérigo', f: 'Clériga' },
  explorador: { m: 'Explorador', f: 'Exploradora' },
};

export const STATUS_LABEL: Record<HeroStatus, string> = {
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
    salary: 20,
  },
  {
    id: 'lysa',
    name: 'Lysa Vel',
    sex: 'f',
    cls: 'picaro',
    lvl: 2,
    status: 'ok',
    traits: ['Codiciosa', 'Afortunada'],
    salary: 18,
  },
  {
    id: 'maren',
    name: 'Maren',
    sex: 'f',
    cls: 'clerigo',
    lvl: 2,
    status: 'ok',
    traits: ['Leal', '¿?'],
    salary: 16,
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
    salary: 12,
  },
  {
    id: 'isolde',
    name: 'Isolde Brasa',
    sex: 'f',
    cls: 'mago',
    lvl: 2,
    status: 'candidato',
    traits: ['Arrogante', '¿?'],
    fee: 80,
    salary: 25,
    quote: '«Cobro por adelantado. Y no me llames bruja.»',
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
    fee: 50,
    salary: 15,
    quote: '«¿A quién hay que pegar?»',
  },
  {
    id: 'nim',
    name: 'Nim',
    sex: 'f',
    cls: 'explorador',
    lvl: 1,
    status: 'candidato',
    traits: ['Gafe', '¿?'],
    fee: 30,
    salary: 10,
    quote: '«Lo de gafe son rumores. Casi todos.»',
  },
];

export function lookOf(h: DemoHero): HeroLook {
  return generateLook(h.id, h.cls, h.sex);
}

export function toSceneHero(h: DemoHero): SceneHero {
  return {
    id: h.id,
    name: h.nick ? `${h.name} ${h.nick}` : h.name,
    status: h.status,
    look: lookOf(h),
    marks: { injured: h.status === 'herido', eyepatch: h.eyepatch },
  };
}

export const DEMO_FACILITIES: Facilities = { dorm: 2, enf: 0, tab: 1 };

export interface DemoQuest {
  id: string;
  title: string;
  client: string;
  text: string;
  reward: number;
  danger: 'Bajo' | 'Medio' | 'Alto' | '¿?';
  days: number;
  challenges: string[];
}

export const DEMO_QUESTS: DemoQuest[] = [
  {
    id: 'q1',
    title: 'Ratas en la bodega del molino',
    client: 'Ilario, molinero',
    text: '«Son ratas, pero grandes. Muy grandes. Bueno, una.»',
    reward: 60,
    danger: 'Bajo',
    days: 1,
    challenges: ['Combate 7'],
  },
  {
    id: 'q2',
    title: 'El puente de los ahorcados',
    client: 'Gremio de mercaderes',
    text: 'Tres carros de lana deben cruzar antes de la feria. Los dos últimos no llegaron.',
    reward: 180,
    danger: 'Medio',
    days: 2,
    challenges: ['Combate 13', 'Trampas 9'],
  },
  {
    id: 'q3',
    title: 'Lo que suena en la cripta de Valdeloro',
    client: 'Hermana Odile, templo',
    text: 'Desde hace una semana suenan campanas bajo tierra. La cripta no tiene campanas.',
    reward: 320,
    danger: 'Alto',
    days: 3,
    challenges: ['Arcano 16', 'Combate 14', 'Trampas 10'],
  },
  {
    id: 'q4',
    title: 'Un tal Corvo busca a alguien discreto',
    client: 'Desconocido',
    text: 'Una caja, una casa vacía, ninguna pregunta. Paga la mitad por adelantado.',
    reward: 240,
    danger: '¿?',
    days: 2,
    challenges: ['Trampas 13', 'Supervivencia 8'],
  },
];

export const FACILITY_INFO: Record<
  keyof Facilities,
  { name: string; room: string; levels: string[] }
> = {
  dorm: {
    name: 'Dormitorios',
    room: 'dormitorios',
    levels: [
      'En ruinas: paja en el suelo',
      '2 literas · 4 héroes',
      '3 literas y cortinas · 6 héroes',
      '4 literas con colchas, farol y banderines · 8 héroes',
    ],
  },
  enf: {
    name: 'Enfermería',
    room: 'enfermeria',
    levels: [
      'Cerrada y llena de trastos: los heridos van a las literas',
      '1 camilla y una vela',
      '2 camillas, farol y hierbas secándose',
      '2 camillas y botica con pociones',
    ],
  },
  tab: {
    name: 'Taberna',
    room: 'sala',
    levels: [
      'En ruinas: chimenea apagada y telarañas',
      'Una mesa, un farol y lo justo',
      'Dos mesas, barriles, apliques, diana y caldero',
      'Manteles, trofeo, laúd, candelabro y fuego grande',
    ],
  },
};

/** Lo que dice cada cosa al tocarla. */
export const CAPTIONS: Record<string, string> = {
  gato: 'Bigotes ronronea. Es el verdadero dueño de la taberna.',
  buho: '¡Uh-uuuh! Vigila el tejado desde que tu tío no está.',
  murcielago: '¡Murciélagos! Pagan poco alquiler, pero lo pagan.',
  rata: 'Una rata. Bigotes ni se inmuta.',
  retrato: 'Tío Fausto. Te dejó la taberna… y mil monedas de deuda.',
  mapa: 'El mapa de la región. Pronto: mandar expediciones desde aquí.',
  pozo: '¡Plof! Dicen que concede deseos a quien paga sus deudas.',
  letrero: 'El Jarro Partido. Tu tío juraba que lo arreglaría.',
  puerta: 'Fuera solo hay noche. Por ahora.',
  laud: 'Alguien lo dejó a cuenta de una ronda. Todavía suena bien.',
  chimenea: 'Chisporrotea. Bigotes no se separa de ella.',
  chimeneaFria: 'Fría como el corazón del prestamista.',
};
