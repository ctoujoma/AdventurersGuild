import { Rng } from '../core/rng';
import { P, R, darker, type Ramp } from '../art/palette';
import { PixelBuffer, bayer, toHex } from '../art/pixel';
import { cobweb, planksH, stoneWall } from './paint';

/**
 * Muebles y objetos de la taberna. Cada pieza se pinta en su propio búfer, recibe un
 * contorno selectivo (un tono más oscuro que su borde) y se coloca en el mundo.
 */

const W = R.wood; // [black, plum, bark, rust, oak, clay, tan]

/** Crea una pieza con contorno selectivo. */
export function piece(
  w: number,
  h: number,
  draw: (b: PixelBuffer) => void,
  outline: 'sel' | 'black' | 'none' = 'sel',
): PixelBuffer {
  const b = new PixelBuffer(w, h);
  draw(b);
  if (outline === 'none') return b;
  return b.outlined((n) => (outline === 'black' ? P.black : darker(toHex(n), 2)));
}

// ---------- Dormitorio y enfermería ----------

export function bunk(level: number): PixelBuffer {
  const quilt: Ramp = [
    [P.plum, P.bark, P.rust, P.oak],
    [P.plum, P.bark, P.rust, P.oak],
    [P.plum, P.wine, P.red, P.coral],
    [P.navy, P.ocean, P.sky, P.mist],
  ][level]!;
  return piece(24, 40, (b) => {
    for (const px of [0, 21]) {
      b.rect(px, 0, 3, 40, W[3]!);
      b.vline(px, 0, 40, W[4]!);
      b.vline(px + 2, 0, 40, W[2]!);
      b.rect(px, 0, 3, 2, W[5]!);
    }
    for (const my of [6, 26]) {
      // Somier y colchón.
      b.rect(3, my + 6, 18, 3, W[3]!);
      b.hline(3, my + 6, 18, W[4]!);
      b.hline(3, my + 8, 18, W[1]!);
      b.rect(3, my + 1, 18, 5, P.sand);
      b.hline(3, my + 5, 18, P.tan);
      // Almohada.
      b.rect(3, my - 1, 6, 4, P.white);
      b.hline(3, my + 2, 6, P.mist);
      b.set(8, my - 1, P.mist);
      // Manta.
      b.rect(8, my, 13, 6, quilt[2]!);
      b.hline(8, my, 13, quilt[3]!);
      b.hline(8, my + 5, 13, quilt[1]!);
      b.vline(8, my, 6, quilt[1]!);
      if (level >= 2) for (let x = 10; x < 21; x += 4) b.vline(x, my + 1, 4, quilt[1]!);
      if (level >= 3) {
        for (let x = 9; x < 21; x += 4)
          for (let y = my + 1; y < my + 5; y += 2) b.set(x + ((y / 2) % 2), y, P.gold);
      }
    }
    // Escalerilla.
    for (let y = 8; y < 30; y += 5) b.hline(21, y, 3, W[2]!);
  });
}

export function cot(): PixelBuffer {
  return piece(28, 14, (b) => {
    b.rect(1, 9, 2, 5, W[3]!);
    b.rect(25, 9, 2, 5, W[3]!);
    b.rect(0, 7, 28, 3, W[4]!);
    b.hline(0, 7, 28, W[5]!);
    b.hline(0, 9, 28, W[2]!);
    b.rect(0, 3, 28, 4, P.white);
    b.hline(0, 6, 28, P.mist);
    b.rect(1, 0, 7, 4, P.white);
    b.hline(1, 3, 7, P.fog);
    b.rect(20, 2, 8, 5, P.ocean);
    b.hline(20, 2, 8, P.sky);
    b.hline(20, 6, 8, P.navy);
  });
}

export function strawMat(): PixelBuffer {
  return piece(22, 5, (b) => {
    b.ellipse(11, 4, 11, 4, P.amber);
    b.ellipse(11, 4.5, 9, 2.5, P.gold);
    for (let x = 1; x < 21; x += 3) b.set(x, 1 + (x % 2), P.lemon);
  });
}

export function cabinet(glow: boolean): PixelBuffer {
  return piece(22, 30, (b) => {
    b.rect(0, 0, 22, 30, W[3]!);
    b.rect(2, 2, 18, 26, W[1]!);
    b.hline(0, 0, 22, W[5]!);
    for (const sy of [10, 19]) b.rect(2, sy, 18, 2, W[4]!);
    const colors: Ramp[] = [
      [P.forest, P.lime],
      [P.grape, P.rose],
      [P.ocean, P.cyan],
      [P.wine, P.coral],
      [P.rust, P.gold],
    ];
    let k = 0;
    for (const sy of [10, 19, 28]) {
      for (let x = 3; x < 19; x += 4) {
        const c = colors[k++ % colors.length]!;
        const tall = (x + sy) % 3 === 0;
        const h = tall ? 6 : 4;
        b.rect(x, sy - h, 3, h, glow ? c[1]! : c[0]!);
        b.set(x + 1, sy - h - 1, W[4]!);
        b.set(x, sy - h + 1, glow ? P.white : c[1]!);
      }
    }
  });
}

