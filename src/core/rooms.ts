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
  MAX_UP,
  MOVE_COST,
  PLOT_COST,
  ROOM_COST,
  ROOM_SIZE_COST,
  STAIR_COST,
  STAIR_STEP,
  START_COLS,
  UPGRADE_COST,
  roomMax,
} from './balance';
import type { Building, DawnEvent, Facilities, GameState, Room } from './model';

export type Planned = { b: Building; cost: number };
export type Plan = { error: string } | Planned;
export type ExtendDir = 'left' | 'right' | 'up';

export const LOCKED =
  'Las obras se abren al pagar la deuda: de momento solo se arregla y se mejora lo que hay.';

const key = (c: number, f: number) => `${c},${f}`;

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
    stairs: [-1, 0, 1].map((floor) => ({ at: 1, floor })),
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

/** Columnas de escalera (la que va a la izquierda del hueco `x`), de izquierda a derecha. */
export const shafts = (b: Building): number[] =>
  [...new Set(b.stairs.map((s) => s.at))].sort((x, y) => x - y);

export const isShaft = (b: Building, x: number) => b.stairs.some((s) => s.at === x);

const hasStair = (b: Building, x: number, f: number) =>
  b.stairs.some((s) => s.at === x && s.floor === f);

/** Hay rellano en la columna `x` y la planta `f`: algún tramo llega a ella. */
export const landing = (b: Building, x: number, f: number) =>
  hasStair(b, x, f) || hasStair(b, x, f - 1);

/** Se va por la escalera de la columna `x` de la planta `a` a la `c` (todos los tramos están). */
export function stairLinks(b: Building, x: number, a: number, c: number): boolean {
  if (a === c) return landing(b, x, a);
  for (let f = Math.min(a, c); f < Math.max(a, c); f++) if (!hasStair(b, x, f)) return false;
  return true;
}

/** Lo que cuesta el próximo tramo de escalera: cada uno, un poco más. */
export const stairCost = (b: Building) => STAIR_COST + STAIR_STEP * b.stairs.length;

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

/** Camas por hueco en un dormitorio (nivel + 1) o en los cuartos de veteranos (2 por nivel). */
export function bedsPerCell(type: RoomType, level: number): number {
  if (type === 'dormitorio') return level > 0 ? level + 1 : 0;
  if (type === 'veteranos') return 2 * level;
  return 0;
}

/** Camas para héroes de una sala (las que está construyendo no cuentan hasta que acaba). */
export function roomBeds(r: Room): number {
  const a = active(r);
  return a.cells * bedsPerCell(r.type, a.level);
}

