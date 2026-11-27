/**
 * Lo que tiene delante el grupo mientras espera a que elijas (`e.pending`): el cofre, la torre,
 * el santuario, el mercader con su carro, el viajero, el campamento abandonado, el oso, la boca de
 * la cueva o unas ruinas. Con un jefe o el guardián a la vista, el grupo se esconde tras unas matas
 * y una roca a un lado y el jefe espera al otro.
 *
 * Se pintan como el paisaje, no como muñecos: en tonos (material y escalón, `tonos.ts`), con la
 * luz por la izquierda, el tramado de `step` y sin contorno, y se colorean con la tabla de la capa
 * donde están (la luz de la hora, la sombra del bosque, la niebla). Lo grande (torre, cueva, ruinas,
 * tienda, santuario) va detrás del camino, entre los árboles de cerca y el suelo; lo pequeño (cofre,
 * carro, fuego, matas), en el camino. Medida: un héroe mide unos 22 px.
 */
import { expFoeArt, expGuardianArt } from '../../art/expFoes';
import { FEET_Y, generateLook, heroSprites } from '../../art/heroes/hero';
import { PixelBuffer } from '../../art/pixel';
import { bush, rock, tuft } from './arboles';
import { biomaOf } from './bioma';
import { step, type CapaId } from './capas';
import type { Ctx } from './ctx';
import { GAP, foeFrame, heroOf, shadow } from './gente';
import { lutOf, pack, unpack, type Depth } from './luz';
import { put, tinted } from './pintar';
import { M, Tonos, hash, hash2, type Mat } from './tonos';
import {
  VELAS_SIERRA,
  cuevaSierra,
  esconditeSierra,
  refugio,
  ruinasSierra,
  santuarioSierra,
  torreSierra,
} from './sucesos-sierra';

// ---------- Pintar en tonos ----------

const grain = (x: number, y: number, s: number) => hash2(x >> 1, y >> 1, s);

/** Un píxel con su escalón tramado (el valor con decimales se reparte por Bayer). */
const px = (t: Tonos, x: number, y: number, m: Mat, v: number) => t.set(x, y, m, step(v, x, y));

/**
 * Sillería: hiladas de 4 px con juntas desplazadas, cada sillar con su matiz, la luz que da
 * `shade(x, y)` y musgo al pie y en alguna junta.
 */
function silleria(
  t: Tonos,
  x0: number,
  y0: number,
  w: number,
  h: number,
  seed: number,
  inside: (x: number, y: number) => boolean,
  shade: (x: number, y: number) => number,
  moss = 0.5,
): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const row = Math.floor(y / 4);
      const bw = 5 + (row % 3 === 1 ? 1 : 0);
      const off = row % 2 ? 3 : 0;
      const block = Math.floor((x + off) / bw);
      const joint = y % 4 === 3 || (x + off) % bw === bw - 1;
      const n = hash2(block, row, seed);
      let v = shade(x, y) + (n - 0.5) * 0.9;
      // La cara de arriba de cada sillar, algo más clara; la junta, hundida.
      if (y % 4 === 0) v += 0.35;
      if (joint) v -= 1.4;
      const foot = y > h - 5 - hash(seed + x * 3) * 3;
      const mossy = moss > 0 && (foot || (joint && hash2(x, y, seed + 9) < 0.08 * moss));
      if (mossy && hash2(x, y, seed + 4) < 0.55 + moss * 0.3)
        px(t, x0 + x, y0 + y, M.musgo, v - 0.6);
      else px(t, x0 + x, y0 + y, M.roca, v);
    }
}

/** Hiedra que trepa: más tupida abajo, a manchas. */
function hiedra(t: Tonos, x0: number, x1: number, y0: number, y1: number, seed: number) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!t.get(x, y)) continue;
      const u = (y - y0) / Math.max(1, y1 - y0);
      const g = grain(x, y, seed);
      if (g < 0.18 + u * 0.42 && hash2(x >> 2, y >> 2, seed + 3) < 0.7)
        px(t, x, y, M.hoja, 1.6 + (x0 - x) * 0.05 + g * 2.4);
    }
}

