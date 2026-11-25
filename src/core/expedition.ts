/**
 * Expediciones (fase 8; decidido con el usuario, bloque 8 de `docs/decisiones.md`): de 1 a 4
 * héroes salen hacia un rumbo con las raciones que elija el jugador. Sin destino: cada día más
 * lejos, con más peligro y mejor botín, poco a poco. Vuelven solos cuando solo quedan las raciones
 * de la vuelta (o si alguien cae), o cuando el jugador quiera; la vuelta tarda la mitad.
 *
 * Corren por horas de juego: cada hora tira con su propia semilla, así que pasa lo mismo con el
 * juego abierto que cerrado (`away.ts` pasa por `endDay`, que las pone al día).
 */
import { healthOf, hpOf, setHp, woundChip } from './health';
import {
  CLERIC_SAVE,
  DAY_SECONDS,
  EXPEDITION_LEVEL,
  EXP_CAMP,
  EXP_CLERIC_HEAL,
  EXP_CRYSTAL_FROM,
  EXP_FOG_AMBUSH,
  EXP_POTION_AFTER,
  EXP_BOSS_SEEN,
  EXP_BOSS_MULT,
  EXP_ESCAPE_HP,
  EXP_UNLOCK,
  MAX_CANDIDATES,
  EXP_POTION_FIND,
  EXP_RAIN_SLOW,
  EXP_SNOW_EAT,
  EXP_WEATHER_FROM,
  EXP_DOWN_DEATH,
  EXP_EVENTS,
  EXP_EVENTS_FAR,
  EXP_FIGHT,
  EXP_FIGHT_FAR,
  EXP_GOLD,
  EXP_GOLD_FAR,
  EXP_GROUP,
  EXP_HOME_MORALE,
  EXP_HOURS,
  EXP_HUNGER,
  EXP_HURT_HP_LOSS,
  DOWNED_HP,
  EXP_HURT_DOWN,
  EXP_MAT_FAR,
  EXP_STEP,
  EXP_WIPE_KEEP,
  EXP_XP_DAY,
  EXP_XP_FAR,
  EXP_CHOICES,
  EXP_FOE,
  EXP_FOE_SPREAD,
  EXP_GUARDIAN,
  EXP_GUARDIAN_MULT,
  EXP_GUARDIAN_WAIT,
  EXP_LOSS_HP,
  EXP_FIGHT_WEAR,
  EXP_GRAVE_FALL,
  EXP_EVENT_HP,
  EXP_CAMP_HEAL,
  EXP_CLERIC_HP,
  EXP_POTION_HP,
  EXP_SLOW_LIGHT,
  EXP_SLOW_GRAVE,
  EXP_SLOW_MAX,
  HP_GRAVE,
  HP_LIGHT,
  EXP_BUNDLES_MAX,
  MAT_SELL,
} from './balance';
import {
  EXP_EVENTS as EXP_EVENTS_DEF,
  EXP_EVENT_LIST,
  type ExpEvent,
  type ExpOption,
} from '../data/expEvents';
import type { BossKind } from '../data/bosses';
import { GEAR } from '../data/items';
import type { Terrain } from '../data/places';
import { foeUnits, heroUnit, runCombat, setupCombat, type CombatSetup } from './combat';
import { fightRoster } from './chains';
import { generateHero } from './generate';
import { expeditionsOpen, gainMats, matsMsg, type Material, type Mats } from './materials';
import type {
  ChipKind,
  DawnEvent,
  Expedition,
  ExpKind,
  ExpTurn,
  GameState,
  Heading,
  Hero,
  Outcome,
  Report,
  BossFight,
  ExpBundle,
  ExpWeather,
  Glow,
  Item,
  Rarity,
} from './model';
import { attr, chance, skill } from './party';
import { equip, levelUp } from './resolve';
import { Rng } from './rng';
import type { FoeKind } from '../data/journey';
import { gearList } from './gear';
import { emptyStats } from './feats';
import { msg, t, tl, type Msg, type Params, type Txt } from '../textos';

export const HEADINGS: readonly Heading[] = ['bosque', 'sierra', 'marismas', 'ruinas'];
/** Lo que pide un rumbo para abrirse (sin nada, abierto de entrada). */
export const unlockOf = (h: Heading): { after: Heading; dias: number } | null =>
  h === 'bosque' ? null : EXP_UNLOCK[h];

/**
 * Si un rumbo ya se puede tomar: el bosque siempre; los demás, con el récord pedido en el
 * anterior (o si ya se fue alguna vez, en partidas de antes).
 */
export function headingOpen(s: GameState, h: Heading): boolean {
  const u = unlockOf(h);
  if (!u) return true;
  const best = s.expBest ?? {};
  return best[h] !== undefined || (best[u.after] ?? 0) >= u.dias;
}

/** Lo que trae cada rumbo: lo de siempre y lo de lejos (el cristal, desde `EXP_CRYSTAL_FROM`). */
export const HEADING_MATS: Record<Heading, readonly Material[]> = {
  bosque: ['madera', 'hierbas'],
  sierra: ['hierro', 'cristal'],
  marismas: ['hierbas', 'cuero'],
  ruinas: ['cristal', 'hierro'],
};

/** Qué familia de enemigos dibujar para cada uno de `expediciones.enemigos.<rumbo>`. */
export const HEADING_FOES: Partial<Record<Heading, readonly FoeKind[]>> = {
  bosque: ['bestia', 'bestia', 'bandido', 'bestia', 'bandido', 'alimana'],
  sierra: ['bestia', 'trasgo', 'bestia', 'grande'],
  marismas: ['alimana', 'muerto', 'bandido', 'alimana'],
  ruinas: ['muerto', 'bandido', 'alimana', 'grande'],
};

/** El tiempo que puede hacer en cada rumbo y lo probable que es cada día (si no, claro). */
const SKY: Record<Heading, readonly [ExpWeather, number][]> = {
  bosque: [
    ['lluvia', 0.3],
    ['niebla', 0.15],
  ],
  sierra: [
    ['nieve', 0.4],
    ['viento', 0.2],
  ],
  marismas: [
    ['niebla', 0.4],
    ['lluvia', 0.25],
  ],
  ruinas: [
    ['polvo', 0.3],
    ['tormenta', 0.15],
  ],
};
/** Lo que hace cada tiempo: les para a ratos, tapa la pista (y trae emboscadas) o gasta raciones. */
const SLOWS: readonly ExpWeather[] = ['lluvia', 'viento', 'tormenta'];
const BLINDS: readonly ExpWeather[] = ['niebla', 'polvo', 'tormenta'];

/**
 * El tiempo que les hace ahora (bloque 5): cerca de casa, el de la taberna (sin efecto, `claro`);
 * lejos, el del rumbo, uno por día con su semilla (igual abierto que cerrado).
 */
export function expWeather(e: Expedition): ExpWeather {
  if (distAt(e) < EXP_WEATHER_FROM) return 'claro';
  const r = new Rng(`${e.seed}-tiempo-${Math.floor(e.hours / EXP_HOURS)}`).next();
  let acc = 0;
  for (const [w, p] of SKY[e.heading]) if (r < (acc += p)) return w;
  return 'claro';
}

/** Segundos de juego de una hora de expedición. */
export const HOUR = DAY_SECONDS / EXP_HOURS;

/** Segundos de juego desde el amanecer del día 1 (el reloj de las expediciones). */
export const gameTime = (s: GameState) => (s.day - 1) * DAY_SECONDS + (s.clock ?? 0);

/** El nombre de un rumbo, para un hueco. */
export const headingMsg = (h: Heading): Msg => msg(`expediciones.rumbos.${h}.nombre`);

// ---------- Consultas ----------

export { expeditionsOpen };

const mapRoom = (s: GameState) => s.building.rooms.find((r) => r.type === 'mapas');

/** Cuántos pueden ir en un grupo: lo da el nivel de la sala de mapas (1 a 4). */
export const partyCap = (s: GameState) => Math.min(4, (mapRoom(s)?.level ?? 0) + 1);

/** Cuántas expediciones a la vez: los huecos de la sala de mapas (1 a 3). */
export const expSlots = (s: GameState) => Math.max(1, Math.min(3, mapRoom(s)?.w ?? 1));

/** Las raciones mínimas para salir: un día de ida y la vuelta. */
export const minRations = (n: number) => n * 2;

