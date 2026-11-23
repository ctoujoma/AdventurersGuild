// PNG sin dependencias para las herramientas de capturas.
import { deflateSync } from 'node:zlib';
import type { PixelBuffer } from '../src/art/pixel';

const crc = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = t[(c ^ x) & 255]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

export function png(b: PixelBuffer, s: number): Buffer {
  const W = b.w * s;
  const H = b.h * s;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const c = b.data[Math.floor(y / s) * b.w + Math.floor(x / s)]!;
      const o = y * (W * 4 + 1) + 1 + x * 4;
      raw[o] = c & 255;
      raw[o + 1] = (c >> 8) & 255;
      raw[o + 2] = (c >> 16) & 255;
      raw[o + 3] = 255;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
