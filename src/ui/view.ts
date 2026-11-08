import { craftState, dressingOf } from '../core/crafting';
import { paintState, painterAt } from '../core/paint';
import { RECIPES } from '../data/recipes';
import { generateLook, type HeroLook, type HeroMarks, type OutfitId } from '../art/heroes/look';
import type { Facilities, GameState, Hero, Worker } from '../core/model';
import { customOf, gearInStock } from '../core/game';
import { onWay, staffBeds, workerTitle } from '../core/workers';
import { visitorsOf } from '../core/salon';
import { trainState } from '../core/training';
import { goldCap } from '../core/vault';
import { CREST_COLORS } from '../data/custom';
import { CLASS_NAMES } from '../data/labels';
import { gearOf } from '../core/resolve';
import type { Member } from '../core/party';
import type { SceneHero, SceneModel } from '../world/scene';
import { taskLabel } from './crew';
import { gearList, shownGear, type Gear } from '../core/gear';

/** Puentes entre el modelo del juego y el arte o la escena. */

const looks = new Map<string, HeroLook>();
export function lookOf(h: Hero): HeroLook {
  let l = looks.get(h.seed);
  if (!l) {
    l = generateLook(h.seed, h.cls, h.sex);
    looks.set(h.seed, l);
  }
  // Lo de la sastrería, encima (sin guardarlo en la caché: cambia).
  return h.dress?.dye || h.dress?.garment ? { ...l, ...h.dress } : l;
}

/** El traje de cada oficio de taller (los demás, de taberna). */
const TRADE_LOOK: Partial<Record<Worker['trade'], OutfitId>> = {
  forja: 'herrero',
  sastreria: 'sastre',
  alquimia: 'alquimista',
  pintor: 'pintor',
};

/**
 * Los trabajadores visten de taberna (el mozo, sin gorro; el bardo, con gorra); los del taller,
 * de su oficio (el herrero, con su mandil de cuero).
 */
export function workerLook(w: Worker): HeroLook {
  let l = looks.get(`${w.seed}:${w.trade}`);
  if (!l) {
    l = generateLook(w.seed, TRADE_LOOK[w.trade] ?? 'tabernero', w.sex);
    if (w.village === 'bardo') l = { ...l, headgear: 'gorra' };
    if (w.village === 'mozo') l = { ...l, headgear: null };
    looks.set(`${w.seed}:${w.trade}`, l);
  }
  return l;
}

/** Marco del retrato de un héroe: dorado, con el color de su clase. */
export const heroFrame = (h: Pick<Hero, 'cls'>) => `pf-hero pf-${h.cls}`;
/** Marco del retrato de un trabajador: de madera, con el color de su oficio (o del bardo). */
export const workerFrame = (w: Pick<Worker, 'trade' | 'village'>) =>
  `pf-worker pf-${w.village === 'bardo' ? 'bardo' : w.trade}`;

export const marksOf = (h: Hero): HeroMarks => ({
  injured: h.status === 'herido',
  eyepatch: h.traits.some((t) => t.id === 'tuerto'),
  scar: h.traits.some((t) => t.id === 'cortado'),
  gear: shownGear(h),
});

export const memberOf = (
  h: Pick<Hero, 'cls' | 'lvl' | 'attrs' | 'traits' | 'morale' | 'worn'>,
  fac?: Facilities,
): Member & { worn?: Gear } => ({
  cls: h.cls,
  lvl: h.lvl,
  attrs: h.attrs,
  traits: h.traits,
  morale: h.morale,
  worn: h.worn,
  gear: gearOf(h.worn, fac),
  perks: gearList(h).flatMap((i) => (i.perk ? [i.perk] : [])),
});

