import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../data/quests';
import { fill, pickStory } from './generate';
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
