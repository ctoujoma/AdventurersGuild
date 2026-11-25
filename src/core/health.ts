/**
 * La vida de los héroes, que se guarda entre peleas (decidido con el usuario, 24 de noviembre).
 * `Hero.hp` va de 0 a 1 (sin él, entero). Con el 50 % o más, sano; por debajo, herido leve:
 * trabaja peor (cuanto más herido, peor, hasta la mitad) y no hace guardia, pero puede salir; por
 * debajo del 20 %, herido grave: en cama (`status: 'herido'`). A 0, la baja (`resolve.ts`).
 * Se recupera hora a hora en casa (más deprisa en un catre de la enfermería con quien la atienda).
 */
import { HP_DAY, HP_GRAVE, HP_LIGHT, LIGHT_WORK_MIN } from './balance';
import type { GameState, Hero } from './model';
import { msg, type Msg } from '../textos';

export type Health = 'sano' | 'leve' | 'grave';

/** La vida de ahora (0–1). Las partidas de antes no la tienen: entero, o grave si está en cama. */
export const hpOf = (h: Pick<Hero, 'hp' | 'status' | 'days'>): number =>
  h.hp ?? (h.status === 'herido' ? hpFromBedDays(h.days) : 1);

export function healthOf(h: Pick<Hero, 'hp' | 'status' | 'days'>): Health {
  const hp = hpOf(h);
  if (h.status === 'herido' || hp < HP_GRAVE) return 'grave';
  return hp < HP_LIGHT ? 'leve' : 'sano';
}

/** Herido leve (en pie, pero tocado). */
export const isLight = (h: Pick<Hero, 'hp' | 'status' | 'days'>) => healthOf(h) === 'leve';

/**
 * Lo que rinde trabajando (1 sano): en el tramo leve baja en línea recta desde 1 (al 50 %) hasta
 * `LIGHT_WORK_MIN` (al 20 %).
 */
export function workFactor(h: Pick<Hero, 'hp' | 'status' | 'days'>): number {
  const hp = hpOf(h);
  if (hp >= HP_LIGHT) return 1;
  const k = Math.max(0, Math.min(1, (HP_LIGHT - hp) / (HP_LIGHT - HP_GRAVE)));
  return 1 - (1 - LIGHT_WORK_MIN) * k;
}

/**
 * Le deja la vida en `hp` (0–1): por debajo del 20 %, a la cama (deja su puesto y la guardia,
 * para volver a ellos al levantarse); en el tramo leve, sin guardia. No mata: la baja (a 0) la
 * decide quien llama. Muta `h`.
 */
export function setHp(h: Hero, hp: number): void {
  h.hp = Math.max(0, Math.min(1, hp));
  if (h.hp < HP_GRAVE) {
    if (h.status === 'ok') {
      if (h.job) h.jobBefore = h.job;
      if (h.guard) h.guardBefore = true;
    }
    h.status = 'herido';
    h.days = 0;
    delete h.job;
    delete h.guard;
    return;
  }
  if (h.hp < HP_LIGHT && h.guard) {
    // Con heridas no se hace guardia: vuelve a ella al estar sano.
    h.guardBefore = true;
    delete h.guard;
  }
}

/** Quita `amount` de vida (0–1). */
export const hurt = (h: Hero, amount: number) => setHp(h, hpOf(h) - amount);

/**
 * La vida que corresponde a unos «días de cama» de antes (lo que traen las partidas guardadas y
 * los sucesos que hieren por días): grave, más cuanto más días.
 */
export const hpFromBedDays = (days: number) => Math.max(0.03, HP_GRAVE - 0.04 * Math.max(0, days));

/** Lo que se recupera por día de juego con este ritmo (×1, en su cama). */
export const regenPerDay = (rate: number) => HP_DAY * rate;

/** Los héroes que se curan en casa (en pie o en cama; no los de fuera). */
export const atHome = (h: Hero) => h.status === 'ok' || h.status === 'herido';

/** Necesita curarse. */
export const needsCare = (h: Hero) => atHome(h) && hpOf(h) < 1;

/** Cuántos están tocados o en cama, para avisos. */
export const woundedCount = (s: GameState) =>
  s.heroes.filter((h) => atHome(h) && healthOf(h) !== 'sano').length;

/** Las huecos de las frases de una herida: quién, si es grave y la vida que le queda. */
export const woundParams = (h: Hero) => ({
  heroe: h.name,
  sexo: h.sex,
  grave: healthOf(h) === 'grave',
  pct: Math.round(hpOf(h) * 100),
});

/** La chapa de un informe para un herido (leve o grave, con su vida). */
export const woundChip = (h: Hero): Msg => msg('informes.chip_herida', woundParams(h));
