import { describe, expect, it } from 'vitest';
import { generateLook } from '../../art/heroes/look';
import { rgba } from '../../art/pixel';
import { bunk } from './salas/camas';
import { bunkQuilt } from '../props';
import type { SceneAway } from '../scene';
import { awayGroups, awayNote, awayPaper, bedNote, cloakOf, madeBed } from './fuera';

const who = (id: string, o: Partial<SceneAway> = {}): SceneAway => ({
  id,
  name: id,
  look: generateLook(id, 'guerrero', 'f'),
  why: 'encargo',
  ...o,
});

describe('quien está fuera', () => {
  const list = [
    who('Ana', { group: 'm1', task: 'Lobos en el molino', days: 2 }),
    who('Berta', { group: 'm1', task: 'Lobos en el molino', days: 2 }),
    who('Carla', { why: 'perdido' }),
    who('Dora', { group: 'm2', task: 'La cripta', days: 1 }),
  ];

  it('se agrupan por grupo; los desaparecidos, cada uno en su fila, al final', () => {
    const g = awayGroups(list);
    expect(g.map((x) => x.who.map((a) => a.id))).toEqual([['Ana', 'Berta'], ['Dora'], ['Carla']]);
    expect(g.map((x) => x.lost)).toEqual([false, false, true]);
  });

  it('la nota dice quién, a qué y cuándo vuelven', () => {
    const text = awayNote(list);
    expect(text.split('\n')).toEqual([
      'Fuera del gremio',
      'Ana y Berta: Lobos en el molino (vuelven en 2 días)',
      'Dora: La cripta (vuelve mañana)',
      'Carla: desaparecida',
    ]);
    expect(bedNote(list[0]!)).toBe(
      'Cama de Ana\nDe encargo: Lobos en el molino (vuelve en 2 días)',
    );
    expect(bedNote(list[2]!)).toMatch(/Desaparecida: la cama sigue hecha/);
  });

  it('la cama hecha tapa la almohada y lleva la capa de su color', () => {
    const q = bunkQuilt(2);
    const top = 26;
    const made = madeBed(40, top, q, cloakOf(list[0]!).field, cloakOf(list[0]!).dark);
    const bed = bunk(2, 2, 'tropa');
    expect([made.w, made.h]).toEqual([bed.w, bed.h]);
    // Donde la litera tiene la almohada blanca, la cama hecha pone manta.
    expect(bed.get(6, top + 1)).not.toBe(made.get(6, top + 1));
    // La capa, encima de la manta, a los pies.
    const field = cloakOf(list[0]!).field;
    let capa = 0;
    for (let x = 15; x < 21; x++) if (made.get(x, top - 2) === rgba(field)) capa++;
    expect(capa).toBeGreaterThan(3);
  });

  it('la nota tiene una fila por grupo (tres como mucho)', () => {
    const one = awayPaper(awayGroups(list.slice(0, 1)));
    const many = awayPaper(awayGroups([...list, who('Eva'), who('Fina')]));
    expect(many.h - one.h).toBe(6);
  });
});
