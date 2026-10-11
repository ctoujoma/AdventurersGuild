/**
 * Asaltos a la taberna: cuanto más famoso y rico es el gremio, más apetece a los bandidos.
 * Se programan con unos días de antelación (a veces llega un chivatazo), luchan los héroes
 * que estén en casa (los de guardia, mejor) y el resultado es saqueo o tregua.
 * Todo se aplica sobre el estado ya copiado al terminar el día.
 */
import {
  BANDS,
  RAID_EMPTY,
  RAID_FIGHT,
  RAID_LOST,
  RAID_OPEN,
  RAID_WON,
  SCOUT_TIPOFF,
  TIPOFFS,
} from '../data/raids';
import {
  RAID_BASE,
  RAID_FROM,
  RAID_MAX_CHANCE,
  RAID_NOTORIETY,
  GUARD_BONUS,
  PALISADE,
  rankIndex,
} from './balance';
import { THREAT_RAIDS, threatOf } from './events';
import { emptyStats } from './feats';
import { fill } from './generate';
import type { DawnEvent, GameState, Hero, Report } from './model';
import { chance, skill } from './party';
import { equip } from './resolve';
import type { Rng } from './rng';
import { listNames } from './text';

/** Fama más riqueza a la vista: lo que atrae a los bandidos. */
export function notoriety(s: GameState): number {
  const treasure = s.inventory.reduce((a, i) => a + i.value, 0);
  const trophies = s.trophies.reduce((a, t) => a + t.value, 0);
  const unrest = threatOf(s) >= THREAT_RAIDS ? 40 : 0;
  return Math.round(s.rep + s.gold / 40 + (treasure + trophies) / 12 + unrest);
}

/** Probabilidad de que una banda se fije en el gremio esta noche. */
export function raidChance(s: GameState): number {
  if (s.day < RAID_FROM || (s.truce ?? 0) > s.day || s.raid) return 0;
  return Math.max(0, Math.min(RAID_MAX_CHANCE, (notoriety(s) - RAID_NOTORIETY) / 600));
}

const defendersOf = (s: GameState) => s.heroes.filter((h) => h.status === 'ok');

/** Fuerza de la defensa: el combate de quien está en casa, con su equipo y la guardia. */
export function defense(s: GameState): number {
  const ds = defendersOf(s);
  const armed = equip(ds, s.fac);
  return (
    armed.reduce((a, h, i) => a + skill(h, 'Combate', true) + (ds[i]!.guard ? GUARD_BONUS : 0), 0) +
    (ds.length ? (PALISADE[s.fac.empal] ?? 0) : 0)
  );
}

/** Chivatazo: más fácil con un explorador en casa o con la sala de mapas. */
function tipoff(s: GameState, rng: Rng, events: DawnEvent[], firstTry: boolean): void {
  const raid = s.raid!;
  const scout = defendersOf(s).find((h) => h.cls === 'explorador');
  const p = (firstTry ? RAID_BASE : 0.25) + (scout ? 0.2 : 0) + (s.fac.mapas >= 1 ? 0.15 : 0);
  // Desde la torre del vigía se ven venir siempre.
  if (s.fac.torre < 1 && !rng.chance(p)) return;
  raid.warned = true;
  const days = raid.day - s.day;
  const text =
    s.fac.torre >= 1
      ? `El vigía de la torre ha visto antorchas en el camino real: es ${raid.band}.`
      : scout
        ? fill(SCOUT_TIPOFF, { h: scout.name, band: raid.band })
        : fill(rng.pick(TIPOFFS), { band: raid.band });
  events.push({
    t: `Chivatazo: ${text} Llegarán en ${days <= 1 ? 'una noche' : `unas ${days} noches`}.`,
    k: 'bad',
  });
}

/** Programa asaltos, da chivatazos y resuelve el de esta noche. Devuelve el informe, si hay. */
export function stepRaids(s: GameState, rng: Rng, events: DawnEvent[]): Report | null {
  if (!s.raid) {
    if (!rng.chance(raidChance(s))) return null;
    const strength = 8 + rankIndex(s.rep) * 5 + Math.floor(notoriety(s) / 15) + rng.int(-2, 3);
    s.raid = { day: s.day + rng.int(2, 4), band: rng.pick(BANDS), strength, warned: false };
    tipoff(s, rng, events, true);
    return null;
  }
  if (s.day < s.raid.day) {
    if (!s.raid.warned) tipoff(s, rng, events, false);
    return null;
  }
  return resolveRaid(s, rng, events);
}

