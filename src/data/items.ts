import { TIER_COLOR_NAMES, tierOf } from '../art/tiers';
import type { Item, QuestType, Rarity, TrophyIcon } from '../core/model';
import { list, t, tl } from '../textos';

/**
 * Catálogo de botín. El equipo tiene tipo, rareza (0 común, 1 bueno, 2 raro, 3
 * épico, 4 legendario),
 * bonificaciones y a veces un efecto; los tesoros solo se venden; los trofeos se exhiben.
 */

export type GearBase = Omit<Item, 'id'>;

export const GEAR: readonly GearBase[] = [
  // Común.
  {
    name: t('objetos.equipo.espada_oxidada.nombre'),
    desc: t('objetos.equipo.espada_oxidada.desc'),
    value: 20,
    kind: 'arma',
    rarity: 0,
    icon: 'espada',
    bonus: { Combate: 1 },
  },
  {
    name: t('objetos.equipo.ganzuas_de_alambre.nombre'),
    desc: t('objetos.equipo.ganzuas_de_alambre.desc'),
    value: 18,
    kind: 'herramienta',
    rarity: 0,
    icon: 'ganzua',
    bonus: { Trampas: 1 },
  },
  {
    name: t('objetos.equipo.botas_remendadas.nombre'),
    desc: t('objetos.equipo.botas_remendadas.desc'),
    value: 16,
    kind: 'herramienta',
    rarity: 0,
    icon: 'botas',
    bonus: { Supervivencia: 1 },
  },
  {
    name: t('objetos.equipo.talisman_de_ajo.nombre'),
    desc: t('objetos.equipo.talisman_de_ajo.desc'),
    value: 16,
    kind: 'amuleto',
    rarity: 0,
    icon: 'amuleto',
    bonus: { Arcano: 1 },
  },
  {
    name: t('objetos.equipo.coraza_abollada.nombre'),
    desc: t('objetos.equipo.coraza_abollada.desc'),
    value: 24,
    kind: 'armadura',
    rarity: 0,
    icon: 'coraza',
    perk: 'guard',
  },
  // Bueno.
  {
    name: t('objetos.equipo.espada_de_soldado.nombre'),
    desc: t('objetos.equipo.espada_de_soldado.desc'),
    value: 32,
    kind: 'arma',
    rarity: 1,
    icon: 'espada',
    bonus: { Combate: 1, Supervivencia: 1 },
  },
  {
    name: t('objetos.equipo.ganzuas_de_laton.nombre'),
    desc: t('objetos.equipo.ganzuas_de_laton.desc'),
    value: 30,
    kind: 'herramienta',
    rarity: 1,
    icon: 'ganzua',
    bonus: { Trampas: 1, Combate: 1 },
  },
  {
    name: t('objetos.equipo.botas_de_caminante.nombre'),
    desc: t('objetos.equipo.botas_de_caminante.desc'),
    value: 30,
    kind: 'herramienta',
    rarity: 1,
    icon: 'botas',
    bonus: { Supervivencia: 1, Trampas: 1 },
  },
  {
    name: t('objetos.equipo.colgante_de_cuarzo.nombre'),
    desc: t('objetos.equipo.colgante_de_cuarzo.desc'),
    value: 30,
    kind: 'amuleto',
    rarity: 1,
    icon: 'amuleto',
    bonus: { Arcano: 1, Supervivencia: 1 },
  },
  {
    name: t('objetos.equipo.cota_de_anillas.nombre'),
    desc: t('objetos.equipo.cota_de_anillas.desc'),
    value: 34,
    kind: 'armadura',
    rarity: 1,
    icon: 'coraza',
    bonus: { Combate: 1, Supervivencia: 1 },
  },
  {
    name: t('objetos.equipo.vara_de_avellano.nombre'),
    desc: t('objetos.equipo.vara_de_avellano.desc'),
    value: 32,
    kind: 'arma',
    rarity: 1,
    icon: 'varita',
    bonus: { Arcano: 1, Combate: 1 },
  },
  // Raro.
  {
    name: t('objetos.equipo.hacha_de_lenador_enano.nombre'),
    desc: t('objetos.equipo.hacha_de_lenador_enano.desc'),
    value: 48,
    kind: 'arma',
    rarity: 2,
    icon: 'hacha',
    bonus: { Combate: 2 },
  },
  {
    name: t('objetos.equipo.ganzuas_finas.nombre'),
    desc: t('objetos.equipo.ganzuas_finas.desc'),
    value: 44,
    kind: 'herramienta',
    rarity: 2,
    icon: 'ganzua',
    bonus: { Trampas: 2 },
  },
  {
    name: t('objetos.equipo.capa_de_explorador.nombre'),
    desc: t('objetos.equipo.capa_de_explorador.desc'),
    value: 46,
    kind: 'herramienta',
    rarity: 2,
    icon: 'capa',
    bonus: { Supervivencia: 1 },
    perk: 'ambush',
  },
  {
    name: t('objetos.equipo.amuleto_de_hueso.nombre'),
    desc: t('objetos.equipo.amuleto_de_hueso.desc'),
    value: 42,
    kind: 'amuleto',
    rarity: 2,
    icon: 'amuleto',
    bonus: { Arcano: 1 },
    perk: 'ward',
  },
  {
    name: t('objetos.equipo.escudo_con_blason.nombre'),
    desc: t('objetos.equipo.escudo_con_blason.desc'),
    value: 50,
    kind: 'armadura',
    rarity: 2,
    icon: 'escudo',
    bonus: { Combate: 1 },
    perk: 'guard',
  },
  {
    name: t('objetos.equipo.varita_de_serbal.nombre'),
    desc: t('objetos.equipo.varita_de_serbal.desc'),
    value: 48,
    kind: 'arma',
    rarity: 2,
    icon: 'varita',
    bonus: { Arcano: 2 },
  },
  // Épico.
  {
    name: t('objetos.equipo.mandoble_de_hierronegro.nombre'),
    desc: t('objetos.equipo.mandoble_de_hierronegro.desc'),
    value: 85,
    kind: 'arma',
    rarity: 3,
    icon: 'espada',
    bonus: { Combate: 3 },
  },
  {
    name: t('objetos.equipo.hacha_de_guerra_runica.nombre'),
    desc: t('objetos.equipo.hacha_de_guerra_runica.desc'),
    value: 85,
    kind: 'arma',
    rarity: 3,
    icon: 'hacha',
    bonus: { Combate: 2, Supervivencia: 1 },
    perk: 'luck',
  },
  {
    name: t('objetos.equipo.ganzuas_de_sombra.nombre'),
    desc: t('objetos.equipo.ganzuas_de_sombra.desc'),
    value: 80,
    kind: 'herramienta',
    rarity: 3,
    icon: 'ganzua',
    bonus: { Trampas: 3 },
    perk: 'ambush',
  },
  {
    name: t('objetos.equipo.amuleto_del_vigia.nombre'),
    desc: t('objetos.equipo.amuleto_del_vigia.desc'),
    value: 80,
    kind: 'amuleto',
    rarity: 3,
    icon: 'amuleto',
    bonus: { Arcano: 2, Supervivencia: 1 },
    perk: 'ward',
  },
  {
    name: t('objetos.equipo.escudo_de_la_torre.nombre'),
    desc: t('objetos.equipo.escudo_de_la_torre.desc'),
    value: 90,
    kind: 'armadura',
    rarity: 3,
    icon: 'escudo',
    bonus: { Combate: 2, Supervivencia: 1 },
    perk: 'guard',
  },
  {
    name: t('objetos.equipo.baculo_de_ceniza.nombre'),
    desc: t('objetos.equipo.baculo_de_ceniza.desc'),
    value: 85,
    kind: 'arma',
    rarity: 3,
    icon: 'varita',
    bonus: { Arcano: 3 },
    perk: 'luck',
  },
  // Legendario.
  {
    name: t('objetos.equipo.hoja_de_vadoverde.nombre'),
    desc: t('objetos.equipo.hoja_de_vadoverde.desc'),
    value: 120,
    kind: 'arma',
    rarity: 4,
    icon: 'espada',
    bonus: { Combate: 3 },
    perk: 'luck',
  },
  {
    name: t('objetos.equipo.capa_elfica.nombre'),
    desc: t('objetos.equipo.capa_elfica.desc'),
    value: 110,
    kind: 'herramienta',
    rarity: 4,
    icon: 'capa',
    bonus: { Supervivencia: 2, Trampas: 1 },
    perk: 'ambush',
  },
  {
    name: t('objetos.equipo.varita_de_la_abuela_tormenta.nombre'),
    desc: t('objetos.equipo.varita_de_la_abuela_tormenta.desc'),
    value: 115,
    kind: 'arma',
    rarity: 4,
    icon: 'varita',
    bonus: { Arcano: 3 },
    perk: 'ward',
  },
  {
    name: t('objetos.equipo.botas_de_siete_leguas.nombre'),
    desc: t('objetos.equipo.botas_de_siete_leguas.desc'),
    value: 110,
    kind: 'herramienta',
    rarity: 4,
    icon: 'botas',
    bonus: { Supervivencia: 3 },
    perk: 'ambush',
  },
  {
    name: t('objetos.equipo.corona_del_rey_ahogado.nombre'),
    desc: t('objetos.equipo.corona_del_rey_ahogado.desc'),
    value: 125,
    kind: 'amuleto',
    rarity: 4,
    icon: 'amuleto',
    bonus: { Arcano: 2, Supervivencia: 1 },
    perk: 'ward',
  },
  {
    name: t('objetos.equipo.coraza_de_escamas_de_sierpe.nombre'),
    desc: t('objetos.equipo.coraza_de_escamas_de_sierpe.desc'),
    value: 140,
    kind: 'armadura',
    rarity: 4,
    icon: 'coraza',
    bonus: { Combate: 2, Supervivencia: 2 },
    perk: 'guard',
  },
  {
    name: t('objetos.equipo.capa_de_piel_de_ceniza.nombre'),
    desc: t('objetos.equipo.capa_de_piel_de_ceniza.desc'),
    value: 160,
    kind: 'armadura',
    rarity: 4,
    icon: 'capa',
    bonus: { Supervivencia: 3, Combate: 1 },
  },
  {
    name: t('objetos.equipo.cetro_de_la_reina.nombre'),
    desc: t('objetos.equipo.cetro_de_la_reina.desc'),
    value: 180,
    kind: 'amuleto',
    rarity: 4,
    icon: 'varita',
    bonus: { Arcano: 4 },
  },
  {
    name: t('objetos.equipo.escudo_de_escama_blanca.nombre'),
    desc: t('objetos.equipo.escudo_de_escama_blanca.desc'),
    value: 200,
    kind: 'armadura',
    rarity: 4,
    icon: 'escudo',
    bonus: { Combate: 3, Supervivencia: 2 },
    perk: 'guard',
  },
];

