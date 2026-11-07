/**
 * Capturas del duelo con el ladrón (con `npm run build` y `npx vite preview --port 4173`):
 *
 *   node tools/shots/ladron.mjs <carpeta> [ancho] [alto]
 *
 * Pone al ladrón en la cámara del tesoro y a un héroe delante, con un duelo de golpes alternos
 * (los hace a mano, como los daría `thiefDuel`). `GANA=0`: gana el ladrón y se escapa. Saca una
 * captura cada `CADA` ms (por defecto 200) durante `TOTAL` ms (12 s); `CLASE` el del héroe.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const vp = { width: Number(process.argv[3] ?? 900), height: Number(process.argv[4] ?? 600) };
const CADA = Number(process.env.CADA ?? 200);
const TOTAL = Number(process.env.TOTAL ?? 12000);
const WON = process.env.GANA !== '0';
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
// La cámara del tesoro (si no hay, se hace de una sala vacía) y el ladrón en ella.
const room = await page.evaluate(() => {
  const g = window.__game;
  const s = g.get();
  const rooms = s.building.rooms.map((r) => ({ ...r }));
  let room = rooms.find((r) => r.type === 'tesoro' && r.level > 0);
  if (!room) {
    room =
      rooms.find((r) => r.type === 'tesoro') ??
      rooms.find((r) => r.level === 0 && r.type !== 'torre' && r.type !== 'salon');
    room.type = 'tesoro';
    room.level = Math.max(1, room.level);
    delete room.works;
  }
  g.set({
    ...s,
    tips: ['*'],
    building: { ...s.building, rooms },
    incidents: [{ id: 'xladron', kind: 'ladron', room: room.id, from: 0, until: 9e9 }],
  });
  return room.id;
});
await page.waitForTimeout(1500);
// El héroe, delante del ladrón; y el duelo, desde ahora.
await page.evaluate(
  ({ room, won, cls }) => {
    const g = window.__game;
    const sc = window.__scene;
    const s = g.get();
    const h = { ...s.heroes[0], cls, status: 'ok', job: undefined };
    const r = sc.layout.rooms.find((x) => x.room.id === room);
    sc.crowd.setScripted(true);
    sc.crowd.warp(h.id, { x: r.rect.x + r.rect.w / 2 + 20, floor: r.room.floor });
    const hits = [];
    let lh = 30;
    for (let t = 0.6, i = 0; t < 8; t += 0.55, i++) {
      const by = i % 3 === 1 ? 'l' : 'h';
      const amount = by === 'h' ? (won ? 5 : 2) : 4;
      if (by === 'h') lh -= amount;
      hits.push({ t: Math.round(t * 10) / 10, by, amount, crit: i === 4 || undefined });
      if (lh <= 0) break;
    }
    const end = hits.at(-1).t + 0.6;
    g.set({
      ...s,
      heroes: s.heroes.map((x) => (x.id === h.id ? h : x)),
      incidents: s.incidents.map((i) => ({
        ...i,
        duel: { who: h.id, at: s.clock ?? 0, end, won, hits, hp: { h: 30, l: 30 } },
      })),
    });
    sc.resize(sc.cssW, sc.cssH, 5);
    sc.camera.centerOn(r.rect.x + r.rect.w / 2, r.rect.y + r.rect.h - 30, false);
  },
  { room, won: WON, cls: process.env.CLASE ?? 'guerrero' },
);
const [cw, ch] = (process.env.RECORTE ?? '').split('x').map(Number);
const clip = cw
  ? { x: (vp.width - cw) / 2, y: (vp.height - ch) / 2, width: cw, height: ch }
  : undefined;
let k = 0;
for (let t = 0; t < TOTAL; t += CADA) {
  await page.waitForTimeout(CADA);
  await page.screenshot({ path: `${out}/l${String(k++).padStart(3, '0')}.png`, clip });
}
await browser.close();