/** Por qué no puede salir esa expedición (o null). */
export function canExpedition(
  s: GameState,
  heading: Heading,
  heroIds: readonly string[],
  rations: number,
  unguard = false,
  potions = 0,
): string | null {
  if (!expeditionsOpen(s)) return t('expediciones.error.cerradas', { nivel: EXPEDITION_LEVEL });
  if (!headingOpen(s, heading)) {
    const u = unlockOf(heading)!;
    return t('expediciones.error.cerrado', { antes: u.after, dias: u.dias });
  }
  if ((s.expeditions?.length ?? 0) >= expSlots(s))
    return t('expediciones.error.sin_hueco', { n: expSlots(s) });
  if (!heroIds.length) return t('partida.error.sin_heroes');
  if (heroIds.length > partyCap(s)) return t('expediciones.error.tope', { n: partyCap(s) });
  const party = heroIds.map((id) => s.heroes.find((h) => h.id === id));
  if (party.some((h) => !h || h.status !== 'ok')) return t('partida.error.no_disponible');
  const guard = !unguard && party.find((h) => h!.guard);
  if (guard) return t('partida.error.de_guardia', { heroe: guard.name });
  if (rations < minRations(heroIds.length))
    return t('expediciones.error.pocas_raciones', { n: minRations(heroIds.length) });
  if (rations > s.food) return t('expediciones.error.despensa', { n: s.food });
  if (potions > potionsMax(s)) return t('expediciones.error.pociones', { n: potionsMax(s) });
  return null;
}

/** Las pociones hechas en la alquimia que se pueden llevar (sin hacer, no hay). */
export const potionsMax = (s: GameState): number => s.potions ?? 0;

/** Horas andadas (sin las paradas esperando un suceso). */
const moved = (e: Expedition) => e.hours - (e.idle ?? 0);

/** Lejanía (días de ida) ahora; de vuelta, baja el doble de deprisa. */
export function distAt(e: Expedition): number {
  if (!e.turn) return moved(e) / EXP_HOURS;
  const back = moved(e) - (e.turn.h - (e.turn.idle ?? 0));
  return Math.max(0, e.turn.dist - (2 * back) / EXP_HOURS);
}

/** Horas que les quedan para llegar a casa (de ida, contando con dar la vuelta ya). */
export function hoursHome(e: Expedition): number {
  return Math.ceil((distAt(e) * EXP_HOURS) / 2);
}

/** Los que siguen en pie (con algo de vida; a 0, en el suelo: les llevan los demás). */
export const standing = (e: Expedition, s: GameState) =>
  e.heroIds
    .map((id) => s.heroes.find((h) => h.id === id))
    .filter((h): h is Hero => !!h && hpOf(h) > 0);

/**
 * La vida fuera de casa: se apunta en `Hero.hp` sin tocar su estado (siguen «de misión»); al
 * volver, `arrive` les pone en pie o en cama según la que traigan.
 */
const setLife = (h: Hero, hp: number) => {
  h.hp = Math.max(0, Math.min(1, hp));
};

/** Partidas de antes: las heridas contadas pasan a vida (una vez). */
function legacyHurt(s: GameState, e: Expedition): void {
  if (!e.hurt) return;
  for (const [id, n] of Object.entries(e.hurt)) {
    const h = s.heroes.find((x) => x.id === id);
    if (h && n) setLife(h, n >= EXP_HURT_DOWN ? 0 : hpOf(h) - EXP_HURT_HP_LOSS * n);
  }
  delete e.hurt;
}

/**
 * Le quitan vida en una expedición. Si queda grave (de ida), dan la vuelta; si ya iba sin
 * fuerzas, al suelo. Avisa la primera vez que alguien va herido.
 */
function wound(e: Expedition, h: Hero, amount: number): void {
  const was = hpOf(h);
  setLife(h, was < HP_GRAVE ? was - amount : Math.max(0.02, was - amount));
  warnHurt(e, h);
  if (hpOf(h) < HP_GRAVE && !e.turn) turnBack(e, 'herido', h);
}

/** «Va herido: quizá convenga volver» (una vez por héroe, en cuanto baja del 50 %). */
function warnHurt(e: Expedition, h: Hero): void {
  if (e.turn || hpOf(h) >= HP_LIGHT || hpOf(h) < HP_GRAVE || e.hurtWarned?.includes(h.id)) return;
  (e.hurtWarned ??= []).push(h.id);
  line(e, 'herida', 'expediciones.diario.herido_leve', { heroe: h.name, sexo: h.sex }, h.id);
}

/** Los del grupo (en pie o no). */
const party = (s: GameState, e: Expedition) =>
  e.heroIds.map((id) => s.heroes.find((h) => h.id === id)).filter((h): h is Hero => !!h);

/** El que tiene menos vida (si a alguno le falta). */
const worstOf = (xs: readonly Hero[]) =>
  xs.filter((h) => hpOf(h) < 1).sort((a, b) => hpOf(a) - hpOf(b))[0];

/** Cada hora, la probabilidad de no avanzar por ir con heridos (leves y graves). */
export function hurtSlow(e: Expedition, s: GameState): number {
  let p = 0;
  for (const id of e.heroIds) {
    const h = s.heroes.find((x) => x.id === id);
    if (!h) continue;
    const hp = hpOf(h);
    if (hp < HP_GRAVE) p += EXP_SLOW_GRAVE;
    else if (hp < HP_LIGHT) p += EXP_SLOW_LIGHT;
  }
  return Math.min(EXP_SLOW_MAX, p);
}

/** La dificultad de una pelea a esa lejanía. */
export const fightDiff = (dist: number) => EXP_FIGHT + EXP_FIGHT_FAR * dist;

/** La fuerza del grupo en una pelea: la media de Combate (menos las heridas), más los de más. */
export function partyPower(s: GameState, e: Expedition): number {
  const up = standing(e, s);
  if (!up.length) return 0;
  const sum = equip(up, s.fac).reduce(
    (a, h) => a + Math.max(0, skill(h, 'Combate', true) - 3 * (1 - hpOf(h))),
    0,
  );
  return sum / up.length + EXP_GROUP * (up.length - 1);
}

/** Cómo de peligroso es ahora para este grupo, en palabras (0 tranquilo … 3 muy peligroso). */
export function riskNow(s: GameState, e: Expedition): 0 | 1 | 2 | 3 {
  const p = chance(partyPower(s, e), fightDiff(distAt(e)));
  return p >= 0.8 ? 0 : p >= 0.6 ? 1 : p >= 0.4 ? 2 : 3;
}

// ---------- Salir y volver ----------

/** Sale una expedición (ya comprobada con `canExpedition`). Muta `s`. */
export function sendExpedition(
  s: GameState,
  heading: Heading,
  heroIds: readonly string[],
  rations: number,
  potions = 0,
): Expedition {
  const party = heroIds.map((id) => s.heroes.find((h) => h.id === id)!);
  for (const h of party) {
    if (h.guard) {
      delete h.guard;
      h.guardBefore = true;
    }
    h.status = 'mision';
    h.days = 0;
    if (h.job) h.jobBefore = h.job;
    delete h.job;
  }
  s.food -= rations;
  if (potions) s.potions = (s.potions ?? 0) - potions;
  const id = `x${s.uid++}`;
  const e: Expedition = {
    id,
    heading,
    heroIds: [...heroIds],
    seed: `${s.seed}-${id}`,
    from: gameTime(s),
    hours: 0,
    rations,
    took: rations,
    bag: { gold: 0, mats: {} },
    log: [],
    warned: 0,
    won: 0,
    lost: 0,
    ...(potions ? { potions } : {}),
  };
  e.log.push({
    h: 0,
    k: 'salida',
    t: msg('expediciones.diario.salida', {
      grupo: party.map((h) => h.name),
      n: party.length,
      rumbo: heading,
      raciones: rations,
    }),
  });
  (s.expeditions ??= []).push(e);
  s.lastParty = [...heroIds];
  return e;
}

/** El jugador les manda volver. */
export function callBack(s: GameState, id: string): boolean {
  const e = s.expeditions?.find((x) => x.id === id);
  if (!e || e.turn) return false;
  turnBack(e, 'jugador');
  return true;
}

