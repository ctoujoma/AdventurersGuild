/**
 * Capturas de las peleas contra los jefes, para el PR de los jefes nuevos. Uso (con
 * `npm run build` y `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/jefes.mjs <carpeta> [jefes=jabali,reina,dragona] [puerto=4173]
 *
 * Desde Ajustes › Modo prueba lanza la pelea de cada jefe y la saca a media pelea
 * (`<jefe>-1.png`, `-2.png`, `-3.png`, cada 1,5 s).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const kinds = (process.argv[3] ?? 'jabali,reina,dragona').split(',');
const port = process.argv[4] ?? '4173';
const vp = { width: 1280, height: 760 };
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
  args: [
    '--headless=new',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
  headless: false,
});
const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.stack));
await page.addInitScript(() => {
  localStorage.setItem(
    'jarro:ajustes',
    JSON.stringify({ music: 0, sfx: 0, ambient: 0, speed: 1, pace: 1, tester: true }),
  );
});
await page.goto(`http://localhost:${port}/#debug`);
await page.waitForTimeout(4500);
await page.mouse.click(vp.width / 2, vp.height / 2);
await page.waitForTimeout(800);
const start = page.getByRole('button', { name: 'Nueva partida' });
if (await start.count()) await start.click();
await page.waitForTimeout(2500);
for (let i = 0; i < 4; i++) {
  const close = page.locator(
    'button:has-text("Abrir la taberna"), button[aria-label="Abrir la taberna"], button:has-text("Seguir"), button:has-text("Entendido"), button:has-text("Vale")',
  );
  if (await close.count())
    await close
      .first()
      .click()
      .catch(() => {});
  await page.waitForTimeout(500);
}

const skip = page.getByText('Saltar lecciones');
if (await skip.count())
  await skip
    .first()
    .click()
    .catch(() => {});
const NAMES = {
  bestia: 'La bestia de Hondogrís',
  ahogado: 'El Rey Ahogado',
  sierpe: 'La sierpe de Sierra Parda',
  jabali: 'El jabalí de ceniza',
  reina: 'La Reina de la Cripta',
  dragona: 'La dragona de la Corona Blanca',
};
for (const k of kinds) {
  await page.getByRole('button', { name: 'Ajustes' }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: NAMES[k] }).first().click();
  for (let i = 1; i <= 3; i++) {
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/${k}-${i}.png` });
  }
  // Fuera de la pelea: la salta o la cierra.
  for (const name of ['Saltar', 'Cerrar', 'Seguir', 'Volver']) {
    const b = page.getByRole('button', { name });
    if (await b.count())
      await b
        .first()
        .click()
        .catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
}
await browser.close();
