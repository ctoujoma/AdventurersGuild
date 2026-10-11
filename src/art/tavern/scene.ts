import { Rng, hashString } from '../../core/rng';
import { drawPixels } from '../canvas';
import { C } from '../palette';
import { bricks, circle, ctxPainter, planks, plaster, shape, type Painter } from '../painter';
import { crop, getPixel, type Pixels } from '../sprite';
import { sickbeds, tavernLayout, type Facilities, type TavernLayout } from './layout';
import { bottle, prop } from './props';

/**
 * La taberna en corte lateral (estilo casa de muñecas): tejado, dormitorios y enfermería
 * arriba, la sala común abajo y la bodega bajo tierra. Las mejoras cambian lo que se ve
 * y los héroes viven dentro: pasean por la sala, esperan en la barra o guardan cama.
 */

export const SCENE_W = 180;
export const SCENE_H = 210;

export type SceneHeroStatus = 'ok' | 'herido' | 'mision' | 'candidato';

export interface SceneHero {
  id: string;
  name: string;
  status: SceneHeroStatus;
  /** Sprite de pie. */
  sprite: Pixels;
  /** Sprite sin sombrero y con venda, para pintarlo en la cama. */
  resting: Pixels;
}

export interface TavernModel {
  fac: Facilities;
  /** Encargos en el tablón: uno por papel clavado. */
  quests: number;
  /** Objetos en el arcón: uno por cofre en la bodega. */
  loot: number;
  keeper: Pixels;
  heroes: SceneHero[];
}

export interface Actor {
  id: string;
  name: string;
  x: number;
  y: number;
  sprite: Pixels;
  flip: boolean;
}

// Medidas de la casa (en píxeles lógicos).
const Y = {
  roofTop: 12,
  eave: 50,
  upTop: 54,
  upFloor: 100,
  hallTop: 106,
  hallFloor: 160,
  ground: 164,
};
const X = { left: 8, right: 172, inL: 14, inR: 166, divider: 102 };
const CELLAR = { top: 170, floor: 198 };
const FIREBOX = { x: 151, w: 10, base: 157 };
const WALK = { min: 62, max: 126 };
const BAR_SPOTS = [27, 41, 55];
const STAND_Y = Y.hallFloor - 26; // el sprite tiene los pies en la fila 26

const STONE = { base: C.stone1, mortar: C.stone0, light: C.stone2 };
const DARK_STONE = { base: C.stone0, mortar: C.ink, light: C.stone1 };

// ---------- Muebles ----------

function bunk(level: number): Pixels {
  const blanket = [
    [C.wood3, C.wood2],
    [C.wood3, C.wood2],
    [C.red1, C.red0],
    [C.blue2, C.blue1],
  ][level]!;
  return shape(18, 28, (p) => {
    p.rect(0, 0, 2, 28, C.wood1);
    p.rect(16, 0, 2, 28, C.wood1);
    p.rect(1, 0, 1, 28, C.wood2);
    for (const my of [3, 18]) {
      p.rect(2, my + 4, 14, 2, C.wood2);
      p.rect(2, my, 14, 4, C.cloth1);
      p.rect(2, my, 4, 3, C.cloth2);
      p.rect(6, my, 10, 4, blanket[0]!);
      p.rect(6, my + 3, 10, 1, blanket[1]!);
      if (level >= 3) p.rect(6, my, 10, 1, C.gold1);
    }
  });
}

const cot = (): Pixels =>
  shape(24, 10, (p) => {
    p.rect(1, 6, 2, 4, C.wood1);
    p.rect(21, 6, 2, 4, C.wood1);
    p.rect(0, 4, 24, 2, C.wood2);
    p.rect(0, 1, 24, 3, C.cloth1);
    p.rect(1, 0, 5, 3, C.cloth2);
    p.rect(18, 1, 6, 3, C.blue1);
  });

