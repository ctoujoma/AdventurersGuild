/**
 * Capturas de los animales del salón, para el PR del gato y el perro. Uso (con `npm run build` y
 * `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/animales.mjs <carpeta> [puerto=4173]
 *
 * Con el perro comprado, saca la chimenea de cerca: los dos dormidos (`dormidos.png`), el gato de
 * paseo (`paseo.png`) y los dos tocados (`toque-N.png`: corazones y ladrido).
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

const ok = await page.evaluate(() => {
  const g = window.__game;
  g.set({ ...g.get(), tips: ['*'], gold: 999 });
  g.dispatch({ type: 'buyDog' });
  return !!g.get().custom?.dog;
});
await page.waitForTimeout(600);
const focus = async () =>
  page.evaluate(() => {
    const sc = window.__scene;
    const cat = sc.pets.pets.get('gato');
    const dog = sc.pets.pets.get('perro');
    if (!cat) return false;
    sc.resize(sc.cssW, sc.cssH, 4);
    sc.camera.centerOn((cat.x + (dog?.x ?? cat.x)) / 2, 300 - 30 - cat.floor * 106, false);
    return true;
  });
if (ok && (await focus())) {
  await page.evaluate(() => {
    const p = window.__scene.pets;
    for (const x of p.pets.values()) {
      x.state = 'sleep';
      x.timer = 99;
    }
    // Sin la gente que se calienta delante, que los tapa.
    window.__scene.crowd.group.visible = false;
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/dormidos.png` });
  // El gato, de paseo hacia la izquierda.
  await page.evaluate(() => {
    const p = window.__scene.pets;
    const c = p.pets.get('gato');
    c.target = c.x - 110;
    c.tz = 8;
    c.state = 'walk';
  });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${out}/paseo.png` });
  await page.evaluate(() => {
    const p = window.__scene.pets;
    const c = p.pets.get('gato');
    c.x = p.home;
    c.z = 36;
    c.state = 'sleep';
    c.timer = 99;
    window.__scene.pat('gato');
    window.__scene.pat('perro');
  });
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/toque-${i}.png` });
  }
} else console.log('sin salón');
await browser.close();
