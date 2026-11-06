/**
 * Piezas de three.js de la vista 3D: los materiales (con su luz propia y la paleta del juego),
 * las texturas sacadas de los búferes de píxeles y los planos con los que se arma todo.
 *
 * La luz es nuestra y no la de three.js: cada foco solo alumbra dentro de su zona (la sala en
 * la que está), así no se cuela por las paredes. El color final se pasa a la paleta con un
 * tramado anclado a los téxeles de cada superficie: el tramado se mueve con lo pintado y no
 * con la pantalla, y la imagen no «bulle» al mover la cámara.
 */
import {
  BufferGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  FloatType,
  FrontSide,
  Matrix4,
  Mesh,
  NearestFilter,
  RGBAFormat,
  RepeatWrapping,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
  type Side,
  type Texture,
} from 'three';
import { P } from '../../art/palette';
import type { PixelBuffer } from '../../art/pixel';
import { SLAB } from './layout';

/**
 * Focos que caben a la vez: van en una textura (una columna por foco: posición y alcance, color
 * y halo, zona), así que pueden ser muchos; el shader solo recorre los que haya (`uLightCount`).
 */
export const MAX_LIGHTS = 256;
/** Con «pocas luces» en Ajustes: solo los más cercanos al centro de la vista. */
export const FEW_LIGHTS = 16;

const rgb = (hex: string) =>
  new Vector3(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  );

/**
 * Colores a los que se puede llegar al iluminar. Los rosas y el morado se quedan fuera: la luz
 * cálida sobre yeso o piedra caía en ellos y las paredes se veían rosas.
 */
const OFF = new Set<string>([P.hot, P.rose, P.coral, P.grape]);
const PALETTE = [...new Set<string>(Object.values(P))].filter((c) => !OFF.has(c)).map(rgb);

