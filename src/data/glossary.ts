import { rarityList } from './items';
import { t } from '../textos';

/**
 * Glosario de Ajustes: qué es cada cosa del juego, en una o dos frases.
 */

export const GLOSSARY: readonly { term: string; text: string }[] = [
  {
    term: t('glosario.terminos.oro_y_proximo_pago.termino'),
    text: t('glosario.terminos.oro_y_proximo_pago.texto'),
  },
  {
    term: t('glosario.terminos.reputacion_y_rango.termino'),
    text: t('glosario.terminos.reputacion_y_rango.texto'),
  },
  {
    term: t('glosario.terminos.riesgo_de_un_encargo.termino'),
    text: t('glosario.terminos.riesgo_de_un_encargo.texto'),
  },
  {
    term: t('glosario.terminos.peligro.termino'),
    text: t('glosario.terminos.peligro.texto'),
  },
  {
    term: t('glosario.terminos.historias.termino'),
    text: t('glosario.terminos.historias.texto'),
  },
  {
    term: t('glosario.terminos.jefes.termino'),
    text: t('glosario.terminos.jefes.texto'),
  },
  {
    term: t('glosario.terminos.amenaza_de_la_comarca.termino'),
    text: t('glosario.terminos.amenaza_de_la_comarca.texto'),
  },
  {
    term: t('glosario.terminos.asaltos_y_chivatazos.termino'),
    text: t('glosario.terminos.asaltos_y_chivatazos.texto'),
  },
  {
    term: t('glosario.terminos.camara_del_tesoro.termino'),
    text: t('glosario.terminos.camara_del_tesoro.texto'),
  },
  {
    term: t('glosario.terminos.moral.termino'),
    text: t('glosario.terminos.moral.texto'),
  },
  {
    term: t('glosario.terminos.heridos_y_desaparecidos.termino'),
    text: t('glosario.terminos.heridos_y_desaparecidos.texto'),
  },
  {
    term: t('glosario.terminos.nivel_y_veteranos.termino'),
    text: t('glosario.terminos.nivel_y_veteranos.texto'),
  },
  {
    term: t('glosario.terminos.equipo.termino'),
    text: t('glosario.terminos.equipo.texto', { rarezas: rarityList() }),
  },
  {
    term: t('glosario.terminos.trofeos.termino'),
    text: t('glosario.terminos.trofeos.texto'),
  },
  {
    term: t('glosario.terminos.modo_libre.termino'),
    text: t('glosario.terminos.modo_libre.texto'),
  },
  {
    term: t('glosario.terminos.fiesta_de_la_comarca.termino'),
    text: t('glosario.terminos.fiesta_de_la_comarca.texto'),
  },
];
