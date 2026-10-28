/**
 * Capturas de la interfaz (paneles, fichas, barras) para revisar cambios a ojo, con unas
 * medidas de cada pantalla (cuánto tapa, cuánto texto, cuántos tamaños de letra…). Uso (con
 * `npm run build` y `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/ui.mjs <carpeta> [ancho] [alto] [puerto]
 *
 * Deja un PNG por pantalla y `medidas.json`. Prepara la partida con `window.__game` (#debug).
 * Para comparar antes y después con la misma partida, pasa en `PARTIDA` un JSON guardado
 * (por ejemplo `window.__game.get()` de un día 1): se carga como partida guardada y no sale
 * el amanecer del primer día.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots-ui';
const vp = { width: Number(process.argv[3] ?? 420), height: Number(process.argv[4] ?? 860) };
const port = process.argv[5] ?? '4173';
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
const page = await browser.newPage({
  viewport: vp,
  deviceScaleFactor: 1,
  hasTouch: vp.width < 900,
});
page.on('pageerror', (e) => console.log('PAGEERROR', e.stack));
const saved = process.env.PARTIDA ? readFileSync(process.env.PARTIDA, 'utf8') : null;
await page.addInitScript((game) => {
  localStorage.setItem(
    'jarro:ajustes',
    JSON.stringify({ music: 0, sfx: 0, ambient: 0, speed: 2, pace: 1, tester: true }),
  );
  if (game) localStorage.setItem('jarro:partida', game);
}, saved);

const metrics = {};
const wait = (ms = 450) => page.waitForTimeout(ms);
/** Medidas de lo que hay encima de la escena. */
const measure = () =>
  page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const sel =
      '.panel, .herocard, .dawn-card, .uncle-note, .worksbar, .room-menu, .eventcard, .hud-tip';
    const root = [...document.querySelectorAll(sel)].filter(vis).at(-1);
    const stage = document.querySelector('.stage')?.getBoundingClientRect();
    const res = { overlay: root?.className ?? null };
    if (!root || !stage) return res;
    const r = root.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, stage.right) - Math.max(r.left, stage.left));
    const h = Math.max(0, Math.min(r.bottom, stage.bottom) - Math.max(r.top, stage.top));
    res.tapa = Math.round(((w * h) / (stage.width * stage.height)) * 100);
    // Texto (también el que queda por debajo del scroll) y sus tamaños de letra.
    const sizes = new Set();
    let chars = 0;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) {
      const t = tw.currentNode.textContent.trim();
      if (!t) continue;
      const el = tw.currentNode.parentElement;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      chars += t.length;
      sizes.add(parseFloat(cs.fontSize));
    }
    res.letras = chars;
    res.tamanos = [...sizes].sort((a, b) => a - b);
    const sc = root.querySelector('.panel-body, .qs-scroll') ?? root;
    res.pantallas = Math.round((sc.scrollHeight / Math.max(1, sc.clientHeight)) * 10) / 10;
    res.botones = root.querySelectorAll('button, select, input').length;
    res.tarjetas = root.querySelectorAll('.card-paper').length;
    res.dentro = root.querySelectorAll(
      '.card-paper .card-paper, .card-paper .btn, .card-paper .pill',
    ).length;
    const small = [...root.querySelectorAll('button, select')].filter((b) => {
      const q = b.getBoundingClientRect();
      return q.width > 0 && (q.height < 44 || q.width < 44);
    });
    res.pequenos = small.length;
    return res;
  });
const shot = async (name) => {
  await wait(500);
  await page.screenshot({ path: `${out}/${name}.png` });
  metrics[name] = await measure();
  console.log(name, JSON.stringify(metrics[name]));
};
const esc = async (n = 1) => {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Escape');
    await wait(260);
  }
};
const click = async (locator) => {
  const l = page.locator(locator).first();
  if (!(await l.count())) {
    console.log('NO ESTÁ', locator);
    return false;
  }
  await l.click({ force: true }).catch((e) => console.log('NO SE PUEDE', locator, e.message));
  await wait(350);
  return true;
};
/** Pestañas de los paneles (las de antes y las de Tabs.tsx). */
const TABS = ':is(.segmented, .arcon-tabs, .segs)';
const tab = (name) => click(`.tab:has-text("${name}")`);
/** Toca una sala de la escena por su nombre. */
const tapRoom = async (prefix) => {
  const p = await page.evaluate((pre) => {
    const s = window.__scene;
    const sp = s.spots.find((x) => x.label.startsWith(pre));
    if (!sp) return null;
    s.camera.centerOn(sp.rect.x + sp.rect.w / 2, sp.rect.y + sp.rect.h / 2, false);
    return { x: sp.rect.x + sp.rect.w / 2, y: sp.rect.y + sp.rect.h / 2 };
  }, prefix);
  if (!p) return console.log('SIN SALA', prefix);
  await wait(400);
  const at = await page.evaluate((q) => {
    const s = window.__scene;
    const c = s.screenOf(q.x, q.y);
    const r = document.querySelector('.scene-canvas').getBoundingClientRect();
    const st = document.querySelector('.stage').getBoundingClientRect();
    return { x: c.x + st.left, y: c.y + st.top, r: [r.left, r.top] };
  }, p);
  await page.mouse.click(at.x, at.y);
  await wait(500);
};

await page.goto(`http://localhost:${port}/#debug`);
await wait(4500);