const SURFACE_VERT = /* glsl */ `
  uniform vec2 uUvOffset;
  uniform vec2 uUvScale;
  varying vec2 vUv;
  void main() {
    vUv = uUvOffset + uv * uUvScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SURFACE_FRAG = /* glsl */ `
  #define LIGHTS ${MAX_LIGHTS}
  #define COLORS ${PALETTE.length}
  uniform sampler2D map;
  uniform vec3 uOrigin;
  uniform vec3 uAxisU;
  uniform vec3 uAxisV;
  uniform vec3 uNormal;
  uniform vec3 uAmbient;
  uniform float uSun;
  uniform float uWrap;
  uniform float uDither;
  uniform float uHalo;
  uniform vec3 uDaylight;
  uniform highp sampler2D uLights;
  uniform int uLightCount;
  uniform vec3 uPalette[COLORS];
  uniform vec2 uUvOffset;
  uniform vec2 uUvScale;
  // Sombras de los focos (prueba): profundidad de la escena vista desde la cámara.
  uniform sampler2D uDepth;
  uniform float uShadows;
  uniform mat4 uProj;
  uniform float uRim;
  uniform float uAmbK;
  // Color sin paleta ni trama (luz con ambiente): la luz va en bandas de borde mellado.
  uniform float uBands;
  uniform float uZonePad;
  // Sol con dirección (luz con ambiente): de dónde viene y cuánto manda (0 = la luz de siempre).
  uniform vec3 uSunDir;
  uniform float uSunK;
  // Relieve de la textura (cuánto sale cada píxel, en píxeles: rojo × 255).
  uniform sampler2D uRelief;
  uniform float uHasRelief;
  varying vec2 vUv;
  float distAt(float d) {
    // Profundidad del búfer (0-1) a distancia a la cámara.
    float ndc = d * 2.0 - 1.0;
    return uProj[3][2] / (ndc + uProj[2][2]);
  }
  // Cuánto llega la luz de lp a world: se avanza por la pantalla hacia el foco y, si en algún
  // punto lo que se ve está más cerca de la cámara que el rayo (y no mucho más), hay sombra.
  float lit(vec3 world, vec3 lp0) {
    vec3 lp = lp0;
    if (uShadows < 0.5) return 1.0;
    float shade = 1.0;
    lp.z += 16.0;  // el foco, algo hacia delante: el fuego va metido en el hogar
    vec4 c0 = uProj * viewMatrix * vec4(world, 1.0);
    float d0 = distAt(c0.z / c0.w * 0.5 + 0.5);
    for (int s = 1; s < 14; s++) {
      float t = float(s) / 16.0;
      vec3 p = mix(world, lp, t);
      vec4 c = uProj * viewMatrix * vec4(p, 1.0);
      vec3 n = c.xyz / c.w;
      vec2 uv = n.xy * 0.5 + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) continue;
      float scene = distAt(texture2D(uDepth, uv).r);
      float ray = distAt(n.z * 0.5 + 0.5);
      float gap = ray - scene;
      // Lo que está a la misma profundidad que el punto de partida es su propia superficie.
      if (gap > 1.0 && gap < 9.0 && abs(scene - d0) > 2.0) shade = min(shade, 0.15 + 0.7 * t);
    }
    return shade;
  }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float relAt(vec2 uv) { return texture2D(uRelief, uv).r * 255.0; }
  // La luz del sol fuera, con su dirección: cara al sol, más y más cálida; de espaldas, la del
  // cielo, fría. Con relieve, además, la normal de cada píxel, la sombra que arrojan los
  // salientes (marchando por la textura hacia el sol) y el borde de luz en los cantos.
  vec3 sunlight(vec3 n, vec2 uvc, vec2 size) {
    if (!gl_FrontFacing) n = -n;
    float lum = max(max(uDaylight.r, uDaylight.g), uDaylight.b);
    float warmth = clamp((uDaylight.r - uDaylight.b) * 3.0, 0.0, 1.0);
    vec3 U = normalize(uAxisU);
    vec3 V = normalize(uAxisV);
    float shadow = 1.0;
    float rim = 0.0;
    if (uHasRelief > 0.5) {
      float h0 = relAt(uvc);
      float dx = relAt(uvc + vec2(1.0, 0.0) / size) - relAt(uvc - vec2(1.0, 0.0) / size);
      float dy = relAt(uvc + vec2(0.0, 1.0) / size) - relAt(uvc - vec2(0.0, 1.0) / size);
      n = normalize(n - (U * dx + V * dy) * 0.3);
      vec2 sd = vec2(dot(uSunDir, U), dot(uSunDir, V));
      float lsd = length(sd);
      if (lsd > 0.05) {
        vec2 dir = sd / lsd;
        float slope = max(dot(uSunDir, gl_FrontFacing ? uNormal : -uNormal), 0.05) / lsd;
        for (int k = 1; k <= 16; k++) {
          float fk = float(k);
          float hk = relAt(uvc + dir * fk / size);
          if (hk - h0 > fk * slope + 0.5) { shadow = 0.35; break; }
        }
        // Canto que da al sol: el vecino de ese lado está más bajo (o no hay nada).
        vec2 nb = uvc + vec2(floor(dir.x * 1.5 + 0.5), floor(dir.y * 1.5 + 0.5)) / size;
        if (texture2D(map, nb).a < 0.5 || relAt(nb) < h0 - 0.5) rim = 0.5 + warmth * 0.4;
      }
    } else {
      vec2 sd = vec2(dot(uSunDir, uAxisU) / dot(uAxisU, uAxisU), dot(uSunDir, uAxisV) / dot(uAxisV, uAxisV));
      vec2 off = sign(sd) * step(0.3 * max(abs(sd.x), abs(sd.y)), abs(sd)) / size;
      if (texture2D(map, uvc + off).a < 0.5) rim = 0.5;
    }
    float face = clamp(0.55 + 0.9 * dot(n, uSunDir), 0.15, 1.45) * shadow;
    // El color del sol, algo más saturado que el del día (dorado al atardecer); la sombra, del
    // color del cielo (violácea).
    vec3 sunC = mix(uDaylight, uDaylight * uDaylight / max(lum, 0.01) * 1.15, 0.6);
    // A la hora dorada (el día tira a rojo), el sol se vuelve naranja intenso.
    sunC = mix(sunC, vec3(1.0, 0.6, 0.28) * lum * 1.4, warmth * 0.65);
    vec3 sky = vec3(0.5, 0.52, 0.9) * lum * 0.55;
    vec3 sun = sunC * (face + rim * shadow) + sky * (1.0 - clamp(face, 0.0, 1.0));
    return mix(uDaylight, sun, uSunK);
  }
  const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  void main() {
    vec4 tex = texture2D(map, vUv);
    if (tex.a < 0.5) discard;
    // Todo se calcula en el centro del téxel: cada téxel sale de un solo color y, al mover la
    // cámara, se desplaza entero en vez de cambiar de tono a medio camino.
    vec2 size = vec2(textureSize(map, 0));
    vec2 tc = floor(vUv * size);
    vec2 uvc = (tc + 0.5) / size;
    // En un atlas de fotogramas, la posición dentro del fotograma que se ve.
    vec2 local = (uvc - uUvOffset) / uUvScale;
    vec3 world = uOrigin + uAxisU * local.x + uAxisV * local.y;
    vec3 n = uNormal;
    // Luz del día solo por encima del suelo.
    // Con «luz con ambiente», menos luz de fondo dentro de las salas.
    vec3 amb = uSun < 0.99 ? uAmbient * uAmbK : uAmbient;
    vec3 light = amb + uDaylight * uSun * step(-0.5, world.y);
    if (uSunK > 0.0 && uSun > 0.99 && world.y > -0.5) light = amb + sunlight(n, uvc, size);
    // El halo de las llamas: la luz que se ve en el aire alrededor de cada una. Se mide en la
    // pantalla (lo que queda cerca de la llama a la vista, esté delante o detrás) y se suma al
    // color antes de pasarlo a la paleta, así sale en bandas tramadas y no como un difuminado.
    vec3 halo = vec3(0.0);
    float dbg = 0.0;
    vec2 seen = cameraPosition.xy + (world.xy - cameraPosition.xy) * (cameraPosition.z / (cameraPosition.z - world.z));
    for (int i = 0; i < LIGHTS; i++) {
      if (i >= uLightCount) break;
      vec4 z = texelFetch(uLights, ivec2(i, 2), 0);
      // Con luz con ambiente, la zona se ensancha al grueso del muro: de noche, el corte
      // alrededor de una sala encendida recibe su luz.
      if (world.x < z.x - uZonePad || world.x > z.z + uZonePad || world.y < z.y || world.y > z.w) continue;
      vec4 lp = texelFetch(uLights, ivec2(i, 0), 0);
      vec4 lc = texelFetch(uLights, ivec2(i, 1), 0);
      vec3 d = lp.xyz - world;
      float dist = length(d);
      float a = clamp(1.0 - dist / lp.w, 0.0, 1.0);
      a = a * a * (3.0 - 2.0 * a);
      float ndl = mix(max(dot(n, d / max(dist, 0.001)), 0.0), 1.0, uWrap);
      if (a > 0.02) { float sh = lit(world, lp.xyz); a *= sh; if (uShadows > 1.5 && sh < 0.9) dbg = 1.0; }
      // Luz de borde en las figuras: el canto que da al foco, si al lado no hay nada pintado.
      if (uShadows > 0.5 && uRim > 0.0 && a > 0.02) {
        vec2 dir = vec2(dot(d, uAxisU) / dot(uAxisU, uAxisU), dot(d, uAxisV) / dot(uAxisV, uAxisV));
        vec2 off = sign(dir) * step(0.3 * max(abs(dir.x), abs(dir.y)), abs(dir)) / size;
        float nb = texture2D(map, uvc + off).a;
        if (nb < 0.5) light += lc.rgb * a * uRim;
      }
      light += lc.rgb * a * ndl;
      // El halo, solo dentro de la sala: la zona incluye los forjados (su canto recibe luz), pero
      // el halo del foco de abajo no debe verse a través del suelo.
      if (lc.a > 0.0 && world.y > z.y + ${SLAB.toFixed(1)} && world.y < z.w - ${SLAB.toFixed(1)}) {
        // El centro, donde se ve la llama dibujada (a su profundidad: si no, se corre al mover).
        vec3 hp = texelFetch(uLights, ivec2(i, 3), 0).xyz;
        vec2 ls = cameraPosition.xy + (hp.xy - cameraPosition.xy) * (cameraPosition.z / (cameraPosition.z - hp.z));
        float h = clamp(1.0 - length(seen - ls) / lc.a, 0.0, 1.0);
        halo += lc.rgb * h * h * 0.95;
      }
    }
    // Sin quemar: lo muy iluminado se queda en un tono claro y no salta a otro color.
    light = min(light, vec3(1.2));
    vec3 c = tex.rgb * light + min(halo, vec3(0.7)) * uHalo;
    if (uBands > 0.5) {
      // Sin paleta ni trama: la intensidad de la luz va en escalones (el tono se queda) y el
      // borde de cada escalón se mella en grumos de 2 téxeles, fijos a la superficie.
      float lum = max(max(light.r, light.g), light.b);
      float jit = (hash2(floor(tc / 2.0) + uOrigin.xy) - 0.5) * 0.45;
      float q = max(floor(lum * 7.0 + 0.5 + jit), 0.0) / 7.0;
      vec3 L = lum > 0.001 ? light / lum * q : vec3(0.0);
      // El color de lo pintado, algo menos saturado (los tonos de Endesga gritan).
      vec3 alb = mix(vec3(dot(tex.rgb, vec3(0.3, 0.59, 0.11))), tex.rgb, 0.86);
      vec3 hq = max(floor(min(halo, vec3(0.7)) * 5.0 + jit), vec3(0.0)) / 5.0;
      gl_FragColor = vec4(min(alb * L + hq * uHalo, vec3(1.0)), 1.0);
      return;
    }
    // Tramado pegado al téxel: se mueve con la superficie, no con la pantalla.
    ivec2 t = ivec2(tc);
    int k = (t.x & 3) + (t.y & 3) * 4;
    c += ((BAYER[k] + 0.5) / 16.0 - 0.5) * uDither;
    vec3 best = uPalette[0];
    float bd = 1e9;
    for (int i = 0; i < COLORS; i++) {
      // Distancia «redmean»: pesa el azul en los tonos cálidos y no los vuelve rosas.
      vec3 e = c - uPalette[i];
      float rm = (c.r + uPalette[i].r) * 0.5;
      float dd = (2.0 + rm) * e.r * e.r + 4.0 * e.g * e.g + (3.0 - rm) * e.b * e.b;
      if (dd < bd) {
        bd = dd;
        best = uPalette[i];
      }
    }
    gl_FragColor = vec4(dbg > 0.5 ? vec3(1.0, 0.0, 1.0) : best, 1.0);
  }
