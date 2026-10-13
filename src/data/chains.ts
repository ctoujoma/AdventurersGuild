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
      'Algo baja de las minas por la noche y se lleva las cabras. La semana pasada se llevó a un pastor. El alcalde de Hondogrís paga bien a quien lo resuelva, y le da igual cómo.',
    steps: [
      {
        title: 'Rumores en la posada',
        type: 'Investigar',
        place: 'la posada del Cuervo',
        text: 'Los arrieros que paran en la posada del Cuervo vieron cruzar algo enorme camino de la sierra. Que lo cuenten con detalle.',
        danger: 1,
      },
      {
        title: 'El mapa del capataz',
        type: 'Recuperar',
        place: 'Hondogrís',
        text: 'El capataz de la mina dejó un mapa de las galerías en prenda en la cantina de Hondogrís. El cantinero no quiere soltarlo.',
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
        place: 'el vado',
        text: 'Las huellas de la guarida bajan cada noche a beber al vado. Toca esperarla allí, y mejor con buenas armas.',
        danger: 3,
      },
    ],
    ending:
      'La bestia de Hondogrís no volverá a bajar de las minas. En el pueblo le han puesto el nombre del gremio a un callejón, que calles no les sobran.',
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
      'En el cementerio de Ormaz aparecen tumbas abiertas desde dentro. La hermana Odile sospecha de algún culto y quiere que se acabe antes de la luna nueva.',
    steps: [
      {
        title: 'La testigo de la ermita',
        type: 'Escoltar',
        place: 'la ermita',
        text: 'Una novicia vio a los encapuchados abrir las tumbas y el culto lo sabe. Hay que llevarla a la ermita sana y salva.',
        danger: 1,
      },
      {
        title: 'Velas negras en el granero',
        type: 'Investigar',
        place: 'el granero de los Cardo',
        text: 'La novicia dice que los encapuchados guardan palas y velas negras en el granero de los Cardo. Hay que pasar la noche allí y seguirlos.',
        danger: 2,
      },
      {
        title: 'La cripta de Ormaz',
        type: 'Limpiar',
        place: 'el cementerio de Ormaz',
        text: 'Los encapuchados llevaron hasta una cripta bajo la capilla del cementerio que no sale en ningún plano. Ahí se reúnen.',
        danger: 3,
      },
    ],
    ending:
      'La cripta está sellada y el culto, disperso. La hermana Odile vino a bendecir la puerta de El Jarro Partido, y de paso se tomó un vino.',
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
      'Desaparecen barcazas enteras entre el molino y la casa del canal. El gremio de mercaderes sospecha de unos contrabandistas con buenos padrinos y prefiere que meta las narices alguien de fuera.',
    steps: [
      {
        title: 'Lo que se oye en el molino',
        type: 'Investigar',
        place: 'el molino',
        text: 'Del molino salen las barcazas cargadas y algunas no llegan. El molinero las ve pasar todas y sabe más de lo que cuenta.',
        danger: 1,
      },
      {
        title: 'El cargamento señuelo',
        type: 'Escoltar',
        place: 'la casa del canal',
        text: 'Un cargamento falso, bien a la vista, del molino a la casa del canal, donde los guardas estrenan botas cada mes. Si pican, sabremos quiénes son.',
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
      'Las barcazas vuelven a llegar a su destino y el gremio de mercaderes paga lo prometido sin regatear, que ya es mucho.',
    reward: { gold: 450, rep: 12, item: 'Capa élfica' },
  },
  {
    id: 'torre',
    name: 'Los secretos de la torre caída',
    client: 'Maese Quirico, erudito',
    rep: 110,
    intro:
      'Maese Quirico jura que la torre caída fue el observatorio de un mago que cartografió toda la comarca. Si encontráis sus mapas, os deja copiarlos, y además paga bien.',
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
        text: 'En lo que queda de la biblioteca tendría que estar su diario, si no se lo han comido las ratas.',
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
      'Los mapas del astrónomo cubren cada rincón de la comarca. Ya no queda niebla en el mapa del desván, y Maese Quirico no se despega de ellos ni para comer.',
    reward: { gold: 350, rep: 18, item: 'Varita de serbal', revealMap: true },
  },
];
