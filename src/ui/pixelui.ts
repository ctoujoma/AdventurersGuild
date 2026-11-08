import { P } from '../art/palette';
import { PixelBuffer, bayer } from '../art/pixel';

/**
 * Piezas de interfaz en pixel art generadas al arrancar (marcos 9-slice, texturas y
 * botones). Se vuelcan como variables CSS para usarlas con border-image y background.
 */

function dataUrl(b: PixelBuffer): string {
  const c = document.createElement('canvas');
  c.width = b.w;
  c.height = b.h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(b.w, b.h);
  img.data.set(new Uint8Array(b.data.buffer, b.data.byteOffset, b.data.byteLength));
  ctx.putImageData(img, 0, 0);
  return `url(${c.toDataURL()})`;
}

/** Marco de madera con remaches dorados (24×24, corte 8). */
function woodFrame(): PixelBuffer {
  const b = new PixelBuffer(24, 24);
  b.rect(0, 0, 24, 24, P.black);
  b.rect(1, 1, 22, 22, P.bark);
  b.rect(2, 2, 20, 20, P.rust);
  b.hline(2, 2, 20, P.oak);
  b.vline(2, 2, 20, P.oak);
  b.hline(2, 21, 20, P.plum);
  b.vline(21, 2, 20, P.plum);
  for (let x = 3; x < 21; x += 4) {
    b.set(x, 4, P.bark);
    b.set(x + 1, 19, P.bark);
  }
  b.rect(6, 6, 12, 12, P.black);
  b.rect(7, 7, 10, 10, 0);
  for (let y = 7; y < 17; y++) for (let x = 7; x < 17; x++) b.clear(x, y);
  for (const [x, y] of [
    [3, 3],
    [19, 3],
    [3, 19],
    [19, 19],
  ]) {
    b.rect(x!, y!, 2, 2, P.gold);
    b.set(x!, y!, P.lemon);
    b.set(x! + 1, y! + 1, P.orange);
  }
  return b;
}

/** Pergamino con borde quemado (16×16, corte 5). */
function parchment(): PixelBuffer {
  const b = new PixelBuffer(16, 16);
  b.rect(0, 0, 16, 16, P.black);
  b.rect(1, 1, 14, 14, P.clay);
  b.rect(2, 2, 12, 12, P.tan);
  b.rect(3, 3, 10, 10, P.sand);
  b.set(1, 1, P.black);
  b.set(14, 1, P.black);
  b.set(1, 14, P.black);
  b.set(14, 14, P.black);
  b.set(2, 2, P.clay);
  b.set(13, 13, P.clay);
  return b;
}

/** Panel oscuro biselado para la barra superior y las pestañas (12×12, corte 4). */
function darkPanel(): PixelBuffer {
  const b = new PixelBuffer(12, 12);
  b.rect(0, 0, 12, 12, P.black);
  b.rect(1, 1, 10, 10, P.navy);
  b.hline(1, 1, 10, P.slate);
  b.vline(1, 1, 10, P.slate);
  b.hline(1, 10, 10, P.black);
  b.rect(3, 3, 6, 6, P.navy);
  return b;
}

/**
 * Ranura de inventario (16×16, corte 6): aro biselado del metal de la rareza (hierro, azul, oro),
 * esquinas en escalón y el hueco de pergamino hundido con un bisel de madera suave.
 */
function slotFrame(dark: string, mid: string, light: string): PixelBuffer {
  const n = 16;
  const b = new PixelBuffer(n, n);
  b.rect(0, 0, n, n, P.black);
  b.rect(1, 1, n - 2, n - 2, mid);
  b.hline(1, 1, n - 2, light);
  b.vline(1, 1, n - 2, light);
  b.hline(1, n - 2, n - 2, dark);
  b.vline(n - 2, 1, n - 2, dark);
  // El hueco: sombra arriba y a la izquierda, luz abajo y a la derecha.
  b.rect(3, 3, n - 6, n - 6, P.tan);
  b.hline(3, 3, n - 6, P.clay);
  b.vline(3, 3, n - 6, P.clay);
  b.rect(4, 4, n - 7, n - 7, P.sand);
  b.hline(4, 4, n - 7, P.tan);
  b.vline(4, 4, n - 7, P.tan);
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [n - 1, 0],
    [n - 2, 0],
    [n - 1, 1],
    [0, n - 1],
    [1, n - 1],
    [0, n - 2],
    [n - 1, n - 1],
    [n - 2, n - 1],
    [n - 1, n - 2],
  ])
    b.clear(x!, y!);
  for (const [x, y] of [
    [1, 1],
    [n - 2, 1],
    [1, n - 2],
    [n - 2, n - 2],
  ])
    b.set(x!, y!, P.black);
  b.set(2, 2, light);
  b.set(n - 3, n - 3, dark);
  return b;
}

