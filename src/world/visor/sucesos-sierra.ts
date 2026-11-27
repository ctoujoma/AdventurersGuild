/**
 * Los sucesos del visor con material de montaña (rumbo de la sierra): la torre de vigía de
 * mampostería sobre su peña, la boca de la cueva abierta en un risco, el humilladero (cruz de
 * piedra sobre un montón de piedras con su hornacina), el refugio de pastor de losa, las ruinas de
 * una ermita con su espadaña y el escondite de piornos y un canto. Igual que los del bosque: en
 * tonos, con la luz por la izquierda, sin contorno y a escala (un héroe mide unos 22 px; la torre,
 * unas 3,5 alturas de héroe).
 */
import { canto, crag, enebro, piorno } from './capas-sierra';
import { step } from './capas';
import { tuft } from './arboles';
import { M, Tonos, hash, hash2, type Mat } from './tonos';

const grain = (x: number, y: number, s: number) => hash2(x >> 1, y >> 1, s);
const px = (t: Tonos, x: number, y: number, m: Mat, v: number) => t.set(x, y, m, step(v, x, y));

/**
 * Mampostería: piedras sin labrar en hiladas de alto desigual, cada una con su matiz, la junta
 * hundida y algo de liquen; la luz la da `shade(x, y)`.
 */
function mamposteria(
  t: Tonos,
  x0: number,
  y0: number,
  w: number,
  h: number,
  seed: number,
  inside: (x: number, y: number) => boolean,
  shade: (x: number, y: number) => number,
  lichen = 0.3,
): void {
  // Las hiladas: de 2 a 4 px.
  const rowOf = new Int16Array(h);
  const topOf = new Int16Array(h);
  const hOf = new Int16Array(h);
  for (let y = 0, r = 0; y < h; r++) {
    const rh = 2 + Math.floor(hash2(r, 1, seed) * 3);
    for (let k = 0; k < rh && y + k < h; k++) {
      rowOf[y + k] = r;
      topOf[y + k] = y;
      hOf[y + k] = rh;
    }
    y += rh;
  }
  for (let y = 0; y < h; y++) {
    const r = rowOf[y]!;
    const off = Math.floor(hash2(r, 2, seed) * 7);
    const sw = 4 + Math.floor(hash2(r, 3, seed) * 4);
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const k = Math.floor((x + off) / sw);
      // Cada piedra, algo más ancha o estrecha que sus vecinas.
      const edge = (x + off) % sw === sw - 1 && hash2(k, r, seed + 5) < 0.85;
      const joint = y === topOf[y]! + hOf[y]! - 1 || edge;
      const n = hash2(k, r, seed + 6);
      let v = shade(x, y) + (n - 0.5) * 1.3;
      if (y === topOf[y]) v += 0.45;
      if (joint) v -= 1.5;
      if (!joint && lichen && hash2(k, r, seed + 7) < lichen * 0.25 && hash2(x, y, seed) < 0.5)
        px(t, x0 + x, y0 + y, M.musgo, v - 0.3);
      else px(t, x0 + x, y0 + y, M.roca, v);
    }
  }
}

/**
 * Pinta aparte, en una tira tres veces más ancha, lo que da la vuelta (las peñas y matas del
 * paisaje pintan con `wrap`): así lo que sobresale se corta en vez de salir por el otro lado.
 */
function aparte(t: Tonos, draw: (u: Tonos, ox: number) => void): void {
  const u = new Tonos(t.w * 3, t.h);
  for (let y = 0; y < t.h; y++)
    for (let x = 0; x < t.w; x++) {
      const c = t.d[y * t.w + x]!;
      if (c) u.d[y * u.w + x + t.w] = c;
    }
  draw(u, t.w);
  for (let y = 0; y < t.h; y++)
    for (let x = 0; x < t.w; x++) {
      const c = u.d[y * u.w + x + t.w]!;
      if (c) t.d[y * t.w + x] = c;
    }
}

/** Matas al pie (que no parezca posado encima). */
function pie(t: Tonos, x0: number, x1: number, base: number, seed: number) {
  for (let x = x0; x <= x1; x += 2 + Math.floor(hash(seed + x) * 3))
    tuft(t, x, base, 2 + Math.floor(hash(seed + x * 7) * 3), seed + x, M.hierba, 0.4);
}

