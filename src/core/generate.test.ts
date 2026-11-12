import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../data/quests';
import { fill, generateQuest, homePower, pickStory } from './generate';
import { newGame } from './game';
import type { Quest } from './model';
import { Rng } from './rng';

describe('plantillas de texto', () => {
  it('rellena huecos, capitaliza y contrae «a el» y «de el»', () => {
    expect(fill('{Threat} bajó a {place}', { threat: 'un oso', place: 'el molino' })).toBe(
      'Un oso bajó al molino',
    );
    expect(fill('Lejos de {place}', { place: 'el vado' })).toBe('Lejos del vado');
    expect(fill('Rafael y {x}', {})).toBe('Rafael y {x}');
  });
});

describe('encargos', () => {
  const all = Object.values(TEMPLATES);
  const texts = all.flatMap((t) => [...t.titles, ...t.texts, ...(t.stories ?? []).flat()]);

  it('solo usan los huecos que el generador sabe rellenar', () => {
    for (const t of texts) {
      for (const [, key] of t.matchAll(/\{(\w+)\}/g))
        expect(['place', 'threat', 'Threat', 'client']).toContain(key);
    }
  });

  it('no repiten título ni texto dentro de un tipo', () => {
    for (const t of all) {
      const titles = [...t.titles, ...(t.stories ?? []).map((s) => s[0])];
      const bodies = [...t.texts, ...(t.stories ?? []).map((s) => s[1])];
      expect(new Set(titles).size).toBe(titles.length);
      expect(new Set(bodies).size).toBe(bodies.length);
    }
  });

  it('una historia concreta sale siempre con su propio texto', () => {
    const tpl = TEMPLATES.Recuperar;
    const rng = new Rng('historias');
    for (let i = 0; i < 200; i++) {
      const [title, text] = pickStory(rng, tpl);
      const story = tpl.stories!.find((s) => s[0] === title);
      if (story) expect(text).toBe(story[1]);
      else expect(tpl.texts).toContain(text);
    }
  });
});

describe('tablón a la medida de casa', () => {
  const per = (q: Quest) => q.challenges[0]!.diff / q.slots;
  const many = (rank: number, power?: number) =>
    Array.from({ length: 300 }, (_, i) =>
      generateQuest(new Rng(`medida-${i}`), `q${i}`, rank, `i${i}`, false, undefined, power),
    );

  it('con héroes flojos en Leyenda, el tablón se mide con ellos (el rango es el techo)', () => {
    const legend = many(4).map(per);
    const weak = many(4, 6).map(per);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(weak)).toBeLessThan(avg(legend) * 0.7);
    // Héroes más fuertes que el rango: no pasa del techo del rango.
    expect(avg(many(0, 20).map(per))).toBeLessThan(avg(many(0).map(per)) * 1.15);
  });

  it('trae de todo: fáciles, a su medida y difíciles (más peligrosos)', () => {
    const qs = many(3, 8);
    const easy = qs.filter((q) => per(q) < 8 * 0.85);
    const hard = qs.filter((q) => per(q) > 8 * 1.15);
    expect(easy.length).toBeGreaterThan(30);
    expect(hard.length).toBeGreaterThan(30);
    const danger = (xs: Quest[]) => xs.reduce((a, q) => a + q.danger, 0) / xs.length;
    expect(danger(hard)).toBeGreaterThan(danger(easy));
  });
});

describe('fuerza de casa', () => {
  it('media de las habilidades de los cuatro mejores, sin caídos', () => {
    const s = newGame('casa');
    const p = homePower(s.heroes)!;
    expect(p).toBeGreaterThan(3);
    expect(p).toBeLessThan(7);
    expect(homePower(s.heroes.map((h) => ({ ...h, status: 'muerto' as const })))).toBeUndefined();
  });
});
