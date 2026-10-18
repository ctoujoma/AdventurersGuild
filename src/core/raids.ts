/**
 * Asaltos a la taberna: cuanto más famoso y rico es el gremio, más apetece a los bandidos.
 * Se programan con unos días de antelación (a veces llega un chivatazo) y se pelean sala a
 * sala (core/assault.ts): si alguien sale con vida, saqueo; si caen todos, tregua y botín.
 * Todo se aplica sobre el estado ya copiado al terminar el día.
 */
import { DOG_TIPOFF } from '../data/custom';
import { ROOMS } from '../data/rooms';
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
  SPY_DAYS,
  SPY_RISK,
  rankIndex,
} from './balance';
import { YARD, assaultSetup, banditCount, holdOdds, likelyStrength, simulate } from './assault';
import { THREAT_RAIDS, threatOf } from './events';
import { emptyStats } from './feats';
import { fill } from './generate';
import type { DawnEvent, GameState, Report } from './model';
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
  // Si un espía estudió la casa hace poco, la banda ya sabe por dónde entrar.
  const spied = s.scout !== undefined && s.day - s.scout <= SPY_DAYS ? SPY_RISK : 0;
  return Math.max(0, Math.min(RAID_MAX_CHANCE, (notoriety(s) - RAID_NOTORIETY) / 600 + spied));
}

const defendersOf = (s: GameState) => s.heroes.filter((h) => h.status === 'ok');

/** De cada diez asaltos como el que vendría esta noche, cuántos se pararían en seco. */
export const defense = (s: GameState) => holdOdds(s, likelyStrength(s, notoriety(s)));

/** Chivatazo: más fácil con un explorador en casa o con la sala de mapas. */
function tipoff(s: GameState, rng: Rng, events: DawnEvent[], firstTry: boolean): void {
  const raid = s.raid!;
  const scout = defendersOf(s).find((h) => h.cls === 'explorador');
  const p =
    (firstTry ? RAID_BASE : 0.25) +
    (scout ? 0.2 : 0) +
    (s.fac.mapas >= 1 ? 0.15 : 0) +
    (s.custom?.dog ? DOG_TIPOFF : 0);
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
  const fight = simulate(assaultSetup(s, raid.strength, rng), rng);
  const ds = s.heroes.filter((h) => fight.fought.includes(h.id));
  const fallen = new Set(fight.fell);
  const names = ds.length ? listNames(ds.map((h) => h.name)) : 'nadie';
  const body: string[] = [fill(rng.pick(RAID_OPEN), { band: raid.band })];
  const chips: Report['chips'] = [];
  const won = fight.escaped === 0;
  const hurt = s.heroes.filter((h) => fallen.has(h.id));
  const steps = fight.plan.steps;
  const guards = s.heroes.filter((h) => fight.plan.start[h.id] === fight.plan.route[0] && h.guard);
  const roomName = (id: string) => {
    const r = s.building.rooms.find((x) => x.id === id);
    return r ? ROOMS[r.type].name.toLowerCase() : 'la casa';
  };

  // Lo que se cuenta: el patio, la puerta, las salas y la cámara.
  if (guards.length)
    body.push(
      fill(rng.pick(RAID_FIGHT), { h: guards[0]!.name }) +
        (steps.some((x) => x.k === 'broke')
          ? ` Pero eran muchos: ${guards.length > 1 ? 'los de guardia cayeron' : 'cayó'} y rompieron la puerta.`
          : ''),
    );
  else if (steps.some((x) => x.k === 'broke'))
    body.push('No había nadie de guardia: rompieron la puerta a hachazos y entraron.');
  const rooms = [
    ...new Set(steps.flatMap((x) => (x.k === 'fight' && x.at !== YARD ? [x.at] : []))),
  ];
  if (rooms.length)
    body.push(
      `Se peleó en ${listNames(rooms.map((r) => roomName(r)))}${ds.length ? `: ${names} plantaron cara` : ''}.`,
    );
  if (!ds.length) body.push(RAID_EMPTY);
  if (steps.some((x) => x.k === 'open'))
    body.push(
      fight.stolen > 0
        ? 'Forzaron la cerradura de la cámara y cargaron los sacos.'
        : 'Forzaron la cerradura de la cámara, pero no llegaron a sacar nada de casa.',
    );
  else if (steps.some((x) => x.k === 'lock'))
    body.push('Llegaron a la cámara, pero la cerradura aguantó lo justo.');

  if (fight.recovered > 0)
    chips.push({ t: `Recuperado: ${fight.recovered} monedas que se llevaban`, k: 'good' });
  if (won) {
    const loot = rng.int(15, 45) + fight.downed * 5;
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
    }
  } else {
    s.gold = Math.max(0, s.gold - fight.stolen);
    s.rep = Math.max(0, s.rep - 3);
    s.truce = s.day + rng.int(4, 6);
    body.push(rng.pick(RAID_LOST));
    if (fight.stolen > 0) chips.push({ t: `Saqueo: −${fight.stolen} monedas`, k: 'bad' });
    chips.push({ t: '−3 reputación', k: 'bad' });
    // Los que salen con vida se llevan algo del arcón (nunca lo que los héroes llevan puesto).
    for (let i = 0; i < Math.min(2, fight.escaped) && s.inventory.length; i++) {
      if (i > 0 && !rng.chance(0.5)) break;
      const it = s.inventory.splice(rng.int(0, s.inventory.length - 1), 1)[0]!;
      chips.push({ t: `Robado: ${it.name}`, k: 'bad' });
    }
    if (s.trophies.length && rng.chance(0.25)) {
      const t = s.trophies.splice(rng.int(0, s.trophies.length - 1), 1)[0]!;
      chips.push({ t: `Robado el trofeo: ${t.name}`, k: 'bad' });
    }
    for (const h of ds) h.morale = Math.max(0, h.morale - 10);
  }
  for (const h of hurt) {
    h.status = 'herido';
    h.days = rng.int(2, 3);
    delete h.guard;
    delete h.job;
    chips.push({
      t: `${h.name}: ${h.sex === 'f' ? 'herida' : 'herido'}, ${h.days} días`,
      k: 'bad',
    });
  }
  for (const w of s.workers)
    if (fallen.has(w.id)) chips.push({ t: `${w.name} se llevó unos buenos golpes`, k: 'bad' });
  for (const h of ds) h.history.push(`Día ${s.day} · Defendió la taberna de ${raid.band}`);

  events.push({
    t: won
      ? `¡${raid.band[0]!.toUpperCase()}${raid.band.slice(1)} asaltó la taberna y ${names} ${ds.length > 1 ? 'los echaron' : 'los echó'}!`
      : fight.stolen > 0
        ? `${raid.band[0]!.toUpperCase()}${raid.band.slice(1)} asaltó la taberna y se llevó ${fight.stolen} monedas.`
        : `${raid.band[0]!.toUpperCase()}${raid.band.slice(1)} asaltó la taberna y salió con lo que pudo del arcón.`,
    k: won ? 'good' : 'bad',
  });
  s.lastRaid = {
    day: s.day,
    band: raid.band,
    bandits: banditCount(raid.strength),
    defenders: ds.map((h) => h.id),
    won,
    hurt: hurt.map((h) => h.id),
    stolen: fight.stolen,
    recovered: fight.recovered,
    plan: fight.plan,
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