export function screen(): PixelBuffer {
  return piece(20, 26, (b) => {
    for (let i = 0; i < 3; i++) {
      const x = i * 7;
      b.rect(x, 0, 6, 24, W[3]!);
      b.rect(x + 1, 1, 4, 22, i === 1 ? P.mist : P.white);
      b.vline(x + 4, 1, 22, P.fog);
      b.rect(x + 1, 24, 1, 2, W[2]!);
      b.rect(x + 4, 24, 1, 2, W[2]!);
    }
  });
}

export function smallTable(): PixelBuffer {
  return piece(12, 12, (b) => {
    b.rect(0, 0, 12, 2, W[5]!);
    b.hline(0, 1, 12, W[3]!);
    b.rect(1, 2, 2, 10, W[3]!);
    b.rect(9, 2, 2, 10, W[3]!);
    b.rect(3, 6, 6, 1, W[2]!);
  });
}

export function washbasin(): PixelBuffer {
  return piece(12, 16, (b) => {
    b.rect(2, 6, 8, 10, W[3]!);
    b.rect(3, 7, 6, 4, W[2]!);
    b.ellipse(6, 5, 6, 2, P.mist);
    b.ellipse(6, 5, 4, 1, P.sky);
    b.rect(8, 0, 2, 5, P.fog);
    b.set(9, 0, P.white);
  });
}

// ---------- Sala común ----------

export function roundTable(cloth: boolean): PixelBuffer {
  return piece(26, 14, (b) => {
    b.rect(11, 4, 4, 8, W[3]!);
    b.vline(11, 4, 8, W[4]!);
    b.vline(14, 4, 8, W[2]!);
    b.ellipse(13, 12.5, 7, 1.6, W[2]!);
    b.ellipse(13, 2.5, 13, 2.5, W[5]!);
    b.hline(1, 3, 24, W[3]!);
    b.hline(2, 4, 22, W[2]!);
    b.hline(4, 1, 18, W[6]!);
    if (cloth) {
      b.ellipse(13, 2.5, 13, 2.5, P.coral);
      b.rect(0, 3, 26, 4, P.red);
      b.hline(0, 3, 26, P.coral);
      for (let x = 0; x < 26; x += 4) b.rect(x, 7, 2, 1, P.red);
      b.hline(0, 6, 26, P.wine);
    }
  });
}

export function stool(): PixelBuffer {
  return piece(9, 10, (b) => {
    b.rect(0, 0, 9, 3, W[4]!);
    b.hline(0, 0, 9, W[5]!);
    b.hline(0, 2, 9, W[2]!);
    b.rect(1, 3, 2, 7, W[3]!);
    b.rect(6, 3, 2, 7, W[3]!);
    b.hline(2, 7, 5, W[2]!);
  });
}

export function counter(level: number): PixelBuffer {
  return piece(66, 18, (b) => {
    b.rect(0, 3, 66, 15, W[2]!);
    // Paneles.
    for (let i = 0; i < 4; i++) {
      const x = 3 + i * 16;
      b.rect(x, 6, 13, 9, W[1]!);
      b.rect(x + 1, 7, 11, 7, W[3]!);
      b.hline(x + 1, 7, 11, W[4]!);
      b.vline(x + 1, 7, 7, W[4]!);
      b.rect(x + 3, 9, 7, 3, W[2]!);
      b.hline(x + 3, 11, 7, W[4]!);
    }
    // Tablero.
    b.rect(0, 0, 66, 4, W[5]!);
    b.hline(0, 0, 66, W[6]!);
    b.hline(0, 3, 66, W[3]!);
    for (let x = 4; x < 62; x += 9) b.hline(x, 2, 4, W[4]!);
    // Barra de latón para los pies.
    if (level >= 2) {
      b.hline(0, 15, 66, P.gold);
      b.hline(0, 16, 66, P.orange);
    } else b.hline(0, 16, 66, W[1]!);
    b.hline(0, 17, 66, W[1]!);
  });
}

/** Botella pequeña de estantería. */
function bottleOn(b: PixelBuffer, x: number, base: number, kind: number): void {
  const colors: Ramp[] = [
    [P.deep, P.forest, P.leaf],
    [P.plum, P.wine, P.red],
    [P.navy, P.ocean, P.sky],
    [P.rust, P.amber, P.gold],
    [P.plum, P.grape, P.rose],
    [P.steel, P.fog, P.mist],
  ];
  const c = colors[kind % colors.length]!;
  const shape = kind % 4;
  if (shape === 0) {
    // Vino: alta y estrecha.
    b.rect(x, base - 8, 3, 8, c[1]!);
    b.rect(x + 1, base - 10, 1, 2, c[1]!);
    b.set(x + 1, base - 11, W[4]!);
    b.vline(x, base - 7, 5, c[2]!);
    b.rect(x, base - 5, 3, 2, P.sand);
  } else if (shape === 1) {
    // Redonda.
    b.ellipse(x + 2, base - 3, 2.5, 3, c[1]!);
    b.rect(x + 1, base - 8, 2, 3, c[1]!);
    b.set(x + 1, base - 9, W[4]!);
    b.set(x + 1, base - 4, c[2]!);
  } else if (shape === 2) {
    // Cuadrada.
    b.rect(x, base - 6, 4, 6, c[1]!);
    b.rect(x + 1, base - 8, 2, 2, c[1]!);
    b.vline(x, base - 6, 5, c[2]!);
    b.set(x + 1, base - 9, P.mist);
  } else {
    // Jarra de barro.
    b.ellipse(x + 2.5, base - 3, 3, 3, P.clay);
    b.rect(x + 1, base - 7, 3, 2, P.clay);
    b.set(x + 4, base - 5, P.clay);
    b.set(x + 1, base - 4, P.tan);
  }
}

