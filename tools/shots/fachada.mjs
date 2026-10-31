/**
 * Capturas de la fachada: la taberna entera con cada combinación de tejado, paredes y rótulo,
 * de día y de noche, y también con una planta de más encima de una parte (tejados de varias
 * alturas). Uso (con `npm run build` y `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/fachada.mjs <carpeta> [teja/tablas/tablero,pizarra/piedra/hierro,…]
 *
 * `ANCHO` y `ALTO` cambian la ventana (por ejemplo 420 y 860 para móvil), `ZOOM` el zoom y
 * `PUERTO` el puerto. Saca `<combinación>-<alta|baja>-<dia|noche>.png`.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const port = process.env.PUERTO ?? '4173';
/** Combinaciones «tejado/paredes/rótulo», separadas por comas (vacío: lo de siempre). */
const combos = (process.argv[3] ?? '').split(',');
const zoom = Number(process.env.ZOOM ?? 1);
const vp = { width: Number(process.env.ANCHO ?? 1280), height: Number(process.env.ALTO ?? 760) };
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

/** Prepara la partida: la fachada elegida y, si `tall`, una sala en la segunda planta. */
async function prepare(combo, tall) {
  await page.evaluate(
    ([combo, tall]) => {
      const g = window.__game;
      const s = structuredClone(g.get());
      s.tips = ['*'];
      s.event = null;
      const [roof, walls, sign] = combo ? combo.split('/') : [];
      s.custom = {
        ...(s.custom ?? { name: 'El Jarro Partido', color: 'vino', symbol: 'jarra', dog: false }),
        facade: ['flores', 'faroles', 'banderines', 'letrero'],
        look: combo ? { roof, walls, sign } : undefined,
      };
      if (tall && !s.building.rooms.some((r) => r.floor === 2)) {
        const top = Math.max(...s.building.rooms.map((r) => r.floor + r.h - 1));
        s.building.rooms.push({
          id: 'prueba-alta',
          type: 'biblioteca',
          col: 1,
          floor: top + 1,
          w: 1,
          h: 1,
          level: 2,
          spent: 0,
        });
      }
      g.set(s);
    },
    [combo, tall],
  );
  await page.waitForTimeout(1200);
  await page.evaluate((zoom) => {
    const sc = window.__scene;
    sc.resize(sc.cssW, sc.cssH, zoom);
    const L = sc.layout;
    sc.camera.centerOn((L.left + L.right) / 2, 300 - 120, false);
  }, zoom);
  await page.waitForTimeout(900);
}

const name = (c) => (c || 'casa').replaceAll('/', '-');
for (const night of [false, true]) {
  if (night) {
    await page.evaluate(() => window.__scene.nightfall(() => {}, 1, Infinity));
    await page.waitForTimeout(3000);
  }
  for (const combo of combos)
    for (const tall of [false, true]) {
      await prepare(combo, tall);
      await page.screenshot({
        path: `${out}/${name(combo)}-${tall ? 'alta' : 'baja'}-${night ? 'noche' : 'dia'}.png`,
      });
    }
}
await browser.close();
