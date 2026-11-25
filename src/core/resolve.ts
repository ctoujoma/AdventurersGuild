/**
 * Resolución de misiones: abstracta, rápida y explicable.
 * Tira un dado por desafío, clasifica el resultado y aplica las consecuencias al estado
 * (que se recibe ya copiado: aquí se muta). Devuelve el informe para el amanecer.
 */
import { healthOf, hpOf, setHp, woundChip, woundParams } from './health';
import { clientMsg } from '../data/quests';
import { msg, type Msg, type Params, type Txt } from '../textos';
import { outcomeKey } from '../data/labels';
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
import { partyMods } from './classes';
import { emptyStats } from './feats';
import {
  ARMORY,
  DISASTER,
  CASUALTY,
  CLERIC_SAVE,
  COWARD_FLEE,
  LOST_SHARE,
  GREED,
  MAT_PER_OUTCOME,
  INJURY,
  DANGER_HP,
  DOWNED_HP,
  SCRATCH_HP,
  WOUND_HP,
  MORALE,
  PAY,
  REP,
  SCOUT_AMBUSH,
  TRIP_FATIGUE,
  TROPHY_REP,
  CACHE,
  LEVEL_MAX,
  levelRaise,
  TWIST_DIFF,
  XP,
  XP_PER_LEVEL,
  ATTR_MAX,
  rankIndex,
} from './balance';
import { generateQuest, homePower } from './generate';
import { TROPHIES } from '../data/items';
import { PLACE_INFO, placeAt, placeMsg } from '../data/places';
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
import { SLOTS, gearList, hasPerk, shownItem, type Gear } from './gear';
import { QUEST_MATERIAL, gainMats, matMsg } from './materials';

const has = (h: Hero, id: string) => h.traits.some((t) => t.id === id);
/** Claves de una lista de textos (`base.0`, `base.1`…), para elegir una por posición. */
const keysOf = (base: string, list: readonly unknown[]) => list.map((_, i) => `${base}.${i}`);
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
/**
 * Lo que suma a un héroe la armería del gremio más lo que lleva puesto (las tres ranuras). Cada
 * mejora del taller (`plus`) suma a la habilidad principal del objeto; la forja afila el arma.
 */
export function gearOf(worn: Gear | undefined, fac?: Facilities): Partial<Record<SkillId, number>> {
  const gear: Partial<Record<SkillId, number>> = { ...ARMORY[fac?.arm ?? 0] };
  for (const slot of SLOTS) {
    const item = worn?.[slot];
    const bonus = Object.entries(item?.bonus ?? {}) as [SkillId, number][];
    bonus.forEach(([k, v], i) => {
      const main = i === 0 ? (item?.plus ?? 0) : 0;
      gear[k] = (gear[k] ?? 0) + v + main;
    });
  }
  return gear;
}

/** Cada héroe con su equipo puesto: armería, objeto y su efecto. */
export function equip<T extends Member & { worn?: Gear }>(
  party: readonly T[],
  fac?: Facilities,
): T[] {
  return party.map((m) => ({
    ...m,
    gear: gearOf(m.worn, fac),
    perks: m.worn ? gearList(m).flatMap((i) => (i.perk ? [i.perk] : [])) : m.perks,
  }));
}

export function questEstimate(
  q: Quest,
  members: readonly (Member & { worn?: Gear })[],
  fac?: Facilities,
): Estimate & { reveal: boolean } {
  const party = equip(members, fac);
  const reveal = !!q.twist && partyMods(party).seer;
  const challenges = q.challenges.map((c, i) =>
    reveal && i === 0 ? { ...c, diff: c.diff + TWIST_DIFF } : c,
  );
  return { ...estimate(challenges, party), reveal };
}

