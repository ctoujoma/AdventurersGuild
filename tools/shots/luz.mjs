/**
 * Luz con ambiente: la taberna entera y el salón de cerca, por la mañana, por la tarde y de noche,
 * con el ajuste quitado (`-antes`) y puesto (`-ambiente`). Uso (con `npm run build` y
 * `npx vite preview --port 4173`): node tools/shots/luz.mjs <carpeta> [ancho] [alto]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const vp = { width: Number(process.argv[3] ?? 1280), height: Number(process.argv[4] ?? 760) };
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

const view = async (tod, z, room) =>
  page.evaluate(
    ({ tod, z, room }) => {
      const s = window.__scene;
      if (!s.shotTime) {
        s.shotTime = s.setTime.bind(s);
        s.setTime = () => {};
      }
      s.shotTime(tod);
      s.resize(s.cssW, s.cssH, z);
      const L = s.layout;
      const r = room && L.rooms.find((x) => x.room.type === room);
      if (r) s.camera.centerOn(r.rect.x + r.rect.w / 2, r.rect.y + r.rect.h / 2, false);
      else s.camera.centerOn((L.left + L.right) / 2, 190, false);
    },
    { tod, z, room },
  );
const pair = async (name) => {
  for (const on of [false, true]) {
    await page.evaluate((on) => (window.__scene.moodLight = on), on);
    await page.waitForTimeout(450);
    await page.screenshot({
      path: `${out}/${name}-${on ? 'ambiente' : 'antes'}.png`,
      clip: { x: 76, y: 62, width: vp.width - 76, height: vp.height - 62 },
    });
  }
};
const both = async (name) => {
  await view(tod, 2);
  await page.waitForTimeout(600);
  await pair(`${name}-taberna`);
  await view(tod, 4, 'salon');
  await page.waitForTimeout(600);
  await pair(`${name}-salon`);
};
let tod = 0.15;
for (const [name, t] of [
  ['manana', 0.15],
  ['tarde', 0.72],
]) {
  tod = t;
  await both(name);
}
await page.evaluate(() => window.__scene.nightfall(() => {}, 40));
await page.waitForTimeout(15500);
tod = 0.4;
await both('noche');
await browser.close();
