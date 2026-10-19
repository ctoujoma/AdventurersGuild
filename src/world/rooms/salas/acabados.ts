/**
 * Acabados de las salas con su arte según el nivel: al mejorar, la pared del fondo y el suelo
 * cambian de material (lo de cada sala va encima). Nivel 2: cenefa de plantilla en el yeso,
 * arrimadero de tablas y moldura en la madera, zócalo de madera en la piedra y entibos en la
 * cueva. Nivel 3: azulejo en el zócalo del yeso, paneles y dentellones en la madera, sillería
 * labrada con cornisa en la piedra, chapado de piedra en la cueva; y el suelo, con cenefa.
 * Nivel 4 (solo vista: el juego aún no llega): encalado con cenefa de azulejo en el yeso,
 * pilastras doradas y friso pintado en la madera, mármol (o bóveda de ladrillo en la bodega)
 * en la piedra; y en el suelo, espiga, ajedrezado vidriado, rombos de mármol o ladrillo.
 *
 * Se pinta antes que las vigas y las ventanas, y respeta el alto del zócalo (`wain`): las salas
 * ponen lo suyo contando con él.
 */
import { P, type Ramp } from '../../../art/palette';
import type { PixelBuffer } from '../../../art/pixel';
import type { Room } from '../../../core/model';
import { beam, planksV, plaster, post, stoneWall } from '../../paint';
import { PITCH, ROOM_H } from '../layout';
import type { Theme } from '../textures';

const WOOD_DARK: Ramp = [P.black, P.plum, P.bark, P.rust];
const WAINSCOT: Ramp = [P.ebony, P.plum, P.bark, P.rust];
/** Yeso fino (encalado) de los niveles altos: más claro que el de siempre. */
export const PLASTER_FINE: Ramp = [P.clay, P.skinS, P.skin, P.sand, P.white];
/** Sillería labrada de arenisca: piezas grandes, de piedra cálida. */
const ASHLAR: Ramp = [P.plum, P.umber, P.cocoa, P.clay, P.tan];
/** Tablas barnizadas de los niveles altos: más claras y cálidas que las de siempre. */
export const WOOD_FINE: Ramp = [P.plum, P.bark, P.rust, P.oak];
const CELLAR: Ramp = [P.navy, P.slate, P.steel, P.fog, P.mist];
/** Encalado del nivel 4: casi blanco. */
const WHITEWASH: Ramp = [P.skinS, P.skin, P.sand, P.white, P.white];
/** Ladrillo de la bóveda (bodega en el nivel 4). */
const BRICK: Ramp = [P.plum, P.rust, P.brick, P.amber, P.tan];