/** Losas de pizarra en hiladas que se montan (tejados de la sierra). */
function losas(t: Tonos, x: number, y: number, light: number, s: number) {
  const n = grain(x, y, s);
  const lip = y % 2 === 0;
  px(t, x, y, M.valla, light + (lip ? 0.5 : -0.4) + (n - 0.5) * 0.9);
}

// ---------- La torre de vigía ----------

/**
 * La torre de vigía: cuadrada y con talud, de mampostería con sillares claros en las esquinas, la
 * puerta en alto (con su escalera de mano), saeteras, los mechinales del cadalso y el remate roto;
 * plantada sobre una peña, que es de donde sale.
 */
export function torreSierra(): Tonos {
  const W = 44;
  const H = 92;
  const t = new Tonos(W, H);
  const base = H - 1;
  const rockTop = base - 13;
  // La peña de debajo (y la torre encima, que asienta en ella).
  aparte(t, (u, o) => crag(u, o + 1, base, 42, 18, 211, { lichen: 0.6, kind: 0 }));
  const fx = 10;
  const fw = 20;
  const sw = 6;
  const top = 6;
  // Talud: abajo se ensancha un poco.
  const batter = (y: number) => (y > rockTop - 10 ? Math.round((y - (rockTop - 10)) * 0.25) : 0);
  // La cara de delante (al sol de refilón) y la del lado derecho, en sombra.
  mamposteria(
    t,
    0,
    0,
    W,
    rockTop + 2,
    213,
    (x, y) => {
      const b = batter(y);
      const broken = y < top + 3 + Math.round(Math.abs(Math.sin(x * 0.9)) * 2 + (x > 24 ? 4 : 0));
      return y >= top && !broken && x >= fx - b && x < fx + fw + sw + b;
    },
    (x, y) => {
      const b = batter(y);
      if (x >= fx + fw + b * 0.5) return 1.9 - (x - fx - fw) * 0.08;
      return 3.9 - ((x - fx + b) / (fw + 2 * b)) * 1.3 - (y / H) * 0.4;
    },
    0.35,
  );
  // Sillares de esquina, más claros, alternando largo y corto.
  for (let y = top + 4; y <= rockTop; y++) {
    const r = Math.floor(y / 3);
    const long = r % 2 === 0;
    const b = batter(y);
    for (let k = 0; k < (long ? 4 : 2); k++) {
      const j = y % 3 === 2;
      px(t, fx - b + k, y, M.roca, j ? 2.6 : 4.6 - k * 0.2);
      px(t, fx + fw + b - 1 - k, y, M.roca, j ? 1.8 : 3.4 - k * 0.2);
    }
  }
  // Mechinales del cadalso (agujeros de las vigas) bajo el remate.
  for (let k = 0; k < 5; k++) {
    const x = fx + 2 + k * 4;
    t.set(x, top + 9, M.roca, 0);
    t.set(x + 1, top + 9, M.roca, 1);
  }
  // Saeteras.
  for (const [sx, sy, sh] of [
    [fx + 6, 22, 6],
    [fx + 13, 40, 5],
    [fx + fw + 2, 30, 5],
  ] as const) {
    for (let y = sy - 1; y <= sy + sh; y++) px(t, sx - 1, y, M.roca, sx > fx + fw ? 2.4 : 4.6);
    for (let y = sy; y < sy + sh; y++) t.set(sx, y, M.roca, 0);
  }
  // La puerta, en alto: arco de medio punto con dovelas y la hoja de tablas.
  const dx = fx + 9;
  const dy = rockTop - 22;
  for (let y = dy - 2; y < dy + 9; y++)
    for (let x = dx - 3; x <= dx + 3; x++) {
      const r = Math.hypot(x - dx, Math.max(0, dy + 1 - y));
      if (r > 3.6) continue;
      if (r > 2.4 && y < dy + 1) px(t, x, y, M.roca, 4.8 - (x - dx) * 0.3);
      else if (Math.abs(x - dx) > 2) px(t, x, y, M.roca, 4.4);
      else t.set(x, y, M.corteza, x === dx - 2 ? 2 : (x - dx + 9) % 2 ? 1 : 0);
    }
  // La escalera de mano, apoyada, de la peña a la puerta.
  for (let y = dy + 9; y <= rockTop + 2; y++) {
    const u = (y - dy - 9) / (rockTop + 2 - dy - 9);
    const lx = Math.round(dx - 2 - u * 5);
    t.set(lx, y, M.corteza, 3);
    t.set(lx + 4, y, M.corteza, 2);
    if ((y - dy) % 3 === 0) for (let k = 1; k < 4; k++) t.set(lx + k, y, M.corteza, 4);
  }
  // La sombra de la torre sobre la peña, a la derecha.
  for (let y = rockTop + 1; y < rockTop + 6; y++)
    for (let x = fx + fw + sw; x < fx + fw + sw + 8 - (y - rockTop); x++) {
      const c = t.get(x, y);
      if (c) t.set(x, y, (c >> 4) as Mat, Math.max(0, (c & 15) - 1));
    }
  pie(t, 2, W - 3, base, 215);
  return t;
}