function turnBack(e: Expedition, why: ExpTurn, hero?: Hero): void {
  e.turn = { h: e.hours, dist: distAt(e), why, idle: e.idle ?? 0 };
  line(e, 'vuelta', `expediciones.diario.vuelta.${why}`, {
    heroe: hero?.name ?? '',
    sexo: hero?.sex ?? 'm',
    raciones: e.rations,
    n: e.heroIds.length,
  });
}

/**
 * El brillo de lo que se acaba de encontrar (bloque 4; EX18): lo suben `find`, `loot` y
 * `findItem`, y se lo lleva la siguiente línea del diario (`line`). El paso es síncrono y con la
 * misma semilla, así que da lo mismo con el juego abierto o cerrado.
 */
let glowNext: 0 | Glow = 0;
const shine = (g: 0 | Glow) => {
  if (g > glowNext) glowNext = g;
};

/** El brillo de un objeto según su rareza: bueno (hasta 1), raro (2) y legendario (3 o más). */
export const itemGlow = (r: Rarity | undefined): Glow => ((r ?? 0) >= 3 ? 3 : r === 2 ? 2 : 1);
/** El de un material: el cristal es raro; lo demás, común. */
export const matGlow = (m: Material): 0 | Glow => (m === 'cristal' ? 2 : 0);

function line(
  e: Expedition,
  k: ExpKind,
  key: string,
  p: Params = {},
  hero?: string,
  won?: boolean,
) {
  e.log.push({
    h: e.hours,
    k,
    t: msg(key, { n: e.heroIds.length, ...p }),
    ...(hero ? { hero } : {}),
    ...(won !== undefined ? { won } : {}),
    ...(glowNext ? { g: glowNext } : {}),
  });
  glowNext = 0;
}

// ---------- Hora a hora ----------

/**
 * Pone al día las expediciones hasta `at` (segundos de juego desde el día 1; por defecto, ahora).
 * Devuelve los avisos y los héroes que han vuelto (la partida los devuelve a su puesto). Muta `s`.
 */
export function stepExpeditions(
  s: GameState,
  at = gameTime(s),
): { news: DawnEvent[]; home: string[] } {
  const news: DawnEvent[] = [];
  const home: string[] = [];
  if (!s.expeditions?.length) return { news, home };
  for (const e of [...s.expeditions]) {
    legacyHurt(s, e);
    const until = Math.floor((at - e.from) / HOUR);
    while (e.hours < until) {
      e.hours++;
      glowNext = 0;
      const n0 = e.log.length;
      stepHour(s, e, news);
      // Lo raro y lo legendario se avisan en la barra (con su brillo y su sonido).
      for (const l of e.log.slice(n0)) {
        // Alguien va herido: aviso en la barra (por si conviene mandarles volver).
        const hk = typeof l.t === 'object' && l.t.k === 'expediciones.diario.herido_leve';
        const who = hk ? s.heroes.find((h) => h.id === l.hero) : undefined;
        if (who)
          news.push({
            t: msg('expediciones.aviso.herido', {
              rumbo: e.heading,
              heroe: who.name,
              sexo: who.sex,
            }),
            k: 'warn',
          });
        if ((l.g ?? 0) >= 2)
          news.push({
            t: msg('expediciones.aviso.brillo', { rumbo: e.heading, brillo: l.g!, que: l.t }),
            k: 'good',
            glow: l.g,
            ...(l.g === 3 ? { big: true } : {}),
          });
      }
      if (e.turn && distAt(e) <= 0) {
        home.push(...arrive(s, e, news));
        break;
      }
    }
  }
  return { news, home };
}

/** Lo que pasa en una hora: la noche (cena y cuentas) o, a veces, un suceso. */
function stepHour(s: GameState, e: Expedition, news: DawnEvent[]): void {
  const rng = new Rng(`${e.seed}-${e.hours}`);
  const hod = Math.floor(((e.from + e.hours * HOUR) % DAY_SECONDS) / HOUR);
  // Esperando un suceso: parados (cenan si es de noche) hasta que se elija o se acabe el plazo.
  if (e.pending) {
    e.idle = (e.idle ?? 0) + 1;
    if (hod === EXP_CAMP) camp(s, e, rng);
    if (e.pending && e.hours >= e.pending.until) decide(s, e, safeOption(e.pending.kind), true);
    return;
  }
  const dist = distAt(e);
  if (hod === EXP_CAMP) {
    camp(s, e, rng);
    return;
  }
  // El tiempo del día: se apunta al cambiar; la lluvia, el viento y la tormenta les paran a ratos.
  const sky = expWeather(e);
  if (sky !== (e.sky ?? 'claro')) {
    e.sky = sky;
    line(e, 'camino', `expediciones.diario.tiempo.${sky}`, { rumbo: e.heading });
  }
  // La lluvia, el viento y la tormenta les paran a ratos; los heridos, también.
  const slow = 1 - (1 - (SLOWS.includes(sky) ? EXP_RAIN_SLOW : 0)) * (1 - hurtSlow(e, s));
  if (slow > 0 && rng.chance(slow)) {
    e.idle = (e.idle ?? 0) + 1;
    return;
  }
  // Escalones de peligro: un aviso al adentrarse (de ida).
  if (!e.turn && Math.floor(dist / EXP_STEP) > e.warned) {
    e.warned = Math.floor(dist / EXP_STEP);
    line(e, 'aviso', 'expediciones.diario.aviso', { rumbo: e.heading, dias: Math.floor(dist) });
  }
  // Más lejos que nunca por este rumbo (una vez).
  const best = s.expBest?.[e.heading];
  if (!e.turn && !e.record && best !== undefined && dist > best) {
    e.record = true;
    line(e, 'aviso', 'expediciones.diario.record', { rumbo: e.heading, dias: Math.floor(best) });
  }
  // Lo que ya está en el mapa: fardos perdidos y parajes que quedaron sin ver.
  if (!e.turn && mapStop(s, e, dist, news)) return;
  const rate = (EXP_EVENTS + EXP_EVENTS_FAR * dist) * (e.turn ? 0.5 : 1);
  if (!rng.chance(rate / (EXP_HOURS - 1))) return;
  const up = standing(e, s);
  if (!up.length) return;
  const who = rng.pick(up);
  // El guardián: raro, lejos y uno por expedición.
  if (
    !e.guardian &&
    !e.turn &&
    dist >= EXP_EVENTS_DEF.guardian.from &&
    rng.chance(EXP_GUARDIAN * (dist - 3))
  ) {
    e.guardian = true;
    raise(s, e, 'guardian', news);
    return;
  }
  const roll = rng.next();
  const fightP = 0.22 + Math.min(0.15, 0.025 * dist) + (sky === 'niebla' ? EXP_FOG_AMBUSH : 0);
  const kinds = EXP_EVENT_LIST.filter((k) => {
    const d = EXP_EVENTS_DEF[k];
    return d.weight > 0 && dist >= d.from && (!d.headings || d.headings.includes(e.heading));
  });
  if (roll < fightP) fight(s, e, rng, dist, news);
  else if (roll < fightP + EXP_CHOICES * (e.turn ? 0.5 : 1) && kinds.length)
    raise(
      s,
      e,
      rng.weighted(kinds.map((k) => [k, EXP_EVENTS_DEF[k].weight] as [ExpEvent, number])),
      news,
    );
  else if (roll < fightP + 0.55) find(e, rng, dist, who);
  else if (roll < fightP + 0.62) {
    const n = rng.int(1, Math.max(1, Math.ceil(up.length / 2)));
    e.rations += n;
    line(e, 'raciones', 'expediciones.diario.raciones', { heroe: who.name, n }, who.id);
  } else {
    const pool = tl(`expediciones.diario.camino.${e.heading}`);
    const i = rng.int(0, pool.length - 1);
    line(
      e,
      'camino',
      `expediciones.diario.camino.${e.heading}.${i}`,
      { heroe: who.name, sexo: who.sex },
      who.id,
    );
  }
}

