import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import App from "./App";
import { idiomaDeRuta } from "./i18n/idioma";
import "./index.css";

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("Falta el nodo #raiz en index.html");

// El idioma sale de la ruta —`/` español, `/en/` inglés—, que es exactamente lo
// que usó el prerenderizado para generar este HTML. Si se dedujera de otra cosa
// (el navegador, una cookie) el árbol del cliente no coincidiría con el del
// servidor y la hidratación fallaría.
const idioma = idiomaDeRuta(window.location.pathname);

// Se espera al módulo ANTES de hidratar: mientras tanto lo que se ve es el HTML
// prerenderizado, que ya es el definitivo. Sin Suspense y sin parpadeo, y Vite
// emite un chunk por idioma en vez de meter los dos documentos en el bundle.
const { default: Documento } =
  idioma === "en"
    ? await import("./contenido/documento.en.mdx")
    : await import("./contenido/documento.mdx");

const app = (
  <StrictMode>
    <App idioma={idioma} Documento={Documento} />
  </StrictMode>
);

// El build deja la página ya renderizada dentro de #raiz (ver
// scripts/prerender.mjs), así que aquí solo hay que hidratarla. En `vite dev`
// el contenedor viene vacío y se monta de cero.
if (raiz.firstElementChild) {
  hydrateRoot(raiz, app);
} else {
  createRoot(raiz).render(app);
}