/** Hierba al pie (que no parezca posado encima). */
function pie(t: Tonos, x0: number, x1: number, base: number, seed: number) {
  for (let x = x0; x <= x1; x += 2 + Math.floor(hash(seed + x) * 3))
    tuft(t, x, base, 3 + Math.floor(hash(seed + x * 7) * 3), seed + x);
}

// ---------- Lo grande, detrás del camino ----------

/** La torre vieja de vigía: redonda, matacanes, almenas mordidas, saeteras, puerta y hiedra. */
function torre(): Tonos {
  const W = 40;
  const H = 76;
  const t = new Tonos(W, H);
  const cx = W / 2;
  const base = H - 1;
  const half = (y: number) => 11 + (y / H) * 2.5;
  // Luz de cilindro, por la izquierda.
  const cyl = (x: number, y: number) => {
    const u = (x + 0.5 - cx) / half(y);
    return 3.4 - u * 1.9 - u * u * 0.6;
  };
  silleria(t, 0, 0, W, H, 17, (x, y) => y >= 16 && Math.abs(x + 0.5 - cx) <= half(y), cyl, 0.8);
  // El adarve vuela sobre ménsulas (matacanes): ancho, con sombra debajo.
  const pw = 15;
  for (let y = 9; y < 16; y++)
    for (let x = Math.floor(cx - pw); x < cx + pw; x++) {
      const u = (x + 0.5 - cx) / pw;
      let v = 3.6 - u * 1.9 - u * u * 0.5 + (y === 9 ? 0.6 : 0);
      if (y >= 14) v = (x % 4 < 2 ? 2 : 0.4) - u; // ménsulas y huecos
      px(t, x, y, M.roca, v + (grain(x, y, 5) - 0.5) * 0.6);
    }
  // Almenas: las de la derecha, rotas a pedazos.
  for (let k = 0; k < 5; k++) {
    const x0 = Math.floor(cx - pw) + 1 + k * 6;
    const broken = k >= 3;
    for (let y = 2; y < 9; y++)
      for (let x = x0; x < x0 + 4; x++) {
        if (broken && y < 2 + (k === 3 ? 3 : 5) + hash(x * 3 + k) * 2) continue;
        const u = (x + 0.5 - cx) / pw;
        px(t, x, y, M.roca, 3.5 - u * 1.8 + (x === x0 ? 0.6 : 0) + (y === 2 ? 0.4 : 0));
      }
  }
  // Saeteras (hondas: casi negro, con el derrame de piedra clara alrededor).
  for (const [sx, sy, sh] of [
    [cx - 2, 26, 7],
    [cx + 3, 46, 6],
  ] as const) {
    for (let y = sy - 1; y <= sy + sh; y++)
      for (let x = sx - 1; x <= sx + 2; x++) px(t, x, y, M.roca, 4.4);
    for (let y = sy; y < sy + sh; y++) for (let x = sx; x <= sx + 1; x++) t.set(x, y, M.roca, 0);
  }
  // Puerta en arco con dovelas y hoja de tablas.
  const dw = 5;
  const dTop = base - 17;
  const inArch = (x: number, y: number, r: number) =>
    y < dTop + dw ? Math.hypot(x + 0.5 - cx, y - (dTop + dw)) <= r : Math.abs(x + 0.5 - cx) <= r;
  for (let y = dTop - 2; y <= base; y++)
    for (let x = cx - dw - 2; x <= cx + dw + 1; x++) {
      if (!inArch(x, y, dw + 2)) continue;
      if (!inArch(x, y, dw)) px(t, x, y, M.roca, 4.6 - (x - cx) / (dw + 2));
      else px(t, x, y, M.corteza, Math.round(x - cx) % 3 === 0 ? 0.6 : 1.8);
    }
  for (const hy of [dTop + 7, base - 4])
    for (let x = cx - dw + 1; x < cx + dw; x++) t.set(x, hy, M.roca, 1);
  // Hiedra por la cara en sombra, una mata, cascotes de la almena rota y hierba.
  hiedra(t, Math.floor(cx + 2), W - 1, 30, base, 23);
  bush(t, cx + 11, base, 10, 6, M.hoja, 31);
  rock(t, cx - 13, base, 5, 3, 41);
  rock(t, cx + 16, base, 4, 2, 43);
  pie(t, 4, W - 4, base, 51);
  return t;
}

