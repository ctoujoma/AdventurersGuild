/**
 * Rumores de la barra: con el juego abierto, de vez en cuando se oye algo en el salón unos
 * segundos. Si se toca a tiempo, sale un encargo especial con mejor paga y botín bueno o
 * legendario; si no, se pierde y no pasa nada. Los textos están en `data/rumors.ts`.
 */
import { GEAR } from '../data/items';
import { RUMORS } from '../data/rumors';
import {
  DAY_SECONDS,
  DUSK,
  RUMOR_EVERY,
  RUMOR_FROM_DAY,
  RUMOR_LEGEND,
  RUMOR_MIN_PAY,
  RUMOR_PAY,
  RUMOR_SECS,
  rankIndex,
} from './balance';
import { generateQuest } from './generate';
import type { ChipKind, GameState, Quest } from './model';
import { Rng } from './rng';
import { active } from './rooms';

/** Sala donde se oye (el salón en uso), si hay. */
export const rumorRoom = (s: GameState) =>
  s.building.rooms.find((r) => r.type === 'salon' && active(r).level > 0)?.id ?? null;

/**
 * Avanza los rumores del reloj `from` al `to`: el que no se ha tocado se pierde y, de vez en
 * cuando, se oye uno nuevo. Uno a la vez, y otro no mientras haya un encargo de rumor en el
 * tablón. Muta `s` (una copia).
 */
export function stepRumors(s: GameState, from: number, to: number): void {
  if (s.rumor && s.rumor.until <= to) s.rumor = undefined;
  if (s.rumor || s.over || s.day < RUMOR_FROM_DAY || !rumorRoom(s)) return;
  if (s.quests.some((q) => q.rumor)) return;
  if (to + RUMOR_SECS >= DUSK * DAY_SECONDS) return;
  const rng = new Rng(s.rng);
  if (rng.chance(Math.max(0, to - from) / RUMOR_EVERY)) {
    s.rumor = { id: `ru${s.uid++}`, text: rng.pick(RUMORS), from: to, until: to + RUMOR_SECS };
  }
  s.rng = rng.save();
}

/** El encargo que sale de un rumor: en el sitio del que se habla, mejor pagado y con botín. */
export function rumorQuest(s: GameState, rng: Rng, text: string): Quest {
  const rank = rankIndex(s.rep);
  // Que no se llame igual que otro del tablón.
  const taken = new Set(s.quests.map((x) => x.title));
  let q = generateQuest(rng, `q${s.uid++}`, rank, `i${s.uid++}`, s.mode === 'libre');
  for (let i = 0; i < 8 && taken.has(q.title); i++)
    q = generateQuest(rng, `q${s.uid++}`, rank, `i${s.uid++}`, s.mode === 'libre');
  const rarity = rng.chance(RUMOR_LEGEND) ? 2 : 1;
  const base = rng.pick(GEAR.filter((g) => g.rarity === rarity));
  return {
    ...q,
    text: `${text.replace('{place}', q.place)} ${q.text}`,
    reward: Math.max(RUMOR_MIN_PAY * (1 + rank), Math.round((q.reward * RUMOR_PAY) / 5) * 5),
    danger: Math.max(1, q.danger) as Quest['danger'],
    expires: 2,
    item: {
      id: q.item?.id ?? `i${s.uid++}`,
      ...base,
      value: Math.round(base.value * (1 + rank * 0.2)),
    },
    fresh: true,
    rumor: true,
  };
}

/** Tocar el rumor a tiempo: el encargo va al tablón. Muta `s` (una copia). */
export function takeRumor(s: GameState): { t: string; k: ChipKind } | null {
  const r = s.rumor;
  if (!r) return null;
  const rng = new Rng(s.rng);
  const q = rumorQuest(s, rng, r.text);
  s.rng = rng.save();
  s.quests = [...s.quests, q];
  s.rumor = undefined;
  return {
    t: `Lo apuntas: «${q.title}» ya está en el tablón, con ${q.item!.name} de botín.`,
    k: 'good',
  };
}
