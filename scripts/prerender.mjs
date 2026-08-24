/**
 * Prerenderiza las dos páginas del sitio: dist/index.html en español y
 * dist/en/index.html en inglés.
 *
 * Corre como último paso de `npm run build`, después del build de cliente y del
 * de servidor. Sustituye el `<div id="raiz"></div>` vacío por el HTML ya
 * renderizado, de forma que el navegador tenga algo que pintar antes de
 * ejecutar una sola línea de JavaScript. `main.tsx` detecta que el contenedor
 * viene lleno e hidrata en vez de montar de cero.
 *
 * Cada idioma es una página completa y no una variante que se cambia al vuelo:
 * así los buscadores indexan las dos, un enlace compartido abre en el idioma en
 * que se leyó, y la cita apunta a la versión correcta.
 *
 * Las partes interactivas no se prerenderizan por accidente: la calculadora
 * arranca sin montar a propósito, y la navegación no existe hasta que lee los
 * títulos del DOM. Las dos renderizan lo mismo en el servidor y en el primer
 * render del cliente, que es lo que la hidratación exige.
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MARCA = '<div id="raiz"></div>';
const MARCA_HEAD_INICIO = "<!-- i18n:head:inicio -->";
const MARCA_HEAD_FIN = "<!-- i18n:head:fin -->";

/**
 * El dominio final, si se conoce en tiempo de build.
 *
 * `canonical` y `hreflang` EXIGEN URLs absolutas: con rutas relativas los
 * buscadores las ignoran y Lighthouse las marca como inválidas —medido, la
 * puntuación de SEO caía de 100 a 83—. Como no se puede inventar el dominio,
 * sin origen no se emiten: es preferible no decir nada a decirlo mal.
 *
 * Se define en las variables de entorno del proyecto en Cloudflare, o a mano:
 *   MDI_ORIGEN=https://mdi.ejemplo.com npm run build
 */
const ORIGEN = (process.env.MDI_ORIGEN || process.env.CF_PAGES_URL || "").replace(/\/+$/, "");
const url = (ruta) => ORIGEN + ruta;

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

const escapar = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** El <head> propio de cada idioma: título, descripción, cita y alternancia. */
function cabecera(idioma, textos) {
  const m = textos.meta;
  const canonica = idioma === "es" ? "/" : "/en/";
  return [
    `    <title>${escapar(m.titulo)}</title>`,
    `    <meta name="description" content="${escapar(m.descripcion)}" />`,
    `    <meta name="author" content="Shlomo Kalach" />`,
    ``,
    `    <!-- Etiquetas Highwire Press: son las que leen Zotero, Mendeley y Google`,
    `         Scholar para armar la referencia sola cuando alguien guarda la página. -->`,
    `    <meta name="citation_title" content="${escapar(m.tituloCita)}" />`,
    `    <meta name="citation_author" content="Kalach, Shlomo" />`,
    `    <meta name="citation_publication_date" content="2026" />`,
    `    <meta name="citation_language" content="${idioma}" />`,
    ``,
    `    <meta property="og:type" content="article" />`,
    `    <meta property="article:author" content="Shlomo Kalach" />`,
    `    <meta property="og:title" content="${escapar(m.titulo)}" />`,
    `    <meta property="og:description" content="${escapar(m.descripcionCorta)}" />`,
    `    <meta property="og:locale" content="${idioma === "es" ? "es_MX" : "en_US"}" />`,
    ``,
    // Solo con el dominio conocido; ver la nota de ORIGEN. Emitirlos relativos
    // no es "menos preciso": es inválido, y cuesta 17 puntos de SEO.
    ...(ORIGEN
      ? [
          `    <link rel="canonical" href="${url(canonica)}" />`,
          `    <link rel="alternate" hreflang="es" href="${url("/")}" />`,
          `    <link rel="alternate" hreflang="en" href="${url("/en/")}" />`,
          `    <link rel="alternate" hreflang="x-default" href="${url("/")}" />`,
        ]
      : []),
  ].join("\n");
}

// --------------------------------------------------------------------------- //

const { render, TEXTOS } = await import(
  pathToFileURL(process.cwd() + "/dist-ssr/entry-server.js").href
);

const plantilla = readFileSync("dist/index.html", "utf8");
for (const marca of [MARCA, MARCA_HEAD_INICIO, MARCA_HEAD_FIN]) {
  if (!plantilla.includes(marca)) {
    console.error(`No se encontró ${marca} en dist/index.html: el prerenderizado no se aplicó.`);
    process.exit(1);
  }
}

const inicio = plantilla.indexOf(MARCA_HEAD_INICIO);
const fin = plantilla.indexOf(MARCA_HEAD_FIN) + MARCA_HEAD_FIN.length;
const antes = plantilla.slice(0, inicio);
const despues = plantilla.slice(fin);
const precargas = preloads();

const PAGINAS = [
  { idioma: "es", destino: "dist/index.html" },
  { idioma: "en", destino: "dist/en/index.html" },
];

for (const { idioma, destino } of PAGINAS) {
  const app = render(idioma);
  const salida = (antes + cabecera(idioma, TEXTOS[idioma]) + despues)
    .replace('<html lang="es">', `<html lang="${idioma}">`)
    .replace(
      '<div id="raiz"></div>',
      `<div id="raiz">${app}</div>`,
    )
    .replace("</head>", precargas + "  </head>");

  mkdirSync(destino.slice(0, destino.lastIndexOf("/")), { recursive: true });
  writeFileSync(destino, salida, "utf8");
  console.log(`  ${destino}  ${(salida.length / 1024).toFixed(1)} kB`);
}

// El build de servidor solo existía para esto.
rmSync("dist-ssr", { recursive: true, force: true });

console.log(
  `Prerenderizado: ${PAGINAS.length} páginas` +
    (ORIGEN
      ? ` con canonical y hreflang en ${ORIGEN}`
      : " sin canonical ni hreflang: define MDI_ORIGEN con el dominio para emitirlos"),
);
