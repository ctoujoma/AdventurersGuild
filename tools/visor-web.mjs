// Abre el visor en Chromium y saca una captura: `node tools/visor-web.mjs <salida.png>`.
// Necesita Playwright (instalado a nivel global en el contenedor).
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { textosEsbuild } from './textos/cargar.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? '/opt/node22/lib/node_modules/playwright');
const dir = 'node_modules/.cache/visor-web';
await build({
  entryPoints: ['tools/visor-web.ts'],
  bundle: true,
  format: 'iife',
  outfile: `${dir}/visor.js`,
  logLevel: 'warning',
  plugins: [textosEsbuild],
});
writeFileSync(
  `${dir}/index.html`,
  '<!doctype html><body style="margin:0;background:#111"><script src="visor.js"></script>',
);
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1243/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 980, height: 720 } });
page.on('pageerror', (e) => console.log('ERROR', e.message));
await page.goto(`file://${process.cwd()}/${dir}/index.html`);
await page.waitForTimeout(500);
console.log(await page.title());
await page.screenshot({ path: process.argv[2] ?? 'visor-web.png' });
await browser.close();