// ---------- La cueva ----------

/**
 * Un risco: paredón de techo irregular a escalones, el lado izquierdo empinado y el derecho que baja
 * en gradas; caras a plomo de refilón (cada una con su luz, las aristas algo torcidas), alguna
 * repisa y liquen; arriba, el labio claro con matas.
 */
function risco(t: Tonos, base: number, s: number): void {
  const W = t.w;
  const H = base + 1;
  // El techo: ondulado y mellado (sin almenas); los lados, bajando.
  const top = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const n = noise1d(x * 0.5, s) * 4 + noise1d(x * 2, s + 1) * 1.6;
    top[x] = 2 + n;
    const u = x / W;
    if (u < 0.16) top[x] = Math.max(top[x]!, lerp1(H * 0.75, top[x]!, (u / 0.16) ** 0.7));
    if (u > 0.7) top[x] = top[x]! + ((u - 0.7) / 0.3) ** 1.3 * H * 0.62;
  }
  // Las caras: tramos de ancho desigual con las aristas inclinadas, cada uno con su luz.
  const edges: { x: number; lean: number }[] = [];
  for (let x = 0, k = 0; x < W + 12; k++) {
    x += 4 + Math.floor(hash2(k, 1, s) * 9);
    edges.push({ x, lean: (hash2(k, 2, s) - 0.5) * 0.5 });
  }
  const faceOf = (x: number, y: number) => {
    let k = 0;
    while (k < edges.length && x > edges[k]!.x + (y - H / 2) * edges[k]!.lean) k++;
    return k;
  };
  // Dos o tres repisas largas e inclinadas.
  const ledges = [0, 1, 2].map((k) => ({
    y: H * (0.3 + k * 0.22) + (hash2(k, 4, s) - 0.5) * 4,
    slope: (hash2(k, 5, s) - 0.5) * 0.12,
    a: hash2(k, 6, s) * W * 0.4,
    b: W * (0.5 + hash2(k, 7, s) * 0.4),
  }));
  for (let x = 0; x < W; x++) {
    const tp = Math.round(top[x]!);
    for (let y = tp; y <= base; y++) {
      const k = faceOf(x, y);
      const u = x / W;
      let v = 3.8 - u * 1.5 + (hash2(k, 3, s) - 0.5) * 1.2;
      // Junto a la arista de su izquierda, la cara se aclara (le da el sol de refilón).
      if (faceOf(x - 1, y) !== k) v += 0.6;
      if (y - tp < 1) v += 1.1;
      else if (y - tp < 2) v -= 0.5;
      for (const L of ledges)
        if (x > L.a && x < L.b) {
          const ly = Math.round(L.y + x * L.slope);
          if (y === ly) v += 0.8;
          else if (y === ly + 1) v -= 1.2;
        }
      v += (grain(x, y, s + 5) - 0.5) * 0.5 - ((y - tp) / H) * 0.6;
      if (y === base) v = 0.8;
      const lich = u < 0.6 && hash2(x >> 1, y >> 1, s + 6) < 0.05;
      px(t, x, y, lich ? M.musgo : M.roca, lich ? v - 0.4 : v);
    }
    // Matas en el labio de arriba.
    if (hash2(x, 7, s) < 0.35) t.set(x, tp - 1, M.musgo, 3);
    if (hash2(x, 8, s) < 0.15) t.set(x, tp - 1, M.hierba, 4);
  }
}

