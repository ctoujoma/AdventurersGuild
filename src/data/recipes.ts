/**
 * Recetas de los talleres: lo que se puede crear, en qué sala, cuánto cuesta y cuánto tarda.
 * Cada una da un objeto normal o, a veces, uno bueno (raro, en azul) (según el herrero y el nivel de la sala).
 * Los legendarios no se crean: solo salen del botín. Las reglas están en core/crafting.ts.
 */
import type { ItemIcon, ItemKind } from '../core/model';
import type { GearBase } from './items';
import type { Mats } from '../core/materials';
import type { RoomType } from './rooms';
import { t } from '../textos';

export type RecipeId =
  | 'espada'
  | 'coraza'
  | 'ganzuas'
  | 'hacha'
  | 'escudo'
  | 'botas'
  | 'capa'
  | 'amuleto'
  | 'varita'
  | 'espadaLarga'
  | 'cota'
  | 'escudoTachonado'
  | 'ganzuasTempladas'
  | 'botasCuero'
  | 'capaForrada';

/** Los talleres, para las frases («en la sastrería»). */
export const WORKSHOP_PLACE: Partial<Record<RoomType, string>> = {
  forja: t('recetas.taller.forja'),
  sastreria: t('recetas.taller.sastreria'),
  alquimia: t('recetas.taller.alquimia'),
};

export interface Recipe {
  name: string;
  /** Con artículo y en plural, para las frases («un hacha», «hachas»). */
  one: string;
  many: string;
  /** El taller en que se crea. */
  room: RoomType;
  icon: ItemIcon;
  kind: ItemKind;
  /** Monedas al empezar (se devuelven si se cancela). */
  gold: number;
  /** Horas de juego con un herrero normal (Maña 4) en una forja de nivel 1. */
  hours: number;
  /** Se sabe desde el principio; las demás se aprenden desmontando o como premio. */
  free?: boolean;
  /** Materiales que pide (se devuelven si se cancela). Las de la casa no piden nada. */
  mats?: Mats;
  /** Lo que sale: normal y bueno. */
  common: GearBase;
  good: GearBase;
}

