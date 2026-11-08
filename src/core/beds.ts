/**
 * Quién duerme en qué dormitorio. Los veteranos, en el ala de veteranos (si cabe); los demás, en
 * los dormitorios (y si no caben, en el ala). Se respeta lo que haya elegido el jugador
 * (`dorm`) mientras quepa. Los trabajadores con cama, en los cuartos del servicio.
 */
import { VET_LEVEL } from './balance';
import type { GameState, Hero, Room, Worker } from './model';
import { active, roomBeds } from './rooms';

export const isVet = (h: Pick<Hero, 'lvl'>) => h.lvl >= VET_LEVEL;

/** Camas de trabajador de una sala del servicio. */
export const staffBedsOf = (r: Room) =>
  r.type === 'servicio' ? active(r).cells * 2 * active(r).level : 0;

/** Camas de una sala para quien sea (héroe o trabajador). */
const bedsIn = (r: Room) => (r.type === 'servicio' ? staffBedsOf(r) : roomBeds(r));

/** Los héroes que duermen en casa esta noche (los de guardia no se acuestan). */
const sleepers = (s: GameState) =>
  s.heroes.filter((h) => (h.status === 'ok' && !h.guard) || h.status === 'herido');

/** Los trabajadores con cama en casa: los primeros, hasta llenar el servicio. */
export function housed(s: GameState): Worker[] {
  const n = s.building.rooms.reduce((a, r) => a + staffBedsOf(r), 0);
  return s.workers.slice(0, n);
}

/** Si alguien puede dormir en una sala (por el tipo; no mira si cabe). */
function fits(who: Hero | Worker, r: Room): boolean {
  if (!('cls' in who)) return r.type === 'servicio';
  if (r.type === 'veteranos') return isVet(who);
  return r.type === 'dormitorio';
}

/** El reparto: id de cada uno → id de su dormitorio (quien no cabe en ninguno, no sale). */
export function sleepPlan(s: GameState): Map<string, string> {
  const out = new Map<string, string>();
  const left = new Map(s.building.rooms.map((r) => [r.id, bedsIn(r)]));
  const rooms = s.building.rooms.filter((r) => bedsIn(r) > 0);
  const put = (id: string, r: Room | undefined) => {
    if (!r || (left.get(r.id) ?? 0) <= 0) return false;
    left.set(r.id, left.get(r.id)! - 1);
    out.set(id, r.id);
    return true;
  };
  const first = (type: Room['type']) => rooms.find((r) => r.type === type && left.get(r.id)! > 0);
  const people: (Hero | Worker)[] = [...sleepers(s), ...housed(s)];
  // Lo elegido a mano, primero (si sigue valiendo).
  for (const p of people) {
    const r = p.dorm ? rooms.find((x) => x.id === p.dorm) : undefined;
    if (r && fits(p, r)) put(p.id, r);
  }
  // Los veteranos, al ala (los de más nivel antes).
  const heroes = sleepers(s).filter((h) => !out.has(h.id));
  const vets = heroes.filter(isVet).sort((a, b) => b.lvl - a.lvl);
  for (const h of vets) put(h.id, first('veteranos'));
  // Los demás, a los dormitorios; si no caben, al ala.
  for (const h of heroes)
    if (!out.has(h.id) && !put(h.id, first('dormitorio'))) put(h.id, first('veteranos'));
  for (const w of housed(s)) if (!out.has(w.id)) put(w.id, first('servicio'));
  return out;
}

/** Los veteranos en casa sin cama en el ala de veteranos. */
export function vetsWithoutWing(s: GameState): Hero[] {
  const plan = sleepPlan(s);
  const type = (id: string) => s.building.rooms.find((r) => r.id === plan.get(id))?.type;
  return sleepers(s).filter((h) => isVet(h) && type(h.id) !== 'veteranos');
}

/** Por qué no puede dormir ahí (o null): para mover a alguien de dormitorio. */
export function dormIssue(s: GameState, who: string, roomId: string): string | null {
  const p: Hero | Worker | undefined =
    s.heroes.find((h) => h.id === who) ?? s.workers.find((w) => w.id === who);
  if (!p) return 'Ya no está en la taberna.';
  const r = s.building.rooms.find((x) => x.id === roomId);
  if (!r || bedsIn(r) <= 0) return 'Ahí no hay camas.';
  if (!fits(p, r)) {
    if ('cls' in p && r.type === 'veteranos') return `${p.name} aún no es veterano.`;
    return 'cls' in p
      ? 'Los héroes duermen en los dormitorios.'
      : 'Los trabajadores duermen en el servicio.';
  }
  if (!('cls' in p) && !housed(s).includes(p)) return `${p.name} duerme en el pueblo.`;
  const plan = sleepPlan(s);
  if (plan.get(who) === roomId) return `${p.name} ya duerme aquí.`;
  const taken = [...plan.values()].filter((x) => x === roomId).length;
  // Si está lleno, solo con quien no lo ha elegido a mano (se le recoloca).
  const moveable = [...plan].filter(([id, x]) => {
    if (x !== roomId) return false;
    const o = s.heroes.find((h) => h.id === id) ?? s.workers.find((w) => w.id === id);
    return o?.dorm !== roomId;
  }).length;
  if (taken >= bedsIn(r) && !moveable) return 'No queda cama libre.';
  return null;
}