const lerp1 = (a: number, b: number, k: number) => a + (b - a) * k;
const noise1d = (y: number, s: number) => {
  const i = Math.floor(y / 4);
  const f = y / 4 - i;
  const a = hash2(i, 9, s);
  const b = hash2(i + 1, 9, s);
  return a + (b - a) * f;
};

/** La boca de la cueva en un risco: roca en estratos, boca honda y desigual, canchal al pie. */
export function cuevaSierra(): Tonos {
  const W = 76;
  const H = 46;
  const t = new Tonos(W, H);
  const base = H - 1;
  // El risco: una peña ancha y alta, de techo irregular.
  risco(t, base, 221);
  // La boca: un arco bajo y torcido, oscuro hacia dentro, con el labio de roca encima.
  const mx = 38;
  const mw = 11;
  const mh = 20;
  const lim = (y: number) => {
    const dy = (base - y) / mh;
    if (dy > 1) return -1;
    return mw * Math.sqrt(Math.max(0, 1 - dy ** 2.4)) * (0.9 + 0.2 * hash2(y >> 1, 3, 222));
  };
  for (let y = base - mh - 2; y <= base; y++) {
    const L = lim(y);
    for (let x = mx - mw - 3; x <= mx + mw + 3; x++) {
      const d = x + 0.5 - mx - (base - y) * 0.15;
      if (L < 0 || Math.abs(d) > L + 2) continue;
      // El borde: a la izquierda en sombra (la boca mira al sol de lado), a la derecha, algo claro.
      if (Math.abs(d) > L) px(t, x, y, M.roca, d < 0 ? 1 : 2.4);
      else {
        const deep = 1 - Math.abs(d) / Math.max(1, L);
        t.set(x, y, M.roca, deep > 0.35 || y < base - mh * 0.6 ? 0 : 1);
      }
    }
  }
  // El labio de encima: una repisa clara.
  for (let x = mx - mw - 2; x <= mx + mw + 2; x++) {
    const y = base - mh - 3 + Math.round(Math.abs(x - mx) * 0.12);
    px(t, x, y, M.roca, 4.6 - (x - mx) * 0.05);
    px(t, x, y + 1, M.roca, 1.4);
  }
  // Canchal al pie: piedras sueltas a los lados de la boca.
  for (let k = 0; k < 14; k++) {
    const side = k % 2 ? 1 : -1;
    const x = Math.round(mx + side * (mw + 3 + hash(k * 7 + 3) * 16));
    const w = 3 + Math.floor(hash(k * 11) * 5);
    aparte(t, (u, o) =>
      canto(u, o + x, base - Math.floor(hash(k * 13) * 2), w, 1 + Math.floor(w * 0.4), 230 + k, {
        lichen: 0.4,
      }),
    );
  }
  // Un enebro en lo alto y matas al pie.
  aparte(t, (u, o) => enebro(u, o + 14, base - 30, 14, 3, 241));
  aparte(t, (u, o) => piorno(u, o + W - 10, base, 9, 5, 242, 0.3));
  pie(t, 2, W - 3, base, 243);
  return t;
}

// ---------- El humilladero ----------