/** Lo que va encima del zócalo de la pared del fondo, por tema y nivel. */
export function wallFinish(b: PixelBuffer, room: Room, theme: Theme, wain: number, seed: string) {
  const lvl = room.level;
  if (lvl < 2) return;
  const bw = b.w;
  const bh = b.h;
  const rail = bh - wain;
  if (theme === 'yeso') {
    // Postes cada 36 (de la pared de siempre): la cenefa va entre ellos.
    if (lvl >= 4) {
      plaster(b, 0, 0, bw, rail - 3, `${seed}c`, WHITEWASH);
      for (let x = 0; x < bw; x += 36) post(b, x, 0, 3, rail - 3, WOOD_DARK);
      // Cenefa de azulejo de una fila bajo la viga de arriba.
      for (let x = 0; x < bw; x += 36) tiles(b, x + 3, 3, Math.min(33, bw - x - 3), 7);
    } else stencil(b, 4, bw, lvl >= 3 ? [P.navy, P.sky] : [P.rust, P.wine], (x) => x % 36 < 3);
    if (lvl >= 3) {
      tiles(b, 0, rail, bw, wain);
      for (let x = 0; x < bw; x += 36) {
        b.rect(x - 1, 3, 5, 2, P.oak);
        b.hline(x - 1, 3, 5, P.gold);
        b.rect(x - 1, rail - 6, 5, 2, P.oak);
        b.hline(x - 1, rail - 6, 5, P.tan);
      }
    }
  } else if (theme === 'madera') {
    // Debajo del listón (que va en el zócalo), tablas tumbadas o paneles.
    const y0 = rail + 3;
    if (lvl >= 3) panels(b, y0, bw, bh - y0);
    else boardsH(b, y0, bw, bh - y0);
    // En el 3, entre los postes, la pared entelada (cada sala con su color) o enlucida.
    if (lvl >= 3) {
      const cloth = CLOTH[room.type];
      if (cloth) damask(b, 6, rail - 1, bw, lvl >= 4 ? [cloth[0], cloth[1], P.gold] : cloth);
      else plaster(b, 0, 6, bw, rail - 7, seed, PLASTER_FINE);
    }
    if (lvl >= 4) {
      // Friso pintado (roleos dorados sobre madera oscura) y pilastras con capitel y basa.
      frieze(b, 6, bw);
      for (let x = 0; x < bw; x += 36) pilaster(b, x, 6, rail - 3);
      goldPanels(b, y0, bw, bh - y0);
    } else for (let x = 0; x < bw; x += 36) post(b, x, 3, 3, rail - 3, WOOD_DARK);
    cornice(b, 3, bw, lvl >= 3);
  } else if (theme === 'piedra') {
    if (lvl >= 4 && room.type === 'bodega') {
      vaults(b, bw, rail - 3, seed);
      planksV(b, 0, rail, bw, wain, seed, WAINSCOT, 6);
      beam(b, 0, rail - 3, bw, 3, WOOD_DARK);
      return;
    }
    if (lvl >= 4) {
      marble(b, 0, 0, bw, rail - 3);
      goldCornice(b, 3, bw);
      // Zócalo de mármol oscuro con su moldura.
      b.rect(0, rail - 3, bw, wain + 3, P.navy);
      for (let x = 0; x < bw; x += 18) b.line(x + 2, rail + 2, x + 9, bh - 2, P.slate);
      b.hline(0, rail - 3, bw, P.gold);
      b.hline(0, rail - 2, bw, P.slate);
      return;
    }
    if (lvl >= 3) {
      stoneWall(b, 0, 0, bw, rail - 3, `${seed}s`, { ramp: ASHLAR, bw: 18, bh: 9 });
      stoneCornice(b, 3, bw);
    }
    planksV(b, 0, rail, bw, wain, seed, WAINSCOT, 6);
    beam(b, 0, rail - 3, bw, 3, WOOD_DARK);
  } else {
    if (lvl >= 3) {
      stoneWall(b, 0, bh - 30, bw, 30, `${seed}s`, { ramp: CELLAR, bw: 12, bh: 7 });
      beam(b, 0, bh - 33, bw, 3, WOOD_DARK);
    }
    // Entibos: postes y la viga de arriba, como en una mina.
    for (let x = 20; x < bw - 4; x += 48) post(b, x, 3, 4, bh - 3, WOOD_DARK);
    beam(b, 0, 3, bw, 4, WOOD_DARK);
  }
}

/**
 * Lo mismo en las paredes de los lados (fondo × alto, en el mundo), planta a planta: se ven de
 * canto, así que basta con el material (yeso fino y azulejo, tela, sillería) y las molduras.
 */