export function shelf(w: number, items: number, seed: string, mugs = false): PixelBuffer {
  return piece(w, 14, (b) => {
    const rng = new Rng(seed);
    b.rect(0, 11, w, 3, W[4]!);
    b.hline(0, 11, w, W[5]!);
    b.hline(0, 13, w, W[2]!);
    let x = 2;
    for (let i = 0; i < items && x < w - 5; i++) {
      if (mugs) {
        b.rect(x, 5, 4, 6, P.oak);
        b.hline(x, 5, 4, P.sand);
        b.vline(x + 4, 6, 3, P.oak);
        b.set(x, 6, P.tan);
        x += 6;
      } else {
        bottleOn(b, x, 11, rng.int(0, 11));
        x += rng.int(4, 6);
      }
    }
  });
}

export function keg(): PixelBuffer {
  return piece(18, 18, (b) => {
    b.ellipse(9, 9, 9, 9, W[3]!);
    b.ellipse(9, 9, 7, 7, W[4]!);
    b.ellipse(8, 8, 4, 4, W[5]!);
    for (const r of [8.2, 5.2]) {
      for (let a = 0; a < 64; a++) {
        const t = (a / 64) * Math.PI * 2;
        b.set(
          Math.round(9 + Math.cos(t) * r - 0.5),
          Math.round(9 + Math.sin(t) * r - 0.5),
          P.slate,
        );
      }
    }
    b.rect(8, 13, 3, 3, P.steel);
    b.set(9, 16, P.fog);
    b.set(6, 6, W[6]!);
  });
}

export function kegStand(count: number): PixelBuffer {
  return piece(22, 40, (b) => {
    b.rect(1, 18, 2, 22, W[3]!);
    b.rect(19, 18, 2, 22, W[3]!);
    b.rect(0, 36, 22, 3, W[2]!);
    b.rect(0, 18, 22, 2, W[3]!);
    if (count >= 1) b.blit(keg(), 1, 19);
    if (count >= 2) b.blit(keg(), 1, -1);
  });
}

export function noticeBoard(papers: number, wanted: boolean): PixelBuffer {
  return piece(38, 28, (b) => {
    b.rect(0, 0, 38, 28, W[3]!);
    b.rect(0, 0, 38, 2, W[5]!);
    b.vline(0, 0, 28, W[4]!);
    b.hline(0, 27, 38, W[1]!);
    b.rect(2, 2, 34, 24, P.clay);
    const rng = new Rng('corcho');
    for (let i = 0; i < 120; i++)
      b.set(2 + rng.int(0, 33), 2 + rng.int(0, 23), rng.chance(0.5) ? P.oak : P.tan);
    const slots = [
      [4, 4],
      [15, 3],
      [26, 5],
      [6, 15],
      [17, 14],
      [27, 15],
    ];
    for (let i = 0; i < Math.min(papers, slots.length); i++) {
      const [px, py] = slots[i]!;
      const tilt = i % 2;
      b.rect(px!, py!, 8, 9, P.sand);
      b.rect(px! + 1, py! + 1, 8, 9, P.tan);
      b.rect(px!, py!, 8, 9, P.sand);
      b.hline(px!, py! + 8, 8, P.tan);
      for (let l = 0; l < 3; l++) b.hline(px! + 1, py! + 3 + l * 2, 6 - ((l + tilt) % 3), P.oak);
      b.set(px! + 4, py!, P.red);
      b.set(px! + 4, py! - 1, P.wine);
    }
    if (wanted) {
      // Cartel de «Se busca» con una cara dibujada.
      b.rect(27, 14, 9, 11, P.sand);
      b.hline(28, 15, 7, P.wine);
      b.ellipse(31.5, 19.5, 2, 2, P.oak);
      b.rect(29, 22, 5, 1, P.oak);
      b.set(31, 13, P.slate);
    }
    // Daga clavada.
    b.line(2, 24, 7, 19, P.fog);
    b.set(1, 25, W[2]!);
    b.set(0, 26, W[2]!);
  });
}

