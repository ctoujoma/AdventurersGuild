/**
 * Capturas de las peleas contra los jefes, para el PR de los jefes nuevos. Uso (con
 * `npm run build` y `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/jefes.mjs <carpeta> [jefes=jabali,reina,dragona] [puerto=4173]
 *
 * Desde Ajustes › Modo prueba lanza la pelea de cada jefe y la saca a media pelea
 * (`<jefe>-1.png`, `-2.png`, `-3.png`, cada 1,5 s; con `FOTOS` y `CADA`, otras; con `PRISA=1`, el
 * jefe ataca sin descanso; con `GOLPE=1`, además, `<jefe>-golpe.png` con su efecto propio).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
/** Cuántas capturas por pelea y cada cuánto (ms): `FOTOS` y `CADA`. */
const SHOTS = Number(process.env.FOTOS ?? 3);
const STEP = Number(process.env.CADA ?? 1500);
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
  for (let i = 1; i <= SHOTS; i++) {
    await page.waitForTimeout(STEP);
    // Con `PRISA`, el jefe ataca sin descanso (para ver todos sus golpes en pocas capturas).
    if (process.env.PRISA)
      await page.evaluate(() => {
        const boss = window.__battle?.fighters.find((f) => f.art);
        if (boss && !boss.move) boss.cool = 0;
      });
    await page.screenshot({ path: `${out}/${k}-${i}.png` });
  }
  // Con `GOLPE=1`, el efecto propio de cada jefe a la vista (escarcha, lamento, brasas).
  if (process.env.GOLPE) {
    await page.evaluate((k) => {
      const b = window.__battle;
      const boss = b.fighters.find((f) => f.art);
      const feet = b.feet(boss);
      if (k === 'dragona') {
        const m = boss.art.mouth.thrust;
        b.fx(
          'frost',
          boss.x + boss.face * m.x,
          feet + m.y + 2,
          1.1,
          '#2ce8f5',
          90,
          undefined,
          boss.face,
        );
      } else if (k === 'reina') {
        b.fx('ring', boss.x, feet - 1, 0.9, '#b55088', 80);
        b.fx('ring', boss.x, feet - 1, 1.1, '#68386c', 60);
        b.burstAt('puff', boss.x - 40, feet - 2, 8);
      } else {
        b.burstAt('ember', boss.x, feet - boss.art.chest - 8, 14);
        b.burstAt('ember', boss.x - 30, feet - 6, 10);
      }
    }, k);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${out}/${k}-golpe.png` });
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