/** La cueva: un risco redondeado con la boca negra, raíces que cuelgan y matas encima. */
function cueva(): Tonos {
  const W = 72;
  const H = 40;
  const t = new Tonos(W, H);
  const base = H - 1;
  const top = (x: number) => {
    const u = (x - W / 2) / (W / 2);
    return 3 + Math.pow(Math.abs(u), 1.7) * 22 + (grain(x, 0, 3) - 0.5) * 3;
  };
  // Peña grande (luz por arriba a la izquierda) con grietas.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (y < top(x)) continue;
      const u = (x - W / 2) / (W / 2);
      const crack = hash2(x >> 3, y >> 2, 7) < 0.12 && (x + (y >> 1)) % 9 === 0;
      let v = 3.5 - u * 1.5 - (y - top(x)) * 0.05 + (grain(x, y, 11) - 0.5) * 1.1;
      if (y - top(x) < 2) v += 1;
      if (crack) v -= 1.6;
      px(t, x, y, M.roca, v);
    }
  // La boca: ojival, negra al fondo, con un borde en sombra.
  const mx = W / 2 + 2;
  const mh = 25;
  const mw = 12;
  for (let y = base - mh; y <= base; y++)
    for (let x = mx - mw - 2; x <= mx + mw + 2; x++) {
      const dy = (base - y) / mh;
      const lim = mw * Math.sqrt(Math.max(0, 1 - dy * dy * dy));
      const d = Math.abs(x + 0.5 - mx);
      if (d > lim + 2) continue;
      if (d > lim) px(t, x, y, M.roca, 1.2);
      else t.set(x, y, M.roca, d > lim - 2 && hash2(x, y, 2) < 0.5 ? 1 : 0);
    }
  // Raíces que cuelgan del dintel.
  for (let k = 0; k < 6; k++) {
    const rx = Math.round(mx - mw + 3 + k * 4 + hash(k) * 2);
    const len = 3 + Math.floor(hash(k * 7) * 6);
    const y0 = base - mh + 1 + Math.round(Math.abs(rx - mx) * 0.4);
    for (let j = 0; j < len; j++) t.set(rx + (j > 3 ? 1 : 0), y0 + j, M.corteza, 2);
  }
  // Musgo por arriba; matas, piedras y hierba.
  for (let x = 2; x < W - 2; x++) {
    const ty = Math.ceil(top(x));
    if (hash(x * 5) < 0.75) px(t, x, ty, M.musgo, 3 + grain(x, ty, 4) * 2);
    if (hash(x * 9) < 0.35) px(t, x, ty + 1, M.musgo, 2);
  }
  bush(t, 12, Math.round(top(12)) + 2, 10, 5, M.hoja, 61);
  bush(t, W - 14, Math.round(top(W - 14)) + 2, 8, 4, M.hierba, 62);
  rock(t, 8, base, 7, 4, 63, 0.6);
  rock(t, W - 6, base, 6, 3, 64);
  pie(t, 2, W - 2, base, 65);
  return t;
}

