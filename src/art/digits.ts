/** Cifras de 3×5 píxeles (precios de las obras, números de la pelea). */
const DIGITS = [
  '111101101101111',
  '010110010010111',
  '111001111100111',
  '111001111001111',
  '101101111001001',
  '111100111001111',
  '111100111101111',
  '111001001001001',
  '111101111101111',
  '111101111001111',
];

/** Pinta `text` (cifras) con su esquina de arriba a la izquierda en (x, y), 4 px por cifra. */
export function tinyDigits(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
): void {
  ctx.fillStyle = color;
  [...text].forEach((ch, i) => {
    const g = DIGITS[Number(ch)];
    if (!g) return;
    for (let k = 0; k < 15; k++)
      if (g[k] === '1') ctx.fillRect(x + i * 4 + (k % 3), y + Math.floor(k / 3), 1, 1);
  });
}