export function sideFinish(b: PixelBuffer, room: Room, theme: Theme, seed: string) {
  const lvl = room.level;
  if (lvl < 2) return;
  const w = b.w;
  for (let f = 0; f * PITCH < b.h; f++) {
    const yb = b.h - f * PITCH;
    const yt = yb - ROOM_H;
    if (theme === 'yeso') {
      plaster(b, 0, yt, w, ROOM_H - 18, `${seed}${f}`, lvl >= 4 ? WHITEWASH : PLASTER_FINE);
      if (lvl >= 4) tiles(b, 0, yt + 4, w, 7);
      else stencil(b, yt + 5, w, lvl >= 3 ? [P.navy, P.sky] : [P.rust, P.wine], () => false);
      if (lvl >= 3) tiles(b, 0, yb - 18, w, 18);
    } else if (theme === 'madera') {
      if (lvl >= 3) {
        const cloth = CLOTH[room.type];
        if (cloth) damask(b, yt + 7, yb - 17, w, lvl >= 4 ? [cloth[0], cloth[1], P.gold] : cloth);
        else plaster(b, 0, yt + 7, w, ROOM_H - 24, `${seed}${f}`, PLASTER_FINE);
        if (lvl >= 4) {
          frieze(b, yt + 7, w);
          goldPanels(b, yb - 14, w, 14);
        } else panels(b, yb - 14, w, 14);
      } else boardsH(b, yb - 14, w, 14);
      beam(b, 0, yb - 17, w, 3, WOOD_DARK);
      cornice(b, yt + 3, w, lvl >= 3);
    } else if (theme === 'piedra') {
      if (lvl >= 4 && room.type !== 'bodega') {
        marble(b, 0, yt, w, ROOM_H - 21);
        goldCornice(b, yt + 3, w);
        b.rect(0, yb - 21, w, 21, P.navy);
        b.hline(0, yb - 21, w, P.gold);
        continue;
      }
      if (lvl >= 4)
        stoneWall(b, 0, yt, w, ROOM_H - 21, `${seed}${f}s`, { ramp: BRICK, bw: 8, bh: 4 });
      else if (lvl >= 3) {
        stoneWall(b, 0, yt, w, ROOM_H - 21, `${seed}${f}s`, { ramp: ASHLAR, bw: 18, bh: 9 });
        stoneCornice(b, yt + 3, w);
      }
      planksV(b, 0, yb - 18, w, 18, `${seed}${f}`, WAINSCOT, 6);
      beam(b, 0, yb - 21, w, 3, WOOD_DARK);
    } else {
      if (lvl >= 3) {
        stoneWall(b, 0, yb - 36, w, 36, `${seed}${f}s`, { ramp: CELLAR, bw: 12, bh: 7 });
        beam(b, 0, yb - 39, w, 3, WOOD_DARK);
      }
      beam(b, 0, yt + 3, w, 4, WOOD_DARK);
    }
  }
}

/** Cenefa de plantilla (rombos con un punto) en una banda de 6 bajo la viga de arriba. */
function stencil(
  b: PixelBuffer,
  y: number,
  bw: number,
  [ink, dot]: [string, string],
  skip: (x: number) => boolean,
) {
  for (let x = 0; x < bw; x++) {
    if (skip(x)) continue;
    b.set(x, y, ink);
    b.set(x, y + 6, ink);
    const k = x % 8;
    if (k === 4) b.set(x, y + 3, dot);
    if (k === 3 || k === 5) b.set(x, y + 3, ink);
    if (k === 4) {
      b.set(x, y + 2, ink);
      b.set(x, y + 4, ink);
    }
    if (k === 0) b.set(x, y + 3, ink);
  }
}

/** Azulejos de 7 (blanco con la cruz azul) con su llaga. */
function tiles(b: PixelBuffer, x0: number, y0: number, w: number, h: number) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const tx = x % 7;
      const ty = y % 7;
      let c: string = P.mist;
      if (tx === 0 || ty === 0) c = P.fog;
      else if (tx === 3 && ty === 3) c = P.navy;
      else if ((tx === 3 && (ty === 2 || ty === 4)) || (ty === 3 && (tx === 2 || tx === 4)))
        c = P.sky;
      else if (tx === 1 || ty === 1) c = P.white;
      b.set(x0 + x, y0 + y, c);
    }
  // Remate de arriba.
  b.hline(x0, y0, w, P.navy);
}

/** Arrimadero de tablas tumbadas, con las juntas al tresbolillo. */
function boardsH(b: PixelBuffer, y0: number, w: number, h: number) {
  for (let r = 0, y = y0; y < y0 + h; r++, y += 4) {
    const bh = Math.min(4, y0 + h - y);
    b.rect(0, y, w, bh, r % 2 ? P.bark : P.umber);
    b.hline(0, y, w, P.rust);
    if (bh > 2) b.hline(0, y + bh - 1, w, P.ebony);
    for (let x = (r % 2) * 12; x < w; x += 24) b.vline(x, y, bh, P.ebony);
  }
}

