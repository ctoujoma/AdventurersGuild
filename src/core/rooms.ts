/**
 * Reglas de obra del gremio por salas: qué cabe dónde, cuánto cuesta y qué se puede hacer
 * antes y después de pagar la deuda. TS puro, sin DOM: lo usan el reducer, la escena y los tests.
 *
 * Cada `plan…` mira si la obra se puede hacer y devuelve el edificio como quedaría y lo que
 * cuesta, sin tocar el estado; el reducer lo aplica con `applyPlan`.
 */
import { ROOMS, YARD, type RoomType, type YardKey } from '../data/rooms';
import {
  DEMOLISH_REFUND,
  DIG_COST,
  EXTEND_RATE,
  MAX_COLS,
  MAX_DOWN,
  MAX_STAIRS,
  MAX_UP,
  MOVE_COST,
  PLOT_COST,
  ROOM_COST,
  ROOM_SIZE_COST,
  STAIR_COST,
  START_COLS,
  UPGRADE_COST,
  WORK_NIGHTS,
  roomMax,
} from './balance';
import type { Building, DawnEvent, Facilities, GameState, Room } from './model';

export type Planned = { b: Building; cost: number };
export type Plan = { error: string } | Planned;
export type ExtendDir = 'left' | 'right' | 'up';

export const LOCKED =
  'Las obras se abren al pagar la deuda: de momento solo se arregla y se mejora lo que hay.';
const BUSY = 'Espera a que acabe la obra.';

const key = (c: number, f: number) => `${c},${f}`;
const floorOf = (k: string) => Number(k.split(',')[1]);

/** La taberna del tío al empezar: cada cosa en su sitio y muchas salas rotas. */
export function uncleBuilding(): Building {
  let n = 0;
  const room = (type: RoomType, col: number, floor: number, w: number, level: number): Room => ({
    id: `t${++n}`,
    type,
    col,
    floor,
    w,
    h: 1,
    level,
    spent: 0,
  });
  return {
    cols: START_COLS,
    stairs: [1],
    dug: [0, 1, 2, 3].map((c) => key(c, -1)),
    rooms: [
      room('torre', 0, 3, 1, 0),
      room('mapas', 0, 2, 1, 0),
      room('enfermeria', 0, 1, 1, 0),
      room('dormitorio', 1, 1, 2, 1),
      room('capilla', 3, 1, 1, 0),
      room('recibidor', 0, 0, 1, 1),
      room('salon', 1, 0, 2, 1),
      room('cocina', 3, 0, 1, 1),
      room('bodega', 0, -1, 1, 1),
      room('armeria', 1, -1, 1, 0),
      room('forja', 2, -1, 1, 0),
      room('tesoro', 3, -1, 1, 1),
    ],
    yard: { establo: 0, patio: 0, empal: 0 },
  };
}

// ---------- Consultas ----------

/** Las obras de verdad (construir, ampliar, mover…) se abren al pagar la deuda. */
export const worksOpen = (s: GameState) => s.mode === 'libre';

export function cellsOf(r: Room): [number, number][] {
  const out: [number, number][] = [];
  for (let f = r.floor; f < r.floor + r.h; f++)
    for (let c = r.col; c < r.col + r.w; c++) out.push([c, f]);
  return out;
}

export const roomAt = (b: Building, c: number, f: number) =>
  b.rooms.find((r) => c >= r.col && c < r.col + r.w && f >= r.floor && f < r.floor + r.h);

export const isDug = (b: Building, c: number, f: number) => f >= 0 || b.dug.includes(key(c, f));

/** Lo que cuenta hoy de una sala: construyéndose o moviéndose no funciona; ampliándose, cuenta lo de antes. */
export function active(r: Room): { level: number; cells: number } {
  if (r.works && r.works.kind !== 'extend') return { level: 0, cells: 0 };
  const size = r.works?.from ?? r;
  return { level: r.level, cells: size.w * size.h };
}