export const TREASURES: readonly GearBase[] = [
  {
    name: t('objetos.tesoros.colmillos_de_huargo.nombre'),
    desc: t('objetos.tesoros.colmillos_de_huargo.desc'),
    value: 24,
    kind: 'tesoro',
  },
  {
    name: t('objetos.tesoros.llave_de_hierro_negro.nombre'),
    desc: t('objetos.tesoros.llave_de_hierro_negro.desc'),
    value: 10,
    kind: 'tesoro',
  },
  {
    name: t('objetos.tesoros.mapa_a_medio_quemar.nombre'),
    desc: t('objetos.tesoros.mapa_a_medio_quemar.desc'),
    value: 15,
    kind: 'tesoro',
  },
  {
    name: t('objetos.tesoros.reliquia_sin_nombre.nombre'),
    desc: t('objetos.tesoros.reliquia_sin_nombre.desc'),
    value: 60,
    kind: 'tesoro',
  },
  {
    name: t('objetos.tesoros.bolsa_de_gemas_turbias.nombre'),
    desc: t('objetos.tesoros.bolsa_de_gemas_turbias.desc'),
    value: 45,
    kind: 'tesoro',
  },
  {
    name: t('objetos.tesoros.caliz_de_plata.nombre'),
    desc: t('objetos.tesoros.caliz_de_plata.desc'),
    value: 40,
    kind: 'tesoro',
  },
];

