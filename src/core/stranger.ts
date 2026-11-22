/**
 * El forastero de la tormenta: el primer suceso nocturno (ver `night.ts`). Solo en noches de
 * tormenta y si hay algún caído; entra en el salón, se sienta junto al fuego y ofrece traer de
 * vuelta a un caído a cambio de oro, raciones, jarras y tela. Si no se le dice nada, se va al
 * día siguiente a mediodía. El revivido vuelve en cama, con la moral por los suelos unos días y
 * con un rasgo para siempre («Vuelto del velo»).
 */
import {
  DAY_SECONDS,
  STRANGER_CHANCE,
  STRANGER_EVERY,
  STRANGER_LEAVE,
  VEIL_BED,
  VEIL_DAYS,
  VEIL_MORALE,
  strangerPrice,
} from './balance';
import { hasMats, matOf, spendMats, type Mats } from './materials';
import type { DawnEvent, GameState, Hero } from './model';
import type { NightEvent } from './night';
import { stormNight } from './sky';
import { type Txt, idText, msg, t } from '../textos';

/** Los caídos que se pueden traer de vuelta (el héroe entero se guarda al caer). */
export const fallenHeroes = (s: GameState) => s.heroes.filter((h) => h.status === 'muerto');

export const STRANGER_EVENT: NightEvent = {
  id: 'forastero',
  when: (s) => !s.stranger && stormNight(s.seed, s.day) && fallenHeroes(s).length > 0,
  chance: () => STRANGER_CHANCE,
  every: STRANGER_EVERY,
  start: (s) => {
    s.stranger = { day: s.day, at: s.clock ?? 0 };
    return { t: msg('forastero.llega'), k: 'warn' };
  },
};

export interface Price {
  gold: number;
  food: number;
  beer: number;
  mats: Mats;
}

/** Lo que pide por un caído: sube con su nivel. */
export function priceFor(h: Hero): Price {
  const p = strangerPrice(h.lvl);
  return { gold: p.gold, food: p.food, beer: p.beer, mats: { tela: p.tela } };
}

/** Lo que falta para pagarle (vacío si llega). */
export function shortOf(s: GameState, p: Price): string[] {
  const out: string[] = [];
  if (s.gold < p.gold) out.push(t('forastero.monedas', { n: p.gold - s.gold }));
  if (s.food < p.food) out.push(t('forastero.raciones', { n: p.food - s.food }));
  if (s.beer < p.beer) out.push(t('forastero.jarras', { n: p.beer - s.beer }));
  const tela = (p.mats.tela ?? 0) - matOf(s, 'tela');
  if (tela > 0)
    out.push(t('materiales.cuanto', { n: tela, material: msg('materiales.tela.nombre') }));
  return out;
}

/** Por qué no se puede traer a ese caído ahora (null: se puede). */
export function reviveIssue(s: GameState, id: string): string | null {
  if (!s.stranger) return t('forastero.se_fue');
  const h = s.heroes.find((x) => x.id === id);
  if (!h || h.status !== 'muerto') return t('forastero.no_caido');
  const p = priceFor(h);
  if (s.gold < p.gold || s.food < p.food || s.beer < p.beer || !hasMats(s, p.mats))
    return t('forastero.falta', { que: shortOf(s, p).join(', ') });
  return null;
}

const fullName = (h: Hero): Txt =>
  h.nick ? msg('general.apodado', { nombre: h.name, apodo: h.nick }) : h.name;

/** Su línea del Muro de los caídos (por id o, en las de antes, por el nombre). */
const wallEntry = (s: GameState, h: Hero) =>
  s.fallen.find((f) => !f.back && f.id === h.id) ??
  s.fallen.find((f) => !f.back && !f.id && idText(f.name) === idText(fullName(h)));

/** Trae de vuelta a un caído (ya comprobado con `reviveIssue`). Muta `s`; devuelve el aviso. */
export function revive(s: GameState, id: string): DawnEvent {
  const h = s.heroes.find((x) => x.id === id)!;
  const p = priceFor(h);
  s.gold -= p.gold;
  s.food -= p.food;
  s.beer -= p.beer;
  spendMats(s, p.mats);
  const entry = wallEntry(s, h);
  if (entry) entry.back = s.day;
  // Vuelve en cama, sin ganas de nada y sin lo que llevaba aprendido hacia el siguiente nivel.
  h.status = 'herido';
  h.days = VEIL_BED;
  h.morale = VEIL_MORALE;
  h.xp = 0;
  h.idle = 0;
  h.veil = s.day + VEIL_DAYS;
  for (const k of [
    'guard',
    'post',
    'job',
    'jobBefore',
    'guardBefore',
    'request',
    'walk',
    'since',
    'lostAt',
    'grudge',
  ] as const)
    delete h[k];
  if (!h.traits.some((t) => t.id === 'velo')) h.traits.push({ id: 'velo' });
  h.history.push(msg('forastero.historial', { dia: s.day }));
  if (s.stats) s.stats.revived = (s.stats.revived ?? 0) + 1;
  s.stranger = null;
  return {
    t: msg('forastero.vuelve', { heroe: h.name, sexo: h.sex }),
    k: 'good',
  };
}

/** Rechazar la oferta: se va con la tormenta. */
export function dismiss(s: GameState): DawnEvent {
  s.stranger = null;
  return { t: msg('forastero.rechazado') };
}

/** Si ya es hora de que se vaya (al día siguiente de llegar, a mediodía). */
export const strangerGone = (s: GameState, clock = s.clock ?? 0) =>
  !!s.stranger && s.day > s.stranger.day && clock >= STRANGER_LEAVE * DAY_SECONDS;

/** Con el reloj: si ya es hora, se va (muta `s`, ya copiado) y lo dice. */
export function stepStranger(s: GameState): DawnEvent | null {
  if (!strangerGone(s)) return null;
  s.stranger = null;
  return {
    t: msg('forastero.se_va'),
  };
}
