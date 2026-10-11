/**
 * Cadenas de misiones: llega la carta de un cliente, el primer paso aparece en el tablón y
 * cada éxito trae el siguiente. Un fracaso tuerce la historia (el paso vuelve más difícil).
 * Al acabar: oro, fama, un objeto legendario y, a veces, un trofeo o el mapa completo.
 */
import { CHAINS, type ChainDef } from '../data/chains';
import { GEAR } from '../data/items';
import { PLACE_INFO } from '../data/places';
import { rankIndex } from './balance';
import { emptyStats } from './feats';
import { generateQuest } from './generate';
import type { DawnEvent, GameState, Quest, Report } from './model';
import type { Rng } from './rng';

export const chainDef = (id: string) => CHAINS.find((c) => c.id === id)!;
export const activeChain = (s: GameState) => s.chains?.find((c) => c.status === 'activa') ?? null;

/** Encargo de un paso de cadena, con la dificultad del rango actual (y de los tropiezos). */
export function chainQuest(
  s: GameState,
  rng: Rng,
  def: ChainDef,
  step: number,
  twists: number,
): Quest {
  const st = def.steps[step]!;
  const q = generateQuest(
    rng,
    `q${s.uid++}`,
    rankIndex(s.rep),
    `i${s.uid++}`,
    s.mode === 'libre',
    st.type,
  );
  return {
    ...q,
    title: st.title,
    client: def.client,
    text: st.text,
    place: st.place,
    danger: st.danger,
    dangerHidden: undefined,
    twist: undefined,
    item: undefined,
    expires: 999,
    reward: Math.round((q.reward * 1.6) / 5) * 5,
    challenges: q.challenges.map((c) => ({ ...c, diff: c.diff + twists * 2 })),
    chain: { id: def.id, step },
  };
}

/** Si no hay ninguna en marcha y la fama alcanza, llega la carta de la siguiente cadena. */
export function offerChain(s: GameState, rng: Rng, events: DawnEvent[]): void {
  if (activeChain(s)) return;
  const done = (s.chains ?? []).map((c) => c.id);
  const def = CHAINS.find((c) => !done.includes(c.id) && s.rep >= c.rep);
  if (!def) return;
  (s.chains ??= []).push({ id: def.id, step: 0, status: 'activa', twists: 0 });
  s.quests.push(chainQuest(s, rng, def, 0, 0));
  s.reports.unshift({
    id: `r${s.uid++}`,
    day: s.day,
    title: def.name,
    heroIds: [],
    who: def.client,
    outcome: 'Éxito',
    heading: `Carta de ${def.client}`,
    body: [def.intro, `Primer paso en el tablón: «${def.steps[0]!.title}».`],
    chips: [
      { t: `${def.steps.length} encargos enlazados`, k: 'info' },
      { t: 'Premio final legendario', k: 'good' },
    ],
    read: false,
  });
  events.push({
    t: `Carta de ${def.client}: «${def.name}», una historia en varios encargos.`,
    k: 'good',
  });
}

/** Tras volver de un paso de cadena: avanza, se tuerce o termina con el premio. */
export function advanceChain(
  s: GameState,
  rng: Rng,
  q: Quest,
  r: Report,
  events: DawnEvent[],
): void {
  const cs = s.chains?.find((c) => c.id === q.chain!.id);
  if (!cs || cs.status !== 'activa') return;
  const def = chainDef(cs.id);
  const failed = r.outcome === 'Fracaso' || r.outcome === 'Desastre';
  if (failed) {
    cs.twists++;
    s.quests.push(chainQuest(s, rng, def, cs.step, cs.twists));
    r.body.push(
      'La historia se ha torcido: habrá que volver a intentarlo, y ahora será más difícil.',
    );
    r.chips.push({ t: `«${def.name}» se complica`, k: 'warn' });
    events.push({
      t: `«${def.name}» se tuerce: «${q.title}» vuelve al tablón, más difícil.`,
      k: 'bad',
    });
    return;
  }
  cs.step++;
  if (cs.step < def.steps.length) {
    s.quests.push(chainQuest(s, rng, def, cs.step, cs.twists));
    r.chips.push({ t: `«${def.name}» ${cs.step}/${def.steps.length}`, k: 'info' });
    events.push({
      t: `«${def.name}» avanza: en el tablón, «${def.steps[cs.step]!.title}».`,
      k: 'good',
    });
    return;
  }
  // Final de la cadena.
  cs.status = 'hecha';
  const stats = (s.stats ??= emptyStats());
  stats.chains = (stats.chains ?? 0) + 1;
  s.gold += def.reward.gold;
  s.rep += def.reward.rep;
  const base = GEAR.find((g) => g.name === def.reward.item);
  if (base) s.inventory.push({ ...base, id: `i${s.uid++}` });
  if (def.reward.trophy) {
    s.trophies.push({
      id: `t${s.uid++}`,
      ...def.reward.trophy,
      who: r.who,
      place: q.place,
      day: s.day,
      value: 150,
    });
    stats.trophies++;
  }
  if (def.reward.revealMap) s.explored = Object.keys(PLACE_INFO);
  r.heading = 'Historia cumplida';
  r.body.push(def.ending);
  r.chips.push(
    { t: `+${def.reward.gold} monedas del cliente`, k: 'good' },
    { t: `+${def.reward.rep} reputación`, k: 'good' },
    { t: `Legendario: ${def.reward.item}`, k: 'good' },
  );
  if (def.reward.trophy) r.chips.push({ t: `Trofeo: ${def.reward.trophy.name}`, k: 'good' });
  if (def.reward.revealMap) r.chips.push({ t: 'Mapa completo de la comarca', k: 'good' });
  events.push({ t: `¡«${def.name}» cumplida! ${def.client} paga y cuenta la hazaña.`, k: 'good' });
}