const table = (cloth: boolean): Pixels =>
  shape(16, 12, (p) => {
    p.rect(1, 2, 2, 10, C.wood1);
    p.rect(13, 2, 2, 10, C.wood1);
    p.rect(0, 0, 16, 2, C.wood3);
    p.rect(0, 0, 16, 1, C.wood4);
    if (cloth) {
      p.rect(0, 0, 16, 4, C.red1);
      p.rect(0, 0, 16, 1, C.red2);
      for (let i = 0; i < 16; i += 3) p.rect(i, 4, 2, 1, C.red1);
    }
  });

const stool = (): Pixels =>
  shape(6, 7, (p) => {
    p.rect(0, 0, 6, 2, C.wood2);
    p.rect(0, 0, 6, 1, C.wood3);
    p.rect(1, 2, 1, 5, C.wood1);
    p.rect(4, 2, 1, 5, C.wood1);
  });

const counter = (trim: boolean): Pixels =>
  shape(36, 28, (p) => {
    planks(p, 0, 3, 36, 25, C.wood1, C.wood1, C.wood0, 9);
    for (let i = 0; i < 4; i++) p.rect(2 + i * 9, 6, 6, 19, C.wood0);
    for (let i = 0; i < 4; i++) p.rect(3 + i * 9, 7, 4, 17, C.wood2);
    p.rect(0, 0, 36, 3, C.wood3);
    p.rect(0, 0, 36, 1, C.wood4);
    if (trim) p.rect(0, 3, 36, 1, C.gold1);
  });

const noticeBoard = (papers: number): Pixels =>
  shape(30, 18, (p) => {
    p.rect(0, 0, 30, 18, C.wood1);
    p.rect(2, 2, 26, 14, C.wood3);
    const rng = new Rng('corcho');
    for (let i = 0; i < 40; i++) p.rect(2 + rng.int(0, 25), 2 + rng.int(0, 13), 1, 1, C.wood2);
    for (let i = 0; i < Math.min(papers, 6); i++) {
      const px = 3 + (i % 3) * 8 + (i % 2);
      const py = 3 + Math.floor(i / 3) * 7;
      p.rect(px, py, 7, 6, C.cloth1);
      p.rect(px + 1, py + 2, 5, 1, C.cloth0);
      p.rect(px + 1, py + 4, 4, 1, C.cloth0);
      p.rect(px + 3, py, 1, 1, C.red1);
    }
  });

const strawPile = (): Pixels =>
  shape(16, 5, (p) => {
    p.rect(2, 0, 10, 2, C.gold1);
    p.rect(0, 2, 16, 3, C.gold0);
    p.rect(3, 2, 8, 1, C.gold1);
  });

const lantern = (): Pixels =>
  shape(5, 6, (p) => {
    p.rect(0, 0, 5, 6, C.ink);
    p.rect(1, 1, 3, 4, C.fire3);
    p.rect(1, 4, 3, 1, C.fire2);
  });

const smallTable = (): Pixels =>
  shape(8, 8, (p) => {
    p.rect(0, 0, 8, 2, C.wood3);
    p.rect(1, 2, 6, 6, C.wood1);
    p.rect(2, 3, 4, 2, C.wood2);
  });

const blanket = (w: number): Pixels =>
  shape(w, 5, (p) => {
    p.rect(2, 0, w - 4, 1, C.blue2);
    p.rect(0, 1, w, 3, C.blue2);
    p.rect(0, 4, w, 1, C.blue1);
    p.rect(3, 1, w - 6, 1, C.blue3);
  });

// ---------- Fondo ----------

interface Flame {
  x: number;
  y: number;
}

interface Layers {
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
  flames: Flame[];
  glows: Flame[];
  layout: TavernLayout;
}

function layer(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = SCENE_W;
  c.height = SCENE_H;
  return [c, c.getContext('2d')!];
}

