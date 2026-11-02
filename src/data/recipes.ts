/**
 * Recetas de los talleres: lo que se puede crear, en qué sala, cuánto cuesta y cuánto tarda.
 * Cada una da un objeto normal o, a veces, uno bueno (según el herrero y el nivel de la sala).
 * Los legendarios no se crean: solo salen del botín. Las reglas están en core/crafting.ts.
 */
import type { ItemIcon, ItemKind } from '../core/model';
import type { GearBase } from './items';
import type { RoomType } from './rooms';

export type RecipeId =
  'espada' | 'coraza' | 'ganzuas' | 'hacha' | 'escudo' | 'botas' | 'capa' | 'amuleto' | 'varita';

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
      rarity: 1,
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
      rarity: 1,
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
      rarity: 1,
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
      rarity: 1,
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
      rarity: 1,
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
      rarity: 1,
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
      rarity: 1,
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
      rarity: 1,
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
      rarity: 1,
      icon: 'varita',
      bonus: { Arcano: 2 },
    },
  },
};

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];

/** La receta que se puede sacar desmontando un objeto de este dibujo (si hay alguna). */
export const RECIPE_BY_ICON: Partial<Record<ItemIcon, RecipeId>> = Object.fromEntries(
  RECIPE_IDS.map((id) => [RECIPES[id].icon, id]),
);
