/**
 * Comprobación de extremo a extremo en un Chrome real.
 *
 *   npm run build
 *   npx vite preview --port 4173 --strictPort   # en otra terminal
 *   node scripts/e2e.mjs
 *
 * Cubre lo que jsdom no puede: que la calculadora se monte de verdad al saltar
 * a ella, que los números coincidan con `python motor.py`, que a 360 px las
 * tablas sean tarjetas y la página no haga scroll horizontal, y que la consola
 * quede limpia en los dos tamaños.
 *
 * Igual que el script de Lighthouse, sus dependencias no viven en package.json:
 *
 *   npm i -D --no-save chrome-launcher puppeteer-core
 */

import { launch } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const base = 'http://localhost:4173';
const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
const fallos = [];
const ok = (c, m) => { console.log((c ? '  OK   ' : '  FALLA') + '  ' + m); if (!c) fallos.push(m); };

try {
  const browser = await puppeteer.connect({ browserURL: `http://localhost:${chrome.port}`, defaultViewport: null });

  // ---------- 1. Escritorio: diferido + salto ----------
  let page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const consola = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consola.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => consola.push('pageerror: ' + e.message));
  await page.goto(base + '/', { waitUntil: 'networkidle0' });

  ok(await page.$eval('#calculadora', (e) => e.getAttribute('aria-busy') !== null || !!e.querySelector('[aria-busy]')),
     'la calculadora arranca sin montar (marcador presente)');
  ok(!(await page.$('#calculadora table')), 'no hay tabla de resultados antes de acercarse');

  await page.click('header a[href="#calculadora"]');
  await page.waitForSelector('#calculadora table', { timeout: 8000 });
  ok(true, 'el enlace de salto monta la calculadora');

  const texto = await page.$eval('#calculadora', (e) => e.textContent);
  ok(texto.includes('29.4 ms'), 'la H100 SXM muestra el TPOT de motor.py (29.4 ms)');
  ok(texto.includes('SLO de 30 ms inalcanzable en L40S'), 'los motivos de inviabilidad son los de motor.py');

  // interacción: cambiar de modo y comprobar que la URL lo refleja
  await page.click('button[aria-pressed="false"]');
  await page.waitForFunction(() => location.search.includes('modo=capacidad'), { timeout: 5000 });
  ok(true, 'el modo se serializa en la URL');
  const cap = await page.$eval('#calculadora', (e) => e.textContent);
  ok(cap.includes('Frontera de capacidad'), 'el modo capacidad renderiza su gráfica');

  // ---------- 2. Móvil 360px: tarjetas y cero scroll horizontal ----------
  const movil = await browser.newPage();
  await movil.setViewport({ width: 360, height: 740, isMobile: true, deviceScaleFactor: 2 });
  const consolaM = [];
  movil.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consolaM.push(m.type() + ': ' + m.text()); });
  movil.on('pageerror', (e) => consolaM.push('pageerror: ' + e.message));
  await movil.goto(base + '/#calculadora', { waitUntil: 'networkidle0' });
  await movil.waitForSelector('#calculadora article', { timeout: 8000 });

  const tarjetas = await movil.$$eval('#calculadora article', (n) => n.length);
  ok(tarjetas === 7, `a 360px hay ${tarjetas} tarjetas apiladas (esperadas 7)`);
  const tablaVisible = await movil.$eval('#calculadora .hidden', (e) => getComputedStyle(e).display !== 'none').catch(() => false);
  ok(!tablaVisible, 'a 360px la tabla de escritorio está oculta');

  const desborde = await movil.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
    culpables: Array.from(document.querySelectorAll('body *'))
      .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 5)
      .map((e) => e.tagName + '.' + String(e.className).slice(0, 60)),
  }));
  ok(desborde.doc <= desborde.win + 1,
     `sin scroll horizontal a 360px (doc ${desborde.doc} vs ventana ${desborde.win})${desborde.culpables.length ? ' | ' + JSON.stringify(desborde.culpables) : ''}`);

  // la navegación móvil existe y lista las secciones
  const secciones = await movil.$$eval('nav[aria-label="Secciones"] a', (n) => n.length);
  ok(secciones >= 9, `la navegación lista ${secciones} secciones`);

  ok(consola.length === 0, 'sin errores de consola en escritorio' + (consola.length ? ': ' + consola.join(' | ') : ''));
  ok(consolaM.length === 0, 'sin errores de consola en móvil' + (consolaM.length ? ': ' + consolaM.join(' | ') : ''));

  await browser.disconnect();
} catch (e) {
  console.log('  ERROR  ' + e.message);
  fallos.push(e.message);
} finally {
  try { await chrome.kill(); } catch {}
}

console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\nTODO OK');
process.exitCode = fallos.length ? 1 : 0;
