/**
 * Capturas de los incidentes dibujados en su sala. Uso (con `npm run build` y
 * `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/incidentes.mjs <carpeta> [puerto=4173]
 *
 * Mete a mano cada incidente en una sala de su tipo (si no la hay en uso, arregla una rota y le
 * cambia el tipo) y saca la sala de cerca (`incidente-<tipo>.png`), dos veces seguidas para ver
 * la animación (`-b`); las ratas, al tocarlas y al acabar (`ratas-toque.png`, `ratas-fin.png`); y
 * cada uno al salir bien (`bien-<tipo>.png`) y al salir mal (`mal-<tipo>.png`, `-b`), dejando que
 * llegue su hora; y al final cómo se va el último al resolverse (`resuelto.png`).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const port = process.argv[3] ?? '4173';
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
await page.goto(`http://localhost:${port}/#debug`);
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

// Sin las lecciones del tío, que tapan la sala.
const skip = page.getByText(/Saltar lecciones|Ya sé jugar/);
if (await skip.count())
  await skip
    .first()
    .click()
    .catch(() => {});
// (Por si la nota sale tarde: el tutorial para el reloj y así nada llega a salir mal.)
await page.evaluate(() => window.__game.dispatch({ type: 'tutorial', op: 'saltar' }));
await page.waitForTimeout(400);
// Dónde pasa cada uno (ver `data/incidents.ts`).
const WHERE = {
  pelea: 'salon',
  noble: 'salon',
  ladron: 'tesoro',
  fuego: 'cocina',
  ratas: 'despensa',
  recaudador: 'recibidor',
  gotera: 'bodega',
};
const only = process.argv[4]?.split(',');
for (const [kind, type] of Object.entries(WHERE)) {
  if (only && !only.includes(kind)) continue;
  const id = await page.evaluate(
    ({ kind, type }) => {
      const g = window.__game;
      const s = g.get();
      const rooms = s.building.rooms.map((r) => ({ ...r }));
      let room = rooms.find((r) => r.type === type && r.level > 0);
      if (!room) {
        room =
          rooms.find((r) => r.type === type) ??
          rooms.find((r) => r.level === 0 && r.type !== 'torre' && r.type !== 'salon');
        if (!room) return null;
        room.type = type;
        room.level = Math.max(1, room.level);
        delete room.works;
      }
      g.set({
        ...s,
        building: { ...s.building, rooms },
        incidents: [{ id: `x${kind}`, kind, room: room.id, from: 0, until: 9e9, taps: 6 }],
      });
      return room.id;
    },
    { kind, type },
  );
  if (!id) {
    console.log('sin sala para', kind);
    continue;
  }
  await page.waitForTimeout(400);
  await page.evaluate((id) => {
    const sc = window.__scene;
    const r = sc.layout.rooms.find((x) => x.room.id === id).rect;
    sc.resize(sc.cssW, sc.cssH, 4);
    sc.camera.centerOn(r.x + r.w / 2, r.y + r.h / 2, false);
  }, id);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/incidente-${kind}.png` });
  await page.waitForTimeout(330);
  await page.screenshot({ path: `${out}/incidente-${kind}-b.png` });
  // Las ratas: un toque espanta una; y al acabar, las que quedan se van corriendo.
  if (kind === 'ratas') {
    await page.evaluate(() => {
      const g = window.__game;
      const s = g.get();
      g.set({ ...s, incidents: s.incidents.map((i) => ({ ...i, taps: 2 })) });
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${out}/ratas-toque.png` });
    await page.evaluate(() => {
      const g = window.__game;
      g.set({ ...g.get(), incidents: [] });
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}/ratas-fin.png` });
  }
  // Sale bien (se quita antes de su hora) y sale mal (se deja que llegue su hora).
  await page.evaluate(() => {
    const g = window.__game;
    g.set({ ...g.get(), incidents: [] });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/bien-${kind}.png` });
  await page.waitForTimeout(1500);
  await page.evaluate(
    ({ kind, id }) => {
      const g = window.__game;
      const s = g.get();
      const now = s.clock ?? 0;
      g.set({
        ...s,
        incidents: [{ id: `y${kind}`, kind, room: id, from: now, until: now + 2, taps: 6 }],
      });
    },
    { kind, id },
  );
  await page
    .waitForFunction(() => !(window.__game.get().incidents ?? []).length, null, { timeout: 15000 })
    .catch(() => console.log('no ha salido mal a tiempo:', kind));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/mal-${kind}.png` });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/mal-${kind}-b.png` });
}
// Resuelto: se deshace en polvo.
await page.evaluate(() => {
  const g = window.__game;
  g.set({ ...g.get(), incidents: [] });
});
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/resuelto.png` });
await browser.close();
