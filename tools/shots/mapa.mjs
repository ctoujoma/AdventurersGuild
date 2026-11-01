/**
 * Capturas del mapa de la comarca (`ui/panels/MapPanel.tsx`, `art/map.ts`), en vertical y en
 * horizontal. Uso (con `npm run build` y `npx vite preview --port 4173` en marcha):
 *
 *   node tools/shots/mapa.mjs <carpeta> [puerto=4173]
 *
 * Por cada versión del dibujo (`pergamino`, `color`, `actual`): el mapa al abrirlo
 * (`<versión>-*.png`, con la niebla de una partida nueva), con la sala de mapas completa
 * (`<versión>-todo-*.png`) y el dibujo entero, sin interfaz, a 1× y 3× (`<versión>-dibujo*.png`).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const port = process.argv[3] ?? '4173';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  headless: false,
});

for (const style of ['pergamino', 'color', 'actual'])
  for (const [tag, vp] of [
    ['vertical', { width: 420, height: 860 }],
    ['horizontal', { width: 860, height: 420 }],
  ]) {
    const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.stack));
    await page.addInitScript((style) => {
      localStorage.setItem('jarro:mapa', style);
      localStorage.setItem(
        'jarro:ajustes',
        JSON.stringify({ music: 0, sfx: 0, ambient: 0, speed: 1, pace: 1, tester: true }),
      );
    }, style);
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
    const open = async () => {
      await page.getByRole('button', { name: /Fuera del gremio/ }).click();
      await page.waitForTimeout(900);
    };
    await open();
    await page.screenshot({ path: `${out}/${style}-${tag}.png` });
    // Con la sala de mapas completa: todo a la vista.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const g = window.__game;
      const s = g.get();
      g.set({ ...s, fac: { ...s.fac, mapas: 2 } });
    });
    await page.waitForTimeout(300);
    await open();
    await page.screenshot({ path: `${out}/${style}-todo-${tag}.png` });
    if (tag === 'vertical') {
      // El dibujo entero, sin interfaz.
      for (const k of [1, 3])
        await page.evaluate((k) => {
          const c = document.querySelector('.map .map-layer');
          const o = document.createElement('canvas');
          o.width = c.width * k;
          o.height = c.height * k;
          const x = o.getContext('2d');
          x.imageSmoothingEnabled = false;
          x.drawImage(c, 0, 0, o.width, o.height);
          window[`__dibujo${k}`] = o.toDataURL();
        }, k);
      const { writeFileSync } = await import('node:fs');
      for (const k of [1, 3]) {
        const url = await page.evaluate((k) => window[`__dibujo${k}`], k);
        writeFileSync(
          `${out}/${style}-dibujo${k === 1 ? '' : '-3x'}.png`,
          Buffer.from(url.split(',')[1], 'base64'),
        );
      }
    }
    await page.close();
  }
await browser.close();
