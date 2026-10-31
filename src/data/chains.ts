import type { QuestType, TrophyIcon } from '../core/model';
import type { BossKind } from './bosses';

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
  /** Jefe al final del paso: la pelea se puede ver. */
  boss?: BossKind;
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
        boss: 'bestia',
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
    id: 'caravana',
    name: 'La caravana de la sal',
    client: 'Casa Ferrán, salineros',
    rep: 55,
    intro:
      'La caravana de sal de los Ferrán no llegó a Levante: ni carros, ni mulas, ni un solo carretero. La familia paga lo que haga falta por saber qué pasó, y más si vuelve la sal.',
    steps: [
      {
        title: 'El último mesón',
        type: 'Investigar',
        place: 'el mesón de Levante',
        text: 'La caravana durmió en el mesón de Levante y salió de madrugada. El mesonero jura que no vio nada, pero tiene sal nueva en la despensa.',
        danger: 1,
      },
      {
        title: 'Rodadas en el desfiladero',
        type: 'Explorar',
        place: 'el desfiladero de las Cabras',
        text: 'Las rodadas de los carros se salen del camino y se meten en el desfiladero de las Cabras, por donde no pasa nadie con dos dedos de frente.',
        danger: 2,
      },
      {
        title: 'El campamento de los Tuertos',
        type: 'Recuperar',
        place: 'el campamento de los Tuertos',
        text: 'La banda de los Tuertos tiene la sal, las mulas y a los carreteros. Hay que traerlo todo de vuelta, empezando por los carreteros.',
        danger: 3,
      },
    ],
    ending:
      'Los carreteros están en casa y la sal, en su almacén. Los Ferrán han mandado al gremio un saco de sal, que en la cocina siempre viene bien, y una bolsa que viene mejor todavía.',
    reward: {
      gold: 400,
      rep: 14,
      item: 'Botas de siete leguas',
      trophy: {
        name: 'Estandarte de los Tuertos',
        desc: 'Un ojo tachado sobre fondo negro.',
        icon: 'estandarte',
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
  {
    id: 'ahogado',
    name: 'El Rey Ahogado',
    client: 'Cofradía de pescadores de Juncal',
    rep: 140,
    intro:
      'En Juncal las redes salen llenas de huesos y a medianoche se oye una campana bajo la laguna Negra. Los pescadores dicen que el rey que se ahogó allí hace cien años ha vuelto a reclamar su reino, y que de momento empieza por ellos.',
    steps: [
      {
        title: 'Redes llenas de huesos',
        type: 'Investigar',
        place: 'la aldea de Juncal',
        text: 'Los pescadores de Juncal sacan huesos con las redes y nadie quiere salir a faenar. Hay que saber de dónde vienen.',
        danger: 1,
      },
      {
        title: 'La campana del Fraile',
        type: 'Explorar',
        place: 'el islote del Fraile',
        text: 'En la capilla del islote del Fraile enterraron la corona del rey. Alguien ha abierto la tumba, y la campana ya no está en su torre.',
        danger: 2,
      },
      {
        title: 'El Rey Ahogado',
        type: 'Limpiar',
        place: 'la laguna Negra',
        text: 'La campana suena cada medianoche en el fondo de la laguna Negra. Ahí espera el rey, con su corona y sus ahogados. Toca devolverlo al fondo.',
        danger: 3,
        boss: 'ahogado',
      },
    ],
    ending:
      'La laguna Negra está en calma y en Juncal las redes vuelven a sacar peces, que huelen peor que los huesos pero se venden mejor. La campana del Fraile suena otra vez en su torre.',
    reward: {
      gold: 500,
      rep: 18,
      item: 'Corona del Rey Ahogado',
      trophy: {
        name: 'Ancla del Rey Ahogado',
        desc: 'Gotea aunque haga sol.',
        icon: 'calavera',
      },
    },
  },
  {
    id: 'sierpe',
    name: 'La sierpe de Sierra Parda',
    client: 'Abad Lope, monasterio de Peñalta',
    rep: 200,
    intro:
      'Arden los pastos de Sierra Parda y faltan rebaños enteros. El abad Lope, del monasterio de Peñalta, dice que es una sierpe: lo pone en sus libros y los libros no mienten. El pastor que la vio ya no dice nada; se ha ido a vivir al llano.',
    steps: [
      {
        title: 'Pastos quemados',
        type: 'Investigar',
        place: 'el paso del Lobo',
        text: 'En el paso del Lobo hay pastos quemados en círculo y huesos de oveja limpios como platos. Hay que mirarlo de cerca y contarlo despacio.',
        danger: 1,
      },
      {
        title: 'El bestiario del abad',
        type: 'Escoltar',
        place: 'el monasterio de Peñalta',
        text: 'El bestiario del abad explica cómo se mata una sierpe, pero el copista que lo trae no se atreve a subir solo al monasterio de Peñalta.',
        danger: 2,
      },
      {
        title: 'La sierpe de Sierra Parda',
        type: 'Cazar',
        place: 'la cueva de la Sierpe',
        text: 'Según el bestiario, la sierpe duerme en su cueva con la panza llena. Toca entrar con escudos, agua y mucho valor.',
        danger: 3,
        boss: 'sierpe',
      },
    ],
    ending:
      'La sierpe de Sierra Parda no quemará más pastos. El abad Lope ha añadido una página a su bestiario con el nombre del gremio, y los pastores vuelven a subir al monte.',
    reward: {
      gold: 650,
      rep: 22,
      item: 'Coraza de escamas de sierpe',
      trophy: {
        name: 'Cabeza de la sierpe',
        desc: 'Aún huele a humo.',
        icon: 'cabeza',
      },
    },
  },
  {
    id: 'ceniza',
    name: 'El jabalí de ceniza',
    client: 'Concejo de Carbonera',
    rep: 250,
    intro:
      'Los pinares del oeste arden cada luna llena y en Carbonera dicen que no es el fuego: es un jabalí gris como la ceniza, grande como un carro, que corre delante de las llamas. El concejo ha juntado todo lo que tiene para que alguien lo pare antes de que se queme el pueblo.',
    steps: [
      {
        title: 'Huellas en la ceniza',
        type: 'Investigar',
        place: 'la aldea de Carbonera',
        text: 'En Carbonera nadie duerme. Los carboneros han visto huellas del tamaño de un escudo alrededor de las carboneras. Que lo cuenten todo, aunque tiemblen.',
        danger: 2,
      },
      {
        title: 'Los pinares quemados',
        type: 'Explorar',
        place: 'los pinares quemados',
        text: 'Las huellas se pierden en los pinares quemados, donde el humo no se va nunca. Hay que encontrar la madriguera sin perderse ni asfixiarse.',
        danger: 2,
      },
      {
        title: 'El jabalí de ceniza',
        type: 'Cazar',
        place: 'la loma de Ceniza',
        text: 'El jabalí duerme en la loma de Ceniza, sobre las brasas de lo que quemó. Hay que subir con agua, buenas pieles y la espada afilada.',
        danger: 3,
        boss: 'jabali',
      },
    ],
    ending:
      'El jabalí de ceniza no volverá a correr delante del fuego. En Carbonera han vuelto a encender las carboneras, y esta vez solo humean lo que deben.',
    reward: {
      gold: 750,
      rep: 25,
      item: 'Capa de piel de ceniza',
      trophy: {
        name: 'Colmillos del jabalí de ceniza',
        desc: 'Todavía calientes.',
        icon: 'colmillos',
      },
    },
  },
  {
    id: 'sanvela',
    name: 'La Reina de la Cripta',
    client: 'Prior Anselmo de Sanvela',
    rep: 320,
    intro:
      'Bajo el priorato de Sanvela duerme una reina que nadie recuerda. Alguien la ha despertado: los monjes oyen pasos en las catacumbas y los muertos del cementerio no están donde los dejaron. El prior Anselmo pide al gremio más famoso de la comarca que baje por ella.',
    steps: [
      {
        title: 'Los monjes que no duermen',
        type: 'Escoltar',
        place: 'el priorato de Sanvela',
        text: 'Los monjes de Sanvela quieren sacar los libros del priorato antes de que suba lo que hay abajo. Hay que llevarlos hasta el camino con los libros y la cabeza en su sitio.',
        danger: 2,
      },
      {
        title: 'Las catacumbas de Sanvela',
        type: 'Limpiar',
        place: 'las catacumbas de Sanvela',
        text: 'Las catacumbas están llenas de muertos que se levantan. Hay que abrir paso hasta la puerta de la cripta, y que no se cierre a la espalda.',
        danger: 3,
      },
      {
        title: 'La Reina de la Cripta',
        type: 'Limpiar',
        place: 'la cripta de la Reina',
        text: 'La Reina espera en su trono con su corte de huesos. Toca devolverla a su sueño, para siempre.',
        danger: 3,
        boss: 'reina',
      },
    ],
    ending:
      'La Reina de la Cripta vuelve a dormir, y esta vez con la puerta tapiada. El prior Anselmo ha mandado grabar el escudo del gremio en la piedra, por si alguien vuelve a tener la tentación.',
    reward: {
      gold: 900,
      rep: 30,
      item: 'Cetro de la Reina',
      trophy: {
        name: 'Corona de la Reina de la Cripta',
        desc: 'Pesa como una losa.',
        icon: 'idolo',
      },
    },
  },
  {
    id: 'corona',
    name: 'La dragona de la Corona Blanca',
    client: 'Los tres pueblos del norte',
    rep: 420,
    intro:
      'Del pico de la Corona Blanca baja un viento que hiela los ríos en verano. Los pastores de Nevaza han visto una dragona blanca sobre el glaciar, y los tres pueblos del norte se han puesto de acuerdo por primera vez en cien años: que vaya el gremio de leyenda.',
    steps: [
      {
        title: 'El refugio de Nevaza',
        type: 'Escoltar',
        place: 'el refugio de Nevaza',
        text: 'El guía de Nevaza es el único que conoce el paso, pero no sube solo después de lo que vio. Hay que llevarlo hasta el refugio, con la nieve hasta la cintura.',
        danger: 2,
      },
      {
        title: 'El lago Helado',
        type: 'Explorar',
        place: 'el lago Helado',
        text: 'Al pie del glaciar, el lago Helado guarda en el hielo a los que subieron antes. Hay que cruzarlo sin quedarse con ellos.',
        danger: 3,
      },
      {
        title: 'La dragona de la Corona Blanca',
        type: 'Cazar',
        place: 'la Corona Blanca',
        text: 'La dragona duerme en la cumbre, enroscada sobre un tesoro de siglos. Su aliento hiela la sangre. Es lo más difícil que se ha pedido nunca en el tablón.',
        danger: 3,
        boss: 'dragona',
      },
    ],
    ending:
      'La dragona de la Corona Blanca ha caído y los ríos del norte corren otra vez. Los tres pueblos han hecho una canción con el nombre del gremio, y se canta en todas las tabernas. Hasta en la tuya.',
    reward: {
      gold: 1200,
      rep: 40,
      item: 'Escudo de escama blanca',
      trophy: { name: 'Cabeza de la dragona blanca', desc: 'Escarcha la pared.', icon: 'cabeza' },
    },
  },
];
