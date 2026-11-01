/**
 * Pantallas de distintos tamaños: busca botones que quedan fuera de la pantalla (del todo o en
 * parte) o recortados por su caja, en las pantallas principales (título, carta del tío, taberna,
 * tablón, héroes, gremio, un encargo, el mapa y ajustes). Uso (con `npm run build` y
 * `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/tallas.mjs <carpeta> [tamaños=320x568,360x640,…] [puerto=4173]
 *
 * Deja una captura por tamaño y pantalla, y `informe.json`. Lo que se alcanza arrastrando
 * (marcas del mapa, letreros de la escena) no cuenta. Sale con error si queda algo fuera.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
mkdirSync(out, { recursive: true });
const SIZES = (
  process.argv[3] ||
  '320x568,360x640,375x667,390x844,412x915,768x1024,1024x768,1366x768,568x320,640x360,740x360,844x390,915x412'
).split(',');
const port = process.argv[4] ?? '4173';
const PAN = ['map-pin', 'map-missing', 'map-step', 'rumor', 'incident'];
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  headless: false,
});
const report = {};
let total = 0;
// Botones fuera de la pantalla (del todo o en parte) o recortados por un padre con overflow.
const scan = () => {
  const W = innerWidth,
    H = innerHeight,
    bad = [];
  for (const el of document.querySelectorAll('button, a[href], input, select, [role="button"]')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    // ¿Lo recorta un padre con overflow distinto de visible (y no es un scroll que se pueda mover)?
    let clip = null;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue;
      const scrollable =
        /auto|scroll/.test(ps.overflowX + ps.overflowY) &&
        (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1);
      if (scrollable) break;
      const pr = p.getBoundingClientRect();
      if (
        r.right > pr.right + 1 ||
        r.left < pr.left - 1 ||
        r.bottom > pr.bottom + 1 ||
        r.top < pr.top - 1
      ) {
        clip = p.className || p.tagName;
        break;
      }
    }
    // Dentro de un scroll: no cuenta si se puede llegar desplazando.
    let inScroll = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (
        /auto|scroll/.test(ps.overflowY + ps.overflowX) &&
        (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1)
      ) {
        inScroll = true;
        break;
      }
    }
    const off = r.right > W + 1 || r.left < -1 || r.bottom > H + 1 || r.top < -1;
    if ((off && !inScroll) || clip) {
      const label = (el.getAttribute('aria-label') || el.textContent || el.className || el.tagName)
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      bad.push({
        label,
        cls: String(el.className).slice(0, 40),
        r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
        off,
        clip,
      });
    }
  }
  const hs =
    document.documentElement.scrollWidth > W + 1
      ? `scroll horizontal ${document.documentElement.scrollWidth}`
      : null;
  return { bad, hs };
};
for (const size of SIZES) {
  const [W, H] = size.split('x').map(Number);
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    hasTouch: W < 1024 || H < 500,
    isMobile: W < 1024 || H < 500,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() =>
    localStorage.setItem(
      'jarro:ajustes',
      JSON.stringify({ music: 0, sfx: 0, ambient: 0, speed: 0, pace: 1, tester: true }),
    ),
  );
  const wait = (ms = 400) => page.waitForTimeout(ms);
  const click = async (sel) => {
    const l = page.locator(sel).first();
    if (!(await l.count())) return false;
    await l.click({ force: true }).catch(() => {});
    await wait(450);
    return true;
  };
  const res = {};
  const take = async (name) => {
    await wait(500);
    res[name] = await page.evaluate(scan);
    await page.screenshot({ path: `${out}/${size}-${name}.png` });
  };
  await page.goto(`http://localhost:${port}/#debug`);
  await wait(4000);
  await take('0-titulo');
  await click('button:has-text("Entrar en la taberna")');
  await wait(600);
  await take('1-carta-tio');
  await page.evaluate(() => {
    const g = window.__game;
    const s = structuredClone(g.get());
    s.tips = ['*'];
    s.event = null;
    delete s.tutorial;
    s.day = 6;
    g.set(s);
  });
  await wait(800);
  await click('button:has-text("Abrir")');
  await wait(500);
  await take('2-taberna');
  const tabs = [
    ['3-tablon', 'Tablón'],
    ['4-heroes', 'Héroes'],
    ['5-gremio', 'Gremio'],
  ];
  for (const [n, t] of tabs) {
    await click(`.tabs button:has-text("${t}")`);
    await take(n);
    await page.keyboard.press('Escape');
    await wait(700);
    await click('.tabs button:has-text("Taberna")');
  }
  await click('.tabs button:has-text("Tablón")');
  await click('.panel .quest, .panel [class*="quest"] button, .panel button.card');
  await take('6-encargo');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await wait(700);
  await click('.tabs button:has-text("Taberna")');
  await click('button[aria-label^="Fuera del gremio"]');
  await take('7-mapa');
  await page.keyboard.press('Escape');
  await wait(700);
  await click('button[aria-label="Ajustes"], button[aria-label*="justes"]');
  await take('8-ajustes');
  await page.keyboard.press('Escape');
  await wait(700);
  report[size] = res;
  let n = 0;
  for (const [screen, x] of Object.entries(res)) {
    x.bad = x.bad.filter((b) => !PAN.some((k) => b.cls.includes(k)));
    n += x.bad.length + (x.hs ? 1 : 0);
    for (const b of x.bad)
      console.log(
        `  ${size} ${screen}: «${b.label}» ${b.clip ? `recortado por ${b.clip}` : 'fuera'} ${b.r}`,
      );
  }
  total += n;
  console.log(size, n ? `${n} fuera` : 'bien');
  await ctx.close();
}
writeFileSync(`${out}/informe.json`, JSON.stringify(report, null, 1));
await browser.close();
if (total) process.exit(1);
