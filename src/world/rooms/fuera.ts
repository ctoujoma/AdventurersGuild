/**
 * Quien está fuera se nota en la taberna (D5): su cama, hecha y vacía (la manta estirada por
 * encima de la almohada y su capa doblada a los pies, del color de su ropa), y una nota clavada en
 * el tablón del salón con quién falta (una raya de su color por cabeza, una fila por grupo; la de
 * los desaparecidos, gris y con un punto rojo). Lo que se lee al pasar por encima o al tocarlas
 * sale de `awayNote` y `bedNote`. Vale para encargos y expediciones (`SceneAway.why`).
 */
import { P, type Ramp } from '../../art/palette';
import type { PixelBuffer } from '../../art/pixel';
import { clothOf } from '../../art/heroes/hero';
import * as Prop from '../props';
import type { SceneAway } from '../scene';

/** Filas de la nota como mucho (no cabe más en el corcho) y rayas por fila. */
export const NOTE_ROWS = 3;
const NOTE_MARKS = 4;
/** Dónde va la nota en el tablón (`Prop.noticeBoard`, 38 × 28): abajo, entre los papeles. */
export const NOTE_AT = { x: 16, y: 11 } as const;

/** Un grupo de los de fuera: los que van juntos (o cada desaparecido por su cuenta). */
export interface AwayGroup {
  who: SceneAway[];
  lost: boolean;
}

/** Los de fuera por grupos: primero los que van de encargo o expedición, luego los perdidos. */
export function awayGroups(list: readonly SceneAway[]): AwayGroup[] {
  const out: AwayGroup[] = [];
  const byGroup = new Map<string, AwayGroup>();
  for (const a of list) {
    if (a.why === 'perdido' || !a.group) continue;
    let g = byGroup.get(a.group);
    if (!g) {
      g = { who: [], lost: false };
      byGroup.set(a.group, g);
      out.push(g);
    }
    g.who.push(a);
  }
  for (const a of list)
    if (a.why === 'perdido' || !a.group) out.push({ who: [a], lost: a.why === 'perdido' });
  return out;
}

