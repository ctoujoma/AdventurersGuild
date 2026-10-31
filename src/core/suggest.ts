/**
 * El grupo sugerido para un encargo: entre quienes pueden ir, se va sumando al que más mejora la
 * estimación hasta que nadie la mejora o no caben más. No busca entre todas las combinaciones:
 * basta con eso para un botón de «Sugerir», y el jugador puede cambiarla antes de enviar.
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
  const party: Hero[] = [];
  let best = -Infinity;
  while (party.length < q.slots) {
    let pick: Hero | null = null;
    let pickScore = -Infinity;
    for (const h of pool) {
      if (party.includes(h)) continue;
      const next = [...party, h];
      const ids = next.map((x) => x.id);
      if (canSend(s, q.id, ids)) continue;
      const v = score(next);
      if (v > pickScore) {
        pick = h;
        pickScore = v;
      }
    }
    // El primero va siempre (si alguien puede); los demás, solo si mejoran de verdad.
    if (!pick || (party.length && pickScore < best + GAIN)) break;
    party.push(pick);
    best = pickScore;
  }
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