/** Nivel de cada instalación de antes: el de su sala (la mejor, si hay varias) o el del patio. */
export function facOf(b: Building): Facilities {
  const f: Facilities = {
    dorm: 0,
    enf: 0,
    tab: 0,
    mapas: 0,
    arm: 0,
    cap: 0,
    forja: 0,
    establo: b.yard.establo,
    patio: b.yard.patio,
    empal: b.yard.empal,
    torre: 0,
    vet: 0,
  };
  for (const r of b.rooms) {
    const k = ROOMS[r.type].fac;
    if (k) f[k] = Math.max(f[k], active(r).level);
  }
  return f;
}

export const syncFac = (s: GameState) => {
  s.fac = facOf(s.building);
};

/** Camas para héroes: cada hueco de dormitorio da nivel + 1; cada hueco de veteranos, 2 por nivel. */
export function beds(b: Building): number {
  let n = 0;
  for (const r of b.rooms) {
    const a = active(r);
    if (r.type === 'dormitorio' && a.level > 0) n += a.cells * (a.level + 1);
    else if (r.type === 'veteranos') n += a.cells * 2 * a.level;
  }
  return n;
}

/** Mejorar: lo que pone la tabla para el nivel siguiente, con recargo si es más ancha que la de serie. */
export function upgradeCostOf(r: Room): number | null {
  if (r.level >= roomMax(r.type)) return null;
  const extra = Math.max(0, r.w * r.h - (ROOMS[r.type].base ?? 1));
  return Math.round(ROOM_COST[r.type][r.level + 1]! * (1 + ROOM_SIZE_COST * extra));
}

/** Ampliar: cada hueco nuevo, una parte de lo que cuesta llevar un hueco hasta su nivel. */
export function extendCostOf(r: Room, cells: number): number {
  const sum = ROOM_COST[r.type].slice(1, r.level + 1).reduce((a, x) => a + x, 0);
  return Math.round(cells * EXTEND_RATE * sum);
}

/** Lo que falla en un edificio (o null si todo cuadra): tamaños, solapes, apoyos y paso. */
export function problem(b: Building): string | null {
  if (!b.stairs.length || b.stairs.length > MAX_STAIRS) return 'Hace falta una escalera, o dos.';
  if (b.stairs.some((x, i) => x < 1 || x > b.cols || b.stairs.indexOf(x) !== i))
    return 'Esa escalera no cabe ahí.';
  const at = new Map<string, Room>();
  const count = new Map<RoomType, number>();
  for (const r of b.rooms) {
    const d = ROOMS[r.type];
    if (r.w < 1 || r.w > d.maxW || r.h < 1 || r.h > d.maxH) return `${d.name}: no crece tanto.`;
    const roof = r.type === 'torre' ? MAX_UP + 1 : MAX_UP;
    if (r.col < 0 || r.col + r.w > b.cols || r.floor < -MAX_DOWN || r.floor + r.h - 1 > roof)
      return 'No cabe en el solar.';
    if (d.place === 'baja' && r.floor !== 0) return `${d.name}: va en la planta baja.`;
    if (r.type === 'recibidor' && r.col !== 0) return 'El recibidor va junto al patio.';
    if (b.stairs.some((x) => x > r.col && x < r.col + r.w))
      return 'Una sala no puede cruzar la escalera.';
    for (const [c, f] of cellsOf(r)) {
      if (at.has(key(c, f))) return 'Ahí ya hay otra sala.';
      if (f < 0 && !b.dug.includes(key(c, f))) return 'Primero hay que excavar.';
      at.set(key(c, f), r);
    }
    count.set(r.type, (count.get(r.type) ?? 0) + 1);
    if (d.unique && count.get(r.type)! > 1) return `Ya tienes ${d.name.toLowerCase()}.`;
  }
  if (count.get('recibidor') !== 1) return 'Falta el recibidor.';
  const under = (c: number, f: number) => at.get(key(c, f - 1));
  for (const r of b.rooms) {
    if (r.type === 'torre') {
      const below = under(r.col, r.floor);
      if (r.floor < 1 || !below || below.type === 'torre') return 'La torre va encima de una sala.';
      continue;
    }
    for (let c = r.col; c < r.col + r.w; c++) {
      if (under(c, r.floor)?.type === 'torre') return 'Encima de la torre no se construye.';
      if (r.floor > 0 && ![c - 1, c, c + 1].some((x) => under(x, r.floor)))
        return 'Una planta solo puede sobresalir un hueco de la de abajo.';
    }
  }
  const lost = cutOff(b, at);
  return lost ? `${ROOMS[lost.type].name}: se quedaría sin paso desde el recibidor.` : null;
}

