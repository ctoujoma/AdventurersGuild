/**
 * Sonido 100 % sintetizado con WebAudio, sin archivos: ambiente nocturno (fuego, grillos,
 * viento), un laúd de cuerda pulsada (Karplus-Strong) tocando una melodía modal, y los
 * efectos de la interfaz y de cada cosa que se puede tocar en la taberna.
 */

export type Sfx =
  | 'click'
  | 'bell'
  | 'tab'
  | 'open'
  | 'close'
  | 'coin'
  | 'build'
  | 'hammer'
  | 'purr'
  | 'bark'
  | 'caw'
  | 'hoot'
  | 'sparks'
  | 'lute'
  | 'splash'
  | 'creak'
  | 'squeak'
  | 'bats'
  | 'drip'
  | 'select'
  | 'deselect'
  | 'depart'
  | 'dawn'
  | 'night'
  | 'cheer'
  | 'impact'
  | 'hit'
  | 'horn'
  | 'swing'
  | 'thud'
  | 'zap'
  | 'boom'
  | 'arrow'
  | 'holy'
  | 'thunder'
  | 'roar'
  | 'whoosh';

import { haptic } from '../platform/haptics';
import {
  PLAYLISTS,
  TUNES,
  scaleStep,
  type Mood,
  type Tune,
  type TuneId,
  type Voice,
} from './music';

export type { Mood } from './music';

