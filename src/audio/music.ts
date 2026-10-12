/**
 * Partituras de la taberna. Cada tema es una melodía en compases de 6 corcheas (aire de
 * giga), un bajo por compás y, si acaso, percusión. Se escriben con nombres de nota para
 * que se puedan leer y retocar: «.» alarga la nota anterior y «-» es silencio.
 */

export type Mood = 'taberna' | 'libre' | 'tension' | 'asalto' | 'fiesta';
export type Voice = 'laud' | 'flauta';

export interface Tune {
  name: string;
  /** Segundos por corchea. */
  step: number;
  melody: (number | null)[];
  /** Silencios explícitos (el «-»), para no confundirlos con «mantener». */
  rests: Set<number>;
  /** Fundamental y quinta de cada compás. */
  bass: [number, number][];
  /** Bajo continuo nota a nota (temas de tensión). */
  ostinato?: number[];
  /** Percusión por compás: X fuerte, x suave. */
  drum?: string;
  /** Sonajero por compás. */
  shaker?: string;
  /** Notas de la escala (0–11) para adornos y armonías. */
  scale: number[];
  voice: Voice;
  /** Corcheas de respiro al terminar. */
  breath: number;
  /** Veces que se repite (con variaciones) antes de pasar al siguiente. */
  repeats: number;
}

const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** «F#4» → 66. */
export function noteOf(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Nota no válida: ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]!]! + acc;
}

function parse(score: string): { melody: (number | null)[]; rests: Set<number> } {
  const melody: (number | null)[] = [];
  const rests = new Set<number>();
  for (const tok of score.replace(/\|/g, ' ').split(/\s+/).filter(Boolean)) {
    if (tok === '.') melody.push(null);
    else if (tok === '-') {
      rests.add(melody.length);
      melody.push(null);
    } else melody.push(noteOf(tok));
  }
  return { melody, rests };
}

const bassOf = (s: string): [number, number][] =>
  s
    .split('|')
    .map((b) => b.trim().split(/\s+/))
    .map(([a, b]) => [noteOf(a!), noteOf(b ?? a!)]);

const DORIAN_D = [2, 4, 5, 7, 9, 11, 0];
const MIXO_G = [7, 9, 11, 0, 2, 4, 5];
const AEOLIAN_A = [9, 11, 0, 2, 4, 5, 7];
const MIXO_D = [2, 4, 6, 7, 9, 11, 0];
const PHRYGIAN_D = [2, 3, 5, 7, 9, 10, 0];
const MAJOR_G = [7, 9, 11, 0, 2, 4, 6];

function tune(
  name: string,
  o: Omit<Tune, 'name' | 'melody' | 'rests' | 'bass' | 'ostinato'> & {
    score: string;
    bass: string;
    ostinato?: string;
  },
): Tune {
  const { score, bass, ostinato, ...rest } = o;
  return {
    name,
    ...parse(score),
    bass: bassOf(bass),
    ostinato: ostinato?.split(/\s+/).map(noteOf),
    ...rest,
  };
}