function windowFrame(p: Painter, x: number, y: number, w: number, h: number, broken: boolean) {
  p.rect(x, y, w, h, C.wood1);
  p.rect(x + 1, y + 1, w - 2, h - 2, broken ? C.ink : C.sky1);
  if (!broken) {
    p.rect(x + 2, y + 2, 2, 1, C.blue3);
    p.rect(x + Math.floor(w / 2), y, 1, h, C.wood1);
    p.rect(x, y + Math.floor(h / 2), w, 1, C.wood1);
  } else {
    for (let i = 0; i < w; i++) {
      p.rect(x + i, y + 2 + Math.floor(i / 2), 1, 2, C.wood2);
      p.rect(x + i, y + h - 4 - Math.floor(i / 3), 1, 2, C.wood2);
    }
  }
  p.rect(x - 1, y + h, w + 2, 2, C.wood2);
}

function drawBackground(model: TavernModel): Layers {
  const layout = tavernLayout(model.fac);
  const { fac } = model;
  const [back, ctx] = layer();
  const [front, fctx] = layer();
  const p = ctxPainter(ctx);
  const flames: Flame[] = [];
  const glows: Flame[] = [];
  const put = (sprite: Pixels, x: number, y: number, flip = false) =>
    drawPixels(ctx, sprite, x, y, flip);

  // Cielo nocturno, luna y estrellas.
  p.rect(0, 0, SCENE_W, SCENE_H, C.sky0);
  p.rect(0, 70, SCENE_W, 60, C.sky1);
  p.rect(0, 130, SCENE_W, 40, C.sky2);
  const stars = new Rng('estrellas');
  for (let i = 0; i < 45; i++) p.rect(stars.int(0, SCENE_W - 1), stars.int(0, 120), 1, 1, C.star);
  circle(p, 24, 22, 7, C.cloth1);
  circle(p, 27, 20, 6, C.sky0);

  // Tierra con piedras y hierba fuera de la casa.
  p.rect(0, Y.ground, SCENE_W, SCENE_H - Y.ground, C.dirt1);
  const dirt = new Rng('tierra');
  for (let i = 0; i < 90; i++) {
    p.rect(
      dirt.int(0, SCENE_W - 2),
      dirt.int(Y.ground + 2, SCENE_H - 2),
      dirt.int(1, 3),
      1,
      dirt.chance(0.5) ? C.dirt2 : C.dirt0,
    );
  }
  for (let i = 0; i < 10; i++)
    p.rect(dirt.int(0, SCENE_W - 4), dirt.int(Y.ground + 6, SCENE_H - 4), 3, 2, C.stone1);
  p.rect(0, Y.ground - 1, SCENE_W, 3, C.green1);
  for (let x = 0; x < SCENE_W; x += 3) p.rect(x, Y.ground - 2 - (x % 2), 1, 2, C.green2);

  // Chimenea (detrás del tejado).
  bricks(p, 138, 14, 12, 30, STONE, 'chimenea');
  p.rect(136, 12, 16, 3, C.stone3);
  p.rect(136, 15, 16, 1, C.stone0);

  // Tejado de tejas.
  for (let y = Y.roofTop; y <= Y.eave; y++) {
    const hw = Math.round(((y - Y.roofTop) / (Y.eave - Y.roofTop)) * 88);
    const x0 = 90 - hw;
    const x1 = 90 + hw;
    const k = (y - Y.roofTop) % 3;
    p.rect(x0, y, x1 - x0 + 1, 1, k === 0 ? C.wood0 : k === 1 ? C.red1 : C.red0);
    if (k !== 0) {
      const band = Math.floor((y - Y.roofTop) / 3);
      for (let sx = x0 + (band % 2) * 3; sx <= x1; sx += 6) p.rect(sx, y, 1, 1, C.wood0);
    }
    p.rect(x0, y, 2, 1, C.wood1);
    p.rect(x1 - 1, y, 2, 1, C.wood1);
  }
  circle(p, 90, 36, 5, C.wood1);
  circle(p, 90, 36, 4, C.fire3);
  p.rect(86, 37, 9, 3, C.fire2);
  p.rect(90, 32, 1, 9, C.wood1);
  p.rect(86, 36, 9, 1, C.wood1);
  p.rect(0, 48, SCENE_W, 3, C.wood1);
  p.rect(0, 51, SCENE_W, 1, C.wood0);

  // Fachada de piedra, bodega y cimientos.
  bricks(p, X.left, 52, X.right - X.left, Y.ground - 52, STONE, 'fachada');
  bricks(p, X.left, Y.ground, X.right - X.left, CELLAR.floor + 6 - Y.ground, STONE, 'cimientos');
  bricks(p, X.inL, CELLAR.top, X.inR - X.inL, CELLAR.floor - CELLAR.top, DARK_STONE, 'bodega');
  p.rect(X.inL, CELLAR.floor - 2, X.inR - X.inL, 2, C.dirt2);
  p.rect(X.left, 52, X.right - X.left, 2, C.wood0);

  // ----- Piso de arriba: dormitorios -----
  const dormW = X.divider - X.inL;
  plaster(
    p,
    X.inL,
    Y.upTop,
    dormW,
    Y.upFloor - Y.upTop,
    fac.dorm ? C.plaster1 : C.plaster0,
    C.plaster0,
    'dorm',
    fac.dorm === 0,
  );
  planks(p, X.inL, 90, dormW, 10, C.wood1, C.wood2, C.wood0);
  p.rect(X.inL, 89, dormW, 1, C.wood3);
  windowFrame(p, 26, 58, 12, 12, fac.dorm === 0);
  if (fac.dorm === 0) {
    put(strawPile(), 20, 94);
    put(strawPile(), 52, 94);
    put(prop('telarana'), X.inL, Y.upTop);
    put(prop('telarana'), X.divider - 6, Y.upTop, true);
  }
  const bunkSprite = bunk(fac.dorm);
  for (const x of layout.bunks) put(bunkSprite, x - 1, Y.upFloor - 29);
  if (fac.dorm >= 3) {
    p.rect(52, Y.upTop, 1, 5, C.stone2);
    put(lantern(), 50, 59);
    glows.push({ x: 53, y: 62 });
  }
  // Tabique.
  p.rect(X.divider, Y.upTop, 6, Y.upFloor - Y.upTop, C.wood1);
  p.rect(X.divider, Y.upTop, 1, Y.upFloor - Y.upTop, C.wood2);
  p.rect(X.divider + 5, Y.upTop, 1, Y.upFloor - Y.upTop, C.wood0);

  // ----- Piso de arriba: enfermería -----
  const enfX = X.divider + 6;
  const enfW = X.inR - enfX;
  plaster(
    p,
    enfX,
    Y.upTop,
    enfW,
    Y.upFloor - Y.upTop,
    fac.enf ? C.plaster2 : C.plaster0,
    fac.enf ? C.plaster1 : C.stone1,
    'enf',
    fac.enf === 0,
  );
  windowFrame(p, 150, 60, 10, 10, fac.enf === 0);
  if (fac.enf === 0) {
    put(prop('cofre'), 112, 91);
    put(prop('saco'), 126, 92);
    put(prop('telarana'), X.inR - 6, Y.upTop, true);
    ctx.globalAlpha = 0.45;
    p.rect(enfX, Y.upTop, enfW, Y.upFloor - Y.upTop, C.ink);
    ctx.globalAlpha = 1;
    for (const [y0, dir] of [
      [62, 1],
      [88, -1],
    ] as const) {
      for (let i = 0; i < enfW; i++) {
        const yy = y0 + Math.round(dir * i * 0.25);
        p.rect(enfX + i, yy, 1, 3, C.wood2);
        p.rect(enfX + i, yy + 3, 1, 1, C.wood0);
      }
    }
  } else {
    put(prop('cruz'), 115, 59);
    const cotSprite = cot();
    for (const x of layout.cots) put(cotSprite, x - 1, Y.upFloor - 11);
    if (fac.enf === 1) {
      put(smallTable(), 140, 91);
      p.rect(144, 88, 1, 3, C.cloth1);
      flames.push({ x: 144, y: 86 });
    }
    if (fac.enf >= 2) {
      for (const x of [124, 133, 150]) {
        p.rect(x + 2, Y.upTop, 1, 2, C.wood1);
        put(prop('hierbas'), x, Y.upTop + 1);
      }
    }
    if (fac.enf >= 3) {
      p.rect(118, 74, 26, 2, C.wood2);
      for (let i = 0; i < 4; i++) put(bottle(i + 1), 119 + i * 6, 67);
    }
  }

  // Suelo entre pisos.
  p.rect(X.left, Y.upFloor, X.right - X.left, 6, C.wood1);
  p.rect(X.left, Y.upFloor, X.right - X.left, 1, C.wood3);
  p.rect(X.left, Y.upFloor + 5, X.right - X.left, 1, C.wood0);
  for (let x = X.left + 4; x < X.right; x += 12) p.rect(x, Y.upFloor + 2, 1, 1, C.wood0);

  // ----- Sala común -----
  const hallW = X.inR - X.inL;
  plaster(
    p,
    X.inL,
    Y.hallTop,
    hallW,
    34,
    fac.tab ? C.plaster2 : C.plaster0,
    C.plaster1,
    'sala',
    fac.tab === 0,
  );
  planks(p, X.inL, 140, hallW, 20, C.wood1, C.wood2, C.wood0);
  p.rect(X.inL, 140, hallW, 1, C.wood3);
  p.rect(X.inL, Y.hallTop, hallW, 2, C.wood0);
  if (fac.tab === 0) {
    put(prop('telarana'), X.inL, Y.hallTop + 2);
    put(prop('telarana'), 112, Y.hallTop + 2, true);
  }

  // Estanterías de la barra.
  p.rect(18, 121, 40, 2, C.wood2);
  p.rect(20, 123, 1, 2, C.wood1);
  p.rect(55, 123, 1, 2, C.wood1);
  for (let i = 0; i < Math.min(layout.bottles, 6); i++) put(bottle(i), 20 + i * 6, 114);
  if (fac.tab >= 2) {
    p.rect(18, 131, 40, 2, C.wood2);
    for (let i = 0; i < 4; i++) put(prop('jarra'), 21 + i * 9, 126);
  }
  if (layout.barrels >= 1) put(prop('barril'), 14, Y.hallFloor - 12);
  if (layout.barrels >= 2) put(prop('barril'), 14, Y.hallFloor - 23);

  // Tablón de encargos.
  put(noticeBoard(model.quests), 67, 111);

  // Estandarte y faroles.
  if (layout.banner) put(prop('estandarte'), 132, 110);
  for (const x of layout.lanterns) {
    p.rect(x + 2, Y.hallTop, 1, 6, C.stone2);
    put(lantern(), x, Y.hallTop + 6);
    glows.push({ x: x + 2, y: Y.hallTop + 9 });
  }

  // Escalera hacia el piso de arriba.
  for (let i = 0; i < 13; i++) {
    const sx = 140 - 2 * i - 4;
    const sy = Y.hallFloor - 4 * (i + 1);
    p.rect(sx + 1, sy + 2, 6, 3, C.wood1);
    p.rect(sx, sy, 6, 2, C.wood3);
    p.rect(sx, sy, 6, 1, C.wood4);
    p.rect(sx + 5, sy + 2, 1, 2, C.wood0);
  }

  // Chimenea de la sala.
  bricks(p, 149, Y.hallTop, 15, 34, STONE, 'tiro');
  bricks(p, 146, 141, 20, 19, STONE, 'hogar');
  p.rect(146, 141, 1, 19, C.outline);
  p.rect(150, 146, 12, 14, C.ink);
  p.rect(151, 145, 10, 1, C.ink);
  p.rect(144, 138, 22, 3, C.wood2);
  p.rect(144, 138, 22, 1, C.wood3);
  p.rect(144, 141, 22, 1, C.wood0);
  if (layout.fire === 'apagado') {
    p.rect(151, 157, 10, 3, C.stone2);
    p.rect(153, 156, 6, 1, C.stone3);
    put(prop('telarana'), 150, 146);
  } else {
    p.rect(151, 157, 10, 2, C.wood1);
    p.rect(152, 156, 8, 1, C.wood2);
  }
  if (layout.trophy) put(prop('trofeo'), 148, 122);
  if (fac.tab >= 2) {
    for (const x of [146, 163]) {
      p.rect(x, 134, 1, 4, C.cloth1);
      flames.push({ x, y: 132 });
    }
  }

  // Mesas, taburetes y velas.
  const tableSprite = table(layout.tablecloths);
  const stoolSprite = stool();
  for (const x of layout.tables) {
    put(stoolSprite, x - 8, Y.hallFloor - 8);
    put(stoolSprite, x + 17, Y.hallFloor - 8);
    put(tableSprite, x - 1, Y.hallFloor - 13);
    p.rect(x + 11, Y.hallFloor - 16, 1, 3, C.cloth1);
    flames.push({ x: x + 11, y: Y.hallFloor - 18 });
    if (fac.tab >= 2) put(prop('jarra'), x + 2, Y.hallFloor - 18);
  }
  if (fac.tab === 0) {
    put(stoolSprite, 80, Y.hallFloor - 8);
    p.rect(92, Y.hallFloor - 3, 14, 2, C.wood2);
  }

  // Suelo de la sala y trampilla de la bodega.
  p.rect(X.left, Y.hallFloor, X.right - X.left, 4, C.wood2);
  p.rect(X.left, Y.hallFloor, X.right - X.left, 1, C.wood3);
  for (let x = X.left + 6; x < X.right; x += 14) p.rect(x, Y.hallFloor + 1, 1, 3, C.wood0);
  p.rect(152, Y.hallFloor, 9, 4, C.ink);

  // ----- Bodega -----
  put(prop('barril'), 17, CELLAR.floor - 13);
  put(prop('barril'), 29, CELLAR.floor - 13);
  put(prop('barril'), 23, CELLAR.floor - 24);
  for (let i = 0; i < Math.min(model.loot, 6); i++)
    put(prop('cofre'), 48 + i * 14, CELLAR.floor - 10);
  put(prop('saco'), 134, CELLAR.floor - 9);
  put(prop('saco'), 141, CELLAR.floor - 8);
  p.rect(153, Y.hallFloor, 1, CELLAR.floor - Y.hallFloor, C.wood1);
  p.rect(159, Y.hallFloor, 1, CELLAR.floor - Y.hallFloor, C.wood1);
  for (let y = Y.hallFloor + 2; y < CELLAR.floor; y += 4) p.rect(153, y, 7, 1, C.wood2);

  // Letrero colgado: «El Jarro Partido».
  p.rect(0, 109, 16, 2, C.ink);
  p.rect(3, 111, 1, 3, C.stone2);
  p.rect(12, 111, 1, 3, C.stone2);
  put(prop('letrero'), 1, 113);

  // Capa delantera: la barra tapa al tabernero.
  drawPixels(fctx, counter(fac.tab >= 3), 27, 131);
  for (let i = 0; i < layout.mugsOnBar; i++) drawPixels(fctx, prop('jarra'), 32 + i * 9, 127);

  return { back, front, flames, glows, layout };
}

