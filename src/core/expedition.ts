/**
 * Expediciones (fase 8; decidido con el usuario, bloque 8 de `docs/decisiones.md`): de 1 a 4
 * héroes salen hacia un rumbo con las raciones que elija el jugador. Sin destino: cada día más
 * lejos, con más peligro y mejor botín, poco a poco. Vuelven solos cuando solo quedan las raciones
 * de la vuelta (o si alguien cae), o cuando el jugador quiera; la vuelta tarda la mitad.
 *
 * Corren por horas de juego: cada hora tira con su propia semilla, así que pasa lo mismo con el
 * juego abierto que cerrado (`away.ts` pasa por `endDay`, que las pone al día).
 */
import {
  CLERIC_SAVE,
  DAY_SECONDS,
  EXPEDITION_LEVEL,
  EXP_CAMP,
  EXP_CLERIC_HEAL,
  EXP_CRYSTAL_FROM,
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
  EXP_HURT_DAYS,
  EXP_HURT_DOWN,
  EXP_MAT_FAR,
  EXP_STEP,
  EXP_WIPE_KEEP,
  EXP_XP_DAY,
  EXP_XP_FAR,
} from './balance';
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
} from './model';
import { chance, skill } from './party';
import { equip, levelUp } from './resolve';
import { Rng } from './rng';
import type { FoeKind } from '../data/journey';
import { gearList } from './gear';
import { emptyStats } from './feats';
import { msg, t, tl, type Msg, type Params, type Txt } from '../textos';

export const HEADINGS: readonly Heading[] = ['bosque', 'sierra', 'marismas', 'ruinas'];
/** Los rumbos que ya se pueden tomar (los demás, «En obras»). */
export const OPEN_HEADINGS: readonly Heading[] = ['bosque'];

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
};

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
): string | null {
  if (!expeditionsOpen(s)) return t('expediciones.error.cerradas', { nivel: EXPEDITION_LEVEL });
  if (!OPEN_HEADINGS.includes(heading)) return t('expediciones.error.en_obras');
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
  return null;
}

/** Lejanía (días de ida) en la hora `h` de la expedición; de vuelta, baja el doble de deprisa. */
export function distAt(e: Expedition, h = e.hours): number {
  if (!e.turn || h <= e.turn.h) return h / EXP_HOURS;
  return Math.max(0, e.turn.dist - (2 * (h - e.turn.h)) / EXP_HOURS);
}

/** Horas que les quedan para llegar a casa (de ida, contando con dar la vuelta ya). */
export function hoursHome(e: Expedition): number {
  return Math.ceil((distAt(e) * EXP_HOURS) / 2);
}

/** Los que siguen en pie. */
const standing = (e: Expedition, s: GameState) =>
  e.heroIds
    .map((id) => s.heroes.find((h) => h.id === id))
    .filter((h): h is Hero => !!h && (e.hurt[h.id] ?? 0) < EXP_HURT_DOWN);

/** La dificultad de una pelea a esa lejanía. */
export const fightDiff = (dist: number) => EXP_FIGHT + EXP_FIGHT_FAR * dist;

/** La fuerza del grupo en una pelea: la media de Combate (menos las heridas), más los de más. */
export function partyPower(s: GameState, e: Expedition): number {
  const up = standing(e, s);
  if (!up.length) return 0;
  const sum = equip(up, s.fac).reduce(
    (a, h) => a + Math.max(0, skill(h, 'Combate', true) - (e.hurt[h.id] ?? 0)),
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
    hurt: {},
    bag: { gold: 0, mats: {} },
    log: [],
    warned: 0,
    won: 0,
    lost: 0,
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
  e.turn = { h: e.hours, dist: distAt(e), why };
  line(e, 'vuelta', `expediciones.diario.vuelta.${why}`, {
    heroe: hero?.name ?? '',
    sexo: hero?.sex ?? 'm',
    raciones: e.rations,
    n: e.heroIds.length,
  });
}

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
  });
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
    const until = Math.floor((at - e.from) / HOUR);
    while (e.hours < until) {
      e.hours++;
      stepHour(s, e);
      if (e.turn && distAt(e) <= 0) {
        home.push(...arrive(s, e, news));
        break;
      }
    }
  }
  return { news, home };
}

