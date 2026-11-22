import type { Plugin } from 'vite';
import type { Plugin as EsbuildPlugin } from 'esbuild';
export const ID: string;
export const DIR: string;
export function textFiles(dir?: string): { lang: string; zone: string; path: string }[];
export function loadTexts(dir?: string): Record<string, Record<string, unknown>>;
export function textosVite(): Plugin;
export const textosEsbuild: EsbuildPlugin;
