/**
 * Capturas del clima: fuerza cada tiempo y saca la vista desde fuera (zoom al mínimo y un paso
 * más), el patio y una sala con ventana, de día y de noche. Uso (con `npm run build` y
 * `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/clima.mjs <carpeta> [tiempos=despejado,nubes,nublado,niebla] [vistas=fuera,patio,sala]
 *
 * Con `TRANSICION=<tiempo>`, además, una tira de la vista desde fuera pasando de despejado a ese
 * tiempo (`transicion-NN.png`, cada poco; para un GIF).
 * Con `FOTOGRAMAS=<n>`, de cada captura salen además n fotogramas seguidos (`…-fNN.png`).
 * `HORAS` elige las horas (`manana,tarde,noche`; por defecto `dia,noche`), `ANCHO` y `ALTO` la
 * ventana y `PUERTO` el puerto. Saca `<tiempo>-<vista>-<hora>.png`.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const kinds = (process.argv[3] ?? 'despejado,nubes,nublado,niebla').split(',');
const views = (process.argv[4] ?? 'fuera,patio,sala').split(',');
const hours = (process.env.HORAS ?? 'dia,noche').split(',');
const port = process.env.PUERTO ?? '4173';
const vp = { width: Number(process.env.ANCHO ?? 1280), height: Number(process.env.ALTO ?? 760) };
const TOD = { manana: 0.1, dia: 0.35, tarde: 0.72 };
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
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
await page.goto(`http://localhost:${port}/#debug`);
await page.waitForTimeout(4500);
await page.mouse.click(vp.width / 2, vp.height / 2);
await page.waitForTimeout(800);
const start = page.getByRole('button', { name: 'Nueva partida' });
if (await start.count()) await start.click();
await page.waitForTimeout(2500);
for (let i = 0; i < 4; i++) {
  const close = page.locator(
    'button:has-text("Entrar en la taberna"), button:has-text("Abrir la taberna"), button:has-text("Seguir"), button:has-text("Entendido"), button:has-text("Vale")',
  );
  if (await close.count())
    await close
      .first()
      .click()
      .catch(() => {});
  await page.waitForTimeout(500);
}
await page.evaluate(() => {
  const g = window.__game;
  g.dispatch({ type: 'tutorial', op: 'saltar' });
  g.set({ ...g.get(), tips: ['*'] });
  const s = window.__scene;
  // El reloj del juego vuelve a poner la hora cada poco: aquí manda la captura.
  s.shotTime = s.setTime.bind(s);
  s.setTime = () => {};
});
await page.waitForTimeout(600);

/** Encuadra la vista: desde fuera, el patio de cerca o la sala con ventana del bajo. */
const frame = (view) =>
  page.evaluate((view) => {
    const s = window.__scene;
    const L = s.layout;
    if (view === 'fuera') {
      s.resize(s.cssW, s.cssH, s.minZoom(s.cssW, s.cssH));
      s.zoomBy(-1);
      s.camera.centerOn((L.left + L.right) / 2, 150, false);
    } else {
      if (s.outside) s.zoomBy(1);
      s.resize(s.cssW, s.cssH, 3);
      s.camera.centerOn(view === 'patio' ? L.left - 120 : L.left + 130, 255, false);
    }
  }, view);

/** Fuerza el tiempo y lo pone ya (sin la transición), con el manto entero pintado. */
const weather = (k) =>
  page.evaluate((k) => {
    const s = window.__scene;
    s.forceWeather = k;
    s.wxAt = 0;
  }, k);
/** La captura y, con `FOTOGRAMAS`, unos cuantos fotogramas seguidos (para un GIF). */
const shoot = async (name) => {
  await page.screenshot({ path: `${out}/${name}.png` });
  for (let i = 0; i < Number(process.env.FOTOGRAMAS ?? 0); i++) {
    await page.waitForTimeout(90);
    await page.screenshot({ path: `${out}/${name}-f${String(i).padStart(2, '0')}.png` });
  }
};
const settle = async () => {
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const s = window.__scene;
    while (s.sky.buildDeck(1000));
    s.skyAt = '';
  });
  await page.waitForTimeout(900);
  // El aviso de «arrastra para mirar» tapa el cielo.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('body *'))
      if (el.children.length === 0 && /Arrastra para mirar/.test(el.textContent ?? ''))
        (el.closest('[class]') ?? el).style.visibility = 'hidden';
  });
};

for (const h of hours.filter((h) => h !== 'noche'))
  for (const k of kinds) {
    await page.evaluate((tod) => window.__scene.shotTime(tod), TOD[h] ?? 0.35);
    await weather(k);
    for (const v of views) {
      await frame(v);
      await settle();
      await shoot(`${k}-${v}-${h}`);
    }
  }
const to = process.env.TRANSICION;
if (to) {
  await page.evaluate(() => window.__scene.shotTime(0.35));
  await weather('despejado');
  await frame('fuera');
  await settle();
  await page.evaluate((k) => (window.__scene.forceWeather = k), to);
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/transicion-${String(i).padStart(2, '0')}.png` });
  }
}
if (hours.includes('noche')) {
  await page.evaluate(() => {
    const s = window.__scene;
    s.shotTime(0.6);
    s.nightfall(() => {}, 30);
  });
  // Hasta que oscurece del todo; y la noche, quieta mientras se saca todo.
  await page.waitForFunction(() => window.__scene.daylight().day < 0.01, null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window.__scene.night.hold = 1e6));
  for (const k of kinds) {
    await weather(k);
    for (const v of views) {
      await frame(v);
      await settle();
      await shoot(`${k}-${v}-noche`);
    }
  }
}
await browser.close();
