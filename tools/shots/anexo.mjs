/**
 * Capturas del anexo (el patio trasero): el edificio a todo lo ancho, el jardín en medio y el
 * anexo con unas salas en dos plantas, de día y de noche, con el jardín sin adornar y adornado
 * (`custom.garden`). Uso (con `npm run build` y `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/anexo.mjs <carpeta>
 *
 * `ANCHO`, `ALTO`, `ZOOM` y `PUERTO` como en `fachada.mjs`. Saca `anexo-<liso|adornado>-<dia|noche>.png`.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const port = process.env.PUERTO ?? '4173';
const zoom = Number(process.env.ZOOM ?? 0.75);
const vp = { width: Number(process.env.ANCHO ?? 1600), height: Number(process.env.ALTO ?? 760) };
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
page.on('console', (m) => m.text().startsWith('NO ') && console.log(m.text()));
await page.goto(`http://localhost:${port}/#debug`);
await page.waitForTimeout(4500);
// La carta del tío y los avisos del principio.
for (let i = 0; i < 4; i++) {
  const close = page.locator(
    'button:has-text("Entrar en la taberna"), button:has-text("Abrir la taberna"), button:has-text("Seguir"), button:has-text("Entendido"), button:has-text("Vale")',
  );
  if (await close.count())
    await close
      .first()
      .click()
      .catch(() => {});
  await page.waitForTimeout(500);
}

/** El edificio con el anexo; `garden`, el adorno del jardín (o nada). */
async function prepare(garden) {
  await page.evaluate((garden) => {
    const g = window.__game;
    // Siempre desde la partida del principio (la segunda vez ya tendría el anexo).
    window.__inicio ??= structuredClone(g.get());
    const s = structuredClone(window.__inicio);
    s.tips = ['*'];
    s.event = null;
    delete s.tutorial;
    s.mode = 'libre';
    s.gold = 99999;
    s.rep = 100;
    // Por las acciones de verdad: solares, patio trasero y salas (así se valida todo).
    const go = (a) => {
      const n = g.get();
      g.dispatch(a);
      if (g.get() === n) console.log('NO', JSON.stringify(a));
    };
    g.set(s);
    while (g.get().building.cols < 7) go({ type: 'buyPlot' });
    go({ type: 'buyWing' });
    for (const col of [4, 5, 6]) go({ type: 'build', room: 'despensa', col, floor: 0 });
    go({ type: 'build', room: 'armas', col: 10, floor: 0 });
    go({ type: 'addStair', at: 11, floor: 0 });
    go({ type: 'build', room: 'tiro', col: 11, floor: 0 });
    go({ type: 'build', room: 'biblioteca', col: 11, floor: 1 });
    go({ type: 'build', room: 'dormitorio', col: 10, floor: 1 });
    go({ type: 'buyPlot' });
    go({ type: 'build', room: 'sastreria', col: 12, floor: 0 });
    if (garden) go({ type: 'gardenLook', patch: garden });
    // Las obras acaban al momento.
    const t = structuredClone(g.get());
    for (const r of t.building.rooms) delete r.works;
    g.set(t);
  }, garden);
  await page.waitForTimeout(1500);
  await page.evaluate((zoom) => {
    const sc = window.__scene;
    sc.resize(sc.cssW, sc.cssH, zoom);
    const L = sc.layout;
    sc.camera.centerOn((L.left + L.right) / 2, 300 - 120, false);
  }, zoom);
  await page.waitForTimeout(900);
}

const looks = {
  liso: null,
  adornado: {
    ground: 'losas',
    slots: ['arbol', 'fuente', 'banco'],
    edge: 'seto',
    lamps: true,
    cloister: true,
  },
};
for (const night of [false, true]) {
  if (night) {
    await page.evaluate(() => window.__scene.nightfall(() => {}, 1, Infinity));
    await page.waitForTimeout(3000);
  }
  for (const [name, garden] of Object.entries(looks)) {
    await prepare(garden);
    await page.screenshot({ path: `${out}/anexo-${name}-${night ? 'noche' : 'dia'}.png` });
  }
}
await browser.close();