/**
 * La primera sala a la que no se llega desde el recibidor. Cada escalera baja hasta lo más
 * hondo que se ha excavado y sube hasta la última planta; se pasa de una sala a la de al lado
 * y a la torre desde la sala de debajo.
 */
function cutOff(b: Building, at: Map<string, Room>): Room | null {
  const start = b.rooms.find((r) => r.type === 'recibidor')!;
  const seen = new Set<Room>([start]);
  const stairsSeen = new Set<number>();
  const queue: Room[] = [start];
  const visit = (r: Room | undefined) => {
    if (r && !seen.has(r)) {
      seen.add(r);
      queue.push(r);
    }
  };
  while (queue.length) {
    const r = queue.shift()!;
    if (r.type === 'torre') {
      visit(at.get(key(r.col, r.floor - 1)));
      continue;
    }
    for (let f = r.floor; f < r.floor + r.h; f++) {
      visit(at.get(key(r.col - 1, f)));
      visit(at.get(key(r.col + r.w, f)));
    }
    for (let c = r.col; c < r.col + r.w; c++) {
      const up = at.get(key(c, r.floor + r.h));
      if (up?.type === 'torre') visit(up);
    }
    for (const x of b.stairs) {
      if (x !== r.col && x !== r.col + r.w) continue;
      if (stairsSeen.has(x)) continue;
      stairsSeen.add(x);
      for (const o of b.rooms)
        if (o.type !== 'torre' && (o.col === x || o.col + o.w === x)) visit(o);
    }
  }
  return b.rooms.find((r) => !seen.has(r)) ?? null;
}

/** Hueco libre para una sala nueva de un hueco (planta baja hacia arriba y luego hacia abajo). */
export function freeSpot(b: Building, type: RoomType): { col: number; floor: number } | null {
  const floors = [0, 1, 2, 3, 4, 5, -1, -2, -3, -4, -5, -6];
  for (const floor of floors)
    for (let col = 0; col < b.cols; col++) {
      if (roomAt(b, col, floor)) continue;
      const test = { ...b, rooms: [...b.rooms, newRoom(b, type, col, floor)] };
      if (!problem(test)) return { col, floor };
    }
  return null;
}

function newRoom(b: Building, type: RoomType, col: number, floor: number): Room {
  const n = b.rooms.reduce((m, r) => (r.id[0] === 'r' ? Math.max(m, Number(r.id.slice(1))) : m), 0);
  return { id: `r${n + 1}`, type, col, floor, w: 1, h: 1, level: 1, spent: 0 };
}

// ---------- Planes de obra ----------

function finish(s: GameState, b: Building, cost: number): Plan {
  const e = problem(b);
  if (e) return { error: e };
  if (cost > s.gold) return { error: `Te faltan ${cost - s.gold} monedas.` };
  return { b, cost };
}

function find(s: GameState, id: string): { b: Building; r: Room } | { error: string } {
  const b = structuredClone(s.building);
  const r = b.rooms.find((x) => x.id === id);
  return r ? { b, r } : { error: 'Esa sala ya no está.' };
}

/** Arreglar (si está rota) o subir de nivel una sala. Se puede desde el primer día. */
export function planUpgrade(s: GameState, id: string): Plan {
  const got = find(s, id);
  if ('error' in got) return got;
  const { b, r } = got;
  if (r.works && r.works.kind !== 'extend') return { error: BUSY };
  const cost = upgradeCostOf(r);
  if (cost === null) return { error: 'Ya está al máximo.' };
  r.level++;
  r.spent += cost;
  return finish(s, b, cost);
}

