/**
 * La marca de destino: al soltar a alguien en una sala, un banderín clavado en el suelo donde va
 * (con el color del gremio y el icono de lo que va a hacer) hasta que llega. Mientras se le lleva
 * con el dedo, el mismo banderín, más tenue, enseña dónde caerá. Solo dibujo (en la lámina de
 * delante, en píxeles de la vista).
 */
import { P } from '../../art/palette';
import type { RoomType } from '../../data/rooms';

/** Lo que va a hacer al llegar: el icono del banderín. */
export type GoalIcon =
  | 'alerta'
  | 'cama'
  | 'escudo'
  | 'jarra'
  | 'olla'
  | 'barril'
  | 'moneda'
  | 'cruz'
  | 'vela'
  | 'mapa'
  | 'espada'
  | 'martillo'
  | 'ojo'
  | 'saco'
  | 'diana'
  | 'libro'
  | 'tijeras'
  | 'frasco';

/**
 * Los iconos, de 7 × 7: `#` el color claro, `o` el de la sombra (más oscuro), `.` nada. Se leen
 * sobre la tela del banderín.
 */
const ICONS: Record<GoalIcon, string[]> = {
  alerta: ['..###..', '..###..', '..###..', '..###..', '...#...', '.......', '..###..'],
  cama: ['.......', '#......', '#.oo...', '#######', '#######', '#.....#', '.......'],
  escudo: ['#######', '#ooo###', '#ooo###', '###ooo#', '.##ooo.', '..###..', '...#...'],
  jarra: ['.####..', '#oooo#.', '#####.#', '#####.#', '#####.#', '######.', '.####..'],
  olla: ['...#...', '.#####.', '#.....#', '#######', '#ooooo#', '.#####.', '.#...#.'],
  barril: ['.#####.', '#ooooo#', '#######', '#.#.#.#', '#######', '#ooooo#', '.#####.'],
  moneda: ['..###..', '.#ooo#.', '#o#o#o#', '#o###o#', '#o#o#o#', '.#ooo#.', '..###..'],
  cruz: ['..###..', '..###..', '#######', '#######', '#######', '..###..', '..###..'],
  vela: ['...#...', '..#o#..', '...#...', '..###..', '..###..', '..###..', '.#####.'],
  mapa: ['##.##.#', '#o##o##', '#.##.##', '##o##o#', '#.##.##', '##.##.#', '.......'],
  espada: ['......#', '.....#.', '....#..', '.o.#...', '..#....', '.#o....', '#..o...'],
  martillo: ['.####..', '.####o.', '.####..', '...#...', '...#...', '...#...', '...#...'],
  ojo: ['.......', '.#####.', '#..o..#', '#.ooo.#', '#..o..#', '.#####.', '.......'],
  saco: ['..#.#..', '...#...', '.#####.', '#######', '###o###', '#######', '.#####.'],
  diana: ['.#####.', '#ooooo#', '#o###o#', '#o#o#o#', '#o###o#', '#ooooo#', '.#####.'],
  libro: ['.......', '###.###', '#o#.#o#', '###.###', '#o#.#o#', '###.###', '.......'],
  tijeras: ['#....#.', '.#..#..', '..##...', '..##...', '.o..o..', 'o.o.o.o', '.o...o.'],
  frasco: ['..###..', '...#...', '...#...', '..#.#..', '.#ooo#.', '#ooooo#', '.#####.'],
};

/** El icono de cada sala (lo que se hace en ella). */
const ROOM_ICON: Record<RoomType, GoalIcon> = {
  recibidor: 'escudo',
  salon: 'jarra',
  cocina: 'olla',
  bodega: 'barril',
  tesoro: 'moneda',
  dormitorio: 'cama',
  enfermeria: 'cruz',
  capilla: 'vela',
  mapas: 'mapa',
  armeria: 'espada',
  forja: 'martillo',
  veteranos: 'cama',
  torre: 'ojo',
  servicio: 'cama',
  despensa: 'saco',
  armas: 'espada',
  tiro: 'diana',
  biblioteca: 'libro',
  sastreria: 'tijeras',
  alquimia: 'frasco',
};

/**
 * El icono de lo que va a hacer: arreglar lo que pasa (si en la sala hay algo que se arregla
 * mandando a alguien), descansar (en las salas de dormir, y los trabajadores también en el
 * recibidor no hacen guardia), o lo de la sala.
 */
export function goalIcon(type: RoomType, o: { incident: boolean; worker: boolean }): GoalIcon {
  if (o.incident) return 'alerta';
  if (o.worker && type === 'recibidor') return 'jarra';
  if (o.worker && type === 'dormitorio') return 'cama';
  return ROOM_ICON[type];
}

/** Alto del palo, ancho y alto de la tela (píxeles de la vista). */
const POLE = 31;
/** El palo, a un lado del sitio: la tela ondea por encima de la cabeza de quien llega. */
const SIDE = -12;
const CLOTH_W = 13;
const CLOTH_H = 11;

export interface GoalDraw {
  /** Los pies del banderín, en píxeles de la vista. */
  x: number;
  y: number;
  /** Segundos de reloj (para el ondear) y desde que se clavó (o se empezó a enseñar). */
  t: number;
  age: number;
  /** Cuánto se ve (0–1): se funde al llegar y, de muestra, va tenue. */
  alpha: number;
  icon: GoalIcon;
  /** El color de la tela y el de su sombra: los de la ropa de quien va (ver `clothOf`). */
  field: string;
  dark: string;
  /** De muestra (mientras se lleva a alguien): sin clavarse ni onda en el suelo. */
  preview?: boolean;
}