/** Un hallazgo: monedas o materiales del rumbo (más cuanto más lejos). */
function find(e: Expedition, rng: Rng, dist: number, who: Hero): void {
  if (rng.chance(EXP_POTION_FIND)) {
    e.potions = (e.potions ?? 0) + 1;
    line(e, 'hallazgo', 'expediciones.diario.pocion_hallada', { heroe: who.name }, who.id);
    return;
  }
  if (rng.chance(0.35)) {
    const gold = Math.round(rng.int(EXP_GOLD[0], EXP_GOLD[1]) * (1 + EXP_GOLD_FAR * dist));
    e.bag.gold += gold;
    line(e, 'hallazgo', 'expediciones.diario.oro', { heroe: who.name, oro: gold }, who.id);
    return;
  }
  const kinds = HEADING_MATS[e.heading].filter((m) => m !== 'cristal' || dist >= EXP_CRYSTAL_FROM);
  const m = rng.pick(kinds);
  const n = 1 + rng.int(0, Math.floor(dist / EXP_MAT_FAR));
  e.bag.mats[m] = (e.bag.mats[m] ?? 0) + n;
  shine(matGlow(m));
  const got: Mats = { [m]: n };
  line(
    e,
    'hallazgo',
    'expediciones.diario.hallazgo',
    { heroe: who.name, que: matsMsg(got) },
    who.id,
  );
}

/** Una pelea por el camino contra lo que salga en ese rumbo. */
function fight(s: GameState, e: Expedition, rng: Rng, dist: number, news: DawnEvent[]): void {
  const foes = tl(`expediciones.enemigos.${e.heading}`);
  const foe = rng.int(0, foes.length - 1);
  // El grande del rumbo, a veces, se ve de lejos: se paran y esperan a que digas (B11).
  if (!e.turn && foe === foes.length - 1 && rng.chance(EXP_BOSS_SEEN)) {
    raise(s, e, 'jefe', news, undefined, foe);
    return;
  }
  battle(s, e, rng, dist, foe);
}

/** Los enemigos de un rumbo, como jefes del motor de peleas (su dibujo y sus golpes). */
const FOE_BOSS: Record<Heading, readonly BossKind[]> = {
  bosque: ['bestia', 'jabali', 'bestia', 'bestia'],
  sierra: ['bestia', 'bestia', 'bestia', 'jabali'],
  marismas: ['sierpe', 'ahogado', 'bestia', 'sierpe'],
  ruinas: ['ahogado', 'bestia', 'bestia', 'jabali'],
};
const GUARDIAN_BOSS: Record<Heading, BossKind> = {
  bosque: 'jabali',
  sierra: 'sierpe',
  marismas: 'reina',
  ruinas: 'dragona',
};

/** La pelea de una expedición, ya armada: los que están en pie (y el que se les unió). */
export function battleSetup(
  s: GameState,
  e: Expedition,
  dist: number,
  foe: number,
  mult = 1,
  guardian = false,
  roll = 0.5,
): CombatSetup {
  const up = standing(e, s);
  const party = [...up, ...(e.guest ? [e.guest] : [])];
  const units = equip(party, s.fac).map((h) => heroUnit(h));
  // Lo que pide la pelea, en la escala de los desafíos (suma del grupo); ver `EXP_FOE`.
  const n = Math.max(1, party.length);
  // Cada pelea, su enemigo: más o menos fuerte (`roll`, de 0 a 1), para que no esté decidida.
  const luck = 1 - EXP_FOE_SPREAD + 2 * EXP_FOE_SPREAD * roll;
  const diff = Math.max(1, n * (fightDiff(dist) * mult - EXP_GROUP * (n - 1))) * EXP_FOE * luck;
  const boss = (guardian ? GUARDIAN_BOSS[e.heading] : FOE_BOSS[e.heading][foe]) ?? 'bestia';
  const setup = setupCombat(
    `${e.seed}-pelea-${e.hours}-${foe}`,
    boss,
    units,
    foeUnits(boss, diff, 2),
  );
  // Cada uno entra con la vida que le queda (la que se guarda).
  for (const u of setup.units) {
    const h = party.find((x) => x.id === u.id);
    if (u.side === 'h' && h) u.hp = Math.max(1, Math.round(u.max * hpOf(h)));
  }
  return setup;
}

/**
 * Pelean (con el motor común: se ve en directo y luego en «Ver la pelea»). Los que caen en la
 * pelea se llevan una herida; con `EXP_HURT_DOWN`, en el suelo. Devuelve si ganaron.
 */
function battle(
  s: GameState,
  e: Expedition,
  rng: Rng,
  dist: number,
  foe: number,
  mult = 1,
  guardian = false,
): boolean {
  const up = standing(e, s);
  if (!up.length) return false;
  const enemigos = guardian
    ? msg(`expediciones.guardianes.${e.heading}`)
    : msg(`expediciones.enemigos.${e.heading}.${foe}`);
  const setup = battleSetup(s, e, dist, foe, mult, guardian, rng.next());
  const res = runCombat(setup);
  const roster = fightRoster([...up, ...(e.guest ? [e.guest] : [])]);
  for (const c of roster) if (res.downed.includes(c.id)) c.fate = 'herido';
  const record: BossFight = {
    boss: setup.boss,
    place: '',
    won: res.won,
    heroes: roster,
    sim: { setup, orders: [], auto: true },
    foe: msg('expediciones.pelea.nombre', { enemigos }),
    where: msg('expediciones.pelea.donde', { rumbo: e.heading, dias: Math.floor(dist) }),
    terrain: TERRAIN[e.heading],
  };
  // La vida: cada uno, la que le quede; quien cae, grave (si ya iba grave, al suelo); si
  // pierden, uno más se lleva otro golpe.
  const before = new Map(up.map((h) => [h.id, hpOf(h)]));
  const downed = up.filter((h) => res.downed.includes(h.id));
  for (const h of up) {
    const was = before.get(h.id)!;
    if (downed.includes(h))
      setLife(
        h,
        was < HP_GRAVE && rng.chance(EXP_GRAVE_FALL) ? 0 : rng.range(DOWNED_HP[0], DOWNED_HP[1]),
      );
    else if (res.hp?.[h.id] !== undefined) setLife(h, was - (was - res.hp[h.id]!) * EXP_FIGHT_WEAR);
  }
  if (!res.won && up.length) {
    const h = rng.pick(up);
    // (Un golpe más, sin tumbar: tumba solo caer en la pelea.)
    if (hpOf(h) > 0) setLife(h, Math.max(Math.min(hpOf(h), 0.02), hpOf(h) - EXP_LOSS_HP));
    if (!downed.includes(h)) downed.push(h);
  }
  // Quien acaba grave (o en el suelo) se bebe al momento una poción, si llevan (el peor primero).
  for (const h of [...up].sort((a, b) => hpOf(a) - hpOf(b))) {
    if (hpOf(h) >= EXP_POTION_AFTER || !(e.potions ?? 0)) continue;
    e.potions!--;
    setLife(h, Math.max(0, hpOf(h)) + EXP_POTION_HP);
    line(e, 'cura', 'expediciones.diario.pocion_pelea', { heroe: h.name, sexo: h.sex }, h.id);
  }
  for (const h of up) warnHurt(e, h);
  // El que se unió, si cae, se va.
  if (e.guest && res.downed.includes(e.guest.id)) {
    line(e, 'aviso', 'expediciones.diario.invitado_se_va', {
      heroe: e.guest.name,
      sexo: e.guest.sex,
    });
    delete e.guest;
  }
  const hero = downed[0] ?? rng.pick(up);
  const fell = downed.filter((h) => hpOf(h) <= 0);
  const grave = up.filter((h) => hpOf(h) > 0 && hpOf(h) < HP_GRAVE);
  if (res.won) {
    e.won++;
    const gold = rng.chance(0.4)
      ? Math.round(rng.int(EXP_GOLD[0], EXP_GOLD[1]) * (1 + EXP_GOLD_FAR * dist) * 0.6)
      : 0;
    e.bag.gold += gold;
    line(
      e,
      'pelea',
      guardian ? 'expediciones.diario.guardian_bien' : 'expediciones.diario.pelea_bien',
      {
        enemigos,
        heroe: hero.name,
        sexo: hero.sex,
        oro: gold,
        heridos: downed.map((h) => h.name),
        m: downed.length,
      },
      hero.id,
      true,
    );
  } else {
    e.lost++;
    line(
      e,
      'pelea',
      fell.length ? 'expediciones.diario.pelea_cae' : 'expediciones.diario.pelea_mal',
      { enemigos, heroe: (fell[0] ?? hero).name, sexo: (fell[0] ?? hero).sex },
      hero.id,
      false,
    );
  }
  const last = e.log.at(-1)!;
  last.foe = foe;
  last.fight = record;
  if (!fell.length) {
    if (grave.length && !e.turn) turnBack(e, 'herido', grave[0]);
    return res.won;
  }
  const left = standing(e, s);
  if (!left.length) {
    // Caen todos: se arrastran a casa con lo que pueden cargar; el resto queda como fardo.
    dropBundle(s, e, rng, dist);
    if (e.turn)
      line(e, 'aviso', 'expediciones.diario.vuelta.caidos', {
        heroe: fell[0]!.name,
        n: e.heroIds.length,
      });
    else turnBack(e, 'caidos', fell[0]);
  } else if (!e.turn) turnBack(e, 'herido', fell[0]);
  return res.won;
}

