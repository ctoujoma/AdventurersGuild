/** Rejillas de caracteres: el formato en que se dibujan a mano los sprites. '.' es transparente. */
export type Grid = readonly string[];

/** Comprueba que todas las filas miden lo mismo y que cada carácter tiene color. */
export function validateGrid(
  grid: Grid,
  colors: Readonly<Record<string, string>>,
  width?: number,
): string[] {
  const errors: string[] = [];
  const w = width ?? grid[0]?.length ?? 0;
  grid.forEach((row, y) => {
    if (row.length !== w) errors.push(`fila ${y}: mide ${row.length}, se esperaba ${w}`);
    for (const ch of row) {
      if (ch !== '.' && !colors[ch]) errors.push(`fila ${y}: carácter '${ch}' sin color`);
    }
  });
  return errors;
}
