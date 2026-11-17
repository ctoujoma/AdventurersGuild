/**
 * El mensajero tardío (suceso de la noche, ver `night.ts`): alguien llama a la puerta con un farol
 * y trae un encargo urgente, del nivel de la casa, mejor pagado y que caduca pronto (sale al
 * amanecer o se pierde al acabar el día siguiente). Tocarle: aceptar o despedirle. Si no se le
 * toca, el de guardia que estaba despierto cuando llamó le recoge el recado (el encargo sale al
 * amanecer en el tablón); sin nadie despierto en la puerta, se va y se lo lleva a otra parte.
 */
import {
  DAY_SECONDS,
  MESSENGER_EVERY,
  MESSENGER_EXPIRES,
  MESSENGER_PAY,
  MESSENGER_WAIT,
  NIGHT_ROLL,
  RUMOR_FROM_DAY,
  rankIndex,
} from './balance';
import { generateQuest, homePower } from './generate';
import { guardsAt } from './guards';
import { nappers, tellDawn } from './incidents';
import type { ChipKind, DawnEvent, GameState, Quest, Sex } from './model';
import type { NightEvent } from './night';
import type { Rng } from './rng';
import { active } from './rooms';

/** Lo que dice al dar el recado (delante del texto del encargo). */
const URGENT = [
  'Llega sin aliento: «Que salgan al alba, por lo que más quieran».',
  'Trae el sello del molinero y mucha prisa.',
  'Viene a caballo desde la otra punta de la comarca.',
  '«Mañana ya será tarde», dice, y no quiere ni sentarse.',
];

/** Quien llama la noche del día `day`: cada noche otro (a veces, una mensajera). */
export const messengerSex = (day: number): Sex => (day % 3 ? 'm' : 'f');

/** «un mensajero» o «una mensajera». */
export const aMessenger = (day: number) =>
  messengerSex(day) === 'f' ? 'una mensajera' : 'un mensajero';

/** La puerta (el recibidor en uso), si hay. */
export const messengerRoom = (s: GameState) =>
  s.building.rooms.find((r) => r.type === 'recibidor' && active(r).level > 0)?.id ?? null;

/** El encargo que trae: del nivel de la casa, mejor pagado y con prisa. */
export function urgentQuest(s: GameState, rng: Rng): Quest {
  const taken = new Set(s.quests.map((x) => x.title));
  const make = () =>
    generateQuest(
      rng,
      `q${s.uid++}`,
      rankIndex(s.rep),
      `i${s.uid++}`,
      s.mode === 'libre',
      undefined,
      homePower(s.heroes),
    );
  let q = make();
  for (let i = 0; i < 8 && taken.has(q.title); i++) q = make();
  return {
    ...q,
    text: `${rng.pick(URGENT)} ${q.text}`,
    reward: Math.round((q.reward * MESSENGER_PAY) / 5) * 5,
    expires: MESSENGER_EXPIRES,
    fresh: true,
    urgent: true,
  };
}

/** El de guardia de la puerta que está despierto al reloj `at`, si hay. */
function awakeAtDoor(s: GameState, at: number): string | undefined {
  const gs = guardsAt(s, 'puerta');
  const nap = nappers(gs, Math.min(1, at / DAY_SECONDS), s.day);
  return gs.find((g) => !nap.includes(g.id))?.id;
}

export const MESSENGER_EVENT: NightEvent = {
  id: 'mensajero',
  when: (s) => s.day >= RUMOR_FROM_DAY && !s.messenger && !!messengerRoom(s),
  every: MESSENGER_EVERY,
  start: (s, rng) => {
    const at = Math.max(s.clock ?? 0, NIGHT_ROLL * DAY_SECONDS);
    const guard = awakeAtDoor(s, at);
    s.messenger = { day: s.day, at, quest: urgentQuest(s, rng), ...(guard ? { guard } : {}) };
    return null;
  },
  dawn: (s) => settleMessenger(s),
};

/** Si ya se ha cansado de esperar en la puerta (y se ha ido). */
export const messengerGone = (s: GameState, clock = s.clock ?? 0) =>
  !!s.messenger && (s.messenger.gone || clock >= s.messenger.at + MESSENGER_WAIT);

/** Con el reloj: si ya es hora, se va (muta `s`, ya copiado). Sin aviso: se cuenta al amanecer. */
export function stepMessenger(s: GameState): void {
  if (s.messenger && !s.messenger.gone && messengerGone(s)) s.messenger.gone = true;
}

/** Aceptar el encargo: va ya al tablón. Muta `s` (ya copiado); devuelve la línea. */
export function acceptMessenger(s: GameState): { t: string; k: ChipKind } | null {
  const m = s.messenger;
  if (!m || m.gone) return null;
  s.quests = [...s.quests, m.quest];
  s.messenger = null;
  const line = {
    t: `Anoche llamó ${aMessenger(m.day)} con un encargo urgente: «${m.quest.title}» (${m.quest.reward} monedas) está en el tablón. Sale hoy o se pierde.`,
    k: 'good' as const,
  };
  tellDawn(s, line);
  return { t: `«${m.quest.title}» ya está en el tablón.`, k: 'good' };
}

/** Despedirle: se va con su encargo. Muta `s` (ya copiado). */
export function dismissMessenger(s: GameState): void {
  const m = s.messenger;
  if (!m || m.gone) return;
  s.messenger = null;
  tellDawn(s, { t: `Anoche despediste a ${aMessenger(m.day)}: se llevó su encargo a otra parte.` });
}

/**
 * Al pasar el día: el mensajero que nadie ha atendido. Si el de guardia estaba despierto cuando
 * llamó, le recogió el recado y el encargo sale en el tablón; si no, se fue. Muta `s`.
 */
export function settleMessenger(s: GameState): DawnEvent | null {
  const m = s.messenger;
  if (!m) return null;
  s.messenger = null;
  const g = m.guard && s.heroes.find((h) => h.id === m.guard);
  if (g) {
    s.quests = [...s.quests, m.quest];
    return {
      t: `Anoche llamó ${aMessenger(m.day)} con un encargo urgente y ${g.name}, de guardia, le recogió el recado: «${m.quest.title}» (${m.quest.reward} monedas) está en el tablón. Sale hoy o se pierde.`,
      k: 'good',
    };
  }
  const napper = guardsAt(s, 'puerta')[0];
  return {
    t: napper
      ? `Anoche llamó ${aMessenger(m.day)} con un encargo urgente, pero ${napper.name} cabeceaba en la puerta y no le oyó: se lo llevó a otra parte.`
      : `Anoche llamó ${aMessenger(m.day)} con un encargo urgente, pero nadie le abrió: se lo llevó a otra parte.`,
    k: 'warn',
  };
}