/** Lo que no pueden cargar queda tirado como fardo en el mapa (EX6). */
export function dropBundle(s: GameState, e: Expedition, rng: Rng, dist: number): void {
  const keep = (n: number) => Math.floor(n * EXP_WIPE_KEEP);
  const b: ExpBundle = {
    id: `f${s.uid++}`,
    heading: e.heading,
    dist,
    side: rng.next() * 2 - 1,
    day: s.day,
    who: e.heroIds.map((id) => s.heroes.find((h) => h.id === id)?.name ?? '').filter(Boolean),
    gold: e.bag.gold - keep(e.bag.gold),
    mats: {},
  };
  e.bag.gold = keep(e.bag.gold);
  for (const m of Object.keys(e.bag.mats) as Material[]) {
    const n = e.bag.mats[m] ?? 0;
    if (n - keep(n) > 0) b.mats[m] = n - keep(n);
    e.bag.mats[m] = keep(n);
  }
  const items = e.bag.items ?? [];
  const held = keep(items.length);
  if (items.length > held) {
    b.items = items.slice(held);
    e.bag.items = items.slice(0, held);
  }
  if (!b.gold && !Object.keys(b.mats).length && !b.items) return;
  const list = (s.expBundles ??= []);
  list.push(b);
  if (list.length > EXP_BUNDLES_MAX) list.splice(0, list.length - EXP_BUNDLES_MAX);
  (e.passed ??= []).push(b.id);
  line(e, 'aviso', 'expediciones.diario.fardo_queda');
}

/** Lo que hay en un fardo, para un hueco («34 monedas, 3 de madera y una espada»). */
export function bundleMsg(b: { gold: number; mats: Mats; items?: Item[] }): Msg {
  const parts: Txt[] = [];
  if (b.gold) parts.push(msg('expediciones.monedas', { n: b.gold }));
  for (const m of Object.keys(b.mats) as Material[]) parts.push(matsMsg({ [m]: b.mats[m] }));
  for (const it of b.items ?? []) parts.push(it.name);
  return msg('general.lista', { xs: parts });
}

/**
 * Lo que ya está en el mapa al pasar por su lejanía: un fardo perdido (lo recogen), un paraje que
 * quedó sin ver (vuelve a salir, para entrar esta vez) o uno ya visto (solo una línea).
 */
function mapStop(s: GameState, e: Expedition, dist: number, news: DawnEvent[]): boolean {
  const passed = (e.passed ??= []);
  const near = <T extends { id: string; heading: Heading; dist: number }>(xs: T[] | undefined) =>
    xs?.find((x) => x.heading === e.heading && x.dist <= dist && !passed.includes(x.id));
  const b = near(s.expBundles);
  if (b) {
    passed.push(b.id);
    s.expBundles = s.expBundles!.filter((x) => x.id !== b.id);
    e.bag.gold += b.gold;
    for (const m of Object.keys(b.mats) as Material[])
      e.bag.mats[m] = (e.bag.mats[m] ?? 0) + (b.mats[m] ?? 0);
    if (b.items?.length) (e.bag.items ??= []).push(...b.items);
    for (const it of b.items ?? []) shine(itemGlow(it.rarity));
    for (const m of Object.keys(b.mats) as Material[]) shine(matGlow(m));
    const stats = (s.stats ??= emptyStats());
    stats.expBundles = (stats.expBundles ?? 0) + 1;
    line(e, 'hallazgo', 'expediciones.diario.fardo', {
      quien: b.who,
      m: b.who.length,
      que: bundleMsg(b),
    });
    news.push({
      t: msg('expediciones.aviso.fardo', { rumbo: e.heading, quien: b.who, m: b.who.length }),
      k: 'good',
    });
    return true;
  }
  const site = near(s.expSites);
  if (!site) return false;
  passed.push(site.id);
  const what = msg(`expediciones.sucesos.${site.kind}.titulo`);
  if (site.done) {
    line(e, 'camino', 'expediciones.diario.paraje_visto', { que: what, dia: site.done });
    return false;
  }
  line(e, 'suceso', 'expediciones.diario.paraje_otra_vez', { que: what, dia: site.day });
  raise(s, e, site.kind, news, site.id);
  return true;
}

const TERRAIN: Record<Heading, Terrain> = {
  bosque: 'bosque',
  sierra: 'monte',
  marismas: 'pantano',
  ruinas: 'ruina',
};

// ---------- Sucesos con decisión ----------

/** La opción prudente de un suceso (la que eligen ellos si nadie dice nada). */
export const safeOption = (k: ExpEvent) =>
  (EXP_EVENTS_DEF[k].options.find((o) => o.safe) ?? EXP_EVENTS_DEF[k].options.at(-1)!).id;

/** Horas que faltan para acampar (el plazo de los sucesos que esperan «hasta la noche»). */
function toCamp(e: Expedition): number {
  const hod = Math.floor(((e.from + e.hours * HOUR) % DAY_SECONDS) / HOUR);
  return ((EXP_CAMP - hod + EXP_HOURS - 1) % EXP_HOURS) + 1;
}

/** Sale un suceso: espera a que elijas (avisa) o, silenciada, eligen ellos ya. */
function raise(
  s: GameState,
  e: Expedition,
  kind: ExpEvent,
  news: DawnEvent[],
  again?: string,
  foe?: number,
): void {
  const def = EXP_EVENTS_DEF[kind];
  let site = again;
  const enemigos = foe === undefined ? '' : msg(`expediciones.enemigos.${e.heading}.${foe}`);
  if (!site)
    line(e, 'suceso', `expediciones.sucesos.${kind}.texto`, { rumbo: e.heading, enemigos });
  if (def.site && !site) {
    // Un paraje nuevo: queda en el mapa para siempre.
    const rng = new Rng(`${e.seed}-paraje-${e.hours}`);
    site = `p${s.uid++}`;
    (s.expSites ??= []).push({
      id: site,
      kind,
      heading: e.heading,
      dist: distAt(e),
      side: rng.next() * 2 - 1,
      day: s.day,
    });
    (e.passed ??= []).push(site);
    const stats = (s.stats ??= emptyStats());
    stats.expSites = (stats.expSites ?? 0) + 1;
  }
  const boss = kind === 'guardian' || kind === 'jefe';
  const wait = boss ? EXP_GUARDIAN_WAIT : def.site ? EXP_HOURS : toCamp(e);
  e.pending = {
    kind,
    h: e.hours,
    until: e.hours + wait,
    ...(site ? { site } : {}),
    ...(foe !== undefined ? { foe } : {}),
  };
  if (e.mute) {
    decide(s, e, safeOption(kind), true);
    return;
  }
  news.push({
    t: msg(boss ? 'expediciones.aviso.guardian' : 'expediciones.aviso.suceso', {
      rumbo: e.heading,
      que: kind === 'jefe' ? enemigos : msg(`expediciones.sucesos.${kind}.titulo`),
    }),
    k: 'warn',
  });
}

/** Quién haría la opción: el de su clase o, si no, el mejor en su atributo (en pie). */
function doer(s: GameState, e: Expedition, o: ExpOption): Hero | undefined {
  const up = standing(e, s);
  const of = o.cls ? up.filter((h) => h.cls === o.cls) : up;
  if (!of.length) return undefined;
  return o.attr
    ? [...of].sort((a, b) => attr(b, o.attr!, true) - attr(a, o.attr!, true))[0]
    : of[0];
}

/** Lo que cuesta dejar una ofrenda o comprar una ración al mercader (de la mochila). */
export const offering = (dist: number) => Math.round(8 + 2 * dist);
export const RATION_PRICE = 4;

