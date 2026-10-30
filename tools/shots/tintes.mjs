/**
 * Capturas de los colores por sala: cada sala al nivel más alto del juego y al ancho máximo,
 * con varios temas, de día y de noche. Uso (con `npm run build` y `npx vite preview --port
 * 4173` en marcha):
 *
 *   node tools/shots/tintes.mjs <carpeta> <tipos> [temas=casa,mar,bosque,ocre] [zoom=3]
 *
 * Saca `<tipo>-<tema>-<dia|noche>.png` («casa» = sin tema). Las salas van a la primera planta
 * (de madera: en el nivel 3 llevan la pared entelada); las que no existen, al primer hueco.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const types = (process.argv[3] ?? 'salon').split(',');
const tints = (process.argv[4] ?? 'casa,mar,bosque,ocre').split(',');
const zoom = Number(process.argv[5] ?? 3);
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
await page.goto('http://localhost:4173/#debug');
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

/** Deja la sala al nivel máximo, ancha, en la planta `floor`, con el tema `tint`, y la encuadra. */
async function prepare(type, tint) {
  await page.evaluate(
    ([type, tint]) => {
      const g = window.__game;
      const s = structuredClone(g.get());
      s.tips = ['*'];
      const b = s.building;
      const max = { veteranos: 2, capilla: 2 }[type] ?? 3;
      const w = { salon: 3, recibidor: 1, capilla: 2, enfermeria: 3 }[type] ?? 3;
      const h = type === 'salon' ? 2 : 1;
      const floor = type === 'salon' || type === 'recibidor' ? 0 : 1;
      let r = b.rooms.find((x) => x.type === type);
      if (!r) {
        r = { id: `prueba-${type}`, type, col: 1, floor, w: 1, h, level: 1, spent: 0 };
        b.rooms.push(r);
      }
      if (type !== 'salon' && type !== 'recibidor') {
        r.floor = floor;
        r.col = 1;
      }
      b.cols = Math.max(b.cols, r.col + w);
      b.rooms = b.rooms.filter(
        (x) =>
          x === r ||
          x.floor + x.h <= r.floor ||
          x.floor >= r.floor + h ||
          x.col + x.w <= r.col ||
          x.col >= r.col + w,
      );
      b.stairs = b.stairs.filter((x) => x.at <= r.col || x.at >= r.col + w);
      r.w = w;
      r.level = max;
      delete r.works;
      s.custom = {
        ...(s.custom ?? { name: 'El Jarro Partido', color: 'vino', symbol: 'jarra', dog: false }),
      };
      s.custom.colors = tint === 'casa' ? {} : { [r.id]: tint };
      g.set(s);
      window.__sala = r.id;
    },
    [type, tint],
  );
  await page.waitForTimeout(1500);
  await page.evaluate((zoom) => {
    const sc = window.__scene;
    sc.resize(sc.cssW, sc.cssH, zoom);
    const sp = sc.spots.find((x) => x.id === `sala:${window.__sala}`);
    sc.camera.centerOn(sp.rect.x + sp.rect.w / 2, sp.rect.y + sp.rect.h / 2 - 10, false);
  }, zoom);
  await page.waitForTimeout(1200);
}

for (const night of [false, true]) {
  if (night) {
    await page.evaluate(() => {
      window.__scene.nightfall(() => {}, 1, Infinity);
      // Que la gente se acueste (lo hace la partida al caer la noche).
      window.__scene.crowd.setNight('night');
    });
    await page.waitForTimeout(3000);
  }
  const t = night ? 'noche' : 'dia';
  for (const type of types)
    for (const tint of tints) {
      await prepare(type, tint);
      // De noche, `ESPERA` milisegundos más para que la gente llegue a la cama.
      if (night) await page.waitForTimeout(Number(process.env.ESPERA ?? 0));
      await page.screenshot({ path: `${out}/${type}-${tint}-${t}.png` });
    }
}
await browser.close();