// ---------- Escena animada ----------

interface Walker {
  hero: SceneHero;
  x: number;
  target: number;
  wait: number;
  facingLeft: boolean;
}

const resting = new WeakMap<Pixels, Pixels>();
function headOf(sprite: Pixels): Pixels {
  let head = resting.get(sprite);
  if (!head) {
    head = crop(sprite, 1, 4, 16, 12);
    resting.set(sprite, head);
  }
  return head;
}

/** Ruido determinista por (semilla, n): mismo fotograma, mismo parpadeo. */
function noise(seed: number, n: number): number {
  let h = Math.imul(seed ^ (n * 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class TavernScene {
  private ctx: CanvasRenderingContext2D;
  private layers: Layers | null = null;
  private model: TavernModel | null = null;
  private walkers = new Map<string, Walker>();
  private actors: Actor[] = [];
  private raf = 0;
  private last = 0;
  private blanketCot = blanket(18);
  private blanketBunk = blanket(11);

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = SCENE_W;
    canvas.height = SCENE_H;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }

  setModel(model: TavernModel): void {
    this.model = model;
    this.layers = drawBackground(model);
    const present = model.heroes.filter((h) => h.status === 'ok');
    const rng = new Rng(Date.now());
    for (const id of this.walkers.keys()) {
      if (!present.some((h) => h.id === id)) this.walkers.delete(id);
    }
    for (const hero of present) {
      const w = this.walkers.get(hero.id);
      if (w) w.hero = hero;
      else {
        const x = rng.int(WALK.min, WALK.max);
        this.walkers.set(hero.id, {
          hero,
          x,
          target: x,
          wait: rng.next() * 3,
          facingLeft: rng.chance(0.5),
        });
      }
    }
    this.draw(performance.now());
  }

  start(): void {
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - (this.last || t)) / 1000);
      this.last = t;
      this.update(dt);
      this.draw(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.last = 0;
  }

  /** Héroe bajo un punto (coordenadas lógicas), mirando solo píxeles opacos. */
  actorAt(x: number, y: number): Actor | null {
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const a = this.actors[i]!;
      const lx = Math.floor(x - a.x);
      const sx = a.flip ? a.sprite.w - 1 - lx : lx;
      if (getPixel(a.sprite, sx, Math.floor(y - a.y))) return a;
    }
    return null;
  }

  private update(dt: number): void {
    for (const w of this.walkers.values()) {
      if (w.wait > 0) {
        w.wait -= dt;
        if (w.wait <= 0) {
          w.target = WALK.min + Math.random() * (WALK.max - WALK.min);
          w.facingLeft = w.target < w.x;
        }
        continue;
      }
      const step = 14 * dt * Math.sign(w.target - w.x);
      if (Math.abs(w.target - w.x) <= Math.abs(step)) {
        w.x = w.target;
        w.wait = 1.5 + Math.random() * 4;
      } else w.x += step;
    }
  }

  private draw(t: number): void {
    const { ctx, layers, model } = this;
    if (!layers || !model) return;
    const frame = Math.floor(t / 110);
    ctx.drawImage(layers.back, 0, 0);

    // Estrellas que titilan.
    for (let i = 0; i < 6; i++) {
      if (noise(7, Math.floor(t / 700) * 10 + i) < 0.5) continue;
      ctx.fillStyle = C.fire4;
      ctx.fillRect(Math.floor(noise(3, i) * SCENE_W), Math.floor(noise(5, i) * 50), 1, 1);
    }

    // Humo de la chimenea.
    for (let i = 0; i < 4; i++) {
      const ph = (t / 3200 + i / 4) % 1;
      const sy = 10 - ph * 12;
      if (sy < 0) continue;
      const sx = 143 + ph * 8 + Math.sin(ph * 6 + i) * 2;
      ctx.fillStyle = ph < 0.5 ? C.stone2 : C.stone1;
      const s = ph < 0.3 ? 2 : 3;
      ctx.fillRect(Math.round(sx), Math.round(sy), s, s);
    }

    // Fuego y su luz.
    if (layers.layout.fire !== 'apagado') {
      const tall = layers.layout.fire === 'grande' ? 9 : 6;
      for (let c = 0; c < FIREBOX.w; c++) {
        const edge = c === 0 || c === FIREBOX.w - 1 ? 3 : 0;
        const h = Math.max(1, tall - edge - Math.floor(noise(11, frame * 16 + c) * 4));
        for (let k = 0; k < h; k++) {
          const f = k / h;
          ctx.fillStyle = f < 0.35 ? C.fire1 : f < 0.7 ? C.fire2 : f < 0.9 ? C.fire3 : C.fire4;
          ctx.fillRect(FIREBOX.x + c, FIREBOX.base - k, 1, 1);
        }
      }
      this.glow(156, 152, 44 + noise(13, frame) * 4, 0.16);
    }
    for (const g of layers.glows) this.glow(g.x, g.y, 14, 0.14);
    for (const f of layers.flames) {
      const tall = noise(17, frame * 31 + f.x) < 0.5;
      ctx.fillStyle = C.fire3;
      ctx.fillRect(f.x, f.y + (tall ? 0 : 1), 1, tall ? 1 : 1);
      ctx.fillStyle = C.fire2;
      ctx.fillRect(f.x, f.y + 1, 1, 1);
    }

    const actors: Actor[] = [];
    const bob = (seed: string, period: number) =>
      Math.floor(t / period + (hashString(seed) % 7)) % 2 ? -1 : 0;

    // Tabernero detrás de la barra.
    drawPixels(ctx, model.keeper, 36, 113 + bob('tabernero', 900));
    ctx.drawImage(layers.front, 0, 0);

    // Heridos en cama.
    const beds = sickbeds(model.fac);
    model.heroes
      .filter((h) => h.status === 'herido')
      .slice(0, beds.length)
      .forEach((hero, i) => {
        const bed = beds[i]!;
        const head = headOf(hero.resting);
        const hx = bed.x - 3;
        const hy = Y.upFloor - 19;
        drawPixels(ctx, head, hx, hy);
        if (bed.kind === 'camilla') drawPixels(ctx, this.blanketCot, bed.x + 4, Y.upFloor - 11);
        else drawPixels(ctx, this.blanketBunk, bed.x + 4, Y.upFloor - 11);
        actors.push({ id: hero.id, name: hero.name, x: hx, y: hy, sprite: head, flip: false });
      });

    // Candidatos esperando en la barra.
    model.heroes
      .filter((h) => h.status === 'candidato')
      .slice(0, BAR_SPOTS.length)
      .forEach((hero, i) => {
        const x = BAR_SPOTS[i]!;
        const y = STAND_Y + bob(hero.id, 1100);
        drawPixels(ctx, hero.sprite, x, y, i % 2 === 1);
        actors.push({ id: hero.id, name: hero.name, x, y, sprite: hero.sprite, flip: i % 2 === 1 });
      });

    // Héroes disponibles paseando por la sala.
    [...this.walkers.values()]
      .sort((a, b) => a.hero.id.localeCompare(b.hero.id))
      .forEach((w) => {
        const moving = w.wait <= 0;
        const y = STAND_Y + (moving ? (Math.floor(w.x / 3) % 2 ? -1 : 0) : bob(w.hero.id, 1300));
        drawPixels(ctx, w.hero.sprite, w.x, y, w.facingLeft);
        actors.push({
          id: w.hero.id,
          name: w.hero.name,
          x: Math.round(w.x),
          y,
          sprite: w.hero.sprite,
          flip: w.facingLeft,
        });
      });

    this.actors = actors;
  }

  private glow(x: number, y: number, r: number, alpha: number): void {
    const g = this.ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255, 190, 90, ${alpha})`);
    g.addColorStop(1, 'rgba(255, 190, 90, 0)');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