/** Por qué no se puede elegir esa opción ahora (o null). */
export function optionIssue(s: GameState, e: Expedition, id: string): string | null {
  const kind = e.pending?.kind;
  if (!kind) return t('expediciones.error.sin_suceso');
  const o = EXP_EVENTS_DEF[kind].options.find((x) => x.id === id);
  if (!o) return t('expediciones.error.sin_suceso');
  if (o.cls && !standing(e, s).some((h) => h.cls === o.cls))
    return t('expediciones.error.falta_clase', { clase: o.cls });
  if (kind === 'santuario' && id === 'ofrenda' && e.bag.gold < offering(distAt(e)))
    return t('expediciones.error.sin_oro', { n: offering(distAt(e)) });
  if (kind === 'mercader' && id === 'comprar' && e.bag.gold < RATION_PRICE)
    return t('expediciones.error.sin_oro', { n: RATION_PRICE });
  if (
    kind === 'mercader' &&
    id === 'vender' &&
    !Object.values(e.bag.mats).some((n) => (n ?? 0) > 0)
  )
    return t('expediciones.error.sin_materiales');
  return null;
}

/** Probabilidad de que la opción salga bien (1 si no hay nada que pueda salir mal). */
export function optionChance(s: GameState, e: Expedition, o: ExpOption): number {
  if (!o.attr) return 1;
  const who = doer(s, e, o);
  if (!who) return 0;
  const dist = distAt(e);
  let p = 0.6 - 0.05 * (dist + (o.hard ?? 0)) + 0.05 * (attr(who, o.attr, true) - 6);
  if (o.cls) p += 0.15;
  return Math.max(0.1, Math.min(0.95, p - 0.15 * (1 - hpOf(who))));
}

/**
 * La pista de riesgo de una opción, en palabras: 0 seguro … 3 muy arriesgado. Sin explorador ni
 * sala de mapas buena, menos fina (solo «seguro», «arriesgado» y «muy arriesgado»).
 */
export function optionRisk(
  s: GameState,
  e: Expedition,
  id: string,
): { level: 0 | 1 | 2 | 3; sharp: boolean } {
  const kind = e.pending?.kind ?? 'cofre';
  const o = EXP_EVENTS_DEF[kind].options.find((x) => x.id === id)!;
  const fights =
    ((kind === 'guardian' || kind === 'jefe') && (id === 'pelear' || id === 'solos')) ||
    (kind === 'oso' && id === 'plantar') ||
    (kind === 'ruinas' && id === 'forzar');
  const p = fights
    ? chance(
        partyPower(s, e),
        fightDiff(distAt(e)) *
          (kind === 'guardian' ? EXP_GUARDIAN_MULT : kind === 'jefe' ? EXP_BOSS_MULT : 1.2),
      )
    : optionChance(s, e, o);
  // Con niebla, polvo o tormenta, la pista se ve peor (como sin sala ni explorador).
  const sharp =
    !BLINDS.includes(expWeather(e)) &&
    ((mapRoom(s)?.level ?? 0) >= 2 || standing(e, s).some((h) => h.cls === 'explorador'));
  let level: 0 | 1 | 2 | 3 = p >= 0.85 ? 0 : p >= 0.65 ? 1 : p >= 0.45 ? 2 : 3;
  if (!sharp && level === 1) level = 2;
  return { level, sharp };
}

/** El jugador elige una opción del suceso que espera. */
export function chooseOption(s: GameState, id: string, option: string): boolean {
  const e = s.expeditions?.find((x) => x.id === id);
  if (!e?.pending || optionIssue(s, e, option)) return false;
  decide(s, e, option, false);
  return true;
}

/** Silenciar (o no) una expedición: sin avisos ni esperas. */
export function muteExpedition(s: GameState, id: string, on: boolean): boolean {
  const e = s.expeditions?.find((x) => x.id === id);
  if (!e || !!e.mute === on) return false;
  if (on) e.mute = true;
  else delete e.mute;
  // Al silenciar, lo que esperaba se decide ya, con prudencia.
  if (on && e.pending) decide(s, e, safeOption(e.pending.kind), true);
  return true;
}

/**
 * Darle una poción a un héroe cuando se quiera (usuario, 25 de noviembre): de las que lleva la
 * expedición (`expId`) o, en casa, de las de la alquimia. Solo si le falta vida y quedan.
 */
export function canDrink(s: GameState, heroId: string, expId?: string): boolean {
  const h = s.heroes.find((x) => x.id === heroId);
  if (!h || hpOf(h) >= 1 || h.status === 'muerto' || h.status === 'desaparecido') return false;
  if (!expId) return h.status !== 'mision' && (s.potions ?? 0) > 0;
  const e = s.expeditions?.find((x) => x.id === expId);
  return !!e && e.heroIds.includes(heroId) && (e.potions ?? 0) > 0;
}

export function drinkPotion(s: GameState, heroId: string, expId?: string): boolean {
  if (!canDrink(s, heroId, expId)) return false;
  const h = s.heroes.find((x) => x.id === heroId)!;
  if (expId) {
    const e = s.expeditions!.find((x) => x.id === expId)!;
    e.potions!--;
    setLife(h, hpOf(h) + EXP_POTION_HP);
    line(e, 'cura', 'expediciones.diario.pocion', { heroe: h.name, sexo: h.sex }, h.id);
  } else {
    s.potions = (s.potions ?? 0) - 1;
    setHp(h, hpOf(h) + EXP_POTION_HP);
  }
  return true;
}

/** Botín de un suceso: monedas y materiales del rumbo, por `mult`. Lo mete en la mochila. */
function loot(e: Expedition, rng: Rng, dist: number, mult: number): Msg {
  const gold = Math.round(rng.int(EXP_GOLD[0], EXP_GOLD[1]) * (1 + EXP_GOLD_FAR * dist) * mult);
  const kinds = HEADING_MATS[e.heading].filter((m) => m !== 'cristal' || dist >= EXP_CRYSTAL_FROM);
  const m = rng.pick(kinds);
  const n = Math.max(1, Math.round((1 + Math.floor(dist / EXP_MAT_FAR)) * mult));
  e.bag.gold += gold;
  e.bag.mats[m] = (e.bag.mats[m] ?? 0) + n;
  shine(matGlow(m));
  return msg('expediciones.botin', { oro: gold, que: matsMsg({ [m]: n }) });
}

/** Un objeto de equipo (más raro cuanto más lejos y si es de un guardián). */
function findItem(s: GameState, e: Expedition, rng: Rng, dist: number, guardian = false): Txt {
  const rarity = guardian
    ? rng.weighted<number>([
        [2, 3],
        [3, 2],
        [4, 1],
      ])
    : rng.weighted<number>([
        [1, 3],
        [2, 1 + dist * 0.3],
        [3, Math.max(0, dist - 3) * 0.2],
      ]);
  const pool = GEAR.filter((g) => g.rarity === rarity);
  const base = rng.pick(pool.length ? pool : GEAR);
  const item: Item = { id: `i${s.uid++}`, ...base };
  (e.bag.items ??= []).push(item);
  shine(itemGlow(item.rarity));
  return item.name;
}

