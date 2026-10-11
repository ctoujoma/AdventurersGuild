/**
 * Geometría del mundo: dónde está cada planta, cada habitación y cada mueble según las
 * mejoras. Es lógica pura (sin DOM): la escena solo pinta lo que diga este fichero.
 */

export const WORLD_W = 512;
export const WORLD_H = 384;
export const GROUND = 300;
/**
 * El mundo visible va más allá del corte del edificio (0..WORLD_W): un patio con el camino
 * real a la izquierda, donde llegan los asaltos, y terreno a la derecha para crecer.
 */
export const WORLD_X0 = -128;
export const WORLD_X1 = 640;
export const SPAN = WORLD_X1 - WORLD_X0;

/** Paredes exteriores del edificio (cortadas) y su interior. */
export const B = { left: 96, right: 432, inL: 104, inR: 424 } as const;

/** Plantas: techo (top) y suelo (floor) de cada una. */
export const F = {
  attic: { floor: 140 },
  upper: { top: 148, floor: 212 },
  hall: { top: 220, floor: 292 },
  cellar: { top: 300, floor: 352 },
} as const;

export const ROOF = {
  apexX: 264,
  apexY: 40,
  eaveY: 136,
  eaveL: 72,
  eaveR: 456,
  thick: 12,
} as const;

/** Altura de la cara interior del tejado en x (el desván es abuhardillado). */
export function roofUnderside(x: number): number {
  return ROOF.apexY + ROOF.thick + Math.abs(x - ROOF.apexX) / 2;
}

export function roofTop(x: number): number {
  return ROOF.apexY + Math.abs(x - ROOF.apexX) / 2;
}

export const CHIMNEY = { x: 338, w: 20, top: 58 } as const;

export const ROOMS = {
  dorm: { x0: B.inL, x1: 236, y0: F.upper.top, y1: F.upper.floor },
  enf: { x0: 240, x1: 364, y0: F.upper.top, y1: F.upper.floor },
  landing: { x0: 368, x1: B.inR, y0: F.upper.top, y1: F.upper.floor },
  hall: { x0: B.inL, x1: B.inR, y0: F.hall.top, y1: F.hall.floor },
  cellar: { x0: B.inL, x1: B.inR, y0: F.cellar.top, y1: F.cellar.floor },
  attic: { x0: B.inL, x1: B.inR, y0: ROOF.apexY + ROOF.thick, y1: F.attic.floor },
} as const;

export type RoomId = keyof typeof ROOMS;

export interface Facilities {
  /** Dormitorios: 0 en ruinas, 1–3 mejorados. Capacidad = 2 + 2 × nivel. */
  dorm: number;
  /** Enfermería: 0 cerrada, 1–3 con camillas. */
  enf: number;
  /** Taberna (sala común): 0 en ruinas, 1–4 cada vez más acogedora (4: gran salón). */
  tab: number;
  /** Sala de mapas en el desván: 0–2. */
  mapas: number;
  /** Armería en la bodega: 0–2. */
  arm: number;
  /** Capilla en un anexo a la derecha: 0–2. */
  cap: number;
  /** Fuera del corte: forja y establo a la derecha; patio, empalizada y torre a la izquierda. */
  forja: number;
  establo: number;
  patio: number;
  empal: number;
  torre: number;
  /** Ala de veteranos colgada de la fachada derecha: 0–2. */
  vet?: number;
}

export const FACILITY_MAX = 3;

export function capacity(dormLevel: number): number {
  return 2 + 2 * dormLevel;
}

export interface Seat {
  x: number;
  /** Mira a la derecha si es true. */
  faceRight: boolean;
}

export interface Layout {
  bunks: number[];
  cots: number[];
  tables: number[];
  seats: Seat[];
  bottles: number;
  mugs: number;
  kegs: number;
  sconces: number[];
  chandelier: boolean;
  trophy: boolean;
  lute: boolean;
  dartboard: boolean;
  rugs: boolean;
  tablecloths: boolean;
  banners: boolean;
  fire: 'apagado' | 'normal' | 'grande';
  hangings: number;
  curtains: boolean;
  potions: boolean;
  herbs: boolean;
  screen: boolean;
  /** Gran salón (taberna a nivel 4): alfombra roja, segundo candelabro, barra dorada. */
  gala: boolean;
}

const BUNK_X = [110, 140, 170, 200];
export const TABLE_X = [236, 288];

export function layout(f: Facilities): Layout {
  const bunks = f.dorm === 0 ? [] : BUNK_X.slice(0, capacity(f.dorm) / 2);
  const tables = f.tab === 0 ? [] : f.tab === 1 ? [TABLE_X[0]!] : [...TABLE_X];
  return {
    bunks,
    cots: f.enf === 0 ? [] : f.enf === 1 ? [252] : [250, 284],
    tables,
    seats: tables.flatMap((x) => [
      { x: x - 17, faceRight: true },
      { x: x + 17, faceRight: false },
    ]),
    bottles: [2, 6, 10, 14][f.tab] ?? 14,
    mugs: [0, 2, 4, 6][f.tab] ?? 6,
    kegs: [0, 1, 2, 3][f.tab] ?? 3,
    sconces: f.tab >= 2 ? [214, 306] : f.tab === 1 ? [214] : [],
    chandelier: f.tab >= 3,
    trophy: f.tab >= 3,
    lute: f.tab >= 3,
    dartboard: f.tab >= 2,
    rugs: f.tab >= 2,
    tablecloths: f.tab >= 3,
    banners: f.tab >= 3 || f.dorm >= 3,
    fire: f.tab === 0 ? 'apagado' : f.tab === 3 ? 'grande' : 'normal',
    hangings: [0, 2, 4, 6][f.tab] ?? 6,
    curtains: f.dorm >= 2,
    potions: f.enf >= 3,
    herbs: f.enf >= 2,
    screen: f.enf >= 3,
    gala: f.tab >= 4,
  };
}

