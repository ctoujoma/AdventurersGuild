// Los textos de todos los idiomas, cargados de los YAML al compilar (tools/textos/cargar.mjs).
declare module 'virtual:textos' {
  const textos: Record<string, Record<string, unknown>>;
  export default textos;
}
