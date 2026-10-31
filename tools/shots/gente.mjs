/**
 * Capturas de la gente y las escaleras, para los PR de animaciones. Uso (con `npm run build` y
 * `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/gente.mjs <carpeta> [puerto=4173]
 *
 * Saca el tramo de la planta baja de cerca (`escalera.png`), a un héroe subiéndolo
 * (`sube-NN.png`, cada 120 ms) y, si la escena lo sabe hacer, a todos celebrando en la barra
 * (`celebra-N.png`).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const port = process.argv[3] ?? '4173';
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

const ready = await page.evaluate(() => {
  const g = window.__game;
  g.set({ ...g.get(), tips: ['*'] });
  const sc = window.__scene;
  const s = sc.layout.stairs.find((x) => x.flights.includes(0));
  const c = sc.crowd;
  const a = [...c.actors.values()].find((x) => !x.hero.visitor && x.floor === 0);
  if (!s || !a) return false;
  const cx = s.x + 20;
  sc.resize(sc.cssW, sc.cssH, 4);
  c.put(a, { x: cx - 50, floor: 0 });
  sc.camera.centerOn(cx, a.y - 60, false);
  window.__sube = { a, cx };
  return true;
});
if (ready) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/escalera.png` });
  await page.evaluate(() => {
    const { a, cx } = window.__sube;
    window.__scene.crowd.go(a, { place: { x: cx + 40, floor: 1 }, pose: 'stand' });
    a.wait = 99;
  });
  for (let i = 0; i < 40; i++) {
    await page.screenshot({ path: `${out}/sube-${String(i).padStart(2, '0')}.png` });
    await page.waitForTimeout(120);
  }
}
const cheers = await page.evaluate(() => {
  const sc = window.__scene;
  if (!sc.crowd.celebrate) return false;
  const hs = [...sc.crowd.actors.values()].filter((x) => !x.hero.visitor).map((x) => x.hero.id);
  sc.cheer('barra', hs);
  sc.resize(sc.cssW, sc.cssH, 3);
  return true;
});
if (cheers) {
  await page.waitForTimeout(4000);
  for (let i = 0; i < 4; i++) {
    await page.screenshot({ path: `${out}/celebra-${i}.png` });
    await page.waitForTimeout(160);
  }
}
await browser.close();