export function fireplace(level: number): PixelBuffer {
  return piece(56, 54, (b) => {
    // Cuerpo de piedra.
    stoneWall(b, 0, 14, 56, 40, 'hogar', {
      bw: 8,
      bh: 5,
      ramp: [P.black, P.navy, P.slate, P.steel, P.fog],
    });
    // Boca en arco.
    for (let y = 24; y < 54; y++) {
      for (let x = 12; x < 44; x++) {
        const dx = (x + 0.5 - 28) / 16;
        const dy = (y + 0.5 - 38) / 14;
        if (y >= 38 || dx * dx + dy * dy <= 1) b.set(x, y, y > 50 ? P.plum : P.black);
      }
    }
    // Hollín y piedras del arco.
    for (let x = 12; x < 44; x++) {
      const dx = (x + 0.5 - 28) / 16.6;
      const yy = Math.round(38 - Math.sqrt(Math.max(0, 1 - dx * dx)) * 14.6);
      b.set(x, yy - 1, P.fog);
      b.set(x, yy, P.steel);
    }
    for (let y = 28; y < 38; y++) b.set(28 + ((y * 7) % 5) - 2, y, P.navy);
    // Morillos de hierro.
    b.rect(16, 46, 2, 8, P.slate);
    b.rect(38, 46, 2, 8, P.slate);
    b.set(16, 45, P.steel);
    b.set(38, 45, P.steel);
    if (level > 0) {
      // Troncos.
      b.rect(15, 49, 26, 4, W[2]!);
      b.hline(15, 49, 26, W[3]!);
      b.ellipse(16, 51, 2, 2, W[5]!);
      b.ellipse(40, 51, 2, 2, W[5]!);
      b.rect(19, 46, 18, 3, W[3]!);
      b.ellipse(36, 47.5, 1.5, 1.5, W[6]!);
    } else {
      b.ellipse(28, 52, 12, 2, P.steel);
      b.ellipse(28, 52.5, 8, 1.5, P.fog);
    }
    if (level >= 2) {
      // Caldero colgado.
      b.vline(28, 24, 8, P.slate);
      b.ellipse(28, 38, 7, 6, P.navy);
      b.ellipse(28, 37, 6, 5, P.slate);
      b.hline(21, 33, 15, P.steel);
      b.ellipse(28, 33, 6, 1, P.forest);
      b.set(25, 36, P.fog);
    }
    // Repisa.
    b.rect(-2, 10, 60, 5, W[4]!);
    b.hline(-2, 10, 60, W[5]!);
    b.hline(-2, 14, 60, W[2]!);
    // Tiro.
    stoneWall(b, 16, 0, 24, 10, 'tiro', { bw: 8, bh: 5 });
  });
}

export function antlers(): PixelBuffer {
  return piece(24, 16, (b) => {
    b.ellipse(12, 12, 5, 4, W[4]!);
    b.ellipse(12, 12.5, 3.5, 3, W[5]!);
    b.set(10, 11, P.black);
    b.set(14, 11, P.black);
    b.rect(9, 14, 6, 2, W[3]!);
    for (const s of [-1, 1]) {
      const cx = 12 + s * 4;
      b.line(cx, 9, cx + s * 6, 2, P.sand);
      b.line(cx + s * 3, 6, cx + s * 2, 1, P.sand);
      b.line(cx + s * 5, 4, cx + s * 8, 2, P.sand);
      b.line(cx + s * 6, 3, cx + s * 7, 0, P.tan);
    }
  });
}

export function lute(): PixelBuffer {
  return piece(12, 26, (b) => {
    b.ellipse(6, 19, 5.5, 6, W[5]!);
    b.ellipse(6, 19, 4, 4.5, W[4]!);
    b.ellipse(6, 17, 1.5, 1.5, P.black);
    b.rect(5, 3, 2, 12, W[2]!);
    b.rect(4, 0, 4, 4, W[3]!);
    b.vline(6, 4, 18, P.mist);
    b.rect(4, 22, 4, 1, W[1]!);
    b.set(3, 1, P.fog);
    b.set(8, 2, P.fog);
  });
}

export function dartboard(): PixelBuffer {
  return piece(13, 13, (b) => {
    b.ellipse(6.5, 6.5, 6.5, 6.5, P.black);
    b.ellipse(6.5, 6.5, 5.5, 5.5, P.sand);
    b.ellipse(6.5, 6.5, 4, 4, P.wine);
    b.ellipse(6.5, 6.5, 2.5, 2.5, P.sand);
    b.ellipse(6.5, 6.5, 1, 1, P.red);
    b.line(8, 4, 11, 1, P.fog);
    b.set(11, 0, P.red);
    b.line(4, 7, 1, 9, P.fog);
  });
}

export function sconce(): PixelBuffer {
  return piece(7, 10, (b) => {
    b.rect(2, 4, 3, 2, P.slate);
    b.rect(1, 6, 5, 2, P.steel);
    b.rect(3, 8, 1, 2, P.slate);
    b.rect(2, 1, 3, 4, P.white);
    b.vline(4, 1, 4, P.mist);
  });
}

export function chandelier(): PixelBuffer {
  return piece(30, 16, (b) => {
    b.vline(15, 0, 8, P.slate);
    b.ellipse(15, 11, 13, 2.5, P.slate);
    b.ellipse(15, 11, 11, 1.5, P.black);
    for (const x of [3, 9, 15, 21, 27]) {
      b.rect(x - 1, 6, 3, 4, P.white);
      b.vline(x + 1, 6, 4, P.mist);
      b.rect(x - 1, 10, 3, 1, P.steel);
    }
    b.ellipse(15, 14, 2, 2, P.steel);
  });
}

export function hanging(kind: number): PixelBuffer {
  if (kind % 3 === 0) {
    // Jamón.
    return piece(8, 16, (b) => {
      b.vline(4, 0, 4, P.sand);
      b.ellipse(4, 10, 4, 6, P.wine);
      b.ellipse(3.5, 9, 2.6, 4, P.red);
      b.rect(3, 3, 3, 2, P.sand);
      b.set(2, 8, P.coral);
    });
  }
  if (kind % 3 === 1) {
    // Ristra de ajos.
    return piece(6, 18, (b) => {
      b.vline(3, 0, 18, P.tan);
      for (let y = 3; y < 18; y += 3) {
        b.ellipse(2 + ((y / 3) % 2), y + 1, 2, 1.6, P.mist);
        b.set(2, y, P.white);
      }
    });
  }
  // Manojo de hierbas.
  return piece(7, 14, (b) => {
    b.vline(3, 0, 4, P.tan);
    b.rect(2, 4, 3, 2, W[3]!);
    for (let i = 0; i < 7; i++) b.line(3, 6, i, 13, i % 2 ? P.leaf : P.forest);
    b.set(1, 12, P.lime);
    b.set(5, 11, P.lime);
  });
}

