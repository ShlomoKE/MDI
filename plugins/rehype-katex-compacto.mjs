/**
 * Colapsa cada ecuación ya renderizada por KaTeX en un solo nodo con
 * `dangerouslySetInnerHTML`.
 *
 * El porqué: KaTeX produce entre cincuenta y cien elementos por ecuación. Este
 * documento tiene medio centenar de ecuaciones, o sea unos 3 600 elementos —el
 * 78 % del DOM de la página— y MDX los convierte en otros tantos elementos de
 * React que hay que crear, reconciliar y montar en el arranque. Medido con
 * Lighthouse en móvil, eso solo costaba cerca de un segundo de bloqueo del hilo
 * principal.
 *
 * El HTML que KaTeX genera es estático: no depende del estado ni cambia nunca.
 * Entregárselo al navegador como una cadena para que lo parsee de una sentada
 * es órdenes de magnitud más barato que hacer que React lo construya nodo por
 * nodo, y el DOM resultante es idéntico —incluido el MathML que usan los
 * lectores de pantalla—.
 *
 * Va después de rehype-katex en la cadena de plugins.
 */

import { parse } from "acorn";
import { toHtml } from "hast-util-to-html";
import { SKIP, visit } from "unist-util-visit";

const clasesDe = (nodo) => {
  const c = nodo.properties && nodo.properties.className;
  if (!c) return [];
  return Array.isArray(c) ? c.map(String) : String(c).split(/\s+/);
};

/** El estree que MDX necesita para escribir un valor de atributo en JSX. */
function expresion(codigo) {
  const programa = parse(`(${codigo})`, { ecmaVersion: "latest", sourceType: "module" });
  return {
    type: "Program",
    sourceType: "module",
    comments: [],
    body: [
      {
        type: "ExpressionStatement",
        expression: programa.body[0].expression,
      },
    ],
  };
}

export default function rehypeKatexCompacto() {
  return (arbol) => {
    visit(arbol, "element", (nodo, indice, padre) => {
      if (!padre || indice === undefined) return;

      const clases = clasesDe(nodo);
      const bloque = clases.includes("katex-display");
      // El `.katex` interno de una ecuación en bloque ya viaja dentro del HTML
      // serializado del padre, así que nunca se visita por separado.
      if (!bloque && !clases.includes("katex")) return;

      const html = toHtml({ type: "root", children: nodo.children });
      const codigo = `{__html: ${JSON.stringify(html)}}`;

      padre.children[indice] = {
        type: bloque ? "mdxJsxFlowElement" : "mdxJsxTextElement",
        name: nodo.tagName,
        attributes: [
          { type: "mdxJsxAttribute", name: "className", value: clases.join(" ") },
          {
            type: "mdxJsxAttribute",
            name: "dangerouslySetInnerHTML",
            value: {
              type: "mdxJsxAttributeValueExpression",
              value: codigo,
              data: { estree: expresion(codigo) },
            },
          },
        ],
        children: [],
      };

      return SKIP;
    });
  };
}
