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
      expect(t.melody.length % (t.bar * t.parts), t.name).toBe(0);
      expect(t.bass.length, t.name).toBe(t.melody.length / t.bar);
      expect(t.melody[0], t.name).not.toBeNull();
      if (t.drum) expect(t.drum.length).toBe(t.bar);
      if (t.shaker) expect(t.shaker.length).toBe(t.bar);
      // Todas las notas caen dentro de la escala del tema.
      for (const n of t.melody) if (n) expect(t.scale, `${t.name} ${n}`).toContain(n % 12);
    }
  });

  it('cada ambiente tiene algo que sonar y la taberna no repite siempre lo mismo', () => {
    for (const list of Object.values(PLAYLISTS)) expect(list.length).toBeGreaterThan(0);
    expect(PLAYLISTS.taberna.length).toBeGreaterThanOrEqual(3);
    expect(PLAYLISTS.libre.length).toBeGreaterThan(PLAYLISTS.taberna.length);
    // Los de la taberna tienen dos partes (AABB): cada uno dura más de un minuto.
    for (const id of PLAYLISTS.taberna) {
      const t = TUNES[id];
      const secs = t.melody.length * (t.parts > 1 ? 2 : 1) * t.repeats * t.step;
      expect(secs, t.name).toBeGreaterThan(60);
    }
    // Para el atardecer hay temas tranquilos, y para el resto del día, alegres.
    expect(PLAYLISTS.taberna.filter((id) => TUNES[id].calm).length).toBeGreaterThanOrEqual(3);
    expect(PLAYLISTS.taberna.filter((id) => !TUNES[id].calm).length).toBeGreaterThanOrEqual(4);
  });

  it('las terceras y adornos siguen la escala', () => {
    const dorian = [2, 4, 5, 7, 9, 11, 0];
    expect(scaleStep(69, dorian, -2)).toBe(65); // la → fa
    expect(scaleStep(62, dorian, 1)).toBe(64); // re → mi
  });
});
