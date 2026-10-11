import type { Danger, Facilities, Hero, Outcome } from '../core/model';
import type { ClassId } from '../core/party';

/** Textos de la interfaz que dependen de los datos del juego. */

export const CLASS_NAMES: Record<ClassId, { m: string; f: string }> = {
  guerrero: { m: 'Guerrero', f: 'Guerrera' },
  picaro: { m: 'Pícaro', f: 'Pícara' },
  mago: { m: 'Mago', f: 'Maga' },
  clerigo: { m: 'Clérigo', f: 'Clériga' },
  explorador: { m: 'Explorador', f: 'Exploradora' },
};

export const DANGER_LABELS = ['Bajo', 'Medio', 'Alto', 'Letal'] as const;
export const dangerClass = (d: Danger, hidden?: boolean) =>
  hidden ? 'x' : ['bajo', 'medio', 'alto', 'letal'][d]!;
export const dangerLabel = (d: Danger, hidden?: boolean) =>
  hidden ? '¿?' : DANGER_LABELS[d].toLowerCase();

/** Estado visible de un héroe (los candidatos no son del gremio todavía). */
export type ViewStatus = Hero['status'] | 'candidato';

export function statusLabel(h: Hero, candidate = false): string {
  const a = (m: string, f: string) => (h.sex === 'f' ? f : m);
  if (candidate) return 'Busca trabajo';
  switch (h.status) {
    case 'ok':
      return 'Disponible';
    case 'mision':
      return `De misión · ${h.days} d`;
    case 'herido':
      return `${a('Herido', 'Herida')} · ${h.days} d`;
    case 'desaparecido':
      return a('Desaparecido', 'Desaparecida');
    case 'muerto':
      return a('Caído', 'Caída');
  }
}

export const OUTCOME_CLASS: Record<Outcome, string> = {
  'Éxito brillante': 'win',
  Éxito: 'win',
  'Éxito parcial': 'mid',
  Fracaso: 'lose',
  Desastre: 'lose',
};

export const FACILITY_INFO: Record<
  keyof Facilities,
  { name: string; room: string; levels: string[]; effect: (l: number) => string }
> = {
  dorm: {
    name: 'Dormitorios',
    room: 'dormitorios',
    levels: [
      'En ruinas: paja en el suelo',
      '2 literas',
      '3 literas y cortinas',
      '4 literas con colchas, farol y banderines',
    ],
    effect: (l) => `Caben ${2 + 2 * l} héroes`,
  },
  enf: {
    name: 'Enfermería',
    room: 'enfermeria',
    levels: [
      'Cerrada y llena de trastos',
      '1 camilla y una vela',
      '2 camillas, farol y hierbas secándose',
      '2 camillas y botica con pociones',
    ],
    effect: (l) =>
      l === 0 ? 'Las heridas curan a su ritmo' : `Las heridas curan ${l + 1} veces más rápido`,
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
    effect: (l) =>
      l === 0
        ? 'No deja dinero'
        : `${l * 10} monedas al día, más encargos${l >= 2 ? ' y mejores candidatos' : ''}`,
  },
};

/** Lo que dice cada cosa de la escena al tocarla. */
export const CAPTIONS: Record<string, string> = {
  gato: 'Bigotes ronronea. Es el verdadero dueño de la taberna.',
  buho: '¡Uh-uuuh! Vigila el tejado desde que tu tío no está.',
  murcielago: '¡Murciélagos! Pagan poco alquiler, pero lo pagan.',
  rata: 'Una rata. Bigotes ni se inmuta.',
  retrato: 'Tío Fausto. Te dejó la taberna… y mil monedas de deuda.',
  pozo: '¡Plof! Dicen que concede deseos a quien paga sus deudas.',
  letrero: 'El Jarro Partido. Tu tío juraba que lo arreglaría.',
  puerta: 'Por aquí salen los grupos… y por aquí vuelven, si vuelven.',
  laud: 'Alguien lo dejó a cuenta de una ronda. Todavía suena bien.',
  chimenea: 'Chisporrotea. Bigotes no se separa de ella.',
  chimeneaFria: 'Fría como el corazón del prestamista.',
};