/** Camas para héroes de todo el edificio: el tope de héroes del gremio. */
export function beds(b: Building): number {
  return b.rooms.reduce((n, r) => n + roomBeds(r), 0);
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

/**
 * En el plano se puede dejar alguna sala sin paso mientras se sigue reformando (para mover salas
 * sin tener el camino ya hecho); al pagar, el edificio tiene que cuadrar del todo.
 */
let lax = false;

/** Salas que siempre tiene que haber: las que no se pueden tirar fuera del plano. */
export const MUST = (Object.keys(ROOMS) as RoomType[]).filter((t) => ROOMS[t].keep);

/**
 * El borrador del modo obras: las salas que ya estaban antes de empezarlo (las demás son nuevas
 * del borrador: se quitan devolviendo todo y se mueven gratis), las que ya se han movido en él
 * (la mudanza se paga una vez) y los tramos de escalera que ya estaban.
 */
let draft: { base: Set<string>; moved: Set<string>; flights: Set<string> } | null = null;
const isFresh = (id: string) => !!draft && !draft.base.has(id);

/** Hace `fn` como borrador de obras sobre la taberna `base`, dejando la casa a medias. */
export function drafting<T>(base: Building, fn: () => T): T {
  const was = draft;
  draft = {
    base: new Set(base.rooms.map((r) => r.id)),
    moved: new Set(),
    flights: new Set(base.stairs.map((x) => key(x.at, x.floor))),
  };
  try {
    return laxly(fn);
  } finally {
    draft = was;
  }
}

/** Hace `fn` dejando pasar salas sin paso desde el recibidor (se arregla con más obras). */
export function laxly<T>(fn: () => T): T {
  const was = lax;
  lax = true;
  try {
    return fn();
  } finally {
    lax = was;
  }
}

/** Lo que falla en un edificio (o null si todo cuadra): tamaños, solapes, apoyos y paso. */
export function problem(b: Building): string | null {
  const flights = new Set<string>();
  for (const s of b.stairs) {
    const k = key(s.at, s.floor);
    if (s.at < 1 || s.at > b.cols || s.floor < -MAX_DOWN || s.floor >= MAX_UP || flights.has(k))
      return 'Esa escalera no cabe ahí.';
    flights.add(k);
  }
  const cols = shafts(b);
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
    if (cols.some((x) => x > r.col && x < r.col + r.w))
      return 'Una sala no puede cruzar la escalera.';
    for (const [c, f] of cellsOf(r)) {
      if (at.has(key(c, f))) return 'Ahí ya hay otra sala.';
      if (f < 0 && !b.dug.includes(key(c, f))) return 'Primero hay que excavar.';
      at.set(key(c, f), r);
    }
    count.set(r.type, (count.get(r.type) ?? 0) + 1);
    if (d.unique && count.get(r.type)! > 1) return `Ya tienes ${d.name.toLowerCase()}.`;
  }
  const under = (c: number, f: number) => at.get(key(c, f - 1));
  for (const r of b.rooms) {
    if (r.type === 'torre') {
      const below = under(r.col, r.floor);
      if (r.floor < 1 || !below || below.type === 'torre') return 'La torre va encima de una sala.';
      continue;
    }
    for (let c = r.col; c < r.col + r.w; c++) {
      if (under(c, r.floor)?.type === 'torre') return 'Encima de la torre no se construye.';
      const holds = (x: number) => {
        const u = under(x, r.floor);
        return !!u && u.type !== 'torre';
      };
      if (r.floor > 0 && ![c - 1, c, c + 1].some(holds))
        return 'Una planta solo puede sobresalir un hueco de la de abajo.';
    }
  }
  // Cada tramo sale de algo: hacia arriba, de una planta con sala al lado; hacia abajo, de una
  // sala o un hueco excavado de la planta de encima; o de otro tramo.
  const beside = (x: number, f: number) =>
    [at.get(key(x - 1, f)), at.get(key(x, f))].some((r) => r && r.type !== 'torre') ||
    (f < 0 && (isDug(b, x - 1, f) || isDug(b, x, f)));
  for (const { at: x, floor: f } of b.stairs) {
    const from =
      f > 0
        ? hasStair(b, x, f - 1) || beside(x, f)
        : f < 0
          ? hasStair(b, x, f + 1) || beside(x, f + 1)
          : hasStair(b, x, -1) || hasStair(b, x, 1) || beside(x, 0) || beside(x, 1);
    if (!from)
      return 'La escalera tiene que salir de una sala, de un hueco excavado o de otro tramo.';
  }
  if (lax) return null;
  // Las salas que no pueden faltar (se pueden quitar en el plano para ponerlas en otro sitio).
  const gone = MUST.find((t) => !count.get(t));
  if (gone) return `Falta: ${ROOMS[gone].name}. Vuelve a ponerla en el plano para poder pagar.`;
  const lost = cutOff(b, at);
  return lost ? `${ROOMS[lost.type].name}: se quedaría sin paso desde el recibidor.` : null;
}

/**
 * La primera sala a la que no se llega desde el recibidor. Se anda por la planta de abajo de cada
 * sala (en las de dos alturas, la de arriba es aire). Se pasa de una sala a la de al lado
 * (con columna de escalera en medio también: sin tramo, es un pasillo), a la torre desde la sala
 * de debajo y, por los tramos de cada escalera, a las salas que dan a sus rellanos.
 */
