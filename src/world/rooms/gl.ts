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
  Mesh,
  NearestFilter,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
  type Side,
  type Texture,
} from 'three';
import { P } from '../../art/palette';
import type { PixelBuffer } from '../../art/pixel';

/**
 * Focos que caben a la vez: van en una textura (una columna por foco: posición y alcance, color,
 * zona), así que pueden ser muchos; el shader solo recorre los que haya (`uLightCount`).
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
  uniform vec3 uDaylight;
  uniform highp sampler2D uLights;
  uniform int uLightCount;
  uniform vec3 uPalette[COLORS];
  uniform vec2 uUvOffset;
  uniform vec2 uUvScale;
  varying vec2 vUv;
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
    vec3 light = uAmbient + uDaylight * uSun * step(-0.5, world.y);
    for (int i = 0; i < LIGHTS; i++) {
      if (i >= uLightCount) break;
      vec4 z = texelFetch(uLights, ivec2(i, 2), 0);
      if (world.x < z.x || world.x > z.z || world.y < z.y || world.y > z.w) continue;
      vec4 lp = texelFetch(uLights, ivec2(i, 0), 0);
      vec3 d = lp.xyz - world;
      float dist = length(d);
      float a = clamp(1.0 - dist / lp.w, 0.0, 1.0);
      a = a * a * (3.0 - 2.0 * a);
      float ndl = mix(max(dot(n, d / max(dist, 0.001)), 0.0), 1.0, uWrap);
      light += texelFetch(uLights, ivec2(i, 1), 0).rgb * a * ndl;
    }
    // Sin quemar: lo muy iluminado se queda en un tono claro y no salta a otro color.
    light = min(light, vec3(1.2));
    vec3 c = tex.rgb * light;
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
    gl_FragColor = vec4(best, 1.0);
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
}

/** Textura de los focos: fila 0, posición y alcance; 1, color; 2, zona (x0, y0, x1, y1). */
function lightsTexture(): DataTexture {
  const t = new DataTexture(
    new Float32Array(MAX_LIGHTS * 3 * 4),
    MAX_LIGHTS,
    3,
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
  };
}

export type Shared = ReturnType<typeof sharedUniforms>;

/** Los materiales de una escena, con los uniformes que comparten (día, focos y paleta). */
export class Look {
  private owned: { dispose(): void }[] = [];

  constructor(readonly shared: Shared = sharedUniforms()) {}

  /** Material de un plano con sus esquinas (para saber dónde cae cada téxel en el mundo). */
  surface(b: PixelBuffer, corners: Corners, o: SurfaceOpts): ShaderMaterial {
    const map = this.own(texture(b));
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
          uUvOffset: { value: new Vector2(0, 0) },
          uUvScale: { value: new Vector2(1 / (o.frames ?? 1), 1) },
        },
        vertexShader: SURFACE_VERT,
        fragmentShader: SURFACE_FRAG,
        side: o.side ?? FrontSide,
      }),
    );
  }

  /** Color plano que brilla por sí solo (las llamas). */
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
