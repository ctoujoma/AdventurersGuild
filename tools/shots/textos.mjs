/**
 * Volcado de los textos de la interfaz, siempre igual (reloj falso, azar con semilla y la misma
 * partida), para comparar antes y después de un cambio o buscar lo que no sale de los ficheros
 * con el idioma falso (ver docs/textos.md, «Herramientas»). Con `npm run build` y
 * `npx vite preview --port 4173` en marcha:
 *
 *   PARTIDA=src/core/fixtures/partida-v5.json node tools/shots/textos.mjs <carpeta> <guion.json>
 *
 * Deja un `.txt` por pantalla: el texto (`innerText`), los `aria-label`, `title`… y, al final,
 * los pasos que no se pudieron dar y los avisos de la consola («Texto sin escribir»).
 * Variables: `XLANG` (idioma, p. ej. `xx`), `J` (pantallas a la vez, 2), `PNG` (captura),
 * `T0`/`T1` (milisegundos de juego al abrir y tras cada paso), `CHROME`.
 *
 * Guion: `{ "nombre": [pasos] }`; un paso es `{ "click": selector, "n": i }`, `{ "key": tecla }`,
 * `{ "eval": código }` o, al final, `{ "explore": selector, "max": n }`: una pantalla más por
 * cada elemento que case, tocándolo. Un nombre que empieza por `nueva` es partida nueva.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const out = process.argv[2];
const plan = JSON.parse(readFileSync(process.argv[3], 'utf8'));
mkdirSync(out, { recursive: true });
const save = readFileSync(process.env.PARTIDA, 'utf8');
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const dump = (page) =>
  page.evaluate(() => {
    const attrs = [...document.querySelectorAll('[title],[aria-label],[placeholder],[alt]')]
      .map((e) =>
        ['title', 'aria-label', 'placeholder', 'alt']
          .map((a) => e.getAttribute(a))
          .filter(Boolean)
          .join(' | '),
      )
      .join('\n');
    return document.body.innerText + '\n---\n' + attrs;
  });
async function open(fresh) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e)));
  page.on('console', (m) => m.text().startsWith('Texto sin') && errs.push(m.text()));
  await page.clock.install({ time: new Date('2026-01-01T10:00:00Z') });
  await page.addInitScript(
    ([game, lang]) => {
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 200);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      let x = 12345;
      Math.random = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
      localStorage.setItem(
        'jarro:ajustes',
        JSON.stringify({ music: 0, sfx: 0, ambient: 0, speed: 1, pace: 1, tester: true, lang }),
      );
      if (game) localStorage.setItem('jarro:partida', game);
    },
    [fresh ? null : save, process.env.XLANG ?? undefined],
  );
  await page.goto('http://localhost:4173/#debug');
  await page.clock.runFor(Number(process.env.T0 ?? 600));
  await page.waitForTimeout(300);
  return { ctx, page, errs };
}
async function step(page, st, log) {
  try {
    if (st.click) {
      const l = page.locator(st.click).nth(st.n ?? 0);
      if (!(await l.count())) return log.push('NO ESTÁ ' + st.click + ' ' + (st.n ?? 0));
      await l.click({ force: true, timeout: 2000 });
    } else if (st.eval) await page.evaluate(st.eval);
    else if (st.key) await page.keyboard.press(st.key);
    await page.clock.runFor(st.ms ?? Number(process.env.T1 ?? 400));
    await page.waitForTimeout(120);
  } catch (e) {
    log.push('FALLA ' + JSON.stringify(st) + ' ' + e.message.split('\n')[0]);
  }
}
async function screen(name, steps, extra) {
  const { ctx, page, errs } = await open(name.startsWith('nueva'));
  const log = [];
  for (const st of steps) await step(page, st, log);
  let count = 0;
  if (extra) {
    count = await page.locator(extra.explore).count();
  }
  writeFileSync(
    `${out}/${name}.txt`,
    (await dump(page)) + '\n===\n' + [...log, ...errs].join('\n'),
  );
  if (process.env.PNG) await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, log.length + errs.length);
  await ctx.close();
  return count;
}
const jobs = [];
for (const [name, all] of Object.entries(plan)) {
  const ex = all.find((s) => s.explore);
  const steps = all.filter((s) => !s.explore);
  jobs.push(async () => {
    const n = await screen(name, steps, ex);
    const subs = [];
    if (ex)
      for (let i = 0; i < Math.min(n, ex.max ?? 30); i++)
        subs.push(() =>
          screen(`${name}.${String(i).padStart(2, '0')}`, [...steps, { click: ex.explore, n: i }]),
        );
    queue.push(...subs);
  });
}
const queue = [...jobs];
const worker = async () => {
  while (queue.length) await queue.shift()();
};
await Promise.all(Array.from({ length: Number(process.env.J ?? 2) }, worker));
await browser.close();
