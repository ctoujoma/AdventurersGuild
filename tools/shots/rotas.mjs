/**
 * Capturas de las salas rotas (por reparar) de la partida del tío. Uso (con `npm run build` y
 * `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/rotas.mjs <carpeta> [puerto=4173]
 *
 * Saca cada sala rota de cerca (`rota-<tipo>.png`), la taberna entera (`todo.png`) y, si los
 * hay, los bichos tocados (`bichos-<tipo>.png`).
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

// Sin las lecciones del tío, que tapan la sala.
const skip = page.getByText('Saltar lecciones');
if (await skip.count())
  await skip
    .first()
    .click()
    .catch(() => {});
await page.waitForTimeout(400);
const rooms = await page.evaluate(() =>
  window.__scene.layout.rooms
    .filter((r) => r.room.level === 0 && r.room.type !== 'torre')
    .map((r) => ({ id: r.room.id, type: r.room.type, rect: r.rect })),
);
for (const b of rooms) {
  await page.evaluate((r) => {
    const sc = window.__scene;
    sc.resize(sc.cssW, sc.cssH, 4);
    sc.camera.centerOn(r.x + r.w / 2, r.y + r.h / 2, false);
  }, b.rect);
  // La rata, a la vista: husmeando en medio de la sala.
  await page.evaluate((id) => {
    const p = window.__scene.pets;
    const r = p.pets.get(`rata:${id}`);
    if (!r) return;
    r.x = (r.area.x0 + r.area.x1) / 2 - 14;
    r.state = 'sniff';
    r.timer = 99;
  }, b.id);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/rota-${b.type}.png` });
  // Los bichos de la sala, tocados (si los hay).
  const pats = await page.evaluate((id) => {
    const sc = window.__scene;
    const ids = [...sc.pets.pets.keys()].filter((k) => k.split(':')[1] === id);
    if (ids[0]) sc.pat(ids[0]);
    return ids.length;
  }, b.id);
  if (pats) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/bichos-${b.type}.png` });
  }
}
await page.evaluate(() => {
  const sc = window.__scene;
  sc.resize(sc.cssW, sc.cssH, 2);
  sc.camera.centerOn((sc.layout.left + sc.layout.right) / 2, 220, false);
});
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/todo.png` });
await browser.close();
