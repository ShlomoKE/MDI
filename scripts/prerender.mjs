/**
 * Prerenderiza la página dentro de dist/index.html.
 *
 * Corre como último paso de `npm run build`, después del build de cliente y del
 * de servidor. Lo que hace es sustituir el `<div id="raiz"></div>` vacío por el
 * HTML ya renderizado, de forma que el navegador tenga algo que pintar antes de
 * ejecutar una sola línea de JavaScript. `main.tsx` detecta que el contenedor
 * viene lleno e hidrata en vez de montar de cero.
 *
 * Las partes interactivas no se prerenderizan por accidente: la calculadora
 * arranca sin montar a propósito, y la navegación no existe hasta que lee los
 * títulos del DOM. Las dos renderizan lo mismo en el servidor y en el primer
 * render del cliente, que es lo que la hidratación exige.
 */

import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const HTML = "dist/index.html";
const MARCA = '<div id="raiz"></div>';

/**
 * Las fuentes del texto que se ve nada más abrir. El navegador no las descubre
 * hasta haber descargado y parseado el CSS —HTML, luego CSS, luego fuente: tres
 * viajes en serie—, y hasta entonces el título espera. Medido, eso partía el
 * primer pintado en dos: 1.7 s cuando la fuente llegaba a tiempo y 2.6 s cuando
 * no. Precargarlas desde el HTML rompe la cadena.
 *
 * Solo las cuatro caras que aparecen en el encabezado y el primer párrafo. El
 * resto de pesos vive más abajo y puede esperar.
 */
const CRITICAS = [
  /^ibm-plex-sans-condensed-latin-700-normal-.*\.woff2$/, // el título
  /^ibm-plex-sans-condensed-latin-600-normal-.*\.woff2$/, // el rótulo de encima
  /^ibm-plex-sans-latin-400-normal-.*\.woff2$/, // el texto corrido
  /^ibm-plex-sans-latin-600-normal-.*\.woff2$/, // la firma y los destacados
];

function preloads() {
  const assets = readdirSync("dist/assets");
  return CRITICAS.map((patron) => {
    const archivo = assets.find((a) => patron.test(a));
    if (!archivo) {
      console.warn(`Aviso: no se encontró la fuente ${patron}; se publica sin precargarla.`);
      return "";
    }
    return `    <link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/${archivo}" />\n`;
  }).join("");
}

const { render } = await import(pathToFileURL(process.cwd() + "/dist-ssr/entry-server.js").href);

const plantilla = readFileSync(HTML, "utf8");
if (!plantilla.includes(MARCA)) {
  console.error(`No se encontró ${MARCA} en ${HTML}: el prerenderizado no se aplicó.`);
  process.exit(1);
}

const app = render();
const salida = plantilla
  .replace("</head>", preloads() + "  </head>")
  .replace(MARCA, `<div id="raiz">${app}</div>`);
writeFileSync(HTML, salida, "utf8");

// El build de servidor solo existía para esto.
rmSync("dist-ssr", { recursive: true, force: true });

const kb = (n) => (n / 1024).toFixed(1) + " kB";
console.log(`Prerenderizado: index.html ${kb(plantilla.length)} → ${kb(app.length)} de HTML`);
