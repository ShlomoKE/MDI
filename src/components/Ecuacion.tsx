/**
 * Renderiza LaTeX con KaTeX.
 *
 * El documento en MDX escribe matemáticas con `$…$` y `$$…$$`, que remark-math
 * y rehype-katex resuelven en tiempo de build: ese HTML ya viene hecho y no
 * necesita JavaScript. Este componente es para las ecuaciones que se arman en
 * tiempo de ejecución dentro de la interfaz — la calculadora muestra la fórmula
 * de la restricción que está mandando.
 *
 * KaTeX pesa unos 78 kB comprimidos, así que se carga bajo demanda: la página
 * pinta sin él y la ecuación aparece cuando el módulo llega. Mientras tanto se
 * muestra el LaTeX crudo, que es feo pero legible, en vez de un hueco.
 */

import { useEffect, useState } from "react";

interface Props {
  tex: string;
  /** En bloque y centrada; por omisión va en línea con el texto. */
  bloque?: boolean;
  className?: string;
  /** Texto alternativo para lectores de pantalla. */
  etiqueta?: string;
}

/** Una sola promesa para todo el árbol: el módulo se descarga una vez. */
let modulo: Promise<typeof import("katex")> | null = null;
const cargarKatex = () => (modulo ??= import("katex"));

export function Ecuacion({ tex, bloque = false, className = "", etiqueta }: Props) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    cargarKatex()
      .then(({ default: katex }) => {
        if (!vigente) return;
        setHtml(
          katex.renderToString(tex, {
            displayMode: bloque,
            throwOnError: false,
            strict: false,
            output: "html",
          }),
        );
      })
      // Si KaTeX no carga o el LaTeX viene roto, se queda la fuente a la vista.
      .catch(() => vigente && setHtml(null));
    return () => {
      vigente = false;
    };
  }, [tex, bloque]);

  const Etiqueta = bloque ? "div" : "span";

  if (html === null) {
    return (
      <Etiqueta className={"mono text-xs text-suave " + className} aria-label={etiqueta}>
        {tex}
      </Etiqueta>
    );
  }

  return (
    <Etiqueta
      className={(bloque ? "overflow-x-auto " : "") + className}
      role="math"
      aria-label={etiqueta}
    >
      <span aria-hidden={etiqueta ? true : undefined} dangerouslySetInnerHTML={{ __html: html }} />
    </Etiqueta>
  );
}

export default Ecuacion;