export const RARITY_NAMES = tl('objetos.rarezas');

/**
 * Las rarezas en una frase, con el color de las que no son comunes: «común, bueno (verde),
 * raro (azul), épico (morado) o legendario (dorado)». Sale de `RARITY_NAMES` y `tierOf`: si cambian los niveles, cambia sola.
 */
export function rarityList(): string {
  const all = RARITY_NAMES.map((n, r) =>
    r
      ? t('objetos.rareza_color', {
          rareza: n.toLowerCase(),
          color: TIER_COLOR_NAMES[tierOf(r as Rarity)],
        })
      : n.toLowerCase(),
  );
  return list(all, 'o');
}

export const PERK_INFO: Record<NonNullable<Item['perk']>, string> = {
  guard: t('objetos.efectos.guard'),
  luck: t('objetos.efectos.luck'),
  ward: t('objetos.efectos.ward'),
  ambush: t('objetos.efectos.ambush'),
};

/** Trofeos por tipo de encargo: solo tras un éxito brillante en encargos peligrosos. */
export const TROPHIES: Record<
  QuestType,
  readonly { name: string; desc: string; icon: TrophyIcon }[]
> = {
  Cazar: [
    {
      name: t('objetos.trofeos.Cazar.cabeza_de_huargo.nombre'),
      desc: t('objetos.trofeos.Cazar.cabeza_de_huargo.desc'),
      icon: 'cabeza',
    },
    {
      name: t('objetos.trofeos.Cazar.colmillos_de_basilisco.nombre'),
      desc: t('objetos.trofeos.Cazar.colmillos_de_basilisco.desc'),
      icon: 'colmillos',
    },
    {
      name: t('objetos.trofeos.Cazar.cabeza_de_jabali_negro.nombre'),
      desc: t('objetos.trofeos.Cazar.cabeza_de_jabali_negro.desc'),
      icon: 'cabeza',
    },
  ],
  Limpiar: [
    {
      name: t('objetos.trofeos.Limpiar.estandarte_orco.nombre'),
      desc: t('objetos.trofeos.Limpiar.estandarte_orco.desc'),
      icon: 'estandarte',
    },
    {
      name: t('objetos.trofeos.Limpiar.calavera_del_rey_de_las_ratas.nombre'),
      desc: t('objetos.trofeos.Limpiar.calavera_del_rey_de_las_ratas.desc'),
      icon: 'calavera',
    },
  ],
  Explorar: [
    {
      name: t('objetos.trofeos.Explorar.idolo_de_jade.nombre'),
      desc: t('objetos.trofeos.Explorar.idolo_de_jade.desc'),
      icon: 'idolo',
    },
    {
      name: t('objetos.trofeos.Explorar.calavera_con_runas.nombre'),
      desc: t('objetos.trofeos.Explorar.calavera_con_runas.desc'),
      icon: 'calavera',
    },
  ],
  Investigar: [
    {
      name: t('objetos.trofeos.Investigar.mascara_del_culto.nombre'),
      desc: t('objetos.trofeos.Investigar.mascara_del_culto.desc'),
      icon: 'mascara',
    },
    {
      name: t('objetos.trofeos.Investigar.estandarte_de_la_hermandad.nombre'),
      desc: t('objetos.trofeos.Investigar.estandarte_de_la_hermandad.desc'),
      icon: 'estandarte',
    },
  ],
  Recuperar: [
    {
      name: t('objetos.trofeos.Recuperar.idolo_del_templo_hundido.nombre'),
      desc: t('objetos.trofeos.Recuperar.idolo_del_templo_hundido.desc'),
      icon: 'idolo',
    },
    {
      name: t('objetos.trofeos.Recuperar.mascara_del_ladron_sin_rostro.nombre'),
      desc: t('objetos.trofeos.Recuperar.mascara_del_ladron_sin_rostro.desc'),
      icon: 'mascara',
    },
  ],
  Escoltar: [
    {
      name: t('objetos.trofeos.Escoltar.estandarte_de_los_bandidos.nombre'),
      desc: t('objetos.trofeos.Escoltar.estandarte_de_los_bandidos.desc'),
      icon: 'estandarte',
    },
    {
      name: t('objetos.trofeos.Escoltar.colmillos_del_lobo_blanco.nombre'),
      desc: t('objetos.trofeos.Escoltar.colmillos_del_lobo_blanco.desc'),
      icon: 'colmillos',
    },
  ],
};

/** Resumen corto de lo que hace un objeto: «+2 Combate · Esquiva emboscadas». */
/** El nombre con su mejora del taller: «Espada larga +2». */
export const itemName = (it: Pick<Item, 'name' | 'plus'>) =>
  it.plus ? t('objetos.con_mejora', { nombre: it.name, mas: it.plus }) : it.name;

export function itemEffect(it: Item): string {
  // La mejora del taller (`plus`) suma a la habilidad principal (la primera), como en `gearOf`.
  const parts = Object.entries(it.bonus ?? {}).map(([k, v], i) =>
    t('objetos.bono', { n: v + (i === 0 ? (it.plus ?? 0) : 0), habilidad: k }),
  );
  if (it.perk) parts.push(PERK_INFO[it.perk]);
  return parts.join(' · ') || t('objetos.solo_venta');
}