/** Hacer una opción: lo que pasa y su línea en el diario. `auto`: eligieron ellos. */
function decide(s: GameState, e: Expedition, option: string, auto: boolean): void {
  if (!e.pending) return;
  const k = e.pending.kind;
  const h0 = e.pending.h;
  const siteId = e.pending.site;
  const foe = e.pending.foe ?? 0;
  delete e.pending;
  const rng = new Rng(`${e.seed}-elige-${h0}-${option}`);
  const def = EXP_EVENTS_DEF[k];
  const o = def.options.find((x) => x.id === option) ?? def.options.at(-1)!;
  const dist = distAt(e);
  const who = doer(s, e, o) ?? standing(e, s)[0];
  // Nadie en pie: el suceso se pierde, pero queda en el diario.
  if (!who) {
    line(e, 'suceso', 'expediciones.diario.nadie', {
      que: msg(`expediciones.sucesos.${k}.titulo`),
    });
    return;
  }
  const ok = rng.chance(optionChance(s, e, o));
  // Entrar en un paraje lo deja visto en el mapa; seguir de largo, para otra vez.
  const site = siteId ? s.expSites?.find((x) => x.id === siteId) : undefined;
  if (site && !o.safe) site.done = s.day;
  const p: Params = { heroe: who.name, sexo: who.sex };
  if (auto)
    line(e, 'eleccion', 'expediciones.diario.prudencia', {
      guardian: k === 'guardian' || k === 'jefe',
    });
  const say = (res: string, extra: Params = {}) =>
    line(
      e,
      'eleccion',
      `expediciones.sucesos.${k}.${o.id}.${res}`,
      { ...p, ...extra },
      who.id,
      res !== 'mal',
    );
  const hurt = (h: Hero) => wound(e, h, EXP_EVENT_HP);
  const key = `${k}.${o.id}`;
  switch (key) {
    case 'cofre.forzar':
    case 'cofre.ganzua':
    case 'torre.cerradura': {
      if (!ok) {
        if (key !== 'torre.cerradura') hurt(who);
        return say('mal');
      }
      const rich = key === 'cofre.forzar' ? 1.5 : 2;
      const item = dist >= 3 && rng.chance(0.3) ? findItem(s, e, rng, dist) : null;
      return say('bien', { que: loot(e, rng, dist, rich), objeto: item ?? '', con_objeto: !!item });
    }
    case 'santuario.rezar': {
      for (const h of party(s, e)) if (hpOf(h) < 1) setLife(h, hpOf(h) + EXP_POTION_HP / 2);
      for (const h of standing(e, s)) h.morale = Math.min(100, h.morale + 5);
      return say('bien');
    }
    case 'santuario.ofrenda': {
      const cost = offering(dist);
      e.bag.gold -= cost;
      const worst = worstOf(party(s, e));
      if (worst) setLife(worst, hpOf(worst) + EXP_POTION_HP);
      return say('bien', { oro: cost, curado: !!worst });
    }
    case 'mercader.comprar': {
      const n = Math.min(e.heroIds.length * 2, Math.floor(e.bag.gold / RATION_PRICE));
      e.bag.gold -= n * RATION_PRICE;
      e.rations += n;
      return say('bien', { m: n, oro: n * RATION_PRICE });
    }
    case 'mercader.vender': {
      let n = 0;
      for (const m of Object.keys(e.bag.mats) as Material[]) n += e.bag.mats[m] ?? 0;
      e.bag.mats = {};
      e.bag.gold += n * MAT_SELL * 2;
      return say('bien', { m: n, oro: n * MAT_SELL * 2 });
    }
    case 'viajero.unirse':
    case 'viajero.calar': {
      const honest = key === 'viajero.calar' ? rng.chance(0.6) : ok;
      if (!honest) {
        if (key === 'viajero.calar') return say('mal');
        const stolen = Math.floor(e.bag.gold / 2);
        e.bag.gold -= stolen;
        return say('mal', { oro: stolen });
      }
      const g = generateHero(rng, `h${s.uid++}`, {
        rank: 1,
        tab: 1,
        usedNames: s.heroes.map((h) => h.name),
      });
      e.guest = g;
      return say('bien', { otro: g.name, otro_sexo: g.sex });
    }
    case 'campamento.registrar': {
      if (!ok) {
        say('mal');
        battle(s, e, rng, dist, 0, 0.9);
        return;
      }
      const n = rng.int(1, e.heroIds.length);
      e.rations += n;
      return say('bien', { m: n, que: loot(e, rng, dist, 0.7) });
    }
    case 'campamento.rastrear': {
      const n = rng.int(1, e.heroIds.length) + 1;
      e.rations += n;
      return say('bien', { m: n });
    }
    case 'oso.plantar': {
      say('bien');
      if (battle(s, e, rng, dist, 2, 1.2)) {
        e.bag.mats.cuero = (e.bag.mats.cuero ?? 0) + 2;
        line(e, 'hallazgo', 'expediciones.diario.piel', { heroe: who.name });
      }
      return;
    }
    case 'oso.rodear': {
      if (ok) return say('bien');
      say('mal');
      battle(s, e, rng, dist, 2, 1.2);
      return;
    }
    case 'oso.retroceder':
      e.idle = (e.idle ?? 0) + 3;
      return say('bien');
    case 'cueva.entrar': {
      if (ok) {
        const item = dist >= 3 && rng.chance(0.3) ? findItem(s, e, rng, dist) : null;
        return say('bien', { que: loot(e, rng, dist, 2), objeto: item ?? '', con_objeto: !!item });
      }
      say('mal');
      if (battle(s, e, rng, dist, 0, 1.1))
        line(e, 'hallazgo', 'expediciones.diario.tras_pelea', { que: loot(e, rng, dist, 1) });
      return;
    }
    case 'cueva.cuidado':
      return ok ? say('bien', { que: loot(e, rng, dist, 1.5) }) : say('mal');
    case 'torre.subir':
      if (!ok) {
        hurt(who);
        return say('mal');
      }
      return say('bien', { que: loot(e, rng, dist, 1) });
    case 'ruinas.runas': {
      if (!ok) {
        hurt(who);
        return say('mal');
      }
      e.bag.mats.cristal = (e.bag.mats.cristal ?? 0) + 2;
      const item = rng.chance(0.5) ? findItem(s, e, rng, dist) : null;
      return say('bien', { objeto: item ?? '', con_objeto: !!item });
    }
    case 'ruinas.forzar': {
      say('bien');
      if (battle(s, e, rng, dist, 0, 1.3)) {
        e.bag.mats.cristal = (e.bag.mats.cristal ?? 0) + 2;
        line(e, 'hallazgo', 'expediciones.diario.tras_pelea', { que: loot(e, rng, dist, 2) });
      }
      return;
    }
    case 'jefe.pelear':
    case 'jefe.solos': {
      const enemigos = msg(`expediciones.enemigos.${e.heading}.${foe}`);
      say('bien', { enemigos });
      if (battle(s, e, rng, dist, foe, EXP_BOSS_MULT))
        line(e, 'hallazgo', 'expediciones.diario.tras_pelea', { que: loot(e, rng, dist, 2) });
      return;
    }
    case 'jefe.escapar':
    case 'guardian.escapar': {
      const enemigos =
        k === 'jefe'
          ? msg(`expediciones.enemigos.${e.heading}.${foe}`)
          : msg(`expediciones.guardianes.${e.heading}`);
      if (ok) say('bien', { enemigos });
      else {
        // Les ve: uno se lleva un buen golpe al huir (si ya iba grave, puede caer).
        const hit = rng.pick(standing(e, s));
        say('mal', { enemigos, herido: hit.name, sexo_herido: hit.sex });
        wound(e, hit, EXP_ESCAPE_HP);
      }
      if (k === 'guardian' && !e.turn) turnBack(e, 'guardian');
      return;
    }
    case 'guardian.solos':
    case 'guardian.pelear': {
      say('bien');
      if (battle(s, e, rng, dist, 0, EXP_GUARDIAN_MULT, true)) {
        const item = findItem(s, e, rng, dist, true);
        e.bag.mats.cristal = (e.bag.mats.cristal ?? 0) + 2;
        line(e, 'hallazgo', 'expediciones.diario.guardian_botin', {
          que: loot(e, rng, dist, 3),
          objeto: item,
        });
      }
      return;
    }
    default:
      return say('bien');
  }
}

/** La noche: cenan (una ración cada uno), el clérigo cura y se echan cuentas para seguir. */
function camp(s: GameState, e: Expedition, rng: Rng): void {
  const party = e.heroIds.map((id) => s.heroes.find((h) => h.id === id)).filter((h) => !!h);
  const n = party.length;
  const ate = Math.min(n, e.rations);
  e.rations -= ate;
  const hungry = party.slice(ate);
  // Con nieve, se gasta más para calentarse (si queda).
  if (!hungry.length && expWeather(e) === 'nieve') {
    const extra = Math.min(e.rations, Math.ceil(n * EXP_SNOW_EAT));
    if (extra) {
      e.rations -= extra;
      line(e, 'raciones', 'expediciones.diario.nieve', { m: extra });
    }
  }
  for (const h of hungry) h.morale = Math.max(0, h.morale - EXP_HUNGER);
  // Descansar cura un poco a los que están en pie (los que cenan).
  for (const h of party)
    if (hpOf(h) > 0 && !hungry.includes(h)) setLife(h, hpOf(h) + EXP_CAMP_HEAL);
  // El clérigo (en pie) cura a veces al que está peor.
  const cleric = standing(e, s).find((h) => h.cls === 'clerigo');
  const worst = worstOf(party);
  if (cleric && worst && rng.chance(EXP_CLERIC_HEAL)) {
    setLife(worst, hpOf(worst) + EXP_CLERIC_HP);
    line(
      e,
      'cura',
      'expediciones.diario.cura',
      { curandero: cleric.name, heroe: worst.name, mismo: cleric === worst },
      cleric.id,
    );
  }
  // Una poción, al que sigue peor (si queda alguna).
  // Una poción, al que sigue peor, si va herido (por debajo del 50 %).
  const hurtNow = worstOf(party);
  if (hurtNow && hpOf(hurtNow) < HP_LIGHT && (e.potions ?? 0) > 0) {
    e.potions!--;
    setLife(hurtNow, hpOf(hurtNow) + EXP_POTION_HP);
    line(
      e,
      'cura',
      'expediciones.diario.pocion',
      { heroe: hurtNow.name, sexo: hurtNow.sex },
      hurtNow.id,
    );
  }
  if (hungry.length)
    line(e, 'noche', 'expediciones.diario.hambre', {
      quien: hungry.map((h) => h.name),
      n: hungry.length,
    });
  else
    line(e, 'noche', `expediciones.diario.noche.${e.heading}`, {
      raciones: e.rations,
      vuelta: !!e.turn,
    });
  if (e.turn) return;
  // ¿Seguir un día más? Solo si quedan raciones para él y para la vuelta, que será más larga.
  const back = Math.ceil((distAt(e) + 1) / 2);
  if (hungry.length) turnBack(e, 'hambre');
  else if (e.rations < n * (1 + back)) turnBack(e, 'raciones');
}

