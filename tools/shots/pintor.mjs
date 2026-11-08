/**
 * Capturas del pintor (con `npm run build` y `npx vite preview --port 4173`):
 *
 *   node tools/shots/pintor.mjs <carpeta> [ancho] [alto]
 *
 * Partida nueva con el taller del pintor y un pintor que va a pintar la sala `SALA` (por
 * defecto, el dormitorio) del color `COLOR` (por defecto, `bosque`). Saca `camino.png` (va de
 * camino: la sala no cambia), `franjas-NN.png` (pintando, con lo que lleva cada vez más) y
 * `escalera-N.png` (de cerca, subido a la escalera), `fin-NNN.png` (al acabar: las gotas, una
 * cada `CADA` ms), `taller.png` (antes) y `taller-pintando.png` (de vuelta en su taller).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const vp = { width: Number(process.argv[3] ?? 900), height: Number(process.argv[4] ?? 600) };
const SALA = process.env.SALA ?? 'dormitorio';
const COLOR = process.env.COLOR ?? 'bosque';
const CADA = Number(process.env.CADA ?? 120);
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

/** Centra la cámara en la sala de ese tipo, a zoom 4. */
const look = (type) =>
  page.evaluate((type) => {
    const sc = window.__scene;
    const r = sc.layout.rooms.find((x) => x.room.type === type);
    sc.resize(sc.cssW, sc.cssH, 4);
    sc.camera.centerOn(r.rect.x + r.rect.w / 2, r.rect.y + r.rect.h / 2, false);
  }, type);

// El taller del pintor en lugar de la sala de mapas (o en el hueco que haya), con su pintor, y
// la sala que se pinta arreglada a nivel 2. A media mañana.
await page.evaluate(
  ([sala]) => {
    const g = window.__game;
    const s = structuredClone(g.get());
    const b = s.building;
    for (const r of b.rooms) {
      if (r.level < 1) r.level = 1;
      delete r.works;
    }
    const host =
      b.rooms.find((x) => x.type === 'mapas') ?? b.rooms.find((x) => x.type === 'veteranos');
    host.type = 'pintor';
    host.id = 'taller-pintor';
    host.level = 2;
    host.w = Math.min(host.w, 2);
    const room = b.rooms.find((x) => x.type === sala);
    room.level = Math.max(2, room.level);
    const base = s.workers[0];
    s.workers = [
      ...s.workers,
      {
        ...base,
        id: 'pintor1',
        seed: 'pintor-1',
        name: 'Ramira',
        sex: 'f',
        trade: 'pintor',
        room: host.id,
        village: undefined,
        walk: undefined,
        since: undefined,
        skill: 4,
      },
    ];
    s.tips = ['*'];
    g.set(s);
  },
  [SALA],
);
await page.waitForTimeout(8000);
await look('pintor');
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/taller.png` });

// Se encarga pintar la sala: el pintor va de camino.
const ok = await page.evaluate(
  ([sala, color]) => {
    const g = window.__game;
    const s = structuredClone(g.get());
    const room = s.building.rooms.find((x) => x.type === sala);
    const day = (s.clock ?? 0) / 360;
    s.paints = [
      {
        id: 'p1',
        shop: 'taller-pintor',
        painter: 'pintor1',
        room: room.id,
        tint: color === 'casa' ? null : color,
        need: 1000,
        done: 0,
        at: day + 0.2,
        wait: true,
        gold: 20,
      },
    ];
    g.set(s);
    return room.id;
  },
  [SALA, COLOR],
);
console.log('sala', ok);
await page.waitForTimeout(1500);
await look(SALA);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/camino.png` });
// Espera a que llegue (lo dice la escena con `arrived`).
for (let i = 0; i < 90; i++) {
  const wait = await page.evaluate(() => window.__game.get().paints?.[0]?.wait);
  if (!wait) break;
  await page.waitForTimeout(1000);
}
console.log('llegó', await page.evaluate(() => JSON.stringify(window.__game.get().paints)));
// Pintando: lo que lleva, cada vez más (se fuerza `done`).
const steps = [0.08, 0.2, 0.45, 0.8];
for (let k = 0; k < steps.length; k++) {
  await page.evaluate((f) => {
    const g = window.__game;
    const s = structuredClone(g.get());
    if (!s.paints?.length) return;
    s.paints[0].done = f * s.paints[0].need;
    s.paints[0].at = (s.clock ?? 0) / 360;
    g.set(s);
  }, steps[k]);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${out}/franjas-${String(k).padStart(2, '0')}.png` });
}
// Subida a la escalera: al empezar una franja (arriba, la cenefa), de cerca.
await page.evaluate(() => {
  const g = window.__game;
  const s = structuredClone(g.get());
  if (!s.paints?.length) return;
  const n = Math.ceil(window.__scene.walls.get(s.paints[0].room).w / 6);
  s.paints[0].done = ((Math.floor(n * 0.6) + 0.05) / n) * s.paints[0].need;
  s.paints[0].at = (s.clock ?? 0) / 360;
  g.set(s);
});
await page.waitForTimeout(4000);
await page.evaluate(() => {
  const sc = window.__scene;
  const w = sc.crowd.where('pintor1');
  sc.resize(sc.cssW, sc.cssH, 6);
  if (w) sc.camera.centerOn(w.x, w.y - 20, false);
});
for (let k = 0; k < 6; k++) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/escalera-${k}.png` });
}
await look(SALA);
await page.waitForTimeout(800);
// Al acabar: las gotas por la pared.
await page.evaluate(() => {
  const g = window.__game;
  const s = structuredClone(g.get());
  if (!s.paints?.length) return;
  s.paints[0].done = s.paints[0].need;
  g.set(s);
});
for (let k = 0; k < 20; k++) {
  await page.waitForTimeout(CADA);
  await page.screenshot({ path: `${out}/fin-${String(k).padStart(3, '0')}.png` });
}
// De vuelta en su taller, pintando el cuadro del caballete.
await look('pintor');
await page.waitForTimeout(25000);
await page.screenshot({ path: `${out}/taller-pintando.png` });
await browser.close();
