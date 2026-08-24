/**
 * La página: documento arriba, calculadora al final, navegación al costado.
 *
 * Es una sola página estática, en dos idiomas. Cada idioma se prerenderiza
 * entero —`/` en español, `/en/` en inglés— y el componente recibe cuál es por
 * prop, no lo deduce: así el árbol del servidor y el del cliente coinciden y la
 * hidratación no tiene nada que reconciliar.
 *
 * El documento viene de MDX —lo que permite meter componentes React entre los
 * párrafos— y la calculadora es el mismo motor que el documento explica.
 */

import type { ComponentType } from "react";

import SeccionCalculadora from "./components/SeccionCalculadora";
import SelectorIdioma from "./components/SelectorIdioma";
import { ANIO, AUTOR } from "./components/Cita";
import Navegacion from "./components/Navegacion";
import { ProveedorIdioma, useTextos } from "./i18n/contexto";
import type { Idioma } from "./i18n/idioma";

/**
 * El documento entra por prop, no por import. Si `App` importara los dos MDX,
 * cada página cargaría también el documento del otro idioma —son 26 kB
 * comprimidos de HTML de KaTeX que nadie va a leer—. Así cada bundle lleva solo
 * el suyo: `main.tsx` resuelve cuál antes de hidratar.
 */
export function App({
  idioma,
  Documento,
}: {
  idioma: Idioma;
  Documento: ComponentType;
}) {
  return (
    <ProveedorIdioma idioma={idioma}>
      <Pagina Documento={Documento} />
    </ProveedorIdioma>
  );
}

/** Separado de `App` solo para poder usar el hook por debajo del proveedor. */
function Pagina({ Documento }: { Documento: ComponentType }) {
  const t = useTextos();

  return (
    <div className="min-h-screen bg-fondo">
      <header className="border-b border-linea bg-superficie">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
          <div className="flex items-start justify-between gap-4 mb-3">
            <p className="rotulo text-suave">{t.encabezado.rotulo}</p>
            <SelectorIdioma className="shrink-0" />
          </div>
          <h1 className="font-cond font-bold tracking-tight text-4xl sm:text-5xl leading-[1.05] max-w-3xl">
            {t.encabezado.titulo}
          </h1>
          <p className="mt-3 text-sm">
            {t.encabezado.firma}{" "}
            <span className="font-semibold text-tinta">{AUTOR}</span>
            <span className="text-suave"> · {ANIO}</span>
          </p>
          <p className="mt-4 text-base sm:text-lg text-suave max-w-2xl leading-relaxed">
            {t.encabezado.entradilla}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="#calculadora"
              className="inline-flex items-center gap-2 rounded border border-tinta bg-tinta px-4 py-2 text-sm text-superficie hover:opacity-90 transition-opacity"
            >
              {t.encabezado.irCalculadora}
            </a>
            <a
              href={t.anclaCita}
              className="inline-flex items-center gap-2 rounded border border-linea bg-superficie px-4 py-2 text-sm text-tinta hover:bg-fondo transition-colors"
            >
              {t.encabezado.comoCitar}
            </a>
            <span className="text-xs text-suave">{t.encabezado.sinServidor}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl flex flex-col lg:flex-row lg:gap-10 lg:px-6">
        <Navegacion />
        <article
          id="documento"
          className="documento flex-1 min-w-0 px-4 sm:px-6 lg:px-0 py-8 lg:py-12"
        >
          <Documento />
        </article>
      </div>

      <SeccionCalculadora />

      <footer className="border-t border-linea bg-superficie">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 text-xs text-suave leading-relaxed">
          <p>{t.pie.motor}</p>
          <p className="mt-2">{t.pie.aviso}</p>
          <p className="mt-4 pt-4 border-t border-linea">
            {t.pie.autoria(AUTOR, ANIO)} {t.pie.citaResto}{" "}
            <a href={t.anclaCita} className="text-mem underline underline-offset-2">
              {t.pie.citaEnlace}
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
