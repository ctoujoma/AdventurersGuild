/**
 * Capturas de una sala a cada nivel, de día y de noche, para los PR del arte. Uso (con
 * `npm run build` y `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/sala.mjs <carpeta> <tipo> [anchos=1] [zoom=4]
 *
 * Por ejemplo `node tools/shots/sala.mjs shots recibidor` o `… shots cocina 1,3`. Saca
 * `<tipo>-a<ancho>-n<nivel>-<dia|noche>.png`, más la sala en obras (y, en el recibidor, la
 * puerta de la calle vista de cerca). Si la sala no existe en la
 * partida del tío, la pone en el primer hueco libre de la planta baja. En el recibidor pone
 * dos héroes de guardia, para ver que no los tapa nada.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const type = process.argv[3] ?? 'recibidor';
const widths = (process.argv[4] ?? '1').split(',').map(Number);
const zoom = Number(process.argv[5] ?? 4);
const vp = { width: 1280, height: 760 };
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
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
await page.goto('http://localhost:4173/#debug');
await page.waitForTimeout(4500);
await page.mouse.click(vp.width / 2, vp.height / 2);
await page.waitForTimeout(800);
const start = page.getByRole('button', { name: 'Nueva partida' });
if (await start.count()) await start.click();
await page.waitForTimeout(2500);
for (let i = 0; i < 4; i++) {
  const close = page.locator(
    'button:has-text("Entrar en la taberna"), button:has-text("Abrir la taberna"), button[aria-label="Abrir la taberna"], button:has-text("Seguir"), button:has-text("Entendido"), button:has-text("Vale")',
  );
  if (await close.count())
    await close
      .first()
      .click()
      .catch(() => {});
  await page.waitForTimeout(500);
}

/** Deja la sala a ese nivel y ancho (o en obras) y la encuadra (`dx`: cámara corrida). */
async function prepare(w, level, works, dx = 0) {
  await page.evaluate(
    ([type, w, level, works]) => {
      const g = window.__game;
      const s = structuredClone(g.get());
      s.tips = ['*'];
      const b = s.building;
      let r = b.rooms.find((x) => x.type === type);
      if (!r) {
        r = { id: `prueba-${type}`, type, col: 0, floor: 0, w: 1, h: 1, level: 1, spent: 0 };
        b.rooms.push(r);
      }
      // Hace sitio a su derecha si hay que ensancharla (quita lo que estorbe en esa planta).
      b.cols = Math.max(b.cols, r.col + w);
      b.rooms = b.rooms.filter(
        (x) => x === r || x.floor !== r.floor || x.col + x.w <= r.col || x.col >= r.col + w,
      );
      b.stairs = b.stairs.filter((x) => x.at <= r.col || x.at >= r.col + w);
      r.w = w;
      r.level = level;
      if (works) r.works = { kind: 'upgrade', nights: 1 };
      else delete r.works;
      if (type === 'recibidor')
        s.heroes.forEach((h, i) => {
          h.guard = i < 2;
        });
      g.set(s);
      window.__sala = r.id;
    },
    [type, w, level, works],
  );
  await page.waitForTimeout(1500);
  // Se encuadra después: al ver una sala en obras, la escena mueve la cámara por su cuenta.
  await page.evaluate(
    ([zoom, dx]) => {
      const sc = window.__scene;
      sc.resize(sc.cssW, sc.cssH, zoom);
      const sp = sc.spots.find((x) => x.id === `sala:${window.__sala}`);
      sc.camera.centerOn(sp.rect.x + sp.rect.w / 2 + dx, sp.rect.y + sp.rect.h / 2 - 10, false);
    },
    [zoom, dx],
  );
  await page.waitForTimeout(1200);
}

for (const night of [false, true]) {
  if (night) {
    await page.evaluate(() => window.__scene.nightfall(() => {}, 1, Infinity));
    await page.waitForTimeout(3000);
  }
  const t = night ? 'noche' : 'dia';
  for (const w of widths)
    for (const level of [0, 1, 2, 3]) {
      await prepare(w, level, false);
      await page.screenshot({ path: `${out}/${type}-a${w}-n${level}-${t}.png` });
    }
  if (!night) {
    await prepare(widths[0], 1, true);
    await page.screenshot({ path: `${out}/${type}-obras.png` });
    // La puerta de la calle, por dentro (su nivel es el del recibidor), con la cámara a la derecha.
    if (type === 'recibidor')
      for (const level of [0, 1, 2, 3]) {
        await prepare(1, level, false, 70);
        await page.screenshot({ path: `${out}/${type}-puerta-n${level}.png` });
      }
  }
}
await browser.close();