export const RECIPES: Record<RecipeId, Recipe> = {
  espada: {
    name: t('recetas.recetas.espada.nombre'),
    one: t('recetas.recetas.espada.one'),
    many: 'espadas',
    room: 'forja',
    icon: 'espada',
    kind: 'arma',
    gold: 25,
    hours: 8,
    free: true,
    common: {
      name: t('recetas.recetas.espada.common.nombre'),
      desc: t('recetas.recetas.espada.common.desc'),
      value: 22,
      kind: 'arma',
      rarity: 0,
      icon: 'espada',
      bonus: { Combate: 1 },
    },
    good: {
      name: t('recetas.recetas.espada.good.nombre'),
      desc: t('recetas.recetas.espada.good.desc'),
      value: 48,
      kind: 'arma',
      rarity: 2,
      icon: 'espada',
      bonus: { Combate: 2 },
    },
  },
  coraza: {
    name: t('recetas.recetas.coraza.nombre'),
    one: t('recetas.recetas.coraza.one'),
    many: 'corazas',
    room: 'forja',
    icon: 'coraza',
    kind: 'armadura',
    gold: 30,
    hours: 10,
    free: true,
    common: {
      name: t('recetas.recetas.coraza.common.nombre'),
      desc: t('recetas.recetas.coraza.common.desc'),
      value: 26,
      kind: 'armadura',
      rarity: 0,
      icon: 'coraza',
      perk: 'guard',
    },
    good: {
      name: t('recetas.recetas.coraza.good.nombre'),
      desc: t('recetas.recetas.coraza.good.desc'),
      value: 52,
      kind: 'armadura',
      rarity: 2,
      icon: 'coraza',
      bonus: { Combate: 1 },
      perk: 'guard',
    },
  },
  ganzuas: {
    name: t('recetas.recetas.ganzuas.nombre'),
    one: t('recetas.recetas.ganzuas.one'),
    many: t('recetas.recetas.ganzuas.many'),
    room: 'forja',
    icon: 'ganzua',
    kind: 'herramienta',
    gold: 20,
    hours: 6,
    free: true,
    common: {
      name: t('recetas.recetas.ganzuas.common.nombre'),
      desc: t('recetas.recetas.ganzuas.common.desc'),
      value: 20,
      kind: 'herramienta',
      rarity: 0,
      icon: 'ganzua',
      bonus: { Trampas: 1 },
    },
    good: {
      name: t('recetas.recetas.ganzuas.good.nombre'),
      desc: t('recetas.recetas.ganzuas.good.desc'),
      value: 46,
      kind: 'herramienta',
      rarity: 2,
      icon: 'ganzua',
      bonus: { Trampas: 2 },
    },
  },
  hacha: {
    name: t('recetas.recetas.hacha.nombre'),
    one: t('recetas.recetas.hacha.one'),
    many: 'hachas',
    room: 'forja',
    icon: 'hacha',
    kind: 'arma',
    gold: 45,
    hours: 12,
    common: {
      name: t('recetas.recetas.hacha.common.nombre'),
      desc: t('recetas.recetas.hacha.common.desc'),
      value: 40,
      kind: 'arma',
      rarity: 0,
      icon: 'hacha',
      bonus: { Combate: 2 },
    },
    good: {
      name: t('recetas.recetas.hacha.good.nombre'),
      desc: t('recetas.recetas.hacha.good.desc'),
      value: 70,
      kind: 'arma',
      rarity: 2,
      icon: 'hacha',
      bonus: { Combate: 2, Supervivencia: 1 },
    },
  },
  escudo: {
    name: t('recetas.recetas.escudo.nombre'),
    one: t('recetas.recetas.escudo.one'),
    many: 'escudos',
    room: 'forja',
    icon: 'escudo',
    kind: 'armadura',
    gold: 45,
    hours: 12,
    common: {
      name: t('recetas.recetas.escudo.common.nombre'),
      desc: t('recetas.recetas.escudo.common.desc'),
      value: 40,
      kind: 'armadura',
      rarity: 0,
      icon: 'escudo',
      bonus: { Combate: 1 },
      perk: 'guard',
    },
    good: {
      name: t('recetas.recetas.escudo.good.nombre'),
      desc: t('recetas.recetas.escudo.good.desc'),
      value: 70,
      kind: 'armadura',
      rarity: 2,
      icon: 'escudo',
      bonus: { Combate: 2 },
      perk: 'guard',
    },
  },
  botas: {
    name: t('recetas.recetas.botas.nombre'),
    one: t('recetas.recetas.botas.one'),
    many: 'botas',
    room: 'sastreria',
    icon: 'botas',
    kind: 'herramienta',
    gold: 20,
    hours: 6,
    free: true,
    common: {
      name: t('recetas.recetas.botas.common.nombre'),
      desc: t('recetas.recetas.botas.common.desc'),
      value: 18,
      kind: 'herramienta',
      rarity: 0,
      icon: 'botas',
      bonus: { Supervivencia: 1 },
    },
    good: {
      name: t('recetas.recetas.botas.good.nombre'),
      desc: t('recetas.recetas.botas.good.desc'),
      value: 44,
      kind: 'herramienta',
      rarity: 2,
      icon: 'botas',
      bonus: { Supervivencia: 2 },
    },
  },
  capa: {
    name: t('recetas.recetas.capa.nombre'),
    one: t('recetas.recetas.capa.one'),
    many: 'capas',
    room: 'sastreria',
    icon: 'capa',
    kind: 'herramienta',
    gold: 30,
    hours: 8,
    common: {
      name: t('recetas.recetas.capa.common.nombre'),
      desc: t('recetas.recetas.capa.common.desc'),
      value: 24,
      kind: 'herramienta',
      rarity: 0,
      icon: 'capa',
      bonus: { Supervivencia: 1 },
    },
    good: {
      name: t('recetas.recetas.capa.good.nombre'),
      desc: t('recetas.recetas.capa.good.desc'),
      value: 48,
      kind: 'herramienta',
      rarity: 2,
      icon: 'capa',
      bonus: { Supervivencia: 1 },
      perk: 'ambush',
    },
  },
  amuleto: {
    name: t('recetas.recetas.amuleto.nombre'),
    one: t('recetas.recetas.amuleto.one'),
    many: 'amuletos',
    room: 'alquimia',
    icon: 'amuleto',
    kind: 'amuleto',
    gold: 30,
    hours: 8,
    free: true,
    common: {
      name: t('recetas.recetas.amuleto.common.nombre'),
      desc: t('recetas.recetas.amuleto.common.desc'),
      value: 20,
      kind: 'amuleto',
      rarity: 0,
      icon: 'amuleto',
      bonus: { Arcano: 1 },
    },
    good: {
      name: t('recetas.recetas.amuleto.good.nombre'),
      desc: t('recetas.recetas.amuleto.good.desc'),
      value: 46,
      kind: 'amuleto',
      rarity: 2,
      icon: 'amuleto',
      bonus: { Arcano: 1 },
      perk: 'ward',
    },
  },
  varita: {
    name: t('recetas.recetas.varita.nombre'),
    one: t('recetas.recetas.varita.one'),
    many: 'varitas',
    room: 'alquimia',
    icon: 'varita',
    kind: 'arma',
    gold: 45,
    hours: 12,
    common: {
      name: t('recetas.recetas.varita.common.nombre'),
      desc: t('recetas.recetas.varita.common.desc'),
      value: 26,
      kind: 'arma',
      rarity: 0,
      icon: 'varita',
      bonus: { Arcano: 1 },
    },
    good: {
      name: t('recetas.recetas.varita.good.nombre'),
      desc: t('recetas.recetas.varita.good.desc'),
      value: 50,
      kind: 'arma',
      rarity: 2,
      icon: 'varita',
      bonus: { Arcano: 2 },
    },
  },
  espadaLarga: {
    name: t('recetas.recetas.espadaLarga.nombre'),
    one: t('recetas.recetas.espadaLarga.one'),
    many: t('recetas.recetas.espadaLarga.many'),
    room: 'forja',
    icon: 'espada',
    kind: 'arma',
    gold: 35,
    hours: 10,
    free: true,
    mats: { hierro: 2 },
    common: {
      name: t('recetas.recetas.espadaLarga.common.nombre'),
      desc: t('recetas.recetas.espadaLarga.common.desc'),
      value: 40,
      kind: 'arma',
      rarity: 0,
      icon: 'espada',
      bonus: { Combate: 2 },
    },
    good: {
      name: t('recetas.recetas.espadaLarga.good.nombre'),
      desc: t('recetas.recetas.espadaLarga.good.desc'),
      value: 70,
      kind: 'arma',
      rarity: 2,
      icon: 'espada',
      bonus: { Combate: 3 },
    },
  },
  cota: {
    name: t('recetas.recetas.cota.nombre'),
    one: t('recetas.recetas.cota.one'),
    many: t('recetas.recetas.cota.many'),
    room: 'forja',
    icon: 'coraza',
    kind: 'armadura',
    gold: 40,
    hours: 12,
    free: true,
    mats: { hierro: 3 },
    common: {
      name: t('recetas.recetas.cota.common.nombre'),
      desc: t('recetas.recetas.cota.common.desc'),
      value: 45,
      kind: 'armadura',
      rarity: 0,
      icon: 'coraza',
      bonus: { Combate: 1 },
      perk: 'guard',
    },
    good: {
      name: t('recetas.recetas.cota.good.nombre'),
      desc: t('recetas.recetas.cota.good.desc'),
      value: 80,
      kind: 'armadura',
      rarity: 2,
      icon: 'coraza',
      bonus: { Combate: 2 },
      perk: 'guard',
    },
  },
  escudoTachonado: {
    name: t('recetas.recetas.escudoTachonado.nombre'),
    one: t('recetas.recetas.escudoTachonado.one'),
    many: t('recetas.recetas.escudoTachonado.many'),
    room: 'forja',
    icon: 'escudo',
    kind: 'armadura',
    gold: 35,
    hours: 10,
    free: true,
    mats: { hierro: 1, cuero: 2 },
    common: {
      name: t('recetas.recetas.escudoTachonado.common.nombre'),
      desc: t('recetas.recetas.escudoTachonado.common.desc'),
      value: 40,
      kind: 'armadura',
      rarity: 0,
      icon: 'escudo',
      bonus: { Combate: 2 },
    },
    good: {
      name: t('recetas.recetas.escudoTachonado.good.nombre'),
      desc: t('recetas.recetas.escudoTachonado.good.desc'),
      value: 72,
      kind: 'armadura',
      rarity: 2,
      icon: 'escudo',
      bonus: { Combate: 2, Supervivencia: 1 },
    },
  },
  ganzuasTempladas: {
    name: t('recetas.recetas.ganzuasTempladas.nombre'),
    one: t('recetas.recetas.ganzuasTempladas.one'),
    many: t('recetas.recetas.ganzuasTempladas.many'),
    room: 'forja',
    icon: 'ganzua',
    kind: 'herramienta',
    gold: 25,
    hours: 6,
    free: true,
    mats: { hierro: 2 },
    common: {
      name: t('recetas.recetas.ganzuasTempladas.common.nombre'),
      desc: t('recetas.recetas.ganzuasTempladas.common.desc'),
      value: 36,
      kind: 'herramienta',
      rarity: 0,
      icon: 'ganzua',
      bonus: { Trampas: 2 },
    },
    good: {
      name: t('recetas.recetas.ganzuasTempladas.good.nombre'),
      desc: t('recetas.recetas.ganzuasTempladas.good.desc'),
      value: 66,
      kind: 'herramienta',
      rarity: 2,
      icon: 'ganzua',
      bonus: { Trampas: 3 },
    },
  },
  botasCuero: {
    name: t('recetas.recetas.botasCuero.nombre'),
    one: t('recetas.recetas.botasCuero.one'),
    many: t('recetas.recetas.botasCuero.many'),
    room: 'sastreria',
    icon: 'botas',
    kind: 'herramienta',
    gold: 25,
    hours: 8,
    free: true,
    mats: { cuero: 2 },
    common: {
      name: t('recetas.recetas.botasCuero.common.nombre'),
      desc: t('recetas.recetas.botasCuero.common.desc'),
      value: 36,
      kind: 'herramienta',
      rarity: 0,
      icon: 'botas',
      bonus: { Supervivencia: 2 },
    },
    good: {
      name: t('recetas.recetas.botasCuero.good.nombre'),
      desc: t('recetas.recetas.botasCuero.good.desc'),
      value: 66,
      kind: 'herramienta',
      rarity: 2,
      icon: 'botas',
      bonus: { Supervivencia: 2, Trampas: 1 },
    },
  },
  capaForrada: {
    name: t('recetas.recetas.capaForrada.nombre'),
    one: t('recetas.recetas.capaForrada.one'),
    many: t('recetas.recetas.capaForrada.many'),
    room: 'sastreria',
    icon: 'capa',
    kind: 'herramienta',
    gold: 35,
    hours: 10,
    free: true,
    mats: { tela: 2, cuero: 1 },
    common: {
      name: t('recetas.recetas.capaForrada.common.nombre'),
      desc: t('recetas.recetas.capaForrada.common.desc'),
      value: 42,
      kind: 'herramienta',
      rarity: 0,
      icon: 'capa',
      bonus: { Supervivencia: 2 },
    },
    good: {
      name: t('recetas.recetas.capaForrada.good.nombre'),
      desc: t('recetas.recetas.capaForrada.good.desc'),
      value: 75,
      kind: 'herramienta',
      rarity: 2,
      icon: 'capa',
      bonus: { Supervivencia: 2 },
      perk: 'ambush',
    },
  },
};

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];

/** La receta que se puede sacar desmontando un objeto de este dibujo (si hay alguna). */
export const RECIPE_BY_ICON: Partial<Record<ItemIcon, RecipeId>> = Object.fromEntries(
  RECIPE_IDS.filter((id) => !RECIPES[id].mats).map((id) => [RECIPES[id].icon, id]),
);