/** «Ana», «Ana y Berto», «Ana, Berto y Carla». */
const names = (who: readonly SceneAway[]) => {
  const n = who.map((a) => a.name);
  return n.length < 2 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} y ${n.at(-1)}`;
};

const lostWord = (a: SceneAway) => (a.look.sex === 'f' ? 'desaparecida' : 'desaparecido');

/** Cuándo vuelven: «vuelve mañana», «vuelven en 3 días». */
function back(days: number | undefined, many: boolean): string {
  if (days === undefined) return '';
  if (days <= 0) return many ? 'vuelven hoy' : 'vuelve hoy';
  if (days === 1) return many ? 'vuelven mañana' : 'vuelve mañana';
  return `${many ? 'vuelven' : 'vuelve'} en ${days} días`;
}

/** A qué ha ido (el encargo o la expedición) y cuándo vuelve. */
function what(g: AwayGroup): string {
  const a = g.who[0]!;
  if (g.lost) return lostWord(a);
  const many = g.who.length > 1;
  const task = a.task ?? (a.why === 'expedicion' ? 'de expedición' : 'de encargo');
  const when = back(a.days, many);
  return when ? `${task} (${when})` : task;
}

/** Lo que dice la nota del tablón (para la etiqueta al pasar por encima o al tocarla). */
export function awayNote(list: readonly SceneAway[]): string {
  const lines = awayGroups(list).map((g) => `${names(g.who)}: ${what(g)}`);
  const shown = lines.slice(0, 5);
  if (lines.length > shown.length) shown.push(`y ${lines.length - shown.length} más`);
  return ['Fuera del gremio', ...shown].join('\n');
}

/** Lo que dice la cama hecha de alguien que está fuera. */
export function bedNote(a: SceneAway): string {
  const g: AwayGroup = { who: [a], lost: a.why === 'perdido' };
  const why = g.lost
    ? `${lostWord(a)[0]!.toUpperCase()}${lostWord(a).slice(1)}: la cama sigue hecha`
    : `${a.why === 'expedicion' ? 'De expedición' : 'De encargo'}: ${what(g)}`;
  return `Cama de ${a.name}\n${why}`;
}

/**
 * La cama hecha de quien está fuera, para pintar encima de su piso de la litera (del mismo
 * tamaño que la litera con su contorno, `tall` + 2 de alto; `top` es su fila como en `Bed.top`): la manta estirada
 * hasta tapar la almohada (de quien duerme o de una cama libre se ve la almohada blanca) y la capa
 * doblada a los pies, con su broche.
 */
export function madeBed(tall: number, top: number, quilt: Ramp, cloth: string, dark: string) {
  // La litera lleva contorno (un píxel más por cada lado): se dibuja corrida uno.
  const my = top + (tall - 40) + 1;
  const x = 1;
  return Prop.piece(
    24 + 2,
    tall + 2,
    (b) => {
      // La manta, de la cabecera a los pies, con el bulto de la almohada debajo (y su contorno
      // encima del de la almohada).
      b.hline(x + 3, my - 2, 6, quilt[0]!);
      b.set(x + 3, my - 1, quilt[0]!);
      b.rect(x + 3, my, 18, 6, quilt[2]!);
      b.hline(x + 4, my - 1, 5, quilt[2]!);
      b.hline(x + 5, my - 1, 3, quilt[3]!);
      b.hline(x + 3, my, 2, quilt[3]!);
      b.hline(x + 8, my, 13, quilt[3]!);
      b.hline(x + 3, my + 5, 18, quilt[1]!);
      b.vline(x + 3, my + 1, 4, quilt[1]!);
      // El doblez donde acaba la almohada.
      b.set(x + 9, my + 1, quilt[1]!);
      // La capa doblada a los pies, del color de su ropa, con el broche; con su contorno, que
      // se vea aunque sea del color de la manta.
      b.rect(x + 13, my - 4, 8, 4, P.black);
      b.rect(x + 14, my - 3, 6, 2, cloth);
      b.hline(x + 14, my - 1, 6, dark);
      b.vline(x + 19, my - 2, 2, dark);
      b.set(x + 15, my - 2, P.gold);
    },
    'none',
  );
}

/** Los colores de la capa de alguien (los de su ropa). */
export const cloakOf = (a: SceneAway) => clothOf(a.look);

/**
 * La nota del tablón: papel blanco con chincheta azul (las de los encargos son rojas), una raya
 * de título y una fila por grupo con una raya del color de cada uno; la de los desaparecidos, en
 * gris y con un punto rojo.
 */
export function awayPaper(groups: readonly AwayGroup[]): PixelBuffer {
  const rows = groups.slice(0, NOTE_ROWS);
  const w = 12;
  const h = 7 + 3 * rows.length;
  return Prop.piece(
    w,
    h,
    (b) => {
      b.rect(0, 1, w - 1, h - 1, P.white);
      b.vline(w - 1, 2, h - 2, P.mist);
      b.hline(1, h - 1, w - 1, P.mist);
      b.set(w - 2, h - 2, P.mist);
      b.set(0, h - 1, P.fog);
      // La chincheta.
      b.set(5, 0, P.sky);
      b.set(5, 1, P.ocean);
      // El título.
      b.hline(2, 3, 6, P.slate);
      rows.forEach((g, i) => {
        const y = 6 + 3 * i;
        g.who.slice(0, NOTE_MARKS).forEach((a, j) => {
          const c = g.lost ? P.fog : cloakOf(a).field;
          b.vline(2 + 2 * j, y, 2, c);
        });
        if (g.lost) b.set(w - 3, y, P.red);
        else if (g.who.length > NOTE_MARKS) b.set(w - 3, y + 1, P.slate);
      });
    },
    'none',
  );
}