/** Paneles enmarcados (boiserie): marco claro arriba y a la izquierda, sombra al contrario. */
function panels(b: PixelBuffer, y0: number, w: number, h: number) {
  b.rect(0, y0, w, h, P.bark);
  for (let x = 2; x + 14 <= w; x += 18) {
    const ph = h - 3;
    b.rect(x, y0 + 1, 14, ph, P.umber);
    b.hline(x, y0 + 1, 14, P.ebony);
    b.vline(x, y0 + 1, ph, P.ebony);
    b.hline(x + 1, y0 + ph, 13, P.rust);
    b.vline(x + 13, y0 + 2, ph - 1, P.rust);
    // La tabla de en medio, en relieve.
    b.rect(x + 3, y0 + 3, 8, ph - 4, P.mocha);
    b.hline(x + 3, y0 + 3, 8, P.oak);
  }
}

/**
 * Tela de las paredes enteladas (fondo, dibujo y centro): azul en el dormitorio (como las
 * mantas), granate en el de los veteranos, verde entre libros y mapas, morada en la capilla y
 * blanca en la enfermería. Las demás de madera, enlucidas.
 */
const CLOTH: Partial<Record<string, [string, string, string]>> = {
  dormitorio: [P.slate, P.steel, P.fog],
  veteranos: [P.plum, P.wine, P.red],
  biblioteca: [P.deep, P.forest, P.leaf],
  mapas: [P.deep, P.forest, P.leaf],
  capilla: [P.grape, P.rose, P.coral],
  enfermeria: [P.mist, P.fog, P.white],
};

/** Tela de damasco (rombos) de `y0` a `y1`, con filete de oro arriba y abajo. */
function damask(b: PixelBuffer, y0: number, y1: number, w: number, [bg, ink, dot]: string[]) {
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < w; x++) {
      const tx = x % 8;
      const ty = (y - y0) % 10;
      const d = Math.abs(tx - 4) + Math.abs(ty - 5);
      b.set(x, y, d === 3 ? ink! : d === 0 ? dot! : bg!);
    }
  b.hline(0, y0, w, P.gold);
  b.hline(0, y1 - 1, w, P.gold);
}

/** Moldura de madera bajo la viga de arriba; en el nivel 3, con dentellones y un filete de oro. */
function cornice(b: PixelBuffer, y: number, w: number, rich: boolean) {
  b.rect(0, y, w, 3, P.bark);
  b.hline(0, y, w, P.rust);
  b.hline(0, y + 2, w, P.black);
  if (!rich) return;
  b.hline(0, y + 3, w, P.gold);
  for (let x = 0; x < w; x += 4) {
    b.rect(x, y + 4, 2, 2, P.rust);
    b.set(x, y + 4, P.oak);
    b.set(x + 1, y + 5, P.plum);
  }
}

/** Cornisa de piedra clara bajo la viga de arriba. */
function stoneCornice(b: PixelBuffer, y: number, w: number) {
  b.rect(0, y, w, 4, P.fog);
  b.hline(0, y, w, P.white);
  b.hline(0, y + 2, w, P.mist);
  b.hline(0, y + 3, w, P.slate);
  b.hline(0, y + 4, w, P.navy);
}

/** Friso pintado de 6 filas: roleos dorados sobre madera oscura, entre dos filetes. */
function frieze(b: PixelBuffer, y: number, w: number) {
  b.rect(0, y, w, 6, P.ebony);
  b.hline(0, y, w, P.gold);
  b.hline(0, y + 5, w, P.gold);
  for (let x = 0; x < w; x++) {
    const k = x % 10;
    // Una ola que sube y baja, con un punto en cada vuelta.
    const wy = k < 5 ? y + 1 + Math.floor(k / 2) : y + 4 - Math.floor((k - 5) / 2);
    b.set(x, wy, P.amber);
    if (k === 2 || k === 7) b.set(x, k === 2 ? y + 4 : y + 1, P.gold);
  }
}

/** Pilastra dorada de 5 de ancho, con capitel arriba y basa abajo (centrada en `x + 1`). */
function pilaster(b: PixelBuffer, x: number, y0: number, y1: number) {
  b.rect(x - 1, y0, 5, y1 - y0, P.bark);
  b.vline(x - 1, y0, y1 - y0, P.rust);
  b.vline(x + 1, y0 + 3, y1 - y0 - 6, P.plum);
  b.vline(x + 3, y0, y1 - y0, P.black);
  for (const y of [y0, y1 - 3]) {
    b.rect(x - 2, y, 7, 3, P.amber);
    b.hline(x - 2, y, 7, P.gold);
    b.hline(x - 2, y + 2, 7, P.rust);
  }
}