function button(face: string, light: string, dark: string, down: boolean): PixelBuffer {
  const b = new PixelBuffer(12, 12);
  b.rect(0, 0, 12, 12, P.black);
  b.rect(1, 1, 10, 10, face);
  if (!down) {
    b.hline(1, 1, 10, light);
    b.vline(1, 1, 9, light);
    b.hline(1, 9, 10, dark);
    b.hline(1, 10, 10, dark);
    b.vline(10, 2, 8, dark);
  } else {
    b.hline(1, 1, 10, dark);
    b.vline(1, 1, 10, dark);
    b.hline(1, 10, 10, light);
  }
  b.set(0, 0, 0);
  b.set(11, 0, 0);
  b.set(0, 11, 0);
  b.set(11, 11, 0);
  return b;
}

function cork(): PixelBuffer {
  const b = new PixelBuffer(32, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const f = n - Math.floor(n);
      b.set(x, y, f > 0.86 ? P.tan : f < 0.18 ? P.rust : P.clay);
    }
  }
  return b;
}

function planks(): PixelBuffer {
  const b = new PixelBuffer(32, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const row = Math.floor(y / 8);
      const seam = y % 8 === 7 || (x + row * 13) % 32 === 0;
      const grain = (x * 7 + y * 3 + row * 5) % 19 === 0;
      b.set(
        x,
        y,
        seam
          ? P.black
          : grain
            ? P.plum
            : y % 8 === 0
              ? P.rust
              : bayer(x, y) > 0.85
                ? P.rust
                : P.bark,
      );
    }
  }
  return b;
}

function paperTex(): PixelBuffer {
  const b = new PixelBuffer(32, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const n = Math.sin(x * 4.1 + y * 9.7) * 999.1;
      const f = n - Math.floor(n);
      // Motas suaves: que se note el papel sin ensuciar la letra.
      b.set(x, y, f > 0.94 ? '#e6c79d' : P.sand);
    }
  }
  return b;
}

let installed = false;

export function installPixelUi(): void {
  if (installed) return;
  installed = true;
  const root = document.documentElement.style;
  root.setProperty('--frame-wood', dataUrl(woodFrame()));
  root.setProperty('--frame-parchment', dataUrl(parchment()));
  root.setProperty('--frame-dark', dataUrl(darkPanel()));
  // Marcos de los objetos, uno por nivel (`art/tiers.ts`): gris, verde, azul, morado y oro.
  root.setProperty('--frame-slot-0', dataUrl(slotFrame(P.slate, P.steel, P.fog)));
  root.setProperty('--frame-slot-t1', dataUrl(slotFrame(P.forest, P.leaf, P.lime)));
  root.setProperty('--frame-slot-1', dataUrl(slotFrame(P.ocean, P.sky, P.mist)));
  root.setProperty('--frame-slot-t3', dataUrl(slotFrame(P.plum, P.grape, P.rose)));
  root.setProperty('--frame-slot-2', dataUrl(slotFrame(P.orange, P.gold, P.lemon)));
  root.setProperty('--btn-gold', dataUrl(button(P.gold, P.lemon, P.orange, false)));
  root.setProperty('--btn-gold-down', dataUrl(button(P.orange, P.lemon, P.brick, true)));
  root.setProperty('--btn-wood', dataUrl(button(P.rust, P.oak, P.plum, false)));
  root.setProperty('--btn-wood-down', dataUrl(button(P.bark, P.rust, P.black, true)));
  root.setProperty('--tex-cork', dataUrl(cork()));
  root.setProperty('--tex-planks', dataUrl(planks()));
  root.setProperty('--tex-paper', dataUrl(paperTex()));
}