function cutOff(b: Building, at: Map<string, Room>): Room | null {
  const start = b.rooms.find((r) => r.type === 'recibidor');
  if (!start) return b.rooms[0] ?? null;
  const seen = new Set<Room>([start]);
  const landed = new Set<string>();
  const queue: Room[] = [start];
  // Se anda por el suelo de cada sala: en las altas, solo por la planta de abajo.
  const visit = (r: Room | undefined, f: number) => {
    if (r && r.type !== 'torre' && r.floor === f && !seen.has(r)) {
      seen.add(r);
      queue.push(r);
    }
  };
  // Sube y baja por la escalera desde un rellano, entrando en las salas de cada planta.
  const climb = (x: number, f0: number) => {
    const todo = landing(b, x, f0) ? [f0] : [];
    while (todo.length) {
      const f = todo.pop()!;
      if (landed.has(key(x, f))) continue;
      landed.add(key(x, f));
      visit(at.get(key(x - 1, f)), f);
      visit(at.get(key(x, f)), f);
      if (hasStair(b, x, f)) todo.push(f + 1);
      if (hasStair(b, x, f - 1)) todo.push(f - 1);
    }
  };
  const side = (x: number, c: number, f: number) => {
    visit(at.get(key(c, f)), f);
    climb(x, f);
  };
  while (queue.length) {
    const r = queue.shift()!;
    side(r.col, r.col - 1, r.floor);
    side(r.col + r.w, r.col + r.w, r.floor);
    for (let c = r.col; c < r.col + r.w; c++) {
      const up = at.get(key(c, r.floor + r.h));
      if (up?.type === 'torre') seen.add(up);
    }
  }
  const lost = b.rooms.filter((r) => !seen.has(r));
  return lost.find((r) => r.type !== 'torre') ?? lost[0] ?? null;
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

/**
 * Dos salas del mismo tipo y nivel que se tocan en la misma planta se juntan en una (si no se
 * pasan del ancho máximo y no hay una escalera entre ellas). Las que están en obras esperan.
 */
function joinable(b: Building, a: Room, c: Room): boolean {
  return (
    a !== c &&
    a.type === c.type &&
    a.type !== 'torre' &&
    a.level === c.level &&
    a.floor === c.floor &&
    a.h === c.h &&
    a.col + a.w === c.col &&
    !isShaft(b, c.col) &&
    a.w + c.w <= ROOMS[a.type].maxW &&
    !a.works &&
    !c.works
  );
}

export function mergeRooms(b: Building): void {
  for (;;) {
    let pair: [Room, Room] | null = null;
    for (const a of b.rooms) {
      const c = b.rooms.find((x) => joinable(b, a, x));
      if (c) {
        pair = [a, c];
        break;
      }
    }
    if (!pair) return;
    const [a, c] = pair;
    a.w += c.w;
    a.spent += c.spent;
    b.rooms = b.rooms.filter((x) => x !== c);
  }
}

// ---------- Planes de obra ----------

function finish(s: GameState, b: Building, cost: number): Plan {
  mergeRooms(b);
  const e = problem(b);
  if (e) return { error: e };
  // En el borrador el oro se mira al pagarlo todo junto (`planIssue`).
  if (!lax && cost > s.gold) return { error: `Te faltan ${cost - s.gold} monedas.` };
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
  const cost = upgradeCostOf(r);
  if (cost === null) return { error: 'Ya está al máximo.' };
  r.level++;
  r.spent += cost;
  return finish(s, b, cost);
}

/**
 * Construir una sala nueva de un hueco: queda lista al pagar. Al lado de otra igual y de nivel 1
 * cuenta como ampliarla: se junta con ella y cuesta lo que una ampliación.
 */
export function planBuild(s: GameState, type: RoomType, col: number, floor: number): Plan {
  if (!worksOpen(s)) return { error: LOCKED };
  const b = structuredClone(s.building);
  const fresh: Room = newRoom(b, type, col, floor);
  const next = b.rooms.find(
    (r) => !roomAt(b, col, floor) && (joinable(b, r, fresh) || joinable(b, fresh, r)) && r.h === 1,
  );
  if (next) {
    if (next.col > col) next.col = col;
    next.w++;
    const cost = extendCostOf(next, 1);
    next.spent += cost;
    return finish(s, b, cost);
  }
  const cost = ROOM_COST[type][1]!;
  b.rooms.push({ ...fresh, spent: cost });
  return finish(s, b, cost);
}

/** Ampliar un hueco a un lado (o una planta hacia arriba, el salón). */
export function planExtend(s: GameState, id: string, dir: ExtendDir): Plan {
  if (!worksOpen(s)) return { error: LOCKED };
  const got = find(s, id);
  if ('error' in got) return got;
  const { b, r } = got;
  if (r.level === 0) return { error: 'Primero hay que arreglarla.' };
  const before = r.w * r.h;
  if (dir === 'up') r.h++;
  else {
    r.w++;
    if (dir === 'left') r.col--;
  }
  const cost = extendCostOf(r, r.w * r.h - before);
  r.spent += cost;
  return finish(s, b, cost);
}

/**
 * Mover una sala a otro sitio libre del mismo tamaño. En el borrador se puede mover tantas veces
 * como se quiera: la mudanza se paga una vez, y las salas nuevas del borrador se mueven gratis.
 */
export function planMove(s: GameState, id: string, col: number, floor: number): Plan {
  if (!worksOpen(s)) return { error: LOCKED };
  const got = find(s, id);
  if ('error' in got) return got;
  const { b, r } = got;
  if (ROOMS[r.type].fixed) return { error: `${ROOMS[r.type].name}: no se puede mover.` };
  if (r.col === col && r.floor === floor) return { error: 'Ya está ahí.' };
  r.col = col;
  r.floor = floor;
  const paid = isFresh(id) || !!draft?.moved.has(id);
  draft?.moved.add(id);
  return finish(s, b, paid ? 0 : MOVE_COST * r.w * r.h);
}

/** Destruir una sala: se recupera la mitad de lo gastado en ella. */
export function planDemolish(s: GameState, id: string): Plan {
  if (!worksOpen(s)) return { error: LOCKED };
  const got = find(s, id);
  if ('error' in got) return got;
  const { b, r } = got;
  // En el plano sí: se quita para ponerla en otro sitio, y no se paga hasta que vuelva a estar.
  if (ROOMS[r.type].keep && !lax)
    return { error: `${ROOMS[r.type].name}: no se puede quitar (en el plano, sí, para moverla).` };
  b.rooms = b.rooms.filter((x) => x !== r);
  // Una sala puesta en este mismo borrador se quita devolviendo todo.
  return finish(s, b, -(isFresh(id) ? r.spent : Math.floor(r.spent * DEMOLISH_REFUND)));
}

/**
 * Excavar un hueco: junto a otro excavado o junto a un rellano de escalera. Junto al rellano de
 * más abajo de una escalera, la escalera baja un tramo con él (y se paga el tramo).
 */
export function planDig(s: GameState, col: number, floor: number): Plan {
  if (!worksOpen(s)) return { error: LOCKED };
  const b = structuredClone(s.building);
  if (floor >= 0 || floor < -MAX_DOWN || col < 0 || col >= b.cols)
    return { error: 'Ahí no se puede excavar.' };
  if (isDug(b, col, floor)) return { error: 'Ya está excavado.' };
  const sides = [col, col + 1];
  const byStair = sides.some((x) => landing(b, x, floor));
  const down = byStair ? undefined : sides.find((x) => landing(b, x, floor + 1));
  if (!byStair && down === undefined && !isDug(b, col - 1, floor) && !isDug(b, col + 1, floor))
    return { error: 'Hay que excavar junto a la escalera o junto a otro hueco excavado.' };
  let cost = DIG_COST[-floor]!;
  if (down !== undefined) {
    cost += stairCost(b);
    b.stairs.push({ at: down, floor });
    b.stairs.sort((x, y) => x.at - y.at || x.floor - y.floor);
  }
  b.dug.push(key(col, floor));
  return finish(s, b, cost);
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

/**
 * Poner un tramo de escalera a la izquierda del hueco `at`, de la planta `floor` a la de encima.
 * Bajo tierra, la escalera abre su propio hueco (luego se excava junto a ella).
 */
export function planStair(s: GameState, at: number, floor: number): Plan {
  if (!worksOpen(s)) return { error: LOCKED };
  const b = structuredClone(s.building);
  if (hasStair(b, at, floor)) return { error: 'Ahí ya hay escalera.' };
  const cost = stairCost(b);
  b.stairs.push({ at, floor });
  b.stairs.sort((x, y) => x.at - y.at || x.floor - y.floor);
  return finish(s, b, cost);
}

/**
 * Quitar un tramo de escalera (si no deja otro en el aire). Uno
 * puesto en este mismo borrador devuelve lo que costó; uno que ya estaba, la mitad.
 */
export function planUnstair(s: GameState, at: number, floor: number): Plan {
  if (!worksOpen(s)) return { error: LOCKED };
  const b = structuredClone(s.building);
  if (!hasStair(b, at, floor)) return { error: 'Ahí no hay escalera.' };
  b.stairs = b.stairs.filter((x) => x.at !== at || x.floor !== floor);
  const paid = stairCost(b);
  const fresh = !!draft && !draft.flights.has(key(at, floor));
  return finish(s, b, -(fresh ? paid : Math.floor(paid * DEMOLISH_REFUND)));
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
  if (done) {
    mergeRooms(s.building);
    syncFac(s);
  }
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
