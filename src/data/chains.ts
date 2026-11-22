import type { QuestType, TrophyIcon } from '../core/model';
import type { BossKind } from './bosses';
import { t } from '../textos';

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
    name: t('historias.historias.hondogris.nombre'),
    client: t('encargos.clientes.alcaldia_hondogris.etiqueta'),
    rep: 8,
    intro: t('historias.historias.hondogris.intro'),
    steps: [
      {
        title: t('historias.historias.hondogris.steps.rumores_en_la_posada.titulo'),
        type: 'Investigar',
        place: t('historias.historias.hondogris.steps.rumores_en_la_posada.place'),
        text: t('historias.historias.hondogris.steps.rumores_en_la_posada.texto'),
        danger: 1,
      },
      {
        title: t('historias.historias.hondogris.steps.el_mapa_del_capataz.titulo'),
        type: 'Recuperar',
        place: t('historias.historias.hondogris.steps.el_mapa_del_capataz.place'),
        text: t('historias.historias.hondogris.steps.el_mapa_del_capataz.texto'),
        danger: 1,
      },
      {
        title: t('historias.historias.hondogris.steps.las_galerias_de_la_mina_vieja.titulo'),
        type: 'Explorar',
        place: t('historias.historias.hondogris.steps.las_galerias_de_la_mina_vieja.place'),
        text: t('historias.historias.hondogris.steps.las_galerias_de_la_mina_vieja.texto'),
        danger: 2,
      },
      {
        title: t('historias.historias.hondogris.steps.la_bestia_de_hondogris.titulo'),
        type: 'Cazar',
        place: t('historias.historias.hondogris.steps.la_bestia_de_hondogris.place'),
        text: t('historias.historias.hondogris.steps.la_bestia_de_hondogris.texto'),
        danger: 3,
        boss: 'bestia',
      },
    ],
    ending: t('historias.historias.hondogris.ending'),
    reward: {
      gold: 250,
      rep: 12,
      item: t('historias.historias.hondogris.reward.item'),
      trophy: {
        name: t('historias.historias.hondogris.reward.trophy.nombre'),
        desc: t('historias.historias.hondogris.reward.trophy.desc'),
        icon: 'cabeza',
      },
    },
  },
  {
    id: 'ormaz',
    name: t('historias.historias.ormaz.nombre'),
    client: t('encargos.clientes.odile.etiqueta'),
    rep: 35,
    intro: t('historias.historias.ormaz.intro'),
    steps: [
      {
        title: t('historias.historias.ormaz.steps.la_testigo_de_la_ermita.titulo'),
        type: 'Escoltar',
        place: t('historias.historias.ormaz.steps.la_testigo_de_la_ermita.place'),
        text: t('historias.historias.ormaz.steps.la_testigo_de_la_ermita.texto'),
        danger: 1,
      },
      {
        title: t('historias.historias.ormaz.steps.velas_negras_en_el_granero.titulo'),
        type: 'Investigar',
        place: t('historias.historias.ormaz.steps.velas_negras_en_el_granero.place'),
        text: t('historias.historias.ormaz.steps.velas_negras_en_el_granero.texto'),
        danger: 2,
      },
      {
        title: t('historias.historias.ormaz.steps.la_cripta_de_ormaz.titulo'),
        type: 'Limpiar',
        place: t('historias.historias.ormaz.steps.la_cripta_de_ormaz.place'),
        text: t('historias.historias.ormaz.steps.la_cripta_de_ormaz.texto'),
        danger: 3,
      },
    ],
    ending: t('historias.historias.ormaz.ending'),
    reward: {
      gold: 300,
      rep: 15,
      item: t('historias.historias.ormaz.reward.item'),
      trophy: {
        name: t('historias.historias.ormaz.reward.trophy.nombre'),
        desc: t('historias.historias.ormaz.reward.trophy.desc'),
        icon: 'mascara',
      },
    },
  },
  {
    id: 'caravana',
    name: t('historias.historias.caravana.nombre'),
    client: t('encargos.clientes.casa_ferran.etiqueta'),
    rep: 55,
    intro: t('historias.historias.caravana.intro'),
    steps: [
      {
        title: t('historias.historias.caravana.steps.el_ultimo_meson.titulo'),
        type: 'Investigar',
        place: t('historias.historias.caravana.steps.el_ultimo_meson.place'),
        text: t('historias.historias.caravana.steps.el_ultimo_meson.texto'),
        danger: 1,
      },
      {
        title: t('historias.historias.caravana.steps.rodadas_en_el_desfiladero.titulo'),
        type: 'Explorar',
        place: t('historias.historias.caravana.steps.rodadas_en_el_desfiladero.place'),
        text: t('historias.historias.caravana.steps.rodadas_en_el_desfiladero.texto'),
        danger: 2,
      },
      {
        title: t('historias.historias.caravana.steps.el_campamento_de_los_tuertos.titulo'),
        type: 'Recuperar',
        place: t('historias.historias.caravana.steps.el_campamento_de_los_tuertos.place'),
        text: t('historias.historias.caravana.steps.el_campamento_de_los_tuertos.texto'),
        danger: 3,
      },
    ],
    ending: t('historias.historias.caravana.ending'),
    reward: {
      gold: 400,
      rep: 14,
      item: t('historias.historias.caravana.reward.item'),
      trophy: {
        name: t('historias.historias.caravana.reward.trophy.nombre'),
        desc: t('historias.historias.caravana.reward.trophy.desc'),
        icon: 'estandarte',
      },
    },
  },
  {
    id: 'canal',
    name: t('historias.historias.canal.nombre'),
    client: t('encargos.clientes.mercaderes.etiqueta'),
    rep: 70,
    intro: t('historias.historias.canal.intro'),
    steps: [
      {
        title: t('historias.historias.canal.steps.lo_que_se_oye_en_el_molino.titulo'),
        type: 'Investigar',
        place: t('historias.historias.canal.steps.lo_que_se_oye_en_el_molino.place'),
        text: t('historias.historias.canal.steps.lo_que_se_oye_en_el_molino.texto'),
        danger: 1,
      },
      {
        title: t('historias.historias.canal.steps.el_cargamento_senuelo.titulo'),
        type: 'Escoltar',
        place: t('historias.historias.canal.steps.el_cargamento_senuelo.place'),
        text: t('historias.historias.canal.steps.el_cargamento_senuelo.texto'),
        danger: 2,
      },
      {
        title: t('historias.historias.canal.steps.el_escondite_del_pantano.titulo'),
        type: 'Limpiar',
        place: t('historias.historias.canal.steps.el_escondite_del_pantano.place'),
        text: t('historias.historias.canal.steps.el_escondite_del_pantano.texto'),
        danger: 3,
      },
    ],
    ending: t('historias.historias.canal.ending'),
    reward: { gold: 450, rep: 12, item: t('historias.historias.canal.reward.item') },
  },
  {
    id: 'torre',
    name: t('historias.historias.torre.nombre'),
    client: t('encargos.clientes.quirico.etiqueta'),
    rep: 110,
    intro: t('historias.historias.torre.intro'),
    steps: [
      {
        title: t('historias.historias.torre.steps.el_camino_de_los_riscos.titulo'),
        type: 'Explorar',
        place: t('historias.historias.torre.steps.el_camino_de_los_riscos.place'),
        text: t('historias.historias.torre.steps.el_camino_de_los_riscos.texto'),
        danger: 2,
      },
      {
        title: t('historias.historias.torre.steps.el_diario_del_astronomo.titulo'),
        type: 'Recuperar',
        place: t('historias.historias.torre.steps.el_diario_del_astronomo.place'),
        text: t('historias.historias.torre.steps.el_diario_del_astronomo.texto'),
        danger: 2,
      },
      {
        title: t('historias.historias.torre.steps.el_sotano_de_la_torre.titulo'),
        type: 'Limpiar',
        place: t('historias.historias.torre.steps.el_sotano_de_la_torre.place'),
        text: t('historias.historias.torre.steps.el_sotano_de_la_torre.texto'),
        danger: 3,
      },
    ],
    ending: t('historias.historias.torre.ending'),
    reward: {
      gold: 350,
      rep: 18,
      item: t('historias.historias.torre.reward.item'),
      revealMap: true,
    },
  },
  {
    id: 'ahogado',
    name: t('historias.historias.ahogado.nombre'),
    client: t('encargos.clientes.cofradia_juncal.etiqueta'),
    rep: 140,
    intro: t('historias.historias.ahogado.intro'),
    steps: [
      {
        title: t('historias.historias.ahogado.steps.redes_llenas_de_huesos.titulo'),
        type: 'Investigar',
        place: t('historias.historias.ahogado.steps.redes_llenas_de_huesos.place'),
        text: t('historias.historias.ahogado.steps.redes_llenas_de_huesos.texto'),
        danger: 1,
      },
      {
        title: t('historias.historias.ahogado.steps.la_campana_del_fraile.titulo'),
        type: 'Explorar',
        place: t('historias.historias.ahogado.steps.la_campana_del_fraile.place'),
        text: t('historias.historias.ahogado.steps.la_campana_del_fraile.texto'),
        danger: 2,
      },
      {
        title: t('historias.historias.ahogado.steps.el_rey_ahogado.titulo'),
        type: 'Limpiar',
        place: t('historias.historias.ahogado.steps.el_rey_ahogado.place'),
        text: t('historias.historias.ahogado.steps.el_rey_ahogado.texto'),
        danger: 3,
        boss: 'ahogado',
      },
    ],
    ending: t('historias.historias.ahogado.ending'),
    reward: {
      gold: 500,
      rep: 18,
      item: t('historias.historias.ahogado.reward.item'),
      trophy: {
        name: t('historias.historias.ahogado.reward.trophy.nombre'),
        desc: t('historias.historias.ahogado.reward.trophy.desc'),
        icon: 'calavera',
      },
    },
  },
  {
    id: 'sierpe',
    name: t('historias.historias.sierpe.nombre'),
    client: t('encargos.clientes.abad_lope.etiqueta'),
    rep: 200,
    intro: t('historias.historias.sierpe.intro'),
    steps: [
      {
        title: t('historias.historias.sierpe.steps.pastos_quemados.titulo'),
        type: 'Investigar',
        place: t('historias.historias.sierpe.steps.pastos_quemados.place'),
        text: t('historias.historias.sierpe.steps.pastos_quemados.texto'),
        danger: 1,
      },
      {
        title: t('historias.historias.sierpe.steps.el_bestiario_del_abad.titulo'),
        type: 'Escoltar',
        place: t('historias.historias.sierpe.steps.el_bestiario_del_abad.place'),
        text: t('historias.historias.sierpe.steps.el_bestiario_del_abad.texto'),
        danger: 2,
      },
      {
        title: t('historias.historias.sierpe.steps.la_sierpe_de_sierra_parda.titulo'),
        type: 'Cazar',
        place: t('historias.historias.sierpe.steps.la_sierpe_de_sierra_parda.place'),
        text: t('historias.historias.sierpe.steps.la_sierpe_de_sierra_parda.texto'),
        danger: 3,
        boss: 'sierpe',
      },
    ],
    ending: t('historias.historias.sierpe.ending'),
    reward: {
      gold: 650,
      rep: 22,
      item: t('historias.historias.sierpe.reward.item'),
      trophy: {
        name: t('historias.historias.sierpe.reward.trophy.nombre'),
        desc: t('historias.historias.sierpe.reward.trophy.desc'),
        icon: 'cabeza',
      },
    },
  },
  {
    id: 'ceniza',
    name: t('historias.historias.ceniza.nombre'),
    client: t('encargos.clientes.concejo_carbonera.etiqueta'),
    rep: 250,
    intro: t('historias.historias.ceniza.intro'),
    steps: [
      {
        title: t('historias.historias.ceniza.steps.huellas_en_la_ceniza.titulo'),
        type: 'Investigar',
        place: t('historias.historias.ceniza.steps.huellas_en_la_ceniza.place'),
        text: t('historias.historias.ceniza.steps.huellas_en_la_ceniza.texto'),
        danger: 2,
      },
      {
        title: t('historias.historias.ceniza.steps.los_pinares_quemados.titulo'),
        type: 'Explorar',
        place: t('historias.historias.ceniza.steps.los_pinares_quemados.place'),
        text: t('historias.historias.ceniza.steps.los_pinares_quemados.texto'),
        danger: 2,
      },
      {
        title: t('historias.historias.ceniza.steps.el_jabali_de_ceniza.titulo'),
        type: 'Cazar',
        place: t('historias.historias.ceniza.steps.el_jabali_de_ceniza.place'),
        text: t('historias.historias.ceniza.steps.el_jabali_de_ceniza.texto'),
        danger: 3,
        boss: 'jabali',
      },
    ],
    ending: t('historias.historias.ceniza.ending'),
    reward: {
      gold: 750,
      rep: 25,
      item: t('historias.historias.ceniza.reward.item'),
      trophy: {
        name: t('historias.historias.ceniza.reward.trophy.nombre'),
        desc: t('historias.historias.ceniza.reward.trophy.desc'),
        icon: 'colmillos',
      },
    },
  },
  {
    id: 'sanvela',
    name: t('historias.historias.sanvela.nombre'),
    client: t('encargos.clientes.prior_anselmo.etiqueta'),
    rep: 320,
    intro: t('historias.historias.sanvela.intro'),
    steps: [
      {
        title: t('historias.historias.sanvela.steps.los_monjes_que_no_duermen.titulo'),
        type: 'Escoltar',
        place: t('historias.historias.sanvela.steps.los_monjes_que_no_duermen.place'),
        text: t('historias.historias.sanvela.steps.los_monjes_que_no_duermen.texto'),
        danger: 2,
      },
      {
        title: t('historias.historias.sanvela.steps.las_catacumbas_de_sanvela.titulo'),
        type: 'Limpiar',
        place: t('historias.historias.sanvela.steps.las_catacumbas_de_sanvela.place'),
        text: t('historias.historias.sanvela.steps.las_catacumbas_de_sanvela.texto'),
        danger: 3,
      },
      {
        title: t('historias.historias.sanvela.steps.la_reina_de_la_cripta.titulo'),
        type: 'Limpiar',
        place: t('historias.historias.sanvela.steps.la_reina_de_la_cripta.place'),
        text: t('historias.historias.sanvela.steps.la_reina_de_la_cripta.texto'),
        danger: 3,
        boss: 'reina',
      },
    ],
    ending: t('historias.historias.sanvela.ending'),
    reward: {
      gold: 900,
      rep: 30,
      item: t('historias.historias.sanvela.reward.item'),
      trophy: {
        name: t('historias.historias.sanvela.reward.trophy.nombre'),
        desc: t('historias.historias.sanvela.reward.trophy.desc'),
        icon: 'idolo',
      },
    },
  },
  {
    id: 'corona',
    name: t('historias.historias.corona.nombre'),
    client: t('encargos.clientes.tres_pueblos.etiqueta'),
    rep: 420,
    intro: t('historias.historias.corona.intro'),
    steps: [
      {
        title: t('historias.historias.corona.steps.el_refugio_de_nevaza.titulo'),
        type: 'Escoltar',
        place: t('historias.historias.corona.steps.el_refugio_de_nevaza.place'),
        text: t('historias.historias.corona.steps.el_refugio_de_nevaza.texto'),
        danger: 2,
      },
      {
        title: t('historias.historias.corona.steps.el_lago_helado.titulo'),
        type: 'Explorar',
        place: t('historias.historias.corona.steps.el_lago_helado.place'),
        text: t('historias.historias.corona.steps.el_lago_helado.texto'),
        danger: 3,
      },
      {
        title: t('historias.historias.corona.steps.la_dragona_de_la_corona_blanca.titulo'),
        type: 'Cazar',
        place: t('historias.historias.corona.steps.la_dragona_de_la_corona_blanca.place'),
        text: t('historias.historias.corona.steps.la_dragona_de_la_corona_blanca.texto'),
        danger: 3,
        boss: 'dragona',
      },
    ],
    ending: t('historias.historias.corona.ending'),
    reward: {
      gold: 1200,
      rep: 40,
      item: t('historias.historias.corona.reward.item'),
      trophy: {
        name: t('historias.historias.corona.reward.trophy.nombre'),
        desc: t('historias.historias.corona.reward.trophy.desc'),
        icon: 'cabeza',
      },
    },
  },
];