/** Unas ruinas: un muro roto con un arco, una columna en pie, un tambor caído y sillares. */
function ruinas(): Tonos {
  const W = 66;
  const H = 52;
  const t = new Tonos(W, H);
  const base = H - 1;
  const wallTop = (x: number) =>
    14 + Math.abs(Math.sin(x * 0.21 + 1)) * 9 + grain(x, 0, 9) * 4 + (x > 30 ? (x - 30) * 0.9 : 0);
  const hole = (x: number, y: number) => y >= 26 && Math.hypot(x - 18, Math.max(0, 33 - y)) <= 7.5;
  silleria(
    t,
    0,
    0,
    40,
    H,
    71,
    (x, y) => y >= wallTop(x) && !hole(x, y),
    (x) => 4.1 - (x / 40) * 1.4,
    0.7,
  );
  // Dovelas del arco.
  for (let a = 0; a <= 16; a++) {
    const ang = Math.PI + (a / 16) * Math.PI;
    for (const r of [8, 9])
      px(
        t,
        Math.round(18 + Math.cos(ang) * r),
        Math.round(33 + Math.sin(ang) * r),
        M.roca,
        4.4 - a * 0.08,
      );
  }
  // Columna estriada con capitel.
  const cx = 52;
  for (let y = 8; y <= base; y++)
    for (let x = cx - 3; x <= cx + 3; x++) {
      const u = (x - cx) / 3.5;
      let v = 4.3 - u * 1.8;
      if ((x - cx + 3) % 2 === 1) v -= 0.7;
      if (y < 11) v = 4.4 - u * 1.4;
      px(t, x, y, M.roca, v);
    }
  for (let x = cx - 5; x <= cx + 5; x++) {
    px(t, x, 7, M.roca, 4.5 - (x - cx) * 0.25);
    px(t, x, 6, M.roca, 5);
  }
  hiedra(t, cx - 3, cx + 3, 18, base, 77);
  // Tambor caído y sillares sueltos.
  for (let y = base - 5; y <= base; y++)
    for (let x = 30; x < 42; x++)
      px(t, x, y, M.roca, 3.6 - (y - (base - 5)) * 0.35 + (x === 30 ? -1 : 0));
  rock(t, 45, base, 6, 3, 81, 0.5);
  rock(t, 62, base, 5, 3, 82);
  hiedra(t, 0, 39, 22, base, 83);
  pie(t, 1, W - 2, base, 85);
  return t;
}

/** La tienda abandonada: lona a dos aguas, abierta, con el palo y un viento a la estaca. */
function tienda(): Tonos {
  const W = 40;
  const H = 26;
  const t = new Tonos(W, H);
  const base = H - 1;
  const ap = 16;
  for (let y = 3; y <= base; y++) {
    const half = ((y - 3) / (base - 3)) * 15 + 1;
    for (let x = Math.ceil(ap - half); x <= ap + half; x++) {
      const u = (x - ap) / half;
      const open = u > 0.05 && u < 0.62 && y > base - (base - 3) * (0.85 - u * 0.9);
      if (open) t.set(x, y, M.tierra, y > base - 2 ? 1 : 0);
      else
        px(
          t,
          x,
          y,
          M.tierra,
          (u < 0 ? 5.6 : 4.1) - Math.abs(u) * 0.8 + (Math.round(x - ap) % 5 === 0 ? -0.8 : 0),
        );
    }
  }
  // Suciedad abajo.
  for (let y = base - 3; y <= base; y++)
    for (let x = 0; x < 34; x++) if (t.get(x, y) && hash2(x, y, 3) < 0.4) px(t, x, y, M.tierra, 3);
  // Palo con remate y viento a la estaca.
  for (let y = 0; y < 5; y++) t.set(ap, y, M.corteza, 3);
  for (let k = 0; k < 9; k++) t.set(ap + 16 + k, base - 7 + Math.round(k * 0.8), M.corteza, 4);
  t.set(ap + 23, base, M.corteza, 1);
  pie(t, 1, W - 3, base, 91);
  return t;
}

