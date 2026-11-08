/**
 * Recetas de los talleres: lo que se puede crear, en qué sala, cuánto cuesta y cuánto tarda.
 * Cada una da un objeto normal o, a veces, uno bueno (raro, en azul) (según el herrero y el nivel de la sala).
 * Los legendarios no se crean: solo salen del botín. Las reglas están en core/crafting.ts.
 */
import type { ItemIcon, ItemKind } from '../core/model';
import type { GearBase } from './items';
import type { Mats } from '../core/materials';
import type { RoomType } from './rooms';

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
  forja: 'la forja',
  sastreria: 'la sastrería',
  alquimia: 'el taller de alquimia',
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
    name: 'Espada',
    one: 'una espada',
    many: 'espadas',
    room: 'forja',
    icon: 'espada',
    kind: 'arma',
    gold: 25,
    hours: 8,
    free: true,
    common: {
      name: 'Espada de la casa',
      desc: 'Recién salida del yunque del gremio. Sencilla, pero corta.',
      value: 22,
      kind: 'arma',
      rarity: 0,
      icon: 'espada',
      bonus: { Combate: 1 },
    },
    good: {
      name: 'Espada bien templada',
      desc: 'El herrero le dio un temple de los buenos. Canta al desenvainarla.',
      value: 48,
      kind: 'arma',
      rarity: 2,
      icon: 'espada',
      bonus: { Combate: 2 },
    },
  },
  coraza: {
    name: 'Coraza',
    one: 'una coraza',
    many: 'corazas',
    room: 'forja',
    icon: 'coraza',
    kind: 'armadura',
    gold: 30,
    hours: 10,
    free: true,
    common: {
      name: 'Coraza de la casa',
      desc: 'Chapa gruesa y correas nuevas. Pesa, pero para golpes.',
      value: 26,
      kind: 'armadura',
      rarity: 0,
      icon: 'coraza',
      perk: 'guard',
    },
    good: {
      name: 'Coraza remachada',
      desc: 'Cada remache en su sitio. Quien la lleva se planta sin miedo.',
      value: 52,
      kind: 'armadura',
      rarity: 2,
      icon: 'coraza',
      bonus: { Combate: 1 },
      perk: 'guard',
    },
  },
  ganzuas: {
    name: 'Ganzúas',
    one: 'unas ganzúas',
    many: 'ganzúas',
    room: 'forja',
    icon: 'ganzua',
    kind: 'herramienta',
    gold: 20,
    hours: 6,
    free: true,
    common: {
      name: 'Ganzúas de la casa',
      desc: 'Alambre bueno, bien doblado. Abren lo de siempre.',
      value: 20,
      kind: 'herramienta',
      rarity: 0,
      icon: 'ganzua',
      bonus: { Trampas: 1 },
    },
    good: {
      name: 'Ganzúas de acero fino',
      desc: 'Tan finas que se oyen pensar las cerraduras.',
      value: 46,
      kind: 'herramienta',
      rarity: 2,
      icon: 'ganzua',
      bonus: { Trampas: 2 },
    },
  },
  hacha: {
    name: 'Hacha',
    one: 'un hacha',
    many: 'hachas',
    room: 'forja',
    icon: 'hacha',
    kind: 'arma',
    gold: 45,
    hours: 12,
    common: {
      name: 'Hacha de la casa',
      desc: 'Copiada de un hacha enana. No tan buena, pero casi.',
      value: 40,
      kind: 'arma',
      rarity: 0,
      icon: 'hacha',
      bonus: { Combate: 2 },
    },
    good: {
      name: 'Hacha de doble filo',
      desc: 'Dos filos y un equilibrio que da gusto. Parte escudos.',
      value: 70,
      kind: 'arma',
      rarity: 2,
      icon: 'hacha',
      bonus: { Combate: 2, Supervivencia: 1 },
    },
  },
  escudo: {
    name: 'Escudo',
    one: 'un escudo',
    many: 'escudos',
    room: 'forja',
    icon: 'escudo',
    kind: 'armadura',
    gold: 45,
    hours: 12,
    common: {
      name: 'Escudo de la casa',
      desc: 'Madera con cantos de hierro y el escudo del gremio pintado.',
      value: 40,
      kind: 'armadura',
      rarity: 0,
      icon: 'escudo',
      bonus: { Combate: 1 },
      perk: 'guard',
    },
    good: {
      name: 'Escudo reforzado',
      desc: 'Con bullones de hierro. Más de una flecha se ha quedado ahí.',
      value: 70,
      kind: 'armadura',
      rarity: 2,
      icon: 'escudo',
      bonus: { Combate: 2 },
      perk: 'guard',
    },
  },
  botas: {
    name: 'Botas',
    one: 'unas botas',
    many: 'botas',
    room: 'sastreria',
    icon: 'botas',
    kind: 'herramienta',
    gold: 20,
    hours: 6,
    free: true,
    common: {
      name: 'Botas de la casa',
      desc: 'Cuero curtido y suela doble. Aguantan el barro.',
      value: 18,
      kind: 'herramienta',
      rarity: 0,
      icon: 'botas',
      bonus: { Supervivencia: 1 },
    },
    good: {
      name: 'Botas de caña alta',
      desc: 'Cosidas a medida. Se camina con ellas un día entero sin una ampolla.',
      value: 44,
      kind: 'herramienta',
      rarity: 2,
      icon: 'botas',
      bonus: { Supervivencia: 2 },
    },
  },
  capa: {
    name: 'Capa',
    one: 'una capa',
    many: 'capas',
    room: 'sastreria',
    icon: 'capa',
    kind: 'herramienta',
    gold: 30,
    hours: 8,
    common: {
      name: 'Capa de viaje',
      desc: 'Lana gruesa con capucha. Quita el frío y la lluvia.',
      value: 24,
      kind: 'herramienta',
      rarity: 0,
      icon: 'capa',
      bonus: { Supervivencia: 1 },
    },
    good: {
      name: 'Capa encerada',
      desc: 'Del color del monte. Quien la lleva se pierde entre los árboles.',
      value: 48,
      kind: 'herramienta',
      rarity: 2,
      icon: 'capa',
      bonus: { Supervivencia: 1 },
      perk: 'ambush',
    },
  },
  amuleto: {
    name: 'Amuleto',
    one: 'un amuleto',
    many: 'amuletos',
    room: 'alquimia',
    icon: 'amuleto',
    kind: 'amuleto',
    gold: 30,
    hours: 8,
    free: true,
    common: {
      name: 'Amuleto de la casa',
      desc: 'Una piedra con agujero y unas hierbas. Algo hace.',
      value: 20,
      kind: 'amuleto',
      rarity: 0,
      icon: 'amuleto',
      bonus: { Arcano: 1 },
    },
    good: {
      name: 'Amuleto bendecido',
      desc: 'Pasó tres noches en la capilla. Los malos agüeros no se le acercan.',
      value: 46,
      kind: 'amuleto',
      rarity: 2,
      icon: 'amuleto',
      bonus: { Arcano: 1 },
      perk: 'ward',
    },
  },
  varita: {
    name: 'Varita',
    one: 'una varita',
    many: 'varitas',
    room: 'alquimia',
    icon: 'varita',
    kind: 'arma',
    gold: 45,
    hours: 12,
    common: {
      name: 'Varita de avellano',
      desc: 'Recta y con su runa. Chisporrotea un poco.',
      value: 26,
      kind: 'arma',
      rarity: 0,
      icon: 'varita',
      bonus: { Arcano: 1 },
    },
    good: {
      name: 'Varita de fresno tallado',
      desc: 'Tallada a la luz de la luna, como manda el libro.',
      value: 50,
      kind: 'arma',
      rarity: 2,
      icon: 'varita',
      bonus: { Arcano: 2 },
    },
  },
  espadaLarga: {
    name: 'Espada larga',
    one: 'una espada larga',
    many: 'espadas largas',
    room: 'forja',
    icon: 'espada',
    kind: 'arma',
    gold: 35,
    hours: 10,
    free: true,
    mats: { hierro: 2 },
    common: {
      name: 'Espada larga',
      desc: 'Más hierro, más alcance. Se maneja a dos manos si hace falta.',
      value: 40,
      kind: 'arma',
      rarity: 0,
      icon: 'espada',
      bonus: { Combate: 2 },
    },
    good: {
      name: 'Espada larga de buen temple',
      desc: 'Larga, recta y con un filo que no se mella.',
      value: 70,
      kind: 'arma',
      rarity: 2,
      icon: 'espada',
      bonus: { Combate: 3 },
    },
  },
  cota: {
    name: 'Cota de malla',
    one: 'una cota de malla',
    many: 'cotas de malla',
    room: 'forja',
    icon: 'coraza',
    kind: 'armadura',
    gold: 40,
    hours: 12,
    free: true,
    mats: { hierro: 3 },
    common: {
      name: 'Cota de malla',
      desc: 'Miles de anillas de hierro. Pesa, pero para los golpes.',
      value: 45,
      kind: 'armadura',
      rarity: 0,
      icon: 'coraza',
      bonus: { Combate: 1 },
      perk: 'guard',
    },
    good: {
      name: 'Cota de malla doble',
      desc: 'Anillas dobles bajo un peto de cuero. Las flechas rebotan.',
      value: 80,
      kind: 'armadura',
      rarity: 2,
      icon: 'coraza',
      bonus: { Combate: 2 },
      perk: 'guard',
    },
  },
  escudoTachonado: {
    name: 'Escudo tachonado',
    one: 'un escudo tachonado',
    many: 'escudos tachonados',
    room: 'forja',
    icon: 'escudo',
    kind: 'armadura',
    gold: 35,
    hours: 10,
    free: true,
    mats: { hierro: 1, cuero: 2 },
    common: {
      name: 'Escudo tachonado',
      desc: 'Madera forrada de cuero y tachuelas de hierro.',
      value: 40,
      kind: 'armadura',
      rarity: 0,
      icon: 'escudo',
      bonus: { Combate: 2 },
    },
    good: {
      name: 'Escudo tachonado con bordón',
      desc: 'Con un borde de hierro que aguanta un hachazo.',
      value: 72,
      kind: 'armadura',
      rarity: 2,
      icon: 'escudo',
      bonus: { Combate: 2, Supervivencia: 1 },
    },
  },
  ganzuasTempladas: {
    name: 'Ganzúas templadas',
    one: 'unas ganzúas templadas',
    many: 'ganzúas templadas',
    room: 'forja',
    icon: 'ganzua',
    kind: 'herramienta',
    gold: 25,
    hours: 6,
    free: true,
    mats: { hierro: 2 },
    common: {
      name: 'Ganzúas templadas',
      desc: 'Acero templado: no se doblan en la cerradura más terca.',
      value: 36,
      kind: 'herramienta',
      rarity: 0,
      icon: 'ganzua',
      bonus: { Trampas: 2 },
    },
    good: {
      name: 'Ganzúas de cerrajero',
      desc: 'Un juego completo, en su estuche de cuero.',
      value: 66,
      kind: 'herramienta',
      rarity: 2,
      icon: 'ganzua',
      bonus: { Trampas: 3 },
    },
  },
  botasCuero: {
    name: 'Botas de cuero',
    one: 'unas botas de cuero',
    many: 'botas de cuero',
    room: 'sastreria',
    icon: 'botas',
    kind: 'herramienta',
    gold: 25,
    hours: 8,
    free: true,
    mats: { cuero: 2 },
    common: {
      name: 'Botas de cuero curtido',
      desc: 'Cuero de verdad, cosido a mano. Aguantan una semana de camino.',
      value: 36,
      kind: 'herramienta',
      rarity: 0,
      icon: 'botas',
      bonus: { Supervivencia: 2 },
    },
    good: {
      name: 'Botas de rastreador',
      desc: 'Suela blanda: no hacen ruido ni dejan huella.',
      value: 66,
      kind: 'herramienta',
      rarity: 2,
      icon: 'botas',
      bonus: { Supervivencia: 2, Trampas: 1 },
    },
  },
  capaForrada: {
    name: 'Capa forrada',
    one: 'una capa forrada',
    many: 'capas forradas',
    room: 'sastreria',
    icon: 'capa',
    kind: 'herramienta',
    gold: 35,
    hours: 10,
    free: true,
    mats: { tela: 2, cuero: 1 },
    common: {
      name: 'Capa forrada',
      desc: 'Doble tela y un cuello de cuero. Ni el viento de la sierra pasa.',
      value: 42,
      kind: 'herramienta',
      rarity: 0,
      icon: 'capa',
      bonus: { Supervivencia: 2 },
    },
    good: {
      name: 'Capa de montaraz',
      desc: 'Forrada, con bolsillos por dentro y del color del monte.',
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
