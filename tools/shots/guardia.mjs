/**
 * Capturas del puesto de los de guardia en el recibidor (con `npm run build` y
 * `npx vite preview --port 4173`):
 *
 *   node tools/shots/guardia.mjs <carpeta> [ancho] [alto]
 *
 * Partida nueva con dos héroes de guardia. Saca `dia-NNN.png` (jugando a las cartas y los
 * dados) y, tras caer la noche, `noche-NNN.png` (cabeceando con sus «zzz»): una cada `CADA` ms
 * (por defecto 200) durante `TOTAL` ms (6 s) cada una.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const vp = { width: Number(process.argv[3] ?? 900), height: Number(process.argv[4] ?? 600) };
const CADA = Number(process.env.CADA ?? 200);
const TOTAL = Number(process.env.TOTAL ?? 6000);
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
// Dos de guardia (los primeros héroes, en casa y sanos).
await page.evaluate(() => {
  const g = window.__game;
  const s = g.get();
  const base = s.heroes[0];
  const heroes = [0, 1].map((i) => ({
    ...base,
    ...(s.heroes[i] ?? {}),
    id: `guardia${i}`,
    seed: `guardia-${i}`,
    name: `Guardia ${i}`,
    status: 'ok',
    job: undefined,
    guard: true,
  }));
  g.set({ ...s, heroes: [...heroes, ...s.heroes.slice(2)], tips: ['*'] });
});
// Que lleguen a su puesto y la cámara, en el recibidor.
await page.waitForTimeout(Number(process.env.ESPERA ?? 25000));
await page.evaluate(() => {
  const sc = window.__scene;
  const r = sc.layout.rooms.find((x) => x.room.type === 'recibidor');
  sc.resize(sc.cssW, sc.cssH, 5);
  sc.camera.centerOn(r.rect.x + r.rect.w / 2, r.rect.y + r.rect.h - 30, false);
});
const shots = async (name) => {
  let k = 0;
  for (let t = 0; t < TOTAL; t += CADA) {
    await page.waitForTimeout(CADA);
    await page.screenshot({ path: `${out}/${name}-${String(k++).padStart(3, '0')}.png` });
  }
};
await shots('dia');
// De noche (una noche larga, sin pasar al día siguiente).
await page.evaluate(() => window.__scene.nightfall(() => {}, 120));
await page.waitForTimeout(3000);
await shots('noche');
await browser.close();
