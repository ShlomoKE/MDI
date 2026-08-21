/**
 * Copia la hoja de estilos de KaTeX y sus fuentes a public/katex/.
 *
 * El porqué: importarla desde index.css la fusiona en el bundle CSS, que es
 * render-blocking. KaTeX son dos tercios de esos 52 kB, y ninguna ecuación se
 * ve en el primer pantallazo —la primera está varias pantallas más abajo, y
 * `content-visibility` hace que ni siquiera se maquete—. Sacándola aparte, el
 * navegador pinta con 18 kB de CSS en vez de 52 y aplica KaTeX después.
 *
 * Se copia en vez de importarse para que las rutas relativas a `fonts/` que
 * trae el CSS sigan resolviendo. public/ lo publica Vite tal cual.
 *
 * Corre antes de `vite` y de `vite build`; el destino está en .gitignore porque
 * es una copia de node_modules, no código del proyecto.
 */

import { cpSync, mkdirSync, rmSync } from "node:fs";

const ORIGEN = "node_modules/katex/dist";
const DESTINO = "public/katex";

rmSync(DESTINO, { recursive: true, force: true });
mkdirSync(DESTINO, { recursive: true });
cpSync(`${ORIGEN}/katex.min.css`, `${DESTINO}/katex.min.css`);
cpSync(`${ORIGEN}/fonts`, `${DESTINO}/fonts`, { recursive: true });

console.log(`KaTeX copiado a ${DESTINO}/`);