/** Sube de nivel si toca (mejora su atributo, sube el sueldo, quizá pide caché). */
export function levelUp(state: GameState, h: Hero): { t: Txt; k: ChipKind }[] {
  const out: { t: Txt; k: ChipKind }[] = [];
  while (h.lvl < LEVEL_MAX && h.xp >= XP_PER_LEVEL) {
    h.xp -= XP_PER_LEVEL;
    h.lvl++;
    const a = MAIN_ATTR[h.cls];
    // El punto de nivel nunca se pierde (aunque ya esté muy entrenado).
    h.attrs[a] = Math.min(ATTR_MAX, h.attrs[a] + 1);
    h.salary += levelRaise(h.lvl);
    out.push({ t: msg('informes.sube_nivel', { heroe: h.name, nivel: h.lvl }), k: 'good' });
    const st = (state.stats ??= emptyStats());
    st.maxLvl = Math.max(st.maxLvl, h.lvl);
    // Al hacerse veterano y maestro piden su caché (una vez cada uno).
    if (CACHE[h.lvl] && !h.request && (h.cacheAt ?? 0) < h.lvl) {
      h.request = 'cache';
      h.cacheAt = h.lvl;
      out.push({ t: msg('informes.cache', { heroe: h.name }), k: 'warn' });
    }
  }
  // En el nivel máximo ya no se junta experiencia.
  if (h.lvl >= LEVEL_MAX) h.xp = 0;
  return out;
}

/** Pelea contra un jefe ya jugada (`core/combat.ts`): decide el resultado y quién cae. */
export interface FightOutcome {
  won: boolean;
  downed: readonly string[];
  /** La vida con la que acabó cada héroe (0–1). */
  hp?: Readonly<Record<string, number>>;
}

