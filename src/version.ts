/** Versión del juego (fecha y commit del build), la pone Vite al compilar. */
declare const __VERSION__: string | undefined;

export const VERSION = typeof __VERSION__ === 'string' ? __VERSION__ : 'dev';