/** El santuario de camino: pilar de piedra con tejadillo, hornacina con la imagen y velas. */
function santuario(): Tonos {
  const W = 18;
  const H = 30;
  const t = new Tonos(W, H);
  const base = H - 1;
  const x0 = 4;
  const w = 10;
  silleria(
    t,
    x0,
    6,
    w,
    H - 6,
    101,
    () => true,
    (x) => 4 - (x / w) * 2,
    0.8,
  );
  // Hornacina honda.
  for (let y = 10; y < 19; y++)
    for (let x = x0 + 2; x < x0 + w - 2; x++)
      if (y > 11 || Math.abs(x + 0.5 - (x0 + w / 2)) < 2) t.set(x, y, M.roca, x === x0 + 2 ? 1 : 0);
  // La imagen (manto azul, cara clara) y dos velas.
  for (let y = 13; y < 18; y++)
    for (let x = x0 + 4; x < x0 + 6; x++) t.set(x, y, M.agua, x === x0 + 4 ? 3 : 2);
  t.set(x0 + 4, 12, M.nieve, 4);
  t.set(x0 + 5, 12, M.nieve, 3);
  t.set(x0 + 3, 17, M.mies, 5);
  t.set(x0 + 6, 17, M.mies, 5);
  // Tejadillo a dos aguas.
  for (let j = 0; j < 6; j++)
    for (let x = x0 - 3 + j; x <= x0 + w + 2 - j; x++)
      px(
        t,
        x,
        6 - j,
        M.valla,
        (x < x0 + w / 2 ? 4.2 : 2.4) - (j === 0 ? 1 : 0) + (x % 3 === 0 ? -0.6 : 0),
      );
  t.set(x0 - 1, base, M.flor, 3);
  t.set(x0 + w + 1, base - 1, M.flor, 4);
  pie(t, 0, W - 1, base, 105);
  return t;
}

// ---------- Lo pequeño, en el camino ----------

/** El cofre: tablas, flejes de hierro, tapa abombada y la cerradura dorada. */
function cofre(): Tonos {
  const W = 15;
  const H = 11;
  const t = new Tonos(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const lid = y < 4;
      if (y === 0 && (x < 2 || x > W - 3)) continue;
      const u = x / (W - 1);
      let v = (lid ? 4.8 : 3.8) - u * 1.6 + (y === 0 ? 0.6 : 0) + (y === 4 ? -1.4 : 0);
      if (!lid && y % 3 === 2) v -= 0.6;
      px(t, x, y, M.valla, v);
    }
  for (const bx of [2, W - 3])
    for (let y = 0; y < H; y++) px(t, bx, y, M.roca, 3.2 - (bx / W) * 1.5);
  for (let x = 0; x < W; x++) px(t, x, H - 1, M.roca, 1.6);
  t.set(7, 4, M.mies, 5);
  t.set(7, 5, M.mies, 3);
  t.set(8, 4, M.mies, 4);
  return t;
}

/** El carro del mercader: ruedas de radios, caja de tablas, toldo de lona en arcos y fardos. */
function carro(): Tonos {
  const W = 46;
  const H = 30;
  const t = new Tonos(W, H);
  const base = H - 1;
  for (let y = 2; y < 16; y++)
    for (let x = 6; x < 38; x++) {
      const u = (x - 22) / 16;
      const topY = 2 + u * u * 6;
      if (y < topY) continue;
      const hoop = (x - 6) % 8 === 0;
      px(t, x, y, M.tierra, 6.2 - (u + 1) * 1.0 - (y - topY) * 0.04 + (hoop ? -1.2 : 0));
    }
  for (let y = 8; y < 16; y++) for (let x = 35; x < 38; x++) t.set(x, y, M.tierra, 0);
  px(t, 36, 13, M.mies, 3.5);
  px(t, 36, 14, M.mies, 2.5);
  for (let y = 16; y < 22; y++)
    for (let x = 4; x < 40; x++)
      px(
        t,
        x,
        y,
        M.valla,
        (y === 16 ? 4.5 : y === 21 ? 1 : 3) - (x / W) * 1.2 + (x % 7 === 0 ? -0.8 : 0),
      );
  for (let k = 0; k < 6; k++) t.set(40 + k, 20 + (k >> 2), M.corteza, 2);
  for (const cx of [11, 33]) {
    const cy = base - 6;
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2;
      for (const r of [6, 5.4])
        px(
          t,
          Math.round(cx + Math.cos(ang) * r),
          Math.round(cy + Math.sin(ang) * r),
          M.corteza,
          2.6 - Math.cos(ang) * 0.9 - Math.sin(ang) * 0.6,
        );
    }
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2 + 0.3;
      for (let r = 1; r < 5; r++)
        t.set(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), M.corteza, 3);
    }
    t.set(cx, cy, M.roca, 4);
  }
  return t;
}

