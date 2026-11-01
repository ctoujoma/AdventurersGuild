/**
 * Capturas del fondo de la escena (cielo, capas lejanas, patio y hierba) a varias horas. Uso
 * (con `npm run build` y `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/fondo.mjs <carpeta> [ancho=1280] [alto=760] [zoom=2]
 *
 * Saca la taberna entera y un trozo del patio de cerca por la mañana (`manana`), a mediodía
 * (`mediodia`), al atardecer (`tarde`) y de noche (`noche`); y una tira de fotogramas del
 * patio para ver la hierba moverse (`viento-*.png`; cuántos, en `FOTOGRAMAS`).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const vp = { width: Number(process.argv[3] ?? 1280), height: Number(process.argv[4] ?? 760) };
const zoom = Number(process.argv[5] ?? 2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
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
    'button:has-text("Entrar en la taberna"), button:has-text("Abrir la taberna"), button:has-text("Seguir"), button:has-text("Entendido"), button:has-text("Vale")',
  );
  if (await close.count())
    await close
      .first()
      .click()
      .catch(() => {});
  await page.waitForTimeout(500);
}
await page.evaluate(() => {
  const g = window.__game;
  g.dispatch({ type: 'tutorial', op: 'saltar' });
  g.set({ ...g.get(), tips: ['*'] });
});
await page.waitForTimeout(600);

/** Pone la hora (0 mañana – 1 noche) y encuadra: la casa entera (`lejos`) o el patio de cerca. */
const frame = async (tod, near) =>
  page.evaluate(
    ({ tod, near, zoom }) => {
      const s = window.__scene;
      // El reloj del juego vuelve a poner la hora cada poco: aquí manda la captura.
      if (!s.shotTime) {
        s.shotTime = s.setTime.bind(s);
        s.setTime = () => {};
      }
      s.shotTime(tod);
      s.resize(s.cssW, s.cssH, near ? zoom + 1 : zoom);
      const L = s.layout;
      const x = near ? L.left - 120 : (L.left + L.right) / 2;
      s.camera.centerOn(x, near ? 270 : 190, false);
    },
    { tod, near, zoom },
  );

for (const [name, tod] of [
  ['manana', 0.08],
  ['mediodia', 0.4],
  ['tarde', 0.72],
]) {
  await frame(tod, false);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}.png` });
  await frame(tod, true);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}-patio.png` });
}
// El viento: fotogramas seguidos del patio (para hacer un GIF), mirando un poco más arriba.
await frame(0.4, true);
await page.evaluate(() => {
  const s = window.__scene;
  s.camera.centerOn(s.layout.left - 120, 250, false);
});
for (let i = 0; i < Number(process.env.FOTOGRAMAS ?? 4); i++) {
  await page.waitForTimeout(140);
  await page.screenshot({ path: `${out}/viento-${String(i).padStart(2, '0')}.png` });
}
// De noche.
await frame(0.4, false);
await page.evaluate(() => window.__scene.nightfall(() => {}, 30));
await page.waitForTimeout(11500);
await page.screenshot({ path: `${out}/noche.png` });
await frame(0.4, true);
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/noche-patio.png` });
await browser.close();
