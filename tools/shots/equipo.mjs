/**
 * Capturas del equipo puesto (con `npm run build` y `npx vite preview --port 4173`):
 *
 *   node tools/shots/equipo.mjs <carpeta> [ancho] [alto]
 *
 * Viste a los héroes con una pieza por ranura (común, buena y legendaria, con los legendarios
 * propios y la corona), y saca su ficha (`ficha-<n>.png`), el Arcón (`arcon.png`) y la sala con
 * ellos dentro (`escena.png`).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const vp = { width: Number(process.argv[3] ?? 1280), height: Number(process.argv[4] ?? 860) };
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
const wait = (ms) => page.waitForTimeout(ms);
await page.goto('http://localhost:4173/#debug');
await wait(4500);
await page.mouse.click(vp.width / 2, vp.height / 2);
await wait(800);
const start = page.getByRole('button', { name: 'Nueva partida' });
if (await start.count()) await start.click();
await wait(2500);
for (let i = 0; i < 4; i++) {
  const close = page.locator(
    'button:has-text("Abrir la taberna"), button:has-text("Entrar en la taberna"), button:has-text("Seguir"), button:has-text("Entendido"), button:has-text("Vale")',
  );
  if (await close.count())
    await close
      .first()
      .click()
      .catch(() => {});
  await wait(500);
}
await page.evaluate(() => window.__game.dispatch({ type: 'tutorial', op: 'saltar' }));
await page.addStyleTag({ content: '.notebook, .notebook-mini { display: none !important; }' });
await wait(400);

// Una pieza por ranura en cada héroe; el último, con la corona.
await page.evaluate(() => {
  const g = window.__game;
  const s = structuredClone(g.get());
  s.tips = ['*'];
  const it = (name, kind, icon, rarity, extra = {}) => ({
    id: `x-${name}`,
    name,
    desc: '',
    value: 10,
    kind,
    icon,
    rarity,
    bonus: { Combate: 1 },
    ...extra,
  });
  const SETS = [
    [
      it('Espada larga', 'arma', 'espada', 0),
      it('Cota', 'armadura', 'coraza', 0),
      it('Botas', 'armadura', 'botas', 0),
    ],
    [
      it('Hacha buena', 'arma', 'hacha', 1),
      it('Escudo bueno', 'armadura', 'escudo', 1),
      it('Amuleto bueno', 'amuleto', 'amuleto', 1),
    ],
    [
      it('Varita de la Abuela Tormenta', 'arma', 'varita', 2),
      it('Capa de piel de ceniza', 'armadura', 'capa', 2),
      it('Botas de siete leguas', 'armadura', 'botas', 2),
    ],
    [
      it('Hoja de Vadoverde', 'arma', 'espada', 2),
      it('Coraza de escamas de sierpe', 'armadura', 'coraza', 2),
      it('Corona del Rey Ahogado', 'amuleto', 'amuleto', 2),
    ],
    [
      it('Espada larga', 'arma', 'espada', 0),
      it('Coraza buena', 'armadura', 'coraza', 1),
      it('Botas', 'armadura', 'botas', 0),
    ],
  ];
  const pool = [...s.heroes, ...(s.candidates ?? [])];
  s.heroes = pool.slice(0, 5).map((h, i) => {
    const [a, c, x] = SETS[i % SETS.length];
    // Con tinte el del escudo y el último, de coraza (comparten ranura): se ve su filete.
    const dress = i === 1 || i === 4 ? { ...h.dress, dye: 'mar' } : h.dress;
    return { ...h, dress, status: 'ok', worn: { arma: a, cuerpo: c, complemento: x } };
  });
  s.candidates = [];
  s.inventory = [
    ...(s.inventory ?? []),
    it('Cetro de la Reina', 'arma', 'varita', 2),
    it('Escudo de escama blanca', 'armadura', 'escudo', 2),
    it('Capa élfica', 'armadura', 'capa', 2),
    it('Espada', 'arma', 'espada', 0),
    it('Coraza buena', 'armadura', 'coraza', 1, { plus: 2 }),
  ];
  g.set(s);
});
await wait(1500);
const click = async (loc) => {
  const l = page.locator(loc).first();
  if (!(await l.count())) return console.log('NO ESTÁ', loc);
  await l.click({ force: true }).catch((e) => console.log('NO SE PUEDE', loc, e.message));
  await wait(450);
};
const n = await page.evaluate(() => window.__game.get().heroes.length);
for (let i = 0; i < n; i++) {
  await click('.tab:has-text("Héroes")');
  await click(`:is(.hero-row, .row-main) >> nth=${i}`);
  await click('button[data-tut="equipo"]');
  await wait(600);
  await page.screenshot({ path: `${out}/ficha-${i}.png` });
  await page.keyboard.press('Escape');
  await wait(300);
  await page.keyboard.press('Escape');
  await wait(300);
}
await click('.tab:has-text("Gremio")');
await click('button:has-text("Arcón y trofeos"), .tile:has-text("Arcón")');
await wait(600);
await page.screenshot({ path: `${out}/arcon.png` });
await page.keyboard.press('Escape');
await wait(300);
await page.keyboard.press('Escape');
await wait(2500);
await page.evaluate(() => {
  const sc = window.__scene;
  sc.resize(sc.cssW, sc.cssH, 4);
  const r = sc.layout.rooms.find((x) => x.room.type === 'salon') ?? sc.layout.rooms[0];
  sc.camera.centerOn(r.rect.x + r.rect.w / 2, r.rect.y + r.rect.h / 2, false);
});
await wait(1500);
await page.screenshot({ path: `${out}/escena.png` });
await browser.close();