export function resolveMission(
  state: GameState,
  m: Mission,
  rng: Rng,
  fight?: FightOutcome,
): Report {
  const q = m.quest;
  const party = m.heroIds
    .map((id) => state.heroes.find((h) => h.id === id))
    .filter((h): h is Hero => !!h);
  const names = party.map((h) => h.name);
  const body: Txt[] = [];
  const chips: { t: Txt; k: ChipKind }[] = [];
  const mods = partyMods(party);
  const stats = (state.stats ??= emptyStats());
  const place = placeMsg(q.place);
  /** Una frase de las listas de relatos (por su clave), con los huecos de siempre. */
  const say = (key: string, h?: Hero, extra: Params = {}) =>
    body.push(
      msg(key, {
        grupo: names,
        lugar: place,
        cliente: clientMsg(q.client),
        heroe: h?.name ?? names,
        ...extra,
      }),
    );
  /** Una frase propia del informe (`informes.…`). */
  const tell = (key: string, p: Params) => body.push(msg(`informes.${key}`, p));
  const chip = (key: string, p: Params, k: ChipKind) =>
    chips.push({ t: msg(`informes.${key}`, p), k });

  // Frases sin repetir dentro del mismo informe.
  const used = new Set<string>();
  const fresh = (pool: readonly string[]) => {
    const left = pool.filter((x) => !used.has(x));
    const v = rng.pick(left.length ? left : pool);
    used.add(v);
    return v;
  };

  const opener = rng.pick([
    ...keysOf(`relatos.comienzos.${q.type}`, OPENERS[q.type]),
    ...keysOf(`relatos.mas_comienzos.${q.type}`, MORE_OPENERS[q.type]),
  ]);
  say(`${opener}.${party.length > 1 ? 1 : 0}`);
  const mage = party.find((h) => h.cls === 'mago');
  if (q.twist) tell(mage ? 'giro_mago' : 'giro', { mago: mage?.name, giro: q.twist });

  // El camino: un suceso, a veces un hallazgo; piques, rasgos y moral.
  if (rng.chance(0.35)) {
    if (rng.chance(0.3)) {
      const found = rng.int(5, 15);
      state.gold += found;
      say(rng.pick(keysOf('relatos.hallazgos', FINDS)), undefined, { oro: found });
      chip('chip_hallazgo', { n: found }, 'good');
    } else say(rng.pick(keysOf('relatos.camino', ROAD)));
  }
  if (party.length >= 2 && rng.chance(0.3)) {
    const a = rng.pick(party);
    const b = rng.pick(party.filter((h) => h !== a));
    say(rng.pick(keysOf('relatos.piques', BANTER)), undefined, { a: a.name, b: b.name });
  }
  const asides = party.flatMap((h) =>
    h.traits.filter((t) => TRAIT_LINES[t.id]).map((t) => [h, t.id] as const),
  );
  if (asides.length && rng.chance(0.45)) {
    const [h, id] = rng.pick(asides);
    say(rng.pick(keysOf(`relatos.por_rasgo.${id}`, TRAIT_LINES[id]!)), h);
  }
  if (rng.chance(0.4)) {
    const low = party.filter((h) => h.morale < MORALE_LOW);
    const high = party.filter((h) => h.morale >= MORALE_HIGH);
    if (low.length) say(rng.pick(keysOf('relatos.desanimados', LOW_MORALE)), rng.pick(low));
    else if (high.length) say(rng.pick(keysOf('relatos.animados', HIGH_MORALE)), rng.pick(high));
  }

  let outcome: Outcome;
  if (fight) {
    // La pelea contra el jefe lo ha decidido: sin bajas, brillante; todos en el suelo, desastre.
    const all = fight.downed.length >= party.length;
    outcome = fight.won
      ? fight.downed.length
        ? 'Éxito'
        : 'Éxito brillante'
      : all
        ? 'Desastre'
        : 'Fracaso';
  } else {
    // Desafíos.
    const lucky = party.filter((h) => has(h, 'afortunado') || hasPerk(h, 'luck'));
    const warded = party.find((h) => hasPerk(h, 'ward'));
    const jinx = party.some((h) => has(h, 'gafe')) && !warded ? 0.05 : 0;
    if (warded && party.some((h) => has(h, 'gafe')))
      tell('amuleto', {
        objeto: gearList(warded).find((i) => i.perk === 'ward')!.name,
        heroe: warded.name,
      });
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
        if (ok) tell('suerte', { heroe: lh.name });
      }
      if (ok) passes++;
      const best = [...party].sort((a, b) => skill(b, c.skill, true) - skill(a, c.skill, true))[0];
      const k = ok ? 'ok' : 'ko';
      const pool = rng.chance(0.35)
        ? keysOf(`relatos.por_clase.${best!.cls}.${k}`, CLASS_LINES[best!.cls][k])
        : [
            ...keysOf(`relatos.lineas.${c.skill}.${k}`, LINES[c.skill][k]),
            ...keysOf(`relatos.mas_lineas.${c.skill}.${k}`, MORE_LINES[c.skill][k]),
          ];
      const shown = shownItem(best!);
      if (ok && (shown?.rarity ?? 0) >= 1 && rng.chance(0.4))
        say(fresh(keysOf('relatos.por_objeto', ITEM_LINES)), best, { objeto: shown!.name });
      else say(fresh(pool), best);
    });

    const n = q.challenges.length;
    if (passes === n) outcome = sumP / n > 0.8 ? 'Éxito brillante' : 'Éxito';
    else if (passes > 0) outcome = 'Éxito parcial';
    else {
      const ambush = rng.chance(DISASTER[q.danger]!);
      const scout =
        party.find((h) => h.cls === 'explorador') ?? party.find((h) => hasPerk(h, 'ambush'));
      if (ambush && scout && rng.chance(1 - SCOUT_AMBUSH)) {
        outcome = 'Fracaso';
        tell('emboscada', { heroe: scout.name });
      } else outcome = ambush ? 'Desastre' : 'Fracaso';
    }
  }
  const ok = outcomeKey(outcome);
  say(
    rng.pick(
      rng.chance(0.4)
        ? keysOf(`relatos.cierres_cliente.${ok}`, CLIENT_CLOSERS[outcome])
        : [
            ...keysOf(`relatos.cierres.${ok}`, CLOSERS[outcome]),
            ...keysOf(`relatos.mas_cierres.${ok}`, MORE_CLOSERS[outcome]),
          ],
    ),
  );

  // Oro, reputación y botín.
  const escort = q.type === 'Escoltar' && state.fac.establo >= 2 ? 1.25 : 1;
  let gold = Math.round(q.reward * PAY[outcome] * mods.gold * escort);
  const rogue = party.find((h) => h.cls === 'picaro');
  if (gold > 0 && rogue && rng.chance(0.5)) tell('picaro', { heroe: rogue.name });
  const greedy = party.find((h) => has(h, 'codicioso'));
  if (gold > 0 && greedy) {
    const cut = Math.round(gold * GREED);
    gold -= cut;
    chip('chip_codicioso', { heroe: greedy.name, n: cut }, 'warn');
  }
  state.gold += gold;
  stats.missions++;
  stats.goldEarned += gold;
  if (outcome === 'Éxito' || outcome === 'Éxito brillante') {
    stats.wins++;
    stats.byType[q.type] = (stats.byType[q.type] ?? 0) + 1;
  }
  if (outcome === 'Éxito brillante') stats.brilliant++;
  // Explorar con éxito descubre los dos lugares más cercanos en el mapa.
  if (q.type === 'Explorar' && PAY[outcome] >= 1) {
    const here = placeAt(q.place);
    const near = Object.entries(PLACE_INFO)
      .filter(([n]) => n !== q.place && !state.explored?.includes(n))
      .sort(
        ([, a], [, b]) =>
          Math.hypot(a.x - here.x, a.y - here.y) - Math.hypot(b.x - here.x, b.y - here.y),
      )
      .slice(0, 2)
      .map(([n]) => n);
    if (near.length) {
      (state.explored ??= []).push(...near);
      chip('chip_mapa', { lugares: near.map(placeMsg) }, 'info');
    }
  }
  chips.unshift({
    t: gold > 0 ? msg('informes.chip_monedas', { n: gold }) : msg('informes.chip_sin_cobrar'),
    k: gold > 0 ? 'good' : 'bad',
  });
  // Materiales: cada tipo de encargo trae el suyo, más cuanto mejor sale.
  const nMat = MAT_PER_OUTCOME[outcome];
  if (nMat > 0) {
    const m = QUEST_MATERIAL[q.type];
    const got = gainMats(state, { [m]: nMat });
    if (got.kept[m]) chip('chip_material', { n: got.kept[m], material: matMsg(m) }, 'info');
    if (got.warn) chips.push({ t: got.warn, k: 'warn' });
  }
  const dRep = REP[outcome];
  state.rep = Math.max(0, state.rep + dRep);
  chip('chip_reputacion', { mas: dRep >= 0, n: dRep }, dRep >= 0 ? 'good' : 'bad');
  const looted = PAY[outcome] >= 1 || (outcome === 'Éxito parcial' && mods.partialLoot);
  if (q.item && looted) {
    state.inventory.push({ ...q.item, id: `i${state.uid++}` });
    chip('chip_botin', { objeto: q.item.name }, 'info');
    if (PAY[outcome] < 1 && rogue) tell('picaro_botin', { heroe: rogue.name });
  }
  // Trofeo: solo de las grandes hazañas.
  if (outcome === 'Éxito brillante' && q.danger >= 2) {
    const t = rng.pick(TROPHIES[q.type]);
    state.trophies.push({
      id: `t${state.uid++}`,
      ...t,
      who: msg('general.lista', { xs: names }),
      place: q.place,
      day: state.day,
      value: 40 + q.danger * 20,
    });
    state.rep += TROPHY_REP;
    stats.trophies++;
    tell('trofeo', { trofeo: t.name });
    chip('chip_trofeo', { trofeo: t.name }, 'good');
  }

  // Bajas.
  const healer = party.find((h) => h.cls === 'clerigo');
  let fallen: Hero | null = null;
  let victim: Hero | null = null;
  const pCasualty = CASUALTY[outcome][q.danger] ?? 0;
  if (pCasualty > 0 && rng.chance(pCasualty)) {
    const fallenHere = fight ? party.filter((h) => fight.downed.includes(h.id)) : [];
    victim = rng.pick(fallenHere.length ? fallenHere : party);
    if (has(victim, 'cobarde') && rng.chance(COWARD_FLEE)) {
      tell('cobarde', { heroe: victim.name });
      victim = null;
    } else if (healer && healer !== victim && rng.chance(CLERIC_SAVE)) {
      const options = SCARS.map((x, i) => ({ ...x, i })).filter((x) => !has(victim!, x.trait));
      setHp(victim, DOWNED_HP[0]);
      if (options.length) {
        const scar = rng.pick(options);
        victim.traits.push({ id: scar.trait });
        const nick = victim.nick ?? msg(`relatos.cicatrices.${scar.i}.nick.${victim.sex}`);
        victim.nick = nick;
        tell('secuela', {
          heroe: victim.name,
          herida: msg(`relatos.cicatrices.${scar.i}.texto`),
          curandero: healer.name,
          apodo: nick,
        });
        chip('chip_secuela', { rasgo: msg(`rasgos.rasgos.${scar.trait}.${victim.sex}`) }, 'warn');
      } else tell('salvado', { heroe: victim.name, curandero: healer.name });
      chips.push({ t: woundChip(victim), k: 'bad' });
    } else if (!rng.chance(LOST_SHARE)) {
      victim.status = 'muerto';
      fallen = victim;
      stats.lastDeath = state.day;
      for (const it of gearList(victim)) chip('chip_perdido', { objeto: it.name }, 'bad');
      delete victim.worn;
      state.fallen.unshift({
        id: victim.id,
        name: victim.nick
          ? msg('general.apodado', { nombre: victim.name, apodo: victim.nick })
          : victim.name,
        epitaph: msg('informes.epitafio', { titulo: q.title, dia: state.day }),
      });
      tell('caido', { heroe: victim.name });
      chip('chip_caido', { heroe: victim.name, sexo: victim.sex }, 'bad');
    } else {
      victim.status = 'desaparecido';
      victim.lostAt = q.place;
      victim.days = rng.int(2, 4);
      // Encargo de rescate: mientras alguien lo busca, no se le da por perdido.
      const rq = generateQuest(
        rng,
        `q${state.uid++}`,
        rankIndex(state.rep),
        `i${state.uid++}`,
        false,
        'Explorar',
        homePower(state.heroes),
      );
      state.quests.push({
        ...rq,
        title: msg('informes.rescate_titulo', { heroe: victim.name }),
        client: 'gremio',
        text: msg('informes.rescate_texto', { lugar: place }),
        place: q.place,
        danger: q.danger,
        dangerHidden: undefined,
        twist: undefined,
        item: undefined,
        reward: 0,
        expires: victim.days,
        rescue: victim.id,
      });
      tell('desaparecido', { heroe: victim.name, lugar: place });
      chip('chip_desaparecido', { heroe: victim.name, sexo: victim.sex }, 'bad');
    }
  }

  // Los que vuelven.
  for (const h of party) {
    if (h.status === 'muerto' || h.status === 'desaparecido') continue;
    if (h !== victim) {
      h.status = 'ok';
      h.days = 0;
      const before = healthOf(h);
      const guarded = party.some((o) => o !== h && o.cls === 'guerrero');
      const armored = hasPerk(h, 'guard') ? 0.5 : 1;
      const risk =
        INJURY[outcome] * (guarded ? mods.guard : 1) * armored + (has(h, 'valiente') ? 0.08 : 0);
      const dk = DANGER_HP[q.danger] ?? 1;
      if (fight) {
        // Contra el jefe: la vida con la que acabó la pelea; quien cayó, grave.
        if (fight.downed.includes(h.id)) setHp(h, rng.range(DOWNED_HP[0], DOWNED_HP[1]));
        else if (fight.hp?.[h.id] !== undefined) setHp(h, fight.hp[h.id]!);
      } else {
        // Sin pelea: un rasguño a todos y, a quien le toca, una herida (sin llegar a 0).
        const wound = rng.chance(risk) ? rng.range(WOUND_HP[0], WOUND_HP[1]) * armored : 0;
        const left = hpOf(h) - (SCRATCH_HP[outcome] + wound) * dk;
        setHp(h, Math.max(DOWNED_HP[0], left));
      }
      if (healthOf(h) !== 'sano' && healthOf(h) !== before) {
        tell('herida', woundParams(h));
        chips.push({ t: woundChip(h), k: 'bad' });
      }
    }
    h.xp += XP[outcome];
    chips.push(...levelUp(state, h));
    let dMorale = MORALE[outcome] - TRIP_FATIGUE * q.days;
    if (fallen) dMorale -= Math.round((has(h, 'leal') ? 20 : 10) * (state.fac.cap >= 2 ? 0.5 : 1));
    if (has(h, 'codicioso') && q.reward >= 200 && PAY[outcome] >= 1) dMorale += 5;
    if (dMorale < 0) dMorale = Math.round(dMorale * mods.solace);
    h.morale = clamp(h.morale + dMorale, 0, 100);
    h.history.push(
      msg('informes.historial', {
        dia: state.day,
        titulo: q.title,
        resultado: outcomeMsg(outcome),
      }),
    );
    const hidden = h.traits.find((t) => t.hidden);
    if (hidden) {
      hidden.hidden = false;
      const label = msg(`rasgos.rasgos.${hidden.id}.${h.sex}`);
      body.push(
        msg(fresh(keysOf('relatos.revelar', REVEALS)), {
          heroe: h.name,
          rasgo: label,
          lugar: place,
        }),
      );
      chip('chip_descubierto', { rasgo: label }, 'info');
    }
  }

  return {
    id: `r${state.uid++}`,
    day: state.day,
    title: q.title,
    heroIds: party.map((h) => h.id),
    who: msg('general.lista', { xs: names }),
    outcome,
    body,
    chips,
    read: false,
  };
}

/** El resultado escrito (los ids de `Outcome` están en español: se enseñan con esto). */
export const outcomeMsg = (o: Outcome): Msg => msg(`etiquetas.resultado.${outcomeKey(o)}`);
