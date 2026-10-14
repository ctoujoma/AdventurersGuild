import type { Item, QuestType, TrophyIcon } from '../core/model';

/**
 * Catálogo de botín. El equipo tiene tipo, rareza (0 común, 1 bueno, 2 legendario),
 * bonificaciones y a veces un efecto; los tesoros solo se venden; los trofeos se exhiben.
 */

export type GearBase = Omit<Item, 'id'>;

export const GEAR: readonly GearBase[] = [
  // Común.
  {
    name: 'Espada oxidada',
    desc: 'Con una buena limpieza, quizá corte algo.',
    value: 20,
    kind: 'arma',
    rarity: 0,
    icon: 'espada',
    bonus: { Combate: 1 },
  },
  {
    name: 'Ganzúas de alambre',
    desc: 'Dobladas a mano. Abren casi todo, si se les da tiempo.',
    value: 18,
    kind: 'herramienta',
    rarity: 0,
    icon: 'ganzua',
    bonus: { Trampas: 1 },
  },
  {
    name: 'Botas remendadas',
    desc: 'Tienen más parches que cuero, pero no calan.',
    value: 16,
    kind: 'herramienta',
    rarity: 0,
    icon: 'botas',
    bonus: { Supervivencia: 1 },
  },
  {
    name: 'Talismán de ajo',
    desc: 'Ahuyenta espíritus. Y amigos.',
    value: 16,
    kind: 'amuleto',
    rarity: 0,
    icon: 'amuleto',
    bonus: { Arcano: 1 },
  },
  {
    name: 'Coraza abollada',
    desc: 'Está llena de bollos, pero sigue parando golpes.',
    value: 24,
    kind: 'armadura',
    rarity: 0,
    icon: 'coraza',
    perk: 'guard',
  },
  // Bueno.
  {
    name: 'Hacha de leñador enano',
    desc: 'Pesa lo suyo, pero parte un tronco de un tajo.',
    value: 48,
    kind: 'arma',
    rarity: 1,
    icon: 'hacha',
    bonus: { Combate: 2 },
  },
  {
    name: 'Ganzúas finas',
    desc: 'Estuche de terciopelo. Alguien las echará de menos.',
    value: 44,
    kind: 'herramienta',
    rarity: 1,
    icon: 'ganzua',
    bonus: { Trampas: 2 },
  },
  {
    name: 'Capa de explorador',
    desc: 'Parda y verdosa. Tumbado en el monte, no te ve ni tu madre.',
    value: 46,
    kind: 'herramienta',
    rarity: 1,
    icon: 'capa',
    bonus: { Supervivencia: 1 },
    perk: 'ambush',
  },
  {
    name: 'Amuleto de hueso',
    desc: 'Huele a humo y a otra cosa. La mala suerte no se le acerca.',
    value: 42,
    kind: 'amuleto',
    rarity: 1,
    icon: 'amuleto',
    bonus: { Arcano: 1 },
    perk: 'ward',
  },
  {
    name: 'Escudo con blasón',
    desc: 'Lleva las armas de una casa noble que se extinguió hace años.',
    value: 50,
    kind: 'armadura',
    rarity: 1,
    icon: 'escudo',
    bonus: { Combate: 1 },
    perk: 'guard',
  },
  {
    name: 'Varita de serbal',
    desc: 'Tiembla un poco cuando hay magia cerca.',
    value: 48,
    kind: 'arma',
    rarity: 1,
    icon: 'varita',
    bonus: { Arcano: 2 },
  },
  // Legendario.
  {
    name: 'Hoja de Vadoverde',
    desc: 'Se hizo para un rey que murió sin estrenarla. Silba al cortar.',
    value: 120,
    kind: 'arma',
    rarity: 2,
    icon: 'espada',
    bonus: { Combate: 3 },
    perk: 'luck',
  },
  {
    name: 'Capa élfica',
    desc: 'Quien la lleva no hace ruido ni deja huella.',
    value: 110,
    kind: 'herramienta',
    rarity: 2,
    icon: 'capa',
    bonus: { Supervivencia: 2, Trampas: 1 },
    perk: 'ambush',
  },
  {
    name: 'Varita de la Abuela Tormenta',
    desc: 'Huele a lluvia. A veces truena dentro del bolsillo.',
    value: 115,
    kind: 'arma',
    rarity: 2,
    icon: 'varita',
    bonus: { Arcano: 3 },
    perk: 'ward',
  },
  {
    name: 'Botas de siete leguas',
    desc: 'De un carretero de los Ferrán. Con ellas los caminos se acortan, o eso parece.',
    value: 110,
    kind: 'herramienta',
    rarity: 2,
    icon: 'botas',
    bonus: { Supervivencia: 3 },
    perk: 'ambush',
  },
  {
    name: 'Corona del Rey Ahogado',
    desc: 'Verde de algas y fría como el fondo de la laguna. Quien la lleva no teme a los muertos.',
    value: 125,
    kind: 'amuleto',
    rarity: 2,
    icon: 'amuleto',
    bonus: { Arcano: 2, Supervivencia: 1 },
    perk: 'ward',
  },
  {
    name: 'Coraza de escamas de sierpe',
    desc: 'Hecha con las escamas de la sierpe de Sierra Parda. No arde ni con brasas.',
    value: 140,
    kind: 'armadura',
    rarity: 2,
    icon: 'coraza',
    bonus: { Combate: 2, Supervivencia: 2 },
    perk: 'guard',
  },
];