const STORAGE_KEY = 'jarro:sonido';
const MUSIC_LEVEL = 0.55;
const FIRE = { x: 346, y: 272 };

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private ambientBus!: GainNode;
  /** Volúmenes elegidos en Ajustes (0–1). */
  private levels = { music: 1, sfx: 1, ambient: 1 };
  private fireGain!: GainNode;
  private crickets!: GainNode;
  private noise!: AudioBuffer;
  private strings = new Map<number, AudioBuffer>();
  private enabled = true;
  private nextNote = 0;
  private mood: Mood = 'taberna';
  /** Tras la fiesta, a qué ambiente se vuelve. */
  private returnTo: Mood = 'taberna';
  private cur: { id: TuneId; rep: number } = { id: 'jarra', rep: 0 };
  /** Lo último que ha sonado (para no repetirlo enseguida). */
  private played: TuneId[] = [];
  /**
   * Cómo se toca esta vez el tema: subido o bajado de tono, algo más rápido o más lento y con
   * otro instrumento al frente. Así el mismo tema no suena siempre igual.
   */
  private arr: { tr: number; tempo: number; lead: Voice } = { tr: 0, tempo: 1, lead: 'laud' };
  /** Hora del día (0 mañana – 1 noche): al atardecer, temas más tranquilos. */
  private hour = 0;
  /** Silencio entre temas: hasta cuándo solo se oye el ambiente. */
  private restUntil = 0;
  private musicStep = 0;
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

  /** Volúmenes de música, efectos y ambiente (0–1). */
  setLevels(l: { music: number; sfx: number; ambient: number }): void {
    this.levels = { ...l };
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicLevel(), now, 0.05);
    this.sfxBus.gain.setTargetAtTime(l.sfx, now, 0.05);
    this.ambientBus.gain.setTargetAtTime(l.ambient, now, 0.05);
  }

  private musicLevel(): number {
    return MUSIC_LEVEL * this.levels.music;
  }

  /** Cambia la música al ambiente pedido, con un fundido corto. */
  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    // La fiesta suena entera; lo que pidan mientras tanto queda para después.
    if (this.mood === 'fiesta' && mood !== 'fiesta') {
      this.returnTo = mood;
      return;
    }
    if (mood === 'fiesta') this.returnTo = this.mood;
    this.switchMood(mood);
  }

  /** La hora del día (0 mañana – 1 noche): elige temas tranquilos al atardecer. */
  setHour(part: number): void {
    this.hour = part;
  }

  private switchMood(mood: Mood): void {
    this.mood = mood;
    this.restUntil = 0;
    this.start(this.pick(mood));
    this.musicStep = 0;
    const ctx = this.ctx;
    if (!ctx) return;
    // Fundido: baja, deja un respiro y entra el tema nuevo.
    const now = ctx.currentTime;
    const gap = mood === 'asalto' || mood === 'fiesta' ? 0.25 : 0.7;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setTargetAtTime(0, now, 0.12);
    this.musicBus.gain.setTargetAtTime(this.musicLevel(), now + gap, 0.25);
    this.nextNote = now + gap;
  }

  /** Una tonada de celebración y luego vuelve lo que sonaba. */
  fanfare(): void {
    this.setMood('fiesta');
  }

  play(name: Sfx, volume = 1): void {
    haptic(name);
    // Cada vez, un pelo más agudo o más grave: lo que se repite (monedas, clics) no cansa.
    this.detune = 1 + (Math.random() - 0.5) * 0.08;
    try {
      this.sfx(name, volume);
    } finally {
      this.detune = 1;
    }
  }

  /** Cuánto se afinan arriba o abajo los efectos que suenan ahora (ver `play`). */
  private detune = 1;

  private sfx(name: Sfx, volume: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime + 0.005;
    const v = volume;
    switch (name) {
      case 'click':
        this.tone('square', 760, 380, t, 0.045, 0.035 * v);
        break;
      case 'bell':
        // Campanilla de aviso: dos golpes, el segundo más agudo, con su eco.
        this.ping(1568, t, 0.5, 0.07 * v);
        this.ping(2349, t, 0.35, 0.025 * v);
        this.ping(2093, t + 0.13, 0.7, 0.07 * v);
        this.ping(3136, t + 0.13, 0.4, 0.02 * v);
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
      case 'hammer':
        this.thump(t, 0.14 * v);
        this.ping(2000 + Math.random() * 500, t, 0.07, 0.03 * v);
        break;
      case 'purr':
        this.purr(t, 1.4, 0.22 * v);
        break;
      case 'caw':
        // «¡Cra, cra!»: al compás del pico del cuervo en la escena.
        this.kraa(t, 0.08 * v);
        this.kraa(t + 0.5, 0.07 * v);
        break;
      case 'bark':
        // Dos ladridos, al compás de la boca del perro en la escena.
        this.woof(t, 0.1 * v);
        this.woof(t + 0.8, 0.09 * v);
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
      case 'select':
        this.pluck(74, t, 0.24 * v);
        this.pluck(81, t + 0.06, 0.16 * v);
        break;
      case 'deselect':
        this.pluck(69, t, 0.18 * v);
        break;
      case 'dawn':
        // Amanece: acorde de laúd que sube y unos pájaros.
        [50, 57, 62, 66, 69].forEach((n, i) => this.pluck(n, t + i * 0.09, 0.26 * v));
        for (let i = 0; i < 5; i++) {
          const at = t + 0.7 + i * 0.16 + (i > 2 ? 0.3 : 0);
          this.tone('sine', 3400 + (i % 2) * 500, 4300 + (i % 3) * 300, at, 0.07, 0.025 * v);
        }
        break;
      case 'hit':
        // Choque de acero: un golpe seco y un tintineo metálico.
        this.thump(t, 0.12 * v);
        this.ping(1800 + Math.random() * 900, t, 0.09, 0.05 * v);
        this.crackle(t, 0.12 * v);
        break;
      case 'swing':
        // Silbido del acero cortando el aire.
        this.burst(t, 0.18, 0.08 * v, 'bandpass', 2400, 3);
        this.tone('sine', 900, 300, t, 0.16, 0.02 * v);
        break;
      case 'whoosh':
        this.burst(t, 0.22, 0.07 * v, 'bandpass', 900, 1.5);
        break;
      case 'thud':
        // Golpe sordo: escudo, garrote, maza.
        this.thump(t, 0.25 * v);
        this.tone('sine', 120, 50, t, 0.18, 0.12 * v);
        this.crackle(t + 0.01, 0.1 * v);
        break;
      case 'zap':
        // Magia: barrido agudo con brillo.
        this.tone('square', 1800, 500, t, 0.14, 0.025 * v);
        this.tone('sine', 2600, 3400, t, 0.12, 0.03 * v);
        break;
      case 'boom':
        // Explosión de fuego.
        this.burst(t, 0.45, 0.22 * v, 'lowpass', 900);
        this.tone('sine', 160, 40, t, 0.35, 0.18 * v);
        for (let i = 0; i < 6; i++) this.crackle(t + 0.05 + Math.random() * 0.3, 0.2 * v);
        break;
      case 'arrow':
        this.tone('triangle', 1200, 1900, t, 0.05, 0.03 * v);
        this.burst(t + 0.02, 0.12, 0.04 * v, 'highpass', 3000);
        break;
      case 'holy':
        // Luz sagrada: acorde brillante de campanillas.
        [76, 81, 88].forEach((n, i) => this.ping(midi(n), t + i * 0.05, 0.6, 0.035 * v));
        break;
      case 'thunder':
        this.burst(t, 0.08, 0.3 * v, 'highpass', 1800);
        this.burst(t + 0.04, 0.9, 0.2 * v, 'lowpass', 300);
        this.tone('sine', 90, 30, t, 0.7, 0.14 * v);
        break;
      case 'roar':
        // Grito del jefe.
        this.tone('sawtooth', 110, 80, t, 0.5, 0.06 * v);
        this.tone('sawtooth', 165, 120, t, 0.5, 0.04 * v);
        this.burst(t, 0.45, 0.05 * v, 'bandpass', 500, 1);
        break;
      case 'horn':
        // Cuerno de alarma: ¡asalto!
        this.tone('sawtooth', 147, 165, t, 0.55, 0.07 * v);
        this.tone('sawtooth', 147, 196, t + 0.6, 0.8, 0.08 * v);
        this.tone('sine', 294, 392, t + 0.6, 0.8, 0.04 * v);
        break;
      case 'impact':
        // El rótulo del título cae: golpe grave, crujido de madera y polvo.
        this.thump(t, 0.6 * v);
        this.tone('sine', 140, 38, t, 0.4, 0.35 * v);
        for (let i = 0; i < 10; i++) this.crackle(t + Math.random() * 0.25, 0.3 * v);
        this.pluck(38, t + 0.05, 0.25 * v);
        break;
      case 'night':
        // Cae la noche: dos notas graves y el búho a lo lejos.
        [45, 40].forEach((n, i) => this.pluck(n, t + i * 0.35, 0.22 * v));
        this.hoot(t + 0.6, 0.4, 0.07 * v);
        this.hoot(t + 1.1, 0.6, 0.07 * v);
        break;
      case 'cheer':
        // Brindis en la barra: jarras que chocan y una tonada alegre.
        for (let i = 0; i < 4; i++) this.ping(2600 + i * 180, t + i * 0.06, 0.12, 0.04 * v);
        [62, 66, 69, 74, 69, 74, 78].forEach((n, i) => this.pluck(n, t + 0.25 + i * 0.12, 0.3 * v));
        this.thump(t + 0.25, 0.1 * v);
        this.thump(t + 0.61, 0.1 * v);
        break;
      case 'depart':
        // Pequeña fanfarria de laúd: el grupo sale a la aventura.
        [50, 57, 62].forEach((n, i) => this.pluck(n, t + i * 0.02, 0.3 * v));
        [69, 74].forEach((n, i) => this.pluck(n, t + 0.18 + i * 0.16, 0.34 * v));
        [74, 78, 81, 86].forEach((n, i) => this.pluck(n, t + 0.52 + i * 0.03, 0.28 * v));
        this.thump(t + 0.52, 0.08 * v);
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
    this.sfxBus = this.gain(this.levels.sfx, this.master);
    this.musicBus = this.gain(this.musicLevel(), this.master);
    this.ambientBus = this.gain(this.levels.ambient, this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // Fuego: rumor grave + chasquidos.
    this.fireGain = this.gain(0.3, this.ambientBus);
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
    const wg = this.gain(0.025, this.ambientBus);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoAmt = this.gain(0.018);
    lfo.connect(lfoAmt).connect(wg.gain);
    lfo.start();
    wind.connect(wf).connect(wg);
    wind.start();

    // Grillos: dos osciladores con trinos programados.
    this.crickets = this.gain(0.02, this.ambientBus);
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
    // Un rato sin música entre tema y tema: solo el fuego, el viento y los grillos.
    if (this.restUntil > ctx.currentTime) {
      this.nextNote = Math.max(this.nextNote, this.restUntil);
      return;
    }
    while (this.nextNote < ctx.currentTime + 0.4) {
      const tune: Tune = TUNES[this.cur.id];
      // Con partes (A, B…), cada una suena dos veces seguidas: una vuelta es AABB.
      const part = tune.melody.length / tune.parts;
      const len = tune.parts > 1 ? tune.melody.length * 2 : tune.melody.length;
      const s = this.musicStep;
      const t = this.nextNote;
      const block = Math.floor(s / part);
      const idx = tune.parts > 1 ? Math.floor(block / 2) * part + (s % part) : s;
      // La segunda vez de cada parte ya va con adornos (cuenta como otra vuelta).
      const rep = tune.parts > 1 ? this.cur.rep * 2 + (block % 2) : this.cur.rep;
      if (s < len) this.playStep(tune, idx, t, rep);
      this.musicStep++;
      const step = tune.step / this.arr.tempo;
      this.nextNote += step * (idx % tune.bar === tune.bar - 1 ? 1.06 : 1);
      if (this.musicStep >= len + tune.breath) {
        this.musicStep = 0;
        this.cur.rep++;
        if (this.cur.rep >= tune.repeats) {
          this.nextTune();
          if (this.restUntil > ctx.currentTime) return;
        }
      }
    }
  }

  private nextTune(): void {
    if (this.mood === 'fiesta') {
      this.switchMood(this.returnTo);
      return;
    }
    // En la taberna, a veces se calla un rato antes del siguiente.
    const quiet = this.mood === 'taberna' || this.mood === 'libre';
    if (quiet && this.ctx && Math.random() < 0.35)
      this.restUntil = this.nextNote + 8 + Math.random() * 14;
    this.start(this.pick(this.mood));
  }

  /**
   * El siguiente tema del ambiente: al azar, sin repetir los dos últimos y, al atardecer, mejor
   * uno tranquilo (y uno alegre por la mañana).
   */
  private pick(mood: Mood): TuneId {
    const list = PLAYLISTS[mood];
    if (list.length === 1) return list[0]!;
    const fresh = list.filter((id) => !this.played.slice(-2).includes(id));
    const pool = fresh.length ? fresh : list;
    const evening = this.hour > 0.62;
    const weight = (id: TuneId) => (!!TUNES[id].calm === evening ? 3 : 1);
    let r = Math.random() * pool.reduce((a, id) => a + weight(id), 0);
    for (const id of pool) {
      r -= weight(id);
      if (r <= 0) return id;
    }
    return pool[0]!;
  }

  /** Empieza un tema con un arreglo nuevo. */
  private start(id: TuneId): void {
    const tune = TUNES[id];
    this.cur = { id, rep: 0 };
    this.played = [...this.played.slice(-3), id];
    const urgent = this.mood === 'asalto' || this.mood === 'tension' || this.mood === 'fiesta';
    const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]!;
    // La mitad de las veces, con su instrumento; si no, otro al frente.
    const others: Voice[] = (['laud', 'flauta', 'violin'] as Voice[]).filter(
      (v) => v !== tune.voice,
    );
    this.arr = urgent
      ? { tr: 0, tempo: 1, lead: tune.voice }
      : {
          tr: pick([0, 0, 0, -2, 2, -3]),
          tempo: 0.94 + Math.random() * 0.12,
          lead: Math.random() < 0.5 ? tune.voice : pick(others),
        };
  }

  /** Corcheas que dura la nota en `s` (hasta la siguiente nota o silencio). */
  private hold(tune: Tune, s: number): number {
    let n = 1;
    while (s + n < tune.melody.length && tune.melody[s + n] === null && !tune.rests.has(s + n)) n++;
    return n;
  }

  /**
   * Una corchea del tema. La primera vuelta suena tal cual; las siguientes varían: adornos,
   * notas de paso, el bajo arpegiado, una segunda voz en terceras o otro instrumento doblando.
   * Todo va subido o bajado de tono según el arreglo de esta vez (`arr.tr`).
   */
  private playStep(tune: Tune, s: number, t: number, rep: number): void {
    const bus = this.musicBus;
    const bar = Math.floor(s / tune.bar);
    const inBar = s % tune.bar;
    const n = tune.melody[s];
    const vary = rep > 0;
    const tr = this.arr.tr;
    const lead = this.arr.lead;
    const step = tune.step / this.arr.tempo;
    if (n) {
      const len = this.hold(tune, s);
      const dur = len * step;
      this.voice(lead, n + tr, t, dur, 1);
      if (vary && len >= 2 && Math.random() < 0.35) {
        // Adorno: una nota de gracia por encima justo antes.
        const g = scaleStep(n, tune.scale, 1) + tr;
        if (lead === 'laud') this.pluck(g, t - 0.05, 0.12, bus);
        else this.voice(lead, g, t - 0.06, 0.06, 0.55);
      }
      if (rep % 2 === 1 && len >= 2) {
        // Segunda vuelta: otro instrumento dobla las notas largas.
        if (lead === 'laud') this.flute(n + tr + 12, t, dur * 0.9, 0.025);
        else this.pluck(scaleStep(n, tune.scale, -2) + tr, t, 0.12, bus);
      }
      if (rep >= 2) this.pluck(scaleStep(n, tune.scale, -2) + tr, t + 0.01, 0.12, bus);
    } else if (vary && !tune.rests.has(s) && Math.random() < 0.2) {
      // Nota de paso entre dos notas.
      const prev = tune.melody[s - 1];
      const next = tune.melody[s + 1];
      if (prev && next && Math.abs(next - prev) >= 3)
        this.pluck(scaleStep(prev, tune.scale, Math.sign(next - prev)) + tr, t, 0.14, bus);
    }

    const bass = tune.bass[bar % tune.bass.length]!;
    const half = Math.floor(tune.bar / 2);
    if (tune.drone && inBar === 0) this.drone(bass[0] + tr, t, tune.bar * step);
    if (tune.ostinato) this.pluck(tune.ostinato[inBar % tune.ostinato.length]! + tr, t, 0.13, bus);
    else if (rep % 2 === 1) {
      // Bajo arpegiado.
      if (inBar === 0) this.pluck(bass[0] + tr, t, 0.3, bus);
      if (inBar === 2) this.pluck(bass[1] + tr, t, 0.16, bus);
      if (inBar === 4) this.pluck(bass[0] + tr + 12, t, 0.14, bus);
      if (inBar === 6) this.pluck(bass[1] + tr, t, 0.12, bus);
    } else {
      if (inBar === 0) this.pluck(bass[0] + tr, t, 0.32, bus);
      if (inBar === half) this.pluck(bass[1] + tr, t, 0.2, bus);
    }
    if (inBar === 0 && bar % 2 === 0 && !tune.ostinato && lead === 'laud')
      [bass[0] + 12, bass[0] + 15, bass[0] + 19].forEach((m, i) =>
        this.pluck(m + tr, t + 0.02 + i * 0.03, 0.08, bus),
      );
    const d = tune.drum?.[inBar];
    if (d === 'X') this.drum(t, 0.16);
    else if (d === 'x') this.drum(t, 0.08);
    if (tune.shaker?.[inBar] === 'x') this.shaker(t, 0.03);
  }

  /** Una nota del instrumento que lleva la melodía (`k`: algo más suave para los adornos). */
  private voice(v: Voice, note: number, t: number, dur: number, k: number): void {
    if (v === 'flauta') this.flute(note, t, dur, 0.06 * k);
    else if (v === 'violin') this.fiddle(note, t, dur, 0.05 * k);
    else this.pluck(note, t, 0.28 * k, this.musicBus);
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

  /** Flauta de madera: seno con vibrato que entra tarde y un soplo al principio. */
  private flute(note: number, t: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const f = midi(note);
    const o = ctx.createOscillator();
    o.frequency.value = f;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vibAmt = ctx.createGain();
    vibAmt.gain.setValueAtTime(0, t);
    vibAmt.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.35, dur));
    vib.connect(vibAmt).connect(o.frequency);
    const g = ctx.createGain();
    const end = t + Math.max(0.08, dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.setValueAtTime(vol * 0.85, end - 0.04);
    g.gain.exponentialRampToValueAtTime(0.0005, end + 0.12);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    vib.start(t);
    o.stop(end + 0.15);
    vib.stop(end + 0.15);
    this.burst(t, 0.06, vol * 0.4, 'bandpass', f * 2, 2, this.musicBus);
  }

  /** Violín: sierra suavizada, con el arco que entra despacio y vibrato al sostener. */
  private fiddle(note: number, t: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const f = midi(note);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.6;
    const vibAmt = ctx.createGain();
    vibAmt.gain.setValueAtTime(0, t);
    vibAmt.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.3, dur));
    vib.connect(vibAmt).connect(o.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(3200, f * 4);
    lp.Q.value = 0.7;
    const g = ctx.createGain();
    const end = t + Math.max(0.1, dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.07);
    g.gain.setValueAtTime(vol * 0.9, end - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0005, end + 0.15);
    o.connect(lp).connect(g).connect(this.musicBus);
    o.start(t);
    vib.start(t);
    o.stop(end + 0.2);
    vib.stop(end + 0.2);
  }

  /** Bordón de zanfona: la nota del bajo y su quinta, sostenidas todo el compás, muy bajas. */
  private drone(note: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.018, t + 0.25);
    g.gain.setValueAtTime(0.018, t + dur - 0.2);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.1);
    lp.connect(g).connect(this.musicBus);
    for (const m of [note, note + 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(m);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.15);
    }
  }

  /** Pandero: golpe grave y un poco de parche. */
  private drum(t: number, vol: number): void {
    this.burst(t, 0.1, vol, 'lowpass', 500, 1, this.musicBus);
    this.tone('sine', 150, 60, t, 0.14, vol * 0.9, this.musicBus);
  }

  private shaker(t: number, vol: number): void {
    this.burst(t, 0.05, vol, 'highpass', 5000, 1, this.musicBus);
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
    to: AudioNode = this.sfxBus,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    const k = this.detune;
    o.frequency.setValueAtTime(f0 * k, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * k), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(to);
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
    f.frequency.value = freq * this.detune;
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

  /** Un graznido: un tono ronco y nasal que baja un poco, con aire. */
  private kraa(t: number, vol: number): void {
    const f = this.ctx!.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1300;
    f.Q.value = 2;
    f.connect(this.sfxBus);
    this.tone('sawtooth', 820, 640, t, 0.22, vol, f);
    this.tone('square', 410, 330, t, 0.2, vol * 0.6, f);
    this.burst(t, 0.18, vol * 0.5, 'bandpass', 1800, 2);
  }

  /** Un ladrido: un tono áspero que cae, apagado, con un golpe de aire al principio. */
  private woof(t: number, vol: number): void {
    const f = this.ctx!.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1100;
    f.connect(this.sfxBus);
    this.tone('sawtooth', 560, 240, t, 0.16, vol, f);
    this.tone('square', 280, 150, t, 0.13, vol * 0.5, f);
    this.burst(t, 0.05, vol * 0.8, 'bandpass', 900, 1.2);
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