export function rug(w: number, ramp: Ramp): PixelBuffer {
  return piece(
    w,
    3,
    (b) => {
      b.rect(0, 0, w, 3, ramp[2]!);
      b.hline(0, 0, w, ramp[3]!);
      for (let x = 2; x < w - 2; x += 4) b.set(x, 1, ramp[1]!);
      for (let x = 0; x < w; x += 2) b.set(x, 2, ramp[1]!);
    },
    'none',
  );
}

export function firewood(): PixelBuffer {
  return piece(16, 14, (b) => {
    const logs = [
      [3, 11],
      [8, 11],
      [13, 11],
      [5.5, 7],
      [10.5, 7],
      [8, 3],
    ];
    for (const [x, y] of logs) {
      b.ellipse(x!, y!, 2.6, 2.6, W[3]!);
      b.ellipse(x!, y!, 1.6, 1.6, W[5]!);
      b.set(Math.floor(x!), Math.floor(y!), W[4]!);
    }
  });
}

export function windowFrame(
  w: number,
  h: number,
  opts: { curtains?: boolean; broken?: boolean; color?: Ramp } = {},
): PixelBuffer {
  return piece(w + 4, h + 4, (b) => {
    b.rect(0, 0, w + 4, h + 4, W[3]!);
    b.hline(0, 0, w + 4, W[5]!);
    b.vline(0, 0, h + 4, W[4]!);
    // Cristal nocturno: degradado con reflejo de luna.
    for (let y = 2; y < h + 2; y++) {
      for (let x = 2; x < w + 2; x++) {
        const t = (y - 2) / h;
        b.set(x, y, opts.broken ? P.black : t < 0.4 + bayer(x, y) * 0.3 ? P.slate : P.navy);
      }
    }
    if (!opts.broken) {
      b.line(3, 4, 5, 2, P.fog);
      b.line(3, 6, 7, 2, P.steel);
      b.set(w - 1, h - 1, P.steel);
      b.rect(2 + Math.floor(w / 2), 2, 1, h, W[3]!);
      b.rect(2, 2 + Math.floor(h / 2), w, 1, W[3]!);
    } else {
      for (let i = 0; i < w + 4; i++) {
        b.rect(i, 3 + Math.floor(i * 0.45), 1, 3, W[4]!);
        b.rect(i, h - 2 - Math.floor(i * 0.3), 1, 3, W[3]!);
      }
      b.set(2, 3, P.black);
    }
    // Alféizar.
    b.rect(-1, h + 2, w + 6, 2, W[4]!);
    if (opts.curtains) {
      const c = opts.color ?? [P.plum, P.wine, P.red, P.coral];
      for (const side of [0, 1]) {
        const x0 = side === 0 ? 0 : w;
        b.rect(x0, 0, 4, h + 3, c[2]!);
        b.vline(x0 + (side === 0 ? 0 : 3), 0, h + 3, c[1]!);
        b.vline(x0 + 1, 0, h + 3, c[3]!);
      }
      b.rect(-1, 0, w + 6, 2, W[2]!);
    }
  });
}

// ---------- Bodega ----------

export function cask(): PixelBuffer {
  return piece(28, 30, (b) => {
    b.rect(2, 24, 4, 6, W[3]!);
    b.rect(22, 24, 4, 6, W[3]!);
    b.rect(0, 24, 28, 3, W[2]!);
    b.ellipse(14, 13, 13, 13, W[3]!);
    b.ellipse(14, 13, 11, 11, W[4]!);
    b.ellipse(12.5, 11.5, 6, 6, W[5]!);
    for (const r of [12, 8, 4.5]) {
      for (let a = 0; a < 90; a++) {
        const t = (a / 90) * Math.PI * 2;
        b.set(
          Math.round(14 + Math.cos(t) * r - 0.5),
          Math.round(13 + Math.sin(t) * r - 0.5),
          r > 11 ? P.slate : W[2]!,
        );
      }
    }
    b.rect(12, 21, 4, 3, P.steel);
    b.set(13, 24, P.fog);
    b.set(8, 7, W[6]!);
  });
}

export function wineRack(): PixelBuffer {
  return piece(40, 32, (b) => {
    b.rect(0, 0, 40, 32, W[2]!);
    for (let y = 2; y < 30; y += 7) {
      for (let x = 2; x < 38; x += 7) {
        b.ellipse(x + 2.5, y + 2.5, 3, 3, W[0]!);
        if ((x * 3 + y) % 5 !== 0) {
          b.ellipse(x + 2.5, y + 2.5, 2, 2, (x + y) % 3 ? P.deep : P.wine);
          b.set(x + 2, y + 2, (x + y) % 3 ? P.leaf : P.coral);
        }
      }
    }
    b.hline(0, 0, 40, W[4]!);
  });
}