/** El fuego apagado del campamento: un corro de piedras y tizones con alguna brasa. */
function brasas(): Tonos {
  const W = 16;
  const H = 6;
  const t = new Tonos(W, H);
  const base = H - 1;
  for (let k = 0; k < 6; k++) rock(t, 2 + k * 2.4, base, 3, 2, 120 + k);
  for (let k = 0; k < 7; k++) {
    t.set(4 + k, base - 2 - (k % 3 === 0 ? 1 : 0), M.corteza, k % 2 ? 0 : 1);
    t.set(4 + k, base - 1, M.corteza, 1);
  }
  t.set(7, base - 2, M.fruta, 4);
  t.set(9, base - 1, M.fruta, 2);
  return t;
}

/** Las matas y la roca tras las que se esconde el grupo ante el jefe. */
function escondite(): Tonos {
  const W = 48;
  const H = 18;
  const t = new Tonos(W, H);
  const base = H - 1;
  bush(t, 9, base, 16, 13, M.hoja, 131);
  bush(t, 22, base, 18, 15, M.hoja, 132);
  bush(t, 34, base, 14, 11, M.hierba, 133);
  rock(t, 42, base, 9, 6, 134, 0.7);
  pie(t, 1, W - 2, base, 135);
  return t;
}

// ---------- Colorear como la capa ----------

const PAINT = { torre, cueva, ruinas, tienda, santuario, cofre, carro, brasas, escondite };
type Pieza = keyof typeof PAINT;
/** En la sierra, las piezas con material de montaña (`sucesos-sierra.ts`). */
const SIERRA: Partial<Record<Pieza, () => Tonos>> = {
  torre: torreSierra,
  cueva: cuevaSierra,
  ruinas: ruinasSierra,
  tienda: refugio,
  santuario: santuarioSierra,
  escondite: esconditeSierra,
};
const tones = new Map<string, Tonos>();
const colored = new Map<string, { key: string; out: PixelBuffer }>();

/** La pieza coloreada con la tabla de la capa `id` (la misma luz, sombra y niebla que el paisaje). */
function painted(c: Ctx, p: Pieza, id: CapaId): PixelBuffer {
  const bio = biomaOf(c.m.terrain);
  const tk = `${bio.id}:${p}`;
  let t = tones.get(tk);
  if (!t) {
    t = ((bio.id === 'sierra' && SIERRA[p]) || PAINT[p])();
    tones.set(tk, t);
  }
  const l = c.l;
  const depth: Depth = c.capas.find((x) => x.id === id)?.depth ?? { haze: 0, fog: 0.2 };
  const key = `${bio.id}:${l.hour.toFixed(1)}:${l.clima.fog.toFixed(2)}:${l.clima.cloud.toFixed(2)}:${l.clima.rain.toFixed(1)}:${(l.clima.dust ?? 0).toFixed(2)}:${l.night.toFixed(2)}`;
  const ck = `${tk}:${id}`;
  const hit = colored.get(ck);
  if (hit && hit.key === key) return hit.out;
  const lut = lutOf(l, depth, bio.ramps);
  const out = new PixelBuffer(t.w, t.h);
  for (let i = 0; i < t.d.length; i++) out.data[i] = t.d[i] ? lut[t.d[i]!]! : 0;
  colored.set(ck, { key, out });
  return out;
}

/** Planta una pieza por el centro de su base (de vuelta, del revés). */
function plant(c: Ctx, p: Pieza, id: CapaId, x: number, feet: number, flip = false): void {
  const img = painted(c, p, id);
  // Que quepa entero en el encuadre (en móvil, lo grande se iría por el borde).
  const half = img.w / 2;
  x = Math.round(Math.max(half + 2, Math.min(c.e.w - half - 2, x)));
  put(c.b, img, x, feet, Math.floor(img.w / 2), img.h - 1, flip);
}

// ---------- Efectos ----------

/** Aclara un píxel hacia un blanco cálido (luz, no pegatina). */
function lighten(c: Ctx, x: number, y: number, k: number): void {
  if (!c.b.inside(x, y)) return;
  const [r, g, b] = unpack(c.b.data[y * c.b.w + x]!);
  c.b.data[y * c.b.w + x] = pack([r + (255 - r) * k, g + (246 - g) * k, b + (200 - b) * k]);
}

