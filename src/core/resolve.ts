/**
 * Resolución de misiones: abstracta, rápida y explicable.
 * Tira un dado por desafío, clasifica el resultado y aplica las consecuencias al estado
 * (que se recibe ya copiado: aquí se muta). Devuelve el informe para el amanecer.
 */
import { CLOSERS, LINES, OPENERS, SCARS } from '../data/stories';
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
  TRIP_FATIGUE,
  TWIST_DIFF,
  XP,
  XP_PER_LEVEL,
} from './balance';
import { fill } from './generate';
import type {
  ChipKind,
  Facilities,
  GameState,
  Hero,
  Mission,
  Outcome,
  Quest,
  Report,
} from './model';
import { chance, estimate, skill, type Estimate, type Member } from './party';
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
export function equip<T extends Member>(party: readonly T[], fac?: Facilities): T[] {
  const gear = ARMORY[fac?.arm ?? 0];
  return gear && Object.keys(gear).length ? party.map((m) => ({ ...m, gear })) : [...party];
}

export function questEstimate(
  q: Quest,
  members: readonly Member[],
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
  const say = (text: string, h?: Hero) =>
    body.push(fill(text, { who: names, place: q.place, h: h?.name ?? names }));

  const opener = rng.pick(OPENERS[q.type]);
  say(party.length > 1 ? opener[1] : opener[0]);
  const mage = party.find((h) => h.cls === 'mago');
  if (q.twist)
    say(
      mage
        ? `${mage.name} ya lo había advertido: ${lower(q.twist)}`
        : `Lo que nadie dijo: ${lower(q.twist)}`,
    );

  // Desafíos.
  const lucky = party.filter((h) => has(h, 'afortunado'));
  const jinx = party.some((h) => has(h, 'gafe')) ? 0.05 : 0;
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
    say(rng.pick(LINES[c.skill][ok ? 'ok' : 'ko']), best);
  });

  const n = q.challenges.length;
  let outcome: Outcome;
  if (passes === n) outcome = sumP / n > 0.8 ? 'Éxito brillante' : 'Éxito';
  else if (passes > 0) outcome = 'Éxito parcial';
  else {
    const ambush = rng.chance(DISASTER[q.danger]!);
    const scout = party.find((h) => h.cls === 'explorador');
    if (ambush && scout && rng.chance(1 - mods.disaster)) {
      outcome = 'Fracaso';
      say(`${scout.name} olió la emboscada a tiempo y los sacó por un barranco. Se salvaron.`);
    } else outcome = ambush ? 'Desastre' : 'Fracaso';
  }
  say(rng.pick(CLOSERS[outcome]));

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
      const risk = INJURY[outcome] * (guarded ? mods.guard : 1) + (has(h, 'valiente') ? 0.08 : 0);
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
      body.push(`Por cierto: has descubierto que ${h.name} es ${label.toLowerCase()}.`);
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
