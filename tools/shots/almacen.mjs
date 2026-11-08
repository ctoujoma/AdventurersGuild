/**
 * Capturas del almacén y del rincón de la bodega (con `npm run build` y
 * `npx vite preview --port 4173`):
 *
 *   node tools/shots/almacen.mjs <carpeta> [ancho] [alto]
 *
 * Saca el almacén (en el sitio de la sala de mapas) a nivel 1–3 y ancho 1 y 3, vacío, a medias y
 * lleno (`almacen-a<ancho>-n<nivel>-<0|50|100>.png`), y, sin almacén, el rincón de la bodega con
 * 0, 5 y 10 de cada básico (`bodega-<n>.png`).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const vp = { width: Number(process.argv[3] ?? 1600), height: Number(process.argv[4] ?? 900) };
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
await page.addStyleTag({ content: '.notebook, .notebook-mini { display: none !important; }' });
await page.waitForTimeout(400);

const STORE_CAP = [0, 15, 30, 50];
const MATS = ['hierro', 'cuero', 'tela', 'hierbas', 'madera', 'cristal'];
/** Prepara la partida: con almacén (`lvl`, `w`) o sin él, y lo lleno (`f`, 0–1) de cada material. */
const setup = (store, f) =>
  page.evaluate(
    ([store, f, STORE_CAP, MATS]) => {
      const g = window.__game;
      const s = structuredClone(window.__base);
      s.tips = ['*'];
      s.heroes = [];
      s.workers = [];
      s.candidates = [];
      const b = s.building;
      for (const r of b.rooms) {
        if (r.level < 1) r.level = 1;
        delete r.works;
      }
      const host = b.rooms.find((x) => x.type === 'mapas');
      let stored = 0;
      if (store) {
        host.type = 'almacen';
        host.id = 'almacen1';
        host.level = store.lvl;
        // Le hace sitio a lo ancho: fuera lo que pise su planta a la derecha.
        b.rooms = b.rooms.filter(
          (x) =>
            x === host ||
            x.floor !== host.floor ||
            x.col + x.w <= host.col ||
            x.col >= host.col + store.w,
        );
        b.stairs = b.stairs.filter((x) => x.at <= host.col || x.at >= host.col + store.w);
        b.cols = Math.max(b.cols, host.col + store.w + 1);
        host.w = store.w;
        stored = STORE_CAP[store.lvl] * store.w;
      }
      s.mats = {};
      for (const m of MATS) {
        const basic = ['hierro', 'cuero', 'tela'].includes(m);
        const cap = basic ? 10 + stored : store && store.lvl >= 2 ? stored : 0;
        if (cap) s.mats[m] = Math.round(cap * f);
      }
      g.set(s);
    },
    [store, f, STORE_CAP, MATS],
  );
const shoot = async (type, name) => {
  await page.waitForTimeout(1800);
  const box = await page.evaluate((type) => {
    const sc = window.__scene;
    const r = sc.layout.rooms.find((x) => x.room.type === type);
    sc.resize(sc.cssW, sc.cssH, 4);
    sc.camera.centerOn(r.rect.x + r.rect.w / 2, r.rect.y + r.rect.h / 2, false);
    const a = sc.screenOf(r.rect.x - 10, r.rect.y - 16);
    const c = sc.canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.round(c.left + a.x)),
      y: Math.max(0, Math.round(c.top + a.y)),
      width: Math.round((r.rect.w + 20) * 4),
      height: Math.round((r.rect.h + 32) * 4),
    };
  }, type);
  await page.waitForTimeout(700);
  await page.screenshot({
    path: `${out}/${name}.png`,
    clip: {
      ...box,
      width: Math.min(box.width, vp.width - box.x),
      height: Math.min(box.height, vp.height - box.y),
    },
  });
};
await page.evaluate(() => (window.__base = structuredClone(window.__game.get())));
for (const lvl of [1, 2, 3])
  for (const w of [1, 3])
    for (const f of [0, 0.5, 1]) {
      await setup({ lvl, w }, f);
      await shoot('almacen', `almacen-a${w}-n${lvl}-${Math.round(f * 100)}`);
    }
for (const n of [0, 5, 10]) {
  await setup(null, n / 10);
  await shoot('bodega', `bodega-${n}`);
}
await browser.close();
