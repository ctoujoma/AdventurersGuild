import { describe, expect, it } from 'vitest';
import { PLAYLISTS, TUNES, noteOf, scaleStep } from './music';

describe('música', () => {
  it('lee los nombres de nota', () => {
    expect(noteOf('A4')).toBe(69);
    expect(noteOf('F#4')).toBe(66);
    expect(noteOf('Bb3')).toBe(58);
    expect(() => noteOf('H2')).toThrow();
  });

  it('cada tema tiene compases completos y un bajo por compás', () => {
    for (const t of Object.values(TUNES)) {
      expect(t.melody.length % 6, t.name).toBe(0);
      expect(t.bass.length, t.name).toBe(t.melody.length / 6);
      expect(t.melody[0], t.name).not.toBeNull();
      if (t.drum) expect(t.drum.length).toBe(6);
      // Todas las notas caen dentro de la escala del tema.
      for (const n of t.melody) if (n) expect(t.scale, `${t.name} ${n}`).toContain(n % 12);
    }
  });

  it('cada ambiente tiene algo que sonar y la taberna no repite siempre lo mismo', () => {
    for (const list of Object.values(PLAYLISTS)) expect(list.length).toBeGreaterThan(0);
    expect(PLAYLISTS.taberna.length).toBeGreaterThanOrEqual(3);
    expect(PLAYLISTS.libre.length).toBeGreaterThan(PLAYLISTS.taberna.length);
  });

  it('las terceras y adornos siguen la escala', () => {
    const dorian = [2, 4, 5, 7, 9, 11, 0];
    expect(scaleStep(69, dorian, -2)).toBe(65); // la → fa
    expect(scaleStep(62, dorian, 1)).toBe(64); // re → mi
  });
});