`;

const FLAT_VERT = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FLAT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

const GLOW_FRAG = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(map, vUv);
    if (c.a < 0.5) discard;
    gl_FragColor = vec4(c.rgb, 1.0);
  }
`;

const SCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const SCREEN_FRAG = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(map, vUv);
    if (c.a < 0.01) discard;
    gl_FragColor = c;
  }
`;

/** El relieve de un búfer como textura (en el rojo), con la misma orientación que su color. */
function reliefTexture(b: PixelBuffer): DataTexture {
  const rgba = new Uint8Array(b.w * b.h * 4);
  const r = b.relief!;
  for (let i = 0; i < r.length; i++) rgba[i * 4] = r[i]!;
  const t = new DataTexture(rgba, b.w, b.h, RGBAFormat, UnsignedByteType);
  t.flipY = true;
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** Textura sin suavizado sacada de un búfer (la fila de arriba del búfer, arriba). */
export function texture(b: PixelBuffer): DataTexture {
  const t = new DataTexture(
    new Uint8Array(b.data.buffer as ArrayBuffer, b.data.byteOffset, b.data.byteLength),
    b.w,
    b.h,
    RGBAFormat,
    UnsignedByteType,
  );
  t.flipY = true;
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** Esquinas de un plano: abajo-izquierda, abajo-derecha, arriba-derecha y arriba-izquierda. */
export type Corners = [Vector3, Vector3, Vector3, Vector3];

export interface SurfaceOpts {
  /** Luz de fondo de la superficie (0–1 por canal) y cuánta luz del día le llega. */
  ambient: readonly [number, number, number];
  sun: number;
  /** Luz que reciben aunque el foco les dé de lado (las figuras planas, mucha). */
  wrap?: number;
  dither?: number;
  side?: Side;
  /** Fotogramas puestos uno al lado del otro en la textura (se ve uno: `uUvOffset`). */
  frames?: number;
  /** Veces que la textura se repite a lo ancho del plano (el terreno lejano). */
  repeat?: number;
  /** Cuánto halo de las llamas se ve encima (la gente, poco: si no, se queda en blanco). */
  halo?: number;
}

/**
 * Textura de los focos: fila 0, posición y alcance; 1, color y radio del halo; 2, zona (x0, y0,
 * x1, y1); 3, centro del halo (la llama dibujada, que puede estar a otra profundidad que el foco).
 */
function lightsTexture(): DataTexture {
  const t = new DataTexture(
    new Float32Array(MAX_LIGHTS * 4 * 4),
    MAX_LIGHTS,
    4,
    RGBAFormat,
    FloatType,
  );
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** Uniformes que comparten todos los materiales de una escena: día, focos y paleta. */
export function sharedUniforms() {
  return {
    uDaylight: { value: new Vector3() },
    uLights: { value: lightsTexture() },
    uLightCount: { value: 0 },
    uPalette: { value: PALETTE },
    uDepth: { value: NO_DEPTH as Texture },
    uShadows: { value: 0 },
    uProj: { value: new Matrix4() },
    uAmbK: { value: 1 },
    uBands: { value: 0 },
    uZonePad: { value: 0 },
    uSunDir: { value: new Vector3(0, 1, 0) },
    uSunK: { value: 0 },
  };
}

/** Sin profundidad (la primera pasada): todo «lejos», nada hace sombra. */
const NO_DEPTH = (() => {
  const t = new DataTexture(
    new Uint8Array([255, 255, 255, 255]),
    1,
    1,
    RGBAFormat,
    UnsignedByteType,
  );
  t.needsUpdate = true;
  return t;
})();

export type Shared = ReturnType<typeof sharedUniforms>;

/** Los materiales de una escena, con los uniformes que comparten (día, focos y paleta). */
export class Look {
  private owned: { dispose(): void }[] = [];

  constructor(readonly shared: Shared = sharedUniforms()) {}

  /** Material de un plano con sus esquinas (para saber dónde cae cada téxel en el mundo). */
  surface(b: PixelBuffer, corners: Corners, o: SurfaceOpts): ShaderMaterial {
    const map = this.own(texture(b));
    if (o.repeat) map.wrapS = RepeatWrapping;
    const [a, br, , d] = corners;
    const u = new Vector3().subVectors(br, a);
    const v = new Vector3().subVectors(d, a);
    return this.own(
      new ShaderMaterial({
        uniforms: {
          ...this.shared,
          map: { value: map },
          uOrigin: { value: a.clone() },
          uAxisU: { value: u },
          uAxisV: { value: v },
          uNormal: { value: new Vector3().crossVectors(u, v).normalize() },
          uAmbient: { value: new Vector3(...o.ambient) },
          uSun: { value: o.sun },
          uWrap: { value: o.wrap ?? 0.25 },
          uDither: { value: o.dither ?? 0.035 },
          uHalo: { value: o.halo ?? 1 },
          uRim: { value: (o.wrap ?? 0.25) >= 0.5 ? 0.9 : 0 },
          uRelief: { value: b.relief ? this.own(reliefTexture(b)) : NO_DEPTH },
          uHasRelief: { value: b.relief ? 1 : 0 },
          uUvOffset: { value: new Vector2(0, 0) },
          uUvScale: { value: new Vector2((o.repeat ?? 1) / (o.frames ?? 1), 1) },
        },
        vertexShader: SURFACE_VERT,
        fragmentShader: SURFACE_FRAG,
        side: o.side ?? FrontSide,
      }),
    );
  }

  /** Dibujo que brilla por sí solo, sin luz ni paleta (las llamas): un fotograma de su tira. */
  glow(b: PixelBuffer, frames: number): ShaderMaterial {
    const map = this.own(texture(b));
    return this.own(
      new ShaderMaterial({
        uniforms: {
          map: { value: map },
          uUvOffset: { value: new Vector2(0, 0) },
          uUvScale: { value: new Vector2(1 / frames, 1) },
        },
        vertexShader: SURFACE_VERT,
        fragmentShader: GLOW_FRAG,
        side: DoubleSide,
      }),
    );
  }

  /** Color plano que brilla por sí solo. */
  flat(hex: string): ShaderMaterial {
    return this.own(
      new ShaderMaterial({
        uniforms: { uColor: { value: rgb(hex) } },
        vertexShader: FLAT_VERT,
        fragmentShader: FLAT_FRAG,
        side: DoubleSide,
      }),
    );
  }

  /** Lámina a pantalla completa con una textura (el cielo detrás y las partículas delante). */
  screen(map: Texture, overlay: boolean): ShaderMaterial {
    return this.own(
      new ShaderMaterial({
        uniforms: { map: { value: map } },
        vertexShader: SCREEN_VERT,
        fragmentShader: SCREEN_FRAG,
        depthTest: false,
        depthWrite: false,
        transparent: overlay,
      }),
    );
  }

  own<T extends { dispose(): void }>(x: T): T {
    this.owned.push(x);
    return x;
  }

  dispose(): void {
    for (const x of this.owned) x.dispose();
    this.owned = [];
  }
}

/**
 * Un plano de cuatro esquinas, en el orden de la textura. Mira hacia donde sale la regla de la
 * mano derecha con ese orden.
 */
export function quad(corners: Corners, look: Look): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute(
    'position',
    new Float32BufferAttribute(
      corners.flatMap((v) => [v.x, v.y, v.z]),
      3,
    ),
  );
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return look.own(g);
}

export const mesh = (g: BufferGeometry, m: ShaderMaterial) => new Mesh(g, m);