/**
 * El banderín: la onda en el suelo que se abre y se apaga (cada poco), la sombra, el palo con su
 * remate dorado y la tela de dos puntas que ondea más hacia la punta, con el icono encima. Al
 * clavarse cae desde arriba y rebota un poco.
 */
export function drawGoal(ctx: CanvasRenderingContext2D, g: GoalDraw): void {
  const spot = Math.round(g.x);
  const x = spot + SIDE;
  const ground = Math.round(g.y);
  // Cae y rebota (en 0,35 s); de muestra, flota un poco por encima, subiendo y bajando.
  const drop = g.preview
    ? -3 - Math.round(Math.sin(g.t * 4) * 1.5)
    : g.age < 0.22
      ? -Math.round(14 * (1 - g.age / 0.22) ** 2)
      : g.age < 0.36
        ? -Math.round(2 * Math.sin(((g.age - 0.22) / 0.14) * Math.PI))
        : 0;
  const foot = ground + drop;
  ctx.save();
  ctx.globalAlpha = g.alpha;
  // La onda en el suelo: una elipse que se abre y se apaga cada 1,4 s (solo ya clavado).
  if (!g.preview && g.age > 0.22) {
    const p = ((g.age - 0.22) % 1.4) / 1.4;
    const rx = 3 + Math.round(p * 9);
    ctx.globalAlpha = g.alpha * (1 - p) * 0.9;
    ring(ctx, spot, ground, rx, Math.max(1, Math.round(rx / 3)), P.lemon);
  }
  // La sombra en el suelo (más pequeña si va en el aire).
  ctx.globalAlpha = g.alpha * (g.preview ? 0.25 : 0.4);
  ctx.fillStyle = P.black;
  const sw = drop < -6 ? 2 : 3;
  ctx.fillRect(x - sw, ground, sw * 2 + 1, 1);
  ctx.fillRect(x - sw + 1, ground + 1, sw * 2 - 1, 1);
  ctx.globalAlpha = g.alpha;
  // El palo: claro a la izquierda y oscuro a la derecha, con la punta clavada y el remate.
  const top = foot - POLE;
  ctx.fillStyle = P.tan;
  ctx.fillRect(x, top, 1, POLE);
  ctx.fillStyle = P.oak;
  ctx.fillRect(x + 1, top + 1, 1, POLE - 1);
  ctx.fillStyle = P.gold;
  ctx.fillRect(x, top - 2, 2, 2);
  ctx.fillStyle = P.lemon;
  ctx.fillRect(x, top - 2, 1, 1);
  // La tela: cada columna baja o sube con la onda (más hacia la punta), con un pico hacia
  // dentro en el borde de la punta (dos puntas).
  const { field, dark } = g;
  // El icono, claro sobre tela oscura y oscuro sobre tela clara (el clérigo, el tabernero…).
  const light = lum(field) > 0.55;
  const ink = light ? P.navy : P.white;
  const inkShade = light ? P.slate : dark;
  const edge = P.black;
  const lift = (c: number) =>
    Math.round(Math.sin(g.t * 7 - c * 0.7) * (c / CLOTH_W) * 1.8 + (c / CLOTH_W) * 1.2);
  for (let c = 0; c < CLOTH_W; c++) {
    const cx = x + 2 + c;
    const dy = top + 1 + lift(c);
    // Las dos puntas: en las últimas columnas, el pico se come el centro.
    const notch = c >= CLOTH_W - 4 ? c - (CLOTH_W - 4) + 1 : 0;
    const shade = Math.sin(g.t * 7 - c * 0.7) > 0.55 ? dark : field;
    for (let r = 0; r < CLOTH_H; r++) {
      const mid = Math.abs(r - (CLOTH_H - 1) / 2);
      if (notch && mid < notch - 0.5) continue;
      const border = r === 0 || r === CLOTH_H - 1 || (notch && mid < notch + 0.5);
      ctx.fillStyle = border ? edge : shade;
      ctx.fillRect(cx, dy + r, 1, 1);
    }
  }
  // El icono, sobre la tela (con su misma onda).
  const rows = ICONS[g.icon];
  for (let c = 0; c < 7; c++) {
    const dy = top + 3 + lift(c + 2);
    for (let r = 0; r < 7; r++) {
      const ch = rows[r]![c];
      if (ch === '.') continue;
      ctx.fillStyle = ch === '#' ? ink : ch === 'o' ? inkShade : field;
      ctx.fillRect(x + 4 + c, dy + r, 1, 1);
    }
  }
  ctx.restore();
}

/** Una elipse de un píxel de grueso (la onda del suelo), por puntos. */
function ring(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
): void {
  ctx.fillStyle = color;
  const n = Math.max(12, Math.round(rx * 4));
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = Math.round(cx + Math.cos(a) * rx);
    const py = Math.round(cy + Math.sin(a) * ry);
    const k = `${px},${py}`;
    if (seen.has(k)) continue;
    seen.add(k);
    ctx.fillRect(px, py, 1, 1);
  }
}

/** Lo claro que es un color (0–1, a ojo: el verde pesa más). */
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255;
}