export const TUNES = {
  jarra: tune('La jarra rota', {
    step: 0.29,
    voice: 'laud',
    scale: DORIAN_D,
    breath: 24,
    repeats: 2,
    score: `A4 . . F4 G4 A4 | C5 . A4 G4 . F4 | G4 . . E4 F4 G4 | A4 . . . . . |
            D5 . C5 A4 . G4 | F4 . G4 A4 . C5 | B4 . A4 G4 . E4 | D4 . . . . .`,
    bass: 'D3 A3 | F3 C3 | C3 G3 | A2 E3 | D3 A3 | F3 C3 | G2 D3 | D3 A2',
  }),
  camino: tune('El camino real', {
    step: 0.25,
    voice: 'laud',
    scale: MIXO_G,
    breath: 18,
    repeats: 2,
    score: `G4 . B4 D5 . B4 | C5 . E5 D5 B4 G4 | A4 . B4 C5 . A4 | B4 G4 . D4 . . |
            G4 . B4 D5 . G5 | F5 . D5 C5 . A4 | B4 . G4 A4 . F4 | G4 . . - . . |
            D5 . . E5 . F5 | G5 . F5 E5 . D5 | C5 . . A4 . C5 | B4 . A4 G4 . . |
            D5 . E5 F5 . D5 | E5 . C5 A4 . C5 | B4 . G4 A4 . F4 | G4 . . . . -`,
    bass: `G2 D3 | C3 G2 | D3 A2 | G2 D3 | G2 D3 | F2 C3 | D3 A2 | G2 D3 |
           D3 A2 | G2 D3 | F2 C3 | G2 D3 | D3 A2 | C3 G2 | D3 A2 | G2 G2`,
  }),
  velas: tune('Velas en la bodega', {
    step: 0.36,
    voice: 'flauta',
    scale: AEOLIAN_A,
    breath: 18,
    repeats: 2,
    score: `E5 . . D5 C5 . | B4 . . A4 . . | C5 . D5 E5 . . | A4 . . . . . |
            G4 . A4 B4 . . | C5 . B4 A4 . G4 | E4 . . G4 . A4 | A4 . . . . -`,
    bass: 'A2 E3 | E2 B2 | A2 E3 | A2 E3 | G2 D3 | F2 C3 | E2 B2 | A2 A2',
  }),
  leyenda: tune('Gremio de leyenda', {
    step: 0.27,
    voice: 'laud',
    scale: MIXO_D,
    breath: 18,
    repeats: 2,
    score: `D5 . . A4 . D5 | F#5 . E5 D5 . A4 | B4 . D5 A4 . F#4 | E4 . F#4 A4 . . |
            D5 . . A4 . D5 | F#5 . A5 G5 . F#5 | E5 . C5 D5 . E5 | D5 . . . . -`,
    bass: 'D3 A3 | D3 A2 | G2 D3 | A2 E3 | D3 A3 | D3 A2 | C3 G3 | D3 D3',
  }),
  antorchas: tune('Antorchas en el camino', {
    step: 0.3,
    voice: 'flauta',
    scale: PHRYGIAN_D,
    breath: 6,
    repeats: 3,
    drum: 'X..x..',
    ostinato: 'D3 A3 Bb3 A3 D3 A3',
    score: `D5 . . . . . | Eb5 . D5 C5 . . | D5 . . - . . | A4 . Bb4 A4 G4 . |
            F4 . . G4 . A4 | Bb4 . A4 G4 . F4 | Eb4 . F4 Eb4 . D4 | D4 . . - . .`,
    bass: 'D2 A2 | Eb2 Bb2 | D2 A2 | D2 A2 | F2 C3 | G2 D3 | Eb2 Bb2 | D2 D2',
  }),
  armas: tune('¡A las armas!', {
    step: 0.19,
    voice: 'laud',
    scale: PHRYGIAN_D,
    breath: 0,
    repeats: 99,
    drum: 'X.xX.x',
    shaker: '.x.x.x',
    ostinato: 'D2 D3 A2 D3 Bb2 D3',
    score: `D5 . A4 D5 . F5 | Eb5 . D5 C5 . A4 | Bb4 . A4 G4 . A4 | D4 . . D4 Eb4 F4 |
            G4 . A4 Bb4 . C5 | D5 . C5 Bb4 . A4 | G4 . F4 Eb4 . Eb4 | D4 . . - . -`,
    bass: 'D2 A2 | Eb2 Bb2 | G2 D3 | D2 A2 | G2 D3 | Bb2 F3 | Eb2 Bb2 | D2 D2',
  }),
  brindis: tune('¡Brindis!', {
    step: 0.17,
    voice: 'laud',
    scale: MAJOR_G,
    breath: 4,
    repeats: 1,
    drum: 'X..x..',
    shaker: '.x.x.x',
    score: `D5 B4 G4 D5 B4 G4 | E5 C5 A4 E5 C5 A4 | D5 B4 G4 B4 D5 G5 | F#5 . D5 E5 . F#5 |
            G5 . D5 B4 . G4 | C5 . E5 D5 . B4 | A4 B4 C5 D5 E5 F#5 | G5 . . G4 . -`,
    bass: 'G2 D3 | C3 G3 | G2 D3 | D3 A2 | G2 D3 | C3 G2 | D3 A2 | G2 G2',
  }),
} satisfies Record<string, Tune>;

export type TuneId = keyof typeof TUNES;

/** Qué suena en cada ambiente, en orden. */
export const PLAYLISTS: Record<Mood, TuneId[]> = {
  taberna: ['jarra', 'camino', 'velas'],
  libre: ['leyenda', 'camino', 'jarra', 'velas'],
  tension: ['antorchas'],
  asalto: ['armas'],
  fiesta: ['brindis'],
};

/** Nota de la escala a `steps` grados de distancia (para adornos y terceras). */
export function scaleStep(note: number, scale: number[], steps: number): number {
  let n = note;
  let left = Math.abs(steps);
  const dir = Math.sign(steps);
  while (left > 0) {
    n += dir;
    if (scale.includes(((n % 12) + 12) % 12)) left--;
  }
  return n;
}
