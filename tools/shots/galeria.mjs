/**
 * Capturas para la galería del arte de las salas: cada sala recortada justo (con sus muros), a
 * nivel 0–3, de día y de noche, de ancho 1 y de ancho máximo, sin gente y a la misma hora. Uso
 * (con `npm run build` y `npx vite preview --port <puerto>` en marcha):
 *
 *   node tools/shots/galeria.mjs <carpeta> [puerto=4173] [tipos=todos]
 *
 * Saca `<tipo>-a<ancho>-n<nivel>-<dia|noche>.png` a zoom 2 (cada píxel del mundo, 2×2);
 * `tools/shots/galeria.py` los reduce a 1:1 y los junta en láminas para el visor. Se puede
 * correr contra otra versión del juego (por ejemplo, `main` para el «antes»): solo toca
 * `window.__game` y `window.__scene`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'galeria';
const port = Number(process.argv[3] ?? 4173);
/** Dónde va cada sala en la partida del tío (hueco y planta) y su ancho máximo. */
const SLOTS = {
  recibidor: [0, 0, 1],
  salon: [1, 0, 3],
  cocina: [3, 0, 3],
  bodega: [0, -1, 3],
  tesoro: [3, -1, 3],
  dormitorio: [1, 1, 3],
  enfermeria: [0, 1, 3],
  capilla: [3, 1, 3],
  mapas: [0, 2, 3],
  armeria: [1, -1, 3],
  forja: [2, -1, 3],
  despensa: [1, -1, 3],
  armas: [1, 1, 3],
  tiro: [1, 1, 3],
  biblioteca: [1, 2, 3],
  servicio: [1, 1, 3],
  veteranos: [1, 2, 3],
  torre: [0, 3, 1],
};
const types = process.argv[4] ? process.argv[4].split(',') : Object.keys(SLOTS);
const vp = { width: 1280, height: 760 };
const ZOOM = 2;
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
await page.goto(`http://localhost:${port}/#debug`);
await page.waitForTimeout(4500);
await page.mouse.click(vp.width / 2, vp.height / 2);
await page.waitForTimeout(800);
const start = page.getByRole('button', { name: 'Nueva partida' });
if (await start.count()) await start.click();
await page.waitForTimeout(2500);
for (let i = 0; i < 4; i++) {
  const close = page.locator(
    'button:has-text("Abrir la taberna"), button:has-text("Seguir"), button:has-text("Entendido"), button:has-text("Vale")',
  );
  if (await close.count())
    await close
      .first()
      .click()
      .catch(() => {});
  await page.waitForTimeout(500);
}
// La partida de partida (para rehacerla en cada captura), sin gente, sin polvo de obras y con
// el reloj parado a media mañana.
await page.evaluate(() => {
  const sc = window.__scene;
  window.__base = structuredClone(window.__game.get());
  const crowd = sc.crowd;
  crowd.setVisitors({ day: -1, kinds: [] });
  crowd.setPeople([]);
  crowd.setPeople = () => {};
  crowd.setVisitors = () => {};
  sc.celebrate = () => {};
  const setTime = sc.setTime.bind(sc);
  setTime(0.35);
  sc.setTime = () => {};
});

/** Prepara la sala `type` a ese ancho y nivel; devuelve el recorte en la pantalla. */
async function shoot(type, w, level) {
  await page.evaluate(
    ([type, slot, w, level]) => {
      const s = structuredClone(window.__base);
      s.tips = ['*'];
      s.heroes = [];
      s.workers = [];
      s.candidates = [];
      const b = s.building;
      const [col, floor] = slot;
      let r = b.rooms.find((x) => x.type === type);
      if (!r) {
        r = { id: `galeria-${type}`, type, col, floor, w: 1, h: 1, level: 1, spent: 0 };
        b.rooms.push(r);
      }
      r.col = col;
      r.floor = floor;
      // Le hace sitio: fuera lo que pise su planta y las escaleras de dentro.
      b.cols = Math.max(b.cols, col + w);
      b.rooms = b.rooms.filter(
        (x) =>
          x === r ||
          (type === 'torre') !== (x.type === 'torre') ||
          x.floor + x.h - 1 < floor ||
          x.floor > floor ||
          x.col + x.w <= col ||
          x.col >= col + w,
      );
      b.stairs = b.stairs.filter((x) => x.at <= col || x.at >= col + w);
      r.w = w;
      r.level = level;
      delete r.works;
      window.__game.set(s);
      window.__sala = r.id;
    },
    [type, SLOTS[type], w, level],
  );
  await page.waitForTimeout(1200);
  const box = await page.evaluate((zoom) => {
    const sc = window.__scene;
    sc.resize(sc.cssW, sc.cssH, zoom);
    const sp = sc.spots.find((x) => x.id === `sala:${window.__sala}`);
    const r = sp.rect;
    sc.camera.centerOn(r.x + r.w / 2, r.y + r.h / 2, false);
    // Con sus muros (8) y forjados (16) alrededor, y un poco de lo de al lado.
    const m = { x: 12, y: 20 };
    const a = sc.screenOf(r.x - m.x, r.y - m.y);
    const c = sc.canvas.getBoundingClientRect();
    return {
      x: Math.round(c.left + a.x),
      y: Math.round(c.top + a.y),
      width: Math.round((r.w + 2 * m.x) * zoom),
      height: Math.round((r.h + 2 * m.y) * zoom),
    };
  }, ZOOM);
  await page.waitForTimeout(900);
  return box;
}

const manifest = {};
for (const night of [false, true]) {
  if (night) {
    await page.evaluate(() => window.__scene.nightfall(() => {}, 1, Infinity));
    await page.waitForTimeout(3000);
  }
  const t = night ? 'noche' : 'dia';
  for (const type of types) {
    const max = SLOTS[type][2];
    for (const w of [...new Set([1, max])])
      for (const level of [3, 2, 1, 0]) {
        const clip = await shoot(type, w, level);
        const file = `${type}-a${w}-n${level}-${t}.png`;
        await page.screenshot({ path: `${out}/${file}`, clip });
        manifest[file] = clip;
        console.log(file);
      }
  }
}
writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest));
await browser.close();
