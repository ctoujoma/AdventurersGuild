/**
 * Los sucesos con decisión de las expediciones (bloque 2; decidido con el usuario, EX9, EX11 y
 * EX17): cada uno con sus opciones. Una opción puede pedir una clase (si no va nadie de esa
 * clase, sale tachada) y depender de un atributo (la pista de riesgo lo dice). La prudente es la
 * que eligen ellos si nadie dice nada. Los textos, en `expediciones.sucesos.<suceso>`; lo que pasa
 * al elegir, en `core/expedition.ts`.
 */
import type { AttrId, ClassId } from '../core/party';
import type { Heading } from '../core/model';

export type ExpEvent =
  | 'cofre'
  | 'santuario'
  | 'mercader'
  | 'viajero'
  | 'campamento'
  | 'oso'
  | 'cueva'
  | 'torre'
  | 'ruinas'
  | 'guardian';

export interface ExpOption {
  id: string;
  /** Hace falta alguien de esta clase (en pie). */
  cls?: ClassId;
  /** De qué atributo depende que salga bien (el mejor del grupo). */
  attr?: AttrId;
  /** Lo que eligen ellos con prudencia si no se dice nada. */
  safe?: boolean;
  /** Lo difícil que es de por sí (se suma a la lejanía). */
  hard?: number;
}

export interface ExpEventDef {
  /** Un sitio donde se puede entrar: espera hasta un día (los demás, hasta la noche). */
  site?: boolean;
  /** Desde qué lejanía (días) puede salir y cuánto pesa al sortear. */
  from: number;
  weight: number;
  /** Rumbos donde sale (sin nada, en todos). */
  headings?: readonly Heading[];
  options: readonly ExpOption[];
}

export const EXP_EVENTS: Record<ExpEvent, ExpEventDef> = {
  cofre: {
    from: 0,
    weight: 3,
    options: [
      { id: 'forzar', cls: 'guerrero', attr: 'F' },
      { id: 'ganzua', cls: 'picaro', attr: 'D', hard: -2 },
      { id: 'dejar', safe: true },
    ],
  },
  santuario: {
    from: 1,
    weight: 2,
    options: [{ id: 'rezar', cls: 'clerigo' }, { id: 'ofrenda' }, { id: 'seguir', safe: true }],
  },
  mercader: {
    from: 1,
    weight: 2,
    options: [{ id: 'comprar' }, { id: 'vender' }, { id: 'seguir', safe: true }],
  },
  viajero: {
    from: 0.5,
    weight: 2,
    options: [
      { id: 'unirse', attr: 'M' },
      { id: 'calar', cls: 'clerigo' },
      { id: 'seguir', safe: true },
    ],
  },
  campamento: {
    from: 0,
    weight: 3,
    options: [
      { id: 'registrar', attr: 'D' },
      { id: 'rastrear', cls: 'explorador' },
      { id: 'seguir', safe: true },
    ],
  },
  oso: {
    from: 1,
    weight: 2,
    options: [
      { id: 'plantar', cls: 'guerrero' },
      { id: 'rodear', cls: 'explorador', attr: 'D', hard: -3 },
      { id: 'retroceder', safe: true },
    ],
  },
  cueva: {
    site: true,
    from: 1,
    weight: 2,
    options: [
      { id: 'entrar', attr: 'F', hard: 1 },
      { id: 'cuidado', cls: 'explorador', attr: 'D', hard: -1 },
      { id: 'seguir', safe: true },
    ],
  },
  torre: {
    site: true,
    from: 2,
    weight: 1.5,
    options: [
      { id: 'subir', attr: 'D' },
      { id: 'cerradura', cls: 'picaro', attr: 'D', hard: -2 },
      { id: 'seguir', safe: true },
    ],
  },
  ruinas: {
    site: true,
    from: 3,
    weight: 1.5,
    options: [
      { id: 'runas', cls: 'mago', attr: 'M', hard: -1 },
      { id: 'forzar', cls: 'guerrero', attr: 'F', hard: 2 },
      { id: 'seguir', safe: true },
    ],
  },
  // El guardián: raro y lejos; avisa y espera un rato; si nadie dice nada, pelean.
  guardian: {
    from: 4,
    weight: 0,
    options: [{ id: 'pelear', safe: true }, { id: 'volver' }],
  },
};

export const EXP_EVENT_LIST = Object.keys(EXP_EVENTS) as ExpEvent[];