/** Los visitantes de hoy en el orden en que llegan (mezclados, siempre igual para el mismo día). */
function visitorOrder(s: GameState): string[] {
  const v = visitorsOf(s, s.day);
  const list = (Object.keys(v.kinds) as (keyof typeof v.kinds)[]).flatMap((k) =>
    Array.from({ length: v.kinds[k] }, () => k as string),
  );
  // Barajado con la semilla del día: el noble no llega siempre el último.
  let h = s.day * 2654435761;
  for (let i = list.length - 1; i > 0; i--) {
    h = (Math.imul(h ^ (h >>> 15), 2246822519) + i) >>> 0;
    const j = h % (i + 1);
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

const fullName = (h: Hero) => (h.nick ? `${h.name} ${h.nick}` : h.name);

/** Lo que se lee de alguien al pasar el ratón: clase y nivel, y su tarea o si está en cama. */
function heroTitle(s: GameState, h: Hero, candidate = false): string {
  const a = (m: string, f: string) => (h.sex === 'f' ? f : m);
  const base = `${CLASS_NAMES[h.cls][h.sex]} · nivel ${h.lvl}`;
  if (candidate) return `${base} · busca trabajo`;
  if (h.status === 'herido')
    return `${base} · ${a('herido', 'herida')}, ${h.days} ${h.days === 1 ? 'día' : 'días'} en cama`;
  return `${base} · ${taskLabel(s, h.id).toLowerCase()}${onWay(s, h) ? ' (de camino)' : ''}`;
}

/** De un trabajador: su maña y su tarea, con las mismas palabras que Héroes › Tareas. */
function workerHover(s: GameState, w: Worker): string {
  return `Maña ${w.skill} · ${taskLabel(s, w.id).toLowerCase()}${onWay(s, w) ? ' (de camino)' : ''}`;
}

/** La barra de entrenamiento de un héroe (si entrena); al tope, llena y marcada. */
function trainBar(s: GameState, h: Hero): SceneHero['train'] {
  const t = trainState(s, h);
  if (!t) return undefined;
  return t.capped ? { at: 1, perDay: 0, max: true } : { at: t.frac, perDay: t.perDay };
}

export function sceneModel(s: GameState): SceneModel {
  const heroes: SceneHero[] = [];
  // Quien va a arreglar un incidente corre a esa sala.
  const goTo = (id: string) => s.incidents?.find((i) => i.coming?.who === id)?.room;
  for (const h of s.heroes) {
    if (h.status === 'muerto' || h.status === 'desaparecido') continue;
    heroes.push({
      id: h.id,
      name: fullName(h),
      title: heroTitle(s, h),
      status: h.status,
      look: lookOf(h),
      marks: marksOf(h),
      guard: !!h.guard,
      // Mientras lo visten, está en la sastrería.
      work: dressingOf(s, h.id)?.room ?? h.job,
      goTo: goTo(h.id),
      train: trainBar(s, h),
    });
  }
  // Los trabajadores: los que tienen cama en el servicio duermen en casa; los demás, en el pueblo.
  let beds = staffBeds(s.building);
  for (const w of s.workers)
    heroes.push({
      id: w.id,
      name: workerTitle(w),
      title: workerHover(s, w),
      status: 'ok',
      look: workerLook(w),
      marks: {},
      // El pintor que está pintando una sala, en ella (y no en su taller).
      work: painterAt(s, w.id) ?? w.room,
      goTo: goTo(w.id),
      staff: beds-- > 0 ? 'casa' : 'pueblo',
    });
  for (const h of s.candidates)
    heroes.push({
      id: h.id,
      name: fullName(h),
      title: heroTitle(s, h, true),
      status: 'candidato',
      look: lookOf(h),
      marks: marksOf(h),
    });
  // Los trabajadores que buscan casa también esperan en la barra: al contratarlos, van andando.
  for (const w of s.seekers)
    heroes.push({
      id: w.id,
      name: workerTitle(w),
      title: `Maña ${w.skill} · busca trabajo`,
      status: 'candidato',
      look: workerLook(w),
      marks: {},
    });
  return {
    building: s.building,
    crest: {
      field: CREST_COLORS[customOf(s).color].field,
      dark: CREST_COLORS[customOf(s).color].dark,
      symbol: customOf(s).symbol,
    },
    dog: customOf(s).dog,
    raven: !!customOf(s).raven,
    decor: customOf(s).decor ?? [],
    facade: customOf(s).facade ?? [],
    tints: customOf(s).colors,
    look: customOf(s).look,
    garden: customOf(s).garden,
    visitors: { day: s.day, kinds: visitorOrder(s) },
    gear: gearInStock(s).map((i) => ({ icon: i.icon ?? 'espada', rarity: i.rarity ?? 0 })),
    trophies: s.trophies.map((t) => t.icon),
    vault: Math.min(1, s.gold / goldCap(s)),
    heroes,
    incidents: (s.incidents ?? []).map(({ id, kind, room, taps, until, duel }) => ({
      id,
      kind,
      room,
      taps,
      until,
      duel,
    })),
    incidentEnds: s.incidentLog,
    clock: { day: s.day, secs: s.clock ?? 0 },
    seed: s.seed,
    crafts: (s.crafts ?? []).map((c) => {
      const st = craftState(s, c);
      return {
        id: c.id,
        room: c.room,
        icon: c.item?.icon ?? (c.recipe ? RECIPES[c.recipe].icon : 'capa'),
        rarity: c.item?.rarity ?? 0,
        frac: st.frac,
        stalled: st.hoursLeft === null,
        undo: !!c.item,
        hero: c.dress?.hero,
        walking: st.walking || undefined,
      };
    }),
    craftEnds: s.craftLog,
    paints: (s.paints ?? []).map((p) => {
      const st = paintState(s, p);
      return {
        id: p.id,
        room: p.room,
        painter: p.painter,
        tint: p.tint,
        frac: st.frac,
        walking: st.walking,
      };
    }),
  };
}
