import type { Danger, Facilities, Hero, Outcome } from '../core/model';
import type { ClassId, MoraleBand } from '../core/party';

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
      'Gran salón: alfombra roja, dos candelabros y barra dorada',
    ],
    effect: (l) =>
      l === 0
        ? 'No deja dinero'
        : `${l * 10} monedas al día, más encargos${l >= 2 ? ' y mejores candidatos' : ''}${l >= 4 ? '; descansar anima del todo' : ''}`,
  },
  mapas: {
    name: 'Sala de mapas',
    room: 'despacho',
    levels: [
      'Un mapa viejo clavado en el desván',
      'Mesa de cartografía y mapas de la comarca',
      'Catalejo, globo y rutas marcadas con hilo rojo',
    ],
    effect: (l) =>
      l === 0
        ? 'Sin efecto'
        : `+${l} ${l === 1 ? 'encargo' : 'encargos'} en el tablón${l >= 2 ? '; ves el peligro real de todos' : ''}`,
  },
  arm: {
    name: 'Armería',
    room: 'armeria',
    levels: [
      'Cuatro espadas oxidadas en la bodega',
      'Armero con lanzas, espadas y escudos',
      'Armaduras, yunque y piedra de afilar',
    ],
    effect: (l) =>
      l === 0
        ? 'Cada cual va con lo suyo'
        : l === 1
          ? '+1 Combate a todos'
          : '+1 Combate, Trampas y Supervivencia a todos',
  },
  cap: {
    name: 'Capilla',
    room: 'capilla',
    levels: [
      'No hay: se reza donde se puede',
      'Anexo de piedra con altar y una vela por cada caído',
      'Campana, vidriera y bancos',
    ],
    effect: (l) =>
      l === 0
        ? 'Sin efecto'
        : `Moral +${2 * l} por noche, los desaparecidos vuelven más${l >= 2 ? ' y los caídos duelen la mitad' : ''}`,
  },
  forja: {
    name: 'Forja',
    room: 'forja',
    levels: [
      'No hay: el herrero del pueblo cobra caro',
      'Cobertizo con fragua, yunque y fuelle',
      'Fragua grande con chimenea y armero',
    ],
    effect: (l) => (l === 0 ? 'Sin efecto' : `+${l} al objeto que lleva puesto cada héroe`),
  },
  establo: {
    name: 'Establo',
    room: 'establo',
    levels: ['No hay: se va a pie', 'Cuadra con dos caballos', 'Cuadra grande y carro'],
    effect: (l) =>
      l === 0
        ? 'Sin efecto'
        : `Un día menos en viajes de 3 o más días${l >= 2 ? '; las escoltas pagan un 25 % más' : ''}`,
  },
  patio: {
    name: 'Patio de entrenamiento',
    room: 'patio-entreno',
    levels: ['No hay', 'Muñecos de paja junto al camino', 'Muñecos, diana y armero de prácticas'],
    effect: (l) =>
      l === 0 ? 'Sin efecto' : `+${[0, 6, 12][l]} de experiencia por noche a quien descansa`,
  },
  empal: {
    name: 'Empalizada',
    room: 'empalizada',
    levels: ['No hay', 'Estacas afiladas cerrando el patio', 'Empalizada doble con pasarela'],
    effect: (l) =>
      l === 0 ? 'Sin efecto' : `+${[0, 5, 10][l]} a la defensa si asaltan la taberna`,
  },
  torre: {
    name: 'Torre del vigía',
    room: 'torre',
    levels: ['No hay', 'Torre de madera con farol', 'Torre alta con campana y estandarte'],
    effect: (l) =>
      l === 0
        ? 'Sin efecto'
        : `Siempre hay chivatazo de los asaltos${l >= 2 ? '; un encargo más en el tablón' : ''}`,
  },
  vet: {
    name: 'Ala de veteranos',
    room: 'veteranos',
    levels: ['No hay', 'Cuartos con ventana para los veteranos', 'Ala con balcón y sus trofeos'],
    effect: (l) =>
      l === 0
        ? 'Sin efecto'
        : `Héroes de nivel 4 o más: +${[0, 4, 8][l]} de moral por noche y más tope${l >= 2 ? '; nunca desertan' : ''}`,
  },
};

/** Lo que dice cada cosa de la escena al tocarla. */
export const CAPTIONS: Record<string, string> = {
  gato: 'Bigotes ronronea. Lleva aquí más años que tú.',
  buho: '¡Uh-uuuh! Vigila el tejado desde que tu tío no está.',
  murcielago: '¡Murciélagos! Al menos se comen los mosquitos.',
  rata: 'Una rata. Bigotes ni se inmuta.',
  retrato: 'El tío Fausto. Te dejó la taberna y mil monedas de deuda.',
  pozo: '¡Plof! Dicen que echar una moneda da suerte. A ti no te sobran.',
  letrero: 'El Jarro Partido. Tu tío juraba que lo arreglaría.',
  puerta: 'Por aquí salen los grupos. La bisagra de abajo chirría.',
  laud: 'Alguien lo dejó a cuenta de una ronda. Todavía suena bien.',
  chimenea: 'Chisporrotea. Bigotes no se separa de ella.',
  chimeneaFria: 'Apagada. Hace falta leña, y la leña cuesta.',
};

/** Cómo se enseña cada tramo de moral. */
export const MORALE_INFO: Record<
  MoraleBand,
  { label: { m: string; f: string }; short: string; desc: string }
> = {
  animado: {
    label: { m: 'Animado.', f: 'Animada.' },
    short: '+1',
    desc: '+1 a todas las habilidades.',
  },
  normal: {
    label: { m: 'Tranquilo.', f: 'Tranquila.' },
    short: '',
    desc: 'Descansar en la taberna le sube la moral; mejorarla, más.',
  },
  desanimado: {
    label: { m: 'Desanimado.', f: 'Desanimada.' },
    short: '−1',
    desc: '−1 a todas las habilidades. Puede pedirte un aumento.',
  },
  harto: {
    label: { m: 'Harto.', f: 'Harta.' },
    short: '−1',
    desc: '−1 a todo y puede irse cualquier noche. Déjale descansar o súbele el sueldo.',
  },
};
