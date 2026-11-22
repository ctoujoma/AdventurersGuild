import type { QuestType, TrophyIcon } from '../core/model';
import type { BossKind } from './bosses';
import { msg, type Txt } from '../textos';

/**
 * Cadenas de misiones: historias de varios encargos enlazados. Cada paso aparece en el
 * tablón al cumplir el anterior; si sale mal, la historia se tuerce y el paso vuelve más
 * difícil. El último paso da un premio único.
 */

export interface ChainStep {
  title: Txt;
  type: QuestType;
  place: string;
  text: Txt;
  danger: 0 | 1 | 2 | 3;
  /** Jefe al final del paso: la pelea se puede ver. */
  boss?: BossKind;
}

export interface ChainDef {
  id: string;
  name: Txt;
  /** Id del cliente (`encargos.clientes.<id>`). */
  client: string;
  /** Reputación necesaria para que llegue la carta. */
  rep: number;
  intro: Txt;
  steps: readonly ChainStep[];
  ending: Txt;
  reward: {
    gold: number;
    rep: number;
    /** El legendario del premio (su nombre en el catálogo). */
    item: Txt;
    trophy?: { name: Txt; desc: Txt; icon: TrophyIcon };
    revealMap?: boolean;
  };
}

export const CHAINS: readonly ChainDef[] = [
  {
    id: 'hondogris',
    name: msg('historias.historias.hondogris.nombre'),
    client: 'alcaldia_hondogris',
    rep: 8,
    intro: msg('historias.historias.hondogris.intro'),
    steps: [
      {
        title: msg('historias.historias.hondogris.steps.rumores_en_la_posada.titulo'),
        type: 'Investigar',
        place: 'la posada del Cuervo',
        text: msg('historias.historias.hondogris.steps.rumores_en_la_posada.texto'),
        danger: 1,
      },
      {
        title: msg('historias.historias.hondogris.steps.el_mapa_del_capataz.titulo'),
        type: 'Recuperar',
        place: 'Hondogrís',
        text: msg('historias.historias.hondogris.steps.el_mapa_del_capataz.texto'),
        danger: 1,
      },
      {
        title: msg('historias.historias.hondogris.steps.las_galerias_de_la_mina_vieja.titulo'),
        type: 'Explorar',
        place: 'la mina vieja',
        text: msg('historias.historias.hondogris.steps.las_galerias_de_la_mina_vieja.texto'),
        danger: 2,
      },
      {
        title: msg('historias.historias.hondogris.steps.la_bestia_de_hondogris.titulo'),
        type: 'Cazar',
        place: 'el vado',
        text: msg('historias.historias.hondogris.steps.la_bestia_de_hondogris.texto'),
        danger: 3,
        boss: 'bestia',
      },
    ],
    ending: msg('historias.historias.hondogris.ending'),
    reward: {
      gold: 250,
      rep: 12,
      item: msg('objetos.equipo.hoja_de_vadoverde.nombre'),
      trophy: {
        name: msg('historias.historias.hondogris.reward.trophy.nombre'),
        desc: msg('historias.historias.hondogris.reward.trophy.desc'),
        icon: 'cabeza',
      },
    },
  },
  {
    id: 'ormaz',
    name: msg('historias.historias.ormaz.nombre'),
    client: 'odile',
    rep: 35,
    intro: msg('historias.historias.ormaz.intro'),
    steps: [
      {
        title: msg('historias.historias.ormaz.steps.la_testigo_de_la_ermita.titulo'),
        type: 'Escoltar',
        place: 'la ermita',
        text: msg('historias.historias.ormaz.steps.la_testigo_de_la_ermita.texto'),
        danger: 1,
      },
      {
        title: msg('historias.historias.ormaz.steps.velas_negras_en_el_granero.titulo'),
        type: 'Investigar',
        place: 'el granero de los Cardo',
        text: msg('historias.historias.ormaz.steps.velas_negras_en_el_granero.texto'),
        danger: 2,
      },
      {
        title: msg('historias.historias.ormaz.steps.la_cripta_de_ormaz.titulo'),
        type: 'Limpiar',
        place: 'el cementerio de Ormaz',
        text: msg('historias.historias.ormaz.steps.la_cripta_de_ormaz.texto'),
        danger: 3,
      },
    ],
    ending: msg('historias.historias.ormaz.ending'),
    reward: {
      gold: 300,
      rep: 15,
      item: msg('objetos.equipo.varita_de_la_abuela_tormenta.nombre'),
      trophy: {
        name: msg('historias.historias.ormaz.reward.trophy.nombre'),
        desc: msg('historias.historias.ormaz.reward.trophy.desc'),
        icon: 'mascara',
      },
    },
  },
  {
    id: 'caravana',
    name: msg('historias.historias.caravana.nombre'),
    client: 'casa_ferran',
    rep: 55,
    intro: msg('historias.historias.caravana.intro'),
    steps: [
      {
        title: msg('historias.historias.caravana.steps.el_ultimo_meson.titulo'),
        type: 'Investigar',
        place: 'el mesón de Levante',
        text: msg('historias.historias.caravana.steps.el_ultimo_meson.texto'),
        danger: 1,
      },
      {
        title: msg('historias.historias.caravana.steps.rodadas_en_el_desfiladero.titulo'),
        type: 'Explorar',
        place: 'el desfiladero de las Cabras',
        text: msg('historias.historias.caravana.steps.rodadas_en_el_desfiladero.texto'),
        danger: 2,
      },
      {
        title: msg('historias.historias.caravana.steps.el_campamento_de_los_tuertos.titulo'),
        type: 'Recuperar',
        place: 'el campamento de los Tuertos',
        text: msg('historias.historias.caravana.steps.el_campamento_de_los_tuertos.texto'),
        danger: 3,
      },
    ],
    ending: msg('historias.historias.caravana.ending'),
    reward: {
      gold: 400,
      rep: 14,
      item: msg('objetos.equipo.botas_de_siete_leguas.nombre'),
      trophy: {
        name: msg('historias.historias.caravana.reward.trophy.nombre'),
        desc: msg('historias.historias.caravana.reward.trophy.desc'),
        icon: 'estandarte',
      },
    },
  },
  {
    id: 'canal',
    name: msg('historias.historias.canal.nombre'),
    client: 'mercaderes',
    rep: 70,
    intro: msg('historias.historias.canal.intro'),
    steps: [
      {
        title: msg('historias.historias.canal.steps.lo_que_se_oye_en_el_molino.titulo'),
        type: 'Investigar',
        place: 'el molino',
        text: msg('historias.historias.canal.steps.lo_que_se_oye_en_el_molino.texto'),
        danger: 1,
      },
      {
        title: msg('historias.historias.canal.steps.el_cargamento_senuelo.titulo'),
        type: 'Escoltar',
        place: 'la casa del canal',
        text: msg('historias.historias.canal.steps.el_cargamento_senuelo.texto'),
        danger: 2,
      },
      {
        title: msg('historias.historias.canal.steps.el_escondite_del_pantano.titulo'),
        type: 'Limpiar',
        place: 'el pantano de las ranas',
        text: msg('historias.historias.canal.steps.el_escondite_del_pantano.texto'),
        danger: 3,
      },
    ],
    ending: msg('historias.historias.canal.ending'),
    reward: { gold: 450, rep: 12, item: msg('objetos.equipo.capa_elfica.nombre') },
  },
  {
    id: 'torre',
    name: msg('historias.historias.torre.nombre'),
    client: 'quirico',
    rep: 110,
    intro: msg('historias.historias.torre.intro'),
    steps: [
      {
        title: msg('historias.historias.torre.steps.el_camino_de_los_riscos.titulo'),
        type: 'Explorar',
        place: 'los riscos',
        text: msg('historias.historias.torre.steps.el_camino_de_los_riscos.texto'),
        danger: 2,
      },
      {
        title: msg('historias.historias.torre.steps.el_diario_del_astronomo.titulo'),
        type: 'Recuperar',
        place: 'la torre caída',
        text: msg('historias.historias.torre.steps.el_diario_del_astronomo.texto'),
        danger: 2,
      },
      {
        title: msg('historias.historias.torre.steps.el_sotano_de_la_torre.titulo'),
        type: 'Limpiar',
        place: 'la torre caída',
        text: msg('historias.historias.torre.steps.el_sotano_de_la_torre.texto'),
        danger: 3,
      },
    ],
    ending: msg('historias.historias.torre.ending'),
    reward: {
      gold: 350,
      rep: 18,
      item: msg('objetos.equipo.varita_de_serbal.nombre'),
      revealMap: true,
    },
  },
  {
    id: 'ahogado',
    name: msg('historias.historias.ahogado.nombre'),
    client: 'cofradia_juncal',
    rep: 140,
    intro: msg('historias.historias.ahogado.intro'),
    steps: [
      {
        title: msg('historias.historias.ahogado.steps.redes_llenas_de_huesos.titulo'),
        type: 'Investigar',
        place: 'la aldea de Juncal',
        text: msg('historias.historias.ahogado.steps.redes_llenas_de_huesos.texto'),
        danger: 1,
      },
      {
        title: msg('historias.historias.ahogado.steps.la_campana_del_fraile.titulo'),
        type: 'Explorar',
        place: 'el islote del Fraile',
        text: msg('historias.historias.ahogado.steps.la_campana_del_fraile.texto'),
        danger: 2,
      },
      {
        title: msg('historias.historias.ahogado.steps.el_rey_ahogado.titulo'),
        type: 'Limpiar',
        place: 'la laguna Negra',
        text: msg('historias.historias.ahogado.steps.el_rey_ahogado.texto'),
        danger: 3,
        boss: 'ahogado',
      },
    ],
    ending: msg('historias.historias.ahogado.ending'),
    reward: {
      gold: 500,
      rep: 18,
      item: msg('objetos.equipo.corona_del_rey_ahogado.nombre'),
      trophy: {
        name: msg('historias.historias.ahogado.reward.trophy.nombre'),
        desc: msg('historias.historias.ahogado.reward.trophy.desc'),
        icon: 'calavera',
      },
    },
  },
  {
    id: 'sierpe',
    name: msg('historias.historias.sierpe.nombre'),
    client: 'abad_lope',
    rep: 200,
    intro: msg('historias.historias.sierpe.intro'),
    steps: [
      {
        title: msg('historias.historias.sierpe.steps.pastos_quemados.titulo'),
        type: 'Investigar',
        place: 'el paso del Lobo',
        text: msg('historias.historias.sierpe.steps.pastos_quemados.texto'),
        danger: 1,
      },
      {
        title: msg('historias.historias.sierpe.steps.el_bestiario_del_abad.titulo'),
        type: 'Escoltar',
        place: 'el monasterio de Peñalta',
        text: msg('historias.historias.sierpe.steps.el_bestiario_del_abad.texto'),
        danger: 2,
      },
      {
        title: msg('historias.historias.sierpe.steps.la_sierpe_de_sierra_parda.titulo'),
        type: 'Cazar',
        place: 'la cueva de la Sierpe',
        text: msg('historias.historias.sierpe.steps.la_sierpe_de_sierra_parda.texto'),
        danger: 3,
        boss: 'sierpe',
      },
    ],
    ending: msg('historias.historias.sierpe.ending'),
    reward: {
      gold: 650,
      rep: 22,
      item: msg('objetos.equipo.coraza_de_escamas_de_sierpe.nombre'),
      trophy: {
        name: msg('historias.historias.sierpe.reward.trophy.nombre'),
        desc: msg('historias.historias.sierpe.reward.trophy.desc'),
        icon: 'cabeza',
      },
    },
  },
  {
    id: 'ceniza',
    name: msg('historias.historias.ceniza.nombre'),
    client: 'concejo_carbonera',
    rep: 250,
    intro: msg('historias.historias.ceniza.intro'),
    steps: [
      {
        title: msg('historias.historias.ceniza.steps.huellas_en_la_ceniza.titulo'),
        type: 'Investigar',
        place: 'la aldea de Carbonera',
        text: msg('historias.historias.ceniza.steps.huellas_en_la_ceniza.texto'),
        danger: 2,
      },
      {
        title: msg('historias.historias.ceniza.steps.los_pinares_quemados.titulo'),
        type: 'Explorar',
        place: 'los pinares quemados',
        text: msg('historias.historias.ceniza.steps.los_pinares_quemados.texto'),
        danger: 2,
      },
      {
        title: msg('historias.historias.ceniza.steps.el_jabali_de_ceniza.titulo'),
        type: 'Cazar',
        place: 'la loma de Ceniza',
        text: msg('historias.historias.ceniza.steps.el_jabali_de_ceniza.texto'),
        danger: 3,
        boss: 'jabali',
      },
    ],
    ending: msg('historias.historias.ceniza.ending'),
    reward: {
      gold: 750,
      rep: 25,
      item: msg('objetos.equipo.capa_de_piel_de_ceniza.nombre'),
      trophy: {
        name: msg('historias.historias.ceniza.reward.trophy.nombre'),
        desc: msg('historias.historias.ceniza.reward.trophy.desc'),
        icon: 'colmillos',
      },
    },
  },
  {
    id: 'sanvela',
    name: msg('historias.historias.sanvela.nombre'),
    client: 'prior_anselmo',
    rep: 320,
    intro: msg('historias.historias.sanvela.intro'),
    steps: [
      {
        title: msg('historias.historias.sanvela.steps.los_monjes_que_no_duermen.titulo'),
        type: 'Escoltar',
        place: 'el priorato de Sanvela',
        text: msg('historias.historias.sanvela.steps.los_monjes_que_no_duermen.texto'),
        danger: 2,
      },
      {
        title: msg('historias.historias.sanvela.steps.las_catacumbas_de_sanvela.titulo'),
        type: 'Limpiar',
        place: 'las catacumbas de Sanvela',
        text: msg('historias.historias.sanvela.steps.las_catacumbas_de_sanvela.texto'),
        danger: 3,
      },
      {
        title: msg('historias.historias.sanvela.steps.la_reina_de_la_cripta.titulo'),
        type: 'Limpiar',
        place: 'la cripta de la Reina',
        text: msg('historias.historias.sanvela.steps.la_reina_de_la_cripta.texto'),
        danger: 3,
        boss: 'reina',
      },
    ],
    ending: msg('historias.historias.sanvela.ending'),
    reward: {
      gold: 900,
      rep: 30,
      item: msg('objetos.equipo.cetro_de_la_reina.nombre'),
      trophy: {
        name: msg('historias.historias.sanvela.reward.trophy.nombre'),
        desc: msg('historias.historias.sanvela.reward.trophy.desc'),
        icon: 'idolo',
      },
    },
  },
  {
    id: 'corona',
    name: msg('historias.historias.corona.nombre'),
    client: 'tres_pueblos',
    rep: 420,
    intro: msg('historias.historias.corona.intro'),
    steps: [
      {
        title: msg('historias.historias.corona.steps.el_refugio_de_nevaza.titulo'),
        type: 'Escoltar',
        place: 'el refugio de Nevaza',
        text: msg('historias.historias.corona.steps.el_refugio_de_nevaza.texto'),
        danger: 2,
      },
      {
        title: msg('historias.historias.corona.steps.el_lago_helado.titulo'),
        type: 'Explorar',
        place: 'el lago Helado',
        text: msg('historias.historias.corona.steps.el_lago_helado.texto'),
        danger: 3,
      },
      {
        title: msg('historias.historias.corona.steps.la_dragona_de_la_corona_blanca.titulo'),
        type: 'Cazar',
        place: 'la Corona Blanca',
        text: msg('historias.historias.corona.steps.la_dragona_de_la_corona_blanca.texto'),
        danger: 3,
        boss: 'dragona',
      },
    ],
    ending: msg('historias.historias.corona.ending'),
    reward: {
      gold: 1200,
      rep: 40,
      item: msg('objetos.equipo.escudo_de_escama_blanca.nombre'),
      trophy: {
        name: msg('historias.historias.corona.reward.trophy.nombre'),
        desc: msg('historias.historias.corona.reward.trophy.desc'),
        icon: 'cabeza',
      },
    },
  },
];
