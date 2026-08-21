/**
 * Entrada del prerenderizado.
 *
 * El sitio es una aplicación de cliente, así que sin esto el navegador no pinta
 * nada hasta haber descargado y ejecutado el JavaScript. Con un documento de
 * catorce mil píxeles eso costaba 2,7 s de primer pintado en móvil.
 *
 * `scripts/prerender.mjs` ejecuta este módulo tras el build, mete el HTML
 * resultante en dist/index.html y el navegador hidrata encima.
 */

import { renderToString } from "react-dom/server";

import App from "./App";

export function render(): string {
  return renderToString(<App />);
}