export function chest(open = false): PixelBuffer {
  return piece(16, 12, (b) => {
    b.rect(0, 4, 16, 8, W[3]!);
    b.rect(0, 0, 16, 5, W[4]!);
    b.hline(0, 0, 16, W[5]!);
    b.hline(0, 4, 16, P.gold);
    b.hline(0, 11, 16, W[1]!);
    for (const x of [2, 13]) b.vline(x, 0, 12, P.orange);
    b.rect(7, 4, 2, 3, P.gold);
    b.set(7, 6, P.black);
    if (open) b.hline(2, 3, 12, P.lemon);
  });
}

export function sack(): PixelBuffer {
  return piece(12, 11, (b) => {
    b.ellipse(6, 7, 6, 4.5, P.tan);
    b.ellipse(5, 6, 4, 3, P.sand);
    b.rect(4, 0, 4, 3, P.tan);
    b.hline(3, 3, 6, P.clay);
  });
}

export function crate(): PixelBuffer {
  return piece(14, 12, (b) => {
    b.rect(0, 0, 14, 12, W[4]!);
    b.rect(0, 0, 14, 2, W[5]!);
    b.rect(0, 10, 14, 2, W[3]!);
    b.line(1, 2, 12, 9, W[3]!);
    b.vline(0, 0, 12, W[3]!);
    b.vline(13, 0, 12, W[3]!);
  });
}

export function barrel(): PixelBuffer {
  return piece(12, 15, (b) => {
    b.ellipse(6, 7.5, 6, 7.5, W[3]!);
    b.rect(1, 2, 10, 11, W[4]!);
    b.vline(3, 2, 11, W[5]!);
    b.hline(0, 3, 12, P.slate);
    b.hline(0, 11, 12, P.slate);
    b.ellipse(6, 1.5, 5, 1.5, W[5]!);
  });
}

export function cheeseShelf(): PixelBuffer {
  return piece(30, 24, (b) => {
    for (const y of [10, 22]) {
      b.rect(0, y, 30, 2, W[4]!);
      b.hline(0, y, 30, W[5]!);
    }
    b.rect(0, 0, 2, 24, W[3]!);
    b.rect(28, 0, 2, 24, W[3]!);
    for (const [x, y] of [
      [4, 10],
      [13, 10],
      [6, 22],
      [17, 22],
    ]) {
      b.ellipse(x! + 3.5, y! - 2.5, 4, 2.5, P.gold);
      b.hline(x!, y! - 3, 8, P.lemon);
      b.hline(x!, y! - 1, 8, P.orange);
    }
  });
}

export function ladder(h: number): PixelBuffer {
  return piece(10, h, (b) => {
    b.rect(0, 0, 2, h, W[3]!);
    b.rect(8, 0, 2, h, W[3]!);
    b.vline(0, 0, h, W[4]!);
    for (let y = 3; y < h; y += 6) {
      b.hline(2, y, 6, W[4]!);
      b.hline(2, y + 1, 6, W[2]!);
    }
  });
}

// ---------- Desván ----------

export function desk(): PixelBuffer {
  return piece(48, 22, (b) => {
    b.rect(2, 6, 4, 16, W[3]!);
    b.rect(42, 6, 4, 16, W[3]!);
    b.rect(28, 6, 14, 12, W[2]!);
    b.rect(30, 8, 10, 3, W[3]!);
    b.rect(30, 12, 10, 3, W[3]!);
    b.set(35, 9, P.gold);
    b.set(35, 13, P.gold);
    b.rect(0, 3, 48, 4, W[5]!);
    b.hline(0, 3, 48, W[6]!);
    b.hline(0, 6, 48, W[3]!);
    // Libro de cuentas abierto.
    b.rect(10, 0, 16, 3, P.sand);
    b.vline(18, 0, 3, P.tan);
    for (let x = 11; x < 26; x += 2) if (x !== 17 && x !== 19) b.set(x, 1, P.oak);
    b.hline(9, 2, 18, P.rust);
    // Tintero y pluma.
    b.rect(29, 0, 3, 3, P.black);
    b.line(31, -1, 35, -6, P.white);
    b.set(34, -5, P.mist);
    // Monedas.
    b.rect(38, 1, 3, 2, P.gold);
    b.rect(39, -1, 3, 2, P.lemon);
    b.rect(43, 1, 3, 2, P.orange);
  });
}

export function chair(): PixelBuffer {
  return piece(10, 22, (b) => {
    b.rect(7, 0, 2, 22, W[3]!);
    b.rect(0, 12, 9, 3, W[4]!);
    b.hline(0, 12, 9, W[5]!);
    b.rect(0, 15, 2, 7, W[3]!);
    for (let y = 2; y < 12; y += 4) b.hline(5, y, 3, W[2]!);
  });
}

export function wallMap(): PixelBuffer {
  return piece(40, 24, (b) => {
    b.rect(0, 0, 40, 24, P.sand);
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 40; x++) if (bayer(x, y) < 0.18 && (x + y) % 3 === 0) b.set(x, y, P.tan);
    // Costa y mar.
    for (let y = 0; y < 24; y++) {
      const cx = 27 + Math.round(Math.sin(y * 0.5) * 3 + Math.sin(y * 1.3) * 1.5);
      for (let x = cx; x < 40; x++)
        b.set(x, y, x === cx ? P.ocean : (x + y) % 4 === 0 ? P.sky : P.mist);
    }
    // Montañas, bosque, río y camino.
    for (const [x, y] of [
      [6, 6],
      [11, 4],
      [15, 7],
    ]) {
      b.line(x! - 3, y! + 3, x!, y!, P.rust);
      b.line(x!, y!, x! + 3, y! + 3, P.rust);
    }
    for (const [x, y] of [
      [5, 16],
      [8, 18],
      [11, 15],
      [7, 13],
    ])
      b.ellipse(x!, y!, 1.6, 1.6, P.forest);
    b.line(14, 10, 27, 17, P.sky);
    for (let x = 2; x < 26; x += 2) b.set(x, 21 - Math.floor(x / 6), P.clay);
    // La X y alfileres.
    b.line(19, 13, 21, 15, P.wine);
    b.line(21, 13, 19, 15, P.wine);
    b.set(10, 9, P.red);
    b.set(23, 5, P.gold);
    b.rect(0, 0, 40, 1, P.tan);
    b.rect(0, 23, 40, 1, P.clay);
    // Esquinas enrolladas.
    b.rect(0, 0, 2, 24, P.tan);
    b.rect(38, 0, 2, 24, P.clay);
  });
}