/** Un brillo que parpadea de vez en cuando (el oro del cofre, las velas). */
function glint(c: Ctx, x: number, y: number, k: number): void {
  const t = (c.time * 1.3 + k) % 3;
  if (t > 0.45) return;
  const r = t < 0.2 ? 1 : 2;
  for (let d = -r; d <= r; d++) {
    lighten(c, x + d, y, d === 0 ? 0.9 : 0.55);
    if (d) lighten(c, x, y + d, 0.55);
  }
}

/** Hilo de humo que sube de las brasas (tramado, mezclado con lo de detrás). */
function smoke(c: Ctx, x: number, y: number): void {
  for (let i = 0; i < 9; i++) {
    const u = (((c.time * 0.3 + i / 9) % 1) + 1) % 1;
    const sx = Math.round(x + Math.sin(u * 5 + i) * (1 + u * 2) + u * 5);
    const sy = Math.round(y - u * 22);
    if ((sx + sy) % 2 || !c.b.inside(sx, sy)) continue;
    const [r, g, b] = unpack(c.b.data[sy * c.b.w + sx]!);
    const k = 0.45 * (1 - u);
    c.b.data[sy * c.b.w + sx] = pack([r + (185 - r) * k, g + (185 - g) * k, b + (190 - b) * k]);
  }
}

/** Alguien del camino (el mercader, el viajero): una figura como las del grupo, de cara. */
function stranger(
  c: Ctx,
  seed: string,
  cls: 'picaro' | 'explorador',
  x: number,
  faceLeft: boolean,
) {
  const look = generateLook(seed, cls, hash(seed.length * 7) < 0.5 ? 'm' : 'f');
  const img = heroSprites(look, {}).idle[Math.floor(c.time * 2) % 2]!;
  shadow(c.b, x, c.e.feet, 5);
  put(c.b, tinted(img, c.l, c.lk), x, c.e.feet, 9, FEET_Y, faceLeft);
}

// ---------- Dónde va cada cosa ----------

const dirOf = (c: Ctx) => (c.m.home ? -1 : 1);

/** Unos pasos por delante del grupo. */
function ahead(c: Ctx, by: number): number {
  const n = c.m.crew.length;
  const dir = dirOf(c);
  const lead = Math.round(c.e.w / 2 + (dir * (n - 1) * GAP) / 2);
  return lead + dir * by;
}

/** El pie de lo que va detrás del camino (en la orilla, entre los árboles de cerca). */
const orilla = (c: Ctx) => c.e.ground + 5;

/** Lo grande, detrás del camino: entre la capa de cerca y el suelo. */
export function drawSucesoFondo(c: Ctx): void {
  const ev = c.m.event;
  if (!ev || c.m.mode !== 'wait') return;
  const flip = dirOf(c) < 0;
  const y = orilla(c);
  switch (ev.kind) {
    case 'torre':
      plant(c, 'torre', 'cerca', ahead(c, 44), y, flip);
      break;
    case 'cueva':
      plant(c, 'cueva', 'cerca', ahead(c, 46), y, flip);
      break;
    case 'ruinas':
      plant(c, 'ruinas', 'cerca', ahead(c, 44), y, flip);
      break;
    case 'campamento':
      plant(c, 'tienda', 'cerca', ahead(c, 40), y, flip);
      break;
    case 'santuario': {
      const x = ahead(c, 26);
      plant(c, 'santuario', 'cerca', x, y, flip);
      if (biomaOf(c.m.terrain).id === 'sierra')
        VELAS_SIERRA.forEach(([dx, dy], k) => glint(c, x + dx, y - dy, k * 1.5 + 0.4));
      else {
        glint(c, x - 2, y - 12, 0.4);
        glint(c, x + 1, y - 12, 1.9);
      }
      break;
    }
  }
}

