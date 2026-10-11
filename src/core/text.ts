/** «Lysa», «Lysa y Maren», «Lysa, Maren y Brom». */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
