/**
 * Capturas para la galería del arte de las salas: cada sala recortada justo (con sus muros), a
 * nivel 0–3, de día y de noche, de ancho 1 y de ancho máximo, sin gente y a la misma hora. Uso
 * (con `npm run build` y `npx vite preview --port <puerto>` en marcha):
 *
 *   node tools/shots/galeria.mjs <carpeta> [puerto=4173] [tipos=todos]
 *
 * Saca `<tipo>-a<ancho>-n<nivel>-<dia|noche>.png` a zoom 4 (cada píxel del mundo, 4×4); la
 * cámara del tesoro, con tres cantidades de oro (`tesoro_o10`, `_o50` y `_o100`: lo lleno que
 * está, en %), porque sus montones crecen con él;
 * `tools/shots/galeria.py` los reduce a 1:1 y los junta en láminas para el visor. Se puede
 * correr contra otra versión del juego (por ejemplo, `main` para el «antes»): solo toca
 * `window.__game` y `window.__scene`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'galeria';
const port = Number(process.argv[3] ?? 4173);
/**
 * Dónde se pone cada sala (hueco y planta) y su ancho máximo: en el hueco 1 de su planta, para
 * que la cámara la vea de frente (en los extremos del edificio no puede centrarse), salvo el
 * recibidor y la torre, que tienen su sitio.
 */
const SLOTS = {
  recibidor: [0, 0, 1],
  salon: [1, 0, 3],
  cocina: [1, 0, 3],
  bodega: [1, -1, 3],
  tesoro: [1, -1, 3],
  dormitorio: [1, 1, 3],
  enfermeria: [1, 1, 3],
  capilla: [1, 1, 3],
  mapas: [1, 2, 3],
  armeria: [1, -1, 3],
  forja: [1, -1, 3],
  despensa: [1, -1, 3],
  armas: [1, 1, 3],
  tiro: [1, 1, 3],
  biblioteca: [1, 2, 3],
  servicio: [1, 1, 3],
  veteranos: [1, 2, 3],
  torre: [0, 3, 1],
};
const types = process.argv[4] ? process.argv[4].split(',') : Object.keys(SLOTS);
const vp = { width: 1920, height: 1080 };
const ZOOM = 4;
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

/** Lo que cabe en la cámara del tesoro por hueco y nivel (VAULT_STORE de core/balance.ts). */
const VAULT_STORE = [300, 1500, 4000, 10000];
/** Lo lleno que sale el tesoro en cada juego de capturas. */
const GOLD = [0.1, 0.5, 1];

/**
 * Prepara la sala `type` a ese ancho y nivel (y, si se da, con el oro que llena esa parte de la
 * cámara); devuelve el recorte en la pantalla.
 */
async function shoot(type, w, level, fill) {
  await page.evaluate(
    ([type, slot, w, level, gold]) => {
      const s = structuredClone(window.__base);
      if (gold !== null) s.gold = gold;
      s.tips = ['*'];
      s.heroes = [];
      s.workers = [];
      s.candidates = [];
      // En la armería, algo de equipo sin dueño para ver los estantes (y lo que no cabe, en arcones).
      const gear = [
        ['espada', 'arma', 0],
        ['escudo', 'armadura', 1],
        ['hacha', 'arma', 0],
        ['coraza', 'armadura', 2],
        ['varita', 'arma', 1],
        ['capa', 'armadura', 0],
        ['botas', 'armadura', 1],
        ['amuleto', 'amuleto', 2],
        ['ganzua', 'herramienta', 0],
        ['espada', 'arma', 2],
      ];
      s.inventory =
        type === 'armeria'
          ? gear.map(([icon, kind, rarity], i) => ({
              id: `galeria-${i}`,
              name: icon,
              desc: '',
              value: 10,
              kind,
              icon,
              rarity,
            }))
          : [];
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
      // (Con un hueco de más a la derecha, para que la cámara pueda centrarla.)
      b.cols = Math.max(b.cols, col + w + 1);
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
    [
      type,
      SLOTS[type],
      w,
      level,
      fill === undefined
        ? null
        : Math.round(Math.max(VAULT_STORE[0], VAULT_STORE[level] * w) * fill),
    ],
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
    const fills = type === 'tesoro' ? GOLD : [undefined];
    for (const fill of fills)
      for (const w of [...new Set([1, max])])
        for (const level of [3, 2, 1, 0]) {
          const clip = await shoot(type, w, level, fill);
          const name = fill === undefined ? type : `${type}_o${Math.round(fill * 100)}`;
          const file = `${name}-a${w}-n${level}-${t}.png`;
          await page.screenshot({ path: `${out}/${file}`, clip });
          manifest[file] = clip;
          console.log(file);
        }
  }
}
writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest));
await browser.close();
