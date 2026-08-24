/**
 * Entrada del prerenderizado.
 *
 * El sitio es una aplicación de cliente, así que sin esto el navegador no pinta
 * nada hasta haber descargado y ejecutado el JavaScript. Con un documento de
 * catorce mil píxeles eso costaba 2,7 s de primer pintado en móvil.
 *
 * `scripts/prerender.mjs` ejecuta este módulo una vez por idioma, mete cada
 * HTML resultante en su página y el navegador hidrata encima.
 */

import { renderToString } from "react-dom/server";

import App from "./App";
import DocumentoEs from "./contenido/documento.mdx";
import DocumentoEn from "./contenido/documento.en.mdx";
import type { Idioma } from "./i18n/idioma";

export function render(idioma: Idioma): string {
  // Aquí sí se importan los dos: esto corre en el build, no en el navegador.
  return renderToString(
    <App idioma={idioma} Documento={idioma === "en" ? DocumentoEn : DocumentoEs} />,
  );
}

// El script de prerenderizado necesita los textos para armar el <head> de cada
// idioma —título, descripción, metadatos de cita— y así no duplicarlos.
export { TEXTOS } from "./i18n/textos";