export const TREASURES: readonly GearBase[] = [
  {
    name: 'Colmillos de huargo',
    desc: 'La tienda de pociones los compraría.',
    value: 24,
    kind: 'tesoro',
  },
  {
    name: 'Llave de hierro negro',
    desc: 'No abre ninguna puerta de la comarca. Ya se ha probado.',
    value: 10,
    kind: 'tesoro',
  },
  {
    name: 'Mapa a medio quemar',
    desc: 'Falta justo la parte importante.',
    value: 15,
    kind: 'tesoro',
  },
  {
    name: 'Reliquia sin nombre',
    desc: 'Sigue tibia aunque pase la noche al raso.',
    value: 60,
    kind: 'tesoro',
  },
  {
    name: 'Bolsa de gemas turbias',
    desc: 'Brillan menos de lo que prometen.',
    value: 45,
    kind: 'tesoro',
  },
  { name: 'Cáliz de plata', desc: 'Con el escudo de un monasterio.', value: 40, kind: 'tesoro' },
];

export const RARITY_NAMES = ['Común', 'Bueno', 'Legendario'] as const;

export const PERK_INFO: Record<NonNullable<Item['perk']>, string> = {
  guard: 'Quien lo lleva se hiere la mitad',
  luck: 'Repite una tirada fallida por misión',
  ward: 'Anula al gafe del grupo',
  ambush: 'Esquiva la mitad de las emboscadas',
};

/** Trofeos por tipo de encargo: solo tras un éxito brillante en encargos peligrosos. */
export const TROPHIES: Record<
  QuestType,
  readonly { name: string; desc: string; icon: TrophyIcon }[]
> = {
  Cazar: [
    { name: 'Cabeza de huargo', desc: 'Aún enseña los dientes.', icon: 'cabeza' },
    { name: 'Colmillos de basilisco', desc: 'Nadie quiere mirarlos de frente.', icon: 'colmillos' },
    { name: 'Cabeza de jabalí negro', desc: 'Dicen que derribó un molino.', icon: 'cabeza' },
  ],
  Limpiar: [
    {
      name: 'Estandarte orco',
      desc: 'Huele igual que el día que lo trajeron.',
      icon: 'estandarte',
    },
    { name: 'Calavera del rey de las ratas', desc: 'Lleva una corona diminuta.', icon: 'calavera' },
  ],
  Explorar: [
    { name: 'Ídolo de jade', desc: 'Sus ojos siguen a quien pasa.', icon: 'idolo' },
    { name: 'Calavera con runas', desc: 'Las runas brillan cuando llueve.', icon: 'calavera' },
  ],
  Investigar: [
    {
      name: 'Máscara del culto',
      desc: 'Tiene una sonrisa que no le gusta a nadie.',
      icon: 'mascara',
    },
    {
      name: 'Estandarte de la hermandad',
      desc: 'De la hermandad ya no queda nadie.',
      icon: 'estandarte',
    },
  ],
  Recuperar: [
    { name: 'Ídolo del templo hundido', desc: 'Pesa más de lo que parece.', icon: 'idolo' },
    { name: 'Máscara del ladrón sin rostro', desc: 'Por dentro está caliente.', icon: 'mascara' },
  ],
  Escoltar: [
    {
      name: 'Estandarte de los bandidos',
      desc: 'Capturado en el camino real.',
      icon: 'estandarte',
    },
    { name: 'Colmillos del lobo blanco', desc: 'Atacó la caravana y perdió.', icon: 'colmillos' },
  ],
};

/** Resumen corto de lo que hace un objeto: «+2 Combate · Esquiva emboscadas». */
export function itemEffect(it: Item): string {
  const parts = Object.entries(it.bonus ?? {}).map(([k, v]) => `+${v} ${k}`);
  if (it.perk) parts.push(PERK_INFO[it.perk]);
  return parts.join(' · ') || 'Solo vale lo que te den por él';
}