/** Construir una sala nueva de un hueco. Tarda una noche en estar lista. */
export function planBuild(s: GameState, type: RoomType, col: number, floor: number): Plan {
  if (!worksOpen(s)) return { error: LOCKED };
  const b = structuredClone(s.building);
  const cost = ROOM_COST[type][1]!;
  b.rooms.push({
    ...newRoom(b, type, col, floor),
    spent: cost,
    works: { kind: 'build', nights: WORK_NIGHTS.build },
  });
  return finish(s, b, cost);
}

/** Ampliar un hueco a un lado (o una planta hacia arriba, el salón). */
export function planExtend(s: GameState, id: string, dir: ExtendDir): Plan {
  if (!worksOpen(s)) return { error: LOCKED };
  const got = find(s, id);
  if ('error' in got) return got;
  const { b, r } = got;
  if (r.works) return { error: BUSY };
  if (r.level === 0) return { error: 'Primero hay que arreglarla.' };
  const from = { col: r.col, w: r.w, h: r.h };
  if (dir === 'up') r.h++;
  else {
    r.w++;
    if (dir === 'left') r.col--;
  }
  const cost = extendCostOf(r, r.w * r.h - from.w * from.h);
  r.spent += cost;
  r.works = { kind: 'extend', nights: WORK_NIGHTS.extend, from };
  return finish(s, b, cost);
}

/** Mover una sala a otro sitio libre del mismo tamaño. Esa noche no funciona. */
export function planMove(s: GameState, id: string, col: number, floor: number): Plan {
  if (!worksOpen(s)) return { error: LOCKED };
  const got = find(s, id);
  if ('error' in got) return got;
  const { b, r } = got;
  if (ROOMS[r.type].fixed) return { error: `${ROOMS[r.type].name}: no se puede mover.` };
  if (r.works) return { error: BUSY };
  if (r.col === col && r.floor === floor) return { error: 'Ya está ahí.' };
  r.col = col;
  r.floor = floor;
  r.works = { kind: 'move', nights: WORK_NIGHTS.move };
  return finish(s, b, MOVE_COST * r.w * r.h);
}

/** Destruir una sala: se recupera la mitad de lo gastado en ella. */
export function planDemolish(s: GameState, id: string): Plan {
  if (!worksOpen(s)) return { error: LOCKED };
  const got = find(s, id);
  if ('error' in got) return got;
  const { b, r } = got;
  if (ROOMS[r.type].keep) return { error: `${ROOMS[r.type].name}: no se puede quitar.` };
  if (r.works) return { error: BUSY };
  b.rooms = b.rooms.filter((x) => x !== r);
  return finish(s, b, -Math.floor(r.spent * DEMOLISH_REFUND));
}

/** Excavar un hueco: junto a otro excavado o junto a la escalera, una planta más abajo. */
export function planDig(s: GameState, col: number, floor: number): Plan {
  if (!worksOpen(s)) return { error: LOCKED };
  const b = structuredClone(s.building);
  if (floor >= 0 || floor < -MAX_DOWN || col < 0 || col >= b.cols)
    return { error: 'Ahí no se puede excavar.' };
  if (isDug(b, col, floor)) return { error: 'Ya está excavado.' };
  const deepest = Math.min(0, ...b.dug.map(floorOf));
  const byStair = b.stairs.some((x) => x === col || x === col + 1) && floor + 1 >= deepest;
  if (!byStair && !isDug(b, col - 1, floor) && !isDug(b, col + 1, floor))
    return { error: 'Hay que excavar junto a la escalera o junto a otro hueco excavado.' };
  b.dug.push(key(col, floor));
  return finish(s, b, DIG_COST[-floor]!);
}

