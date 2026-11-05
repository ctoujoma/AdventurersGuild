// Prueba de luz del estilo nuevo: el salón de tarde y de noche, como hoy, con sombras y menos
// luz ambiente, y con lo que queda en sombra en magenta. Uso: node tools/shots/sombras.mjs <carpeta>
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

const salon = async (tod, z) =>
  page.evaluate(
    ({ tod, z }) => {
      const s = window.__scene;
      if (!s.shotTime) {
        s.shotTime = s.setTime.bind(s);
        s.setTime = () => {};
      }
      s.shotTime(tod);
      s.resize(s.cssW, s.cssH, z);
      const r = s.layout.rooms.find((x) => x.room.type === 'salon');
      s.camera.centerOn(r.rect.x + r.rect.w / 2, r.rect.y + r.rect.h / 2, false);
    },
    { tod, z },
  );
const pair = async (name) => {
  for (const [tag, on, amb, lamp] of [
    ['hoy', false, 1, 1],
    ['sombras', true, 1, 1],
    ['estilo', true, 0.45, 1.6],
    ['dbg', true, 0.45, 1.6],
  ]) {
    await page.evaluate(
      ({ on, amb, lamp }) => {
        window.__shadows = on;
        window.__ambK = amb;
        window.__lampK = lamp;
        window.__dbg = on && amb < 1 && window.__dbgNext;
        window.__dbgNext = amb < 1;
      },
      { on, amb, lamp },
    );
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `${out}/${name}-${tag}.png`,
      clip: { x: 76, y: 62, width: 1204, height: 698 },
    });
  }
};
await salon(0.72, 4);
await page.waitForTimeout(800);
await pair('tarde');
await page.evaluate(() => window.__scene.nightfall(() => {}, 30));
await page.waitForTimeout(11500);
await salon(0.4, 4);
await page.waitForTimeout(800);
await pair('noche');
await browser.close();
