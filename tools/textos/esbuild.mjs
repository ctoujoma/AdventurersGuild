// Empaqueta y ejecuta una herramienta de tools/ con los textos del juego:
// `node tools/textos/esbuild.mjs tools/sim.ts sim [args…]`.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { textosEsbuild } from './cargar.mjs';

const [entry, name, ...args] = process.argv.slice(2);
const outfile = `node_modules/.cache/sim/${name}.mjs`;
await build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  logLevel: 'warning',
  plugins: [textosEsbuild],
});
try {
  execFileSync('node', [outfile, ...args], { stdio: 'inherit' });
} catch (e) {
  process.exit(e.status ?? 1);
}
