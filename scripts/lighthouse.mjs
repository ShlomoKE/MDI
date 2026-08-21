/**
 * Auditoría de Lighthouse contra el build servido en local.
 *
 *   npm run build
 *   npx vite preview --port 4173 --strictPort   # en otra terminal
 *   node scripts/lighthouse.mjs http://localhost:4173/ mobile
 *   node scripts/lighthouse.mjs http://localhost:4173/ desktop
 *
 * Lighthouse y chrome-launcher NO son dependencias del proyecto: arrastran todo
 * el árbol de puppeteer y con él una veintena de avisos de seguridad que no
 * pintan nada en un sitio estático. Instálalos solo cuando vayas a medir:
 *
 *   npm i -D --no-save lighthouse chrome-launcher
 *
 * Requiere Chrome instalado.
 */

import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import fs from 'node:fs';

const url = process.argv[2] || 'http://localhost:4173/';
const preset = process.argv[3] || 'mobile';

const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
try {
  const opts = {
    port: chrome.port,
    output: 'json',
    logLevel: 'error',
    ...(preset === 'desktop'
      ? { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false }, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 } }
      : {}),
  };
  const r = await lighthouse(url, opts);
  const cat = r.lhr.categories;
  console.log(`\n=== ${preset} ===`);
  for (const k of ['performance', 'accessibility', 'best-practices', 'seo']) {
    if (cat[k]) console.log(`${k.padEnd(16)} ${Math.round(cat[k].score * 100)}`);
  }
  const a = r.lhr.audits;
  const m = ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index'];
  console.log('--- métricas ---');
  for (const k of m) if (a[k]) console.log(`${k.padEnd(28)} ${a[k].displayValue}`);
  const fallos = Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && ['performance','accessibility','best-practices','seo'].some((c)=>cat[c]?.auditRefs.some((ar)=>ar.id===x.id)));
  if (fallos.length) {
    console.log('--- auditorías por debajo de 0.9 ---');
    for (const f of fallos) console.log(`  [${f.score}] ${f.id}: ${f.title}${f.displayValue ? ' — ' + f.displayValue : ''}`);
  }
  fs.writeFileSync(`informe-lighthouse-${preset}.json`, JSON.stringify(r.lhr, null, 1));
} finally {
  await chrome.kill();
}
