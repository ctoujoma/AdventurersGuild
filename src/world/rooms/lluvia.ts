/**
 * La lluvia y la nieve: una lámina a pantalla completa, calculada en el shader por téxeles del mundo (sin
 * líneas finas: cada gota es una escalera de téxeles en diagonal). Va en dos pasadas: la capa de
 * lejos, por detrás de todo lo 3D (se ve entre los árboles y por las ventanas), y las dos de cerca
 * por delante, con una máscara para que no llueva dentro de las salas ni bajo tierra. En la de
 * cerca, además, las salpicaduras sobre el suelo y los tejados (tramos `uSeg`) y el goteo de los
 * aleros (`uEave`). Barata: unas pocas cuentas por píxel y ninguna textura grande.
 */
import {
  DataTexture,
  NearestFilter,
  RedFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
} from 'three';
import { GROUND } from '../geometry';
import { floorTop, roofRuns, SLAB, STAIR_W, WALL, type RoomsLayout } from './layout';

export const MAX_SEGS = 16;
export const MAX_EAVES = 12;
export const MAX_GLOWS = 6;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec4 uView;      // px, py, vw, vh (mundo)
  uniform float uTime;
  uniform float uRain;     // 0–1
  uniform float uSnow;     // 0–1: copos en vez de gotas
  uniform float uWind;     // 0–1: los copos derivan de lado
  uniform vec3 uFlake;
  uniform float uSlant;    // téxeles en x por cada uno que baja
  uniform float uNear;     // 1: las capas de cerca (con máscara); 0: la de lejos
  uniform float uCover;    // la tapa de la vista desde fuera: sin máscara de salas
  uniform float uSplash;   // 0 con «pocas luces»
  uniform vec3 uColor;
  uniform vec3 uHead;
  uniform sampler2D uMask;
  uniform vec4 uMaskAt;    // x0, y0, ancho, alto (mundo) de la máscara
  uniform vec4 uSeg[${MAX_SEGS}];
  uniform int uSegN;
  uniform vec4 uEave[${MAX_EAVES}];
  uniform int uEaveN;
  // Los faroles de fuera: x, y (mundo), radio y fuerza; las gotas cerca, de su color.
  uniform vec4 uGlow[${MAX_GLOWS}];
  uniform vec3 uGlowC[${MAX_GLOWS}];
  uniform int uGlowN;
  varying vec2 vUv;

  float h21(vec2 p) {
    p = fract(p * vec2(0.1031, 0.1030));
    p += dot(p, p.yx + 33.33);
    return fract((p.x + p.y) * p.x);
  }

  // Una capa de gotas: celdas de cell.x × cell.y téxeles en la diagonal; en cada una, como mucho
  // una gota de lenMin a lenMax de largo. Devuelve 0 (nada), 1 (cuerpo) o 2 (la cabeza).
  float drops(vec2 q, vec2 cell, float dens, float lenMin, float lenMax, float speed, float seed) {
    float u = q.x - floor(q.y * uSlant);
    float v = q.y - floor(uTime * speed);
    vec2 c = floor(vec2(u, v) / cell);
    if (h21(c + seed) > dens) return 0.0;
    float ox = floor(h21(c + seed + 7.1) * cell.x);
    float len = floor(mix(lenMin, lenMax + 0.99, h21(c + seed + 3.7)));
    float oy = floor(h21(c + seed + 13.3) * (cell.y - len));
    float lu = u - c.x * cell.x;
    float lv = v - c.y * cell.y - oy;
    if (abs(lu - ox) > 0.5 || lv < 0.0 || lv >= len) return 0.0;
    return lv >= len - 1.0 ? 2.0 : 1.0;
  }

  // Una capa de copos: en celdas de cell.x × cell.y, como mucho uno de big téxeles de lado que
  // cae despacio y se mece a un lado y a otro (sin salirse de su celda).
  float flakes(vec2 q, vec2 cell, float dens, float speed, float sway, float big, float seed) {
    float v = q.y - floor(uTime * speed);
    float u = q.x - floor(uTime * speed * uWind * 0.8);
    vec2 c = floor(vec2(u, v) / cell);
    float h = h21(c + seed);
    if (h > dens) return 0.0;
    float ox = sway + floor(h21(c + seed + 7.1) * (cell.x - 2.0 * sway - big + 1.0));
    float oy = floor(h21(c + seed + 13.3) * (cell.y - big + 1.0));
    float sw = floor(sin(uTime * (0.9 + h * 0.8) + h * 40.0) * sway + 0.5);
    vec2 d = vec2(u - c.x * cell.x - ox - sw, v - c.y * cell.y - oy);
    return d.x >= 0.0 && d.y >= 0.0 && d.x < big && d.y < big ? 1.0 : 0.0;
  }

  void main() {
    // El téxel de la pantalla y su sitio en el mundo (y hacia abajo).
    vec2 f = floor(vec2(vUv.x * uView.z, (1.0 - vUv.y) * uView.w));
    vec2 w = f + floor(uView.xy);
    float a = 0.0;
    vec3 col = uColor;
    if (uNear < 0.5) {
      // Lejos: más pequeñas, tenues y lentas; con su paralaje (se mueven menos que el mundo).
      vec2 q = f + floor(uView.xy * 0.6);
      if (uSnow > 0.01) {
        if (flakes(q, vec2(5.0, 7.0), 0.5 * uSnow, 8.0, 1.0, 1.0, 1.0) > 0.0) { a = 0.6; col = uFlake * 0.88; }
      } else {
        float d = drops(q, vec2(4.0, 15.0), 0.62 * uRain + 0.1, 2.0, 3.0, 55.0, 1.0);
        if (d > 0.0) a = 0.36 + 0.1 * (d - 1.0);
      }
    } else {
      if (w.y >= ${GROUND.toFixed(1)}) discard;
      // Dentro de las salas no llueve (salvo con la tapa de la vista desde fuera).
      vec2 m = w - uMaskAt.xy;
      if (uCover < 0.5 && m.x >= 0.0 && m.y >= 0.0 && m.x < uMaskAt.z && m.y < uMaskAt.w &&
          texelFetch(uMask, ivec2(m), 0).r > 0.5) discard;
      vec2 q1 = f + floor(uView.xy * 0.8);
      if (uSnow > 0.01) {
        // Copos: los de cerca, de 2 × 2 y más deprisa; los de en medio, de uno.
        if (flakes(w, vec2(17.0, 19.0), 0.38 * uSnow, 21.0, 2.0, 2.0, 43.0) > 0.0) a = 1.0;
        else if (flakes(q1, vec2(8.0, 10.0), 0.45 * uSnow, 13.0, 1.0, 1.0, 21.0) > 0.0) a = 0.9;
        if (a > 0.0) { col = uFlake; a *= min(1.0, uSnow * 1.6); }
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
        return;
      }
      float d1 = drops(q1, vec2(6.0, 22.0), 0.55 * uRain + 0.05, 3.0, 4.0, 80.0, 21.0);
      vec2 q2 = w;
      float d2 = drops(q2, vec2(11.0, 34.0), 0.5 * uRain, 4.0, 6.0, 115.0, 43.0);
      if (d2 > 0.0) { a = 0.66 + 0.2 * (d2 - 1.0); if (d2 > 1.5) col = uHead; }
      else if (d1 > 0.0) a = 0.48 + 0.12 * (d1 - 1.0);
      // Salpicaduras: en el téxel justo encima de cada tramo (suelo, vertientes), una corona
      // que vive tres fotogramas y vuelve a salir en otro sitio.
      if (uSplash > 0.5 && a == 0.0) {
        for (int i = 0; i < ${MAX_SEGS}; i++) {
          if (i >= uSegN) break;
          vec4 s = uSeg[i];
          if (w.x < s.x - 2.0 || w.x > s.z + 2.0) continue;
          float t = (w.x - s.x) / max(1.0, s.z - s.x);
          float yl = floor(mix(s.y, s.w, clamp(t, 0.0, 1.0)));
          float dy = yl - w.y;  // téxeles por encima del tramo
          if (dy < 0.0 || dy > 2.0) continue;
          float cellX = floor(w.x / 9.0);
          float ph = floor(uTime * 14.0 + h21(vec2(cellX, float(i))) * 37.0);
          float slot = floor(ph / 3.0);
          float k = ph - slot * 3.0;
          if (h21(vec2(cellX, slot) + float(i) * 5.0) > 0.35 + 0.4 * uRain) continue;
          float cx = cellX * 9.0 + 2.0 + floor(h21(vec2(cellX, slot + 0.5)) * 5.0);
          float dx = w.x - cx;
          float hit = 0.0;
          if (k < 1.0) hit = (dx == 0.0 && dy == 1.0) ? 0.7 : 0.0;
          else if (k < 2.0) hit = (abs(dx) == 1.0 && dy == 1.0) ? 0.65 : (dx == 0.0 && dy == 0.0 ? 0.4 : 0.0);
          else hit = (abs(dx) == 2.0 && dy == 1.0) ? 0.4 : (abs(dx) == 1.0 && dy == 0.0 ? 0.3 : 0.0);
          if (hit > 0.0) { a = hit; col = uHead; break; }
        }
      }
      // Goteo de los aleros: cada gota cuelga, cae y vuelve a formarse.
      if (a == 0.0) {
        for (int i = 0; i < ${MAX_EAVES}; i++) {
          if (i >= uEaveN) break;
          vec4 e = uEave[i];
          if (w.x < e.x || w.x > e.y || w.y <= e.z || w.y > e.z + e.w) continue;
          float slot = floor((w.x - e.x) / 13.0);
          float cx = e.x + slot * 13.0 + 3.0 + floor(h21(vec2(slot, e.z)) * 7.0);
          if (w.x != cx) continue;
          float per = 1.6 + h21(vec2(slot, e.z + 1.0)) * 1.4;
          float ph = fract(uTime / per + h21(vec2(slot, e.z + 2.0)));
          float dy = w.y - e.z;
          if (ph < 0.35) { if (dy <= 1.0) a = 0.35 + ph; }
          else {
            float y = 1.0 + (ph - 0.35) / 0.65 * e.w * 1.4;
            if (dy <= y && dy > y - 2.0) a = dy > y - 1.0 ? 0.75 : 0.4;
          }
          if (a > 0.0) { col = uHead; break; }
        }
      }
    }
    // Cerca de un farol, la gota se enciende de su color (en tres anillos, sin degradado).
    if (a > 0.0) {
      for (int i = 0; i < ${MAX_GLOWS}; i++) {
        if (i >= uGlowN) break;
        vec4 g = uGlow[i];
        float k = 1.0 - length(w - g.xy) / g.z;
        if (k <= 0.0) continue;
        k = ceil(k * 3.0) / 3.0 * g.w;
        col = mix(col, uGlowC[i], min(1.0, k * 0.85));
        a = min(1.0, a + k * 0.25);
      }
    }
    a *= min(1.0, max(uRain, uSnow) * 1.6);
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
  }
