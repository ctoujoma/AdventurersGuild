/**
 * Capturas de la guía de obras (Ajustes › «Repetir tutoriales»). Uso (con `npm run build` y
 * `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/guia.mjs [carpeta]   (por defecto, src/assets/guia)
 *
 * Juega el tutorial de obras tocando el foco (`.tut-ring`) y saca la escena sin el foco ni el
 * cuaderno; luego, un borrador que no se puede pagar (guardar y recuperar). Cada captura es un
 * recorte de 420 × 360 (a 2×) del móvil de 420 × 860. El marco de lo que hay que tocar en
 * cada una (en % del recorte) queda en `marcos.json`, que lee `src/data/guides.ts`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'src/assets/guia';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
let page;
/** Marco de cada captura, en % del recorte: [x, y, ancho, alto]. */
const boxes = {};
/** Abre una partida nueva de pruebas y le aplica `prep` (en la página). */
async function open(prep) {
  // Página nueva cada vez: sin la partida guardada de la vuelta anterior.
  await page?.close();
  page = await browser.newPage({
    viewport: { width: 420, height: 860 },
    deviceScaleFactor: 2,
    locale: 'es-ES',
  });
  await page.addInitScript(() =>
    localStorage.setItem('jarro:ajustes', JSON.stringify({ tester: true, music: 0, sfx: 0 })),
  );
  await page.goto('http://localhost:4173/#debug');
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(prep);
  await page.waitForTimeout(1500);
}
/**
 * Recorte de 360 de alto desde `y` (en píxeles del móvil), sin foco ni cuaderno. `box` es lo
 * que hay que tocar (en píxeles del móvil) o una función que lo mide justo al capturar.
 */
async function shot(name, y, box, tutorial = true) {
  // Esconder el foco reinicia las animaciones (el aviso volvería a entrar): solo en el tutorial.
  const hide = tutorial
    ? await page.addStyleTag({
        content: '.tut-focus,.notebook,.notebook-mini{visibility:hidden!important}',
      })
    : null;
  if (hide) await page.waitForTimeout(200);
  const [bx, by, bw, bh] = typeof box === 'function' ? await box() : box;
  await page.screenshot({
    path: `${out}/${name}.jpg`,
    type: 'jpeg',
    quality: 78,
    clip: { x: 0, y, width: 420, height: 360 },
  });
  await hide?.evaluate((e) => e.remove());
  // El marco, siempre dentro del recorte y en % de él.
  const pc = (v) => Math.round(v * 10) / 10;
  const x0 = Math.max(0, bx);
  const y0 = Math.max(0, by - y);
  const x1 = Math.min(420, bx + bw);
  const y1 = Math.min(360, by - y + bh);
  boxes[name] = [
    pc((x0 / 420) * 100),
    pc((y0 / 360) * 100),
    pc(((x1 - x0) / 420) * 100),
    pc(((y1 - y0) / 360) * 100),
  ];
}
/** El primer foco del tutorial, medido ahora (aunque esté escondido para la captura). */
const ringBox = () =>
  page.$$eval('.tut-ring', (els) => {
    const r = els.map((e) => e.getBoundingClientRect()).find((x) => x.width > 0);
    return [r.x, r.y, r.width, r.height];
  });

// 1. El tutorial de obras: en cada vuelta, el paso que toca; se toca el foco y se sigue.
await open(() => {
  const s = structuredClone(window.__game.get());
  s.gold = 1000;
  s.mode = 'libre';
  s.tips = [];
  s.dawn = [];
  s.tutorial = { step: 0, track: 'obras', letter: true, wait: true };
  window.__game.set(s);
  window.__game.dispatch({ type: 'tutorial', op: 'listo' });
});
/**
 * Qué captura sale en cada paso del tutorial (por su número), según el foco: el ancho del marco
 * dice si se señala una sala o hueco (ancho) o un botón (estrecho). Nombre y desde dónde se recorta.
 */
const PICK = [
  { step: 0, name: 'obras-1', y: 100 },
  { step: 1, name: 'obras-2', y: 250 },
  { step: 2, narrow: true, name: 'obras-3', y: 200 },
  { step: 3, max: 300, name: 'obras-4', y: 250 },
  { step: 4, min: 150, name: 'obras-5', y: 260 },
  // Construir: se señalan las salas de abajo, no el foco del paso.
  { step: 5, name: 'obras-6', y: 500, box: [6, 640, 408, 125] },
  { step: 6, name: 'obras-7', y: 500 },
];
for (let i = 0; i < 30; i++) {
  const step = await page.evaluate(() => window.__game.get().tutorial?.step);
  const rings = await page.$$eval('.tut-ring', (els) =>
    els
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0)
      .map((r) => ({
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
        w: r.width,
        box: [r.x, r.y, r.width, r.height],
      })),
  );
  const r = rings[0];
  const pick = r
    ? PICK.find(
        (p) =>
          p.step === step &&
          (!p.narrow || r.w < 80) &&
          (!p.max || r.w < p.max) &&
          (!p.min || r.w > p.min),
      )
    : null;
  if (pick) {
    await shot(pick.name, pick.y, pick.box ?? ringBox);
    PICK.splice(PICK.indexOf(pick), 1);
  }
  if (step === undefined || !PICK.length) break;
  if (r) await page.mouse.click(r.x, r.y);
  else {
    const btn = await page.$('.notebook button, button.btn-gold');
    if (!btn) break;
    await btn.click();
  }
  await page.waitForTimeout(1500);
}
if (PICK.length) console.log('Faltan capturas:', PICK.map((p) => p.name).join(', '));

// 2. Un borrador que no se puede pagar: se recupera al abrir las obras y se guarda con la ×.
await open(() => {
  const s = structuredClone(window.__game.get());
  const id = (t) => s.building.rooms.find((r) => r.type === t).id;
  const c = s.building.cols;
  s.gold = 120;
  s.mode = 'libre';
  s.tips = ['*'];
  s.dawn = [];
  delete s.tutorial;
  s.worksDraft = [
    { type: 'buyPlot' },
    { type: 'move', id: id('cocina'), col: c, floor: 0 },
    { type: 'extend', id: id('salon'), dir: 'right' },
    { type: 'dig', col: c, floor: -1 },
    { type: 'extend', id: id('tesoro'), dir: 'right' },
  ];
  window.__game.set(s);
});
for (let k = 0; k < 3 && (await page.$('.dawn')); k++) {
  await page.click('.dawn button');
  await page.waitForTimeout(800);
}
const rect = (sel) =>
  page.$eval(sel, (e) => {
    const r = e.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  });
// El aviso «Borrador recuperado» dura poco: se mide y se captura en cuanto sale.
const told = page.waitForSelector('.hint-toast.notice', { timeout: 5000 });
await page.click('[data-tut="martillo"]');
await told;
await shot('obras-10', 50, await rect('.hint-toast.notice'), false);
await shot('obras-8', 500, await rect('.ribbon-exit'), false);
await page.waitForTimeout(3500);
await page.click('.ribbon-exit');
await page.waitForTimeout(500);
await shot('obras-9', 500, await rect('.ribbon-keep'), false);
writeFileSync(`${out}/marcos.json`, JSON.stringify(boxes, null, 2) + '\n');
await browser.close();