export function bookshelf(): PixelBuffer {
  return piece(26, 38, (b) => {
    b.rect(0, 0, 26, 38, W[2]!);
    b.rect(2, 2, 22, 34, W[1]!);
    const spines = [P.wine, P.ocean, P.forest, P.rust, P.grape, P.amber, P.slate, P.brick];
    let k = 0;
    for (const sy of [12, 24, 36]) {
      b.rect(0, sy, 26, 2, W[4]!);
      let x = 3;
      while (x < 22) {
        const h = 7 + ((k * 5) % 4);
        const w = 2 + (k % 2);
        b.rect(x, sy - h, w, h, spines[k % spines.length]!);
        b.set(x, sy - h + 2, P.gold);
        x += w + (k % 5 === 0 ? 2 : 0);
        k++;
      }
    }
    b.hline(0, 0, 26, W[4]!);
    b.ellipse(19, 23 - 1.5, 2.5, 1.5, P.mist);
  });
}

export function trunk(): PixelBuffer {
  return piece(22, 14, (b) => {
    b.rect(0, 4, 22, 10, W[3]!);
    b.ellipse(11, 4, 11, 4, W[4]!);
    b.rect(0, 4, 22, 1, P.slate);
    for (const x of [3, 18]) b.vline(x, 1, 13, P.slate);
    b.rect(10, 5, 2, 3, P.gold);
  });
}

export function sword(): PixelBuffer {
  return piece(26, 5, (b) => {
    b.hline(0, 2, 18, P.mist);
    b.hline(0, 1, 18, P.white);
    b.hline(2, 3, 16, P.fog);
    b.rect(18, 0, 2, 5, P.gold);
    b.rect(20, 1, 5, 3, W[2]!);
    b.set(25, 2, P.gold);
  });
}

export function brokenChair(): PixelBuffer {
  return piece(14, 12, (b) => {
    b.line(0, 11, 8, 3, W[3]!);
    b.line(1, 11, 9, 3, W[4]!);
    b.rect(4, 8, 9, 2, W[4]!);
    b.line(12, 10, 13, 2, W[3]!);
  });
}

export function rolledCarpet(): PixelBuffer {
  return piece(26, 7, (b) => {
    b.rect(3, 0, 20, 7, P.wine);
    b.hline(3, 0, 20, P.red);
    for (let x = 5; x < 23; x += 4) b.vline(x, 1, 5, P.gold);
    b.ellipse(3, 3.5, 3, 3.5, P.red);
    b.ellipse(3, 3.5, 1.5, 2, P.plum);
  });
}

export function armorStand(): PixelBuffer {
  return piece(16, 30, (b) => {
    b.rect(7, 18, 2, 10, W[3]!);
    b.rect(3, 28, 10, 2, W[3]!);
    b.ellipse(8, 4, 4, 4, P.steel);
    b.ellipse(7, 3, 2.5, 2.5, P.fog);
    b.rect(5, 5, 6, 1, P.black);
    b.rect(2, 9, 12, 10, P.steel);
    b.rect(3, 10, 4, 7, P.fog);
    b.ellipse(3, 9.5, 3, 2, P.mist);
    b.ellipse(13, 9.5, 3, 2, P.fog);
    b.hline(2, 18, 12, P.slate);
  });
}

export function uncleFrame(face: PixelBuffer): PixelBuffer {
  return piece(24, 30, (b) => {
    b.rect(0, 0, 24, 30, P.orange);
    b.rect(1, 1, 22, 28, P.gold);
    b.rect(2, 2, 20, 26, P.brick);
    b.rect(3, 3, 18, 24, P.plum);
    for (let y = 3; y < 27; y++)
      for (let x = 3; x < 21; x++) if (bayer(x, y) < (y - 3) / 40) b.set(x, y, P.black);
    b.blit(face, 3, 3);
    b.set(0, 0, P.lemon);
    b.set(23, 29, P.rust);
    b.rect(9, 27, 6, 2, P.lemon);
  });
}

export function pennants(w: number): PixelBuffer {
  return piece(
    w,
    10,
    (b) => {
      const colors = [P.red, P.gold, P.sky, P.lime, P.coral];
      for (let x = 0; x < w; x++) b.set(x, Math.round(1 + Math.sin((x / w) * Math.PI) * 3), P.tan);
      for (let i = 0, x = 2; x < w - 4; x += 7, i++) {
        const y = Math.round(1 + Math.sin(((x + 2) / w) * Math.PI) * 3);
        b.poly(
          [
            [x, y],
            [x + 5, y],
            [x + 2.5, y + 6],
          ],
          colors[i % colors.length]!,
        );
      }
    },
    'none',
  );
}

