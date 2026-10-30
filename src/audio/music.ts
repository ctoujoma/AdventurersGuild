/**
 * Partituras de la taberna. Cada tema es una melodía en compases de 6 corcheas (aire de
 * giga) o de 8 (reel, marcha), un bajo por compás y, si acaso, percusión. Se escriben con
 * nombres de nota para que se puedan leer y retocar: «.» alarga la nota anterior y «-» es
 * silencio. El motor (audio.ts) los baraja y cambia el arreglo cada vez que suena uno.
 */

export type Mood = 'taberna' | 'libre' | 'tension' | 'asalto' | 'fiesta';
export type Voice = 'laud' | 'flauta' | 'violin';

export interface Tune {
  name: string;
  /** Segundos por corchea. */
  step: number;
  /** Corcheas por compás (6 si no se dice). */
  bar: number;
  /** Tema tranquilo: suena más al atardecer. */
  calm?: boolean;
  /** Con bordón (la nota del bajo sostenida, como una zanfona). */
  drone?: boolean;
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

const DORIAN_A = [9, 11, 0, 2, 4, 6, 7];
const MAJOR_D = [2, 4, 6, 7, 9, 11, 1];
const AEOLIAN_E = [4, 6, 7, 9, 11, 0, 2];
const MAJOR_F = [5, 7, 9, 10, 0, 2, 4];

function tune(
  name: string,
  o: Omit<Tune, 'name' | 'melody' | 'rests' | 'bass' | 'ostinato' | 'bar'> & {
    score: string;
    bass: string;
    ostinato?: string;
    bar?: number;
  },
): Tune {
  const { score, bass, ostinato, bar, ...rest } = o;
  return {
    name,
    bar: bar ?? 6,
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
    calm: true,
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
  molino: tune('El molino de la ribera', {
    step: 0.2,
    bar: 8,
    voice: 'laud',
    scale: DORIAN_A,
    breath: 8,
    repeats: 2,
    drum: 'X...x...',
    score: `A4 . E4 A4 B4 . C5 D5 | E5 . A5 . G5 E5 D5 B4 | C5 . B4 A4 G4 . E4 G4 | A4 B4 C5 A4 B4 . G4 . |
            A4 . E4 A4 B4 . C5 D5 | E5 . F#5 G5 A5 . G5 E5 | D5 B4 G4 B4 A4 G4 E4 G4 | A4 . . . - . . .`,
    bass: 'A2 E3 | A2 E3 | G2 D3 | E2 B2 | A2 E3 | C3 G3 | G2 D3 | A2 A2',
  }),
  nana: tune('Nana junto al fuego', {
    step: 0.42,
    voice: 'flauta',
    scale: MAJOR_G,
    breath: 12,
    repeats: 2,
    calm: true,
    drone: true,
    score: `D5 . . B4 . G4 | A4 . B4 C5 . A4 | B4 . . G4 . E4 | D4 . . . . - |
            G4 . A4 B4 . D5 | E5 . D5 C5 . A4 | B4 . G4 A4 . F#4 | G4 . . . . -`,
    bass: 'G2 D3 | D3 A2 | E2 B2 | D3 A2 | G2 D3 | C3 G2 | D3 A2 | G2 G2',
  }),
  herrero: tune('El martillo del herrero', {
    step: 0.21,
    bar: 8,
    voice: 'laud',
    scale: MAJOR_D,
    breath: 8,
    repeats: 2,
    drum: 'X..xX..x',
    score: `D4 F#4 A4 D5 . A4 F#4 A4 | B4 . G4 B4 D5 . B4 G4 | A4 . F#4 A4 D5 . E5 F#5 | E5 . C#5 A4 E4 . . - |
            D4 F#4 A4 D5 . A4 F#4 A4 | G4 . B4 D5 G5 . F#5 E5 | F#5 D5 E5 C#5 D5 B4 A4 F#4 | D5 . A4 . D4 . - .`,
    bass: 'D3 A2 | G2 D3 | D3 A2 | A2 E3 | D3 A2 | G2 D3 | A2 E3 | D3 D3',
  }),
  lluvia: tune('Lluvia en el tejado', {
    step: 0.38,
    voice: 'laud',
    scale: AEOLIAN_E,
    breath: 14,
    repeats: 2,
    calm: true,
    score: `E5 . . B4 . G4 | A4 . B4 G4 . E4 | F#4 . G4 A4 . B4 | B4 . . . . - |
            E5 . F#5 G5 . E5 | D5 . B4 C5 . A4 | B4 . G4 F#4 . D4 | E4 . . . . -`,
    bass: 'E2 B2 | A2 E3 | D3 A2 | B2 F#3 | E2 B2 | G2 D3 | D3 A2 | E2 E2',
  }),
  zancos: tune('Los zancos de la feria', {
    step: 0.22,
    voice: 'flauta',
    scale: MAJOR_G,
    breath: 6,
    repeats: 2,
    drum: 'X..x..',
    shaker: '.x..x.',
    score: `G4 . B4 D5 . B4 | C5 . E5 D5 . B4 | A4 . B4 C5 B4 A4 | B4 . G4 D4 . . |
            G4 . B4 D5 . G5 | E5 . C5 D5 . B4 | A4 . F#4 A4 . C5 | B4 . G4 G4 . -`,
    bass: 'G2 D3 | C3 G2 | D3 A2 | G2 D3 | G2 D3 | C3 G2 | D3 A2 | G2 G2',
  }),
  romance: tune('Romance del caballero', {
    step: 0.33,
    voice: 'violin',
    scale: DORIAN_D,
    breath: 12,
    repeats: 2,
    calm: true,
    drone: true,
    score: `D5 . . C5 . A4 | F4 . G4 A4 . . | C5 . A4 G4 . F4 | E4 . . D4 . - |
            A4 . . C5 . D5 | E5 . F5 D5 . C5 | A4 . G4 F4 . E4 | D4 . . . . -`,
    bass: 'D3 A2 | F2 C3 | C3 G2 | A2 E3 | D3 A2 | C3 G2 | A2 E3 | D3 D3',
  }),
  patio: tune('Mañana en el patio', {
    step: 0.24,
    bar: 8,
    voice: 'laud',
    scale: MAJOR_F,
    breath: 8,
    repeats: 2,
    drum: 'X...x.x.',
    score: `F4 . A4 C5 . A4 F4 A4 | Bb4 . D5 . C5 . A4 . | G4 . Bb4 D5 . C5 Bb4 G4 | A4 . F4 . C4 . - . |
            F4 . A4 C5 . F5 E5 D5 | C5 . A4 . Bb4 . G4 . | A4 C5 G4 Bb4 F4 A4 E4 G4 | F4 . . . F4 . - .`,
    bass: 'F2 C3 | Bb2 F3 | G2 D3 | C3 G2 | F2 C3 | F2 C3 | C3 G2 | F2 F2',
  }),
} satisfies Record<string, Tune>;

export type TuneId = keyof typeof TUNES;

/** Qué puede sonar en cada ambiente (el motor lo baraja; ver `nextTune` en audio.ts). */
export const PLAYLISTS: Record<Mood, TuneId[]> = {
  taberna: ['jarra', 'camino', 'velas', 'molino', 'nana', 'herrero', 'lluvia', 'zancos', 'romance'],
  libre: [
    'leyenda',
    'patio',
    'camino',
    'jarra',
    'velas',
    'molino',
    'nana',
    'herrero',
    'lluvia',
    'zancos',
    'romance',
  ],
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
