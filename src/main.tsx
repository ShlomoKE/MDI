import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("Falta el nodo #raiz en index.html");

const app = (
  <StrictMode>
    <App />
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
