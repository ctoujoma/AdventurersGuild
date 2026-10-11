/**
 * Sonido 100 % sintetizado con WebAudio, sin archivos: ambiente nocturno (fuego, grillos,
 * viento), un laúd de cuerda pulsada (Karplus-Strong) tocando una melodía modal, y los
 * efectos de la interfaz y de cada cosa que se puede tocar en la taberna.
 */

export type Sfx =
  | 'click'
  | 'tab'
  | 'open'
  | 'close'
  | 'coin'
  | 'build'
  | 'purr'
  | 'hoot'
  | 'sparks'
  | 'lute'
  | 'splash'
  | 'creak'
  | 'squeak'
  | 'bats'
  | 'drip';

const STORAGE_KEY = 'jarro:sonido';
const FIRE = { x: 346, y: 272 };

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// Melodía en re dórico, compases de 6 corcheas. null = mantener.
const MELODY: (number | null)[] = [
  69,
  null,
  null,
  65,
  67,
  69,
  72,
  null,
  69,
  67,
  null,
  65,
  67,
  null,
  null,
  64,
  65,
  67,
  69,
  null,
  null,
  null,
  null,
  null,
  74,
  null,
  72,
  69,
  null,
  67,
  65,
  null,
  67,
  69,
  null,
  72,
  71,
  null,
  69,
  67,
  null,
  64,
  62,
  null,
  null,
  null,
  null,
  null,
];
const BASS: [number, number][] = [
  [50, 57],
  [53, 48],
  [48, 55],
  [45, 52],
  [50, 57],
  [53, 48],
  [43, 50],
  [50, 45],
];
const STEP = 0.29;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private fireGain!: GainNode;
  private crickets!: GainNode;
  private noise!: AudioBuffer;
  private strings = new Map<number, AudioBuffer>();
  private enabled = true;
  private musicStep = 0;
  private nextNote = 0;
  private timers: number[] = [];
  private listeners = new Set<(on: boolean) => void>();

  constructor() {
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
      this.enabled = true;
    }
  }

  get on(): boolean {
    return this.enabled;
  }

  subscribe(fn: (on: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Hay que llamarlo desde un gesto del usuario (los navegadores lo exigen). */
  unlock(): void {
    if (!this.enabled) return;
    if (!this.ctx) this.boot();
    else if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggle(): void {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(STORAGE_KEY, this.enabled ? 'on' : 'off');
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
    if (this.enabled) this.unlock();
    if (this.ctx)
      this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0, this.ctx.currentTime, 0.08);
    this.listeners.forEach((fn) => fn(this.enabled));
  }

  /** Ajusta el ambiente según dónde mira la cámara. */
  listen(p: { x: number; y: number }): void {
    if (!this.ctx) return;
    const d = Math.hypot(p.x - FIRE.x, (p.y - FIRE.y) * 1.4);
    const fire = Math.max(0.04, 1 - d / 200) * 0.55;
    this.fireGain.gain.setTargetAtTime(fire, this.ctx.currentTime, 0.3);
    const outside = p.x < 120 || p.x > 410 || p.y < 120 ? 1 : 0.35;
    this.crickets.gain.setTargetAtTime(0.05 * outside, this.ctx.currentTime, 0.5);
  }

  play(name: Sfx, volume = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime + 0.005;
    const v = volume;
    switch (name) {
      case 'click':
        this.tone('square', 760, 380, t, 0.045, 0.035 * v);
        break;
      case 'tab':
        this.tone('triangle', 620, 620, t, 0.05, 0.06 * v);
        this.tone('triangle', 930, 930, t + 0.055, 0.07, 0.06 * v);
        break;
      case 'open':
        this.rustle(t, 0.16, 0.09 * v);
        this.rustle(t + 0.09, 0.1, 0.05 * v);
        break;
      case 'close':
        this.rustle(t, 0.09, 0.05 * v);
        this.tone('triangle', 520, 360, t, 0.08, 0.04 * v);
        break;
      case 'coin':
        this.ping(1318, t, 0.35, 0.09 * v);
        this.ping(1760, t + 0.08, 0.5, 0.08 * v);
        break;
      case 'build':
        for (let i = 0; i < 3; i++) {
          this.thump(t + i * 0.2, 0.18 * v);
          this.ping(2200 + i * 120, t + i * 0.2, 0.08, 0.025 * v);
        }
        this.ping(1318, t + 0.7, 0.4, 0.07 * v);
        this.ping(1760, t + 0.78, 0.6, 0.07 * v);
        break;
      case 'purr':
        this.purr(t, 1.4, 0.22 * v);
        break;
      case 'hoot':
        this.hoot(t, 0.32, 0.12 * v);
        this.hoot(t + 0.5, 0.55, 0.12 * v);
        break;
      case 'sparks':
        for (let i = 0; i < 18; i++) this.crackle(t + Math.random() * 0.5, 0.25 * v);
        break;
      case 'lute':
        [62, 65, 69, 74].forEach((n, i) => this.pluck(n, t + i * 0.035, 0.35 * v));
        [74, 72, 69, 67, 69].forEach((n, i) => this.pluck(n, t + 0.45 + i * 0.22, 0.32 * v));
        break;
      case 'splash':
        this.splash(t, 0.14 * v);
        break;
      case 'creak':
        this.creak(t, 0.5, 0.05 * v);
        break;
      case 'squeak':
        this.tone('sine', 2600, 3300, t, 0.06, 0.04 * v);
        this.tone('sine', 2800, 3500, t + 0.1, 0.06, 0.04 * v);
        break;
      case 'bats':
        for (let i = 0; i < 12; i++) this.flap(t + i * 0.07, 0.06 * v);
        this.tone('sine', 5200, 6200, t + 0.1, 0.04, 0.02 * v);
        this.tone('sine', 5600, 6600, t + 0.4, 0.04, 0.02 * v);
        break;
      case 'drip':
        this.tone('sine', 1500, 600, t, 0.06, 0.02 * v);
        break;
    }
  }

  // ---------- Arranque y ambiente ----------

  private boot(): void {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = this.gain(1, this.master);
    this.musicBus = this.gain(0.55, this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // Fuego: rumor grave + chasquidos.
    this.fireGain = this.gain(0.3, this.master);
    const rumble = this.noiseSource(true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    rumble.connect(lp).connect(this.gain(0.35, this.fireGain));
    rumble.start();
    const crackleLoop = () => {
      if (!this.ctx) return;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++)
        this.crackle(this.ctx.currentTime + Math.random() * 0.15, 0.6, this.fireGain);
      this.timers.push(window.setTimeout(crackleLoop, 80 + Math.random() * 260));
    };
    crackleLoop();

    // Viento.
    const wind = this.noiseSource(true);
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 420;
    const wg = this.gain(0.025, this.master);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoAmt = this.gain(0.018);
    lfo.connect(lfoAmt).connect(wg.gain);
    lfo.start();
    wind.connect(wf).connect(wg);
    wind.start();

    // Grillos: dos osciladores con trinos programados.
    this.crickets = this.gain(0.02, this.master);
    for (const [freq, period] of [
      [4300, 0.9],
      [3900, 1.3],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      const g = this.gain(0, this.crickets);
      osc.connect(g);
      osc.start();
      const chirp = () => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + 0.05;
        for (let k = 0; k < 3; k++) {
          g.gain.setValueAtTime(0, t + k * 0.06);
          g.gain.linearRampToValueAtTime(0.5, t + k * 0.06 + 0.01);
          g.gain.linearRampToValueAtTime(0, t + k * 0.06 + 0.04);
        }
        this.timers.push(window.setTimeout(chirp, (period + Math.random() * 0.6) * 1000));
      };
      chirp();
    }

    // Música.
    this.nextNote = ctx.currentTime + 1.5;
    this.timers.push(window.setInterval(() => this.scheduleMusic(), 120));
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const loopLen = MELODY.length + 24; // un respiro entre vueltas
    while (this.nextNote < ctx.currentTime + 0.4) {
      const step = this.musicStep % loopLen;
      const t = this.nextNote;
      if (step < MELODY.length) {
        const n = MELODY[step];
        if (n) this.pluck(n, t, 0.28, this.musicBus);
        const bar = Math.floor(step / 6);
        const inBar = step % 6;
        const bass = BASS[bar % BASS.length]!;
        if (inBar === 0) this.pluck(bass[0], t, 0.32, this.musicBus);
        if (inBar === 3) this.pluck(bass[1], t, 0.2, this.musicBus);
        if (inBar === 0 && bar % 2 === 0)
          [bass[0] + 12, bass[0] + 15, bass[0] + 19].forEach((m, i) =>
            this.pluck(m, t + 0.02 + i * 0.03, 0.08, this.musicBus),
          );
      }
      this.musicStep++;
      this.nextNote += STEP * (step % 6 === 5 ? 1.08 : 1);
    }
  }

  // ---------- Instrumentos ----------

  private stringBuffer(note: number): AudioBuffer {
    let b = this.strings.get(note);
    if (b) return b;
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * (note < 55 ? 2.4 : 1.6));
    b = ctx.createBuffer(1, len, sr);
    const out = b.getChannelData(0);
    const period = Math.max(2, Math.round(sr / midi(note)));
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
    let prev = 0;
    for (let i = 0; i < len; i++) {
      const idx = i % period;
      const cur = ring[idx]!;
      const next = ring[(idx + 1) % period]!;
      const v = 0.996 * 0.5 * (cur + next);
      ring[idx] = v;
      // Paso bajo suave para un timbre de laúd.
      prev = prev * 0.35 + cur * 0.65;
      out[i] = prev;
    }
    this.strings.set(note, b);
    return b;
  }

  private pluck(note: number, t: number, vol: number, bus = this.sfxBus): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.stringBuffer(note);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + (note < 55 ? 2.2 : 1.5));
    src.connect(g).connect(bus);
    src.start(t);
  }

  // ---------- Bloques de sonido ----------

  private gain(value: number, to?: AudioNode): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = value;
    if (to) g.connect(to);
    return g;
  }

  private noiseSource(loop = false): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    t: number,
    dur: number,
    vol: number,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private ping(f: number, t: number, dur: number, vol: number): void {
    this.tone('sine', f, f, t, dur, vol);
  }

  private burst(
    t: number,
    dur: number,
    vol: number,
    type: BiquadFilterType,
    freq: number,
    q = 1,
    to: AudioNode = this.sfxBus,
  ): void {
    const ctx = this.ctx!;
    const s = this.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f).connect(g).connect(to);
    s.start(t, Math.random() * 1.5, dur + 0.02);
  }

  private crackle(t: number, vol: number, to: AudioNode = this.sfxBus): void {
    this.burst(
      t,
      0.012 + Math.random() * 0.03,
      vol * (0.3 + Math.random() * 0.7),
      'bandpass',
      1500 + Math.random() * 2500,
      0.9,
      to,
    );
  }

  private rustle(t: number, dur: number, vol: number): void {
    this.burst(t, dur, vol, 'highpass', 2200);
  }

  private thump(t: number, vol: number): void {
    this.burst(t, 0.12, vol, 'lowpass', 700);
    this.tone('sine', 180, 70, t, 0.12, vol * 0.8);
  }

  private purr(t: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const s = this.noiseSource(true);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 220;
    const am = ctx.createGain();
    am.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 24;
    const lfoAmt = this.gain(0.5);
    lfo.connect(lfoAmt).connect(am.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vol, t + 0.2);
    env.gain.setValueAtTime(vol, t + dur - 0.3);
    env.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f).connect(am).connect(env).connect(this.sfxBus);
    s.start(t);
    lfo.start(t);
    s.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  private hoot(t: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(430, t);
    o.frequency.linearRampToValueAtTime(380, t + dur);
    const vib = ctx.createOscillator();
    vib.frequency.value = 7;
    const vibAmt = this.gain(6);
    vib.connect(vibAmt).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.06);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
  }

  private splash(t: number, vol: number): void {
    const ctx = this.ctx!;
    const s = this.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(350, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.4);
    s.connect(f).connect(g).connect(this.sfxBus);
    s.start(t, 0, 0.45);
    this.tone('sine', 700, 160, t, 0.12, vol * 0.7);
  }

  private creak(t: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(150, t);
    o.frequency.linearRampToValueAtTime(110, t + dur);
    const wob = ctx.createOscillator();
    wob.frequency.value = 11;
    const wobAmt = this.gain(25);
    wob.connect(wobAmt).connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t);
    wob.start(t);
    o.stop(t + dur + 0.05);
    wob.stop(t + dur + 0.05);
  }

  private flap(t: number, vol: number): void {
    this.burst(t, 0.04, vol, 'lowpass', 700);
  }
}

export const audio = new AudioEngine();