// ---------- La llegada ----------

/** Vuelven: lo de la mochila a casa, cada uno a su estado y el informe. Devuelve los que vuelven. */
function arrive(s: GameState, e: Expedition, news: DawnEvent[]): string[] {
  s.expeditions = s.expeditions!.filter((x) => x.id !== e.id);
  line(e, 'llegada', 'expediciones.diario.llegada');
  const rng = new Rng(`${e.seed}-casa`);
  const party = e.heroIds.map((id) => s.heroes.find((h) => h.id === id)).filter((h) => !!h);
  const names = party.map((h) => h.name);
  const body: Txt[] = [];
  const chips: { t: Txt; k: ChipKind }[] = [];
  const chip = (key: string, p: Params, k: ChipKind) =>
    chips.push({ t: msg(`expediciones.informe.${key}`, p), k });
  const far = e.turn?.dist ?? distAt(e);
  const days = Math.max(1, Math.round(e.hours / EXP_HOURS));
  const stats = (s.stats ??= emptyStats());
  stats.expeditions = (stats.expeditions ?? 0) + 1;
  body.push(
    msg('expediciones.informe.cuerpo', {
      dias: days,
      lejos: Math.round(far),
      n: party.length,
    }),
  );
  body.push(
    e.won + e.lost
      ? msg('expediciones.informe.peleas', { ganadas: e.won, perdidas: e.lost })
      : msg('expediciones.informe.sin_peleas', { n: party.length }),
  );
  // Por qué volvieron: la línea del diario.
  const why = [...e.log].reverse().find((l) => l.k === 'vuelta');
  if (why) body.push(why.t);
  // Récord del rumbo.
  const wasOpen = HEADINGS.filter((h) => headingOpen(s, h));
  const best = (s.expBest ??= {});
  let record = false;
  if (far > (best[e.heading] ?? 0) + 1e-9) {
    const had = best[e.heading] !== undefined;
    best[e.heading] = far;
    record = had;
    if (had) chip('chip_record', { dias: Math.round(far) }, 'good');
  }
  // Un rumbo nuevo: se abre al volver con el récord que pedía.
  for (const h of HEADINGS)
    if (!wasOpen.includes(h) && headingOpen(s, h)) {
      chip('chip_abierto', { rumbo: h }, 'good');
      news.push({ t: msg('expediciones.aviso.abierto', { rumbo: h }), k: 'good', big: true });
    }
  // Lo que trajeron, tal cual (para «La mochila»: lo que no cupo se dice en los chips).
  const bag = { ...structuredClone(e.bag), ...(e.potions ? { potions: e.potions } : {}) };
  // La mochila.
  if (e.bag.gold) {
    s.gold += e.bag.gold;
    stats.goldEarned += e.bag.gold;
    chip('chip_oro', { n: e.bag.gold }, 'good');
  }
  const got = gainMats(s, e.bag.mats);
  if (Object.keys(got.kept).length) chip('chip_materiales', { que: matsMsg(got.kept) }, 'info');
  if (got.warn) chips.push({ t: got.warn, k: 'warn' });
  for (const it of e.bag.items ?? []) {
    s.inventory.push(it);
    chip('chip_objeto', { objeto: it.name }, 'good');
  }
  // El que se les unió pide entrar: espera en la barra, como los demás candidatos.
  if (e.guest) {
    // Como al amanecer: con la barra llena, se va el que lleva más tiempo esperando.
    if (s.candidates.length >= MAX_CANDIDATES) {
      const left = s.candidates.shift()!;
      news.push({ t: msg('partida.noche.se_cansa', { heroe: left.name }) });
    }
    s.candidates.push({ ...e.guest, status: 'ok' });
    chip('chip_invitado', { heroe: e.guest.name }, 'info');
  }
  if (e.potions) {
    s.potions = (s.potions ?? 0) + e.potions;
    chip('chip_pociones', { n: e.potions }, 'info');
  }
  if (e.rations > 0) {
    s.food += e.rations;
    chip('chip_raciones', { n: e.rations }, 'info');
  }
  // Cada uno a lo suyo.
  const xp = Math.round(EXP_XP_DAY * (e.hours / EXP_HOURS) * (1 + EXP_XP_FAR * far));
  const cleric = party.find((h) => h.cls === 'clerigo' && hpOf(h) > 0);
  const fallen: Hero[] = [];
  const back: string[] = [];
  let worst: Outcome = e.turn?.why === 'caidos' ? 'Fracaso' : 'Éxito';
  for (const h of party) {
    const life = hpOf(h);
    h.days = 0;
    if (
      life <= 0 &&
      !(cleric && cleric !== h && rng.chance(CLERIC_SAVE)) &&
      rng.chance(EXP_DOWN_DEATH)
    ) {
      h.status = 'muerto';
      fallen.push(h);
      stats.lastDeath = s.day;
      for (const it of gearList(h)) chip('chip_perdido', { objeto: it.name }, 'bad');
      delete h.worn;
      s.fallen.unshift({
        id: h.id,
        name: h.nick ? msg('general.apodado', { nombre: h.name, apodo: h.nick }) : h.name,
        epitaph: msg('expediciones.informe.epitafio', { rumbo: e.heading, dia: s.day }),
      });
      chip('chip_caido', { heroe: h.name, sexo: h.sex }, 'bad');
      worst = 'Desastre';
      continue;
    }
    // Llegan con la vida que traen (en pie o a la cama); quien cayó (y no murió), grave.
    h.status = 'ok';
    h.days = 0;
    setHp(h, life <= 0 ? DOWNED_HP[1] : life);
    const hurt = healthOf(h) !== 'sano';
    if (hurt) {
      chips.push({ t: woundChip(h), k: 'bad' });
      if (worst === 'Éxito') worst = 'Éxito parcial';
    }
    h.xp += xp;
    chips.push(...levelUp(s, h));
    const full = e.bag.gold > 0 || Object.keys(e.bag.mats).length > 0;
    if (full && !hurt) h.morale = Math.min(100, h.morale + EXP_HOME_MORALE);
    if (fallen.length) h.morale = Math.max(0, h.morale - 10);
    h.history.push(
      msg('expediciones.informe.historial', { dia: s.day, rumbo: e.heading, dias: days }),
    );
    back.push(h.id);
  }
  chips.push({ t: msg('expediciones.informe.chip_xp', { n: xp }), k: 'info' });
  const r: Report = {
    id: `r${s.uid++}`,
    day: s.day,
    title: msg('expediciones.informe.titulo', { rumbo: e.heading }),
    heroIds: party.map((h) => h.id),
    who: msg('general.lista', { xs: names }),
    outcome: worst,
    body,
    chips,
    read: false,
    exp: { log: e.log, heading: e.heading, days, far, record, bag },
  };
  s.reports.unshift(r);
  news.push({
    t: msg('expediciones.aviso.vuelve', { rumbo: e.heading, grupo: names }),
    k: fallen.length || worst === 'Fracaso' ? 'bad' : 'good',
  });
  return back;
}
