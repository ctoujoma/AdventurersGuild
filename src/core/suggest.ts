/**
 * El grupo sugerido para un encargo: prueba todos los grupos posibles entre quienes pueden ir
 * (con 13 héroes y 4 plazas son 1.092) y se queda con el mejor. Uno más solo va si mejora de
 * verdad la estimación: a igualdad, cuantos menos, mejor (quedan libres para otra cosa).
 */
import { canSend } from './game';
import type { GameState, Hero } from './model';
import { MORALE_LOW } from './party';
import { questEstimate } from './resolve';

/** Lo que tiene que mejorar la estimación para que merezca la pena llevar a uno más. */
const GAIN = 0.02;
/** Lo que pesa en contra llevar a alguien con la moral baja (a igualdad, mejor otro). */
const LOW_MORALE = 0.05;

export type Suggestion = { ids: string[] } | { why: string };

/** Quién puede ir hoy: en casa, sin guardia (y sin la guardia no queda la puerta sola). */
const free = (s: GameState) => s.heroes.filter((h) => h.status === 'ok' && !h.guard);

export function suggestParty(s: GameState, questId: string): Suggestion {
  const q = s.quests.find((x) => x.id === questId);
  if (!q) return { why: 'Ese encargo ya no está en el tablón.' };
  const pool = free(s);
  if (!pool.length)
    return {
      why: s.heroes.some((h) => h.status === 'ok')
        ? 'Los que están en casa hacen guardia.'
        : 'No hay nadie en casa para ir.',
    };
  const score = (party: Hero[]) =>
    questEstimate(q, party, s.fac).total -
    party.filter((h) => h.morale < MORALE_LOW).length * LOW_MORALE;
  // El mejor grupo de cada tamaño, probando todas las combinaciones.
  const bestOf: { party: Hero[]; v: number }[] = [];
  const pick: Hero[] = [];
  const walk = (from: number) => {
    if (pick.length) {
      if (
        canSend(
          s,
          q.id,
          pick.map((h) => h.id),
        )
      )
        return; // Y con más gente tampoco (arrogante).
      const v = score(pick);
      const k = pick.length - 1;
      if (!bestOf[k] || v > bestOf[k].v) bestOf[k] = { party: [...pick], v };
    }
    if (pick.length >= q.slots) return;
    for (let i = from; i < pool.length; i++) {
      pick.push(pool[i]!);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  // De menos a más gente: cada uno de más tiene que ganar lo suyo.
  let chosen: { party: Hero[]; v: number } | undefined;
  for (const b of bestOf) {
    if (!b) continue;
    if (!chosen || b.v >= chosen.v + GAIN * (b.party.length - chosen.party.length)) chosen = b;
  }
  // Primero, el que más ayuda por sí solo.
  const solo = new Map(chosen?.party.map((h) => [h, score([h])]));
  const party = (chosen?.party ?? []).sort((a, b) => solo.get(b)! - solo.get(a)!);
  if (!party.length) return { why: 'Nadie de los que están en casa puede ir a este encargo.' };
  return { ids: party.map((h) => h.id) };
}

/** El grupo de la última vez, para repetirlo: quién vuelve a ir y a quién se salta (y por qué). */
export interface Repeat {
  /** En una historia, el grupo de su paso anterior; si no, el último que salió. */
  from: 'paso' | 'ultima';
  ids: string[];
  /** «Brena sigue herida», «Tom está de guardia»… */
  skipped: string[];
}

/** Por qué alguien del grupo de antes no puede ir ahora (null: puede). */
function busy(h: Hero | undefined): string | null {
  if (!h) return null;
  const a = (m: string, f: string) => (h.sex === 'f' ? f : m);
  if (h.status === 'herido') return `${h.name} sigue ${a('herido', 'herida')}`;
  if (h.status === 'mision') return `${h.name} está de misión`;
  if (h.status !== 'ok') return `${h.name} ya no está en el gremio`;
  if (h.guard) return `${h.name} está de guardia`;
  return null;
}

export function repeatParty(s: GameState, questId: string): Repeat | null {
  const q = s.quests.find((x) => x.id === questId);
  if (!q) return null;
  const step = q.chain && s.chains?.find((c) => c.id === q.chain!.id)?.party;
  const before = step ?? s.lastParty;
  if (!before?.length) return null;
  const ids: string[] = [];
  const skipped: string[] = [];
  for (const id of before) {
    const h = s.heroes.find((x) => x.id === id);
    if (!h) continue; // Despedido: ni se nombra.
    const why = busy(h);
    if (why) skipped.push(why);
    else if (ids.length < q.slots) ids.push(id);
    else skipped.push(`${h.name} no cabe: este encargo admite ${q.slots}`);
  }
  return { from: step ? 'paso' : 'ultima', ids, skipped };
}