`;

/** La lámina de la lluvia: la de lejos (`near` falso) o la de cerca. */
export function rainMaterial(near: boolean, mask: DataTexture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uView: { value: new Vector4() },
      uTime: { value: 0 },
      uRain: { value: 0 },
      uSnow: { value: 0 },
      uWind: { value: 0 },
      uFlake: { value: new Vector3(1, 1, 1) },
      uSlant: { value: 0.34 },
      uNear: { value: near ? 1 : 0 },
      uCover: { value: 0 },
      uSplash: { value: 1 },
      uColor: { value: new Vector3(0.72, 0.77, 0.86) },
      uHead: { value: new Vector3(0.88, 0.91, 0.96) },
      uMask: { value: mask },
      uMaskAt: { value: new Vector4() },
      uSeg: { value: Array.from({ length: MAX_SEGS }, () => new Vector4()) },
      uSegN: { value: 0 },
      uEave: { value: Array.from({ length: MAX_EAVES }, () => new Vector4()) },
      uEaveN: { value: 0 },
      uGlow: { value: Array.from({ length: MAX_GLOWS }, () => new Vector4()) },
      uGlowC: { value: Array.from({ length: MAX_GLOWS }, () => new Vector3()) },
      uGlowN: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

/** Una máscara vacía (mientras no hay edificio). */
export function emptyMask(): DataTexture {
  const t = new DataTexture(new Uint8Array(1), 1, 1, RedFormat, UnsignedByteType);
  t.needsUpdate = true;
  return t;
}

/**
 * Dónde no llueve: las salas con sus muros y forjados, en téxeles del mundo (1 = dentro).
 * Devuelve la textura y su rectángulo en el mundo.
 */
export function rainMask(L: RoomsLayout): { tex: DataTexture; at: Vector4 } {
  const pad = Math.max(WALL, SLAB);
  const x0 = Math.floor(L.left - pad - 8);
  const x1 = Math.ceil(L.right + pad + 8);
  const y0 = Math.floor(Math.min(...L.rooms.map((r) => r.rect.y)) - pad - 4);
  const y1 = GROUND;
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const data = new Uint8Array(w * h);
  const fill = (rx: number, ry: number, rw: number, rh: number) => {
    const a = Math.max(0, Math.floor(rx - x0));
    const b = Math.min(w, Math.ceil(rx + rw - x0));
    const c = Math.max(0, Math.floor(ry - y0));
    const d = Math.min(h, Math.ceil(ry + rh - y0));
    for (let y = c; y < d; y++) data.fill(255, y * w + a, y * w + b);
  };
  for (const { rect } of L.rooms)
    fill(rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 2);
  for (const s of L.stairs) {
    const fl = [...s.floors, ...s.halls];
    if (!fl.length) continue;
    const top = floorTop(Math.max(...fl)) - pad;
    fill(s.x - pad, top, STAIR_W + pad * 2, GROUND - top);
  }
  const tex = new DataTexture(data, w, h, RedFormat, UnsignedByteType);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.needsUpdate = true;
  return { tex, at: new Vector4(x0, y0, w, h) };
}

/**
 * Los tramos donde salpica (el suelo a lo ancho y las dos vertientes de cada tejado) y los
 * aleros que gotean (el pie de cada vertiente), en coordenadas del mundo.
 */
export function rainSurfaces(L: RoomsLayout): { segs: Vector4[]; eaves: Vector4[] } {
  const segs: Vector4[] = [new Vector4(L.x0, GROUND, L.x1, GROUND)];
  const eaves: Vector4[] = [];
  for (const run of roofRuns(L)) {
    const mid = (run.x0 + run.x1) / 2;
    const ridge = run.base - run.h;
    segs.push(new Vector4(run.x0, run.base, mid, ridge), new Vector4(mid, ridge, run.x1, run.base));
    eaves.push(
      new Vector4(run.x0, run.x0 + 8, run.base + 2, 40),
      new Vector4(run.x1 - 8, run.x1, run.base + 2, 40),
    );
  }
  return { segs: segs.slice(0, MAX_SEGS), eaves: eaves.slice(0, MAX_EAVES) };
}

const GLASS_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GLASS_FRAG = /* glsl */ `
  uniform vec2 uSize;     // téxeles del cristal
  uniform float uTime;
  uniform float uWet;     // gotas quietas (se secan despacio)
  uniform float uRain;    // las que bajan
  uniform float uSeed;
  varying vec2 vUv;
  float h21(vec2 p) {
    p = fract(p * vec2(0.1031, 0.1030));
    p += dot(p, p.yx + 33.33);
    return fract((p.x + p.y) * p.x);
  }
  void main() {
    // Téxel del cristal, con y hacia abajo.
    vec2 t = floor(vec2(vUv.x, 1.0 - vUv.y) * uSize);
    vec3 hi = vec3(0.86, 0.9, 0.96);
    vec3 dk = vec3(0.16, 0.18, 0.26);
    vec4 c = vec4(0.0);
    // Las quietas: en celdas de 4 × 5, alguna gota de uno o de dos téxeles (luz arriba y
    // sombra abajo).
    vec2 cell = floor(t / vec2(4.0, 5.0));
    float r = h21(cell + uSeed);
    if (r < 0.7 * uWet) {
      vec2 o = cell * vec2(4.0, 5.0) + floor(vec2(h21(cell + uSeed + 2.0) * 2.0, h21(cell + uSeed + 5.0) * 3.0));
      vec2 d = t - o;
      bool big = h21(cell + uSeed + 9.0) > 0.6;
      if (d == vec2(0.0)) c = vec4(hi, 0.75);
      else if (big && d == vec2(1.0, 0.0)) c = vec4(hi * 0.85, 0.6);
      else if (d == vec2(0.0, 1.0) || (big && d == vec2(1.0, 1.0))) c = vec4(dk, 0.45);
    }
    // Las que bajan: por columnas, una gota que resbala a tirones con su reguero encima.
    float col = floor(t.x / 4.0);
    if (c.a == 0.0 && h21(vec2(col, uSeed)) < 0.7 * uRain && mod(t.x, 4.0) == floor(h21(vec2(col, uSeed + 1.0)) * 4.0)) {
      float per = uSize.y + 14.0;
      float sp = 3.0 + h21(vec2(col, uSeed + 3.0)) * 5.0;
      // A tirones: se para y sigue.
      float tt = uTime * sp;
      float y = mod(floor(tt + 4.0 * sin(tt * 0.35 + col)), per) - 6.0;
      float dy = y - t.y;
      if (dy == 0.0) c = vec4(hi, 0.85);
      else if (dy == -1.0) c = vec4(dk, 0.5);
      else if (dy > 0.0 && dy < 7.0) c = vec4(hi, 0.45 - dy * 0.04);
    }
    if (c.a < 0.01) discard;
    gl_FragColor = c;
  }
`;

/** Las gotas en un cristal de `w` × `h` téxeles visto desde dentro. */
export function glassMaterial(w: number, h: number, seed: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uSize: { value: new Vector2(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))) },
      uTime: { value: 0 },
      uWet: { value: 0 },
      uRain: { value: 0 },
      uSeed: { value: seed },
    },
    vertexShader: GLASS_VERT,
    fragmentShader: GLASS_FRAG,
    transparent: true,
    depthWrite: false,
  });
}