// 1. Partida nueva: amanecer del día 1, nota del tío y la casa.
await shot('01-amanecer-dia1');
await click('button[aria-label="Abrir la taberna"], button:has-text("Abrir la taberna")');
await wait(800);
await shot('02-nota-tio');
await page.evaluate(() => {
  const g = window.__game;
  g.set({ ...g.get(), tips: ['*'] });
});
await wait(600);
await shot('03-casa');
await click('.hud-stat');
await shot('04-hud-cifra');
await click('.hud-tip');

// 2. Una partida con algo de vida: oro, héroes contratados, un grupo fuera y unos días pasados.
await page.evaluate(() => {
  const g = window.__game;
  let s = g.get();
  g.set({ ...s, gold: 1500, rep: 40 });
  s = g.get();
  for (const c of s.candidates.slice(0, 3)) g.dispatch({ type: 'hire', id: c.id });
  s = g.get();
  const q = s.quests[0];
  if (q && s.heroes[0]) g.dispatch({ type: 'send', questId: q.id, heroIds: [s.heroes[0].id] });
});
await click('button[aria-label="Ajustes"]');
await shot('05-ajustes');
await click('button:has-text("Pasar 3 días")');
await click('button:has-text("+500 monedas")');
await esc();
await page.evaluate(() => {
  const g = window.__game;
  let s = g.get();
  for (const c of s.candidates.slice(0, 1)) g.dispatch({ type: 'hire', id: c.id });
  s = g.get();
  const free = s.heroes.filter((h) => h.status === 'ok');
  const q = s.quests[0];
  if (q && free[0]) g.dispatch({ type: 'send', questId: q.id, heroIds: [free[0].id] });
  // Sin consejos ni eventos pendientes, que taparían los paneles.
  g.set({ ...g.get(), tips: ['*'], event: null });
});
await wait(800);
await shot('06-casa-dia4');

// 3. Pestañas de abajo.
await tab('Tablón');
await shot('10-tablon');
await click('.note');
const picks = page.locator('.pick:not([disabled])');
for (let i = 0; i < Math.min(2, await picks.count()); i++) await picks.nth(i).click();
await shot('11-encargo');
await esc(2);

await tab('Héroes');
await shot('20-heroes');
await click(`${TABS} button:nth-child(2)`);
await shot('21-heroes-barra');
await click(`${TABS} button:nth-child(3)`);
await shot('22-heroes-trabajo');
await click(`${TABS} button:nth-child(1)`);
await click(':is(.hero-row, .row-main)');
await shot('23-ficha-heroe');
await esc(2);

await tab('Gremio');
await shot('30-gremio');
await click(`${TABS} button:nth-child(2), .tile:has-text("Salas")`);
await shot('31-gremio-mejoras');
await click(`${TABS} button:nth-child(1), .back`);
await click('button:has-text("Tu taberna"), .tile:has-text("Adornos")');
await shot('32-taberna');
await esc();
await tab('Gremio');
await click('button:has-text("Arcón y trofeos"), .tile:has-text("Arcón")');
await shot('33-arcon');
await esc();
await tab('Gremio');
await click('button:has-text("Libro de hazañas"), .tile:has-text("Libro")');
await shot('34-libro');
await esc();
await tab('Gremio');
await click('.tile:has-text("Partidas"), button:has-text("Guardar y cargar")');
await shot('35-partidas');
await esc(2);

// 4. Barra del día: correo, carta y mapa.
await click('button[aria-label^="Correo"]');
await shot('40-correo');
if (await click('.mail')) await shot('41-carta');
await esc(2);
await click('button[aria-label^="Fuera"]');
await shot('42-mapa');
if (await click('.map-help')) await shot('43-mapa-leyenda');
await esc();

// 5. Ficha de sala.
await tapRoom('Salón');
await shot('50-sala-salon');
await esc();
await tapRoom('Cocina');
await shot('51-sala-cocina');
await esc();

// 6. Modo obras (con el gremio ya pagado).
await page.evaluate(() => {
  const g = window.__game;
  g.set({ ...g.get(), mode: 'libre', opening: undefined });
});
await wait(600);
await click('button[aria-label="Modo obras"]');
await wait(600);
await shot('60-obras-cinta');
await tapRoom('Cocina');
await shot('61-obras-menu-sala');
// Apunta una mejora: la cinta enseña cuánto cuesta pagar.
await click('.room-menu .room-menu-btn');
await shot('63-obras-apuntada');
await click('.room-menu button[aria-label="Cerrar"]');
await click(
  '.ribbon-foot button[aria-label="Lista de salas"], .ribbon-foot button:has-text("Salas")',
);
await shot('62-obras-lista');
await esc();
await click('.ribbon-foot .ribbon-exit, .ribbon-foot button:has-text("Salir")');
// Con obras apuntadas, el segundo toque las descarta.
if (await page.locator('.ribbon').count())
  await click('.ribbon-foot .ribbon-exit, .ribbon-foot button:has-text("Descartar")');
await wait(400);

// 7. Terminar el día y el amanecer.
await page.evaluate(() => {
  const g = window.__game;
  g.set({ ...g.get(), mode: 'deuda' });
});
await click('.daybar .endday');
await wait(600);
await shot('70-anochecer');
await click('.daybar .endday');
await wait(16000);
await shot('71-amanecer');

writeFileSync(`${out}/medidas.json`, JSON.stringify(metrics, null, 1));
await browser.close();
