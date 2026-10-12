import type { QuestType, TrophyIcon } from '../core/model';

/**
 * Cadenas de misiones: historias de varios encargos enlazados. Cada paso aparece en el
 * tablón al cumplir el anterior; si sale mal, la historia se tuerce y el paso vuelve más
 * difícil. El último paso da un premio único.
 */

export interface ChainStep {
  title: string;
  type: QuestType;
  place: string;
  text: string;
  danger: 0 | 1 | 2 | 3;
}

export interface ChainDef {
  id: string;
  name: string;
  client: string;
  /** Reputación necesaria para que llegue la carta. */
  rep: number;
  intro: string;
  steps: readonly ChainStep[];
  ending: string;
  reward: {
    gold: number;
    rep: number;
    item: string;
    trophy?: { name: string; desc: string; icon: TrophyIcon };
    revealMap?: boolean;
  };
}

export const CHAINS: readonly ChainDef[] = [
  {
    id: 'hondogris',
    name: 'La sombra de Hondogrís',
    client: 'Alcaldía de Hondogrís',
    rep: 8,
    intro:
      'Algo baja de las minas por la noche y se lleva las cabras. Luego, a los pastores. El alcalde de Hondogrís paga bien a quien llegue al fondo del asunto… y no hace preguntas sobre el método.',
    steps: [
      {
        title: 'Rumores en el vado',
        type: 'Investigar',
        place: 'el vado',
        text: 'Los barqueros del vado vieron pasar algo enorme río arriba. Que lo cuenten con detalle.',
        danger: 1,
      },
      {
        title: 'El mapa del capataz',
        type: 'Recuperar',
        place: 'la posada del Cuervo',
        text: 'El capataz de la mina dejó un mapa de las galerías en prenda en la posada del Cuervo. El posadero no quiere soltarlo.',
        danger: 1,
      },
      {
        title: 'Las galerías de la mina vieja',
        type: 'Explorar',
        place: 'la mina vieja',
        text: 'Con el mapa en la mano, hay que bajar a la mina vieja y encontrar la guarida.',
        danger: 2,
      },
      {
        title: 'La bestia de Hondogrís',
        type: 'Cazar',
        place: 'Hondogrís',
        text: 'Ya se sabe dónde duerme. Ahora hay que despertarla, y que no sea lo último que se haga.',
        danger: 3,
      },
    ],
    ending:
      'La bestia de Hondogrís no volverá a bajar de las minas. En el pueblo han puesto el nombre del gremio a una calle. Bueno, a un callejón.',
    reward: {
      gold: 250,
      rep: 12,
      item: 'Hoja de Vadoverde',
      trophy: {
        name: 'Cabeza de la bestia de Hondogrís',
        desc: 'Ocupa media pared.',
        icon: 'cabeza',
      },
    },
  },
  {
    id: 'ormaz',
    name: 'El culto de Ormaz',
    client: 'Hermana Odile, templo',
    rep: 35,
    intro:
      'En el cementerio de Ormaz las tumbas aparecen abiertas desde dentro. La hermana Odile cree que alguien está celebrando ritos que no son los suyos, y quiere que paren antes de la luna nueva.',
    steps: [
      {
        title: 'Tumbas abiertas',
        type: 'Investigar',
        place: 'el cementerio de Ormaz',
        text: 'Hay que pasar la noche en el cementerio y ver quién entra… o quién sale.',
        danger: 1,
      },
      {
        title: 'La testigo de la ermita',
        type: 'Escoltar',
        place: 'la ermita',
        text: 'Una novicia lo vio todo y el culto lo sabe. Hay que llevarla a la ermita sana y salva.',
        danger: 2,
      },
      {
        title: 'La cripta de Ormaz',
        type: 'Limpiar',
        place: 'el cementerio de Ormaz',
        text: 'Bajo la capilla del cementerio hay una cripta que no sale en ningún plano. Ahí se reúnen.',
        danger: 3,
      },
    ],
    ending:
      'La cripta está sellada y el culto, disperso. La hermana Odile ha bendecido la puerta de El Jarro Partido. Las cucarachas se han ido; los clientes, no.',
    reward: {
      gold: 300,
      rep: 15,
      item: 'Varita de la Abuela Tormenta',
      trophy: {
        name: 'Máscara del sumo sacerdote',
        desc: 'Nadie quiere ponérsela.',
        icon: 'mascara',
      },
    },
  },
  {
    id: 'canal',
    name: 'Contrabando en el canal',
    client: 'Gremio de mercaderes',
    rep: 70,
    intro:
      'Desaparecen barcazas enteras entre el molino y la casa del canal. El gremio de mercaderes sospecha de contrabandistas con amigos en sitios altos, y prefiere a alguien de fuera para meter las narices.',
    steps: [
      {
        title: 'Lo que flota en el canal',
        type: 'Investigar',
        place: 'la casa del canal',
        text: 'Los guardas de la casa del canal no ven nada, no oyen nada y viven muy bien. Curioso.',
        danger: 1,
      },
      {
        title: 'El cargamento señuelo',
        type: 'Escoltar',
        place: 'el molino',
        text: 'Un cargamento falso, bien a la vista, hasta el molino. Si pican, sabremos quiénes son.',
        danger: 2,
      },
      {
        title: 'El escondite del pantano',
        type: 'Limpiar',
        place: 'el pantano de las ranas',
        text: 'Los contrabandistas guardan el botín en el pantano. Toca ir a buscarlo, con barro hasta las cejas.',
        danger: 3,
      },
    ],
    ending:
      'Las barcazas vuelven a llegar a su destino y el gremio de mercaderes paga lo prometido, con una propina que olía a remordimiento.',
    reward: { gold: 450, rep: 12, item: 'Capa élfica' },
  },
  {
    id: 'torre',
    name: 'Los secretos de la torre caída',
    client: 'Maese Quirico, erudito',
    rep: 110,
    intro:
      'Maese Quirico jura que la torre caída fue el observatorio de un mago que cartografió toda la comarca. Si encontráis su obra, os deja copiarla. Y os paga, que es lo importante.',
    steps: [
      {
        title: 'El camino de los riscos',
        type: 'Explorar',
        place: 'los riscos',
        text: 'Para llegar a la torre hay que cruzar los riscos por un sendero que ya no existe.',
        danger: 2,
      },
      {
        title: 'El diario del astrónomo',
        type: 'Recuperar',
        place: 'la torre caída',
        text: 'En lo que queda de la biblioteca debería estar su diario. Debería.',
        danger: 2,
      },
      {
        title: 'El sótano de la torre',
        type: 'Limpiar',
        place: 'la torre caída',
        text: 'El diario habla de un sótano y de «los que guardan los mapas». No suena bien.',
        danger: 3,
      },
    ],
    ending:
      'Los mapas del astrónomo cubren cada rincón de la comarca. Ya no queda niebla en el mapa del desván, y Maese Quirico llora de alegría encima de ellos.',
    reward: { gold: 350, rep: 18, item: 'Varita de serbal', revealMap: true },
  },
];
