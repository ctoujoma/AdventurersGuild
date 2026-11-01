/**
 * Capturas de la tira del encargo en curso (`ui/QuestStrip.tsx`), a ancho de móvil. Uso (con
 * `npm run build` y `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/tira.mjs <carpeta> [puerto=4173]
 *
 * Mete a mano un grupo fuera y abre su ficha; luego cambia el momento del viaje y saca cada
 * uno: de ida (`ida.png`), peleando (`pelea.png`), ante el jefe (`jefe.png`), el jefe caído
 * (`jefe-caido.png`), en retirada (`retirada.png`), de vuelta con heridos (`vuelta.png`), de noche
 * (`noche.png`), haciendo lo suyo (`faena.png`) y, de cerca, solo la tira (`tira-*.png`).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const port = process.argv[3] ?? '4173';
const vp = { width: 420, height: 860 };
/** Lo del reloj (ver `core/balance.ts`). */
const DAY = 300;
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
await page.evaluate(() => window.__game.dispatch({ type: 'tutorial', op: 'saltar' }));
await page.waitForTimeout(400);

/**
 * Un grupo fuera: `o.type` (tipo), `o.days`, el punto `t` del viaje (0–1), de noche o no, ante
 * el jefe (`boss`, `waiting`) y ya resuelto (`outcome`, `hurt`: cuántos vuelven heridos).
 */
async function trip(o) {
  await page.evaluate(
    ({ o, DAY }) => {
      const g = window.__game;
      const s = g.get();
      // Que vayan varios: los de la casa y los candidatos.
      const heroes = [
        ...s.heroes.filter((h) => !h.id.startsWith('extra')),
        ...s.candidates.slice(0, 2).map((h) => ({ ...h, id: `extra-${h.id}` })),
      ]
        .slice(0, 4)
        .map((h) => ({ ...h, status: 'mision' }));
      const days = o.days ?? 2;
      // De t (del total) al día y la hora: t = (días − quedan + reloj/día) / días.
      const whole = o.t * days;
      let left = days - Math.floor(whole);
      let part = whole - Math.floor(whole);
      if (o.night) part = Math.max(part, 0.85);
      if (left < 1) left = 1;
      const quest = {
        id: 'q-tira',
        title: o.boss ? 'La bestia de Hondogrís' : (o.title ?? 'Los lobos del pinar'),
        client: 'El alcalde',
        type: o.type ?? 'Cazar',
        text: o.text ?? 'Una manada de lobos ronda el pinar y ya se ha llevado dos ovejas.',
        place: o.boss ? 'el vado' : (o.place ?? 'el bosque de Sotomuro'),
        challenges: [],
        slots: 4,
        days,
        reward: 80,
        danger: 2,
        expires: 3,
        chain: o.boss ? { id: 'hondogris', step: 3 } : undefined,
      };
      const ids = heroes.map((h) => h.id);
      const m = {
        id: 'm-tira',
        quest,
        heroIds: ids,
        daysLeft: left,
        waiting: o.waiting,
        done: o.outcome
          ? {
              report: 'r-tira',
              outcome: o.outcome,
              fates: Object.fromEntries(
                ids.map((id, i) => [
                  id,
                  { status: i < (o.hurt ?? 0) ? 'herido' : 'ok', days: i < (o.hurt ?? 0) ? 3 : 0 },
                ]),
              ),
            }
          : undefined,
      };
      g.set({
        ...s,
        heroes: [
          ...s.heroes.filter((h) => !h.id.startsWith('extra')),
          ...heroes.filter((h) => h.id.startsWith('extra')),
        ].map((h) => (ids.includes(h.id) ? { ...h, status: 'mision' } : h)),
        missions: [m],
        clock: part * DAY,
        incidents: [],
      });
    },
    { o, DAY },
  );
  await page.waitForTimeout(300);
}

async function open() {
  if (await page.locator('[data-strip]').count()) return;
  await page.getByRole('button', { name: /Fuera del gremio/ }).click();
  await page.waitForTimeout(600);
  await page
    .getByRole('button', { name: /ver el viaje/ })
    .first()
    .click();
  await page.waitForTimeout(600);
}

async function shot(name) {
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0) el.scrollTop = 0;
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${name}.png` });
  const strip = page.locator('[data-strip]');
  if (await strip.count()) await strip.screenshot({ path: `${out}/tira-${name}.png` });
}

await trip({ t: 0.2 });
await open();
await shot('ida');

// La pelea: se busca el momento en que pelean (lo dice la etiqueta de la tira).
for (let t = 0.5; t < 0.76; t += 0.01) {
  await trip({ t });
  const label = await page.locator('[data-strip] canvas').getAttribute('aria-label');
  if (label?.includes('peleando')) break;
}
await shot('pelea');

await trip({
  t: 0.58,
  type: 'Recuperar',
  title: 'El arcón del molinero',
  text: 'Recuperar un arcón.',
});
await shot('faena');

await trip({ t: 0.65, boss: true, waiting: true });
await shot('jefe');
await trip({ t: 0.72, boss: true, outcome: 'Éxito' });
await shot('jefe-caido');
await trip({ t: 0.72, boss: true, outcome: 'Fracaso', hurt: 2 });
await shot('retirada');

await trip({ t: 0.86, outcome: 'Éxito parcial', hurt: 2 });
await shot('vuelta');

await trip({ t: 0.28, days: 3, night: true });
await shot('noche');

// Otros terrenos y familias, solo la tira.
for (const [i, o] of [
  { place: 'la cueva de la Sierpe', title: 'Trasgos en la cueva', text: 'Trasgos.' },
  { place: 'el cementerio de Ormaz', title: 'Esqueletos en el cementerio', text: 'Huesos.' },
  { place: 'el granero de los Cardo', title: 'Un trol en el granero', text: 'Un trol.' },
  { place: 'la laguna Negra', title: 'Arañas en la laguna', text: 'Arañas.' },
  { place: 'el vado', title: 'Salteadores en el vado', text: 'Bandidos.' },
].entries()) {
  for (let t = 0.5; t < 0.76; t += 0.01) {
    await trip({ type: 'Limpiar', ...o, t });
    const label = await page.locator('[data-strip] canvas').getAttribute('aria-label');
    if (label?.includes('peleando')) break;
  }
  await page.waitForTimeout(500);
  await page.locator('[data-strip]').screenshot({ path: `${out}/tira-familia-${i}.png` });
}
await browser.close();