/** Los paneles del zócalo, con un filete dorado dentro. */
function goldPanels(b: PixelBuffer, y0: number, w: number, h: number) {
  panels(b, y0, w, h);
  for (let x = 2; x + 14 <= w; x += 18) {
    b.hline(x + 2, y0 + 2, 10, P.gold);
    b.vline(x + 2, y0 + 2, h - 6, P.amber);
  }
}

/** Mármol: losas de 18 × 12 con su junta fina y vetas en diagonal. */
function marble(b: PixelBuffer, x0: number, y0: number, w: number, h: number) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const row = Math.floor(y / 12);
      const lx = (x + (row % 2) * 9) % 18;
      const ly = y % 12;
      let c: string = (Math.floor((x + (row % 2) * 9) / 18) + row) % 3 === 0 ? P.mist : P.white;
      if (lx === 0 || ly === 0) c = P.fog;
      // Vetas: líneas finas que cruzan cada losa.
      else if ((lx + ly * 2 + row * 5) % 23 === 0 || (lx * 3 - ly + row) % 29 === 0) c = P.fog;
      b.set(x0 + x, y0 + y, c);
    }
}

/** Cornisa dorada bajo la viga de arriba. */
function goldCornice(b: PixelBuffer, y: number, w: number) {
  b.rect(0, y, w, 4, P.amber);
  b.hline(0, y, w, P.lemon);
  b.hline(0, y + 1, w, P.gold);
  b.hline(0, y + 3, w, P.rust);
  for (let x = 1; x < w; x += 4) b.set(x, y + 4, P.gold);
}

/** Bóveda de ladrillo: arcos de medio punto cada 36 sobre pilares, con el ladrillo detrás. */
function vaults(b: PixelBuffer, w: number, y1: number, seed: string) {
  stoneWall(b, 0, 0, w, y1, `${seed}l`, { ramp: BRICK, bw: 8, bh: 4 });
  const r = 18;
  for (let cx = 18; cx - r < w; cx += 36) {
    // El arco: dovelas claras en un anillo de 3 de grueso, apoyado en dos pilares.
    for (let y = 0; y < y1; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || x >= w) continue;
        const dy = Math.max(0, r + 4 - y);
        const d = Math.hypot(x - cx, dy);
        if (y <= r + 4 && d >= r - 3 && d <= r)
          b.set(x, y, Math.round(Math.atan2(dy, x - cx) * 9) % 2 ? P.tan : P.amber);
      }
    for (const px of [cx - r, cx + r - 2])
      if (px > -3 && px < w) {
        b.rect(px, r + 4, 3, y1 - r - 4, P.amber);
        b.vline(px, r + 4, y1 - r - 4, P.tan);
        b.vline(px + 2, r + 4, y1 - r - 4, P.rust);
      }
  }
}

/**
 * El suelo del nivel 3 (debajo de alfombras y esteras): parqué de cestería con cenefa donde hay
 * tablas, olambrillas entre las baldosas de barro, damero de mármol en la piedra y losas en la
 * cueva. `kind` es el suelo de siempre de la sala.
 */
