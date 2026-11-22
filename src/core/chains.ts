/**
 * Cadenas de misiones: llega la carta de un cliente, el primer paso aparece en el tablón y
 * cada éxito trae el siguiente. Un fracaso tuerce la historia (el paso vuelve más difícil).
 * Al acabar: oro, fama, un objeto legendario y, a veces, un trofeo o el mapa completo.
 */
import { learnRecipe } from './crafting';
import type { BossKind } from '../data/bosses';
import { CHAINS, type ChainDef } from '../data/chains';
import { GEAR } from '../data/items';
import { clientLabelMsg } from '../data/quests';
import { PLACE_INFO } from '../data/places';
import { rankIndex } from './balance';
import { emptyStats } from './feats';
import { generateQuest, homePower } from './generate';
import type { BossFight, DawnEvent, GameState, Hero, Quest, Report } from './model';
import type { Rng } from './rng';
import { shownGear } from './gear';
import { idText, msg } from '../textos';

export const chainDef = (id: string) => CHAINS.find((c) => c.id === id)!;

/** Sube o baja la amenaza regional (0–100). */
const threat = (s: GameState, d: number) =>
  (s.threat = Math.max(0, Math.min(100, (s.threat ?? 0) + d)));
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
    homePower(s.heroes),
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

/** El jefe que espera al final de este encargo, si lo hay. */
export function bossOf(q: Quest): BossKind | undefined {
  return q.chain ? chainDef(q.chain.id).steps[q.chain.step]?.boss : undefined;
}

/** Quién va a pelear contra el jefe, tal como sale de la taberna (antes de la pelea). */
export function fightRoster(heroes: readonly Hero[]): BossFight['heroes'] {
  return heroes.map((h) => ({
    id: h.id,
    name: h.name,
    seed: h.seed,
    cls: h.cls,
    sex: h.sex,
    eyepatch: h.traits.some((t) => t.id === 'tuerto') || undefined,
    scar: h.traits.some((t) => t.id === 'cortado') || undefined,
    gear: shownGear(h),
    fate: 'ok',
  }));
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
    who: clientLabelMsg(def.client),
    outcome: 'Éxito',
    heading: msg('historias.carta.titulo', { cliente: clientLabelMsg(def.client) }),
    body: [def.intro, msg('historias.carta.primer_paso', { titulo: def.steps[0]!.title })],
    chips: [
      { t: msg('historias.carta.chip_pasos', { n: def.steps.length }), k: 'info' },
      { t: msg('historias.carta.chip_premio'), k: 'good' },
    ],
    read: false,
  });
  events.push({
    t: msg('historias.carta.aviso', { cliente: clientLabelMsg(def.client), historia: def.name }),
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
    threat(s, 8);
    s.quests.push(chainQuest(s, rng, def, cs.step, cs.twists));
    r.body.push(msg('historias.paso.torcida'));
    r.chips.push({ t: msg('historias.paso.chip_complica', { historia: def.name }), k: 'warn' });
    events.push({
      t: msg('historias.paso.se_tuerce', { historia: def.name, titulo: q.title }),
      k: 'bad',
    });
    return;
  }
  cs.step++;
  threat(s, -10);
  if (cs.step < def.steps.length) {
    s.quests.push(chainQuest(s, rng, def, cs.step, cs.twists));
    r.chips.push({
      t: msg('historias.paso.chip_avance', {
        historia: def.name,
        n: cs.step,
        de: def.steps.length,
      }),
      k: 'info',
    });
    events.push({
      t: msg('historias.paso.avanza', { historia: def.name, titulo: def.steps[cs.step]!.title }),
      k: 'good',
    });
    return;
  }
  // Final de la cadena.
  cs.status = 'hecha';
  threat(s, -30);
  const stats = (s.stats ??= emptyStats());
  stats.chains = (stats.chains ?? 0) + 1;
  s.gold += def.reward.gold;
  s.rep += def.reward.rep;
  const base = GEAR.find((g) => idText(g.name) === idText(def.reward.item));
  if (base) s.inventory.push({ ...base, id: `i${s.uid++}` });
  // Al acabar una historia, siempre unos planos (si queda algo por aprender).
  const plan = learnRecipe(s, rng);
  if (plan) {
    r.body.push(msg('historias.final.planos', { receta: msg(`recetas.recetas.${plan}.many`) }));
    r.chips.push({
      t: msg('partida.aviso.chip_receta', { receta: msg(`recetas.recetas.${plan}.nombre`) }),
      k: 'good',
    });
  }
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
  r.heading = msg('historias.final.titulo');
  r.body.push(def.ending);
  r.chips.push(
    { t: msg('historias.final.chip_oro', { n: def.reward.gold }), k: 'good' },
    { t: msg('asaltos.chip_mas_rep', { n: def.reward.rep }), k: 'good' },
    { t: msg('historias.final.chip_legendario', { objeto: def.reward.item }), k: 'good' },
  );
  if (def.reward.trophy)
    r.chips.push({ t: msg('informes.chip_trofeo', { trofeo: def.reward.trophy.name }), k: 'good' });
  if (def.reward.revealMap) r.chips.push({ t: msg('historias.final.chip_mapa'), k: 'good' });
  events.push({
    t: msg('historias.final.aviso', { historia: def.name, cliente: clientLabelMsg(def.client) }),
    k: 'good',
    big: true,
  });
}
