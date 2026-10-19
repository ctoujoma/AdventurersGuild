/**
 * Los que vienen a la taberna: cuánto gastan y lo que traen. Las cifras de cuántos vienen están
 * en core/balance.ts y las reglas en core/salon.ts.
 */
export type VisitorKind = 'campesino' | 'mercader' | 'noble' | 'espia';

export const VISITORS: Record<
  VisitorKind,
  { name: string; plural: string; spend: number; desc: string }
> = {
  campesino: {
    name: 'campesino',
    plural: 'campesinos',
    spend: 2,
    desc: 'Gastan poco, pero vienen siempre.',
  },
  mercader: {
    name: 'mercader',
    plural: 'mercaderes',
    spend: 5,
    desc: 'Pagan bien y llegan con la fama del gremio.',
  },
  noble: {
    name: 'noble',
    plural: 'nobles',
    spend: 8,
    desc: 'Solo vienen a un salón con mucho Atractivo. Dan fama.',
  },
  espia: {
    name: 'forastero callado',
    plural: 'forasteros callados',
    spend: 2,
    desc: 'Mira mucho y bebe poco: puede ser un espía de los bandidos.',
  },
};

/** Lo que se oye en el salón al pararse junto a una mesa. */
export const RUMORS: readonly string[] = [
  'Dicen que en el molino viejo se oyen cadenas de noche.',
  'Al hijo del herrero le han visto hablando con los del bosque.',
  'La cosecha viene buena, si no la pisan los jabalíes.',
  'En la feria de Robledo pagan el doble por pieles de lobo.',
  'Hay quien jura que la mina de Hondogrís no está vacía.',
  'El prestamista Merlo ha comprado otra casa. Otra.',
  'Por el camino del norte bajan carros sin escolta. Mala idea.',
  'Esta cerveza es mejor que la de la posada del cruce.',
  'Mi primo dice que vio un dragón. Mi primo ve muchas cosas.',
  'Los bandidos del Tuerto se reparten el botín en la ermita.',
];
