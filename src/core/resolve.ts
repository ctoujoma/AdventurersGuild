/**
 * Resolución de misiones: abstracta, rápida y explicable.
 * Tira un dado por desafío, clasifica el resultado y aplica las consecuencias al estado
 * (que se recibe ya copiado: aquí se muta). Devuelve el informe para el amanecer.
 */
import { CLOSERS, LINES, OPENERS, SCARS } from '../data/stories';
import {
  BANTER,
  CLASS_LINES,
  CLIENT_CLOSERS,
  FINDS,
  HIGH_MORALE,
  ITEM_LINES,
  LOW_MORALE,
  MORE_CLOSERS,
  MORE_LINES,
  MORE_OPENERS,
  REVEALS,
  ROAD,
  TRAIT_LINES,
} from '../data/tales';
import { TRAIT_INFO } from '../data/traits';
import { partyMods } from './classes';
import {
  ARMORY,
  DISASTER,
  FAIL_CASUALTY,
  GREED,
  INJURY,
  MORALE,
  PAY,
  REP,
  SCOUT_AMBUSH,
  TRIP_FATIGUE,
  TROPHY_REP,
  TWIST_DIFF,
  XP,
  XP_PER_LEVEL,
} from './balance';
import { fill } from './generate';
import { TROPHIES } from '../data/items';
import type {
  ChipKind,
  Facilities,
  Item,
  GameState,
  Hero,
  Mission,
  Outcome,
  Quest,
  Report,
} from './model';
import {
  MORALE_HIGH,
  MORALE_LOW,
  chance,
  estimate,
  skill,
  type Estimate,
  type Member,
  type SkillId,
} from './party';
import type { Rng } from './rng';
import { listNames } from './text';

const has = (h: Hero, id: string) => h.traits.some((t) => t.id === id);
const sx = (h: Hero, m: string, f: string) => (h.sex === 'f' ? f : m);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const MAIN_ATTR = {
  guerrero: 'F',
  picaro: 'D',
  mago: 'M',
  clerigo: 'M',
  explorador: 'D',
} as const;

/** Lo que se ve antes de enviar: con un mago en el grupo, el giro oculto se descubre. */
/** Cada héroe con el equipo de la armería puesto. */
/** Lo que suma a un héroe la armería del gremio más su objeto equipado. */
export function gearOf(item: Item | undefined, fac?: Facilities): Partial<Record<SkillId, number>> {
  const gear: Partial<Record<SkillId, number>> = { ...ARMORY[fac?.arm ?? 0] };
  for (const [k, v] of Object.entries(item?.bonus ?? {}) as [SkillId, number][])
    gear[k] = (gear[k] ?? 0) + v;
  return gear;
}

/** Cada héroe con su equipo puesto: armería, objeto y su efecto. */
export function equip<T extends Member & { item?: Item }>(
  party: readonly T[],
  fac?: Facilities,
): T[] {
  return party.map((m) => ({ ...m, gear: gearOf(m.item, fac), perk: m.item?.perk ?? m.perk }));
}

export function questEstimate(
  q: Quest,
  members: readonly (Member & { item?: Item })[],
  fac?: Facilities,
): Estimate & { reveal: boolean } {
  const party = equip(members, fac);
  const reveal = !!q.twist && partyMods(party).seer;
  const challenges = q.challenges.map((c, i) =>
    reveal && i === 0 ? { ...c, diff: c.diff + TWIST_DIFF } : c,
  );
  return { ...estimate(challenges, party), reveal };
}