export function floorFinish(
  b: PixelBuffer,
  room: Room,
  kind: 'tablas' | 'barro' | 'piedra' | 'roca',
  seed: string,
) {
  if (room.level < 3) return;
  const w = b.w;
  const h = b.h;
  if (room.level >= 4) {
    floor4(b, room.type === 'bodega' ? 'ladrillo' : kind);
    return;
  }
  if (kind === 'tablas') {
    // Cestería: cuadros de 8×4 (en el suelo, 8×8) con dos tablillas tumbadas o cuatro de pie.
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const cx = Math.floor(x / 8);
        const cy = Math.floor(y / 4);
        const lx = x % 8;
        const ly = y % 4;
        const flat = (cx + cy) % 2 === 0;
        const slat = flat ? Math.floor(ly / 2) : Math.floor(lx / 2);
        const edge = flat ? ly % 2 === 1 : lx % 2 === 1;
        const tone = (slat + cx * 3 + cy) % 3 === 0 ? P.oak : P.rust;
        b.set(x, y, lx === 0 || ly === 0 ? P.plum : edge ? P.bark : tone);
      }
    // Cenefa oscura alrededor, con un filete claro.
    frame(b, w, h, P.bark, P.oak);
  } else if (kind === 'barro') {
    // Olambrillas: un azulejito en algunos cruces de las baldosas, al tresbolillo.
    for (let y = 8; y < h - 4; y += 8)
      for (let x = 12 + 12 * ((y / 8) % 2); x < w - 4; x += 24) {
        b.set(x, y, P.sky);
        b.set(x + 1, y, P.mist);
      }
    frame(b, w, h, P.plum, P.clay);
  } else if (kind === 'piedra') {
    // Damero de mármol blanco y gris.
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const light = (Math.floor(x / 10) + Math.floor(y / 5)) % 2 === 0;
        const top = y % 5 === 0;
        const left = x % 10 === 0;
        b.set(x, y, light ? (top || left ? P.mist : P.fog) : top || left ? P.steel : P.slate);
      }
    frame(b, w, h, P.navy, P.steel);
  } else
    stoneWall(b, 0, 0, w, h, seed, {
      ramp: [P.black, P.navy, P.slate, P.steel, P.fog],
      bw: 10,
      bh: 5,
    });
}

/**
 * El suelo del nivel 4: tablillas en espiga con cenefa y filete de oro, ajedrezado vidriado
 * (barro y azulejo), rombos de mármol con cenefa dorada, o ladrillo en espiga (la bodega).
 */
function floor4(b: PixelBuffer, kind: 'tablas' | 'barro' | 'piedra' | 'roca' | 'ladrillo') {
  const w = b.w;
  const h = b.h;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let c: string;
      if (kind === 'tablas' || kind === 'ladrillo') {
        // Espiga: columnas de 6 con las tablillas inclinadas a un lado y al otro.
        const col = Math.floor(x / 6);
        const lx = x % 6;
        const k = (y * 2 + (col % 2 ? lx : 5 - lx)) % 8;
        const wood = kind === 'tablas';
        c =
          k === 0 || lx === 0
            ? wood
              ? P.plum
              : P.rust
            : k < 4
              ? wood
                ? P.oak
                : P.brick
              : wood
                ? P.rust
                : P.amber;
      } else if (kind === 'barro') {
        const light = (Math.floor(x / 8) + Math.floor(y / 4)) % 2 === 0;
        const lx = x % 8;
        const ly = y % 4;
        c =
          lx === 0 || ly === 0 ? P.rust : light ? (lx === 4 && ly === 2 ? P.sky : P.sand) : P.clay;
      } else {
        // Rombos: cuadros girados de mármol blanco y gris, con un punto negro en cada cruce.
        const u = Math.floor((x + y * 2) / 10);
        const v = Math.floor((x - y * 2 + 1000) / 10);
        const edge = (x + y * 2) % 10 === 0 || (x - y * 2 + 1000) % 10 === 0;
        c = edge ? P.fog : (u + v) % 2 ? P.mist : P.slate;
      }
      b.set(x, y, c);
    }
  if (kind === 'barro') frame(b, w, h, P.rust, P.tan);
  else if (kind === 'ladrillo') frame(b, w, h, P.plum, P.tan);
  else frame(b, w, h, kind === 'tablas' ? P.plum : P.navy, P.gold);
}

/** Marco de dos filas (oscura por fuera y un filete claro) alrededor de un suelo. */
function frame(b: PixelBuffer, w: number, h: number, dark: string, light: string) {
  for (const y of [0, 1, h - 2, h - 1]) b.hline(0, y, w, dark);
  for (const x of [0, 1, 2, w - 3, w - 2, w - 1]) b.vline(x, 0, h, dark);
  b.hline(3, 2, w - 6, light);
  b.hline(3, h - 3, w - 6, light);
  b.vline(3, 2, h - 4, light);
  b.vline(w - 4, 2, h - 4, light);
}
