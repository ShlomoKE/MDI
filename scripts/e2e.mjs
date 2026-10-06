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

const base = (process.argv[2] || 'http://localhost:4173').replace(/\/+$/, '');
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

  // Interacción: cambiar de modo y comprobar que la URL lo refleja. El clic va
  // por el DOM y no por coordenadas: la calculadora acaba de montarse y sigue
  // asentando el layout, así que un clic posicional aterriza donde el botón ya
  // no está y el test falla por su cuenta, sin que la página tenga nada malo.
  await page.evaluate(() => {
    document.querySelector('button[aria-pressed="false"]').click();
  });
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

  // ---------- 2b. Chasis: la vista nueva, también a 360px ----------
  const chasisM = await browser.newPage();
  await chasisM.setViewport({ width: 360, height: 740, isMobile: true, deviceScaleFactor: 2 });
  const consolaC = [];
  chasisM.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consolaC.push(m.type() + ': ' + m.text()); });
  chasisM.on('pageerror', (e) => consolaC.push('pageerror: ' + e.message));
  await chasisM.goto(base + '/?vista=chasis#calculadora', { waitUntil: 'networkidle0' });
  await chasisM.waitForSelector('#calculadora article', { timeout: 8000 });

  const tarjetasC = await chasisM.$$eval('#calculadora article', (n) => n.length);
  ok(tarjetasC === 5, `a 360px la vista de chasis lista ${tarjetasC} tarjetas (esperadas 5)`);
  const textoC = await chasisM.$eval('#calculadora', (e) => e.textContent);
  ok(/DGX H100/.test(textoC) && /8 GPUs/.test(textoC), 'las tarjetas de chasis nombran el chasis y sus GPUs');
  const desbordeC = await chasisM.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
  ok(desbordeC.doc <= desbordeC.win + 1,
     `sin scroll horizontal a 360px en la vista de chasis (doc ${desbordeC.doc} vs ventana ${desbordeC.win})`);

  // El selector cambia la vista y la URL lo recuerda; el clic va por el DOM por
  // la misma razón que el del modo.
  await chasisM.evaluate(() => {
    const grupo = document.querySelector('#calculadora [role="group"][aria-label="Qué hardware comparar"]');
    Array.from(grupo.querySelectorAll('button')).find((b) => b.textContent === 'Ambos').click();
  });
  await chasisM.waitForFunction(() => location.search.includes('vista=ambos'), { timeout: 5000 });
  ok(true, 'la vista se serializa en la URL');
  const tarjetasAmbos = await chasisM.$$eval('#calculadora article', (n) => n.length);
  ok(tarjetasAmbos === tarjetasC + 7, `Ambos suma las GPUs y los chasis (${tarjetasAmbos} = ${tarjetasC} + 7)`);

  // ---------- 3. La página en inglés ----------
  const ingles = await browser.newPage();
  await ingles.setViewport({ width: 1440, height: 900 });
  const consolaEn = [];
  ingles.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consolaEn.push(m.type() + ': ' + m.text()); });
  ingles.on('pageerror', (e) => consolaEn.push('pageerror: ' + e.message));
  await ingles.goto(base + '/en/', { waitUntil: 'networkidle0' });

  ok((await ingles.$eval('html', (e) => e.lang)) === 'en', 'la página inglesa declara lang="en"');

  const tituloEn = await ingles.title();
  ok(/inference/i.test(tituloEn), `el <title> está en inglés: "${tituloEn}"`);

  const hreflang = await ingles.$$eval('link[rel="alternate"]', (n) =>
    n.map((l) => l.getAttribute('hreflang') + '=' + l.getAttribute('href')));
  // El sitio publica URLs absolutas (ver ORIGEN en prerender.mjs): se compara el
  // camino, no el origen, para que la comprobación valga con cualquier dominio.
  const rutas = hreflang.map((h) => {
    const [lang, href] = h.split('=');
    return lang + '=' + new URL(href, base).pathname;
  });
  ok(rutas.includes('es=/') && rutas.includes('en=/en/'),
     `hreflang enlaza las dos versiones: ${JSON.stringify(hreflang)}`);

  const textoEn = await ingles.$eval('#documento', (e) => e.textContent);
  ok(!/cómputo|memoria|ancho de banda/.test(textoEn),
     'el documento inglés no tiene restos de español');

  // El selector lleva de vuelta al español conservando el ancla.
  await ingles.goto(base + '/en/#limitations', { waitUntil: 'networkidle0' });
  // El sufijo lo rellena un efecto tras hidratar, así que se espera a que llegue
  // en vez de leerlo de inmediato.
  let destino = '(sin actualizar)';
  try {
    await ingles.waitForFunction(
      () => document.querySelector('a[hreflang="es"]')?.getAttribute('href') !== '/',
      { timeout: 5000 },
    );
    destino = await ingles.$eval('a[hreflang="es"]', (a) => a.getAttribute('href'));
  } catch { /* se reporta abajo */ }
  ok(destino === '/#limitations', `el selector conserva el ancla: ${destino}`);

  // Y la calculadora inglesa da los mismos números, que es lo que importa.
  await ingles.goto(base + '/en/#calculadora', { waitUntil: 'networkidle0' });
  await ingles.waitForSelector('#calculadora table', { timeout: 8000 });
  const calcEn = await ingles.$eval('#calculadora', (e) => e.textContent);
  ok(calcEn.includes('29.4 ms'), 'la calculadora inglesa da el mismo TPOT que motor.py');
  ok(!calcEn.includes('SLO de 30 ms inalcanzable'), 'el motivo del motor sale traducido en inglés');
  ok(/unreachable/i.test(calcEn), 'y sale en inglés');

  // El caso que de verdad duele: armar una configuración —que la calculadora
  // escribe con replaceState, sin disparar eventos— y cambiar de idioma.
  await ingles.goto(base + '/en/?slo=45&ua=99#calculadora', { waitUntil: 'networkidle0' });
  await ingles.waitForSelector('#calculadora table', { timeout: 8000 });
  await ingles.hover('a[hreflang="es"]');
  const conConfig = await ingles.$eval('a[hreflang="es"]', (a) => a.getAttribute('href'));
  ok(conConfig.includes('slo=45') && conConfig.includes('ua=99'),
     `cambiar de idioma conserva la configuración: ${conConfig}`);

  ok(consolaEn.length === 0, 'sin errores de consola en la página inglesa' + (consolaEn.length ? ': ' + consolaEn.join(' | ') : ''));

  ok(consola.length === 0, 'sin errores de consola en escritorio' + (consola.length ? ': ' + consola.join(' | ') : ''));
  ok(consolaM.length === 0, 'sin errores de consola en móvil' + (consolaM.length ? ': ' + consolaM.join(' | ') : ''));
  ok(consolaC.length === 0, 'sin errores de consola en la vista de chasis' + (consolaC.length ? ': ' + consolaC.join(' | ') : ''));

  await browser.disconnect();
} catch (e) {
  console.log('  ERROR  ' + e.message);
  fallos.push(e.message);
} finally {
  try { await chrome.kill(); } catch {}
}

console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\nTODO OK');
process.exitCode = fallos.length ? 1 : 0;