/** Comprar el solar de la derecha: un hueco más de ancho en todas las plantas. */
export function planPlot(s: GameState): Plan {
  if (!worksOpen(s)) return { error: LOCKED };
  const b = structuredClone(s.building);
  if (b.cols >= MAX_COLS) return { error: 'No quedan solares a la venta.' };
  const cost = PLOT_COST[b.cols - START_COLS]!;
  b.cols++;
  return finish(s, b, cost);
}

/** Poner otra escalera a la izquierda del hueco `at`. */
export function planStair(s: GameState, at: number): Plan {
  if (!worksOpen(s)) return { error: LOCKED };
  const b = structuredClone(s.building);
  if (b.stairs.length >= MAX_STAIRS) return { error: 'Ya hay dos escaleras.' };
  if (b.stairs.includes(at)) return { error: 'Ahí ya hay escalera.' };
  b.stairs.push(at);
  b.stairs.sort((x, y) => x - y);
  return finish(s, b, STAIR_COST);
}

const isYard = (k: keyof Facilities): k is YardKey => (YARD as readonly string[]).includes(k);
const typeOf = (k: keyof Facilities) =>
  (Object.keys(ROOMS) as RoomType[]).find((t) => ROOMS[t].fac === k)!;

/**
 * Mejorar una instalación como antes: la del patio sube de nivel; la sala se arregla o se
 * mejora; si no existe (los veteranos), se construye donde quepa cuando las obras están abiertas.
 */
export function planFacility(s: GameState, k: keyof Facilities): Plan {
  if (isYard(k)) {
    const level = s.building.yard[k];
    const cost = UPGRADE_COST[k][level + 1];
    if (cost === undefined) return { error: 'Ya está al máximo.' };
    const b = structuredClone(s.building);
    b.yard[k]++;
    return finish(s, b, cost);
  }
  const type = typeOf(k);
  const room = s.building.rooms.find((r) => r.type === type);
  if (room) return planUpgrade(s, room.id);
  if (!worksOpen(s)) return { error: `${ROOMS[type].name}: se construyen al pagar la deuda.` };
  const spot = freeSpot(s.building, type);
  if (!spot) return { error: 'No queda sitio en la taberna.' };
  return planBuild(s, type, spot.col, spot.floor);
}

/** Lo que cuesta el siguiente paso de una instalación (null si está al máximo). */
export function facilityCost(s: GameState, k: keyof Facilities): number | null {
  if (isYard(k)) return UPGRADE_COST[k][s.building.yard[k] + 1] ?? null;
  const type = typeOf(k);
  const room = s.building.rooms.find((r) => r.type === type);
  return room ? upgradeCostOf(room) : ROOM_COST[type][1]!;
}

/** Aplica un plan sobre una copia del estado (el reducer ya ha copiado `s`). */
export function applyPlan(s: GameState, plan: Planned) {
  s.building = plan.b;
  s.gold -= plan.cost;
  syncFac(s);
}

/** Avanza las obras una noche y avisa de las que acaban. */
export function stepWorks(s: GameState, events: DawnEvent[]) {
  let done = false;
  for (const r of s.building.rooms) {
    if (!r.works || --r.works.nights > 0) continue;
    const name = ROOMS[r.type].name;
    events.push({
      t:
        r.works.kind === 'build'
          ? `Acaba la obra: ya está lista la sala nueva (${name.toLowerCase()}).`
          : r.works.kind === 'extend'
            ? `Acaba la obra: ${name.toLowerCase()} ya es más grande.`
            : `${name} ya está en su sitio nuevo.`,
      k: 'good',
    });
    delete r.works;
    done = true;
  }
  if (done) syncFac(s);
}

/** Modo prueba: todo al máximo, con los cuartos de veteranos donde quepan. */
export function maxOut(b: Building) {
  if (!b.rooms.some((r) => r.type === 'veteranos')) {
    const spot = freeSpot(b, 'veteranos');
    if (spot) b.rooms.push(newRoom(b, 'veteranos', spot.col, spot.floor));
  }
  for (const r of b.rooms) {
    r.level = roomMax(r.type);
    delete r.works;
  }
  for (const k of YARD) b.yard[k] = UPGRADE_COST[k].length - 1;
}
