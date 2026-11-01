/**
 * Capturas de la escena de salas para revisar cambios a ojo. Uso (con `npm run build` y
 * `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/scene.mjs <carpeta> [ancho] [alto]
 *
 * Abre el juego con el modo pruebas, empieza partida nueva y saca: la casa entera, el salón de
 * cerca y la casa de noche. Para preparar otra partida, toca `window.__game` (get/set del
 * estado) y `window.__scene` (la escena: resize, camera.centerOn, spots, nightfall…).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const vp = { width: Number(process.argv[3] ?? 1280), height: Number(process.argv[4] ?? 760) };
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
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
await page.goto('http://localhost:4173/#debug');
await page.waitForTimeout(4500);
await page.mouse.click(vp.width / 2, vp.height / 2);
await page.waitForTimeout(800);
const start = page.getByRole('button', { name: 'Nueva partida' });
if (await start.count()) await start.click();
await page.waitForTimeout(2500);
for (let i = 0; i < 4; i++) {
  const close = page.locator(
    'button:has-text("Entrar en la taberna"), button:has-text("Abrir la taberna"), button[aria-label="Abrir la taberna"], button:has-text("Seguir"), button:has-text("Entendido"), button:has-text("Vale")',
  );
  if (await close.count())
    await close
      .first()
      .click()
      .catch(() => {});
  await page.waitForTimeout(500);
}
// Sin notas del tutorial.
await page.evaluate(() => {
  const g = window.__game;
  g.set({ ...g.get(), tips: ['*'] });
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/casa.png` });
await page.evaluate(() => {
  const s = window.__scene;
  s.resize(s.cssW, s.cssH, 4);
  const sp = s.spots.find((x) => x.label.startsWith('Salón'));
  s.camera.centerOn(sp.rect.x + sp.rect.w / 2, sp.rect.y + sp.rect.h / 2 - 10, false);
});
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/salon.png` });
await page.evaluate(() => {
  const s = window.__scene;
  s.resize(s.cssW, s.cssH, 2);
  s.nightfall(() => {}, 30);
});
await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}/noche.png` });
await browser.close();