// ---------- Exterior ----------

export function well(): PixelBuffer {
  return piece(40, 54, (b) => {
    // Tejadillo.
    b.poly(
      [
        [0, 12],
        [20, 0],
        [40, 12],
        [36, 14],
        [20, 4],
        [4, 14],
      ],
      R.roof[2]!,
    );
    for (let i = 0; i < 20; i += 3) {
      b.line(20 - i, i * 0.6 + 1, 20 - i - 2, i * 0.6 + 2, R.roof[3]!);
      b.line(20 + i, i * 0.6 + 1, 20 + i + 2, i * 0.6 + 2, R.roof[1]!);
    }
    // Postes y torno.
    b.rect(6, 10, 3, 30, W[3]!);
    b.rect(31, 10, 3, 30, W[3]!);
    b.vline(6, 10, 30, W[4]!);
    b.rect(8, 18, 24, 3, W[4]!);
    b.hline(8, 18, 24, W[5]!);
    b.rect(33, 16, 2, 6, P.slate);
    b.rect(34, 21, 4, 2, P.slate);
    // Cuerda y cubo.
    b.vline(20, 21, 9, P.tan);
    b.rect(17, 30, 7, 6, W[4]!);
    b.hline(17, 30, 7, W[5]!);
    b.hline(17, 33, 7, P.slate);
    // Brocal de piedra.
    stoneWall(b, 2, 38, 36, 16, 'brocal', { bw: 7, bh: 4, moss: 6 });
    b.hline(2, 38, 36, P.fog);
  });
}

export function doorLeaf(): PixelBuffer {
  return piece(10, 46, (b) => {
    b.rect(0, 0, 10, 46, W[3]!);
    for (let x = 0; x < 10; x += 3) b.vline(x, 0, 46, W[2]!);
    b.vline(9, 0, 46, W[1]!);
    for (const y of [6, 38]) {
      b.rect(0, y, 10, 3, P.slate);
      b.hline(0, y, 10, P.steel);
    }
    b.rect(2, 22, 2, 3, P.gold);
  });
}

export function lanternBody(): PixelBuffer {
  return piece(9, 13, (b) => {
    b.rect(2, 0, 5, 2, P.slate);
    b.rect(1, 2, 7, 9, P.navy);
    b.rect(2, 3, 5, 7, P.gold);
    b.rect(3, 4, 3, 5, P.lemon);
    b.vline(4, 3, 7, P.slate);
    b.rect(1, 11, 7, 2, P.slate);
  });
}

export function signBoard(): PixelBuffer {
  return piece(30, 20, (b) => {
    b.rect(0, 0, 30, 20, W[4]!);
    b.rect(1, 1, 28, 18, W[3]!);
    b.hline(1, 1, 28, W[5]!);
    for (let y = 4; y < 18; y += 4) b.hline(1, y, 28, W[2]!);
    // Jarra partida pintada.
    b.rect(9, 6, 10, 10, P.sand);
    b.ellipse(14, 6, 5, 1.5, P.white);
    b.rect(19, 8, 3, 1, P.sand);
    b.rect(21, 9, 1, 4, P.sand);
    b.rect(19, 13, 3, 1, P.sand);
    b.line(13, 6, 15, 10, P.rust);
    b.line(15, 10, 12, 13, P.rust);
    b.line(12, 13, 14, 16, P.rust);
    b.hline(9, 15, 10, P.tan);
    b.rect(5, 2, 2, 2, P.gold);
    b.rect(23, 2, 2, 2, P.gold);
  });
}

export function bush(seed: string, w = 22, h = 12): PixelBuffer {
  return piece(w, h, (b) => {
    const rng = new Rng(seed);
    for (let i = 0; i < 9; i++) {
      const cx = rng.int(4, w - 4);
      const cy = rng.int(4, h - 3);
      b.ellipse(cx, cy, rng.int(3, 5), rng.int(3, 4), (x, y, t) =>
        t < 0.35 && (x + y) % 2 ? P.leaf : y < cy ? P.forest : P.deep,
      );
    }
    for (let i = 0; i < 4; i++)
      b.set(rng.int(2, w - 3), rng.int(2, h - 4), rng.chance(0.5) ? P.coral : P.lemon);
  });
}

export function cobwebAt(b: PixelBuffer, x: number, y: number, size: number, dir: 1 | -1): void {
  cobweb(b, x, y, size, dir);
}

export function floorSlab(b: PixelBuffer, x: number, y: number, w: number, seed: string): void {
  // Tarima vista de canto + vigas (cabezas de viguetas cada 24 px).
  planksH(b, x, y, w, 3, seed, [P.plum, P.rust, P.oak, P.clay], 3);
  b.hline(x, y, w, P.tan);
  b.rect(x, y + 3, w, 5, P.bark);
  b.hline(x, y + 3, w, P.plum);
  for (let jx = x + 6; jx < x + w - 4; jx += 24) {
    b.rect(jx, y + 3, 6, 5, P.rust);
    b.hline(jx, y + 3, 6, P.oak);
    b.vline(jx + 5, y + 4, 4, P.plum);
    b.set(jx + 2, y + 5, P.bark);
  }
  b.hline(x, y + 7, w, P.black);
}