export function resolveMission(state: GameState, m: Mission, rng: Rng): Report {
  const q = m.quest;
  const party = m.heroIds
    .map((id) => state.heroes.find((h) => h.id === id))
    .filter((h): h is Hero => !!h);
  const names = listNames(party.map((h) => h.name));
  const body: string[] = [];
  const chips: { t: string; k: ChipKind }[] = [];
  const mods = partyMods(party);
  const say = (text: string, h?: Hero, extra: Record<string, string> = {}) =>
    body.push(
      fill(text, { who: names, place: q.place, client: q.client, h: h?.name ?? names, ...extra }),
    );

  // Frases sin repetir dentro del mismo informe.
  const used = new Set<string>();
  const fresh = (pool: readonly string[]) => {
    const left = pool.filter((x) => !used.has(x));
    const v = rng.pick(left.length ? left : pool);
    used.add(v);
    return v;
  };

  const opener = rng.pick([...OPENERS[q.type], ...MORE_OPENERS[q.type]]);
  say(party.length > 1 ? opener[1] : opener[0]);
  const mage = party.find((h) => h.cls === 'mago');
  if (q.twist)
    say(
      mage
        ? `${mage.name} ya lo había advertido: ${lower(q.twist)}`
        : `Lo que nadie dijo: ${lower(q.twist)}`,
    );

  // El camino: un suceso, a veces un hallazgo; piques, rasgos y moral.
  if (rng.chance(0.35)) {
    if (rng.chance(0.3)) {
      const found = rng.int(5, 15);
      state.gold += found;
      say(rng.pick(FINDS), undefined, { gold: String(found) });
      chips.push({ t: `Hallazgo: +${found}`, k: 'good' });
    } else say(rng.pick(ROAD));
  }
  if (party.length >= 2 && rng.chance(0.3)) {
    const a = rng.pick(party);
    const b = rng.pick(party.filter((h) => h !== a));
    say(rng.pick(BANTER), undefined, { a: a.name, b: b.name });
  }
  const asides = party.flatMap((h) =>
    h.traits.filter((t) => TRAIT_LINES[t.id]).map((t) => [h, t.id] as const),
  );
  if (asides.length && rng.chance(0.45)) {
    const [h, id] = rng.pick(asides);
    say(rng.pick(TRAIT_LINES[id]!), h);
  }
  if (rng.chance(0.4)) {
    const low = party.filter((h) => h.morale < MORALE_LOW);
    const high = party.filter((h) => h.morale >= MORALE_HIGH);
    if (low.length) say(rng.pick(LOW_MORALE), rng.pick(low));
    else if (high.length) say(rng.pick(HIGH_MORALE), rng.pick(high));
  }

  // Desafíos.
  const lucky = party.filter((h) => has(h, 'afortunado') || h.item?.perk === 'luck');
  const warded = party.find((h) => h.item?.perk === 'ward');
  const jinx = party.some((h) => has(h, 'gafe')) && !warded ? 0.05 : 0;
  if (warded && party.some((h) => has(h, 'gafe')))
    say(`El ${lower(warded.item!.name)} de ${warded.name} tuvo a raya la mala suerte del grupo.`);
  let passes = 0;
  let sumP = 0;
  q.challenges.forEach((c, i) => {
    const diff = c.diff + (q.twist && i === 0 ? TWIST_DIFF : 0);
    const power = equip(party, state.fac).reduce((a, h) => a + skill(h, c.skill, true), 0);
    const p = clamp(chance(power, diff) - jinx, 0.03, 0.95);
    sumP += p;
    let ok = rng.chance(p);
    if (!ok && lucky.length) {
      const lh = lucky.shift()!;
      ok = rng.chance(p);
      if (ok) say(`Cuando todo se torcía, la suerte de ${lh.name} lo enderezó.`);
    }
    if (ok) passes++;
    const best = [...party].sort((a, b) => skill(b, c.skill, true) - skill(a, c.skill, true))[0];
    const k = ok ? 'ok' : 'ko';
    const pool = rng.chance(0.35)
      ? CLASS_LINES[best!.cls][k]
      : [...LINES[c.skill][k], ...MORE_LINES[c.skill][k]];
    if (ok && (best!.item?.rarity ?? 0) >= 1 && rng.chance(0.4))
      say(fresh(ITEM_LINES), best, { item: lower(best!.item!.name) });
    else say(fresh(pool), best);
  });

  const n = q.challenges.length;
  let outcome: Outcome;
  if (passes === n) outcome = sumP / n > 0.8 ? 'Éxito brillante' : 'Éxito';
  else if (passes > 0) outcome = 'Éxito parcial';
  else {
    const ambush = rng.chance(DISASTER[q.danger]!);
    const scout =
      party.find((h) => h.cls === 'explorador') ?? party.find((h) => h.item?.perk === 'ambush');
    if (ambush && scout && rng.chance(1 - SCOUT_AMBUSH)) {
      outcome = 'Fracaso';
      say(`${scout.name} olió la emboscada a tiempo y los sacó por un barranco. Se salvaron.`);
    } else outcome = ambush ? 'Desastre' : 'Fracaso';
  }
  say(
    rng.pick(
      rng.chance(0.4) ? CLIENT_CLOSERS[outcome] : [...CLOSERS[outcome], ...MORE_CLOSERS[outcome]],
    ),
  );

  // Oro, reputación y botín.
  let gold = Math.round(q.reward * PAY[outcome] * mods.gold);
  const rogue = party.find((h) => h.cls === 'picaro');
  if (gold > 0 && rogue && rng.chance(0.5))
    say(`${rogue.name} volvió con los bolsillos más llenos de lo que cuenta el contrato.`);
  const greedy = party.find((h) => has(h, 'codicioso'));
  if (gold > 0 && greedy) {
    const cut = Math.round(gold * GREED);
    gold -= cut;
    chips.push({ t: `${greedy.name} se queda ${cut}`, k: 'warn' });
  }
  state.gold += gold;
  chips.unshift({ t: gold > 0 ? `+${gold} monedas` : 'Sin cobrar', k: gold > 0 ? 'good' : 'bad' });
  const dRep = REP[outcome];
  state.rep = Math.max(0, state.rep + dRep);
  chips.push({ t: `${dRep >= 0 ? '+' : ''}${dRep} reputación`, k: dRep >= 0 ? 'good' : 'bad' });
  const looted = PAY[outcome] >= 1 || (outcome === 'Éxito parcial' && mods.partialLoot);
  if (q.item && looted) {
    state.inventory.push({ ...q.item, id: `i${state.uid++}` });
    chips.push({ t: `Botín: ${q.item.name}`, k: 'info' });
    if (PAY[outcome] < 1 && rogue) say(`Aun así, ${rogue.name} no se fue con las manos vacías.`);
  }
  // Trofeo: solo de las grandes hazañas.
  if (outcome === 'Éxito brillante' && q.danger >= 2) {
    const t = rng.pick(TROPHIES[q.type]);
    state.trophies.push({
      id: `t${state.uid++}`,
      ...t,
      who: names,
      place: q.place,
      day: state.day,
      value: 40 + q.danger * 20,
    });
    state.rep += TROPHY_REP;
    say(`Y se trajeron un recuerdo: ${lower(t.name)}. Irá a la pared de la sala.`);
    chips.push({ t: `Trofeo: ${t.name}`, k: 'good' });
  }

  // Bajas.
  const healer = party.find((h) => h.cls === 'clerigo');
  let fallen: Hero | null = null;
  let victim: Hero | null = null;
  if (outcome === 'Desastre' || (outcome === 'Fracaso' && rng.chance(FAIL_CASUALTY[q.danger]))) {
    victim = rng.pick(party);
    if (has(victim, 'cobarde')) {
      say(`${victim.name} salió corriendo a la primera señal. No es heroico, pero está vivo.`);
      victim = null;
    } else if (healer && healer !== victim) {
      const options = SCARS.filter((x) => !has(victim!, x.trait));
      victim.status = 'herido';
      victim.days = 5;
      if (options.length) {
        const scar = rng.pick(options);
        victim.traits.push({ id: scar.trait });
        const nick = victim.nick ?? scar.nick[victim.sex];
        victim.nick = nick;
        say(
          `${victim.name} ${scar.text}. Si ha vuelto es porque ${healer.name} rezó muy deprisa. Desde hoy le llaman ${victim.name} ${nick}.`,
        );
        chips.push({ t: `Secuela: ${TRAIT_INFO[scar.trait][victim.sex]}`, k: 'warn' });
      } else say(`${victim.name} estuvo a punto de no contarlo. ${healer.name} rezó muy deprisa.`);
      chips.push({ t: `${victim.name}: grave, 5 días`, k: 'bad' });
    } else if (rng.chance(0.5)) {
      victim.status = 'muerto';
      fallen = victim;
      if (victim.item) {
        chips.push({ t: `Perdido: ${victim.item.name}`, k: 'bad' });
        delete victim.item;
      }
      state.fallen.unshift({
        name: victim.name + (victim.nick ? ` «${victim.nick}»` : ''),
        epitaph: `${q.title} · día ${state.day}.`,
      });
      say(`${victim.name} no volvió. Su nombre irá al Muro de los caídos.`);
      chips.push({ t: `${victim.name}: ${sx(victim, 'caído', 'caída')}`, k: 'bad' });
    } else {
      victim.status = 'desaparecido';
      victim.days = rng.int(2, 4);
      say(
        `Nadie sabe qué fue de ${victim.name}. Lo último que vieron fue su sombra cerca de ${q.place}.`,
      );
      chips.push({ t: `${victim.name}: ${sx(victim, 'desaparecido', 'desaparecida')}`, k: 'bad' });
    }
  }

  // Los que vuelven.
  for (const h of party) {
    if (h.status === 'muerto' || h.status === 'desaparecido') continue;
    if (h !== victim) {
      h.status = 'ok';
      h.days = 0;
      const guarded = party.some((o) => o !== h && o.cls === 'guerrero');
      const armored = h.item?.perk === 'guard' ? 0.5 : 1;
      const risk =
        INJURY[outcome] * (guarded ? mods.guard : 1) * armored + (has(h, 'valiente') ? 0.08 : 0);
      if (rng.chance(risk)) {
        h.status = 'herido';
        h.days = rng.int(2, 4);
        say(`${h.name} vuelve ${sx(h, 'herido', 'herida')}: ${h.days} días de reposo.`);
        chips.push({ t: `${h.name}: ${sx(h, 'herido', 'herida')}, ${h.days} días`, k: 'bad' });
      }
    }
    h.xp += XP[outcome];
    if (h.xp >= XP_PER_LEVEL) {
      h.xp -= XP_PER_LEVEL;
      h.lvl++;
      const a = MAIN_ATTR[h.cls];
      h.attrs[a] = Math.min(10, h.attrs[a] + 1);
      h.salary += 3;
      chips.push({ t: `${h.name} sube a nivel ${h.lvl}`, k: 'good' });
    }
    let dMorale = MORALE[outcome] - TRIP_FATIGUE * q.days;
    if (fallen) dMorale -= Math.round((has(h, 'leal') ? 20 : 10) * (state.fac.cap >= 2 ? 0.5 : 1));
    if (has(h, 'codicioso') && q.reward >= 200 && PAY[outcome] >= 1) dMorale += 5;
    if (dMorale < 0) dMorale = Math.round(dMorale * mods.solace);
    h.morale = clamp(h.morale + dMorale, 0, 100);
    h.history.push(`Día ${state.day} · ${q.title} · ${outcome}`);
    const hidden = h.traits.find((t) => t.hidden);
    if (hidden) {
      hidden.hidden = false;
      const label = TRAIT_INFO[hidden.id][h.sex];
      body.push(fill(fresh(REVEALS), { h: h.name, t: label.toLowerCase(), place: q.place }));
      chips.push({ t: `Descubierto: ${label}`, k: 'info' });
    }
  }

  return {
    id: `r${state.uid++}`,
    day: state.day,
    title: q.title,
    heroIds: party.map((h) => h.id),
    who: names,
    outcome,
    body,
    chips,
    read: false,
  };
}

function lower(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