/** Lo que pasa en una hora: la noche (cena y cuentas) o, a veces, un suceso. */
function stepHour(s: GameState, e: Expedition): void {
  const rng = new Rng(`${e.seed}-${e.hours}`);
  const hod = Math.floor(((e.from + e.hours * HOUR) % DAY_SECONDS) / HOUR);
  const dist = distAt(e);
  if (hod === EXP_CAMP) {
    camp(s, e, rng);
    return;
  }
  // Escalones de peligro: un aviso al adentrarse (de ida).
  if (!e.turn && Math.floor(dist / EXP_STEP) > e.warned) {
    e.warned = Math.floor(dist / EXP_STEP);
    line(e, 'aviso', 'expediciones.diario.aviso', { rumbo: e.heading, dias: Math.floor(dist) });
  }
  const rate = (EXP_EVENTS + EXP_EVENTS_FAR * dist) * (e.turn ? 0.5 : 1);
  if (!rng.chance(rate / (EXP_HOURS - 1))) return;
  const up = standing(e, s);
  if (!up.length) return;
  const who = rng.pick(up);
  const roll = rng.next();
  const fightP = 0.3 + Math.min(0.2, 0.03 * dist);
  if (roll < fightP) fight(s, e, rng, dist);
  else if (roll < fightP + 0.4) find(e, rng, dist, who);
  else if (roll < fightP + 0.48) {
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
  const got: Mats = { [m]: n };
  line(
    e,
    'hallazgo',
    'expediciones.diario.hallazgo',
    { heroe: who.name, que: matsMsg(got) },
    who.id,
  );
}

/** Una pelea: la fuerza del grupo contra el peligro de la lejanía. Perder hiere a uno. */
function fight(s: GameState, e: Expedition, rng: Rng, dist: number): void {
  const foes = tl(`expediciones.enemigos.${e.heading}`);
  const fi = rng.int(0, foes.length - 1);
  const enemigos = msg(`expediciones.enemigos.${e.heading}.${fi}`);
  const p = chance(partyPower(s, e), fightDiff(dist));
  const up = standing(e, s);
  const hero = rng.pick(up);
  if (rng.chance(p)) {
    e.won++;
    const gold = rng.chance(0.4)
      ? Math.round(rng.int(EXP_GOLD[0], EXP_GOLD[1]) * (1 + EXP_GOLD_FAR * dist) * 0.6)
      : 0;
    e.bag.gold += gold;
    line(
      e,
      'pelea',
      'expediciones.diario.pelea_bien',
      { enemigos, heroe: hero.name, sexo: hero.sex, oro: gold },
      hero.id,
      true,
    );
    e.log.at(-1)!.foe = fi;
    return;
  }
  e.lost++;
  // Pierden: se lleva la herida uno de los que están en pie (a veces, dos de golpe).
  const n = rng.chance(0.25) ? 2 : 1;
  e.hurt[hero.id] = Math.min(EXP_HURT_DOWN, (e.hurt[hero.id] ?? 0) + n);
  const down = e.hurt[hero.id]! >= EXP_HURT_DOWN;
  line(
    e,
    'pelea',
    down ? 'expediciones.diario.pelea_cae' : 'expediciones.diario.pelea_mal',
    { enemigos, heroe: hero.name, sexo: hero.sex },
    hero.id,
    false,
  );
  e.log.at(-1)!.foe = fi;
  if (!down) return;
  const left = standing(e, s);
  if (!left.length) {
    // Caen todos: se arrastran a casa con lo que pueden cargar.
    e.bag.gold = Math.floor(e.bag.gold * EXP_WIPE_KEEP);
    for (const m of Object.keys(e.bag.mats) as Material[])
      e.bag.mats[m] = Math.floor((e.bag.mats[m] ?? 0) * EXP_WIPE_KEEP);
    if (e.turn)
      line(e, 'aviso', 'expediciones.diario.vuelta.caidos', {
        heroe: hero.name,
        n: e.heroIds.length,
      });
    else turnBack(e, 'caidos', hero);
  } else if (!e.turn) turnBack(e, 'herido', hero);
}

/** La noche: cenan (una ración cada uno), el clérigo cura y se echan cuentas para seguir. */
function camp(s: GameState, e: Expedition, rng: Rng): void {
  const party = e.heroIds.map((id) => s.heroes.find((h) => h.id === id)).filter((h) => !!h);
  const n = party.length;
  const ate = Math.min(n, e.rations);
  e.rations -= ate;
  const hungry = party.slice(ate);
  for (const h of hungry) h.morale = Math.max(0, h.morale - EXP_HUNGER);
  // El clérigo (en pie) cura a veces una herida, la del que está peor.
  const cleric = standing(e, s).find((h) => h.cls === 'clerigo');
  const worst = party
    .filter((h) => (e.hurt[h.id] ?? 0) > 0)
    .sort((a, b) => (e.hurt[b.id] ?? 0) - (e.hurt[a.id] ?? 0))[0];
  if (cleric && worst && rng.chance(EXP_CLERIC_HEAL)) {
    e.hurt[worst.id]!--;
    if (!e.hurt[worst.id]) delete e.hurt[worst.id];
    line(
      e,
      'cura',
      'expediciones.diario.cura',
      { curandero: cleric.name, heroe: worst.name, mismo: cleric === worst },
      cleric.id,
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
  const best = (s.expBest ??= {});
  if (far > (best[e.heading] ?? 0) + 1e-9) {
    const had = best[e.heading] !== undefined;
    best[e.heading] = far;
    if (had) chip('chip_record', { dias: Math.round(far) }, 'good');
  }
  // La mochila.
  if (e.bag.gold) {
    s.gold += e.bag.gold;
    stats.goldEarned += e.bag.gold;
    chip('chip_oro', { n: e.bag.gold }, 'good');
  }
  const got = gainMats(s, e.bag.mats);
  if (Object.keys(got.kept).length) chip('chip_materiales', { que: matsMsg(got.kept) }, 'info');
  if (got.warn) chips.push({ t: got.warn, k: 'warn' });
  if (e.rations > 0) {
    s.food += e.rations;
    chip('chip_raciones', { n: e.rations }, 'info');
  }
  // Cada uno a lo suyo.
  const xp = Math.round(EXP_XP_DAY * (e.hours / EXP_HOURS) * (1 + EXP_XP_FAR * far));
  const cleric = party.find((h) => h.cls === 'clerigo' && (e.hurt[h.id] ?? 0) < EXP_HURT_DOWN);
  const fallen: Hero[] = [];
  const back: string[] = [];
  let worst: Outcome = e.turn?.why === 'caidos' ? 'Fracaso' : 'Éxito';
  for (const h of party) {
    const hurt = e.hurt[h.id] ?? 0;
    h.days = 0;
    if (
      hurt >= EXP_HURT_DOWN &&
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
    h.status = hurt ? 'herido' : 'ok';
    h.days = hurt * EXP_HURT_DAYS;
    if (hurt) {
      chip('chip_herido', { heroe: h.name, sexo: h.sex, dias: h.days }, 'bad');
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
  };
  s.reports.unshift(r);
  news.push({
    t: msg('expediciones.aviso.vuelve', { rumbo: e.heading, grupo: names }),
    k: fallen.length || worst === 'Fracaso' ? 'bad' : 'good',
  });
  return back;
}