/** El humilladero: un montón de piedras con su hornacina (velas) y la cruz de piedra encima. */
export function santuarioSierra(): Tonos {
  const W = 24;
  const H = 36;
  const t = new Tonos(W, H);
  const base = H - 1;
  const cx = 12;
  // El montón: piedras apiladas, cada vez menos anchas.
  let y = base;
  let w = 18;
  let r = 0;
  while (w > 5) {
    const rh = 3;
    for (let k = 0; k < Math.ceil(w / 4); k++) {
      const sx = Math.round(cx - w / 2 + k * 4 + (r % 2) * 2);
      aparte(t, (u, o) => canto(u, o + sx + 2, y, 5, rh, 250 + r * 7 + k, { lichen: 0.5 }));
    }
    y -= rh - 1;
    w -= 2;
    r++;
  }
  const cairnTop = y;
  // La hornacina: un hueco oscuro con dos velas.
  for (let yy = base - 7; yy <= base - 3; yy++)
    for (let x = cx - 2; x <= cx + 2; x++) t.set(x, yy, M.roca, x === cx - 2 ? 1 : 0);
  for (let x = cx - 3; x <= cx + 3; x++) px(t, x, base - 8, M.roca, 4.6);
  t.set(cx - 1, base - 3, M.nieve, 5);
  t.set(cx - 1, base - 4, M.mies, 5);
  t.set(cx + 1, base - 3, M.nieve, 4);
  t.set(cx + 1, base - 4, M.mies, 5);
  // La cruz de piedra: fuste, brazos y la luz por la izquierda.
  const ch = 20;
  for (let yy = cairnTop - ch; yy <= cairnTop + 1; yy++)
    for (let x = cx - 1; x <= cx + 1; x++)
      px(t, x, yy, M.roca, x < cx ? 4.6 : x === cx ? 3.6 : 2 + (yy === cairnTop - ch ? 1 : 0));
  for (let x = cx - 5; x <= cx + 5; x++)
    for (let yy = cairnTop - ch + 4; yy <= cairnTop - ch + 5; yy++)
      px(t, x, yy, M.roca, (yy === cairnTop - ch + 4 ? 4.4 : 2.4) - (x - cx) * 0.12);
  // Un ramo de flores a los pies y matas.
  t.set(cx + 4, base - 1, M.flor, 3);
  t.set(cx + 5, base - 2, M.flor, 4);
  t.set(cx + 4, base - 2, M.hierba, 3);
  pie(t, 1, W - 2, base, 255);
  return t;
}

/** Dónde brillan las velas del humilladero (desde el centro de su base). */
export const VELAS_SIERRA: [number, number][] = [
  [-1, 4],
  [1, 4],
];

// ---------- El refugio de pastor ----------

/** El refugio de pastor: chabola baja de piedra seca con tejado de losa, la puerta y un banco. */
export function refugio(): Tonos {
  const W = 42;
  const H = 26;
  const t = new Tonos(W, H);
  const base = H - 1;
  const x0 = 6;
  const w = 28;
  const wallTop = base - 11;
  mamposteria(
    t,
    x0,
    wallTop,
    w,
    12,
    261,
    () => true,
    (x) => 3.9 - (x / w) * 1.5,
    0.5,
  );
  // El tejado de losa a un agua, que vuela un poco y baja hacia la derecha.
  for (let j = 0; j < 7; j++) {
    const y = wallTop - 7 + j;
    for (let x = x0 - 2; x < x0 + w + 2; x++) {
      const slope = Math.round((x - x0) * 0.12);
      if (j < slope) continue;
      losas(t, x, y, j === slope ? 4.2 : 2.8 - j * 0.1, 262);
    }
  }
  // La puerta (hueca y oscura) con su dintel de madera.
  const dx = x0 + 9;
  for (let y = base - 8; y <= base; y++)
    for (let x = dx; x < dx + 5; x++) t.set(x, y, M.roca, x === dx ? 1 : 0);
  for (let x = dx - 1; x <= dx + 5; x++) t.set(x, base - 9, M.corteza, 3);
  // Un banco de piedra y leña apilada.
  for (let x = x0 + 17; x < x0 + 25; x++) {
    px(t, x, base - 3, M.roca, 4.4);
    t.set(x, base - 2, M.roca, 1);
  }
  for (let k = 0; k < 3; k++)
    for (let x = x0 + w + 1; x < x0 + w + 6; x++) t.set(x, base - k, M.corteza, k === 2 ? 4 : 2);
  pie(t, 1, W - 2, base, 265);
  return t;
}

// ---------- La ermita en ruinas ----------