function resolveRaid(s: GameState, rng: Rng, events: DawnEvent[]): Report {
  const raid = s.raid!;
  s.raid = null;
  const stats = (s.stats ??= emptyStats());
  const ds = defendersOf(s);
  const names = ds.length ? listNames(ds.map((h) => h.name)) : 'nadie';
  const body: string[] = [fill(rng.pick(RAID_OPEN), { band: raid.band })];
  const chips: Report['chips'] = [];
  const p = ds.length ? chance(defense(s), raid.strength) : 0;
  const won = rng.chance(p);
  const hurt: Hero[] = [];
  let stolen = 0;

  if (!ds.length) body.push(RAID_EMPTY);
  else {
    const best = [...ds].sort((a, b) => skill(b, 'Combate') - skill(a, 'Combate'));
    for (const h of best.slice(0, 2)) body.push(fill(rng.pick(RAID_FIGHT), { h: h.name }));
  }

  if (won) {
    const loot = rng.int(15, 45);
    const truce = rng.int(8, 12);
    s.gold += loot;
    s.rep += 4;
    s.truce = s.day + truce;
    stats.raids++;
    body.push(fill(rng.pick(RAID_WON), { band: raid.band }));
    chips.push(
      { t: 'Asalto repelido', k: 'good' },
      { t: `+${loot} monedas de los bandidos`, k: 'good' },
    );
    chips.push({ t: '+4 reputación', k: 'good' }, { t: `Tregua: ${truce} días`, k: 'info' });
    for (const h of ds) {
      h.morale = Math.min(100, h.morale + 8);
      h.xp = Math.min(99, h.xp + 15);
      if (rng.chance(0.15)) hurt.push(h);
    }
  } else {
    stolen = Math.round(s.gold * (0.25 + rng.next() * 0.15));
    s.gold -= stolen;
    s.rep = Math.max(0, s.rep - 3);
    s.truce = s.day + rng.int(4, 6);
    body.push(rng.pick(RAID_LOST));
    chips.push({ t: `Saqueo: −${stolen} monedas`, k: 'bad' }, { t: '−3 reputación', k: 'bad' });
    // Se llevan algo del arcón (nunca lo que los héroes llevan puesto) y quizá un trofeo.
    for (let i = 0; i < 2 && s.inventory.length; i++) {
      if (i > 0 && !rng.chance(0.5)) break;
      const it = s.inventory.splice(rng.int(0, s.inventory.length - 1), 1)[0]!;
      chips.push({ t: `Robado: ${it.name}`, k: 'bad' });
    }
    if (s.trophies.length && rng.chance(0.25)) {
      const t = s.trophies.splice(rng.int(0, s.trophies.length - 1), 1)[0]!;
      chips.push({ t: `Robado el trofeo: ${t.name}`, k: 'bad' });
    }
    for (const h of ds) {
      h.morale = Math.max(0, h.morale - 10);
      if (rng.chance(0.45)) hurt.push(h);
    }
  }
  for (const h of hurt) {
    h.status = 'herido';
    h.days = rng.int(2, 3);
    chips.push({
      t: `${h.name}: ${h.sex === 'f' ? 'herida' : 'herido'}, ${h.days} días`,
      k: 'bad',
    });
  }
  for (const h of ds) h.history.push(`Día ${s.day} · Defendió la taberna de ${raid.band}`);

  events.push({
    t: won
      ? `¡${raid.band} asaltó la taberna y ${names} ${ds.length > 1 ? 'los echaron' : 'los echó'}!`
      : `${raid.band} asaltó la taberna y se llevó ${stolen} monedas.`,
    k: won ? 'good' : 'bad',
  });
  s.lastRaid = {
    day: s.day,
    band: raid.band,
    bandits: Math.max(2, Math.min(6, Math.round(raid.strength / 6))),
    defenders: ds.map((h) => h.id),
    won,
    hurt: hurt.map((h) => h.id),
    stolen,
  };
  return {
    id: `r${s.uid++}`,
    day: s.day,
    title: `Asalto de ${raid.band}`,
    heroIds: ds.map((h) => h.id),
    who: names,
    outcome: won ? 'Éxito' : 'Desastre',
    body,
    chips,
    read: false,
    raid: { won },
  };
}