/** Lo que va en el camino (cofre, carro, brasas, el oso, gente) y el jefe a la vista. */
export function drawSuceso(c: Ctx): void {
  const ev = c.m.event;
  if (!ev || c.m.mode !== 'wait') return;
  const flip = dirOf(c) < 0;
  const f = c.e.feet;
  switch (ev.kind) {
    case 'cofre': {
      const x = ahead(c, 20);
      shadow(c.b, x, f, 8);
      plant(c, 'cofre', 'suelo', x, f, flip);
      glint(c, x, f - 6, 0);
      break;
    }
    case 'campamento': {
      const x = ahead(c, 22);
      plant(c, 'brasas', 'suelo', x, f + 1, flip);
      smoke(c, x, f - 3);
      break;
    }
    case 'mercader': {
      const x = ahead(c, 52);
      shadow(c.b, x, f, 16);
      plant(c, 'carro', 'suelo', x, f, !flip);
      stranger(c, 'mercader-camino', 'picaro', ahead(c, 24), !flip);
      break;
    }
    case 'viajero':
      stranger(c, `viajero-${c.m.seed}`, 'explorador', ahead(c, 22), !flip);
      break;
    case 'oso': {
      const { art } = expFoeArt('bosque', 2);
      const x = ahead(c, 34);
      const img = art.poses[Math.floor(c.time * 1.5) % 2 ? 'idle2' : 'idle'];
      shadow(c.b, x, f, 10);
      put(c.b, tinted(img, c.l, c.lk), x, f, art.foot, img.h - 1, !flip);
      break;
    }
    case 'jefe':
    case 'guardian':
      boss(
        c,
        ev.kind === 'guardian' ? undefined : (ev.foe ?? 3),
        ev.kind === 'guardian' ? ev.foe : 0,
      );
      break;
  }
}

/** El jefe a la vista, al otro lado, quieto y mirando (sin número, el guardián del rumbo). */
function boss(c: Ctx, idx?: number, guard = 0): void {
  const h = c.m.heading ?? 'bosque';
  const art = idx === undefined ? expGuardianArt(h, guard) : expFoeArt(h, idx).art;
  const dir = dirOf(c);
  const x = Math.round(c.e.w / 2 + dir * c.e.w * 0.3);
  const img = foeFrame(art, Math.floor(c.time * 1.2) % 2 ? 'idle2' : 'idle', 0, c.time);
  shadow(c.b, x, c.e.feet, art.big ? 10 : 6);
  put(c.b, tinted(img, c.l, c.lk), x, c.e.feet, art.foot, img.h - 1, dir > 0);
}

/** Con un jefe a la vista, el grupo se esconde. */
export const hiding = (c: Ctx) =>
  c.m.mode === 'wait' && (c.m.event?.kind === 'jefe' || c.m.event?.kind === 'guardian');

/** Dónde se agazapa cada uno (a un lado, apretados). */
function hideX(c: Ctx, i: number): number {
  const dir = dirOf(c);
  const back = Math.round(c.e.w / 2 - dir * c.e.w * 0.27);
  return back - dir * i * (GAP - 4);
}

/** Las matas y la roca delante del grupo escondido (encima de ellos). */
export function drawEscondite(c: Ctx): void {
  if (!hiding(c)) return;
  const n = c.m.crew.length;
  const mid = (hideX(c, 0) + hideX(c, n - 1)) / 2;
  plant(c, 'escondite', 'suelo', Math.round(mid + dirOf(c) * 5), c.e.feet + 3, dirOf(c) < 0);
}

/** El grupo agazapado detrás de las matas (se asoman por turnos). */
export function drawEscondidos(c: Ctx): void {
  const dir = dirOf(c);
  const crew = c.m.crew.map((x) => heroOf(x, c.m.dress?.[x.id]));
  for (let i = crew.length - 1; i >= 0; i--) {
    const h = crew[i]!;
    const img = heroSprites(h.look, h.marks).idle[Math.abs(Math.floor(c.time * 2 + i)) % 2]!;
    const peek = Math.floor(c.time / 2.5) % crew.length === i ? 0 : 3;
    put(c.b, tinted(img, c.l, c.lk), hideX(c, i), c.e.feet + peek, 9, FEET_Y, dir < 0);
  }
}
