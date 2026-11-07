/**
 * Capturas del asalto en directo (con `npm run build` y `npx vite preview --port 4173`):
 *
 *   node tools/shots/asalto.mjs <carpeta> [ancho] [alto]
 *
 * Partida nueva con un héroe de cada clase en casa y un asalto esta noche. Cae la noche y saca
 * una captura cada `CADA` ms (por defecto 250) mientras dura la pelea (`TOTAL` ms, 30 s).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const vp = { width: Number(process.argv[3] ?? 900), height: Number(process.argv[4] ?? 600) };
const CADA = Number(process.env.CADA ?? 250);
const TOTAL = Number(process.env.TOTAL ?? 30000);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  headless: false,
});
const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.stack));
await page.addInitScript(() => {
  localStorage.setItem(
    'jarro:ajustes',
    JSON.stringify({
      music: 0,
      sfx: 0,
      ambient: 0,
      speed: 1,
      pace: 1,
      tester: true,
      classicTime: true,
    }),
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
    'button:has-text("Abrir la taberna"), button[aria-label="Abrir la taberna"], button:has-text("Entrar en la taberna"), button:has-text("Seguir"), button:has-text("Entendido"), button:has-text("Vale")',
  );
  if (await close.count())
    await close
      .first()
      .click()
      .catch(() => {});
  await page.waitForTimeout(500);
}
await page.evaluate(() => window.__game.dispatch({ type: 'tutorial', op: 'saltar' }));
await page.waitForTimeout(400);
// Un héroe de cada clase, en casa y sanos; y el asalto, esta noche.
const n = await page.evaluate(
  ({ lvl, strength }) => {
    const g = window.__game;
    const s = g.get();
    const CLS = ['guerrero', 'picaro', 'mago', 'clerigo', 'explorador', 'guerrero'];
    const base = s.heroes[0] ?? s.candidates?.[0];
    const heroes = CLS.map((cls, i) => ({
      ...base,
      ...(s.heroes[i] ?? {}),
      id: `prueba${i}`,
      seed: `prueba-${i}`,
      name: `Prueba ${i}`,
      cls,
      lvl,
      status: 'ok',
      days: 0,
      job: undefined,
      guard: false,
    }));
    g.set({
      ...s,
      heroes,
      tips: ['*'],
      raid: { day: s.day, band: 'Los Cuervos', strength, warned: true },
      truce: 0,
    });
    return heroes.length;
  },
  { lvl: Number(process.env.NIVEL ?? 1), strength: Number(process.env.FUERZA ?? 9) },
);
console.log('héroes', n);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/antes.png` });
// A la antigua (`classicTime`): «Anochecer» y luego «Cerrar».
for (const name of ['Anochecer', 'Cerrar']) {
  await page
    .locator(`button.endday:has-text("${name}")`)
    .first()
    .click({ timeout: 5000 })
    .catch(() => console.log('sin botón', name));
  await page.waitForTimeout(600);
}
// Para ver los golpes: toda la escena a cámara lenta (`LENTO`, 1 = normal).
const LENTO = Number(process.env.LENTO ?? 1);
if (LENTO !== 1)
  await page.evaluate((k) => {
    const sc = window.__scene;
    const u = sc.update.bind(sc);
    sc.update = (dt) => u(dt * k);
  }, LENTO);
// Para revisar los gestos sin la oscuridad de la noche (`CLARO=1`; no es lo que ve el jugador).
if (process.env.CLARO)
  await page.evaluate(() => {
    window.__scene.nightLight = () => ({ dark: 0, warm: 0 });
  });
// Solo el centro (donde está la pelea), si se pide (`RECORTE` = ancho x alto).
const [cw, ch] = (process.env.RECORTE ?? '').split('x').map(Number);
const clip = cw
  ? { x: (vp.width - cw) / 2, y: (vp.height - ch) / 2 - 40, width: cw, height: ch }
  : undefined;
let k = 0;
for (let t = 0; t < TOTAL; t += CADA) {
  await page.waitForTimeout(CADA);
  await page.screenshot({ path: `${out}/a${String(k++).padStart(3, '0')}.png`, clip });
}
await browser.close();