/** Las ruinas de una ermita: un muro roto con la espadaña (sin campana) y piedras caídas. */
export function ruinasSierra(): Tonos {
  const W = 64;
  const H = 58;
  const t = new Tonos(W, H);
  const base = H - 1;
  const gx = 14;
  const gw = 13;
  const gTop = 7;
  // El muro, cada vez más bajo hacia la derecha, roto a mordiscos.
  const wallTop = (x: number) =>
    x < gx + gw
      ? gTop + 10
      : 22 + (x - gx - gw) * 0.55 + Math.abs(Math.sin(x * 0.7)) * 4 + hash(x * 3) * 2;
  const arch = (x: number, y: number) =>
    // El vano de la espadaña y la puerta de la nave (en arco).
    (y >= gTop + 3 &&
      y < gTop + 14 &&
      Math.hypot(x + 0.5 - (gx + gw / 2), Math.max(0, gTop + 7 - y)) < 3.6) ||
    (y >= base - 13 && Math.hypot(x + 0.5 - 40, Math.max(0, base - 9 - y)) < 4.5);
  mamposteria(
    t,
    0,
    0,
    56,
    H,
    271,
    (x, y) => {
      if (arch(x, y)) return false;
      if (x >= gx && x < gx + gw) {
        // La espadaña: un piñón que remata en punta.
        const half = gw / 2;
        return y >= gTop + Math.abs(x + 0.5 - (gx + half)) * 0.6;
      }
      return x >= 2 && y >= wallTop(x);
    },
    (x) => 4 - (x / 56) * 1.3,
    0.5,
  );
  // El hondo de los vanos (se ve el cielo por la espadaña: hueco; por la puerta, la nave oscura).
  for (let y = base - 13; y <= base; y++)
    for (let x = 35; x <= 45; x++) if (arch(x, y)) t.set(x, y, M.roca, x < 38 ? 1 : 0);
  // La campana, colgada en el vano (bronce viejo, la luz por la izquierda).
  const bx = gx + Math.floor(gw / 2);
  for (let y = gTop + 6; y < gTop + 12; y++) {
    const hw = y < gTop + 8 ? 1 : y < gTop + 11 ? 2 : 3;
    for (let x = bx - hw; x <= bx + hw - 1; x++)
      t.set(x, y, M.tierra, x < bx - hw + 1 ? 5 : x < bx ? 4 : y === gTop + 11 ? 1 : 2);
  }
  t.set(bx, gTop + 5, M.corteza, 1);
  // El remate de la espadaña: una losa y la cruz de hierro torcida.
  for (let x = gx + 4; x < gx + gw - 4; x++) px(t, x, gTop - 1, M.roca, 4.6);
  for (let y = gTop - 6; y < gTop - 1; y++)
    t.set(gx + gw / 2 + (y < gTop - 4 ? 1 : 0), y, M.valla, 1);
  t.set(gx + gw / 2 - 1, gTop - 4, M.valla, 1);
  t.set(gx + gw / 2 + 2, gTop - 4, M.valla, 1);
  // Piedras caídas y matas que lo comen.
  for (let k = 0; k < 7; k++) {
    const x = 30 + Math.round(hash(k * 5 + 1) * 32);
    const w = 3 + Math.floor(hash(k * 9) * 4);
    aparte(t, (u, o) =>
      canto(u, o + x, base - Math.floor(hash(k * 3) * 2), w, 2, 280 + k, { lichen: 0.5 }),
    );
  }
  aparte(t, (u, o) => piorno(u, o + 4, base, 8, 5, 291, 0.2));
  aparte(t, (u, o) => piorno(u, o + 56, base, 10, 6, 292, 0.2));
  aparte(t, (u, o) => enebro(u, o + 26, base, 12, 3, 293));
  pie(t, 1, W - 2, base, 295);
  return t;
}

// ---------- El escondite ----------

/** Los piornos y el canto tras los que se esconde el grupo ante el jefe. */
export function esconditeSierra(): Tonos {
  const W = 48;
  const H = 18;
  const t = new Tonos(W, H);
  const base = H - 1;
  aparte(t, (u, o) => piorno(u, o + 9, base, 17, 12, 301, 0.04));
  aparte(t, (u, o) => piorno(u, o + 22, base, 19, 14, 302, 0.04));
  aparte(t, (u, o) => piorno(u, o + 33, base, 14, 10, 303, 0.02));
  aparte(t, (u, o) => canto(u, o + 42, base, 11, 8, 304, { lichen: 0.7 }));
  pie(t, 1, W - 2, base, 305);
  return t;
}
