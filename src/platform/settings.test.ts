import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

describe('ajustes', () => {
  it('rellena lo que falta y corrige lo que viene mal', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ music: 0.4, speed: 2, bigText: true })).toEqual({
      ...DEFAULT_SETTINGS,
      music: 0.4,
      speed: 2,
      bigText: true,
    });
    const bad = parseSettings({ music: 7, sfx: -1, ambient: 'x', speed: 3, calm: 'sí' });
    expect(bad).toEqual({ ...DEFAULT_SETTINGS, music: 1, sfx: 0 });
  });

  it('la vibración viene puesta y solo se quita a propósito', () => {
    expect(parseSettings({}).vibrate).toBe(true);
    expect(parseSettings({ vibrate: 'no' }).vibrate).toBe(true);
    expect(parseSettings({ vibrate: false }).vibrate).toBe(false);
  });
});