/** Camas donde guarda cama la gente herida: primero camillas; si no hay enfermería, literas. */
export function sickbeds(f: Facilities): { x: number; kind: 'camilla' | 'litera' }[] {
  const l = layout(f);
  if (l.cots.length) return l.cots.map((x) => ({ x, kind: 'camilla' as const }));
  return l.bunks.map((x) => ({ x, kind: 'litera' as const }));
}

/** Tramos de suelo por donde pasean los héroes de la sala. */
export const HALL_WALK = { min: 196, max: 312 } as const;
/** Sitio de los candidatos frente a la barra y del tabernero detrás. */
export const BAR_SPOTS = [130, 150, 170];
export const KEEPER_RANGE = { min: 132, max: 176 } as const;
export const FIRE_SPOT = 300;

export interface HotspotDef {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Huecos de los trofeos en la sala (los mismos que pinta annex.ts). */
export const TROPHY_HOTSPOTS: readonly (readonly [number, number])[] = [
  [318, 223],
  [361, 223],
  [377, 238],
  [172, 236],
];

/** Zonas interactivas fijas del edificio. */
export function hotspots(f: Facilities, trophies = 0): HotspotDef[] {
  const list: HotspotDef[] = [
    { id: 'tablon', label: 'Tablón de encargos', x: 220, y: 228, w: 40, h: 30 },
    { id: 'barra', label: 'La barra', x: 126, y: 270, w: 66, h: 22 },
    { id: 'chimenea', label: 'Chimenea', x: 318, y: 238, w: 56, h: 54 },
    {
      id: 'dormitorios',
      label: 'Dormitorios',
      x: ROOMS.dorm.x0,
      y: ROOMS.dorm.y0 + 20,
      w: 130,
      h: 44,
    },
    { id: 'enfermeria', label: 'Enfermería', x: ROOMS.enf.x0, y: ROOMS.enf.y0 + 20, w: 96, h: 44 },
    { id: 'retrato', label: 'Retrato del tío Fausto', x: 390, y: 154, w: 24, h: 28 },
    { id: 'despacho', label: 'Libro de cuentas', x: 242, y: 112, w: 48, h: 28 },
    { id: 'mapa', label: 'Mapa de la región', x: 204, y: 98, w: 40, h: 24 },
    { id: 'cofres', label: 'Arcón del botín', x: 226, y: 322, w: 58, h: 30 },
    { id: 'pozo', label: 'El pozo', x: 12, y: 248, w: 40, h: 52 },
    { id: 'letrero', label: 'El Jarro Partido', x: 52, y: 164, w: 40, h: 34 },
    { id: 'puerta', label: 'La puerta', x: 84, y: 244, w: 20, h: 48 },
  ];
  list.push({ id: 'equipo', label: 'Tablero del equipo', x: 190, y: 303, w: 74, h: 16 });
  TROPHY_HOTSPOTS.slice(0, trophies).forEach(([x, y], i) =>
    list.push({ id: `trofeo-${i}`, label: 'Trofeo', x, y, w: 14, h: 14 }),
  );
  if (f.forja > 0) list.push({ id: 'forja', label: 'Forja', x: 518, y: 252, w: 50, h: 48 });
  if (f.establo > 0) list.push({ id: 'establo', label: 'Establo', x: 572, y: 250, w: 64, h: 50 });
  if (f.patio > 0)
    list.push({
      id: 'patio-entreno',
      label: 'Patio de entrenamiento',
      x: -102,
      y: 268,
      w: 52,
      h: 32,
    });
  if (f.empal > 0)
    list.push({ id: 'empalizada', label: 'Empalizada', x: -127, y: 266, w: 20, h: 34 });
  if (f.torre > 0)
    list.push({ id: 'torre', label: 'Torre del vigía', x: -128, y: 160, w: 26, h: 140 });
  if ((f.vet ?? 0) > 0)
    list.push({ id: 'veteranos', label: 'Ala de veteranos', x: 434, y: 138, w: 62, h: 70 });
  if (f.arm > 0) list.push({ id: 'armeria', label: 'Armería', x: 284, y: 318, w: 56, h: 34 });
  if (f.cap > 0) list.push({ id: 'capilla', label: 'Capilla', x: 440, y: 214, w: 56, h: 78 });
  if (layout(f).lute) list.push({ id: 'laud', label: 'Laúd', x: 263, y: 229, w: 15, h: 28 });
  return list;
}
