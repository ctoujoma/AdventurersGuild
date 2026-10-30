import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/** Un contexto de audio de mentira: guarda cada nota que se programa y deja avanzar el reloj. */
class FakeParam {
  value = 0;
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
  setTargetAtTime() {}
  cancelScheduledValues() {}
}
class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  type = '';
  buffer: unknown = null;
  loop = false;
  connect<T>(n: T): T {
    return n;
  }
  start() {}
  stop() {}
}
class FakeContext {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new FakeNode();
  createGain = () => new FakeNode();
  createOscillator = () => new FakeNode();
  createBiquadFilter = () => new FakeNode();
  createBufferSource = () => new FakeNode();
  createDynamicsCompressor = () => new FakeNode();
  createBuffer = (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) });
  resume() {}
}

describe('motor de música', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    vi.stubGlobal('window', { AudioContext: FakeContext, setTimeout, setInterval });
    vi.stubGlobal('navigator', {});
  });
  afterAll(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('baraja los temas, cambia el arreglo y deja silencios entre ellos', async () => {
    const { audio } = await import('./audio');
    audio.unlock();
    const eng = audio as unknown as {
      ctx: FakeContext;
      cur: { id: string };
      arr: { tr: number; lead: string };
      restUntil: number;
      scheduleMusic(): void;
    };
    const tunes: string[] = [];
    const leads = new Set<string>();
    const keys = new Set<number>();
    let silent = 0;
    // Una hora de juego, a pasos de 120 ms (lo que hace el temporizador de verdad).
    for (let t = 0; t < 3600; t += 0.12) {
      eng.ctx.currentTime = t;
      eng.scheduleMusic();
      if (tunes.at(-1) !== eng.cur.id) tunes.push(eng.cur.id);
      leads.add(eng.arr.lead);
      keys.add(eng.arr.tr);
      if (eng.restUntil > t) silent += 0.12;
    }
    expect(new Set(tunes).size).toBeGreaterThanOrEqual(6);
    // Nunca el mismo tema dos veces seguidas.
    for (let i = 1; i < tunes.length; i++) expect(tunes[i]).not.toBe(tunes[i - 1]);
    expect(leads.size).toBeGreaterThanOrEqual(2);
    expect(keys.size).toBeGreaterThanOrEqual(2);
    // Hay ratos sin música (más de un minuto en una hora), pero no demasiados.
    expect(silent).toBeGreaterThan(60);
    expect(silent).toBeLessThan(600);
  });
});
