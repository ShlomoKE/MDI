/**
 * El idioma vigente, disponible en cualquier punto del árbol.
 *
 * Se fija una vez —en el prerenderizado con el idioma de la página, y en el
 * cliente leyéndolo de la ruta— y no cambia: pasar de un idioma a otro es
 * navegar a la otra URL, no un `setState`. Eso mantiene la hidratación trivial
 * y evita que exista un estado "a medio traducir".
 */

import { createContext, useContext, type ReactNode } from "react";

import type { Idioma } from "./idioma";
import { TEXTOS, type Textos } from "./textos";

const ContextoIdioma = createContext<Idioma>("es");

export function ProveedorIdioma({
  idioma,
  children,
}: {
  idioma: Idioma;
  children: ReactNode;
}) {
  return <ContextoIdioma.Provider value={idioma}>{children}</ContextoIdioma.Provider>;
}

export function useIdioma(): Idioma {
  return useContext(ContextoIdioma);
}

/** Las cadenas de la interfaz en el idioma vigente. */
export function useTextos(): Textos {
  return TEXTOS[useContext(ContextoIdioma)];
}
